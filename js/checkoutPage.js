import { qs, setCartBadge } from './ui.js';
import { totals, clearCart } from './cartBrowser.js';

function maskCard(value){
  const v = (value||'').replace(/\D/g,'').slice(0,16);
  return v.replace(/(\d{4})(?=\d)/g,'$1 ');
}

function init(){
  setCartBadge(totals().items_count);
  if(totals().items_count === 0){
    qs('#checkoutRoot').innerHTML = `<div class="empty">No hay productos en el carrito. <div style="margin-top:12px"><a class="btn" href="index.html">Volver al catálogo</a></div></div>`;
    qs('#summaryMini').innerHTML = '';
    return;
  }

  qs('#totalMini').textContent = new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(totals().subtotal_ars);

  const card = qs('#cardNumber');
  card.addEventListener('input', () => { card.value = maskCard(card.value); });

  qs('#payForm').addEventListener('submit', (e) => {
    e.preventDefault();
    // Fake payment success
    clearCart();
    setCartBadge(0);
    window.location.href = 'success.html';
  });
}

init();
