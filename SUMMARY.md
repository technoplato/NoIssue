# ACES — state of the project

**As of 2026-07-06.** A snapshot of what is
built, what is genuinely live, what is only
designed, and what is next. Written to be
honest: the "Status" column below does not
round up.

## Contents

- [What ACES is](#what-aces-is)
- [Effects vs. dependencies (the precise
  language)](#effects-vs-dependencies-the-precise-language)
- [The honest status table](#the-honest-status-table)
- [Direct answers to the questions asked](#direct-answers-to-the-questions-asked)
- [Deployment](#deployment)
- [Next steps](#next-steps)
- [How two agents built this in
  parallel](#how-two-agents-built-this-in-parallel)

---

## What ACES is

**A**ction · **C**ommand · **E**vent ·
**S**ide-effect · **S**tate. An event-sourced
engine where the business logic is three pure
functions — `decide` (judge an action → facts),
`evolve` (fold facts → state), `react` (ask for
side-effects) — wrapped by swappable
**dependencies** that actually perform those
effects. **The log is truth; state is a cache**
you can drop and rebuild by replaying the log.
Refusals are facts too (`Rejected`), never
silent drops.

## Effects vs. dependencies (the precise language)

An earlier draft called "storage, network,
screen, payments" *dependencies*. That blurred
two different things — here is the sharp version:

- A **side-effect** is an *act on the outside
  world*: persist to storage, publish over the
  network, render to a screen, **charge a card**.
  `react(state, event)` only ever *names* the
  effect it wants; it never performs it.
- A **dependency** is the *swappable thing that
  performs* that effect — a **processor** with
  three faces (`live` / `test` / `unimplemented`,
  see `deps.js`). The dependency is what you
  swap to move the same logic between a browser,
  a server, and a test.
- The result of an effect **re-enters as an
  event**, so the log stays the whole story.

So: **dependencies cause the side-effects.**
Storage/network/screen/payments are *categories
of effect*; each is carried out by a dependency
you inject. Payments is the newest one — a Stripe
charge is a side-effect behind a `pay` dependency,
and its confirmation re-enters the ledger as a
`RecordPurchase` fact.

Everything lives under [`aces/`](aces/) and runs
on plain Node with no dependencies:
`cd aces && npm test` → **109 checks green**
across 10 suites.

---

## The honest status table

| Piece | What it is | Status | Where |
|---|---|---|---|
| **Engine core** (`core.js`) | decide/evolve/react, log, replay, ingest | ✅ **Works** | `aces/core.js`, proven by tests |
| **Calculator** archetype | TI-8x, shunting-yard precedence | ✅ **Live in arcade** | arcade → CALC |
| **Store** archetype | cart/inventory/checkout, refusals as facts | ✅ **Live in arcade** | arcade → STORE |
| **Navigation + settings** | screen is folded state; routes are a parser-printer | ✅ **Live in arcade** | arcade → tabs / SETTINGS |
| **Token ledger** (`ledger.js`) | mint/transfer/burn with fairness laws | ⚠️ **Works in-memory only** | arcade → LEDGER |
| **Voice assistant** (`assistant.js`) | talk-to-the-arcade via on-device LLM | ⚠️ **Degrades gracefully** | arcade → voice chip |
| **Parser-printers** (`parse.js`) | one spec parses *and* prints | ✅ **Works** | tests only (used by nav) |
| **Platform enum** (`platform.js`) | declarative runtime tree | ✅ **Works** | arcade → PLATFORM |
| **Event versioning** (`version.js`) | enforced SemVer, migrations | ✅ **Works** | every arcade event tagged `v1.0` |
| **The arcade** (browser UI) | real engine, unbundled, event tape, replay | 🟡 **Built, not deployed** | see "Deployment" below |
| **InstantDB sync** | live cloud sync adapter | ⚠️ **Adapter ready, NOT wired live** | see below |
| **Pear / Holepunch P2P** | peer-to-peer sync | ⚠️ **Real hypercore replication proven; DHT discovery needs a UDP host** | `aces/pear.live.js` |
| **Stripe payments** | buy game tokens | ⚠️ **Integration built + tested with doubles; needs a live key + server** | `aces/pay.js`, `aces/pay.stripe.md` |
| **Solana contract** | on-chain ledger | ❌ **Designed, not written** | `aces/ledger.solana.md` |

Legend: ✅ works & proven · 🟡 in progress ·
⚠️ partial / caveated · ❌ not yet.

---

## Direct answers to the questions asked

**Is InstantDB actually live?**
No — not in the deployed arcade. The adapter
(`instantAdminSync` in `sync.js`) exists and was
round-trip verified from Node against a throwaway
Instant app. But the live site runs the
**in-memory** sync only, because the admin token
is a secret that must never ship to a browser.
So: the plumbing is real and tested; the deployed
page does not use it. The cross-device "magic
trick" (a local HTML page + the agent reading it
back via the admin SDK) did work, from Node.

**Is Pear (Holepunch) actually live?**
Partly, and this is new. `pear.live.js` now wires
the **real** Holepunch stack, not just a shape:
two nodes replicate events over genuine
**hypercore** (append-only signed logs), proven
in `pear.live.test.js` (4/4) — a fact published on
one node arrives on another by real replication,
no mock. The **hyperswarm/DHT discovery** half is
real code too, but needs a **UDP-capable host**
(node/bun on a real network); this sandbox blocks
UDP, so peer *discovery* wasn't exercised here —
the replication was, over a stream pair (exactly
what a swarm connection carries). So: replication
is live and proven; automatic peer-finding runs on
Michael's machine, not in CI.

**Is there any money support?**
Now there's a real integration path, though no
live charge has run. `pay.js` models payments the
ACES way — a charge is a **side-effect** behind a
swappable `pay` **dependency**; a *verified*
Stripe webhook re-enters the **ledger** as a
`RecordPurchase`, minting tokens ($5 → 50,000 at
100 tokens/cent). Proven end-to-end in
`pay.test.js` (10/10) against a scripted double:
paid webhooks mint, forged signatures are
rejected, double-spends refused twice over. Going
live needs a Stripe secret key + a small server +
a webhook endpoint — all documented in
[`aces/pay.stripe.md`](aces/pay.stripe.md). No key
is in the repo. The underlying **ledger**
(`ledger.js`) is still in-memory and enforces the
fairness laws (no unbacked mints, conservation, no
negatives, genesis-humility); it correctly
computes the $14.28 Shopify seed → 142,800 tokens.
Solana and x402 rails are not connected.

**Is the Solana contract ready?**
No. There is a complete **design document**
([`aces/ledger.solana.md`](aces/ledger.solana.md))
mapping the JS ledger onto an Anchor program
(PDA-per-account, PDA-per-ref for double-mint
protection, `emit!` events, oracle-signed
minting, a cluster/identity test matrix). No
Rust has been written; this container has `cargo`
but no `solana-cli`/`anchor-cli`, so it must be
built and validator-tested in a session that has
the toolchain.

---

## Deployment

**The arcade is not live yet, and the ACES work
is deliberately kept OFF `main`** (Michael's
call — do not merge to main without his explicit
say-so). What that means concretely:

- **Root site** — `https://technoplato.github.io/NoIssue/`
  — still the old Jekyll render of the hackathon
  README; unchanged.
- **The arcade** — `https://technoplato.github.io/NoIssue/aces/`
  — **not deployed.** GitHub Pages' `github-pages`
  environment only permits deploys from `main`, so
  the deploy workflow cannot publish from the
  feature branch. A brief merge-to-main was made
  and then reverted (main is back at its prior
  commit); the deploy never actually succeeded, so
  nothing was ever served. Re-deploying is a
  decision for Michael: either allow the feature
  branch in the Pages environment settings, or
  merge to main when he's ready.
- **Offline / CSP'd hosts (works today)** — a
  single self-contained file,
  [`aces/deploy/aces-arcade-standalone.html`](aces/deploy/aces-arcade-standalone.html),
  inlines every module (built by
  `node aces/deploy/build-artifact.js`). Open it
  from `file://` — no server, no deploy needed.

The deploy workflow
(`.github/workflows/deploy-aces-pages.yml`) runs
the full test suite as a gate before publishing.

---

## Next steps

1. **Land on main → arcade live.** (this change)
2. **Wire InstantDB for real** on a server/agent
   host (keep the admin token server-side; the
   browser uses only the public app id).
3. **Solana**: write `ledger.solana.rs` (Anchor)
   from the design doc, run the shared scenario
   table on localnet, ship the reactive client.
4. **Pear live**: wire `pearSync` to a real
   hypercore + hyperswarm on node/bun.
5. **Payments**: verify x402 / choose Stripe vs
   Solana rail; connect it to the ledger's
   `RecordPurchase`.
6. Roadmap detail lives in [`aces/NEXT.md`](aces/NEXT.md).

---

## How two agents built this in parallel

See [`AGENTS.md`](AGENTS.md) — a TCP-style
coordination protocol on an append-only mailbox
branch (`claude/aces-coordination`) let two agents
split the work with zero merge conflicts.
