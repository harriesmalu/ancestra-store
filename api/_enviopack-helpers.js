// api/_enviopack-helpers.js
// Cotización de envío con Envíopack (agrega Andreani, Correo, OCA y más).
// Docs: https://developers.enviopack.com.ar/
//
// Variables de entorno necesarias:
//   ENVIOPACK_API_KEY    — obtenido en app.enviopack.com → Configuraciones → API
//   ENVIOPACK_SECRET_KEY — idem

import { getProvinceCodeFromCP } from './_zone-rates.js';

const BASE_URL = 'https://api.enviopack.com';

// Dimensiones fijas del paquete ANCESTRA PARFUM
const PACKAGE = {
  weight: 0.5,           // kg
  dimensions: '15x15x15', // largo x alto x ancho (cm)
};

// ── Token cache (TTL 3.5 h, el token dura 4 h) ───────────────────────────────
let _token      = null;
let _tokenUntil = null;

async function getToken() {
  if (_token && _tokenUntil && Date.now() < _tokenUntil) return _token;

  const apiKey    = process.env.ENVIOPACK_API_KEY;
  const secretKey = process.env.ENVIOPACK_SECRET_KEY;

  if (!apiKey || !secretKey) {
    throw new Error('Faltan credenciales Envíopack (ENVIOPACK_API_KEY / ENVIOPACK_SECRET_KEY)');
  }

  const body = new URLSearchParams({ 'api-key': apiKey, 'secret-key': secretKey });

  const res = await fetch(`${BASE_URL}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Envíopack auth error ${res.status}: ${text}`);
  }

  const data  = await res.json();
  _token      = data.access_token;
  _tokenUntil = Date.now() + 3.5 * 60 * 60 * 1000; // 3.5 h

  if (!_token) throw new Error('Envíopack no devolvió access_token');
  return _token;
}

// ── Normalizar respuesta de Envíopack al formato estándar del frontend ────────
// Formato real de la API (developers.enviopack.com.ar/cotiza-un-envio):
//   precio: "valor" · entrega: "horas_entrega" (horas) · transportista: "correo" {id, nombre}
function rawPrice(r) {
  return parseFloat(r?.valor ?? r?.costo ?? r?.precio_final ?? r?.precio ?? r?.total ?? NaN);
}

function normalizeOption(raw, type) {
  const price = Math.round(rawPrice(raw));
  const hours = parseInt(raw.horas_entrega, 10);
  const minDays = Number.isFinite(hours) ? Math.max(1, Math.ceil(hours / 24)) : null;
  const maxDays = minDays !== null ? minDays + 1 : null;

  const deliveryLabel = minDays === null ? '' : `${minDays} a ${maxDays} días hábiles`;

  const carrierObj  = raw.correo ?? raw.sucursal?.correo ?? null;
  const carrierId   = typeof carrierObj === 'object' ? carrierObj?.id     : carrierObj;
  const carrierName = typeof carrierObj === 'object' ? carrierObj?.nombre : carrierObj;

  const formatter = new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  });

  return {
    type,
    label: (type === 'domicilio' ? 'Envío a domicilio' : 'Retiro en sucursal') +
           (carrierName ? ` · ${carrierName}` : ''),
    price,
    priceFormatted: formatter.format(price),
    deliveryMin:    minDays,
    deliveryMax:    maxDays,
    deliveryLabel,
    productName:    carrierName ?? 'Envíopack',
    carrier:        carrierId ?? null,
    source:         'enviopack',
  };
}

// ── Cotizar por CP con /cotizar/costo (todas las modalidades/correos) ─────────
async function quoteCosto(cp, provinceCode, token, modalidad) {
  const params = new URLSearchParams({
    access_token:  token,
    provincia:     provinceCode,
    codigo_postal: cp,
    peso:          String(PACKAGE.weight),
    paquetes:      PACKAGE.dimensions,
    modalidad,                 // 'D' domicilio | 'S' sucursal
    orden_columna: 'valor',
    orden_sentido: 'asc',
  });

  const res = await fetch(`${BASE_URL}/cotizar/costo?${params}`);
  const text = await res.text();
  if (!res.ok) {
    console.warn(`Envíopack /cotizar/costo ${modalidad} → ${res.status}: ${text.slice(0, 300)}`);
    return null;
  }

  let data;
  try { data = JSON.parse(text); } catch { return null; }
  const rows = Array.isArray(data) ? data : (Array.isArray(data?.detalle) ? data.detalle : [data]);
  const valid = rows.filter(r => Number.isFinite(rawPrice(r)) && rawPrice(r) > 0)
                    .sort((a, b) => rawPrice(a) - rawPrice(b));
  if (!valid.length) {
    console.warn(`Envíopack ${modalidad}: sin filas con precio. Respuesta: ${text.slice(0, 300)}`);
    return null;
  }
  return normalizeOption(valid[0], modalidad === 'D' ? 'domicilio' : 'sucursal');
}

