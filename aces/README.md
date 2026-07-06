# ACES

**A**ction · **C**ommand · **E**vent · **S**ide-effect · **S**tate.

An event-sourced engine whose whole business logic is three pure
functions, and everything else (I/O, sync, UI) is swappable around
them. Runs isomorphically on a client or a server: change the
processors, keep the logic.

## The one shape

A `machine` is a pure object:

```
machine = {
  initial,            // starting state
  decide(s, action),  // -> events[]   (the only validity judge)
  evolve(s, event),   // -> state      (pure left-fold)
  react(s, event),    // -> effects[]  (asks for I/O, never does it)
  resolve(s, uri),    // -> value      (address any morsel of state)
  render(s),          // -> ascii
}
```

- **decide** is the only place an action is judged worthy of becoming
  a fact. Reject by returning `[]` (or a `Rejected` fact).
- **evolve** is a pure fold. Same log => same state, always. No clock,
  no random, no I/O.
- **react** asks for effects; the runtime runs them behind injected
  processors and feeds results back in as events.
- The **event log is truth**; state is a cache you can throw away and
  rebuild with `replay(log)`.

## Files

| file | what |
|---|---|
| `core.js` | the runtime (decide/evolve/react, log, replay, ingest) |
| `calculator.js` | archetype: a TI-8x, eager expression + precedence |
| `store.js` | archetype: a corner shop (cart/inventory/checkout) |
| `ui.js`, `store-ui.js` | ascii component kits (atoms -> screen) |
| `world.js` | multi-instance URI addressing (`aces://user/kind/id/field`) |
| `deps.js` | controlled dependency world (Point-Free style, `unimplemented`) |
| `sync.js` | InstantDB-shaped sync: in-memory + live-admin adapters |
| `pear.js` | Holepunch/Pear (hypercore) sync adapter |
| `multisync.js` | fan writes to many backends w/ timeouts; dedup reads |
| `mesh.js` | wire a runtime to a sync backend (publish out, ingest in) |
| `platform.js` | runtime diagnostic: node/bun/worker/durable/rn/web |
| `cli.js` | the thin harness: send actions, observe state |
| `test.js`, `test-net.js` | proofs (replay, effect-crash, convergence) |

## Run

```
cd aces
node cli.js                 # interactive calculator
node cli.js 2 + 3 '*' 4 =   # batch
node test.js                # core proofs
node test-net.js            # multi-backend sync proofs
node sync-demo.js           # two nodes, one bus, live convergence
```

## House style

Source lines kept `<= ~50` columns so they fit a phone preview pane.
Deep nesting is treated as a design smell — flatten or extract rather
than widen.

_Prototype, 2026-07-06._
