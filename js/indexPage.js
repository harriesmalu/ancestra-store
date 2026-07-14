import { loadProducts, formatARS, qs, qsa, setCartBadge, setQueryParam, getQueryParam, isAvailable, stockBadge } from './ui.js';
import { addItem, totals } from './cartBrowser.js';

// ── IDs de los más vendidos ────────────────────────────
const BESTSELLER_IDS = [
  'sauvage-elixir-50',   // Sauvage Elixir Dior — aromático, masc.
  'bleu-chanel-50',      // Bleu Chanel — amaderado, masc.
  'black-opium-50',      // Black Opium — ámbar vainilla, fem.
  'good-girl-50',        // Good Girl — ámbar floral, fem.
  'aventus-50',          // Aventus — chipre frutal, masc.
  'coco-mad-50',         // Coco Mademoiselle — ámbar floral, fem.
];

// ── Colores por familia olfativa ───────────────────────
const FAMILY_COLORS = {
  'Aromática':                     '#5b93d1',
  'Aromática Fougére':             '#4a9bb5',
  'Aromática Acuática':            '#3ca8c8',
  'Amaderada Aromática':           '#a08060',
  'Amaderada Especiada':           '#b87040',
  'Amaderada Acuática':            '#5a9090',
  'Ámbar':                         '#c9a040',
  'Ámbar Floral':                  '#c89050',
  'Ámbar Fougére':                 '#b89050',
  'Ámbar Vainilla':                '#d4a060',
  'Ámbar Especiada':               '#c07840',
  'Ámbar Amaderada':               '#b08050',
  'Floral':                        '#d090a8',
  'Floral Frutal':                 '#d878a0',
  'Floral Acuática':               '#80b8d0',
  'Floral Frutal Gourmand':        '#d070a0',
  'Chipre Frutal':                 '#78a878',
  'Chipre Floral':                 '#90a870',
  'Almizcle Floral Amaderado':     '#b0a0c8',
  'Almizcle Amaderado Floral':     '#b0a0c8',
  'Oriental Floral':               '#d89060',
  'Gourmand':                      '#c08060',
  'Body Splash':                   '#60a8a0',
  'Pack':                          '#c9a96e',
};

function getFamilyColor(family) {
  return FAMILY_COLORS[family] || '#c9a96e';
}

// ── Filtros ────────────────────────────────────────────
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
  // Los productos sin stock siempre al final, manteniendo el orden elegido
  arr.sort((a,b)=>(isAvailable(a)?0:1)-(isAvailable(b)?0:1));
  return arr;
}

// ── Tarjeta del catálogo principal (con color de familia) ──
function productCard(p){
  const isTravel = p.category === 'Travel Size';
  const fc = getFamilyColor(p.family);
  const available = isAvailable(p);
  const buttonText = isTravel ? 'Ver opciones' : 'Agregar al carrito';

  return `
    <article class="card ${available ? '' : 'cardOut'}" data-family="${p.family}" style="--fc:${fc}">
      <a class="cardLink" href="product.html?id=${encodeURIComponent(p.id)}">
        <div class="thumb">
          ${stockBadge(p)}
          <div class="thumbInner">
            <img src="${p.image}" alt="${p.brand} ${p.name}" loading="lazy"/>
          </div>
        </div>
        <div class="cardBody">
          <div class="brand">${p.brand}</div>
          <h3 class="title">${p.name}</h3>
          <div class="sub">${p.subtitle} · ${p.volume_ml} ml</div>
          <div class="metaRow">
            <span class="pill pillFc">${p.family}</span>
            <span class="pill">${p.gender}</span>
            <span class="pill">Intensidad ${p.intensity}/5</span>
          </div>
          <div class="price">${formatARS(p.price_ars)}</div>
        </div>
      </a>
      <div class="cardActions">
        ${!available
          ? `<button class="btn" disabled>Sin stock</button>`
          : isTravel
            ? `<a href="product.html?id=${encodeURIComponent(p.id)}" class="btn btnOutline">${buttonText}</a>`
            : `<button class="btn" data-add="${p.id}">${buttonText}</button>`
        }
      </div>
    </article>
  `;
}

// ── Sección "Más vendidos" ─────────────────────────────
function renderBestsellers(all) {
  const container = qs('#bestsellersGrid');
  if (!container) return;

  // Curados primero (solo con stock); se completa hasta 6 con otros disponibles
  const curated = BESTSELLER_IDS
    .map(id => all.find(p => p.id === id))
    .filter(p => p && isAvailable(p));
  const fillers = all.filter(p =>
    isAvailable(p) && p.category === 'Perfumes' && !curated.includes(p)
  );
  const picks = [...curated, ...fillers].slice(0, 6);

  container.innerHTML = picks.map(p => {
    const fc = getFamilyColor(p.family);
    return `
      <article class="bsCard" data-family="${p.family}" style="--fc:${fc}">
        <a href="product.html?id=${encodeURIComponent(p.id)}" class="bsCardLink">
          <div class="bsThumb">
            ${stockBadge(p)}
            <img src="${p.image}" alt="${p.brand} ${p.name}" loading="lazy"/>
          </div>
          <div class="bsBody">
            <div class="brand">${p.brand}</div>
            <div class="bsTitle">${p.name}</div>
            <div class="sub">${p.subtitle} · ${p.volume_ml}ml</div>
            <div class="bsMeta">
              <span class="pill pillFc">${p.family}</span>
              <span class="pill">${p.gender}</span>
            </div>
            <div class="price">${formatARS(p.price_ars)}</div>
          </div>
        </a>
        <div class="bsActions">
          <button class="btn" data-add="${p.id}">Agregar al carrito</button>
        </div>
      </article>
    `;
  }).join('');

  // Botones "Agregar" en la sección bestsellers
  container.querySelectorAll('[data-add]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id  = btn.getAttribute('data-add');
      const prod = all.find(x => x.id === id);
      if (!prod) return;
      addItem(prod, 1);
      setCartBadge(totals().items_count);
      btn.textContent = 'Agregado ✓';
      btn.classList.add('btnOk');
      setTimeout(() => { btn.textContent = 'Agregar al carrito'; btn.classList.remove('btnOk'); }, 900);
    });
  });
}

