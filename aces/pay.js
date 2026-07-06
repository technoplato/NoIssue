/* ==============================================
 * PAY — payments as a         (<=50 col house)
 * DEPENDENCY; buying tokens as an archetype.
 * ----------------------------------------------
 * Michael's doctrine, held exactly: a payment
 * is a SIDE-EFFECT (charge a card). The thing
 * that PERFORMS it is a swappable DEPENDENCY
 * with three faces — live / scripted / unimpl —
 * same as deps.js and llm.js. The archetype
 * never touches Stripe; it only asks.
 *
 * The flow, every step a FACT on the log:
 *
 *   BuyTokens {account, cents, ref}
 *     -> CheckoutStarted            (fact)
 *     -> effect pay/create          (ask)
 *          dependency.createSession
 *        -> SessionOpened {url}     (action back)
 *     -> SessionCreated {url}       (fact)
 *   ... user pays at the url ...
 *   PaymentConfirmed {ref, sig,raw} (webhook)
 *     -> effect pay/verify (checks signature)
 *     -> Fulfilled {account, cents} (fact)
 *     -> effect ledger/record       (ask)
 *          ledger.dispatch(RecordPurchase)
 *        -> TokensMinted            (in ledger)
 *
 * TWO independent anti-double-spend guards, so
 * "nothing of a ponzi nature is possible": the
 * checkout refuses a second Fulfilled for a ref,
 * AND the ledger refuses a second mint for the
 * same backing ref. Money in, tokens out, once.
 *
 * NO SECRET KEY LIVES HERE. stripePay(cfg) lazy-
 * requires the Stripe SDK and takes the secret
 * at call time; it belongs only on a server (see
 * pay.stripe.md). The public arcade never gets
 * it — same rule as the InstantDB admin token.
 * ============================================ */

'use strict';

function unimpl(label) {
  return () => {
    throw new Error(
      'unimplemented pay dependency: ' + label);
  };
}

// DEFAULT dependency: every face throws, so a
// test that forgets to wire payments dies loud.
function unimplementedPay() {
  return {
    createSession: unimpl('pay.createSession'),
    verifyEvent: unimpl('pay.verifyEvent'),
  };
}

/* scriptedPay(script) — deterministic double.
 * script:
 *   url        checkout url to hand back
 *   accept     verifyEvent result: true = a
 *              genuine paid webhook, false =
 *              a forged/failed one
 * Pure, offline, no SDK. This is what the test
 * injects.
 */
function scriptedPay(script) {
  const s = script || {};
  return {
    createSession: async ({ ref, cents }) =>
      ({ url: (s.url || 'https://pay.test/') +
        ref, id: 'sess_' + ref, cents }),
    verifyEvent: async () => s.accept !== false,
  };
}

/* stripePay(cfg) — the LIVE rail.
 * cfg: { secretKey, webhookSecret,
 *        successUrl, cancelUrl }
 * Lazy-requires 'stripe' so this file loads
 * even where the SDK isn't installed. Server
 * only. See pay.stripe.md to go live.
 */
function stripePay(cfg) {
  cfg = cfg || {};
  let stripe = null;
  const sdk = () => (stripe = stripe ||
    require('stripe')(cfg.secretKey));
  return {
    createSession: async ({ ref, cents,
      account }) => {
      const sess = await sdk().checkout
        .sessions.create({
          mode: 'payment',
          success_url: cfg.successUrl,
          cancel_url: cfg.cancelUrl,
          client_reference_id: ref,
          metadata: { ref, account },
          line_items: [{
            quantity: 1,
            price_data: {
              currency: 'usd',
              unit_amount: cents,
              product_data: { name:
                'Game tokens (' + cents +
                '¢)' },
            },
          }],
        });
      return { url: sess.url, id: sess.id,
        cents };
    },
    // constructEvent THROWS on a bad signature;
    // we translate that to a plain boolean.
    verifyEvent: async ({ raw, sig }) => {
      try {
        sdk().webhooks.constructEvent(
          raw, sig, cfg.webhookSecret);
        return true;
      } catch (e) { return false; }
    },
  };
}

// tokens minted per cent — MUST match ledger.js
// RATE so the two never drift.
const RATE = 100;

/* createCheckout() -> the buy-tokens archetype.
 * A tiny fold; all the money lives behind the
 * pay dependency and the ledger.
 */
