# ACES contract  (build archetypes to this)

House style: source lines <= ~50 cols so they
fit phone preview panes. 2-space indent. If
nesting gets deep, that is a design smell — flatten
or extract, don't widen.

## The one shape

A machine is a pure object:

    machine = {
      initial,              // starting state
      decide(s, action),    // -> events[]
      evolve(s, event),     // -> state
      react(s, event),      // -> effects[]  (opt)
      resolve(s, uri),      // -> value       (opt)
      render(s),            // -> string      (opt)
    }

Rules:
- decide is the ONLY judge of validity. Reject
  a bad action by returning []. No throwing.
- evolve is a pure left-fold. Same log => same
  state, always. No I/O, no Date.now, no random.
- react asks for EFFECTS; it never performs them.
- effects run in core via `processors[type]`, and
  whatever they return re-enters as events.
- state is a CACHE. The event LOG is truth.

## ACES letters are OWNED by an archetype

Actions/commands/events must name things that
exist IN that archetype's world.
- calculator: KEY -> KeyPressed / Evaluated ...
- store:      AddToCart -> ItemAddedToCart ...
A "KEY" event in a store is a category error.

Command vs Event:
- ACTION  = imperative from the outside (a tap).
- COMMAND = an imperative the system issues to
  ITSELF (e.g. store: "ReserveInventory"), still
  goes through decide->events. Model it when an
  event must trigger further internal intent.
- EVENT   = a fact that already happened (past
  tense names: ItemAddedToCart, not AddItem).

## URIs
Local:  <kind>://<field>          calc://value
Global: aces://<user>/<kind>/<id>/<field>
        aces://ren/calc/main/value
World layer (world.js) routes to the instance;
the machine resolves the trailing field.

## Adding an archetype
Build `<name>.js` exporting { machine } to this
contract. Entities own their vocabulary. Events
past-tense. Optional `render(state)` in the same
ascii-kit spirit as ui.js (atoms -> screen). Keep
every source line <= ~50 cols. Do NOT edit
core.js — if you must, the seam is wrong.
