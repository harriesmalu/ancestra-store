import { loadProducts, formatARS, qs, qsa, setCartBadge } from './ui.js';
import { listItems, setQty, removeItem, totals, clearCart } from './cartBrowser.js';

// Estimación elegida en el widget "Calculá tu envío" (informativa;
// el checkout vuelve a cotizar y es la fuente de verdad).
let shippingEstimate = null;

function calcShipping(subtotal) {
  if (subtotal >= 120000) return { label: 'Envío gratis', cost: 0 };
  if (shippingEstimate) return { label: shippingEstimate.label, cost: shippingEstimate.price || 0 };
  return { label: 'A calcular en el checkout', cost: 0 };
}

function lineItemRow(item) {
  const out = item.stock === 'sin_stock';
  return `
    <div class="cartRow ${out ? 'cartRowOut' : ''}" data-row="${item.id}">
      <div class="cartThumb">
        <img src="${item.image}" alt="${item.brand} ${item.name}"/>
      </div>
      <div class="cartMain">
        <div class="cartTitle">${item.brand} ${item.name} <span class="muted">· ${item.volume_ml} ml</span></div>
        ${out ? '<div class="cartStockWarn">Este producto se quedó sin stock — eliminalo para continuar</div>' : ''}
        <div class="cartPrice">${formatARS(item.price_ars)}</div>
        <div class="cartControls">
          <button class="qtyBtn" data-dec="${item.id}">−</button>
          <input class="qtyInput" data-qty="${item.id}" type="number" min="1" value="${item.qty}"/>
          <button class="qtyBtn" data-inc="${item.id}">+</button>
          <button class="linkBtn danger" data-remove="${item.id}">Eliminar</button>
        </div>
      </div>
      <div class="cartTotal">${formatARS(item.price_ars * item.qty)}</div>
    </div>
  `;
}

function renderEmpty() {
  qs('#cartRoot').innerHTML = `
    <div class="empty">
      Tu carrito está vacío.
      <div style="margin-top:12px"><a class="btn" href="index.html">Ver catálogo</a></div>
    </div>
  `;
  qs('#summary').innerHTML = '';
  const ship = qs('#shipping-container');
  if (ship) ship.innerHTML = '';
}

async function init() {
  const products = await loadProducts();
  const items    = listItems();
  const t        = totals();
  setCartBadge(t.items_count);

  if (items.length === 0) {
    renderEmpty();
    return;
  }

  const enriched = items.map(it => {
    const p = products.find(x => x.id === it.id) ||
              // Packs travel size se guardan con id compuesto: buscar el producto base
              (it.id.startsWith('pack-travel-size') ? products.find(x => x.id === 'pack-travel-size') : null);
    return p ? { ...it, price_ars: p.price_ars, image: p.image, volume_ml: p.volume_ml, brand: p.brand, stock: p.stock } : it;
  });

  qs('#cartRoot').innerHTML = enriched.map(lineItemRow).join('');

  function rerenderSummary() {
    const tt   = totals();
    const ship = calcShipping(tt.subtotal_ars);
    const total = tt.subtotal_ars + ship.cost;
    setCartBadge(tt.items_count);

    const hasOut = enriched.some(it => it.stock === 'sin_stock' && qs(`[data-row="${it.id}"]`));

    qs('#summary').innerHTML = `
      <div class="summaryCard">
        <div class="summaryTitle">Resumen</div>
        <div class="sumLine"><span>Subtotal</span><span>${formatARS(tt.subtotal_ars)}</span></div>
        <div class="sumLine"><span>${ship.label}</span><span>${ship.cost === 0 ? 'Gratis' : formatARS(ship.cost)}</span></div>
        <div class="sumLine total"><span>Total</span><span>${formatARS(total)}</span></div>
        ${hasOut ? '<div class="cartStockWarn" style="margin-top:12px">Hay productos sin stock en tu carrito. Eliminalos para continuar.</div>' : ''}
        <div style="margin-top:16px;display:flex;flex-direction:column;gap:8px">
          ${hasOut
            ? '<button class="btn btnWide" disabled>Iniciar compra</button>'
            : '<a class="btn btn-primary btnWide" href="checkout.html">Iniciar compra</a>'}
          <button id="clearBtn" class="linkBtn" style="text-align:center">Vaciar carrito</button>
        </div>
      </div>
    `;

    qs('#clearBtn').addEventListener('click', () => {
      clearCart();
      setCartBadge(0);
      renderEmpty();
    });
  }

  rerenderSummary();

  // ── Widget "Calculá tu envío" (estimación previa al checkout) ──
  if (window.ShippingCalculator) {
    ShippingCalculator.init(t.subtotal_ars, '#shipping-container');
    document.addEventListener('shippingSelected', (e) => {
      shippingEstimate = e.detail ? { label: e.detail.label, price: e.detail.price } : null;
      rerenderSummary();
    });
  }

  // Qty handlers
  qsa('[data-inc]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id    = btn.getAttribute('data-inc');
      const input = qs(`[data-qty="${id}"]`);
      const next  = Math.max(1, Number(input.value || 1) + 1);
      input.value = String(next);
      setQty(id, next);
      const row  = qs(`[data-row="${id}"]`);
      const item = listItems().find(x => x.id === id);
      row.querySelector('.cartTotal').textContent = formatARS(item.price_ars * item.qty);
      rerenderSummary();
    });
  });

  qsa('[data-dec]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id    = btn.getAttribute('data-dec');
      const input = qs(`[data-qty="${id}"]`);
      const next  = Math.max(1, Number(input.value || 1) - 1);
      input.value = String(next);
      setQty(id, next);
      const row  = qs(`[data-row="${id}"]`);
      const item = listItems().find(x => x.id === id);
      row.querySelector('.cartTotal').textContent = formatARS(item.price_ars * item.qty);
      rerenderSummary();
    });
  });

  qsa('[data-remove]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-remove');
      removeItem(id);
      const row = qs(`[data-row="${id}"]`);
      if (row) row.remove();
      const tt = totals();
      if (tt.items_count === 0) {
        setCartBadge(0);
        renderEmpty();
        return;
      }
      rerenderSummary();
    });
  });

  qsa('[data-qty]').forEach(input => {
    input.addEventListener('change', () => {
      const id   = input.getAttribute('data-qty');
      const next = Math.max(1, Number(input.value || 1));
      input.value = String(next);
      setQty(id, next);
      const row  = qs(`[data-row="${id}"]`);
      const item = listItems().find(x => x.id === id);
      row.querySelector('.cartTotal').textContent = formatARS(item.price_ars * item.qty);
      rerenderSummary();
    });
  });
}

init().catch(err => {
  console.error(err);
  qs('#cartRoot').innerHTML = `<div class="empty">Error cargando el carrito.</div>`;
});
