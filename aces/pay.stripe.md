# pay.stripe — going live (2026-07-06)

`pay.js` is proven end-to-end against a scripted
double (`pay.test.js`, 10/10): a paid webhook
mints tokens in the real ledger, a forged one is
rejected, double-spends are refused twice over.
This note is the checklist to swap the double for
the **live Stripe rail** — no code changes to the
archetype, only a different dependency injected.

## The one rule

**The secret key and webhook secret live ONLY on
a server.** Same rule as the InstantDB admin
token: they never appear in the arcade HTML, in
the repo, or in any client bundle. The browser
only ever gets a Stripe *publishable* key (and it
doesn't even need that for hosted Checkout — it
just redirects to the `session.url`).

## Wiring (server side)

```js
const { createCheckout, stripePay,
  processorsFor } = require('./pay');
const { createLedger } = require('./ledger');

const ledger = createRuntime(
  createLedger(GENESIS_PUBKEY), { ... });

const checkout = createRuntime(
  createCheckout(), {
    processors: processorsFor(
      stripePay({
        secretKey: process.env.STRIPE_SECRET,
        webhookSecret:
          process.env.STRIPE_WH_SECRET,
        successUrl: 'https://.../paid',
        cancelUrl:  'https://.../cancel',
      }),
      ledger),
  });
```

`npm install stripe` on that server (the SDK is
lazy-required, so it is not a dependency of the
core suite).

## The flow, in HTTP terms

1. `POST /buy` → `checkout.dispatch({ type:
   'BuyTokens', account, cents, ref })`. The
   `pay/create` effect calls Stripe; read
   `checkout.getState().sessions[ref].url` and
   redirect the buyer there.
2. Buyer pays on Stripe's hosted page.
3. Stripe calls your webhook. Hand the RAW body
   and the `Stripe-Signature` header straight in:
   `checkout.dispatch({ type: 'PaymentWebhook',
   ref, raw, sig })`. The `pay/verify` effect
   runs `stripe.webhooks.constructEvent` — a bad
   signature becomes a `Rejected` fact, a good
   one becomes `Fulfilled` → `RecordPurchase` →
   `TokensMinted` in the ledger.

Do NOT trust the webhook body before
verification — that is exactly what `pay/verify`
enforces, and why the raw body (not a parsed
JSON) must be passed through.

## Seeding existing customers

Michael's Shopify emoji buyers ($14.28) already
earned tokens. Feed each past order in ONCE as a
`RecordPurchase` with `source: 'shopify'` and
`ref: 'shopify:<order-id>'`. The ledger's ref
dedup means re-running the import is safe — no
one gets minted twice.

## Anti-abuse already in place

- Two independent dedup guards on the backing
  ref (checkout `fulfilled` + ledger `refs`).
- Signature verification gates every mint.
- Genesis-humility: the founder wallet can never
  out-hold a player (enforced in `ledger.js`).
- Conservation: `sum(balances) == minted -
  burned`, always.

## Not built here

- The HTTP server itself (Express/Worker) — thin;
  it only dispatches the actions above.
- Refunds/chargebacks → a `Burned` fact against
  the buyer (a `charge.refunded` webhook maps to
  it); design, not yet coded.
- Choice of rail beyond Stripe (Solana wallet in
  `ledger.solana.md`; x402 still needs its docs
  verified — NEXT.md §6).
