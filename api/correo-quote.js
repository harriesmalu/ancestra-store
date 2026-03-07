// api/correo-quote.js
// Cotiza envío para ANCESTRA PARFUM con cadena de fallback automática:
//
//   1. Correo Argentino MiCorreo  →  si CORREO_CUSTOMER_ID está configurado
//   2. Envíopack (multi-carrier)  →  si ENVIOPACK_API_KEY está configurado
//   3. Tarifas por zona           →  siempre disponible, sin credenciales
//
// GET /api/correo-quote?cp=1414&total=75000

import { quoteShipping }  from './_correo-helpers.js';
import { quoteEnviopack } from './_enviopack-helpers.js';
import { getZoneRates }   from './_zone-rates.js';

// Umbral de envío gratis (ARS) — debe coincidir con shippingCalculator.js
const FREE_SHIPPING_THRESHOLD = 90000;

// ── Cotizar con Correo Argentino ──────────────────────────────────────────────
async function tryCorreo(cp) {
  const { rates, validTo } = await quoteShipping(cp);
  if (!rates.length) throw new Error('Correo: sin resultados');

  const formatter = new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  });

  const options = rates.map(rate => ({
    type:           rate.deliveredType === 'D' ? 'domicilio' : 'sucursal',
    label:          rate.deliveredType === 'D' ? 'Envío a domicilio' : 'Retiro en sucursal',
    price:          Math.round(rate.price),
    priceFormatted: formatter.format(rate.price),
    deliveryMin:    rate.deliveryTimeMin,
    deliveryMax:    rate.deliveryTimeMax,
    deliveryLabel:  buildDeliveryLabel(rate.deliveryTimeMin, rate.deliveryTimeMax),
    productName:    rate.productName,
    source:         'correo',
  }));

  return { options, validTo, source: 'correo' };
}

// ── Cotizar con Envíopack ─────────────────────────────────────────────────────
async function tryEnviopack(cp) {
  const options = await quoteEnviopack(cp);
  if (!options.length) throw new Error('Envíopack: sin resultados');
  return { options, source: 'enviopack' };
}

// ── Tarifas por zona (sin credenciales) ──────────────────────────────────────
function useZoneRates(cp) {
  const { options, province } = getZoneRates(cp);
  return { options, source: 'zone', province };
}

// ── Helper ────────────────────────────────────────────────────────────────────
function buildDeliveryLabel(min, max) {
  if (!min && !max) return '';
  if (min === max)  return `${min} días hábiles`;
  return `${min} a ${max} días hábiles`;
}

// ── Handler principal ─────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET')    return res.status(405).json({ error: 'Método no permitido' });

  const { cp, total } = req.query;

  if (!cp || cp.trim().length < 4) {
    return res.status(400).json({ error: 'CP inválido (mínimo 4 dígitos)' });
  }

  // Envío gratis antes de llamar a cualquier API
  const orderTotal = parseFloat(total) || 0;
  if (orderTotal >= FREE_SHIPPING_THRESHOLD) {
    return res.json({ free: true, message: '¡Envío gratis!', options: [] });
  }

  const cpClean = cp.trim();
  let result    = null;

  // ── 1. Correo Argentino ───────────────────────────────────────────────────
  if (process.env.CORREO_CUSTOMER_ID && process.env.CORREO_API_USER) {
    try {
      result = await tryCorreo(cpClean);
      console.log(`✅ Cotización vía Correo Argentino para CP ${cpClean}`);
    } catch (err) {
      console.warn(`⚠️  Correo Argentino falló (${err.message}) — intentando Envíopack`);
    }
  }

  // ── 2. Envíopack ──────────────────────────────────────────────────────────
  if (!result && process.env.ENVIOPACK_API_KEY) {
    try {
      result = await tryEnviopack(cpClean);
      console.log(`✅ Cotización vía Envíopack para CP ${cpClean}`);
    } catch (err) {
      console.warn(`⚠️  Envíopack falló (${err.message}) — usando tarifas por zona`);
    }
  }

  // ── 3. Tarifas por zona (siempre disponible) ──────────────────────────────
  if (!result) {
    result = useZoneRates(cpClean);
    console.log(`ℹ️  Usando tarifas por zona para CP ${cpClean} (${result.province})`);
  }

  return res.json({
    free:    false,
    options: result.options,
    source:  result.source,         // 'correo' | 'enviopack' | 'zone'
    validTo: result.validTo ?? null,
  });
}
