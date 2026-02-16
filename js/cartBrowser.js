const CART_KEY = 'ancestra_cart_v1';

function safeParse(json, fallback){
  try{ return JSON.parse(json); }catch{ return fallback; }
}

export function readCart(){
  const raw = localStorage.getItem(CART_KEY);
  const cart = raw ? safeParse(raw, null) : null;
  if(!cart || typeof cart !== 'object' || !cart.items) return { items: {} };
  return cart;
}

export function writeCart(cart){
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  return cart;
}

export function clearCart(){
  localStorage.removeItem(CART_KEY);
  return { items: {} };
}

export function addItem(product, qty=1){
  if(!product || !product.id) throw new Error('product with id is required');
  if(!Number.isFinite(qty) || qty <= 0) throw new Error('qty must be > 0');

  const cart = readCart();
  const existing = cart.items[product.id];
  const nextQty = (existing ? existing.qty : 0) + qty;

  cart.items[product.id] = {
    id: product.id,
    qty: nextQty,
    price_ars: product.price_ars,
    name: product.name,
    brand: product.brand,
    volume_ml: product.volume_ml,
    image: product.image || ''
  };

  return writeCart(cart);
}

export function setQty(productId, qty){
  const cart = readCart();
  if(!cart.items[productId]) return cart;
  if(!Number.isFinite(qty) || qty < 0) throw new Error('qty must be >= 0');
  if(qty === 0) delete cart.items[productId];
  else cart.items[productId].qty = qty;
  return writeCart(cart);
}

export function removeItem(productId){
  return setQty(productId, 0);
}

export function listItems(){
  const cart = readCart();
  return Object.values(cart.items);
}

export function totals(){
  const items = listItems();
  const subtotal = items.reduce((acc,it)=>acc + it.price_ars*it.qty, 0);
  const count = items.reduce((acc,it)=>acc + it.qty, 0);
  return { subtotal_ars: subtotal, items_count: count };
}

export { CART_KEY };
