# ACES

**A**ction · **C**ommand · **E**vent ·
**S**ide-effect · **S**tate — an event-sourced
engine where the business logic is three pure
functions and everything else is swappable
around them.

- `decide(state, action) -> events[]` — the
  only judge of validity. Refusals are facts
  (`Rejected`), never throws.
- `evolve(state, event) -> state` — a pure
  left-fold. **The log is truth; state is a
  cache** you can drop and rebuild.
- `react(state, event) -> effects[]` — asks
  for a side-effect, never performs it. A
  **dependency** (an injected processor) does
  the effect; its result re-enters as an event.
  Swap the dependency and the same logic runs
  in a browser, on Node, or on a server.

## Branches (what's merged, what isn't)

Updated 2026-07-06.

| Branch | What it is | Merged to `main`? |
|---|---|---|
| `main` | releases; what GitHub Pages deploys | — |
| `claude/aces-engine-architecture-pqbmyu` | all engine + archetype + arcade + Solana work | ✅ merged here |
| `claude/human-ai-detection-game-9q4nnb` | first agent's original ACES work (engine, calculator, store, conversation) | ✅ (via the branch above) |
| `claude/aces-coordination` | the agents' append-only mailbox (`PROTOCOL.md`) | ⛔ intentionally not merged — it's meta, not product |

## Live

**https://technoplato.github.io/NoIssue/aces/**
— the arcade: calculator + corner store + token
ledger + settings, running the very modules in
[`aces/`](aces/) unbundled (view-source is the
program), with a live event tape and a
drop-state-and-replay button.

## What's live, what isn't

Honest status — the full breakdown, with the
"why", is in [`SUMMARY.md`](SUMMARY.md).

| Thing | Access | Live? |
|---|---|---|
| The arcade (UI) | [technoplato.github.io/NoIssue/aces/](https://technoplato.github.io/NoIssue/aces/) | 🟡 deploys from `main` (this merge) |
| Root landing page | [technoplato.github.io/NoIssue/](https://technoplato.github.io/NoIssue/) | ✅ yes |
| Standalone build | [`aces/deploy/aces-arcade-standalone.html`](aces/deploy/aces-arcade-standalone.html) | ✅ open from `file://` |
| Engine + all archetypes | `cd aces && npm test` (119 checks) | ✅ yes |
| Token ledger | arcade → LEDGER | ⚠️ in-memory only |
| Voice assistant | arcade → voice chip | ⚠️ needs on-device LLM; else `off` |
| InstantDB sync | `aces/sync.js` | ⚠️ adapter ready, **not wired live** |
| Pear / Holepunch P2P | `aces/pear.live.js` | ⚠️ real hypercore replication proven; DHT needs a UDP host |
| Stripe payments (fiat) | [`aces/pay.stripe.md`](aces/pay.stripe.md) | ⚠️ built + tested; needs a live key + server |
| Solana program (crypto) | [`aces/solana/`](aces/solana/) | ⚠️ written + tested; runs on a toolchain host |
| x402 / Cloudflare rail | [`aces/ledger.solana.md`](aces/ledger.solana.md) | ❌ not started |

## Layout

- [`aces/`](aces/) — engine, archetypes,
  tests (`cd aces && npm test`), SPEC and
  roadmap (`NEXT.md`).
- [`SUMMARY.md`](SUMMARY.md) — dated state of
  the project; [`AGENTS.md`](AGENTS.md) — how
  agents coordinate + house rules.
- `claude/aces-coordination` branch — the
  append-only mailbox two AI agents use to
  split this work without colliding
  (`PROTOCOL.md` there).
- [`archive/hackathon-2023/`](archive/hackathon-2023/)
  — 🏆 the XState Orlando Devs Hackathon
  winner (Jan 2023) that used to live at this
  repo's root. Preserved, not maintained.
