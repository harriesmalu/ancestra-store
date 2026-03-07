// api/correo-create-order.js
// Crea un envío en MiCorreo después de que el pago fue confirmado.
// POST /api/correo-create-order
// Body: { orderId, customer, total, deliveryType, agencyCode }

import { createShipment } from './_correo-helpers.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Método no permitido' });

  if (!process.env.CORREO_CUSTOMER_ID) {
    return res.status(500).json({ error: 'CORREO_CUSTOMER_ID no configurado' });
  }

  const { orderId, customer, total, deliveryType, agencyCode } = req.body || {};

  if (!orderId || !customer?.name || !customer?.postalCode) {
    return res.status(400).json({
      error: 'Faltan datos obligatorios (orderId, customer.name, customer.postalCode)',
    });
  }

  try {
    const result = await createShipment({ orderId, customer, total, deliveryType, agencyCode });
    console.log('✅ Envío Correo creado:', result);
    return res.status(200).json({ ...result, message: 'Envío creado exitosamente en MiCorreo' });
  } catch (error) {
    console.error('correo-create-order error:', error.message, error.detail || '');
    return res.status(error.status || 500).json({
      error:  error.message,
      detail: error.detail,
    });
  }
}
