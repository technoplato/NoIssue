/* ==============================================
 * MULTISYNC  —  many backends    (<=50 col house)
 * one shape. Sync to InstantDB AND Pear AND memory
 * at once. Same { publish, subscribe } interface,
 * so the mesh cannot tell it is talking to a crowd.
 * ----------------------------------------------
 * WRITE: fan the event to every backend. Each gets
 *   a timeout; a slow/dead backend cannot stall the
 *   others (allSettled + race-with-timeout).
 * READ:  subscribe to every backend, but DEDUP by
 *   event._id so the caller sees each fact once,
 *   whichever network delivered it first. That IS
 *   the consolidation: the fastest path wins, the
 *   rest are no-ops.
 * ============================================ */

'use strict';

function withTimeout(promise, ms, label) {
  let t;
  const timeout = new Promise((_, rej) => {
    t = setTimeout(() =>
      rej(new Error('timeout: ' + label)), ms);
  });
  return Promise.race([promise, timeout])
    .finally(() => clearTimeout(t));
}

// adapters: [{ name, sync }]  sync = {publish,subscribe}
function combineSync(adapters, opts) {
  opts = opts || {};
  const ms = opts.timeoutMs || 3000;
  const seen = new Set();          // dedup by _id
  const report = opts.onResult || (() => {});

  return {
    publish: async event => {
      const jobs = adapters.map(a =>
        withTimeout(
          Promise.resolve(a.sync.publish(event)),
          ms, a.name)
          .then(() => ({ name: a.name, ok: true }))
          .catch(e => ({ name: a.name,
            ok: false, err: e.message })));
      const results = await Promise.allSettled(jobs);
      const flat = results.map(r => r.value || r.reason);
      report(event._id, flat);
      return flat;                 // never throws
    },
    subscribe: cb => {
      const offs = adapters.map(a =>
        a.sync.subscribe(event => {
          if (seen.has(event._id)) return;
          seen.add(event._id);
          cb(event);
        }));
      return () => offs.forEach(off => off && off());
    },
  };
}

module.exports = { combineSync, withTimeout };
