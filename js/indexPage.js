import { loadProducts, formatARS, qs, qsa, setCartBadge, setQueryParam, getQueryParam } from './ui.js';
import { addItem, totals } from './cartBrowser.js';

function matchesSearch(p, term){
  if(!term) return true;
  const t = term.toLowerCase();
  const hay = `${p.brand} ${p.name} ${p.subtitle} ${p.family} ${p.category} ${p.gender}`.toLowerCase();
  return hay.includes(t);
}

function matchesFilters(p, filters){
  if(filters.category && p.category !== filters.category) return false;
  if(filters.family && p.family !== filters.family) return false;
  if(filters.gender && p.gender !== filters.gender) return false;
  if(filters.minIntensity && p.intensity < filters.minIntensity) return false;
  if(filters.maxPrice && p.price_ars > filters.maxPrice) return false;
  return true;
}

function sortProducts(list, sort){
  const arr = [...list];
  if(sort === 'price_asc') arr.sort((a,b)=>a.price_ars-b.price_ars);
  else if(sort === 'price_desc') arr.sort((a,b)=>b.price_ars-a.price_ars);
  else if(sort === 'intensity_desc') arr.sort((a,b)=>b.intensity-a.intensity);
  else arr.sort((a,b)=>a.name.localeCompare(b.name));
  return arr;
}

function productCard(p){
  const isTravel = p.category === 'Travel Size';
  const buttonText = isTravel ? 'Ver opciones' : 'Agregar al carrito';
  const buttonClass = isTravel ? 'btn btnOutline' : 'btn';
  
  return `
    <article class="card">
      <a class="cardLink" href="product.html?id=${encodeURIComponent(p.id)}">
        <div class="thumb">
          <div class="thumbInner">
            <img src="${p.image}" alt="${p.brand} ${p.name}" loading="lazy"/>
          </div>
        </div>
        <div class="cardBody">
          <div class="brand">${p.brand}</div>
          <h3 class="title">${p.name}</h3>
          <div class="sub">${p.subtitle} · ${p.volume_ml} ml</div>
          <div class="metaRow">
            <span class="pill">${p.family}</span>
            <span class="pill">${p.gender}</span>
            <span class="pill">Intensidad ${p.intensity}/5</span>
          </div>
          <div class="price">${formatARS(p.price_ars)}</div>
        </div>
      </a>
      <div class="cardActions">
        ${isTravel 
          ? `<a href="product.html?id=${encodeURIComponent(p.id)}" class="${buttonClass}">${buttonText}</a>`
          : `<button class="btn" data-add="${p.id}">${buttonText}</button>`
        }
      </div>
    </article>
  `;
}

async function init(){
  const all = await loadProducts();
  const searchInput = qs('#searchInput');
  const results = qs('#results');
  const sortSel = qs('#sort');

  function getFilters(){
    return {
      category: qs('#filterCategory').value || '',
      family: qs('#filterFamily').value || '',
      gender: qs('#filterGender').value || '',
      minIntensity: Number(qs('#filterIntensity').value || 0) || 0,
      maxPrice: Number(qs('#filterMaxPrice').value || 0) || 0,
    };
  }

  function render(){
    const term = (searchInput.value || '').trim();
    setQueryParam('q', term);

    const filters = getFilters();
    const filtered = all
      .filter(p => matchesSearch(p, term))
      .filter(p => matchesFilters(p, filters));

    const sorted = sortProducts(filtered, sortSel.value);
    results.innerHTML = sorted.map(productCard).join('') || `<div class="empty">No encontramos resultados. Probá con otra búsqueda.</div>`;

    qsa('[data-add]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-add');
        const p = all.find(x => x.id === id);
        addItem(p, 1);
        const t = totals();
        setCartBadge(t.items_count);
        btn.textContent = 'Agregado ✓';
        btn.classList.add('btnOk');
        setTimeout(() => { btn.textContent = 'Agregar al carrito'; btn.classList.remove('btnOk'); }, 900);
      });
    });

    qs('#countLabel').textContent = `${sorted.length} producto${sorted.length === 1 ? '' : 's'}`;
  }

  // hydrate search from URL
  const q = getQueryParam('q');
  if(q) searchInput.value = q;

  const t = totals();
  setCartBadge(t.items_count);

  // Populate filter selects dynamically
  const unique = (key) => Array.from(new Set(all.map(p=>p[key]))).sort();

  function fillSelect(selId, values){
    const sel = qs(selId);
    const current = sel.value;
    sel.innerHTML = `<option value="">Todos</option>` + values.map(v=>`<option value="${v}">${v}</option>`).join('');
    sel.value = current;
  }

  fillSelect('#filterCategory', unique('category'));
  fillSelect('#filterFamily', unique('family'));
  fillSelect('#filterGender', unique('gender'));

  // Events
  searchInput.addEventListener('input', () => render());
  qsa('select,input[type=range],input[type=number]').forEach(el => {
    el.addEventListener('change', () => render());
  });
  sortSel.addEventListener('change', () => render());

  // Reset
  qs('#resetFilters').addEventListener('click', () => {
    qs('#filterCategory').value = '';
    qs('#filterFamily').value = '';
    qs('#filterGender').value = '';
    qs('#filterIntensity').value = 0;
    qs('#filterMaxPrice').value = 0;
    qs('#maxPriceLabel').textContent = 'Sin tope';
    render();
  });

  // Live labels
  qs('#filterMaxPrice').addEventListener('input', (e)=>{
    const v = Number(e.target.value||0);
    qs('#maxPriceLabel').textContent = v ? formatARS(v) : 'Sin tope';
  });

  render();
}

init().catch(err => {
  console.error(err);
  const results = document.querySelector('#results');
  if(results) results.innerHTML = `<div class="empty">Error cargando catálogo. Revisá que data/products.json exista.</div>`;
});
