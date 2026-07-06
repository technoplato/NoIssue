/* ==============================================
 * A C E S  —  core runtime      (<=50 col house)
 * Action Command Event Sideeffect State
 * ----------------------------------------------
 * World pushes ACTIONS in. A pure DECIDER turns
 * (state,action) into EVENTS (facts). A pure
 * EVOLVER folds each event into new STATE. A
 * pure REACTOR reads each event and asks for
 * EFFECTS (I/O). Effects run on their own
 * channel; what they learn returns as events.
 *
 * Nothing here touches net, disk, clock, screen.
 * That all lives behind EFFECT PROCESSORS. Swap
 * processors -> same logic runs client or server.
 *
 *   actions in                     effects out
 *       |                              ^
 *       v                              |
 *   DECIDE --events--> EVOLVE      REACT
 *   (s,a)->e[]         (s,e)->s     (s,e)->f[]
 *                         |            |
 *                     new state    PROCESSOR
 *                                  (tts,http..)
 *
 * The LOG is truth. State is a cache: a left
 * fold of evolve over every event. Drop state,
 * replay the log, you are exactly back.
 * ============================================ */

'use strict';

// machine = {
//   initial,               starting state
//   decide(s,a) -> e[]     action  -> events
//   evolve(s,e) -> s       event   -> state
//   react (s,e) -> f[]     event   -> effects
//   resolve(s,uri) -> val  address -> value
//   render(s)   -> string  state   -> ascii
// }

function createRuntime(machine, opts) {
  opts = opts || {};
  const procs = opts.processors || {};
  const nodeId = opts.nodeId || 'n0';
  const log = [];              // append-only facts
  const seen = new Set();      // event ids we hold
  let state = machine.initial;
  const subs = new Set();
  const react = machine.react || (() => []);
  const now = opts.now || (() => Date.now());

  // fold one event, notify, return its effects.
  // an event carries identity (_id) and origin
  // (_origin = the node that first decided it) so
  // sync can dedup and avoid echo loops.
  function commit(ev) {
    const seq = log.length;
    const e = {
      ...ev, _seq: seq,
      _at: ev._at || now(),
      _id: ev._id || nodeId + ':' + seq,
      _origin: ev._origin || nodeId,
    };
    log.push(e);
    seen.add(e._id);
    state = machine.evolve(state, e);
    subs.forEach(fn => fn({ t: 'event', e, state }));
    return react(state, e) || [];
  }

  // run an effect; feed its output back as events
  async function runEffect(fx) {
    const p = procs[fx.type];
    if (!p) {                  // no processor here?
      await pump([{ type: 'effect/unhandled', fx }]);
      return;                  // honest: record it happened
    }
    subs.forEach(fn => fn({ t: 'effect', fx }));
    const out = (await p(fx, api)) || [];
    await pump(out);
  }

  // drive events, then chase the effects they spawn
  async function pump(events) {
    const fx = [];
    for (const e of events) fx.push(...commit(e));
    await Promise.all(fx.map(runEffect));
  }

  // the one public verb: push action, settle state
  async function dispatch(action) {
    await pump(machine.decide(state, action) || []);
    return state;
  }

  function resolve(uri) {
    if (!machine.resolve)
      throw new Error('no resolver: ' + uri);
    return machine.resolve(state, uri);
  }

  // ingest a fact decided ELSEWHERE (a remote
  // node). No decide step — it already happened.
  // Dedup by _id so replays and echoes are no-ops.
  async function ingest(event) {
    if (seen.has(event._id)) return state;
    await pump([event]);
    return state;
  }

  const getState = () => state;
  const api = { dispatch, resolve, getState };

  return {
    dispatch, ingest, resolve, getState, nodeId,
    getLog: () => log.slice(),
    render: () => machine.render
      ? machine.render(state)
      : JSON.stringify(state, null, 2),
    subscribe: fn => (subs.add(fn),
      () => subs.delete(fn)),
    // rebuild state from a log of facts alone
    replay: events => {
      state = machine.initial;
      log.length = 0;
      for (const e of events) {
        log.push(e);
        state = machine.evolve(state, e);
      }
      return state;
    },
  };
}

module.exports = { createRuntime };
