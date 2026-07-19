// api/submit-review.js
// Recibe una opinión del formulario público y la manda por email (Resend)
// para moderación. Se publica agregándola a data/reviews.json.

const MAX = { name: 60, perfume: 60, location: 60, text: 500 };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { name, perfume, location, stars, text, website } = req.body || {};

  // Honeypot: los bots rellenan el campo oculto "website"
  if (website) return res.status(200).json({ ok: true });

  const starsNum = parseInt(stars, 10);
  if (!name || String(name).trim().length < 3 || String(name).length > MAX.name)
    return res.status(400).json({ error: 'Nombre inválido' });
  if (!perfume || String(perfume).length > MAX.perfume)
    return res.status(400).json({ error: 'Elegí el perfume' });
  if (!location || String(location).trim().length < 2 || String(location).length > MAX.location)
    return res.status(400).json({ error: 'Ubicación inválida' });
  if (!Number.isInteger(starsNum) || starsNum < 1 || starsNum > 5)
    return res.status(400).json({ error: 'Puntuación inválida' });
  if (text && String(text).length > MAX.text)
    return res.status(400).json({ error: 'La opinión es demasiado larga (máx. 500 caracteres)' });

  const esc = s => String(s || '').replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
  const review = {
    name:     esc(String(name).trim()),
    perfume:  esc(String(perfume).trim().toUpperCase()),
    location: esc(String(location).trim()),
    stars:    starsNum,
    text:     esc(String(text || '').trim()),
  };

  console.log('⭐ Nueva opinión:', JSON.stringify(review));

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (RESEND_API_KEY) {
    const starsTxt = '★'.repeat(starsNum) + '☆'.repeat(5 - starsNum);
    const html = `
<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#111;">
  <h2 style="margin:0 0 4px;">⭐ Nueva opinión para revisar</h2>
  <p style="color:#c9a96e;font-size:20px;letter-spacing:3px;margin:0 0 16px;">${starsTxt} (${starsNum}/5)</p>
  <table style="width:100%;font-size:14px;border-collapse:collapse;">
    <tr><td style="padding:6px 0;color:#777;width:110px;">Nombre</td><td><strong>${review.name}</strong></td></tr>
    <tr><td style="padding:6px 0;color:#777;">Perfume</td><td>${review.perfume}</td></tr>
    <tr><td style="padding:6px 0;color:#777;">Ubicación</td><td>${review.location}</td></tr>
    ${review.text ? `<tr><td style="padding:6px 0;color:#777;vertical-align:top;">Opinión</td><td>"${review.text}"</td></tr>` : ''}
  </table>
  <div style="background:#f6f3ec;border:1px solid #e0d5bd;padding:12px 16px;margin-top:18px;font-size:13px;">
    <strong>Para publicarla:</strong> agregá esta entrada a <code>data/reviews.json</code> del repo
    (o pedíselo a Claude) y hacé push. JSON listo para copiar:
    <pre style="background:#fff;border:1px solid #ddd;padding:10px;font-size:12px;overflow:auto;">${esc(JSON.stringify(review, null, 2))}</pre>
  </div>
  <p style="margin:16px 0 0;font-size:12px;color:#999;">Ancestra Parfum · ${new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}</p>
</div>`;

    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from:    'ANCESTRA PARFUM <no-reply@ancestraparfum.com.ar>',
          to:      ['ancestraparfum@gmail.com'],
          subject: `⭐ Opinión ${starsNum}/5 de ${review.name} — ${review.perfume}`,
          html,
        }),
      });
      if (!r.ok) console.warn('Resend review error:', r.status, await r.text());
    } catch (e) {
      console.warn('Resend review error:', e.message);
    }
  } else {
    console.warn('⚠️ RESEND_API_KEY no configurada — la opinión solo quedó en los logs.');
  }

  return res.status(200).json({ ok: true });
}
