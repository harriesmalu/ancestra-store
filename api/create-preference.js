// api/create-preference.js
// Crea una preferencia de pago en MercadoPago y devuelve la URL de pago.
// Los datos completos del comprador se guardan en `metadata` para que el webhook
// pueda crear el envío en Correo Argentino tras la confirmación del pago.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Método no permitido' });

  try {
    const { orderNumber, items, shipping, totalArs, buyer } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Faltan items del pedido' });
    }

    const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
    if (!ACCESS_TOKEN) {
      return res.status(500).json({ error: 'MP_ACCESS_TOKEN no configurado' });
    }

    const SITE_URL = process.env.SITE_URL || 'https://ancestra-store.vercel.app';

    // ── Items de la preferencia ───────────────────────────────────────────────
    const mpItems = items.map(item => ({
      id:          String(item.id),
      title:       `${item.name}${item.volume_ml ? ` ${item.volume_ml}ml` : ''}`.trim(),
      category_id: 'health_beauty',
      quantity:    Number(item.qty)     || 1,
      unit_price:  Number(item.price_ars),
      currency_id: 'ARS',
    }));

    if (shipping?.cost > 0) {
      mpItems.push({
        id:          'envio',
        title:       shipping.label || 'Envío',
        category_id: 'services',
        quantity:    1,
        unit_price:  Number(shipping.cost),
        currency_id: 'ARS',
      });
    }

    // ── Metadata del pedido ───────────────────────────────────────────────────
    // Se incluye toda la info de dirección para que el webhook pueda crear
    // el envío en Correo Argentino sin necesidad de una base de datos externa.
    const orderMetadata = {
      order_number:   orderNumber || '',
      customer_name:  buyer?.name     || '',
      customer_email: buyer?.email    || '',
      customer_phone: buyer?.phone    || '',
      customer_dni:   buyer?.dni      || '',
      // Dirección de envío
      street_name:   buyer?.streetName   || buyer?.address || '',
      street_number: buyer?.streetNumber || '',
      floor:         buyer?.floor        || '',
      apartment:     buyer?.apartment    || buyer?.apt || '',
      city:          buyer?.city         || '',
      province:      buyer?.province     || '',
      postal_code:   buyer?.zip          || '',
      // Tipo de entrega ('D' domicilio | 'S' sucursal | 'P' pickup/retiro)
      delivery_type:    buyer?.deliveryType    || 'D',
      agency_code:      buyer?.agencyCode      || '',
      shipping_carrier: buyer?.shippingCarrier || '',
      shipping_source:  buyer?.shippingSource  || '',
      notes:            buyer?.notes           || '',
    };

    // ── Preferencia de MP ─────────────────────────────────────────────────────
    const preference = {
      items: mpItems,
      payer: {
        name:  buyer?.name  || '',
        email: buyer?.email || '',
        phone: { area_code: '', number: buyer?.phone || '' },
        identification: { type: 'DNI', number: buyer?.dni || '' },
        address: {
          street_name:   buyer?.address || '',
          street_number: '',
          zip_code:      buyer?.zip     || '',
        },
      },
      back_urls: {
        success: `${SITE_URL}/success.html?order=${orderNumber}&method=mp&status=approved`,
        failure: `${SITE_URL}/checkout.html?mp_error=1`,
        pending: `${SITE_URL}/success.html?order=${orderNumber}&method=mp&status=pending`,
      },
      auto_return:          'approved',
      external_reference:   orderNumber,
      statement_descriptor: 'ANCESTRA PARFUM',
      expires:              false,
      metadata:             orderMetadata,
    };

    console.log('🛒 Creando preferencia MP para orden:', orderNumber);

    const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
      },
      body: JSON.stringify(preference),
    });

    const mpData = await mpRes.json();

    if (!mpRes.ok) {
      console.error('❌ MP error:', mpData);
      return res.status(500).json({ error: 'Error creando preferencia MP', detail: mpData });
    }

    console.log('✅ Preferencia creada:', mpData.id);

    return res.status(200).json({
      ok:           true,
      preferenceId: mpData.id,
      initPoint:    mpData.init_point,
      sandboxUrl:   mpData.sandbox_init_point,
    });

  } catch (error) {
    console.error('❌ Error general:', error?.message);
    return res.status(500).json({ error: 'Error interno', detail: error?.message });
  }
}
