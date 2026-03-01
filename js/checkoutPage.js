import { qs, setCartBadge } from './ui.js';
import { listItems, totals, clearCart } from './cartBrowser.js';

console.log('✅ checkoutPage.js — Versión MP v1');

const WHATSAPP_NUMBER  = '5491165678354';
const API_SEND_ORDER   = '/api/send-order';
const API_CREATE_PREF  = '/api/create-preference';

const formatter = new Intl.NumberFormat('es-AR', {
  style: 'currency', currency: 'ARS', maximumFractionDigits: 0,
});

// ── Shipping ─────────────────────────────────────────
function calcShipping(subtotal) {
  if (subtotal >= 90000) return { label: 'Envío gratis', cost: 0 };
  return { label: 'Envío estándar', cost: 6500 };
}

// ── UI helpers ────────────────────────────────────────
function showMsg(msg, isError = false) {
  const el = qs('#errorMessage');
  if (!el) return;
  el.textContent = msg;
  el.style.display    = 'block';
  el.style.color      = isError ? '#e05252' : '#c9a96e';
  el.style.background = isError ? 'rgba(224,82,82,.08)' : 'rgba(201,169,110,.08)';
  el.style.border     = `1px solid ${isError ? 'rgba(224,82,82,.4)' : 'rgba(201,169,110,.4)'}`;
  el.style.borderRadius = '2px';
  el.style.padding    = '12px 14px';
  el.style.marginTop  = '14px';
  el.style.fontSize   = '13px';
  if (isError) setTimeout(() => { el.style.display = 'none'; }, 6000);
}

function hideMsg() {
  const el = qs('#errorMessage');
  if (el) el.style.display = 'none';
}

function setLoading(btn, loading, text) {
  btn.disabled    = loading;
  btn.textContent = text;
}

// ── Build WhatsApp URL ────────────────────────────────
function buildWhatsAppURL(orderPayload) {
  const { name, email, phone, dni, address, apt, city, province, zip, items, subtotal_ars, shipping_cost } = orderPayload;
  const total = subtotal_ars + shipping_cost;
  const msg = [
    `🛍️ NUEVO PEDIDO ANCESTRA`,
    ``,
    `📦 Productos:`,
    ...items.map(i => `  • ${i.qty}x ${i.name} ${i.volume_ml}ml — ${formatter.format(i.price_ars * i.qty)}`),
    ``,
    `💰 Total: ${formatter.format(total)}`,
    ``,
    `👤 ${name}`,
    `📧 ${email}`,
    `📱 ${phone}`,
    `🪪 DNI: ${dni}`,
    `🏠 ${address}${apt && apt !== '-' ? `, ${apt}` : ''}`,
    `    ${city}, ${province} (CP ${zip})`,
  ].join('\n');
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
}

// ── Collect form data ─────────────────────────────────
function collectOrder(form, paymentMethod) {
  const fd      = new FormData(form);
  const cart    = listItems();
  const t       = totals();
  const ship    = calcShipping(t.subtotal_ars);
  return {
    orderNumber:   `ANC-${Date.now()}`,
    paymentMethod,
    name:          fd.get('name'),
    email:         fd.get('email'),
    phone:         fd.get('phone'),
    dni:           fd.get('dni'),
    address:       fd.get('address'),
    apt:           fd.get('apt') || '-',
    zip:           fd.get('zip'),
    city:          fd.get('city'),
    province:      fd.get('province'),
    notes:         fd.get('notes') || '-',
    items:         cart,
    subtotal_ars:  t.subtotal_ars,
    shipping_cost: ship.cost,
    shipping_label: ship.label,
  };
}

// ── Guardar orden y enviar a N8N (keepalive) ──────────
function saveAndNotify(order) {
  localStorage.setItem('ancestra_last_order', JSON.stringify({
    ...order,
    date: new Date().toISOString(),
  }));
  clearCart();

  // Fire & forget — keepalive sobrevive la navegación
  fetch(API_SEND_ORDER, {
    method:    'POST',
    headers:   { 'Content-Type': 'application/json' },
    body:      JSON.stringify(order),
    keepalive: true,
  }).catch(err => console.error('⚠️ send-order error:', err));
}

