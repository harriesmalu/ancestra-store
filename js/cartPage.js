import { loadProducts, formatARS, qs, qsa, setCartBadge } from './ui.js';
import { listItems, setQty, removeItem, totals, clearCart } from './cartBrowser.js';

function estimateShipping(subtotal){
  // Simple heuristic similar to marketplaces: free shipping over threshold
  const freeThreshold = 90000;
  if(subtotal >= freeThreshold) return { label: 'Envío gratis', cost: 0 };
  // flat rate
  return { label: 'Envío estándar', cost: 6500 };
}

function lineItemRow(item){
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

function checkoutSummary(subtotal){
  const ship = estimateShipping(subtotal);
  const total = subtotal + ship.cost;
  return { ship, total };
}

function renderEmpty(){
  qs('#cartRoot').innerHTML = `
    <div class="empty">
      Tu carrito está vacío.
      <div style="margin-top:12px"><a class="btn" href="index.html">Ver catálogo</a></div>
    </div>
  `;
  qs('#summary').innerHTML = '';
}

async function init(){
  const products = await loadProducts();
  const items = listItems();
  const t = totals();
  setCartBadge(t.items_count);

  if(items.length === 0){
    renderEmpty();
    return;
  }

  // Enrich cart items with latest product data (in case prices/images update)
  const enriched = items.map(it => {
    const p = products.find(x=>x.id===it.id);
    return p ? { ...it, price_ars: p.price_ars, image: p.image, volume_ml: p.volume_ml, brand: p.brand, name: p.name } : it;
  });

  qs('#cartRoot').innerHTML = enriched.map(lineItemRow).join('');

  function rerenderSummary(){
    const tt = totals();
    const { ship, total } = checkoutSummary(tt.subtotal_ars);
    setCartBadge(tt.items_count);

    qs('#summary').innerHTML = `
      <div class="summaryCard">
        <div class="summaryTitle">Resumen</div>
        <div class="sumLine"><span>Subtotal</span><span>${formatARS(tt.subtotal_ars)}</span></div>
        <div class="sumLine"><span>${ship.label}</span><span>${formatARS(ship.cost)}</span></div>
        <div class="sumLine total"><span>Total</span><span>${formatARS(total)}</span></div>

        <div class="couponBox">
          <label for="coupon">Cupón</label>
          <div class="couponRow">
            <input id="coupon" placeholder="ANCESTRA10"/>
            <button id="applyCoupon" class="btn">Aplicar</button>
          </div>
          <div id="couponMsg" class="muted small"></div>
        </div>

        <button id="checkoutBtn" class="btn btnWide">Iniciar compra</button>
        <button id="clearBtn" class="linkBtn">Vaciar carrito</button>

        <div class="small muted" style="margin-top:10px">
          Checkout demo: el pago es simulado. Más adelante se integra Mercado Pago o Stripe.
        </div>
      </div>
    `;

    qs('#applyCoupon').addEventListener('click', () => {
      const code = (qs('#coupon').value || '').trim().toUpperCase();
      const base = totals().subtotal_ars;
      let discount = 0;
      if(code === 'ANCESTRA10') discount = Math.round(base * 0.10);
      if(code === 'ENVIOGRATIS') discount = estimateShipping(base).cost;

      if(discount > 0){
        qs('#couponMsg').textContent = `Cupón aplicado: -${formatARS(discount)}`;
      } else {
        qs('#couponMsg').textContent = `Cupón no válido.`;
      }
    });

    qs('#checkoutBtn').addEventListener('click', () => {
      // Simple checkout flow
      window.location.href = 'checkout.html';
    });

    qs('#clearBtn').addEventListener('click', () => {
      clearCart();
      setCartBadge(0);
      renderEmpty();
    });
  }

  rerenderSummary();

  // Handlers
  qsa('[data-inc]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const id = btn.getAttribute('data-inc');
      const input = qs(`[data-qty="${id}"]`);
      const next = Math.max(1, Number(input.value||1) + 1);
      input.value = String(next);
      setQty(id, next);
      // update row total
      const row = qs(`[data-row="${id}"]`);
      const item = listItems().find(x=>x.id===id);
      row.querySelector('.cartTotal').textContent = formatARS(item.price_ars * item.qty);
      rerenderSummary();
    });
  });

  qsa('[data-dec]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const id = btn.getAttribute('data-dec');
      const input = qs(`[data-qty="${id}"]`);
      const next = Math.max(1, Number(input.value||1) - 1);
      input.value = String(next);
      setQty(id, next);
      const row = qs(`[data-row="${id}"]`);
      const item = listItems().find(x=>x.id===id);
      row.querySelector('.cartTotal').textContent = formatARS(item.price_ars * item.qty);
      rerenderSummary();
    });
  });

  qsa('[data-remove]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const id = btn.getAttribute('data-remove');
      removeItem(id);
      const row = qs(`[data-row="${id}"]`);
      if(row) row.remove();
      const tt = totals();
      if(tt.items_count === 0){
        setCartBadge(0);
        renderEmpty();
        return;
      }
      rerenderSummary();
    });
  });

  qsa('[data-qty]').forEach(input=>{
    input.addEventListener('change', ()=>{
      const id = input.getAttribute('data-qty');
      const next = Math.max(1, Number(input.value||1));
      input.value = String(next);
      setQty(id, next);
      const row = qs(`[data-row="${id}"]`);
      const item = listItems().find(x=>x.id===id);
      row.querySelector('.cartTotal').textContent = formatARS(item.price_ars * item.qty);
      rerenderSummary();
    });
  });
}

init().catch(err=>{
  console.error(err);
  qs('#cartRoot').innerHTML = `<div class="empty">Error cargando el carrito.</div>`;
});
