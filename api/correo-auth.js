// api/correo-auth.js
// Helper para autenticación con Correo Argentino MiCorreo API
// Cachea el token JWT para no pedir uno nuevo en cada request

const BASE_URL = process.env.CORREO_ENV === 'prod'
  ? 'https://api.correoargentino.com.ar/micorreo/v1'
  : 'https://apitest.correoargentino.com.ar/micorreo/v1';

let cachedToken = null;
let tokenExpiry = null;

async function getToken() {
  // Si el token sigue vigente (con 5 min de margen), reutilizarlo
  if (cachedToken && tokenExpiry && new Date() < new Date(tokenExpiry.getTime() - 5 * 60 * 1000)) {
    return cachedToken;
  }

  const user = process.env.CORREO_API_USER;
  const pass = process.env.CORREO_API_PASS;

  if (!user || !pass) {
    throw new Error('Faltan credenciales de Correo Argentino (CORREO_API_USER / CORREO_API_PASS)');
  }

  const credentials = Buffer.from(`${user}:${pass}`).toString('base64');

  const res = await fetch(`${BASE_URL}/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
    },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Error auth Correo: ${res.status} - ${err}`);
  }

  const data = await res.json();
  cachedToken = data.token;
  // "expires": "2022-04-26 21:16:20" → convertir a Date
  tokenExpiry = new Date(data.expires.replace(' ', 'T') + '-03:00');

  return cachedToken;
}

module.exports = { getToken, BASE_URL };
