# NEXT — roadmap (updated 2026-07-06)

## Done so far ✅

1. **Event versioning + SemVer** — `version.js` (9/9).
2. **Platform declarative enum** — `platform.js` (20/20).
3. **One view spec → ascii/React/RN** — `view.js` (11/11).
4. **Nav + settings as folded state** — `nav.js`,
   routes are a parser-printer `parse.js` (18+12).
5. **Parser-printers** — `parse.js` (parse ↔ print laws).
6. **Token ledger** — `ledger.js` (12/12), fairness laws.
7. **Voice assistant** — `assistant.js` + `llm.js` (8/8),
   senses (LLM/speech) modeled as dependencies.
8. **Pear live** — `pear.live.js` (4/4): REAL hypercore
   replication proven; DHT discovery needs a UDP host.
9. **Stripe payments** — `pay.js` (10/10): a charge is a
   side-effect behind a `pay` dependency; verified
   webhooks mint via the ledger.
10. **Solana program** — `solana/…/ledger.solana.rs` +
    canonical Anchor localnet test; the on-chain twin of
    `ledger.js`. Builds/runs on a normal toolchain host.
11. **The arcade** — browser UI running the real engine
    unbundled; standalone single-file build too.

Total: **123 checks green** (119 core + 4 Pear).

## Still to do

- **Wire it all to live sync.** InstantDB adapter is
  ready (`sync.js`) but not wired into a running host;
  keep the admin token server-side. Pear needs a
  UDP-capable box to discover peers.
- **Payments go-live.** Provision a real Stripe key +
  a tiny server + webhook (see `pay.stripe.md`), OR go
  Solana-first and let wallets pay the program directly
  (no server). x402/Cloudflare is a later fiat option —
  VERIFY its docs before building.
- **Deploy Solana** to devnet/mainnet from a host with
  the toolchain (the sandbox proxy blocks the SBF
  platform-tools download).
- **Default mobile apps** (Notes, Reminders) with a
  first-class cross-app **tag** entity — model tags
  once, link many; build the shared schema FIRST.
- The original detail for the remaining items follows.

---

## Original roadmap (for reference)

## 1. Event versioning + package.json-driven rule handlers
Every event carries a `v` (schema version). The rules that fold a given
version live behind a version→handler map. Enforced **SemVer**
(Semantic Versioning):
- `package.json#version` is the single source of truth for "current
  version".
- Code reads that version and asserts a handler EXISTS for every
  version from `1` up to current. Missing one = **build error**, not a
  runtime surprise.
- If `package.json` is more than a **minor** bump above what the code
  can handle, that is also a build error (you skipped a migration).
- A `migrate(event)` chain upgrades an old event to the current shape
  before `evolve` sees it, so replay of an ancient log still folds.
Peers exchange their version; the lower version drives until both
upgrade. Write this as a small, well-tested module — it is the spine of
long-lived logs.

## 2. Platform as a declarative nested enum
Model the runtime as a recursive tree of `type → subtype → … → leaf`,
declared as data, not `if` ladders. Sketch:
```
platform:
  web:        [ react, svelte, plain-html ]   # by transitive deps
  serverless: [ cloudflare-worker, gcp, firebase-fn ]
  runtime:    [ node, bun, deno ]
  native:     [ react-native ]
```
Each leaf declares its capabilities (can it run `@instantdb/admin`? a
Holepunch swarm? only memory?). `platform.js` today is the flat first
draft; promote it to this declarative tree and derive `recommend()`
from the leaf's capabilities. **ENUM** here means a closed, exhaustive
set — the compiler/tests should fail if a leaf is unhandled.

## 3. One view spec → React, React Native, and ASCII
Goal: render the same store-state to three targets from one source.
Path forward: the ascii kits (`ui.js`, `store-ui.js`) already prove
`state → view-tree → string`. Generalize the middle: components return a
neutral **view node** (`{ kind, props, children }`), and three thin
backends walk it — `toAscii`, `toReact`, `toReactNative`. That neutral
node IS the DSL (Domain-Specific Language); start it minimal (box, text,
row, button) and grow only as screens demand.

## 4. Navigation + settings as addressable state
Right now the arcade shell holds `nav` and `settings` as plain vars.
Promote them into a real archetype whose state includes the current
screen, addressable by URI: `aces://<user>/device/<id>/screen`. A
setting (glyph size, sound) becomes folded state, so it syncs and
replays like everything else. The arcade HTML is the throwaway sketch of
this.

## 5. Default mobile apps as archetypes (cross-app tags)
Build each to SPEC.md with InstantDB sync: **Notes** (folders/files,
nesting, tags), **Reminders** (lists, nesting, tags). Skip Photos and the
web browser for now; calculator is done. KEY shared design: **tags are a
first-class cross-app entity** — a tag applied in Notes is the same tag
seen in Reminders. Model tags once, link many. Build the shared tag/entity
schema FIRST, then the apps, so they stay consistent. Good candidates for
parallel subagents once the shared schema exists.

## 6. Digital store with payments
Extend the store archetype to host and sell things. "Cloudflare's new
payment protocol" — likely agentic HTTP-402 (x402). VERIFY current
details against the docs before building; do not assume.

## 7. Live sync (when we leave local)
- InstantDB: provision via `getadb.com/provision/<uuid>` (fresh UUID
  each time), then inject `instantAdminSync({appId, adminToken})`.
  UUID = Universally Unique Identifier.
- Pear/Holepunch: wire `pearSync` to a real hypercore + hyperswarm on
  node/bun. `multisync.combineSync([...])` already fans writes to both
  with per-backend timeouts and dedups reads — that stays unchanged.
