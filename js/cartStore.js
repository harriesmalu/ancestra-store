/* Cart store with pure functions.
 * Cart shape: { items: { [productId]: { id, qty, price_ars, name, volume_ml, image } } }
 */

const CART_KEY = 'ancestra_cart_v1';

function createMemoryStorage() {
  const mem = Object.create(null);
  return {
    getItem: (k) => (k in mem ? mem[k] : null),
    setItem: (k, v) => { mem[k] = String(v); },
    removeItem: (k) => { delete mem[k]; },
  };
}

function getStorage(customStorage) {
  if (customStorage) return customStorage;
  if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  return createMemoryStorage();
}

function safeParse(json, fallback) {
  try { return JSON.parse(json); } catch { return fallback; }
}

function readCart(storage) {
  const s = getStorage(storage);
  const raw = s.getItem(CART_KEY);
  const cart = raw ? safeParse(raw, null) : null;
  if (!cart || typeof cart !== 'object' || !cart.items) {
    return { items: {} };
  }
  return cart;
}

function writeCart(cart, storage) {
  const s = getStorage(storage);
  s.setItem(CART_KEY, JSON.stringify(cart));
  return cart;
}

function clearCart(storage) {
  const s = getStorage(storage);
  s.removeItem(CART_KEY);
  return { items: {} };
}

function addItem(product, qty = 1, storage) {
  if (!product || !product.id) throw new Error('product with id is required');
  if (!Number.isFinite(qty) || qty <= 0) throw new Error('qty must be > 0');

  const cart = readCart(storage);
  const existing = cart.items[product.id];
  const nextQty = (existing ? existing.qty : 0) + qty;

  cart.items[product.id] = {
    id: product.id,
    qty: nextQty,
    price_ars: product.price_ars,
    name: product.name,
    brand: product.brand,
    volume_ml: product.volume_ml,
    image: product.image || '',
  };

  return writeCart(cart, storage);
}

function setQty(productId, qty, storage) {
  if (!productId) throw new Error('productId is required');
  const cart = readCart(storage);
  if (!cart.items[productId]) return cart;

  if (!Number.isFinite(qty) || qty < 0) throw new Error('qty must be >= 0');
  if (qty === 0) {
    delete cart.items[productId];
  } else {
    cart.items[productId].qty = qty;
  }
  return writeCart(cart, storage);
}

function removeItem(productId, storage) {
  return setQty(productId, 0, storage);
}

function listItems(storage) {
  const cart = readCart(storage);
  return Object.values(cart.items);
}

function totals(storage) {
  const items = listItems(storage);
  const subtotal = items.reduce((acc, it) => acc + (it.price_ars * it.qty), 0);
  const count = items.reduce((acc, it) => acc + it.qty, 0);
  return { subtotal_ars: subtotal, items_count: count };
}

module.exports = {
  CART_KEY,
  createMemoryStorage,
  readCart,
  writeCart,
  clearCart,
  addItem,
  setQty,
  removeItem,
  listItems,
  totals,
};
