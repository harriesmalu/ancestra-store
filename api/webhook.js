// api/webhook.js
// Webhook de MercadoPago: recibe notificaciones de pago y orquesta
// la creación del envío en Correo Argentino y la notificación por N8N.
//
// ⚠️  Usa el SDK @mercadopago/sdk-js v2 (no la API antigua mercadopago.configure).
//     Si el pago está aprobado Y las variables de Correo están configuradas,
//     crea el envío automáticamente usando los datos guardados en metadata.

import { MercadoPagoConfig, Payment } from 'mercadopago';
import { createShipment } from './_correo-helpers.js';

// ── Clientes ──────────────────────────────────────────────────────────────────
function getMPClient() {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) throw new Error('MP_ACCESS_TOKEN no configurado');
  return new MercadoPagoConfig({ accessToken: token });
}

// ── N8N notifier ──────────────────────────────────────────────────────────────
async function notifyN8N(payload) {
  const url = process.env.N8N_WEBHOOK_URL;
  if (!url) {
    console.warn('⚠️  N8N_WEBHOOK_URL no configurada — saltando notificación');
    return;
  }
  try {
    const res = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
    console.log('📤 N8N notificado:', res.status);
  } catch (err) {
    console.error('⚠️  Error notificando N8N:', err.message);
  }
}

// ── Crear envío en Correo (si las credenciales están configuradas) ─────────────
async function tryCreateShipment(paymentData, meta) {
  if (!process.env.CORREO_CUSTOMER_ID || !process.env.CORREO_API_USER) {
    console.log('ℹ️  Correo no configurado — se omite creación de envío');
    return null;
  }

  try {
    const result = await createShipment({
      orderId:      meta.order_number || paymentData.external_reference,
      deliveryType: meta.delivery_type || 'D',
      agencyCode:   meta.agency_code   || undefined,
      total:        paymentData.transaction_amount,
      customer: {
        name:        meta.customer_name  || paymentData.payer?.first_name || '',
        email:       meta.customer_email || paymentData.payer?.email      || '',
        phone:       meta.customer_phone || paymentData.payer?.phone?.number || '',
        address:     meta.street_name    || paymentData.payer?.address?.street_name || '',
        streetName:  meta.street_name,
        streetNumber:meta.street_number,
        floor:       meta.floor,
        apartment:   meta.apartment,
        city:        meta.city           || 'Buenos Aires',
        province:    meta.province       || 'Buenos Aires',
        postalCode:  meta.postal_code    || paymentData.payer?.address?.zip_code || '',
      },
    });
    console.log('✅ Envío Correo creado automáticamente:', result);
    return result;
  } catch (err) {
    // No bloqueamos el webhook si Correo falla
    console.error('⚠️  Error creando envío en Correo:', err.message);
    return null;
  }
}

// ── Handler principal ─────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { type, data } = req.body || {};

  // MP envía distintos tipos: payment, plan, subscription, etc.
  // Solo procesamos pagos.
  if (type !== 'payment') {
    return res.status(200).json({ received: true, skipped: true, type });
  }

  const paymentId = data?.id;
  if (!paymentId) {
    console.warn('⚠️  Webhook sin payment ID');
    return res.status(400).json({ error: 'Falta data.id' });
  }

  try {
    // ── Obtener datos del pago desde la API de MP ─────────────────────────
    const mpClient      = getMPClient();
    const paymentClient = new Payment(mpClient);
    const paymentData   = await paymentClient.get({ id: paymentId });

    console.log(`💳 Webhook pago ${paymentId} — estado: ${paymentData.status}`);

    if (paymentData.status !== 'approved') {
      // Pago pendiente, rechazado, etc. — solo logueamos
      return res.status(200).json({ received: true, status: paymentData.status });
    }

    // ── Pago aprobado ─────────────────────────────────────────────────────
    const meta    = paymentData.metadata   || {};
    const payer   = paymentData.payer      || {};
    const address = payer.address          || {};

    // 1. Crear envío en Correo (fire & forget con manejo de error gracioso)
    const correoResult = await tryCreateShipment(paymentData, meta);

    // 2. Notificar a N8N para emails
    await notifyN8N({
      evento:         'pago_aprobado',
      paymentId,
      orderNumber:    paymentData.external_reference,
      // Datos del comprador
      nombre:         meta.customer_name  || `${payer.first_name || ''} ${payer.last_name || ''}`.trim(),
      email:          meta.customer_email || payer.email || '',
      telefono:       meta.customer_phone || payer.phone?.number || '',
      dni:            meta.customer_dni   || payer.identification?.number || '',
      // Dirección
      calle:          meta.street_name   || address.street_name || '',
      numero:         meta.street_number || '',
      piso:           meta.floor         || '',
      departamento:   meta.apartment     || '',
      ciudad:         meta.city          || '',
      provincia:      meta.province      || '',
      codigoPostal:   meta.postal_code   || address.zip_code || '',
      notas:          meta.notes         || '',
      // Pago
      monto:          paymentData.transaction_amount,
      fecha:          new Date(paymentData.date_approved).toLocaleString('es-AR', {
                        timeZone: 'America/Argentina/Buenos_Aires',
                      }),
      // Correo
      correoEnvioCreado: !!correoResult,
    });

    return res.status(200).json({ received: true, status: 'approved', correo: correoResult });

  } catch (error) {
    console.error('❌ Webhook error:', error.message);
    // Siempre respondemos 200 a MP para que no reintente
    return res.status(200).json({ received: true, error: error.message });
  }
}
