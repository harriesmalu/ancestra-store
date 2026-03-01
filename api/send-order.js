// api/send-order.js
// Recibe el pedido desde el frontend y envía emails + notifica a N8N

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const orderData = req.body;
    console.log('📦 Pedido recibido:', orderData?.orderNumber, '| Email:', orderData?.email);

    if (!orderData?.email || !orderData?.name || !orderData?.items) {
      console.error('❌ Faltan datos');
      return res.status(400).json({ error: 'Faltan datos del pedido' });
    }

    // N8N (opcional)
    const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;
    if (N8N_WEBHOOK_URL) {
      try {
        const n8nRes = await fetch(N8N_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nombre: orderData.name, email: orderData.email,
            telefono: orderData.phone, dni: orderData.dni,
            direccion: orderData.address, piso: orderData.apt || '-',
            ciudad: orderData.city, provincia: orderData.province,
            codigoPostal: orderData.zip, zona: detectarZona(orderData.zip),
            notas: orderData.notes || '-', numeroPedido: orderData.orderNumber,
            productos: orderData.items, total: orderData.total,
            fecha: new Date().toLocaleString('es-AR'),
          })
        });
        console.log('✅ N8N webhook:', n8nRes.status);
      } catch (n8nErr) {
        console.error('⚠️ N8N error:', n8nErr.message);
      }
    }

    // Resend
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (!RESEND_API_KEY) {
      console.error('❌ Sin RESEND_API_KEY');
      return res.status(200).json({ ok: true, warning: 'Sin RESEND_API_KEY' });
    }

    const { Resend } = await import('resend');
    const resend = new Resend(RESEND_API_KEY);
    const zonaInfo = detectarZona(orderData.zip);
    const tiempoEstimado = zonaInfo === 'CABA' ? '24-48hs' : '48-72hs';
    const cartHTML = buildCartHTML(orderData.items);

    // Email al vendedor
    try {
      const r1 = await resend.emails.send({
        from: 'onboarding@resend.dev',
        to: ['ancestraparfum@gmail.com'],
        subject: `🛍️ Nuevo pedido ${orderData.orderNumber} — ${orderData.name}`,
        html: emailVendedor({ ...orderData, cartHTML })
      });
      console.log('✅ Email vendedor:', JSON.stringify(r1));
    } catch (e1) {
      console.error('❌ Error email vendedor:', e1?.message, JSON.stringify(e1));
    }

    // Email al cliente (via vendedor por limitación plan gratuito Resend)
    try {
      const r2 = await resend.emails.send({
        from: 'onboarding@resend.dev',
        to: ['ancestraparfum@gmail.com'],
        reply_to: orderData.email,
        subject: `📨 REENVIAR A CLIENTE: ${orderData.name} <${orderData.email}>`,
        html: `
          <div style="font-family:Arial;padding:16px;background:#fffbe6;border:2px solid #f0a500;border-radius:8px;margin-bottom:24px">
            <strong>⚠️ Reenviá este email a ${orderData.email} para confirmarle el pedido al cliente.</strong><br>
            <small>Limitación del plan gratuito de Resend. Verificá un dominio en resend.com/domains para envío automático.</small>
          </div>
          ${emailCliente({ ...orderData, cartHTML, tiempoEstimado })}
        `
      });
      console.log('✅ Email cliente (via vendedor):', JSON.stringify(r2));
    } catch (e2) {
      console.error('❌ Error email cliente:', e2?.message, JSON.stringify(e2));
    }

    return res.status(200).json({ ok: true, orderNumber: orderData.orderNumber });

  } catch (error) {
    console.error('❌ Error general:', error?.message);
    return res.status(500).json({ error: 'Error procesando el pedido', detail: error?.message });
  }
}

function detectarZona(zip) {
  if (!zip) return 'GBA';
  const cp = parseInt(zip);
  return (cp >= 1000 && cp <= 1499) ? 'CABA' : 'GBA';
}

function buildCartHTML(items) {
  if (!items?.length) return '<tr><td colspan="3">Sin productos</td></tr>';
  return items.map(item => `
    <tr>
      <td style="padding:6px 12px;border-bottom:1px solid #333">${item.qty}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #333">${item.name} ${item.volume_ml || ''}ml</td>
      <td style="padding:6px 12px;border-bottom:1px solid #333;text-align:right">$${((item.price_ars||0)*(item.qty||1)).toLocaleString('es-AR')}</td>
    </tr>`).join('');
}

