/* ==============================================
 * DEPS  —  the controlled world  (<=50 col house)
 * ----------------------------------------------
 * The Point-Free "control the world" pattern, in
 * ~1 screen. One singleton bag of dependencies.
 * Each dependency is a struct of FUNCTIONS. Every
 * function has three faces:
 *   live          real I/O
 *   test          deterministic double
 *   unimplemented THROWS the moment it is called
 *
 * DEFAULT IS unimplemented. So in a test, any
 * side effect you did NOT explicitly wire up
 * crashes the test loudly instead of silently
 * doing nothing. You opt IN to each effect.
 *
 * Override is dynamic-scoped: withDeps({...}, fn)
 * swaps siblings in for the body of fn, restores
 * after. No globals leak between tests.
 * ============================================ */

'use strict';

// a function that fails if ever reached
function unimplemented(label) {
  return () => {
    throw new Error(
      'unimplemented dependency: ' + label);
  };
}

// the singleton. Effectful deps start unwired.
const Deps = {
  clock: {
    now: () => Date.now(),
  },
  speak: {                       // calculator tts
    say: unimplemented('speak.say'),
  },
  notify: {                      // store receipts
    send: unimplemented('notify.send'),
  },
  sync: {                        // instantdb-shaped
    publish: unimplemented('sync.publish'),
    subscribe: unimplemented('sync.subscribe'),
  },
};

// run `fn` with sibling overrides merged in, then
// put the originals back — even if fn throws.
async function withDeps(overrides, fn) {
  const keys = Object.keys(overrides);
  const saved = {};
  for (const k of keys) {
    saved[k] = Deps[k];
    Deps[k] = { ...Deps[k], ...overrides[k] };
  }
  try { return await fn(Deps); }
  finally {
    for (const k of keys) Deps[k] = saved[k];
  }
}

// build ACES effect processors from whatever deps
// are live right now. The runtime calls these;
// they just forward to the injected functions.
function processorsFromDeps(d) {
  d = d || Deps;
  return {
    speak: async fx =>
      (d.speak.say(fx.text), []),
    notify: async fx =>
      (d.notify.send(fx.text), []),
    'effect/unhandled': async () => [],
  };
}

module.exports = {
  Deps, withDeps, unimplemented,
  processorsFromDeps,
};
