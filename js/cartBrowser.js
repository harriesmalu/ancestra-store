/* Fachada browser del cart store.
 * La lógica vive en cartStore.js (única fuente de verdad, testeada en Node).
 * Se mantiene este módulo para no romper los imports existentes de las páginas.
 */
export {
  CART_KEY,
  readCart,
  writeCart,
  clearCart,
  addItem,
  setQty,
  removeItem,
  listItems,
  totals,
} from './cartStore.js';
