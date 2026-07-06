#!/usr/bin/env node
/* ==============================================
 * TEST — token ledger        (<=50 col house)
 * Proves the fairness laws hold under fire:
 *   1. the $14.28 Shopify seed mints 142,800
 *   2. the same order can never mint twice
 *   3. unbacked mints are impossible
 *   4. you cannot spend what you lack
 *   5. genesis can never end up richest
 *   6. conservation + replay determinism
 * No framework. `node test-ledger.js`.
 * ============================================ */

'use strict';

const { createRuntime } = require('./core');
const { createLedger, violation, RATE } =
  require('./ledger');

let pass = 0, fail = 0;
function ok(name, cond) {
  console.log(
    (cond ? '  ok   ' : '  FAIL ') + name);
  cond ? pass++ : fail++;
}
const rejects = (rt, reason) =>
  rt.getLog().some(e =>
    e.type === 'Rejected' &&
    e.reason === reason);

async function main() {
  const notes = [];
  const rt = createRuntime(
    createLedger('michael'), {
      processors: {
        notify: fx =>
          (notes.push(fx.text), []),
      },
      nodeId: 't',
    });
  const bal = id =>
    rt.getState().accounts[id] || 0;

  // -- 1. the real seed purchase --------------
  // the emoji buyer from the Shopify store:
  // $14.28 = 1428 cents, RATE=100 tokens/cent.
  await rt.dispatch({
    type: 'RecordPurchase',
    account: 'emoji-buyer',
    cents: 1428,
    source: 'shopify',
    ref: 'shopify:order-1001',
  });
  ok('$14.28 seed mints 142,800 tokens',
    bal('emoji-buyer') === 1428 * RATE);
  ok('mint carried its backing in the fact',
    rt.getLog().some(e =>
      e.type === 'TokensMinted' &&
      e.backing.ref === 'shopify:order-1001'
      && e.backing.cents === 1428));
  ok('react() notified with the backing',
    notes.length === 1 &&
    /shopify/.test(notes[0]));

  // -- 2. double-mint is impossible -----------
  await rt.dispatch({
    type: 'RecordPurchase',
    account: 'emoji-buyer',
    cents: 1428,
    source: 'shopify',
    ref: 'shopify:order-1001',
  });
  ok('same ref refuses: ref-already-minted',
    rejects(rt, 'ref-already-minted') &&
    bal('emoji-buyer') === 142800);

  // -- 3. unbacked mints are impossible -------
  await rt.dispatch({
    type: 'RecordPurchase',
    account: 'freeloader', cents: 500,
    source: 'shopify' /* no ref */ });
  ok('mint without backing ref refuses',
    rejects(rt, 'purchase-incomplete') &&
    bal('freeloader') === 0);
  await rt.dispatch({
    type: 'RecordPurchase',
    account: 'michael', cents: 100,
    source: 'shopify', ref: 'x1' });
  ok('genesis cannot mint to itself',
    rejects(rt, 'genesis-cannot-mint') &&
    bal('michael') === 0);

  // -- 4. no overdrafts -----------------------
  await rt.dispatch({ type: 'Transfer',
    from: 'emoji-buyer', to: 'friend',
    amount: 200000 });
  ok('overdraft refuses: insufficient',
    rejects(rt, 'insufficient') &&
    bal('friend') === 0);

  // -- 5. genesis humility --------------------
  // a modest tip to genesis is fine while
  // everyone still holds more...
  await rt.dispatch({ type: 'Transfer',
    from: 'emoji-buyer', to: 'friend',
    amount: 42800 });
  await rt.dispatch({ type: 'Transfer',
    from: 'emoji-buyer', to: 'michael',
    amount: 1000 });
  ok('genesis may receive while poorest',
    bal('michael') === 1000);
  // ...but a payment that would put genesis
  // ABOVE any other account refuses.
  await rt.dispatch({ type: 'Transfer',
    from: 'friend', to: 'michael',
    amount: 42000 });
  ok('enriching genesis past a user refuses',
    rejects(rt, 'genesis-humility') &&
    bal('michael') === 1000 &&
    bal('friend') === 42800);

  // -- 6. conservation + determinism ----------
  await rt.dispatch({ type: 'Burn',
    account: 'friend', amount: 800,
    why: 'played a game' });
  const st = rt.getState();
  ok('the standing law holds on live state',
    violation(st) === null);
  const sum = Object.values(st.accounts)
    .reduce((a, b) => a + b, 0);
  ok('conservation: sum == minted - burned',
    sum === st.minted - st.burned &&
    st.minted === 142800 &&
    st.burned === 800);
  ok('replay rebuilds the exact ledger',
    JSON.stringify(rt.replay(rt.getLog()))
    === JSON.stringify(st));

  console.log('\n  ' + pass + ' passed, ' +
    fail + ' failed');
  process.exit(fail ? 1 : 0);
}

main().catch(e => {
  console.error(e); process.exit(1);
});
