import { loadProducts, formatARS, qs, getQueryParam, setCartBadge } from './ui.js';
import { addItem, totals } from './cartBrowser.js';

function notesList(title, notes){
  if (!notes || notes.length === 0) return '';
  return `
    <div class="notesBox">
      <div class="notesTitle">${title}</div>
      <ul class="notesUl">${notes.map(n=>`<li>${n}</li>`).join('')}</ul>
    </div>
  `;
}

// Renderizar selector de Travel Size
function renderTravelSizeSelector(product) {
  const options = product.travel_options || [];
  
  return `
    <div class="productLayout">
      <div class="productMedia">
        <div class="productImage">
          <img src="${product.image}" alt="${product.brand} ${product.name}"/>
        </div>
      </div>
      <div class="productInfo">
        <div class="brand">${product.brand}</div>
        <h1 class="productTitle">${product.name}</h1>
        <div class="sub">${product.subtitle} · ${product.gender}</div>
        <div class="price big">${formatARS(product.price_ars)}</div>

        <div class="infoBox" style="background: #2a1a1a; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
          <div class="infoTitle">📦 Armá tu pack</div>
          <div class="infoText" style="margin-bottom: 16px;">Elegí exactamente <strong>3 fragancias</strong> de 15ml cada una</div>
          
          <div style="display: flex; flex-direction: column; gap: 12px;">
            <div>
              <label for="perfume1" style="display: block; margin-bottom: 4px; font-size: 14px;">1° Perfume *</label>
              <select id="perfume1" class="travelSelect" required style="width: 100%; padding: 10px; background: #1a1a1a; color: #fff; border: 1px solid #3a3a3a; border-radius: 4px; font-size: 14px;">
                <option value="">Seleccioná una fragancia</option>
                ${options.map(opt => `<option value="${opt}">${opt}</option>`).join('')}
              </select>
            </div>

            <div>
              <label for="perfume2" style="display: block; margin-bottom: 4px; font-size: 14px;">2° Perfume *</label>
              <select id="perfume2" class="travelSelect" required style="width: 100%; padding: 10px; background: #1a1a1a; color: #fff; border: 1px solid #3a3a3a; border-radius: 4px; font-size: 14px;">
                <option value="">Seleccioná una fragancia</option>
                ${options.map(opt => `<option value="${opt}">${opt}</option>`).join('')}
              </select>
            </div>

            <div>
              <label for="perfume3" style="display: block; margin-bottom: 4px; font-size: 14px;">3° Perfume *</label>
              <select id="perfume3" class="travelSelect" required style="width: 100%; padding: 10px; background: #1a1a1a; color: #fff; border: 1px solid #3a3a3a; border-radius: 4px; font-size: 14px;">
                <option value="">Seleccioná una fragancia</option>
                ${options.map(opt => `<option value="${opt}">${opt}</option>`).join('')}
              </select>
            </div>
          </div>

          <div id="travelError" style="display: none; color: #ff4444; margin-top: 12px; font-size: 14px; padding: 8px; background: rgba(255,68,68,0.1); border-radius: 4px;"></div>
          <div id="travelSuccess" style="display: none; color: #44ff44; margin-top: 12px; font-size: 14px; padding: 8px; background: rgba(68,255,68,0.1); border-radius: 4px;"></div>
        </div>

        <div class="qtyRow">
          <label for="qty">Cantidad de packs</label>
          <input id="qty" type="number" min="1" value="1"/>
        </div>

        <button id="addBtn" class="btn btnWide">Agregar al carrito</button>

        <div class="infoBox">
          <div class="infoTitle">Descripción</div>
          <div class="infoText">Pack de 3 perfumes de 15ml formato travel size. Ideal para probar fragancias, llevar en la cartera o viajar. Cada pack incluye 3 frascos rollón de 15ml de las fragancias que elijas.</div>
        </div>

        <div class="infoBox">
          <div class="infoTitle">Fragancias disponibles (${options.length})</div>
          <div class="infoText" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 8px; margin-top: 8px;">
            ${options.map(opt => `<span style="padding: 6px 12px; background: #2a2a2a; border-radius: 4px; font-size: 13px;">• ${opt}</span>`).join('')}
          </div>
        </div>

        <div class="shippingBox">
          <div class="infoTitle">Envíos</div>
          <div class="infoText">CABA y GBA: envío en 24/48 hs. Resto del país: 3–6 días hábiles.</div>
        </div>
      </div>
    </div>
  `;
}

// Renderizar producto normal
function renderNormalProduct(p) {
  return `
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

  // Detectar si es Travel Size
  const isTravelSize = p.category === 'Travel Size' && p.travel_options && p.travel_options.length > 0;

  if (isTravelSize) {
    // Renderizar versión Travel Size con selector
    qs('#productRoot').innerHTML = renderTravelSizeSelector(p);

    // Agregar evento al botón
    qs('#addBtn').addEventListener('click', () => {
      const perfume1 = qs('#perfume1').value;
      const perfume2 = qs('#perfume2').value;
      const perfume3 = qs('#perfume3').value;
      const errorDiv = qs('#travelError');
      const successDiv = qs('#travelSuccess');

      // Limpiar mensajes
      errorDiv.style.display = 'none';
      successDiv.style.display = 'none';

      // Validar que se hayan seleccionado 3 perfumes
      if (!perfume1 || !perfume2 || !perfume3) {
        errorDiv.textContent = '❌ Debés elegir exactamente 3 fragancias';
        errorDiv.style.display = 'block';
        return;
      }

      // Validar que no se repitan
      const selections = [perfume1, perfume2, perfume3];
      const unique = new Set(selections);
      if (unique.size !== 3) {
        errorDiv.textContent = '❌ No podés repetir fragancias. Elegí 3 diferentes.';
        errorDiv.style.display = 'block';
        return;
      }

      // Crear producto personalizado
      const customProduct = {
        ...p,
        name: `${p.name} (${perfume1}, ${perfume2}, ${perfume3})`,
        description: `Pack Travel Size: ${perfume1} + ${perfume2} + ${perfume3}`,
        travel_selection: selections
      };

      const qty = Math.max(1, Number(qs('#qty').value||1));
      addItem(customProduct, qty);
      const t = totals();
      setCartBadge(t.items_count);

      // Mostrar éxito
      successDiv.textContent = `✅ ${qty} pack${qty > 1 ? 's' : ''} agregado${qty > 1 ? 's' : ''} al carrito`;
      successDiv.style.display = 'block';

      qs('#addBtn').textContent = 'Agregado ✓';
      qs('#addBtn').classList.add('btnOk');
      
      setTimeout(() => { 
        qs('#addBtn').textContent = 'Agregar al carrito'; 
        qs('#addBtn').classList.remove('btnOk');
        successDiv.style.display = 'none';
      }, 2000);
    });

  } else {
    // Renderizar producto normal
    qs('#productRoot').innerHTML = renderNormalProduct(p);

    qs('#addBtn').addEventListener('click', () => {
      const qty = Math.max(1, Number(qs('#qty').value||1));
      addItem(p, qty);
      const t = totals();
      setCartBadge(t.items_count);
      qs('#addBtn').textContent = 'Agregado ✓';
      qs('#addBtn').classList.add('btnOk');
      setTimeout(() => { 
        qs('#addBtn').textContent = 'Agregar al carrito'; 
        qs('#addBtn').classList.remove('btnOk'); 
      }, 900);
    });
  }
}

init().catch(err=>{
  console.error(err);
  qs('#productRoot').innerHTML = `<div class="empty">Error cargando producto.</div>`;
});
