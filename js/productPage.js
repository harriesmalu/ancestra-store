import { loadProducts, formatARS, qs, getQueryParam, setCartBadge, isAvailable, stockBadge } from './ui.js';
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

        <div class="travelBuilder">
          <div class="infoTitle">Armá tu pack</div>
          <div class="infoText travelIntro">Elegí exactamente <strong>3 fragancias</strong> de 15 ml cada una.</div>

          <div class="travelSelects">
            ${[1, 2, 3].map(n => `
              <label class="field">
                <span>${n}° fragancia *</span>
                <select id="perfume${n}" class="travelSelect" required>
                  <option value="">Seleccioná una fragancia</option>
                  ${options.map(opt => `<option value="${opt}">${opt}</option>`).join('')}
                </select>
              </label>
            `).join('')}
          </div>

          <div id="travelError" class="travelMsg travelMsgError"></div>
          <div id="travelSuccess" class="travelMsg travelMsgOk"></div>
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
          <div class="travelOptionsGrid">
            ${options.map(opt => `<span class="travelOption">${opt}</span>`).join('')}
          </div>
        </div>

        <div class="shippingBox">
          <div class="infoTitle">Envíos</div>
          <div class="infoText">Envíos a CABA y GBA · 2 a 4 días hábiles vía Enviopack.</div>
        </div>
      </div>
    </div>
  `;
}

// Renderizar producto normal
function renderNormalProduct(p) {
  const available = isAvailable(p);
  return `
    <div class="productLayout">
      <div class="productMedia">
        <div class="productImage">
          ${stockBadge(p)}
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
          ${p.stock === 'ultimos' ? '<span class="pill pillLow">Últimas unidades</span>' : ''}
        </div>
        <div class="price big">${formatARS(p.price_ars)}</div>

        ${available ? `
        <div class="qtyRow">
          <label for="qty">Cantidad</label>
          <input id="qty" type="number" min="1" value="1"/>
        </div>

        <button id="addBtn" class="btn btnWide btn-primary">Agregar al carrito</button>
        ` : `
        <div class="outOfStockBox">
          <div class="outOfStockTitle">Sin stock por el momento</div>
          <div class="infoText">Esta fragancia está temporalmente agotada. Escribinos por WhatsApp y te avisamos cuando vuelva a estar disponible.</div>
          <a class="btn btnWide" href="https://wa.me/5491165678354?text=${encodeURIComponent('Hola! Quiero que me avisen cuando vuelva a haber stock de ' + p.name)}" target="_blank" rel="noopener">Avisame cuando vuelva</a>
        </div>
        `}

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
          <div class="infoText">Envíos a CABA y GBA · 2 a 4 días hábiles vía Enviopack.</div>
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
  document.title = `${p.name} — ANCESTRA PARFUM`;
  qs('#breadcrumbs').innerHTML = `Inicio / ${p.category} / <span>${p.name}</span>`;

  // ── JSON-LD Product Schema (SEO) ─────────────────────
  const schema = {
    '@context': 'https://schema.org/',
    '@type': 'Product',
    'name': `${p.name} — ANCESTRA PARFUM`,
    'description': p.description || `${p.name} — ${p.subtitle}. Fragancia ${p.family}, ${p.gender}. Intensidad ${p.intensity}/5.`,
    'brand': { '@type': 'Brand', 'name': p.brand },
    'category': p.category,
    'image': `https://ancestraparfum.com.ar/${p.image}`,
    'sku': p.id,
    'offers': {
      '@type': 'Offer',
      'priceCurrency': 'ARS',
      'price': p.price_ars,
      'availability': isAvailable(p) ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      'url': `https://ancestraparfum.com.ar/product.html?id=${p.id}`,
      'seller': { '@type': 'Organization', 'name': 'ANCESTRA PARFUM' }
    }
  };
  const schemaEl = document.createElement('script');
  schemaEl.type = 'application/ld+json';
  schemaEl.textContent = JSON.stringify(schema);
  document.head.appendChild(schemaEl);

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

    if (!isAvailable(p)) return; // sin stock: no hay botón de compra

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