function createCheckout() {
  const started = s => Object.keys(s.sessions);
  return {
    initial: { sessions: {}, fulfilled: {} },

    decide(state, action) {
      const a = action || {};
      if (a.type === 'BuyTokens') {
        if (!a.account || !a.ref)
          return [{ type: 'Rejected',
            reason: 'incomplete' }];
        if (!(Number.isInteger(a.cents) &&
              a.cents > 0))
          return [{ type: 'Rejected',
            reason: 'bad-cents',
            got: a.cents }];
        if (state.sessions[a.ref])
          return [{ type: 'Rejected',
            reason: 'ref-in-flight',
            ref: a.ref }];
        return [{ type: 'CheckoutStarted',
          ref: a.ref, account: a.account,
          cents: a.cents }];
      }
      if (a.type === 'SessionOpened')
        return [{ type: 'SessionCreated',
          ref: a.ref, url: a.url }];
      // a raw webhook off the wire — verify its
      // signature (via the pay dependency) BEFORE
      // trusting it. Guards run first so a forged
      // event for an unknown/paid ref is cheap.
      if (a.type === 'PaymentWebhook') {
        if (!state.sessions[a.ref])
          return [{ type: 'Rejected',
            reason: 'unknown-ref',
            ref: a.ref }];
        if (state.fulfilled[a.ref])
          return [{ type: 'Rejected',
            reason: 'already-fulfilled',
            ref: a.ref }];
        return [{ type: 'WebhookReceived',
          ref: a.ref, raw: a.raw,
          sig: a.sig }];
      }
      // the verify processor's verdict comes back
      // here. Only a signed event mints.
      if (a.type === 'PaymentConfirmed') {
        if (!state.sessions[a.ref] ||
            state.fulfilled[a.ref])
          return [];      // guarded at webhook
        if (a.verified === false)
          return [{ type: 'Rejected',
            reason: 'bad-signature',
            ref: a.ref }];
        const sess = state.sessions[a.ref];
        return [{ type: 'Fulfilled',
          ref: a.ref, account: sess.account,
          cents: sess.cents }];
      }
      return [];
    },

    evolve(state, ev) {
      if (ev.type === 'CheckoutStarted')
        return { ...state, sessions: {
          ...state.sessions,
          [ev.ref]: { account: ev.account,
            cents: ev.cents, url: null } } };
      if (ev.type === 'SessionCreated')
        return { ...state, sessions: {
          ...state.sessions,
          [ev.ref]: { ...state.sessions[ev.ref],
            url: ev.url } } };
      if (ev.type === 'Fulfilled')
        return { ...state, fulfilled: {
          ...state.fulfilled, [ev.ref]: true } };
      return state;
    },

    react(state, ev) {
      if (ev.type === 'CheckoutStarted')
        return [{ type: 'pay/create',
          ref: ev.ref, account: ev.account,
          cents: ev.cents }];
      if (ev.type === 'WebhookReceived')
        return [{ type: 'pay/verify',
          ref: ev.ref, raw: ev.raw,
          sig: ev.sig }];
      if (ev.type === 'Fulfilled')
        return [{ type: 'ledger/record',
          ref: ev.ref, account: ev.account,
          cents: ev.cents }];
      return [];
    },

    render(state) {
      const V = require('./view');
      const rows = started(state).map(ref => {
        const s = state.sessions[ref];
        return V.text(
          (state.fulfilled[ref] ? '[paid] '
            : '[open] ') + ref + '  ' +
          s.cents + '¢ -> ' +
          s.account);
      });
      return V.toAscii(V.box('checkout',
        ...(rows.length ? rows
          : [V.text('(no sessions)')])));
    },
  };
}

/* processorsFor(pay, ledger) — the bridge.
 * pay:    a dependency bag (above).
 * ledger: a live ledger runtime; a confirmed
 *         payment dispatches RecordPurchase
 *         into it, minting the tokens.
 * Effects re-enter as actions via api.dispatch.
 */
function processorsFor(pay, ledger) {
  return {
    'pay/create': async (fx, api) => {
      const sess = await pay.createSession({
        ref: fx.ref, cents: fx.cents,
        account: fx.account });
      await api.dispatch({
        type: 'SessionOpened',
        ref: fx.ref, url: sess.url });
      return [];
    },
    'pay/verify': async (fx, api) => {
      const ok = await pay.verifyEvent({
        raw: fx.raw, sig: fx.sig });
      await api.dispatch({
        type: 'PaymentConfirmed',
        ref: fx.ref, verified: ok });
      return [];
    },
    'ledger/record': async fx => {
      await ledger.dispatch({
        type: 'RecordPurchase',
        account: fx.account, cents: fx.cents,
        source: 'stripe',
        ref: 'stripe:' + fx.ref });
      return [];
    },
  };
}

module.exports = {
  unimplementedPay, scriptedPay, stripePay,
  createCheckout, processorsFor, RATE,
};