function emailVendedor(data) {
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0a0a0a;color:#f0e6d3;padding:24px;border-radius:8px">
    <h2 style="color:#c9a96e;margin-top:0">🛍️ Nuevo pedido — ${data.orderNumber}</h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
      <tr><td style="padding:6px 0;color:#999;width:120px">Cliente</td><td><strong>${data.name}</strong></td></tr>
      <tr><td style="padding:6px 0;color:#999">Email</td><td>${data.email}</td></tr>
      <tr><td style="padding:6px 0;color:#999">Teléfono</td><td>${data.phone}</td></tr>
      <tr><td style="padding:6px 0;color:#999">DNI</td><td>${data.dni}</td></tr>
      <tr><td style="padding:6px 0;color:#999">Dirección</td><td>${data.address}${data.apt && data.apt!=='-'?', '+data.apt:''}</td></tr>
      <tr><td style="padding:6px 0;color:#999">Ciudad</td><td>${data.city}, ${data.province} (CP ${data.zip})</td></tr>
      ${data.notes&&data.notes!=='-'?`<tr><td style="padding:6px 0;color:#999">Notas</td><td>${data.notes}</td></tr>`:''}
    </table>
    <table style="width:100%;border-collapse:collapse;background:#1a1a1a;border-radius:6px">
      <thead><tr style="border-bottom:1px solid #444">
        <th style="padding:8px 12px;text-align:left;color:#c9a96e">Cant</th>
        <th style="padding:8px 12px;text-align:left;color:#c9a96e">Producto</th>
        <th style="padding:8px 12px;text-align:right;color:#c9a96e">Subtotal</th>
      </tr></thead>
      <tbody>${data.cartHTML}</tbody>
      <tfoot><tr style="border-top:1px solid #444">
        <td colspan="2" style="padding:10px 12px;font-weight:bold;color:#c9a96e">TOTAL</td>
        <td style="padding:10px 12px;text-align:right;font-weight:bold;color:#c9a96e">${data.total}</td>
      </tr></tfoot>
    </table>
    <p style="margin-top:20px;color:#555;font-size:12px">Pedido: ${new Date().toLocaleString('es-AR')}</p>
  </div>`;
}

function emailCliente(data) {
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0a0a0a;color:#f0e6d3;padding:24px;border-radius:8px">
    <h2 style="color:#c9a96e;margin-top:0">✨ ¡Gracias por tu pedido!</h2>
    <p>Hola <strong>${data.name}</strong>, recibimos tu pedido correctamente.</p>
    <div style="background:#1a1500;padding:14px;border-radius:6px;border-left:3px solid #c9a96e;margin:16px 0">
      📱 En breve te contactamos por WhatsApp para coordinar el pago y la entrega.<br>
      ⏱️ Tiempo estimado: <strong>${data.tiempoEstimado}</strong>
    </div>
    <table style="width:100%;border-collapse:collapse;background:#1a1a1a;border-radius:6px;margin:20px 0">
      <thead><tr style="border-bottom:1px solid #444">
        <th style="padding:8px 12px;text-align:left;color:#c9a96e">Cant</th>
        <th style="padding:8px 12px;text-align:left;color:#c9a96e">Producto</th>
        <th style="padding:8px 12px;text-align:right;color:#c9a96e">Subtotal</th>
      </tr></thead>
      <tbody>${data.cartHTML}</tbody>
      <tfoot><tr style="border-top:1px solid #444">
        <td colspan="2" style="padding:10px 12px;font-weight:bold;color:#c9a96e">TOTAL</td>
        <td style="padding:10px 12px;text-align:right;font-weight:bold;color:#c9a96e">${data.total}</td>
      </tr></tfoot>
    </table>
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      <tr><td style="padding:4px 0;color:#999;width:100px">Pedido N°</td><td>${data.orderNumber}</td></tr>
      <tr><td style="padding:4px 0;color:#999">Envío a</td><td>${data.address}, ${data.city}</td></tr>
    </table>
    <hr style="border:none;border-top:1px solid #222;margin:24px 0">
    <p style="color:#555;font-size:12px;text-align:center">
      ANCESTRA PARFUM · <a href="mailto:ancestraparfum@gmail.com" style="color:#c9a96e">ancestraparfum@gmail.com</a> · 
      <a href="https://instagram.com/ancestra.parfum" style="color:#c9a96e">@ancestra.parfum</a>
    </p>
  </div>`;
}
