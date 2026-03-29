// api/send-order.js
// Recibe el pedido y envía emails via Resend (alternativa gratuita a N8N)
// Setup: agregar RESEND_API_KEY en Vercel > Settings > Environment Variables
// Cuenta gratuita en resend.com — 3.000 emails/mes, 100/día

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const orderData = req.body;
    console.log('📦 Pedido recibido:', orderData?.orderNumber, '| Email:', orderData?.email, '| Método:', orderData?.paymentMethod);

    if (!orderData?.email || !orderData?.name || !orderData?.items) {
      console.error('❌ Faltan datos obligatorios');
      return res.status(400).json({ error: 'Faltan datos del pedido' });
    }

    const RESEND_API_KEY = process.env.RESEND_API_KEY;

    if (!RESEND_API_KEY) {
      console.warn('⚠️ RESEND_API_KEY no configurada — emails no enviados. Configurala en Vercel > Settings > Environment Variables');
      return res.status(200).json({ ok: true, warning: 'Sin RESEND_API_KEY' });
    }

    const formatter = new Intl.NumberFormat('es-AR', {
      style: 'currency', currency: 'ARS', maximumFractionDigits: 0
    });

    const metodoPagoMap = {
      mp:            'MercadoPago (tarjeta/débito)',
      transferencia: 'Transferencia bancaria',
      whatsapp:      'Coordinar por WhatsApp',
    };
    const metodoPago = metodoPagoMap[orderData.paymentMethod] || orderData.paymentMethod || 'No especificado';

    const subtotal = orderData.subtotal_ars || 0;
    const shipping = orderData.shipping_cost || 0;
    const total    = subtotal + shipping;
    const fecha    = new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });

    // ── Bloque de instrucciones según método de pago ──────────
    let pagoInstruccionesHtml = '';
    if (orderData.paymentMethod === 'transferencia') {
      pagoInstruccionesHtml = `
        <tr><td colspan="3" style="padding-top:20px;">
          <div style="background:#0d0d0d;border:1px solid #c9a96e;padding:16px 20px;border-radius:2px;">
            <p style="color:#c9a96e;font-size:13px;font-weight:600;margin:0 0 8px;">💳 Datos para transferencia</p>
            <p style="color:#ede8df;font-size:13px;margin:0;">Te enviaremos el CBU/alias por WhatsApp al <strong>${orderData.phone || ''}</strong> para completar el pago.</p>
          </div>
        </td></tr>`;
    } else if (orderData.paymentMethod === 'mp') {
      pagoInstruccionesHtml = `
        <tr><td colspan="3" style="padding-top:20px;">
          <div style="background:#0d0d0d;border:1px solid #5aaa8a;padding:16px 20px;border-radius:2px;">
            <p style="color:#5aaa8a;font-size:13px;font-weight:600;margin:0 0 8px;">✅ Pago procesado por MercadoPago</p>
            <p style="color:#ede8df;font-size:13px;margin:0;">Tu pago fue recibido. Coordinaremos el envío a la brevedad.</p>
          </div>
        </td></tr>`;
    } else if (orderData.paymentMethod === 'whatsapp') {
      pagoInstruccionesHtml = `
        <tr><td colspan="3" style="padding-top:20px;">
          <div style="background:#0d0d0d;border:1px solid #1a8a3a;padding:16px 20px;border-radius:2px;">
            <p style="color:#25d366;font-size:13px;font-weight:600;margin:0 0 8px;">💬 Coordinamos por WhatsApp</p>
            <p style="color:#ede8df;font-size:13px;margin:0;">Nos comunicaremos al <strong>${orderData.phone || ''}</strong> para definir el método de pago y el envío.</p>
          </div>
        </td></tr>`;
    }

    // ── Filas de productos ─────────────────────────────────────
    const productosFilasHtml = orderData.items.map(i => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #1c1c1c;color:#ede8df;font-size:13px;">
          ${i.qty > 1 ? `<span style="color:#c9a96e;font-weight:500;">${i.qty}×</span> ` : ''}${i.name}${i.volume_ml ? ` <span style="color:#6b6560;">${i.volume_ml}ml</span>` : ''}
        </td>
        <td style="padding:10px 0;border-bottom:1px solid #1c1c1c;text-align:right;color:#ede8df;font-size:13px;">
          ${formatter.format((i.price_ars || 0) * (i.qty || 1))}
        </td>
      </tr>
    `).join('');

    // ── Email al comprador ─────────────────────────────────────
    const buyerHtml = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#080808;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#080808;padding:32px 16px;">
  <tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

      <!-- Header -->
      <tr><td style="padding-bottom:32px;text-align:center;border-bottom:1px solid #1c1c1c;">
        <p style="margin:0;font-size:20px;letter-spacing:.35em;color:#ede8df;font-weight:300;">ANCESTRA</p>
        <p style="margin:2px 0 0;font-size:8px;letter-spacing:.5em;color:#6b6560;text-transform:uppercase;">PARFUM</p>
      </td></tr>

      <!-- Confirmación -->
      <tr><td style="padding:32px 0 8px;">
        <p style="margin:0;font-size:22px;font-weight:300;color:#ede8df;letter-spacing:.04em;">Pedido confirmado</p>
        <p style="margin:8px 0 0;font-size:13px;color:#6b6560;">N° ${orderData.orderNumber} &nbsp;·&nbsp; ${fecha}</p>
      </td></tr>

      <tr><td style="padding:6px 0 24px;">
        <p style="margin:0;font-size:14px;color:#a09890;line-height:1.7;">
          Hola, <strong style="color:#ede8df;">${orderData.name.split(' ')[0]}</strong>.<br/>
          Recibimos tu pedido y lo estamos procesando.
        </p>
      </td></tr>

      <!-- Productos -->
      <tr><td>
        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #1c1c1c;">
          <tr>
            <th style="padding:10px 16px;text-align:left;font-size:9px;letter-spacing:.25em;text-transform:uppercase;color:#6b6560;font-weight:400;border-bottom:1px solid #1c1c1c;background:#0d0d0d;">Producto</th>
            <th style="padding:10px 16px;text-align:right;font-size:9px;letter-spacing:.25em;text-transform:uppercase;color:#6b6560;font-weight:400;border-bottom:1px solid #1c1c1c;background:#0d0d0d;">Total</th>
          </tr>
          <tr><td colspan="2" style="padding:0 16px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              ${productosFilasHtml}
              <tr>
                <td style="padding:10px 0;color:#6b6560;font-size:13px;">Envío</td>
                <td style="padding:10px 0;text-align:right;color:#ede8df;font-size:13px;">${shipping > 0 ? formatter.format(shipping) : 'Gratis'}</td>
              </tr>
              <tr>
                <td style="padding:14px 0 10px;color:#ede8df;font-size:15px;font-weight:500;border-top:1px solid #282828;">Total</td>
                <td style="padding:14px 0 10px;text-align:right;color:#c9a96e;font-size:15px;font-weight:500;border-top:1px solid #282828;">${formatter.format(total)}</td>
              </tr>
              ${pagoInstruccionesHtml}
            </table>
          </td></tr>
        </table>
      </td></tr>

      <!-- Dirección -->
      <tr><td style="padding:24px 0 0;">
        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #1c1c1c;">
          <tr><td style="padding:12px 16px;background:#0d0d0d;border-bottom:1px solid #1c1c1c;">
            <p style="margin:0;font-size:9px;letter-spacing:.25em;text-transform:uppercase;color:#6b6560;">Dirección de envío</p>
          </td></tr>
          <tr><td style="padding:14px 16px;">
            <p style="margin:0;font-size:13px;color:#ede8df;line-height:1.7;">
              ${orderData.address}${orderData.apt && orderData.apt !== '-' ? `, ${orderData.apt}` : ''}<br/>
              ${orderData.city}, ${orderData.province} (CP ${orderData.zip})
            </p>
          </td></tr>
        </table>
      </td></tr>

      <!-- Método de pago -->
      <tr><td style="padding:16px 0 0;">
        <p style="margin:0;font-size:12px;color:#6b6560;">
          Método de pago: <span style="color:#a09890;">${metodoPago}</span>
        </p>
      </td></tr>

      <!-- Footer -->
      <tr><td style="padding:40px 0 0;border-top:1px solid #1c1c1c;margin-top:32px;text-align:center;">
        <p style="margin:0 0 4px;font-size:11px;color:#6b6560;">¿Tenés alguna consulta?</p>
        <p style="margin:0;font-size:12px;">
          <a href="mailto:ancestraparfum@gmail.com" style="color:#c9a96e;text-decoration:none;">ancestraparfum@gmail.com</a>
          &nbsp;·&nbsp;
          <a href="https://wa.me/5491165678354" style="color:#c9a96e;text-decoration:none;">WhatsApp</a>
        </p>
        <p style="margin:20px 0 0;font-size:10px;letter-spacing:.22em;color:#3a3632;text-transform:uppercase;">ANCESTRA PARFUM · CABA &amp; GBA</p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body></html>`;

    // ── Email a la tienda ──────────────────────────────────────
    const productosTexto = orderData.items.map(i =>
      `${i.qty}x ${i.name} ${i.volume_ml || ''}ml = ${formatter.format((i.price_ars || 0) * (i.qty || 1))}`
    ).join('<br/>');

    const storeHtml = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:20px;background:#f5f5f5;font-family:'Helvetica Neue',Arial,sans-serif;font-size:14px;color:#111;">
<div style="max-width:560px;background:#fff;border:1px solid #ddd;padding:24px;">
  <h2 style="margin:0 0 4px;font-size:18px;">🛍️ Nuevo pedido</h2>
  <p style="margin:0 0 20px;color:#666;font-size:13px;">${orderData.orderNumber} &nbsp;·&nbsp; ${fecha} &nbsp;·&nbsp; ${metodoPago}</p>

  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:20px;">
    <tr style="background:#f0f0f0;">
      <th style="padding:8px;text-align:left;font-size:12px;border:1px solid #ddd;">Cliente</th>
      <th style="padding:8px;text-align:left;font-size:12px;border:1px solid #ddd;">Contacto</th>
    </tr>
    <tr>
      <td style="padding:8px;border:1px solid #ddd;vertical-align:top;">
        <strong>${orderData.name}</strong><br/>
        DNI: ${orderData.dni || '-'}<br/>
        ${orderData.address}${orderData.apt && orderData.apt !== '-' ? `, ${orderData.apt}` : ''}<br/>
        ${orderData.city}, ${orderData.province} CP ${orderData.zip}<br/>
        Zona: ${detectarZona(orderData.zip)}
      </td>
      <td style="padding:8px;border:1px solid #ddd;vertical-align:top;">
        📧 <a href="mailto:${orderData.email}">${orderData.email}</a><br/>
        📱 <a href="tel:${orderData.phone}">${orderData.phone}</a><br/>
        <a href="https://wa.me/549${(orderData.phone||'').replace(/\D/g,'')}">Abrir WhatsApp →</a>
      </td>
    </tr>
  </table>

  <h3 style="margin:0 0 8px;font-size:14px;">Productos</h3>
  <p style="margin:0 0 16px;line-height:1.9;">${productosTexto}</p>

  <table width="100%" cellpadding="4" cellspacing="0" style="border-collapse:collapse;margin-bottom:20px;">
    <tr><td style="border-top:1px solid #ddd;padding:6px 0;">Subtotal</td><td style="border-top:1px solid #ddd;text-align:right;">${formatter.format(subtotal)}</td></tr>
    <tr><td>Envío (${orderData.shipping_label || '-'})</td><td style="text-align:right;">${shipping > 0 ? formatter.format(shipping) : 'Gratis'}</td></tr>
    <tr style="font-weight:bold;font-size:15px;"><td style="border-top:2px solid #111;padding-top:8px;">TOTAL</td><td style="border-top:2px solid #111;text-align:right;padding-top:8px;">${formatter.format(total)}</td></tr>
  </table>

  ${orderData.notes && orderData.notes !== '-' ? `<p style="margin:0 0 16px;"><strong>Notas:</strong> ${orderData.notes}</p>` : ''}
  ${orderData.shipping_delivery_type === 'S' ? `<p style="color:#c44;margin:0 0 16px;"><strong>⚠️ Retiro en sucursal</strong> — código agencia: ${orderData.shipping_agency_code || '-'}</p>` : ''}

  <p style="margin:0;font-size:12px;color:#999;border-top:1px solid #eee;padding-top:12px;">Ancestra Parfum · ${fecha}</p>
</div>
</body></html>`;

    // ── Enviar ambos emails via Resend ─────────────────────────
    const fromAddress = 'ANCESTRA PARFUM <no-reply@ancestraparfum.com.ar>';
    const storeEmail  = 'ancestraparfum@gmail.com';

    const [buyerResult, storeResult] = await Promise.allSettled([
      sendResendEmail(RESEND_API_KEY, {
        from:    fromAddress,
        to:      [orderData.email],
        subject: `Pedido confirmado ${orderData.orderNumber} — ANCESTRA PARFUM`,
        html:    buyerHtml,
      }),
      sendResendEmail(RESEND_API_KEY, {
        from:    fromAddress,
        to:      [storeEmail],
        subject: `🛍️ Nuevo pedido ${orderData.orderNumber} — ${orderData.name}`,
        html:    storeHtml,
      }),
    ]);

    const buyerOk  = buyerResult.status  === 'fulfilled' && buyerResult.value.ok;
    const storeOk  = storeResult.status  === 'fulfilled' && storeResult.value.ok;

    if (!buyerOk)  console.error('❌ Email comprador falló:', buyerResult.reason  || (await buyerResult.value?.text?.()));
    if (!storeOk)  console.error('❌ Email tienda falló:',   storeResult.reason   || (await storeResult.value?.text?.()));

    console.log(`✅ Emails: comprador=${buyerOk}, tienda=${storeOk}`);
    return res.status(200).json({ ok: true, orderNumber: orderData.orderNumber, emailBuyer: buyerOk, emailStore: storeOk });

  } catch (error) {
    console.error('❌ Error general:', error?.message);
    return res.status(500).json({ error: 'Error procesando el pedido', detail: error?.message });
  }
}

async function sendResendEmail(apiKey, payload) {
  return fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });
}

function detectarZona(zip) {
  if (!zip) return 'GBA';
  const cp = parseInt(zip);
  return (cp >= 1000 && cp <= 1499) ? 'CABA' : 'GBA';
}
