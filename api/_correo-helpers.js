// api/_correo-helpers.js
// Lógica de negocio de Correo Argentino reutilizable entre endpoints.
// Archivos con prefijo _ son ignorados como endpoints por Vercel.

import { getToken, BASE_URL } from './correo-auth.js';

const CUSTOMER_ID = () => process.env.CORREO_CUSTOMER_ID;

// Dimensiones fijas del paquete ANCESTRA PARFUM
const PACKAGE = {
  weight: 500, // gramos
  height: 15,  // cm
  width:  15,
  length: 15,
};

// Mapa de provincias: nombre común → código API de Correo Argentino
const PROVINCE_MAP = {
  'salta':                          'A',
  'buenos aires':                   'B',
  'provincia de buenos aires':      'B',
  'ciudad autonoma de buenos aires':'C',
  'capital federal':                'C',
  'caba':                           'C',
  'san luis':                       'D',
  'entre rios':                     'E',
  'la rioja':                       'F',
  'santiago del estero':            'G',
  'chaco':                          'H',
  'san juan':                       'J',
  'catamarca':                      'K',
  'la pampa':                       'L',
  'mendoza':                        'M',
  'misiones':                       'N',
  'formosa':                        'P',
  'neuquen':                        'Q',
  'rio negro':                      'R',
  'santa fe':                       'S',
  'tucuman':                        'T',
  'chubut':                         'U',
  'tierra del fuego':               'V',
  'corrientes':                     'W',
  'cordoba':                        'X',
  'jujuy':                          'Y',
  'santa cruz':                     'Z',
};

function getProvinceCode(province) {
  if (!province) return 'C';
  const key = province
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return PROVINCE_MAP[key] || 'C';
}

/**
 * Obtiene cotización de envío para un CP dado.
 * @param {string} cp - Código postal destino
 * @param {string} cpOrigen - Código postal origen (default: env CORREO_CP_ORIGEN)
 * @returns {Promise<{ rates: Array, validTo: string }>}
 */
export async function quoteShipping(cp, cpOrigen) {
  const customerId = CUSTOMER_ID();
  if (!customerId) throw new Error('CORREO_CUSTOMER_ID no configurado');

  const origin = cpOrigen || process.env.CORREO_CP_ORIGEN || '1428';
  const token  = await getToken();

  const res = await fetch(`${BASE_URL}/rates`, {
    method:  'POST',
    headers: {
      'Authorization':  `Bearer ${token}`,
      'Content-Type':   'application/json',
    },
    body: JSON.stringify({
      customerId,
      postalCodeOrigin:      origin,
      postalCodeDestination: cp.trim(),
      dimensions:            PACKAGE,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    const err = new Error(data.message || 'Error cotizando envío en Correo');
    err.status = res.status;
    throw err;
  }

  return { rates: data.rates || [], validTo: data.validTo };
}

/**
 * Crea un envío en MiCorreo.
 * @param {object} params
 * @param {string}  params.orderId        - Número/ID de orden
 * @param {object}  params.customer       - Datos del destinatario
 * @param {string}  params.customer.name
 * @param {string}  params.customer.email
 * @param {string}  params.customer.phone
 * @param {string}  params.customer.streetName
 * @param {string}  params.customer.streetNumber
 * @param {string}  params.customer.floor
 * @param {string}  params.customer.apartment
 * @param {string}  params.customer.city
 * @param {string}  params.customer.province
 * @param {string}  params.customer.postalCode
 * @param {number}  params.total          - Valor declarado (ARS)
 * @param {string}  params.deliveryType   - 'D' domicilio | 'S' sucursal
 * @param {string}  [params.agencyCode]   - Código de sucursal si deliveryType='S'
 * @returns {Promise<{ success: boolean, createdAt: string, orderId: string }>}
 */
export async function createShipment({ orderId, customer, total, deliveryType = 'D', agencyCode }) {
  const customerId = CUSTOMER_ID();
  if (!customerId) throw new Error('CORREO_CUSTOMER_ID no configurado');

  const token        = await getToken();
  const isHome       = deliveryType !== 'S';
  const provinceCode = getProvinceCode(customer.province);

  const body = {
    customerId,
    extOrderId:   String(orderId),
    orderNumber:  String(orderId),
    sender: {
      name:  'ANCESTRA PARFUM',
      phone: null, cellPhone: null,
      email: 'ancestraparfum@gmail.com',
      originAddress: {
        streetName: null, streetNumber: null, floor: null,
        apartment: null, city: null, provinceCode: null, postalCode: null,
      },
    },
    recipient: {
      name:      customer.name,
      phone:     customer.phone || '',
      cellPhone: customer.phone || '',
      email:     customer.email,
    },
    shipping: {
      deliveryType: isHome ? 'D' : 'S',
      agency:       isHome ? null : (agencyCode || null),
      address: {
        streetName:   customer.streetName   || customer.address || '',
        streetNumber: customer.streetNumber || 's/n',
        floor:        customer.floor        || '',
        apartment:    customer.apartment    || '',
        city:         customer.city         || 'Buenos Aires',
        provinceCode,
        postalCode:   customer.postalCode   || '',
      },
      productType:    'CP',
      weight:         PACKAGE.weight,
      declaredValue:  parseFloat(total) || 0,
      height:         PACKAGE.height,
      length:         PACKAGE.length,
      width:          PACKAGE.width,
    },
  };

  const res  = await fetch(`${BASE_URL}/shipping/import`, {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok) {
    const err = new Error(data.message || 'Error creando envío en Correo');
    err.status = res.status;
    err.detail = data;
    throw err;
  }

  return {
    success:   true,
    createdAt: data.createdAt,
    orderId,
  };
}
