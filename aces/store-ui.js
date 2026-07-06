/* ==============================================
 * STORE UI — ascii kit           (<=50 col house)
 * ----------------------------------------------
 * Atomic design, no framework. Each component is
 * a PURE function props -> string (or string[]).
 * We stack and join lines into one phone-narrow
 * card, atoms -> molecules -> screen.
 *
 *   atom      money, pad, padL
 *   molecule  shelfRow  (a catalog line)
 *             cartRow   (a basket line)
 *   organism  shelf, basket
 *   template  frame     (border around a body)
 *   screen    renderStore (state -> frame)
 *
 * NON-CAPTIVE: nothing is clickable in a pipe. A
 * shelf row shows a sku TAG; the harness "taps"
 * it by dispatching AddToCart{sku}. The foot
 * line names the gesture as a legend.
 * ============================================ */

'use strict';

// ---- atoms ----
function money(cents) {
  return '$' + (cents / 100).toFixed(2);
}
function pad(s, w) {
  s = String(s);
  return s.length >= w
    ? s : s + ' '.repeat(w - s.length);
}
function padL(s, w) {
  s = String(s);
  return s.length >= w
    ? s : ' '.repeat(w - s.length) + s;
}

// ---- molecules ----
function shelfRow(p, stock) {
  return ' ' + pad(p.sku, 3) + ' '
    + pad(p.name, 6)
    + padL(money(p.price), 7)
    + '  x' + stock;
}
function cartRow(sku, qty, price) {
  return ' ' + pad(sku, 3)
    + ' x' + pad(qty, 2)
    + padL(money(qty * price), 8);
}

// ---- organisms ----
function shelf(state) {
  return state.catalog.map(p =>
    shelfRow(p, state.inventory[p.sku] || 0));
}
function basket(state) {
  const rows = [];
  for (const sku in state.cart) {
    rows.push(cartRow(
      sku, state.cart[sku],
      priceFor(state, sku)));
  }
  if (!rows.length) rows.push('  (empty)');
  return rows;
}
function priceFor(state, sku) {
  const p = state.catalog
    .find(x => x.sku === sku);
  return p ? p.price : 0;
}

// ---- template: device-style frame ----
// auto-sizes to the widest line so the card
// never spills its border.
function frame(title, body) {
  const bar = '[ ' + title + ' ]';
  const all = body.concat([bar]);
  const W = Math.max(
    ...all.map(l => l.length)) + 1;
  const top = '.' + '-'.repeat(W + 1) + '.';
  const bot = "'" + '-'.repeat(W + 1) + "'";
  const row = s => '| ' + pad(s, W) + '|';
  return [top, row(bar), row(''),
    ...body.map(row), bot].join('\n');
}

// ---- screen: store ----
function renderStore(state) {
  const body = [
    ' CATALOG',
    ...shelf(state),
    '',
    ' CART',
    ...basket(state),
    ' ' + '-'.repeat(13),
    ' items' + padL(state.count, 8),
    ' TOTAL' + padL(money(state.total), 8),
    '',
    footer(state),
  ];
  return frame(state.merchant.name, body);
}
function footer(state) {
  if (state.lastReject)
    return ' x: ' + state.lastReject.reason;
  if (state.lastOrder)
    return ' ok: '
      + money(state.lastOrder.total) + ' paid';
  return ' tap sku -> AddToCart';
}

module.exports = {
  money, pad, padL, shelfRow, cartRow,
  shelf, basket, frame, renderStore,
};
