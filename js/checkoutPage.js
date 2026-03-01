import { qs, setCartBadge } from './ui.js';
import { listItems, totals, clearCart } from './cartBrowser.js';

console.log('✅ checkoutPage.js cargado - Versión N8N Final');

const WHATSAPP_NUMBER = '5491165678354';
const API_SEND_ORDER  = '/api/send-order';

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
  if (!isError) return;
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

function init() {
  setCartBadge(totals().items_count);

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
    const whatsappUrl = buildWhatsAppURL(formData, cartItems);

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

    // ── PASO 1: Guardar orden y limpiar carrito ──
    localStorage.setItem('ancestra_last_order', JSON.stringify({
      ...orderPayload,
      date: new Date().toISOString()
    }));
    clearCart();

    // ── PASO 2: Enviar a API con keepalive para que sobreviva la navegación ──
    try {
      fetch(API_SEND_ORDER, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload),
        keepalive: true  // sobrevive al redirect/navegación
      }).catch(err => console.error('⚠️ API error:', err));
    } catch(err) {
      console.error('⚠️ Fetch error:', err);
    }

    // ── PASO 3: Abrir WhatsApp ──
    const waWindow = window.open(whatsappUrl, '_blank');
    if (!waWindow) {
      // Popup bloqueado - abrir en misma pestaña después del redirect
      setTimeout(() => { window.open(whatsappUrl, '_blank'); }, 100);
    }

    showMessage('✅ ¡Pedido recibido! Redirigiendo...', false);

    // ── PASO 4: Redirigir a success.html después de 2s para dar tiempo al fetch ──
    setTimeout(() => {
      window.location.href = 'success.html';
    }, 2000);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
