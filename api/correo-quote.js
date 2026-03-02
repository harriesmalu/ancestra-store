// api/correo-quote.js
// Cotiza envío con Correo Argentino MiCorreo
// GET /api/correo-quote?cp=1425
// Devuelve precio de envío a domicilio y en sucursal

const { getToken, BASE_URL } = require('./correo-auth');

// Dimensiones fijas del paquete ANCESTRA PARFUM
const PACKAGE = {
  weight: 500,   // gramos
  height: 15,    // cm
  width: 15,     // cm
  length: 15,    // cm
};

const CP_ORIGEN = process.env.CORREO_CP_ORIGEN || '1428';
const CUSTOMER_ID = process.env.CORREO_CUSTOMER_ID;

// Envío gratis a partir de este monto (ARS)
const FREE_SHIPPING_THRESHOLD = 90000;

export default async function handler(req, res) {
  // CORS para que funcione desde el frontend
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });

  const { cp, total } = req.query;

  if (!cp || cp.length < 4) {
    return res.status(400).json({ error: 'CP inválido' });
  }

  if (!CUSTOMER_ID) {
    return res.status(500).json({ error: 'CORREO_CUSTOMER_ID no configurado' });
  }

  // Si supera el umbral, devolver envío gratis sin llamar a la API
  const orderTotal = parseFloat(total) || 0;
  if (orderTotal >= FREE_SHIPPING_THRESHOLD) {
    return res.json({
      free: true,
      message: '¡Envío gratis!',
      options: [],
    });
  }

  try {
    const token = await getToken();

    const body = {
      customerId: CUSTOMER_ID,
      postalCodeOrigin: CP_ORIGEN,
      postalCodeDestination: cp.trim(),
      dimensions: PACKAGE,
      // Sin deliveredType = devuelve ambas opciones (domicilio y sucursal)
    };

    const response = await fetch(`${BASE_URL}/rates`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Correo rates error:', data);
      return res.status(502).json({
        error: 'No pudimos cotizar el envío para ese CP',
        detail: data.message,
      });
    }

    // Formatear respuesta para el frontend
    const options = (data.rates || []).map(rate => ({
      type: rate.deliveredType === 'D' ? 'domicilio' : 'sucursal',
      label: rate.deliveredType === 'D' ? 'Envío a domicilio' : 'Retiro en sucursal',
      price: Math.round(rate.price),
      priceFormatted: formatPrice(rate.price),
      deliveryMin: rate.deliveryTimeMin,
      deliveryMax: rate.deliveryTimeMax,
      deliveryLabel: buildDeliveryLabel(rate.deliveryTimeMin, rate.deliveryTimeMax),
      productName: rate.productName,
    }));

    return res.json({
      free: false,
      options,
      validTo: data.validTo,
    });

  } catch (error) {
    console.error('correo-quote error:', error);
    return res.status(500).json({ error: error.message });
  }
}

function formatPrice(price) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

function buildDeliveryLabel(min, max) {
  if (!min && !max) return '';
  if (min === max) return `${min} días hábiles`;
  return `${min} a ${max} días hábiles`;
}
