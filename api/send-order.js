// api/send-order.js
// Reemplaza EmailJS — recibe el pedido desde el frontend
// y lo reenvía al webhook de N8N para procesar emails y notificaciones

export default async function handler(req, res) {
  // CORS para Vercel
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const orderData = req.body;

    // Validación básica
    if (!orderData.email || !orderData.name || !orderData.items) {
      return res.status(400).json({ error: 'Faltan datos del pedido' });
    }

    // ─── ENVIAR A N8N ───────────────────────────────────────────────
    const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;

    if (N8N_WEBHOOK_URL) {
      try {
        await fetch(N8N_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            // Datos del cliente
            nombre: orderData.name,
            email: orderData.email,
            telefono: orderData.phone,
            dni: orderData.dni,

            // Dirección
            direccion: orderData.address,
            piso: orderData.apt || '-',
            ciudad: orderData.city,
            provincia: orderData.province,
            codigoPostal: orderData.zip,
            zona: orderData.zona || detectarZona(orderData.zip),
            notas: orderData.notes || '-',

            // Pedido
            numeroPedido: orderData.orderNumber,
            productos: orderData.items,
            total: orderData.total,
            fecha: new Date().toLocaleString('es-AR'),

            // Meta
            source: 'ancestra-store',
            timestamp: Date.now()
          })
        });
        console.log('✅ N8N webhook enviado');
      } catch (n8nError) {
        // N8N falla silenciosamente — no bloqueamos el pedido
        console.error('⚠️ N8N error (no crítico):', n8nError.message);
      }
    } else {
      console.warn('⚠️ N8N_WEBHOOK_URL no configurada en variables de entorno');
    }

    // ─── ENVIAR EMAIL VÍA RESEND (ya lo tenés configurado) ──────────
    const RESEND_API_KEY = process.env.RESEND_API_KEY;

    if (RESEND_API_KEY) {
      const { Resend } = await import('resend');
      const resend = new Resend(RESEND_API_KEY);

      const cartHTML = orderData.items.map(item =>
        `<tr>
          <td style="padding:6px 12px">${item.qty}</td>
          <td style="padding:6px 12px">${item.name} ${item.volume_ml}ml</td>
          <td style="padding:6px 12px">$${(item.price_ars * item.qty).toLocaleString('es-AR')}</td>
        </tr>`
      ).join('');

      const zonaInfo = detectarZona(orderData.zip);
      const tiempoEstimado = zonaInfo === 'CABA' ? '24-48hs' : '48-72hs';

      // Email al vendedor
      await resend.emails.send({
        from: 'ANCESTRA Store <onboarding@resend.dev>',
        to: 'ancestraparfum@gmail.com',
        subject: `🛍️ Nuevo pedido ${orderData.orderNumber} — ${orderData.name}`,
        html: emailVendedor({ ...orderData, cartHTML })
      });

      // Email al cliente
      await resend.emails.send({
        from: 'ANCESTRA PARFUM <onboarding@resend.dev>',
        to: orderData.email,
        subject: `✅ Pedido recibido — ANCESTRA PARFUM`,
        html: emailCliente({ ...orderData, cartHTML, tiempoEstimado })
      });

      console.log('✅ Emails Resend enviados');
    }

    return res.status(200).json({ ok: true, orderNumber: orderData.orderNumber });

  } catch (error) {
    console.error('❌ Error en send-order:', error);
    return res.status(500).json({ error: 'Error procesando el pedido' });
  }
}

// ─── HELPERS ────────────────────────────────────────────────────────────────

function detectarZona(zip) {
  if (!zip) return 'GBA';
  const cp = parseInt(zip);
  // CABA: 1000-1499
  return (cp >= 1000 && cp <= 1499) ? 'CABA' : 'GBA';
}

