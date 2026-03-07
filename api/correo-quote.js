// api/correo-quote.js
// Cotiza envío con Correo Argentino MiCorreo
// GET /api/correo-quote?cp=1425&total=75000
// Devuelve opciones de envío (domicilio y sucursal) o bandera "free"

import { quoteShipping } from './_correo-helpers.js';

// Envío gratis a partir de este monto (ARS) — debe coincidir con shippingCalculator.js
const FREE_SHIPPING_THRESHOLD = 90000;

function formatPrice(price) {
  return new Intl.NumberFormat('es-AR', {
    style:                'currency',
    currency:             'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

function buildDeliveryLabel(min, max) {
  if (!min && !max) return '';
  if (min === max)  return `${min} días hábiles`;
  return `${min} a ${max} días hábiles`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET')    return res.status(405).json({ error: 'Método no permitido' });

  const { cp, total } = req.query;

  if (!cp || cp.trim().length < 4) {
    return res.status(400).json({ error: 'CP inválido (mínimo 4 dígitos)' });
  }

  if (!process.env.CORREO_CUSTOMER_ID) {
    return res.status(500).json({ error: 'CORREO_CUSTOMER_ID no configurado' });
  }

  // Envío gratis: no llamar a la API innecesariamente
  const orderTotal = parseFloat(total) || 0;
  if (orderTotal >= FREE_SHIPPING_THRESHOLD) {
    return res.json({ free: true, message: '¡Envío gratis!', options: [] });
  }

  try {
    const { rates, validTo } = await quoteShipping(cp);

    if (!rates.length) {
      return res.status(404).json({
        error: `No hay opciones de envío disponibles para el CP ${cp}`,
      });
    }

    const options = rates.map(rate => ({
      type:           rate.deliveredType === 'D' ? 'domicilio' : 'sucursal',
      label:          rate.deliveredType === 'D' ? 'Envío a domicilio' : 'Retiro en sucursal',
      price:          Math.round(rate.price),
      priceFormatted: formatPrice(rate.price),
      deliveryMin:    rate.deliveryTimeMin,
      deliveryMax:    rate.deliveryTimeMax,
      deliveryLabel:  buildDeliveryLabel(rate.deliveryTimeMin, rate.deliveryTimeMax),
      productName:    rate.productName,
    }));

    return res.json({ free: false, options, validTo });

  } catch (error) {
    console.error('correo-quote error:', error.message);
    return res.status(error.status || 500).json({
      error: error.message || 'No pudimos cotizar el envío. Verificá el CP ingresado.',
    });
  }
}
