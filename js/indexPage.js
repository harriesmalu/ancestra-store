import { loadProducts, formatARS, qs, qsa, setCartBadge, setQueryParam, getQueryParam, isAvailable, stockBadge, groupInfo } from './ui.js';
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
// Búsqueda tolerante: sin acentos, por palabras sueltas, y admite
// 1 letra de diferencia por palabra (ej: "millón" encuentra MILLION).
const normText = s => (s || '').toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '');

function within1Edit(a, b){
  if (a === b) return true;
  const la = a.length, lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < la && j < lb) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (la > lb) i++;            // borrado
    else if (lb > la) j++;       // inserción
    else { i++; j++; }           // sustitución
  }
  return edits + (la - i) + (lb - j) <= 1;
}

function matchesSearch(p, term){
  if(!term) return true;
  const hay = normText(`${p.brand} ${p.name} ${p.subtitle} ${p.family} ${p.category} ${p.gender}`);
  const hayWords = hay.split(/\s+/);
  const tokens = normText(term).split(/\s+/).filter(Boolean);
  return tokens.every(t =>
    hay.includes(t) ||
    (t.length >= 4 && hayWords.some(w => within1Edit(t, w)))
  );
}

function matchesFilters(entry, filters){
  const p = entry.p;
  if(filters.category && p.category !== filters.category) return false;
  if(filters.family && p.family !== filters.family) return false;
  if(filters.gender && p.gender !== filters.gender) return false;
  if(filters.minIntensity && p.intensity < filters.minIntensity) return false;
  if(filters.maxPrice && entry.g.minPrice > filters.maxPrice) return false;
  return true;
}

function sortEntries(list, sort){
  const arr = [...list];
  if(sort === 'price_asc') arr.sort((a,b)=>a.g.minPrice-b.g.minPrice);
  else if(sort === 'price_desc') arr.sort((a,b)=>b.g.minPrice-a.g.minPrice);
  else if(sort === 'intensity_desc') arr.sort((a,b)=>b.p.intensity-a.p.intensity);
  else arr.sort((a,b)=>a.p.name.localeCompare(b.p.name));
  // Los grupos sin stock siempre al final, manteniendo el orden elegido
  arr.sort((a,b)=>(a.g.stock!=='sin_stock'?0:1)-(b.g.stock!=='sin_stock'?0:1));
  return arr;
}

// ── Tarjeta del catálogo principal (con color de familia) ──
function productCard(entry){
  const { p, g } = entry;
  const isTravel = p.category === 'Travel Size';
  const fc = getFamilyColor(p.family);
  const available = g.stock !== 'sin_stock';
  // Badge a nivel grupo
  const badge = g.stock === 'sin_stock' ? '<span class="stockBadge stockOut">Sin stock</span>'
              : g.stock === 'ultimos'   ? '<span class="stockBadge stockLow">Últimas unidades</span>'
              : '';
  // Botón: agrega el tamaño default (este producto) si está disponible;
  // si solo quedan otros tamaños, lleva a la ficha a elegir.
  const action = !available
    ? `<button class="btn" disabled>Sin stock</button>`
    : (isTravel || !isAvailable(p))
      ? `<a href="product.html?id=${encodeURIComponent(p.id)}" class="btn btnOutline">Ver opciones</a>`
      : `<button class="btn" data-add="${p.id}">Agregar al carrito</button>`;

  return `
    <article class="card ${available ? '' : 'cardOut'}" data-family="${p.family}" style="--fc:${fc}">
      <a class="cardLink" href="product.html?id=${encodeURIComponent(p.id)}">
        <div class="thumb">
          ${badge}
          <div class="thumbInner">
            <img src="${p.image}" alt="${p.brand} ${p.name}" loading="lazy"/>
          </div>
        </div>
        <div class="cardBody">
          <div class="brand">${p.brand}</div>
          <h3 class="title">${p.name}</h3>
          <div class="sub">${p.subtitle} · ${g.multi ? g.sizesLabel : p.volume_ml + ' ml'}</div>
          <div class="metaRow">
            <span class="pill pillFc">${p.family}</span>
            <span class="pill">${p.gender}</span>
            <span class="pill">Intensidad ${p.intensity}/5</span>
          </div>
          <div class="price">${g.multi ? `<span class="priceFrom">Desde</span> ${formatARS(g.minPrice)}` : formatARS(p.price_ars)}</div>
        </div>
      </a>
      <div class="cardActions">${action}</div>
    </article>
  `;
}

