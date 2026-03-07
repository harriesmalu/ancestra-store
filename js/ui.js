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
