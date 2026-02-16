const assert = require('assert');
const store = require('../js/cartStore');

function makeProduct(id, price) {
  return { id, brand: 'ANCESTRA', name: id.toUpperCase(), volume_ml: 50, price_ars: price, image: '' };
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

console.log('All cartStore tests passed.');
