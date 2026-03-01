import { qs, setCartBadge } from './ui.js';
import { listItems, totals, clearCart } from './cartBrowser.js';

console.log('✅ checkoutPage.js cargado - Versión N8N + Resend');

// ─── CONFIGURACIÓN ──────────────────────────────────────────────────────────
const WHATSAPP_NUMBER = '5491165678354';
const API_SEND_ORDER  = '/api/send-order';

// ─── HELPERS ────────────────────────────────────────────────────────────────

function showMessage(message, isError = false) {
  const el = document.getElementById('errorMessage');
  if (!el) return;
  el.textContent = message;
  el.style.display = 'block';
  el.style.color = isError ? '#ff4444' : '#c9a96e';
  el.style.background = isError ? '#2a1a1a' : '#1a1500';
  el.style.border = `1px solid ${isError ? '#ff4444' : '#c9a96e'}`;
  el.style.borderRadius = '6px';
  el.style.padding = '12px';
  el.style.marginTop = '12px';
  if (!isError) return; // errores quedan hasta que el usuario actúe
  setTimeout(() => { el.style.display = 'none'; }, 6000);
}

function hideMessage() {
  const el = document.getElementById('errorMessage');
  if (el) el.style.display = 'none';
}

function setLoading(btn, loading) {
  btn.disabled = loading;
  btn.textContent = loading ? 'Enviando pedido...' : 'Enviar pedido';
}

const formatter = new Intl.NumberFormat('es-AR', {
  style: 'currency', currency: 'ARS', maximumFractionDigits: 0
});

function buildWhatsAppURL(formData, cartItems) {
  const message = encodeURIComponent(
    `🛍️ NUEVO PEDIDO ANCESTRA\n\n` +
    `📦 Productos:\n${cartItems.map(i => `  • ${i.qty}x ${i.name} ${i.volume_ml}ml — ${formatter.format(i.price_ars * i.qty)}`).join('\n')}\n\n` +
    `💰 Total: ${formatter.format(totals().subtotal_ars)}\n\n` +
    `👤 ${formData.get('name')}\n` +
    `📧 ${formData.get('email')}\n` +
    `📱 ${formData.get('phone')}\n` +
    `🪪 DNI: ${formData.get('dni')}\n` +
    `🏠 ${formData.get('address')}${formData.get('apt') ? `, ${formData.get('apt')}` : ''}\n` +
    `    ${formData.get('city')}, ${formData.get('province')} (CP ${formData.get('zip')})`
  );
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${message}`;
}

// ─── INIT ────────────────────────────────────────────────────────────────────

function init() {
  setCartBadge(totals().items_count);

  // Carrito vacío
  if (totals().items_count === 0) {
    const root = document.getElementById('checkoutRoot');
    if (root) {
      root.innerHTML = `
        <div class="empty">
          No hay productos en el carrito.
          <div style="margin-top:12px">
            <a class="btn" href="index.html">Volver al catálogo</a>
          </div>
        </div>`;
    }
    const summary = document.getElementById('summaryMini');
    if (summary) summary.innerHTML = '';
    return;
  }

  // Resumen
  const cart = listItems();
  const totalMiniEl = document.getElementById('totalMini');
  if (totalMiniEl) totalMiniEl.textContent = formatter.format(totals().subtotal_ars);

  const summaryContent = document.getElementById('summaryContent');
  if (summaryContent) {
    summaryContent.innerHTML = cart.map(item => `
      <div class="sumLine">
        <span>${item.qty}× ${item.name} ${item.volume_ml}ml</span>
        <span>${formatter.format(item.price_ars * item.qty)}</span>
      </div>`).join('');
  }

  // Submit
  const form = document.getElementById('payForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMessage();

    const submitBtn = document.getElementById('submitBtn');
    setLoading(submitBtn, true);

    const formData = new FormData(form);
    const cartItems = listItems();
    const orderNumber = `ANC-${Date.now()}`;

    // Construir WhatsApp URL ANTES de cualquier await
    // Safari bloquea window.open() si se llama después de async/await
    const whatsappUrl = buildWhatsAppURL(formData, cartItems);

    // Payload para la API
    const orderPayload = {
      orderNumber,
      name:     formData.get('name'),
      email:    formData.get('email'),
      phone:    formData.get('phone'),
      dni:      formData.get('dni'),
      address:  formData.get('address'),
      apt:      formData.get('apt') || '-',
      zip:      formData.get('zip'),
      city:     formData.get('city'),
      province: formData.get('province'),
      notes:    formData.get('notes') || '-',
      items:    cartItems,
      total:    formatter.format(totals().subtotal_ars),
      subtotal_ars: totals().subtotal_ars
    };

    // ── PASO 1: Guardar y limpiar carrito ANTES del async ──
    localStorage.setItem('ancestra_last_order', JSON.stringify({
      ...orderPayload,
      date: new Date().toISOString()
    }));
    clearCart();

    // ── PASO 2: Abrir WhatsApp INMEDIATAMENTE (mismo tick del evento click)
    // Usamos location.href para que Safari no lo bloquee como popup
    // Lo guardamos en una variable de pestaña abierta sincrónicamente
    const waWindow = window.open(whatsappUrl, '_blank');

    // Si Safari bloqueó el popup igual, fallback a location
    if (!waWindow) {
      // Guardar destino y abrir WA en esta misma pestaña temporalmente
      sessionStorage.setItem('ancestra_redirect', 'success.html');
      window.location.href = whatsappUrl;
      return;
    }

    showMessage('✅ ¡Pedido recibido! Redirigiendo...', false);

    // ── PASO 3: Enviar datos a la API en segundo plano (no bloqueante) ──
    fetch(API_SEND_ORDER, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderPayload)
    })
    .then(r => r.ok ? console.log('✅ Emails enviados') : console.warn('⚠️ API respondió', r.status))
    .catch(err => console.error('⚠️ API error (no crítico):', err));

    // ── PASO 4: Redirigir a success.html ──
    setTimeout(() => {
      window.location.href = 'success.html';
    }, 1200);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
