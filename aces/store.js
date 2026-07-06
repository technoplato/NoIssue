/* ==============================================
 * ARCHETYPE: store               (<=50 col house)
 * ----------------------------------------------
 * A tiny corner shop as an event fold. The CART
 * is a map sku->qty folded from cart facts. A
 * live PROJECTION recomputes count + total from
 * the catalog after every event. INVENTORY is
 * shelf stock; the cart may never reserve more
 * than exists, and CHECKOUT draws stock down.
 *
 * Every ACES letter is OWNED here. A "KEY" is a
 * category error; a store taps AddToCart.
 *   ACTION  AddToCart|RemoveFromCart|
 *           SetQty|Checkout
 *   EVENT   ItemAddedToCart|ItemRemovedFromCart|
 *           QtyChanged|CheckedOut|Rejected
 *   EFFECT  {type:'notify', text}
 *   STATE   {merchant,catalog,inventory,cart,
 *            count,total,lastReject,lastOrder}
 *
 * REJECTION PATH: decide emits a Rejected fact
 * (not []) when an action is refused — adding
 * past stock, an unknown sku, or checking out an
 * empty cart — so the refusal is an auditable
 * event. It moves no cart/stock; evolve only
 * remembers the reason for the screen.
 *
 * evolve is a pure left-fold: no clock, no
 * random, no I/O. Same log => same state.
 * ============================================ */

'use strict';

// ---- catalog + cart helpers (all pure) ----
function find(catalog, sku) {
  return catalog.find(p => p.sku === sku);
}
function priceOf(state, sku) {
  const p = find(state.catalog, sku);
  return p ? p.price : 0;
}
function inStock(state, sku) {
  return state.inventory[sku] || 0;
}
function qtyIn(cart, sku) {
  return cart[sku] || 0;
}
function setLine(cart, sku, qty) {
  const next = { ...cart };
  if (qty > 0) next[sku] = qty;
  else delete next[sku];
  return next;
}
function money(cents) {
  return '$' + (cents / 100).toFixed(2);
}

// ---- projection: derive count + total ----
function project(state) {
  let count = 0, total = 0;
  for (const sku in state.cart) {
    const q = state.cart[sku];
    count += q;
    total += q * priceOf(state, sku);
  }
  return { ...state, count, total };
}

// ---- decide helpers (each one job) ----
function reject(reason, sku) {
  return [{ type: 'Rejected', reason, sku }];
}
function decideAdd(state, sku) {
  if (!find(state.catalog, sku))
    return reject('no-such-sku', sku);
  const have = qtyIn(state.cart, sku);
  if (have >= inStock(state, sku))
    return reject('out-of-stock', sku);
  return [{ type: 'ItemAddedToCart', sku }];
}
function decideRemove(state, sku) {
  if (qtyIn(state.cart, sku) <= 0)
    return reject('not-in-cart', sku);
  return [{ type: 'ItemRemovedFromCart', sku }];
}
function decideSetQty(state, sku, qty) {
  if (!find(state.catalog, sku))
    return reject('no-such-sku', sku);
  if (!Number.isInteger(qty) || qty < 0)
    return reject('bad-qty', sku);
  if (qty > inStock(state, sku))
    return reject('out-of-stock', sku);
  return [{ type: 'QtyChanged', sku, qty }];
}
function decideCheckout(state) {
  if (state.count <= 0)
    return reject('empty-cart', null);
  return [{
    type: 'CheckedOut',
    items: lineItems(state),
    total: state.total,
  }];
}
function lineItems(state) {
  const out = [];
  for (const sku in state.cart) {
    out.push({
      sku, qty: state.cart[sku],
      price: priceOf(state, sku),
    });
  }
  return out;
}

// ---- evolve helpers (folds, reproject) ----
function foldAdd(state, sku) {
  const q = qtyIn(state.cart, sku) + 1;
  return reproject(state,
    setLine(state.cart, sku, q));
}
function foldRemove(state, sku) {
  const q = qtyIn(state.cart, sku) - 1;
  return reproject(state,
    setLine(state.cart, sku, q));
}
function foldSetQty(state, sku, qty) {
  return reproject(state,
    setLine(state.cart, sku, qty));
}
function reproject(state, cart) {
  return project({
    ...state, cart, lastReject: null,
  });
}
function foldCheckout(state, ev) {
  const inv = { ...state.inventory };
  for (const it of ev.items)
    inv[it.sku] = (inv[it.sku] || 0) - it.qty;
  return project({
    ...state, inventory: inv, cart: {},
    lastReject: null,
    lastOrder: {
      items: ev.items, total: ev.total,
    },
  });
}

// ---- seed catalog (prices in cents) ----
const CATALOG = [
  { sku: 'APL', name: 'Apple', price: 50 },
  { sku: 'MLK', name: 'Milk', price: 120 },
  { sku: 'EGG', name: 'Eggs', price: 240 },
  { sku: 'BRD', name: 'Bread', price: 175 },
];
const STOCK = { APL: 6, MLK: 3, EGG: 2, BRD: 4 };

const machine = {
  initial: project({
    merchant: { name: 'Corner Store' },
    catalog: CATALOG,
    inventory: STOCK,
    cart: {},
    count: 0, total: 0,
    lastReject: null,
    lastOrder: null,
  }),

  // DECIDE: the sole judge of validity. A bad
  // action becomes a Rejected fact, no throw.
  decide(state, action) {
    const a = action || {};
    if (a.type === 'AddToCart')
      return decideAdd(state, a.sku);
    if (a.type === 'RemoveFromCart')
      return decideRemove(state, a.sku);
    if (a.type === 'SetQty')
      return decideSetQty(state, a.sku, a.qty);
    if (a.type === 'Checkout')
      return decideCheckout(state);
    return [];
  },

  // EVOLVE: pure left-fold of one fact -> state.
  evolve(state, ev) {
    if (ev.type === 'ItemAddedToCart')
      return foldAdd(state, ev.sku);
    if (ev.type === 'ItemRemovedFromCart')
      return foldRemove(state, ev.sku);
    if (ev.type === 'QtyChanged')
      return foldSetQty(state, ev.sku, ev.qty);
    if (ev.type === 'CheckedOut')
      return foldCheckout(state, ev);
    if (ev.type === 'Rejected')
      return { ...state, lastReject: ev };
    return state;
  },

  // REACT: a settled order asks the world to
  // notify (an EFFECT, not a fact).
  react(state, ev) {
    if (ev.type !== 'CheckedOut') return [];
    return [{
      type: 'notify',
      text: 'Order placed: ' + money(ev.total),
    }];
  },

  // RESOLVE: address a morsel of state.
  // Local:  store://cart/total
  // Global: aces://<user>/store/<id>/cart/total
  //   (World strips the prefix; we take the
  //    trailing field, exactly like calculator.)
  resolve(state, uri) {
    const f = uri
      .replace(/^store:\/\//, '')
      .replace(/^.*\/store\/[^/]+\//, '');
    if (f === 'cart/total') return state.total;
    if (f === 'cart/count') return state.count;
    if (f === 'catalog') return state.catalog;
    if (f === 'cart') return state.cart;
    if (f === 'inventory') return state.inventory;
    if (f === 'merchant') return state.merchant;
    throw new Error('no such uri: ' + uri);
  },

  render(state) {
    const { renderStore } = require('./store-ui');
    return renderStore(state);
  },
};

module.exports = { machine };
