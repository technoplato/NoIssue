/* ==============================================
 * WORLD  —  many instances       (<=50 col house)
 * ----------------------------------------------
 * One runtime is one device/app instance. The
 * World is a registry so a URI can name WHOSE
 * calculator and WHICH one:
 *
 *   aces://<user>/calc/<id>/<field>
 *
 * e.g. aces://ren/calc/main/value
 *      aces://mishka/calc/scratch/display
 *
 * The World routes to the right runtime, then
 * lets that machine resolve the trailing field.
 * ============================================ */

'use strict';

const { createRuntime } = require('./core');

function createWorld(archetypes, opts) {
  const insts = new Map();       // key -> runtime
  const key = (u, kind, id) => u + '/' + kind + '/' + id;

  function spawn(user, kind, id) {
    const a = archetypes[kind];
    if (!a) throw new Error('no archetype: ' + kind);
    const rt = createRuntime(a.machine, opts);
    insts.set(key(user, kind, id), rt);
    return rt;
  }
  function of(user, kind, id) {
    const k = key(user, kind, id);
    return insts.get(k) || spawn(user, kind, id);
  }

  // aces://<user>/<kind>/<id>/<field...>
  function resolve(uri) {
    const m = uri.replace(/^aces:\/\//, '').split('/');
    const [user, kind, id] = m;
    const rt = insts.get(key(user, kind, id));
    if (!rt) throw new Error('no instance: ' + uri);
    return rt.resolve(uri);
  }

  return { of, spawn, resolve,
    keys: () => [...insts.keys()] };
}

module.exports = { createWorld };