// ── Render summary sidebar ────────────────────────────
function renderSummary() {
  const cart  = listItems();
  const t     = totals();
  const ship  = calcShipping(t.subtotal_ars);
  const total = t.subtotal_ars + ship.cost;

  const summaryContent = qs('#summaryContent');
  const totalMiniEl    = qs('#totalMini');

  if (summaryContent) {
    summaryContent.innerHTML = cart.map(item => `
      <div class="sumLine">
        <span>${item.qty}× ${item.name} ${item.volume_ml}ml</span>
        <span>${formatter.format(item.price_ars * item.qty)}</span>
      </div>
    `).join('') + `
      <div class="sumLine">
        <span>${ship.label}</span>
        <span>${ship.cost === 0 ? 'Gratis' : formatter.format(ship.cost)}</span>
      </div>
    `;
  }
  if (totalMiniEl) totalMiniEl.textContent = formatter.format(total);
}

// ── Render payment method selector ───────────────────
function renderPaymentSelector() {
  const container = qs('#paymentSelector');
  if (!container) return;

  container.innerHTML = `
    <div class="formTitle" style="margin-top:20px">Método de pago</div>
    <div class="payMethods">

      <label class="payMethod" data-method="mp">
        <input type="radio" name="paymentMethod" value="mp" checked/>
        <div class="payMethodInner">
          <div class="payMethodIcon">💳</div>
          <div class="payMethodInfo">
            <div class="payMethodTitle">Tarjeta / Débito</div>
            <div class="payMethodSub">Pagá con MercadoPago — todas las tarjetas</div>
          </div>
          <div class="payMethodCheck">✓</div>
        </div>
      </label>

      <label class="payMethod" data-method="transferencia">
        <input type="radio" name="paymentMethod" value="transferencia"/>
        <div class="payMethodInner">
          <div class="payMethodIcon">🏦</div>
          <div class="payMethodInfo">
            <div class="payMethodTitle">Transferencia bancaria</div>
            <div class="payMethodSub">Te enviamos el CBU por WhatsApp</div>
          </div>
          <div class="payMethodCheck">✓</div>
        </div>
      </label>

      <label class="payMethod" data-method="whatsapp">
        <input type="radio" name="paymentMethod" value="whatsapp"/>
        <div class="payMethodInner">
          <div class="payMethodIcon">💬</div>
          <div class="payMethodInfo">
            <div class="payMethodTitle">Coordinar por WhatsApp</div>
            <div class="payMethodSub">Te contactamos para definir el pago</div>
          </div>
          <div class="payMethodCheck">✓</div>
        </div>
      </label>

    </div>
  `;

  // Highlight selected method
  container.querySelectorAll('.payMethod').forEach(label => {
    const radio = label.querySelector('input[type=radio]');
    function update() {
      container.querySelectorAll('.payMethod').forEach(l => l.classList.remove('selected'));
      const checked = container.querySelector('input[type=radio]:checked');
      if (checked) {
        checked.closest('.payMethod').classList.add('selected');
        updateSubmitBtn(checked.value);
      }
    }
    radio.addEventListener('change', update);
    if (radio.checked) label.classList.add('selected');
  });
}

function updateSubmitBtn(method) {
  const btn = qs('#submitBtn');
  if (!btn) return;
  const labels = {
    mp:            'Pagar con MercadoPago',
    transferencia: 'Confirmar pedido',
    whatsapp:      'Confirmar y contactar por WhatsApp',
  };
  btn.textContent = labels[method] || 'Confirmar pedido';
}

