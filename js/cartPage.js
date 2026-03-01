import { loadProducts, formatARS, qs, qsa, setCartBadge } from './ui.js';
import { listItems, setQty, removeItem, totals, clearCart } from './cartBrowser.js';

function calcShipping(subtotal) {
  if (subtotal >= 90000) return { label: 'Envío gratis', cost: 0 };
  return { label: 'Envío estándar', cost: 6500 };
}

function lineItemRow(item) {
  return `
    <div class="cartRow" data-row="${item.id}">
      <div class="cartThumb">
        <img src="${item.image}" alt="${item.brand} ${item.name}"/>
      </div>
      <div class="cartMain">
        <div class="cartTitle">${item.brand} ${item.name} <span class="muted">· ${item.volume_ml} ml</span></div>
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
    const p = products.find(x => x.id === it.id);
    return p ? { ...it, price_ars: p.price_ars, image: p.image, volume_ml: p.volume_ml, brand: p.brand, name: p.name } : it;
  });

  qs('#cartRoot').innerHTML = enriched.map(lineItemRow).join('');

  function rerenderSummary() {
    const tt   = totals();
    const ship = calcShipping(tt.subtotal_ars);
    const total = tt.subtotal_ars + ship.cost;
    setCartBadge(tt.items_count);

    qs('#summary').innerHTML = `
      <div class="summaryCard">
        <div class="summaryTitle">Resumen</div>
        <div class="sumLine"><span>Subtotal</span><span>${formatARS(tt.subtotal_ars)}</span></div>
        <div class="sumLine"><span>${ship.label}</span><span>${ship.cost === 0 ? 'Gratis' : formatARS(ship.cost)}</span></div>
        <div class="sumLine total"><span>Total</span><span>${formatARS(total)}</span></div>
        <div style="margin-top:16px;display:flex;flex-direction:column;gap:8px">
          <a class="btn btn-primary btnWide" href="checkout.html">Iniciar compra</a>
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
