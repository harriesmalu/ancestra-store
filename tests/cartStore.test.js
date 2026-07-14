import assert from 'assert';
import * as store from '../js/cartStore.js';

function makeProduct(id, price, stock) {
  return { id, brand: 'ANCESTRA', name: id.toUpperCase(), volume_ml: 50, price_ars: price, image: '', ...(stock ? { stock } : {}) };
}

(function testAddAndTotals() {
  const mem = store.createMemoryStorage();
  store.clearCart(mem);
  store.addItem(makeProduct('a', 1000), 1, mem);
  store.addItem(makeProduct('b', 2500), 2, mem);

  const t = store.totals(mem);
  assert.strictEqual(t.items_count, 3);
  assert.strictEqual(t.subtotal_ars, 1000 + 2 * 2500);
})();

(function testSetQtyAndRemove() {
  const mem = store.createMemoryStorage();
  store.clearCart(mem);
  store.addItem(makeProduct('a', 1000), 3, mem);
  store.setQty('a', 1, mem);
  let t = store.totals(mem);
  assert.strictEqual(t.items_count, 1);
  assert.strictEqual(t.subtotal_ars, 1000);

  store.removeItem('a', mem);
  t = store.totals(mem);
  assert.strictEqual(t.items_count, 0);
  assert.strictEqual(t.subtotal_ars, 0);
})();

(function testRejectsOutOfStock() {
  const mem = store.createMemoryStorage();
  store.clearCart(mem);
  assert.throws(() => store.addItem(makeProduct('agotado', 1000, 'sin_stock'), 1, mem), /sin stock/);
  const t = store.totals(mem);
  assert.strictEqual(t.items_count, 0);
})();

(function testAllowsLowStock() {
  const mem = store.createMemoryStorage();
  store.clearCart(mem);
  store.addItem(makeProduct('bajo', 1000, 'ultimos'), 1, mem);
  store.addItem(makeProduct('ok', 2000, 'disponible'), 1, mem);
  const t = store.totals(mem);
  assert.strictEqual(t.items_count, 2);
})();

console.log('All cartStore tests passed.');