// ── CSS for payment methods (injected) ───────────────
function injectPaymentCSS() {
  if (qs('#payMethodCSS')) return;
  const style = document.createElement('style');
  style.id = 'payMethodCSS';
  style.textContent = `
    .payMethods { display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px; }
    .payMethod { cursor: pointer; }
    .payMethod input[type=radio] { display: none; }
    .payMethodInner {
      display: flex; align-items: center; gap: 14px;
      padding: 14px 16px;
      border: 1px solid var(--border);
      background: var(--bg);
      transition: border-color .2s, background .2s;
    }
    .payMethod:hover .payMethodInner { border-color: var(--border2); }
    .payMethod.selected .payMethodInner {
      border-color: var(--gold);
      background: rgba(201,169,110,.04);
    }
    .payMethodIcon { font-size: 20px; flex-shrink: 0; width: 28px; text-align: center; }
    .payMethodInfo { flex: 1; }
    .payMethodTitle { font-size: 14px; font-weight: 400; }
    .payMethodSub { font-size: 12px; color: var(--muted); margin-top: 2px; }
    .payMethodCheck {
      font-size: 13px; color: var(--gold);
      opacity: 0; transition: opacity .2s;
    }
    .payMethod.selected .payMethodCheck { opacity: 1; }
  `;
  document.head.appendChild(style);
}

// ── Main init ─────────────────────────────────────────
function init() {
  setCartBadge(totals().items_count);

  // Empty cart
  if (totals().items_count === 0) {
    const root = qs('#checkoutRoot');
    if (root) {
      root.innerHTML = `
        <div class="empty">
          No hay productos en el carrito.
          <div style="margin-top:12px">
            <a class="btn" href="index.html">Volver al catálogo</a>
          </div>
        </div>`;
    }
    const summary = qs('#summaryMini');
    if (summary) summary.innerHTML = '';
    return;
  }

  injectPaymentCSS();
  renderSummary();
  renderPaymentSelector();

  const form = qs('#payForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMsg();

    const selectedMethod = (form.querySelector('input[name="paymentMethod"]:checked') || {}).value || 'mp';
    const order = collectOrder(form, selectedMethod);
    const submitBtn = qs('#submitBtn');

    // ── MercadoPago ─────────────────────────────────
    if (selectedMethod === 'mp') {
      setLoading(submitBtn, true, 'Procesando...');

      try {
        const prefRes = await fetch(API_CREATE_PREF, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            orderNumber: order.orderNumber,
            items:       order.items,
            shipping:    { label: order.shipping_label, cost: order.shipping_cost },
            totalArs:    order.subtotal_ars + order.shipping_cost,
            buyer: {
              name:    order.name,
              email:   order.email,
              phone:   order.phone,
              address: order.address,
              zip:     order.zip,
            },
          }),
        });

        const prefData = await prefRes.json();

        if (!prefRes.ok || !prefData.initPoint) {
          console.error('MP preference error:', prefData);
          showMsg('Error al conectar con MercadoPago. Intentá de nuevo.', true);
          setLoading(submitBtn, false, 'Pagar con MercadoPago');
          return;
        }

        // Guardar orden antes de redirigir a MP
        saveAndNotify(order);

        // Redirigir a MercadoPago
        window.location.href = prefData.initPoint;

      } catch (err) {
        console.error('MP error:', err);
        showMsg('Error al conectar con MercadoPago. Intentá de nuevo.', true);
        setLoading(submitBtn, false, 'Pagar con MercadoPago');
      }
      return;
    }

    // ── Transferencia ────────────────────────────────
    if (selectedMethod === 'transferencia') {
      setLoading(submitBtn, true, 'Confirmando...');
      saveAndNotify(order);
      showMsg('✅ Pedido recibido. Te enviamos los datos de transferencia por email.', false);
      setTimeout(() => { window.location.href = 'success.html'; }, 2000);
      return;
    }

    // ── WhatsApp ─────────────────────────────────────
    if (selectedMethod === 'whatsapp') {
      setLoading(submitBtn, true, 'Confirmando...');
      const waUrl = buildWhatsAppURL(order);
      saveAndNotify(order);

      const waWindow = window.open(waUrl, '_blank');
      if (!waWindow) setTimeout(() => window.open(waUrl, '_blank'), 100);

      showMsg('✅ Pedido recibido. Redirigiendo a WhatsApp...', false);
      setTimeout(() => { window.location.href = 'success.html'; }, 2000);
      return;
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
