// ── Formatters ────────────────────────────────────────────────────────────────
const _arsFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency', currency: 'ARS', maximumFractionDigits: 0,
});

export function formatARS(value) {
  try { return _arsFormatter.format(value); }
  catch { return `$${Math.round(value)}`; }
}

// ── Products loader con caché en memoria ──────────────────────────────────────
// Evita múltiples fetches a products.json cuando varias partes de la página
// llaman a loadProducts() en la misma sesión.
let _productsCache = null;

export async function loadProducts() {
  if (_productsCache) return _productsCache;
  const res = await fetch('data/products.json', { cache: 'no-store' });
  if (!res.ok) throw new Error('No se pudo cargar el catálogo');
  _productsCache = await res.json();
  return _productsCache;
}

// ── Stock helpers ─────────────────────────────────────────────────────────────
// stock: "disponible" | "ultimos" | "sin_stock" (sincronizado por update-stock.mjs).
// Productos sin campo stock (catálogo viejo) se consideran disponibles.
export function isAvailable(p) {
  return !p || p.stock !== 'sin_stock';
}

export function stockBadge(p) {
  if (!p || !p.stock) return '';
  if (p.stock === 'sin_stock') return '<span class="stockBadge stockOut">Sin stock</span>';
  if (p.stock === 'ultimos')   return '<span class="stockBadge stockLow">Últimas unidades</span>';
  return '';
}

// ── Variantes de tamaño ───────────────────────────────────────────────────────
// Los perfumes vienen en 30/50/100 ml como productos separados unidos por
// `variant_group`. El catálogo muestra una tarjeta por grupo.

export function getSiblings(p, all) {
  if (!p.variant_group) return [p];
  return all
    .filter(x => x.variant_group === p.variant_group)
    .sort((a, b) => a.volume_ml - b.volume_ml);
}

// Estado agregado del grupo: disponible > ultimos > sin_stock
export function groupInfo(p, all) {
  const siblings = getSiblings(p, all);
  const available = siblings.filter(isAvailable);
  const stock = available.some(s => s.stock !== 'ultimos') ? 'disponible'
              : available.length ? 'ultimos'
              : 'sin_stock';
  const pricePool = available.length ? available : siblings;
  return {
    siblings,
    multi: siblings.length > 1,
    stock,
    minPrice: Math.min(...pricePool.map(s => s.price_ars)),
    sizesLabel: siblings.map(s => s.volume_ml).join(' / ') + ' ml',
  };
}

// Clase CSS para escalar el frasco según el tamaño
export function sizeClass(p) {
  if (p.category !== 'Perfumes') return '';
  if (p.volume_ml === 30) return 'imgSize30';
  if (p.volume_ml === 100) return 'imgSize100';
  return '';
}

// ── DOM helpers ───────────────────────────────────────────────────────────────
export function qs(sel, root = document)  { return root.querySelector(sel); }
export function qsa(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

export function setCartBadge(count) {
  const badge = qs('#cartBadge');
  if (!badge) return;
  badge.textContent  = String(count);
  badge.style.display = count > 0 ? 'inline-flex' : 'none';
}

// ── URL helpers ───────────────────────────────────────────────────────────────
export function getQueryParam(name) {
  return new URL(window.location.href).searchParams.get(name);
}

export function setQueryParam(name, value) {
  const url = new URL(window.location.href);
  if (value === null || value === undefined || value === '') {
    url.searchParams.delete(name);
  } else {
    url.searchParams.set(name, value);
  }
  history.replaceState({}, '', url);
}
