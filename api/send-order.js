// api/send-order.js
// Recibe el pedido (directo o confirmado por MP) y lo envía a N8N para emails

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

    const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;

    if (!N8N_WEBHOOK_URL) {
      console.error('❌ N8N_WEBHOOK_URL no configurada');
      return res.status(200).json({ ok: true, warning: 'Sin N8N_WEBHOOK_URL' });
    }

    const formatter = new Intl.NumberFormat('es-AR', {
      style: 'currency', currency: 'ARS', maximumFractionDigits: 0
    });

    // Método de pago legible
    const metodoPagoMap = {
      mp:           'MercadoPago (tarjeta/débito)',
      transferencia: 'Transferencia bancaria',
      whatsapp:     'Coordinar por WhatsApp',
    };
    const metodoPago = metodoPagoMap[orderData.paymentMethod] || orderData.paymentMethod || 'No especificado';

    const subtotal = orderData.subtotal_ars || 0;
    const shipping = orderData.shipping_cost || 0;
    const total    = subtotal + shipping;

    const payload = {
      nombre:         orderData.name,
      email:          orderData.email,
      telefono:       orderData.phone,
      dni:            orderData.dni,
      direccion:      orderData.address,
      piso:           orderData.apt || '-',
      ciudad:         orderData.city,
      provincia:      orderData.province,
      codigoPostal:   orderData.zip,
      zona:           detectarZona(orderData.zip),
      notas:          orderData.notes || '-',
      numeroPedido:   orderData.orderNumber,
      metodoPago,
      productos:      orderData.items,
      productosTexto: orderData.items.map(i =>
        `${i.qty}x ${i.name} ${i.volume_ml || ''}ml = ${formatter.format((i.price_ars || 0) * (i.qty || 1))}`
      ).join('\n'),
      subtotal:       formatter.format(subtotal),
      envio:          shipping > 0 ? formatter.format(shipping) : 'Gratis',
      total:          formatter.format(total),
      fecha:          new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' }),
    };

    console.log('📤 Enviando a N8N:', N8N_WEBHOOK_URL);

    const n8nRes = await fetch(N8N_WEBHOOK_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });

    const n8nBody = await n8nRes.text();
    console.log('✅ N8N respuesta:', n8nRes.status, n8nBody);

    if (!n8nRes.ok) {
      console.error('❌ N8N error HTTP:', n8nRes.status, n8nBody);
      return res.status(200).json({ ok: true, warning: `N8N respondió ${n8nRes.status}` });
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
