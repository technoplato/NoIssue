# ACES — state of the project

**As of 2026-07-06.** A snapshot of what is
built, what is genuinely live, what is only
designed, and what is next. Written to be
honest: the "Status" column below does not
round up.

---

## What ACES is

**A**ction · **C**ommand · **E**vent ·
**S**ide-effect · **S**tate. An event-sourced
engine where the business logic is three pure
functions — `decide` (judge an action → facts),
`evolve` (fold facts → state), `react` (ask for
I/O) — and everything else (storage, network,
screen, payments) is a swappable dependency
around them. **The log is truth; state is a
cache** you can drop and rebuild by replaying
the log. Refusals are facts too (`Rejected`),
never silent drops.

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
| **The arcade** (browser UI) | real engine, unbundled, event tape, replay | 🟡 **Deploying** | see "Deployment" below |
| **InstantDB sync** | live cloud sync adapter | ⚠️ **Adapter ready, NOT wired live** | see below |
| **Pear / Holepunch P2P** | peer-to-peer sync | ❌ **Shape only, not live** | see below |
| **Money / payments** | Stripe / Solana / x402 | ❌ **None real yet** | see below |
| **Solana contract** | on-chain ledger | ❌ **Designed, not written** | see below |

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
No. `pear.js` implements the `{publish,
subscribe}` **shape** so `multisync` can treat it
like any other backend, but it is not wired to a
real hypercore + hyperswarm. It lazy-requires the
Holepunch deps and has never touched a live swarm.
It is a documented seam, not a running peer.

**Is there any money support?**
No real money moves anywhere. The token
**ledger** (`ledger.js`) is a fully working
event-sourced ledger with mechanical fairness
laws (no unbacked mints, conservation, no
negatives, genesis-humility), and it correctly
computes the $14.28 Shopify seed → 142,800 tokens.
But it is **in-memory only** — no Stripe, no
Solana, no x402 (Cloudflare HTTP-402) is
connected. Tokens are ledger units, not money.

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

- **Root site** — `https://technoplato.github.io/NoIssue/`
  — **live** (currently the landing page linking
  to the arcade and the archived hackathon app).
- **The arcade** — `https://technoplato.github.io/NoIssue/aces/`
  — goes live when this work lands on **`main`**.
  The GitHub Pages *environment* only permits
  deploys from `main`; the two earlier deploy runs
  from the feature branch were correctly blocked by
  that policy. Merging to main clears the gate.
- **Offline / CSP'd hosts** — a single self-
  contained file,
  [`aces/deploy/aces-arcade-standalone.html`](aces/deploy/aces-arcade-standalone.html),
  inlines every module (built by
  `node aces/deploy/build-artifact.js`). Works
  from `file://` with no server.

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