// ── Init ───────────────────────────────────────────────
async function init(){
  const all = await loadProducts();
  const searchInput = qs('#searchInput');
  const results     = qs('#results');
  const sortSel     = qs('#sort');

  function getFilters(){
    return {
      category:     qs('#filterCategory').value  || '',
      family:       qs('#filterFamily').value     || '',
      gender:       qs('#filterGender').value     || '',
      minIntensity: Number(qs('#filterIntensity').value || 0) || 0,
      maxPrice:     Number(qs('#filterMaxPrice').value  || 0) || 0,
    };
  }

  function render(){
    const term    = (searchInput.value || '').trim();
    setQueryParam('q', term);

    const filters  = getFilters();
    const filtered = all
      .filter(p => matchesSearch(p, term))
      .filter(p => matchesFilters(p, filters));

    const sorted = sortProducts(filtered, sortSel.value);
    results.innerHTML = sorted.map(productCard).join('') ||
      `<div class="empty">No encontramos resultados. Probá con otra búsqueda.</div>`;

    // Botones "Agregar" del catálogo
    qsa('[data-add]').forEach(btn => {
      if (btn.closest('#bestsellersGrid')) return; // ya wired
      btn.addEventListener('click', () => {
        const id   = btn.getAttribute('data-add');
        const prod = all.find(x => x.id === id);
        addItem(prod, 1);
        const t = totals();
        setCartBadge(t.items_count);
        btn.textContent = 'Agregado ✓';
        btn.classList.add('btnOk');
        setTimeout(() => { btn.textContent = 'Agregar al carrito'; btn.classList.remove('btnOk'); }, 900);
      });
    });

    qs('#countLabel').textContent = `${sorted.length} producto${sorted.length === 1 ? '' : 's'}`;
  }

  // Hidratar búsqueda desde URL
  const q = getQueryParam('q');
  if(q) searchInput.value = q;

  const t = totals();
  setCartBadge(t.items_count);

  // Poblar selects dinámicamente
  const unique = (key) => Array.from(new Set(all.map(p => p[key]))).sort();

  function fillSelect(selId, values){
    const sel = qs(selId);
    const current = sel.value;
    sel.innerHTML = `<option value="">Todos</option>` + values.map(v=>`<option value="${v}">${v}</option>`).join('');
    sel.value = current;
  }

  fillSelect('#filterCategory', unique('category'));
  fillSelect('#filterFamily',   unique('family'));
  fillSelect('#filterGender',   unique('gender'));

  // ── Mobile search toggle ───────────────────────────────
  const searchToggle       = qs('#searchToggle');
  const searchDrawer       = qs('#searchDrawer');
  const searchDrawerClose  = qs('#searchDrawerClose');
  const searchInputMobile  = qs('#searchInputMobile');

  function openSearch() {
    searchDrawer.classList.add('open');
    searchDrawer.setAttribute('aria-hidden', 'false');
    searchToggle.classList.add('active');
    searchToggle.setAttribute('aria-expanded', 'true');
    searchInputMobile.focus();
  }
  function closeSearch() {
    searchDrawer.classList.remove('open');
    searchDrawer.setAttribute('aria-hidden', 'true');
    searchToggle.classList.remove('active');
    searchToggle.setAttribute('aria-expanded', 'false');
    searchInput.value = searchInputMobile.value;
  }

  if (searchToggle)      searchToggle.addEventListener('click', () => searchDrawer.classList.contains('open') ? closeSearch() : openSearch());
  if (searchDrawerClose) searchDrawerClose.addEventListener('click', closeSearch);
  if (searchInputMobile) {
    searchInputMobile.addEventListener('input', () => { searchInput.value = searchInputMobile.value; render(); });
    searchInputMobile.addEventListener('keydown', e => { if (e.key === 'Escape') closeSearch(); });
  }

  // Eventos
  searchInput.addEventListener('input', () => render());
  qsa('select,input[type=range],input[type=number]').forEach(el => el.addEventListener('change', () => render()));
  sortSel.addEventListener('change', () => render());

  // Reset
  qs('#resetFilters').addEventListener('click', () => {
    qs('#filterCategory').value   = '';
    qs('#filterFamily').value     = '';
    qs('#filterGender').value     = '';
    qs('#filterIntensity').value  = 0;
    qs('#filterMaxPrice').value   = 0;
    qs('#maxPriceLabel').textContent = 'Sin tope';
    render();
  });

  // Live label precio
  qs('#filterMaxPrice').addEventListener('input', (e) => {
    const v = Number(e.target.value || 0);
    qs('#maxPriceLabel').textContent = v ? formatARS(v) : 'Sin tope';
  });

  // Renderizar
  render();

  // ── Sección "Más vendidos" ─────────────────────────────
  renderBestsellers(all);
}

init().catch(err => {
  console.error(err);
  const results = document.querySelector('#results');
  if(results) results.innerHTML = `<div class="empty">Error cargando catálogo. Revisá que data/products.json exista.</div>`;
});
