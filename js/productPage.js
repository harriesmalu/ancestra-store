import { loadProducts, formatARS, qs, getQueryParam, setCartBadge } from './ui.js';
import { addItem, totals } from './cartBrowser.js';

function notesList(title, notes){
  return `
    <div class="notesBox">
      <div class="notesTitle">${title}</div>
      <ul class="notesUl">${notes.map(n=>`<li>${n}</li>`).join('')}</ul>
    </div>
  `;
}

async function init(){
  const id = getQueryParam('id');
  if(!id){
    qs('#productRoot').innerHTML = `<div class="empty">Producto no encontrado.</div>`;
    return;
  }
  const products = await loadProducts();
  const p = products.find(x=>x.id === id);
  if(!p){
    qs('#productRoot').innerHTML = `<div class="empty">Producto no encontrado.</div>`;
    return;
  }

  setCartBadge(totals().items_count);

  qs('#breadcrumbs').innerHTML = `Inicio / ${p.category} / <span>${p.name}</span>`;
  qs('#productRoot').innerHTML = `
    <div class="productLayout">
      <div class="productMedia">
        <div class="productImage">
          <img src="${p.image}" alt="${p.brand} ${p.name}"/>
        </div>
      </div>
      <div class="productInfo">
        <div class="brand">${p.brand}</div>
        <h1 class="productTitle">${p.name}</h1>
        <div class="sub">${p.subtitle} · ${p.volume_ml} ml · ${p.gender}</div>
        <div class="metaRow">
          <span class="pill">${p.family}</span>
          <span class="pill">Intensidad ${p.intensity}/5</span>
        </div>
        <div class="price big">${formatARS(p.price_ars)}</div>

        <div class="qtyRow">
          <label for="qty">Cantidad</label>
          <input id="qty" type="number" min="1" value="1"/>
        </div>

        <button id="addBtn" class="btn btnWide">Agregar al carrito</button>

        <div class="infoBox">
          <div class="infoTitle">Descripción</div>
          <div class="infoText">${p.description}</div>
        </div>

        <div class="notesGrid">
          ${notesList('Salida', p.notes_top)}
          ${notesList('Corazón', p.notes_heart)}
          ${notesList('Fondo', p.notes_base)}
        </div>

        <div class="shippingBox">
          <div class="infoTitle">Envíos</div>
          <div class="infoText">CABA y GBA: envío en 24/48 hs. Resto del país: 3–6 días hábiles.</div>
        </div>
      </div>
    </div>
  `;

  qs('#addBtn').addEventListener('click', () => {
    const qty = Math.max(1, Number(qs('#qty').value||1));
    addItem(p, qty);
    const t = totals();
    setCartBadge(t.items_count);
    qs('#addBtn').textContent = 'Agregado ✓';
    qs('#addBtn').classList.add('btnOk');
    setTimeout(() => { qs('#addBtn').textContent = 'Agregar al carrito'; qs('#addBtn').classList.remove('btnOk'); }, 900);
  });
}

init().catch(err=>{
  console.error(err);
  qs('#productRoot').innerHTML = `<div class="empty">Error cargando producto.</div>`;
});
