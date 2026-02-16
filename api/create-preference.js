create-preference.js
import mercadopago from 'mercadopago';

mercadopago.configure({
  access_token: process.env.MP_ACCESS_TOKEN
});

export default async function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { items, payer } = req.body;

    const preference = {
      items: items.map(item => ({
        title: item.title,
        quantity: item.quantity,
        unit_price: item.unit_price,
        currency_id: 'ARS'
      })),
      payer: {
        name: payer.name,
        email: payer.email,
        phone: {
          number: payer.phone
        },
        identification: {
          type: 'DNI',
          number: payer.dni
        },
        address: {
          street_name: payer.address,
          zip_code: payer.zip
        }
      },
      back_urls: {
        success: `${process.env.SITE_URL}/success.html`,
        failure: `${process.env.SITE_URL}/checkout.html?status=failure`,
        pending: `${process.env.SITE_URL}/checkout.html?status=pending`
      },
      auto_return: 'approved',
      notification_url: `${process.env.SITE_URL}/api/webhook`,
      external_reference: `ANCESTRA-${Date.now()}`,
      statement_descriptor: 'ANCESTRA PARFUM',
      metadata: {
        customer_name: payer.name,
        customer_phone: payer.phone,
        customer_address: payer.address,
        customer_apt: payer.apt || '',
        customer_city: payer.city,
        customer_province: payer.province,
        customer_notes: payer.notes || ''
      }
    };

    const response = await mercadopago.preferences.create(preference);

    res.status(200).json({
      id: response.body.id,
      init_point: response.body.init_point
    });
  } catch (error) {
    console.error('Error creating preference:', error);
    res.status(500).json({ error: 'Error creating payment preference' });
  }
}