function emailVendedor(data) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0a0a0a;color:#f0e6d3;padding:24px;border-radius:8px">
      <h2 style="color:#c9a96e;margin-top:0">🛍️ Nuevo pedido — ${data.orderNumber}</h2>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
        <tr><td style="padding:6px 0;color:#999">Cliente</td><td style="padding:6px 0"><strong>${data.name}</strong></td></tr>
        <tr><td style="padding:6px 0;color:#999">Email</td><td style="padding:6px 0">${data.email}</td></tr>
        <tr><td style="padding:6px 0;color:#999">Teléfono</td><td style="padding:6px 0">${data.phone}</td></tr>
        <tr><td style="padding:6px 0;color:#999">DNI</td><td style="padding:6px 0">${data.dni}</td></tr>
        <tr><td style="padding:6px 0;color:#999">Dirección</td><td style="padding:6px 0">${data.address}${data.apt !== '-' ? `, ${data.apt}` : ''}</td></tr>
        <tr><td style="padding:6px 0;color:#999">Ciudad</td><td style="padding:6px 0">${data.city}, ${data.province} (CP ${data.zip})</td></tr>
        ${data.notes !== '-' ? `<tr><td style="padding:6px 0;color:#999">Notas</td><td style="padding:6px 0">${data.notes}</td></tr>` : ''}
      </table>
      <table style="width:100%;border-collapse:collapse;background:#1a1a1a;border-radius:6px">
        <thead><tr style="border-bottom:1px solid #333">
          <th style="padding:8px 12px;text-align:left;color:#c9a96e">Cant</th>
          <th style="padding:8px 12px;text-align:left;color:#c9a96e">Producto</th>
          <th style="padding:8px 12px;text-align:right;color:#c9a96e">Subtotal</th>
        </tr></thead>
        <tbody>${data.cartHTML}</tbody>
        <tfoot><tr style="border-top:1px solid #333">
          <td colspan="2" style="padding:10px 12px;font-weight:bold;color:#c9a96e">TOTAL</td>
          <td style="padding:10px 12px;text-align:right;font-weight:bold;color:#c9a96e">${data.total}</td>
        </tr></tfoot>
      </table>
      <p style="margin-top:20px;color:#666;font-size:12px">
        Fecha: ${new Date().toLocaleString('es-AR')} · ANCESTRA PARFUM
      </p>
    </div>`;
}

function emailCliente(data) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0a0a0a;color:#f0e6d3;padding:24px;border-radius:8px">
      <h2 style="color:#c9a96e;margin-top:0">✨ ¡Gracias por tu pedido!</h2>
      <p>Hola <strong>${data.name}</strong>, recibimos tu pedido correctamente.</p>
      <p style="background:#1a1a1a;padding:12px;border-radius:6px;border-left:3px solid #c9a96e">
        📱 En breve te contactamos por WhatsApp para coordinar el pago y la entrega.<br>
        ⏱️ Tiempo estimado: <strong>${data.tiempoEstimado}</strong>
      </p>
      <table style="width:100%;border-collapse:collapse;background:#1a1a1a;border-radius:6px;margin:20px 0">
        <thead><tr style="border-bottom:1px solid #333">
          <th style="padding:8px 12px;text-align:left;color:#c9a96e">Cant</th>
          <th style="padding:8px 12px;text-align:left;color:#c9a96e">Producto</th>
          <th style="padding:8px 12px;text-align:right;color:#c9a96e">Subtotal</th>
        </tr></thead>
        <tbody>${data.cartHTML}</tbody>
        <tfoot><tr style="border-top:1px solid #333">
          <td colspan="2" style="padding:10px 12px;font-weight:bold;color:#c9a96e">TOTAL</td>
          <td style="padding:10px 12px;text-align:right;font-weight:bold;color:#c9a96e">${data.total}</td>
        </tr></tfoot>
      </table>
      <table style="width:100%;border-collapse:collapse">
        <tr><td style="padding:4px 0;color:#999">Pedido N°</td><td>${data.orderNumber}</td></tr>
        <tr><td style="padding:4px 0;color:#999">Envío a</td><td>${data.address}, ${data.city}</td></tr>
      </table>
      <hr style="border:none;border-top:1px solid #222;margin:24px 0">
      <p style="color:#666;font-size:12px;text-align:center">
        ANCESTRA PARFUM · <a href="mailto:ancestraparfum@gmail.com" style="color:#c9a96e">ancestraparfum@gmail.com</a> · 
        <a href="https://instagram.com/ancestra.parfum" style="color:#c9a96e">@ancestra.parfum</a>
      </p>
    </div>`;
}
