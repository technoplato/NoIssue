/* ==============================================
 * SYNC  —  instantdb-shaped     (<=50 col house)
 * ----------------------------------------------
 * We do NOT hard-depend on InstantDB. We depend
 * on its SHAPE:  { publish(event), subscribe(cb) }
 * Inject a real one in prod, a fake in tests.
 *
 * Model (v0): everything is PUBLIC. Every event
 * is broadcast to every node. A node ingests any
 * event it has not seen, skipping its own echoes
 * via event._origin. Ordering is best-effort;
 * real vector clocks come later. Keep it simple.
 *
 * Two adapters, one shape:
 *   inMemorySync(bus)      offline / test / demo
 *   instantAdminSync(cfg)  live @instantdb/admin
 * ============================================ */

'use strict';

// ---- a shared in-process bus (many nodes) ------
// This is the "network" for local multi-node demos
// and offline mode. It just keeps a public log and
// fans new events out to every listener.
function createBus() {
  const log = [];
  const listeners = new Set();
  return {
    log,
    push(event) {
      log.push(event);
      listeners.forEach(fn => fn(event));
    },
    on(fn) { listeners.add(fn); return () =>
      listeners.delete(fn); },
  };
}

// ---- adapter: in-memory (offline/test/demo) ----
function inMemorySync(bus) {
  return {
    publish: event => bus.push(event),
    subscribe: cb => {
      // replay backlog, then stream live
      for (const e of bus.log) cb(e);
      return bus.on(cb);
    },
  };
}

// ---- adapter: live InstantDB admin (prod) ------
// Lazy-requires @instantdb/admin so this file
// loads fine when the package is absent. Wire your
// appId + adminToken to go live. This is the SHAPE;
// namespace/query names are placeholders to confirm
// once we read the instant admin docs/submodule.
function instantAdminSync(cfg) {
  let db;
  function open() {
    if (db) return db;
    let init;
    try { init = require('@instantdb/admin').init; }
    catch (e) {
      throw new Error(
        'install @instantdb/admin to go live');
    }
    db = init({
      appId: cfg.appId,
      adminToken: cfg.adminToken,
    });
    return db;
  }
  return {
    publish: async event => {
      const d = open();
      await d.transact(
        d.tx.events[event._id].update({
          json: JSON.stringify(event),
          origin: event._origin,
          at: event._at,
        }));
    },
    subscribe: cb => {
      const d = open();
      return d.subscribeQuery(
        { events: {} },
        res => {
          const rows = (res.data &&
            res.data.events) || [];
          for (const r of rows)
            cb(JSON.parse(r.json));
        });
    },
  };
}

module.exports = {
  createBus, inMemorySync, instantAdminSync,
};
