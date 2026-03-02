// js/shippingCalculator.js
// Cotizador de envío en tiempo real para ANCESTRA PARFUM
// Integra con /api/correo-quote
// Usar: initShippingCalculator(cartTotal) en checkoutPage.js

const ShippingCalculator = (() => {

  const FREE_THRESHOLD = 90000;
  let selectedShipping = null;
  let debounceTimer = null;

  // ─────────────────────────────────────────────
  // HTML que se inyecta en el checkout
  // ─────────────────────────────────────────────
  function buildHTML() {
    return `
      <div id="shipping-section" class="shipping-section">
        <h3 class="shipping-title">Envío</h3>

        <div class="shipping-cp-row">
          <input
            type="text"
            id="shipping-cp"
            class="shipping-cp-input"
            placeholder="Código Postal de destino"
            maxlength="8"
            inputmode="numeric"
          />
          <button id="shipping-calc-btn" class="shipping-calc-btn" type="button">
            Calcular
          </button>
        </div>

        <div id="shipping-message" class="shipping-message" style="display:none"></div>

        <div id="shipping-options" class="shipping-options" style="display:none"></div>
      </div>
    `;
  }

  // ─────────────────────────────────────────────
  // CSS inyectado dinámicamente
  // ─────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('shipping-calc-styles')) return;
    const style = document.createElement('style');
    style.id = 'shipping-calc-styles';
    style.textContent = `
      .shipping-section {
        margin: 24px 0;
        padding: 20px;
        border: 1px solid #2a2a2a;
        border-radius: 8px;
        background: #111;
      }
      .shipping-title {
        font-family: 'Cormorant Garamond', serif;
        font-size: 1.1rem;
        letter-spacing: 0.08em;
        color: #e8d5b7;
        margin: 0 0 14px;
        text-transform: uppercase;
      }
      .shipping-cp-row {
        display: flex;
        gap: 8px;
      }
      .shipping-cp-input {
        flex: 1;
        background: #1a1a1a;
        border: 1px solid #333;
        border-radius: 6px;
        color: #fff;
        padding: 10px 14px;
        font-size: 0.95rem;
        font-family: 'Jost', sans-serif;
        outline: none;
        transition: border-color 0.2s;
      }
      .shipping-cp-input:focus {
        border-color: #c9a96e;
      }
      .shipping-calc-btn {
        background: transparent;
        border: 1px solid #c9a96e;
        color: #c9a96e;
        padding: 10px 18px;
        border-radius: 6px;
        cursor: pointer;
        font-family: 'Jost', sans-serif;
        font-size: 0.85rem;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        transition: all 0.2s;
        white-space: nowrap;
      }
      .shipping-calc-btn:hover {
        background: #c9a96e;
        color: #080808;
      }
      .shipping-calc-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .shipping-message {
        margin-top: 12px;
        padding: 10px 14px;
        border-radius: 6px;
        font-size: 0.9rem;
        font-family: 'Jost', sans-serif;
      }
      .shipping-message.success {
        background: #0a1f0a;
        border: 1px solid #2d5a2d;
        color: #6bc96b;
      }
      .shipping-message.error {
        background: #1f0a0a;
        border: 1px solid #5a2d2d;
        color: #c96b6b;
      }
      .shipping-message.info {
        background: #0a0f1f;
        border: 1px solid #2d3a5a;
        color: #8ab4c9;
      }
      .shipping-options {
        margin-top: 14px;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .shipping-option {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 14px;
        background: #1a1a1a;
        border: 1px solid #333;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s;
      }
      .shipping-option:hover {
        border-color: #c9a96e;
      }
      .shipping-option.selected {
        border-color: #c9a96e;
        background: #1f1a12;
      }
      .shipping-option input[type="radio"] {
        accent-color: #c9a96e;
        width: 16px;
        height: 16px;
        flex-shrink: 0;
      }
      .shipping-option-info {
        flex: 1;
      }
      .shipping-option-label {
        font-family: 'Jost', sans-serif;
        font-size: 0.9rem;
        color: #fff;
        font-weight: 500;
      }
      .shipping-option-delivery {
        font-size: 0.78rem;
        color: #888;
        margin-top: 2px;
        font-family: 'Jost', sans-serif;
      }
      .shipping-option-price {
        font-family: 'Cormorant Garamond', serif;
        font-size: 1.1rem;
        color: #c9a96e;
        font-weight: 600;
      }
      .shipping-free-badge {
        display: inline-block;
        background: #0a1f0a;
        border: 1px solid #2d5a2d;
        color: #6bc96b;
        font-size: 0.75rem;
        padding: 2px 8px;
        border-radius: 4px;
        font-family: 'Jost', sans-serif;
        letter-spacing: 0.05em;
        text-transform: uppercase;
      }
    `;
    document.head.appendChild(style);
  }

  // ─────────────────────────────────────────────
  // Cotizar
  // ─────────────────────────────────────────────
  async function quote(cp, cartTotal) {
    const btn = document.getElementById('shipping-calc-btn');
    const msgEl = document.getElementById('shipping-message');
    const optionsEl = document.getElementById('shipping-options');

    btn.disabled = true;
    btn.textContent = '...';
    showMessage('Cotizando envío...', 'info');
    optionsEl.style.display = 'none';
    optionsEl.innerHTML = '';
    selectedShipping = null;
    dispatchChange(null);

    try {
      const url = `/api/correo-quote?cp=${encodeURIComponent(cp)}&total=${cartTotal}`;
      const res = await fetch(url);
      const data = await res.json();

      if (!res.ok) {
        showMessage(`No pudimos calcular el envío para el CP ${cp}. Verificá que sea correcto.`, 'error');
        return;
      }

      if (data.free) {
        showMessage('🎉 ¡Envío gratis! Tu pedido supera el mínimo para envío sin costo.', 'success');
        selectedShipping = { type: 'free', price: 0, label: 'Envío gratis' };
        dispatchChange(selectedShipping);
        return;
      }

      if (!data.options || data.options.length === 0) {
        showMessage('No hay opciones de envío disponibles para ese CP.', 'error');
        return;
      }

      hideMessage();
      renderOptions(data.options, cartTotal);
      optionsEl.style.display = 'flex';

    } catch (err) {
      console.error('Shipping quote error:', err);
      showMessage('Error de conexión al cotizar. Intenta de nuevo.', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Calcular';
    }
  }

  function renderOptions(options, cartTotal) {
    const optionsEl = document.getElementById('shipping-options');
    optionsEl.innerHTML = '';

    options.forEach((opt, idx) => {
      const div = document.createElement('div');
      div.className = 'shipping-option';
      div.dataset.type = opt.type;
      div.dataset.price = opt.price;

      div.innerHTML = `
        <input type="radio" name="shipping-choice" id="shipping-${idx}" value="${opt.type}" />
        <div class="shipping-option-info">
          <div class="shipping-option-label">${opt.label}</div>
          ${opt.deliveryLabel ? `<div class="shipping-option-delivery">${opt.deliveryLabel}</div>` : ''}
        </div>
        <div class="shipping-option-price">${opt.priceFormatted}</div>
      `;

      div.addEventListener('click', () => {
        document.querySelectorAll('.shipping-option').forEach(el => el.classList.remove('selected'));
        div.classList.add('selected');
        div.querySelector('input[type="radio"]').checked = true;
        selectedShipping = opt;
        dispatchChange(opt);
      });

      optionsEl.appendChild(div);
    });

    // Auto-seleccionar la más barata
    const cheapest = optionsEl.querySelector('.shipping-option');
    if (cheapest) cheapest.click();
  }

  // ─────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────
  function showMessage(text, type) {
    const el = document.getElementById('shipping-message');
    el.textContent = text;
    el.className = `shipping-message ${type}`;
    el.style.display = 'block';
  }

  function hideMessage() {
    const el = document.getElementById('shipping-message');
    if (el) el.style.display = 'none';
  }

  function dispatchChange(shipping) {
    document.dispatchEvent(new CustomEvent('shippingSelected', { detail: shipping }));
  }

  // ─────────────────────────────────────────────
  // Init
  // ─────────────────────────────────────────────
  function init(cartTotal, containerSelector) {
    injectStyles();

    const container = document.querySelector(containerSelector || '#shipping-container');
    if (!container) {
      console.warn('ShippingCalculator: no se encontró el contenedor');
      return;
    }

    container.innerHTML = buildHTML();

    const cpInput = document.getElementById('shipping-cp');
    const btn = document.getElementById('shipping-calc-btn');

    btn.addEventListener('click', () => {
      const cp = cpInput.value.trim();
      if (cp.length >= 4) {
        quote(cp, cartTotal);
      } else {
        showMessage('Ingresá un CP válido (mínimo 4 dígitos)', 'error');
      }
    });

    cpInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') btn.click();
    });

    // Auto-cotizar si el total ya supera el umbral
    if (cartTotal >= FREE_THRESHOLD) {
      showMessage('🎉 ¡Tu pedido tiene envío gratis!', 'success');
      document.getElementById('shipping-message').style.display = 'block';
      selectedShipping = { type: 'free', price: 0, label: 'Envío gratis' };
      dispatchChange(selectedShipping);
    }
  }

  function getSelected() {
    return selectedShipping;
  }

  return { init, getSelected };
})();

window.ShippingCalculator = ShippingCalculator;