// ── Fallback: /cotizar/precio/a-domicilio (objeto único con "valor") ──────────
async function quoteHomePrecio(cp, provinceCode, token) {
  const params = new URLSearchParams({
    access_token:  token,
    provincia:     provinceCode,
    codigo_postal: cp,
    peso:          String(PACKAGE.weight),
    paquetes:      PACKAGE.dimensions,
  });
  const res = await fetch(`${BASE_URL}/cotizar/precio/a-domicilio?${params}`);
  if (!res.ok) return null;
  const data = await res.json();
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || !Number.isFinite(rawPrice(row))) return null;
  return normalizeOption(row, 'domicilio');
}

// ── Normalizar nombre de transportista ────────────────────────────────────────
function normalizeCarrierCode(carrier) {
  if (!carrier) return undefined;
  const map = {
    'correo envíopack': 'correoenviopack',
    'correo enviopack': 'correoenviopack',
    'oca':               'oca',
    'andreani':          'andreani',
    'andesmar':          'andesmar',
    'chazki':            'chazki',
    'urbano':            'urbano',
    'cccargas':          'cccargas',
    'demonte':           'demonte',
  };
  return map[carrier.toLowerCase()] ?? carrier.toLowerCase().replace(/\s+/g, '');
}

// ── Crear orden en Envíopack ──────────────────────────────────────────────────
/**
 * Genera una orden de envío en Envíopack (queda como borrador pendiente de confirmación).
 * @param {Object} opts
 * @param {string} opts.orderId       - Número de pedido (ej: ANC-1234)
 * @param {Object} opts.customer      - { name, streetName, streetNumber, floor, apartment, city, postalCode }
 * @param {string} opts.deliveryType  - 'D' domicilio | 'S' sucursal
 * @param {string} [opts.carrier]     - Nombre del transportista elegido en el presupuesto
 */
export async function createEnviopackOrder({ orderId, customer, deliveryType, carrier }) {
  const token     = await getToken();
  const modalidad = deliveryType === 'S' ? 'sucursal' : 'domicilio';
  const correo    = normalizeCarrierCode(carrier);
  const provincia = getProvinceCodeFromCP(customer.postalCode || '');

  const body = {
    pedido:        String(orderId),
    destinatario:  customer.name || '',
    observaciones: 'Ancestra Parfum',
    modalidad,
    ...(correo ? { correo } : {}),
    confirmado:    false,
    paquetes: [{ peso: PACKAGE.weight, alto: 15, ancho: 15, largo: 15 }],
    direccion_envio: {
      calle:         customer.streetName   || customer.address || '',
      numero:        customer.streetNumber || '',
      piso:          customer.floor        || '',
      depto:         customer.apartment    || '',
      codigo_postal: customer.postalCode   || '',
      provincia,
      localidad:     customer.city         || '',
    },
  };

  const res = await fetch(
    `${BASE_URL}/envios?access_token=${encodeURIComponent(token)}`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Envíopack createOrder ${res.status}: ${text}`);
  }
  return res.json();
}

// ── Función principal exportada ───────────────────────────────────────────────
/**
 * Cotiza envío via Envíopack para un CP dado.
 * @param {string} cp - Código Postal destino
 * @returns {Promise<Array>} - Array de opciones de envío
 */
export async function quoteEnviopack(cp) {
  const token        = await getToken();
  const provinceCode = getProvinceCodeFromCP(cp);

  // Las dos modalidades en paralelo para mayor velocidad
  let [homeOpt, branchOpt] = await Promise.all([
    quoteCosto(cp, provinceCode, token, 'D').catch(e => { console.warn('EP D:', e.message); return null; }),
    quoteCosto(cp, provinceCode, token, 'S').catch(e => { console.warn('EP S:', e.message); return null; }),
  ]);

  // Plan B para domicilio si /cotizar/costo no devolvió nada
  if (!homeOpt) {
    homeOpt = await quoteHomePrecio(cp, provinceCode, token).catch(() => null);
  }

  const options = [homeOpt, branchOpt].filter(Boolean);
  if (!options.length) throw new Error('Envíopack no devolvió cotizaciones para ese CP');
  return options;
}
