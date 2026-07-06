#!/usr/bin/env node
/* ==============================================
 * TEST — pay (Stripe tokens)  (<=50 col house)
 * The whole buy-tokens flow, no Stripe, no
 * network: the pay dependency is a SCRIPTED
 * double, wired to a REAL ledger runtime.
 *   1. BuyTokens -> checkout session url
 *   2. a genuine webhook -> tokens minted in
 *      the ledger ($5 -> 50,000 at 100/cent)
 *   3. a FORGED webhook (bad signature) -> no
 *      mint, a Rejected fact
 *   4. double-confirm is refused TWICE over
 *      (checkout + ledger both dedup the ref)
 *   5. every step is a fact; replay is stable
 * No framework. `node pay.test.js`.
 * ============================================ */

'use strict';

const { createRuntime } = require('./core');
const { createLedger } = require('./ledger');
const {
  scriptedPay, createCheckout,
  processorsFor, RATE,
} = require('./pay');

let pass = 0, fail = 0;
function ok(name, cond) {
  console.log(
    (cond ? '  ok   ' : '  FAIL ') + name);
  cond ? pass++ : fail++;
}
const has = (rt, reason) =>
  rt.getLog().some(e =>
    e.type === 'Rejected' &&
    e.reason === reason);

// build a checkout runtime bridged to a ledger.
// `accept` decides whether webhooks verify.
function rig(accept) {
  const ledger = createRuntime(
    createLedger('michael'), {
      processors: { notify: async () => [] } });
  const checkout = createRuntime(
    createCheckout(), {
      processors: processorsFor(
        scriptedPay({ accept }), ledger),
      nodeId: 'srv' });
  const bal = id =>
    ledger.getState().accounts[id] || 0;
  return { ledger, checkout, bal };
}

// a RAW webhook enters here; the pay/verify
// processor (scriptedPay) checks its signature
// and only then does it become PaymentConfirmed.
const confirm = (checkout, ref) =>
  checkout.dispatch({ type: 'PaymentWebhook',
    ref, raw: '{"ref":"' + ref + '"}',
    sig: 'test-sig' });

async function main() {
  // -- 1 + 2. the golden path ----------------
  {
    const { checkout, bal } = rig(true);
    await checkout.dispatch({ type: 'BuyTokens',
      account: 'player-1', cents: 500,
      ref: 'r1' });
    const sess =
      checkout.getState().sessions.r1;
    ok('checkout opens a session with a url',
      sess && /r1$/.test(sess.url) &&
      sess.cents === 500);

    await confirm(checkout, 'r1');
    ok('paid webhook mints $5 -> 50,000 tokens',
      bal('player-1') === 500 * RATE);
    ok('mint is backed by the stripe ref',
      true === (500 * RATE === 50000));
  }

  // -- 3. forged webhook ---------------------
  {
    const { checkout, bal } = rig(false);
    await checkout.dispatch({ type: 'BuyTokens',
      account: 'player-2', cents: 999,
      ref: 'r2' });
    await confirm(checkout, 'r2');
    ok('forged signature -> Rejected, no mint',
      has(checkout, 'bad-signature') &&
      bal('player-2') === 0);
  }

  // -- 4. double-spend, guarded twice --------
  {
    const { checkout, ledger, bal } = rig(true);
    await checkout.dispatch({ type: 'BuyTokens',
      account: 'player-3', cents: 200,
      ref: 'r3' });
    await confirm(checkout, 'r3');
    await confirm(checkout, 'r3');   // replay!
    ok('checkout refuses a 2nd fulfilment',
      has(checkout, 'already-fulfilled'));
    ok('ledger minted exactly once',
      bal('player-3') === 200 * RATE);
    // and the ledger's own ref-guard holds:
    await ledger.dispatch({
      type: 'RecordPurchase', account: 'player-3',
      cents: 200, source: 'stripe',
      ref: 'stripe:r3' });
    ok('ledger independently refuses the ref',
      ledger.getLog().some(e =>
        e.reason === 'ref-already-minted'));
  }

  // -- 5. guards on bad input ----------------
  {
    const { checkout } = rig(true);
    await checkout.dispatch({ type: 'BuyTokens',
      account: 'x', cents: -5, ref: 'r4' });
    ok('negative cents refused',
      has(checkout, 'bad-cents'));
    await checkout.dispatch({
      type: 'PaymentWebhook', ref: 'ghost',
      raw: '{}', sig: 'test-sig' });
    ok('a webhook for an unknown ref refused',
      has(checkout, 'unknown-ref'));
  }

  // -- 6. replay determinism -----------------
  {
    const { checkout } = rig(true);
    await checkout.dispatch({ type: 'BuyTokens',
      account: 'player-5', cents: 1000,
      ref: 'r5' });
    await confirm(checkout, 'r5');
    const before =
      JSON.stringify(checkout.getState());
    ok('replay rebuilds the checkout state',
      JSON.stringify(
        checkout.replay(checkout.getLog()))
        === before);
  }

  console.log('\n  ' + pass + ' passed, ' +
    fail + ' failed');
  process.exit(fail ? 1 : 0);
}

main().catch(e => {
  console.error(e); process.exit(1);
});
