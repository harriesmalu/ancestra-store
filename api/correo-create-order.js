// api/correo-create-order.js
// Crea un envío en MiCorreo después de que el pago fue confirmado
// POST /api/correo-create-order
// Body: { orderId, customer: { name, email, phone, address, city, province, postalCode }, total, deliveryType, agencyCode }

const { getToken, BASE_URL } = require('./correo-auth');

const CUSTOMER_ID = process.env.CORREO_CUSTOMER_ID;

// Mapa de provincias: nombre común → código API
const PROVINCE_MAP = {
  'salta': 'A',
  'buenos aires': 'B',
  'provincia de buenos aires': 'B',
  'ciudad autonoma de buenos aires': 'C',
  'capital federal': 'C',
  'caba': 'C',
  'san luis': 'D',
  'entre rios': 'E',
  'la rioja': 'F',
  'santiago del estero': 'G',
  'chaco': 'H',
  'san juan': 'J',
  'catamarca': 'K',
  'la pampa': 'L',
  'mendoza': 'M',
  'misiones': 'N',
  'formosa': 'P',
  'neuquen': 'Q',
  'rio negro': 'R',
  'santa fe': 'S',
  'tucuman': 'T',
  'chubut': 'U',
  'tierra del fuego': 'V',
  'corrientes': 'W',
  'cordoba': 'X',
  'jujuy': 'Y',
  'santa cruz': 'Z',
};

function getProvinceCode(province) {
  if (!province) return 'C'; // Default CABA
  const key = province.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return PROVINCE_MAP[key] || 'C';
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  if (!CUSTOMER_ID) {
    return res.status(500).json({ error: 'CORREO_CUSTOMER_ID no configurado' });
  }

  const { orderId, customer, total, deliveryType, agencyCode } = req.body;

  if (!orderId || !customer) {
    return res.status(400).json({ error: 'Faltan datos del pedido' });
  }

  try {
    const token = await getToken();

    const isHome = deliveryType !== 'S';
    const provinceCode = getProvinceCode(customer.province);

    const shipmentBody = {
      customerId: CUSTOMER_ID,
      extOrderId: String(orderId),
      orderNumber: String(orderId),
      sender: {
        name: 'ANCESTRA PARFUM',
        phone: null,
        cellPhone: null,
        email: 'ancestraparfum@gmail.com',
        originAddress: {
          streetName: null,
          streetNumber: null,
          floor: null,
          apartment: null,
          city: null,
          provinceCode: null,
          postalCode: null,
        },
      },
      recipient: {
        name: customer.name,
        phone: customer.phone || '',
        cellPhone: customer.phone || '',
        email: customer.email,
      },
      shipping: {
        deliveryType: isHome ? 'D' : 'S',
        agency: isHome ? null : (agencyCode || null),
        address: {
          streetName: customer.streetName || customer.address || '',
          streetNumber: customer.streetNumber || 's/n',
          floor: customer.floor || '',
          apartment: customer.apartment || '',
          city: customer.city || 'Buenos Aires',
          provinceCode: provinceCode,
          postalCode: customer.postalCode || '',
        },
        productType: 'CP',
        weight: 500,
        declaredValue: parseFloat(total) || 0,
        height: 15,
        length: 15,
        width: 15,
      },
    };

    const response = await fetch(`${BASE_URL}/shipping/import`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(shipmentBody),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Correo import error:', data);
      return res.status(502).json({
        error: 'Error al crear el envío en Correo',
        detail: data.message,
      });
    }

    // Éxito - devolver confirmación
    return res.json({
      success: true,
      createdAt: data.createdAt,
      orderId: orderId,
      message: 'Envío creado exitosamente en MiCorreo',
    });

  } catch (error) {
    console.error('correo-create-order error:', error);
    return res.status(500).json({ error: error.message });
  }
}
