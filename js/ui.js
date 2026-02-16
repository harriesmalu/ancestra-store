export function formatARS(value){
  try{
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(value);
  }catch{
    return `$${Math.round(value)}`;
  }
}

export async function loadProducts(){
  const res = await fetch('data/products.json', { cache: 'no-store' });
  if(!res.ok) throw new Error('No se pudo cargar el catálogo');
  return await res.json();
}

export function qs(sel, root=document){ return root.querySelector(sel); }
export function qsa(sel, root=document){ return Array.from(root.querySelectorAll(sel)); }

export function setCartBadge(count){
  const badge = qs('#cartBadge');
  if(!badge) return;
  badge.textContent = String(count);
  badge.style.display = count > 0 ? 'inline-flex' : 'none';
}

export function getQueryParam(name){
  const url = new URL(window.location.href);
  return url.searchParams.get(name);
}

export function setQueryParam(name, value){
  const url = new URL(window.location.href);
  if(value === null || value === undefined || value === '') url.searchParams.delete(name);
  else url.searchParams.set(name, value);
  history.replaceState({}, '', url);
}
