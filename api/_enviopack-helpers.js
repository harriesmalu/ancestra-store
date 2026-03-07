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
function normalizeOption(raw, type) {
  const price = Math.round(parseFloat(raw.precio_final ?? raw.precio_list ?? raw.total ?? 0));
  const days  = String(raw.dias ?? '').match(/\d+/g) || [];

  const minDays = days[0] ? parseInt(days[0]) : null;
  const maxDays = days[1] ? parseInt(days[1]) : minDays;

  const deliveryLabel = !minDays ? '' :
    minDays === maxDays ? `${minDays} días hábiles`
                        : `${minDays} a ${maxDays} días hábiles`;

  const formatter = new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  });

  return {
    type,
    label:          type === 'domicilio' ? 'Envío a domicilio' : 'Retiro en sucursal',
    price,
    priceFormatted: formatter.format(price),
    deliveryMin:    minDays,
    deliveryMax:    maxDays,
    deliveryLabel,
    productName:    raw.nombre ?? raw.correo ?? 'Envíopack',
    carrier:        raw.correo ?? null,
    source:         'enviopack',
  };
}

// ── Cotizar domicilio ─────────────────────────────────────────────────────────
async function quoteHome(cp, provinceCode, token) {
  const params = new URLSearchParams({
    access_token: token,
    provincia:    provinceCode,
    codigo_postal: cp,
    peso:         String(PACKAGE.weight),
    paquetes:     PACKAGE.dimensions,
  });

  const res = await fetch(`${BASE_URL}/cotizar/precio/a-domicilio?${params}`);
  if (!res.ok) return null;

  const data = await res.json();
  if (!data.estado && !data.detalle) return null;

  const rows = Array.isArray(data.detalle) ? data.detalle : [data];
  // Elegir el más barato entre los transportistas disponibles
  const sorted = rows
    .filter(r => r && (r.precio_final ?? r.precio_list ?? r.total))
    .sort((a, b) =>
      parseFloat(a.precio_final ?? a.precio_list ?? a.total ?? 0) -
      parseFloat(b.precio_final ?? b.precio_list ?? b.total ?? 0)
    );

  return sorted.length ? normalizeOption(sorted[0], 'domicilio') : null;
}

// ── Cotizar sucursal ──────────────────────────────────────────────────────────
async function quoteBranch(cp, provinceCode, token) {
  const params = new URLSearchParams({
    access_token:  token,
    provincia:     provinceCode,
    codigo_postal: cp,
    peso:          String(PACKAGE.weight),
    paquetes:      PACKAGE.dimensions,
  });

  const res = await fetch(`${BASE_URL}/cotizar/precio/a-sucursal?${params}`);
  if (!res.ok) return null;

  const data = await res.json();
  if (!data.estado && !data.detalle) return null;

  const rows = Array.isArray(data.detalle) ? data.detalle : [data];
  const sorted = rows
    .filter(r => r && (r.precio_final ?? r.precio_list ?? r.total))
    .sort((a, b) =>
      parseFloat(a.precio_final ?? a.precio_list ?? a.total ?? 0) -
      parseFloat(b.precio_final ?? b.precio_list ?? b.total ?? 0)
    );

  return sorted.length ? normalizeOption(sorted[0], 'sucursal') : null;
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

  // Las dos cotizaciones en paralelo para mayor velocidad
  const [homeOpt, branchOpt] = await Promise.all([
    quoteHome(cp, provinceCode, token).catch(() => null),
    quoteBranch(cp, provinceCode, token).catch(() => null),
  ]);

  const options = [homeOpt, branchOpt].filter(Boolean);
  if (!options.length) throw new Error('Envíopack no devolvió cotizaciones para ese CP');
  return options;
}