// ── Sección "Más vendidos" ─────────────────────────────
function renderBestsellers(all) {
  const container = qs('#bestsellersGrid');
  if (!container) return;

  // Curados primero (grupos con stock); se completa hasta 6 con otros disponibles
  const entryOf = p => ({ p, g: groupInfo(p, all) });
  const curated = BESTSELLER_IDS
    .map(id => all.find(p => p.id === id))
    .filter(Boolean)
    .map(entryOf)
    .filter(e => e.g.stock !== 'sin_stock');
  const curatedIds = new Set(curated.map(e => e.p.id));
  const fillers = all
    .filter(p => p.category === 'Perfumes' && (!p.variant_group || p.volume_ml === 50) && !curatedIds.has(p.id))
    .map(entryOf)
    .filter(e => e.g.stock !== 'sin_stock');
  const picks = [...curated, ...fillers].slice(0, 6);

  container.innerHTML = picks.map(({ p, g }) => {
    const fc = getFamilyColor(p.family);
    const badge = g.stock === 'ultimos' ? '<span class="stockBadge stockLow">Últimas unidades</span>' : '';
    const action = isAvailable(p)
      ? `<button class="btn" data-add="${p.id}">Agregar al carrito</button>`
      : `<a href="product.html?id=${encodeURIComponent(p.id)}" class="btn btnOutline">Ver opciones</a>`;
    return `
      <article class="bsCard" data-family="${p.family}" style="--fc:${fc}">
        <a href="product.html?id=${encodeURIComponent(p.id)}" class="bsCardLink">
          <div class="bsThumb">
            ${badge}
            <img src="${p.image}" alt="${p.brand} ${p.name}" loading="lazy"/>
          </div>
          <div class="bsBody">
            <div class="brand">${p.brand}</div>
            <div class="bsTitle">${p.name}</div>
            <div class="sub">${p.subtitle} · ${g.multi ? g.sizesLabel : p.volume_ml + 'ml'}</div>
            <div class="bsMeta">
              <span class="pill pillFc">${p.family}</span>
              <span class="pill">${p.gender}</span>
            </div>
            <div class="price">${g.multi ? `<span class="priceFrom">Desde</span> ${formatARS(g.minPrice)}` : formatARS(p.price_ars)}</div>
          </div>
        </a>
        <div class="bsActions">${action}</div>
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

  // Una entrada por grupo de variantes (representante: 50ml) o por producto suelto
  const catalogEntries = all
    .filter(p => !p.variant_group || p.volume_ml === 50)
    .map(p => ({ p, g: groupInfo(p, all) }));

  function render(){
    const term    = (searchInput.value || '').trim();
    setQueryParam('q', term);

    const filters  = getFilters();
    const filtered = catalogEntries
      .filter(e => matchesSearch(e.p, term))
      .filter(e => matchesFilters(e, filters));

    const sorted = sortEntries(filtered, sortSel.value);
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

  // Al buscar, llevar al usuario a los resultados (están debajo del hero)
  let lastScrolledTerm = '';
  function scrollToResults(term){
    if (!term || term === lastScrolledTerm) return;
    lastScrolledTerm = term;
    qs('#catalogSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
    searchInputMobile.addEventListener('input', () => {
      searchInput.value = searchInputMobile.value;
      render();
      scrollToResults(searchInputMobile.value.trim());
    });
    searchInputMobile.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeSearch();
      if (e.key === 'Enter') {
        searchInputMobile.blur(); // cerrar teclado del celular
        lastScrolledTerm = '';
        scrollToResults(searchInputMobile.value.trim() || ' ');
      }
    });
  }

  // Eventos
  searchInput.addEventListener('input', () => {
    render();
    scrollToResults(searchInput.value.trim());
  });
  searchInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      lastScrolledTerm = '';
      scrollToResults(searchInput.value.trim() || ' ');
    }
  });
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

  // Si la página cargó con ?q= en la URL, ir directo a los resultados
  if (q && q.trim()) {
    setTimeout(() => qs('#catalogSection')?.scrollIntoView({ behavior: 'auto', block: 'start' }), 100);
    lastScrolledTerm = q.trim();
  }

  // ── Sección "Más vendidos" ─────────────────────────────
  renderBestsellers(all);

  // ── Opiniones ──────────────────────────────────────────
  initReviews(all);
}

// ── Opiniones: render + formulario ───────────────────────
const starRow = n => '★'.repeat(n) + '☆'.repeat(5 - n);

async function initReviews(all){
  // Render de opiniones publicadas
  const grid = qs('#reviewsGrid');
  if (grid) {
    try {
      const res = await fetch('data/reviews.json', { cache: 'no-store' });
      const reviews = await res.json();
      grid.innerHTML = reviews.map(r => `
        <div class="testimonialCard">
          <div class="testimonialStars" aria-label="${r.stars} de 5 estrellas">${starRow(r.stars)}</div>
          ${r.text ? `<p class="testimonialText">${r.text}</p>` : '<p class="testimonialText testimonialNoText">Puntuó su compra</p>'}
          <div class="testimonialMeta">
            <div class="testimonialAuthor">${r.name}</div>
            <div class="testimonialProduct">${r.perfume} · ${r.location}</div>
          </div>
        </div>
      `).join('');
    } catch (e) {
      console.error('reviews:', e);
    }
  }

  // Formulario
  const form = qs('#reviewForm');
  if (!form) return;

  // Poblar el selector con las fragancias del catálogo (una por grupo)
  const sel = qs('#reviewPerfume');
  const names = [...new Set(all.filter(p => !p.variant_group || p.volume_ml === 50).map(p => p.name))].sort();
  sel.innerHTML = '<option value="">Elegí tu fragancia</option>' +
    names.map(n => `<option value="${n}">${n}</option>`).join('');

  // Selector de estrellas
  let stars = 0;
  const starBtns = qsa('#starPicker button');
  function paintStars(){
    starBtns.forEach(b => b.classList.toggle('on', Number(b.dataset.star) <= stars));
  }
  starBtns.forEach(b => b.addEventListener('click', () => { stars = Number(b.dataset.star); paintStars(); }));

  const msg = qs('#reviewMsg');
  const showMsg = (text, ok) => { msg.textContent = text; msg.className = 'reviewMsg ' + (ok ? 'ok' : 'err'); };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    if (!fd.get('name') || String(fd.get('name')).trim().length < 3) return showMsg('Ingresá tu nombre y apellido.', false);
    if (!fd.get('perfume')) return showMsg('Elegí el perfume que probaste.', false);
    if (!fd.get('location') || String(fd.get('location')).trim().length < 2) return showMsg('Contanos desde dónde nos escribís.', false);
    if (!stars) return showMsg('Elegí tu puntuación en estrellas.', false);

    const btn = qs('#reviewSubmit');
    btn.disabled = true; btn.textContent = 'Enviando...';
    try {
      const res = await fetch('/api/submit-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:     fd.get('name'),
          perfume:  fd.get('perfume'),
          location: fd.get('location'),
          stars,
          text:     fd.get('text') || '',
          website:  fd.get('website') || '',
        }),
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      form.reset(); stars = 0; paintStars();
      showMsg('¡Gracias por tu opinión! La publicamos apenas la revisemos.', true);
    } catch (err) {
      console.error('review submit:', err);
      showMsg('No pudimos enviar tu opinión. Probá de nuevo en un rato.', false);
    } finally {
      btn.disabled = false; btn.textContent = 'Enviar opinión';
    }
  });
}

init().catch(err => {
  console.error(err);
  const results = document.querySelector('#results');
  if(results) results.innerHTML = `<div class="empty">Error cargando catálogo. Revisá que data/products.json exista.</div>`;
});
