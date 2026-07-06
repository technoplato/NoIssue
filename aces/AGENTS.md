# AGENTS.md — working in the `aces/` prototype

## What this is
**ACES** = **A**ction · **C**ommand · **E**vent · **S**ide-effect ·
**S**tate. An event-sourced engine: business logic is three pure
functions (`decide` / `evolve` / `react`); everything else (I/O, sync,
UI) is swappable around them.

## House rules
- **Line width:** keep source lines `<= ~50` columns so they fit a phone
  preview pane. 2-space indent. Deep nesting is a design smell — flatten
  or extract a helper rather than widening.
- **Define acronyms at the definition site.** The first time an acronym
  appears in a file, expand it in a comment right there. Examples:
  - `RPN` — Reverse Polish Notation
  - `TTS` — Text To Speech
  - `DHT` — Distributed Hash Table (Holepunch peer discovery)
  - `DO`  — Durable Object (Cloudflare stateful worker)
  - `DI`  — Dependency Injection
  Never assume the reader carries the expansion from another file.
- **Purity:** `evolve` is a pure left-fold — no clock, no random, no
  I/O. Same log ⇒ same state, always. Effects only ever come from
  `react`, and run behind injected processors.
- **The log is truth.** State is a cache you can drop and rebuild with
  `replay(log)`. Never store anything in state you cannot re-derive.
- **ACES letters are owned by an archetype.** A calculator `KEY` is
  meaningless to a store; a store `AddToCart` is meaningless to a
  calculator. Name events in the past tense (`ItemAddedToCart`), because
  an event is a fact that already happened.

## Adding an archetype
Write `<name>.js` exporting `{ machine }` to the contract in
`SPEC.md`. Add a `<name>-ui.js` ascii kit (atoms → screen) if it
renders. Prove it with a tiny inline `node -e` run. Do not edit
`core.js` — if you think you must, the seam is wrong.

## Run
```
node cli.js            # interactive calculator
node test.js           # core proofs (replay, effect-crash, converge)
node test-net.js       # multi-backend sync proofs
node sync-demo.js      # two nodes, one bus, live convergence
```
