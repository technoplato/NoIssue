/* ==============================================
 * PEAR.LIVE — real hypercore    (<=50 col house)
 * + hyperswarm, wired for actual replication.
 * ----------------------------------------------
 * pear.js was SHAPE ONLY. This is the same
 * { publish, subscribe } contract backed by the
 * real Holepunch stack, so multisync/mesh treat
 * it exactly like inMemorySync or instant.
 *
 * The model (honest, no autobase yet):
 *   - each node OWNS one writable HYPERCORE —
 *     its append-only event log. publish() =
 *     append. That log IS the source of truth,
 *     same doctrine as core.js.
 *   - a node REPLICATES peers' cores by key.
 *     Every block that lands (local append OR
 *     replicated from a peer) fires subscribe.
 *   - transport is pluggable: addStream(duplex)
 *     wires ANY duplex (a test stream pair, or
 *     a hyperswarm connection). joinSwarm()
 *     does the real DHT discovery on a host
 *     with UDP; addStream is what the test
 *     drives, so the replication is proven
 *     WITHOUT needing the network.
 *
 * HYPERCORE = append-only, signed, replicable
 * log.  HYPERSWARM = peer discovery over the
 * DHT (Distributed Hash Table).  DHT bootstrap
 * needs UDP, which some sandboxes block — hence
 * the split: cores replicate over any stream;
 * only joinSwarm() needs real UDP.
 *
 * Deps are lazy-required so this file still
 * LOADS on a Worker/phone where they can't run;
 * you only pay when you actually createNode().
 * ============================================ */

'use strict';

const os = require('os');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

function tmpStore() {
  return fs.mkdtempSync(
    path.join(os.tmpdir(), 'aces-pear-'));
}

// a stable topic from a human string, so peers
// that agree on a name find the same rendezvous
function topicOf(name) {
  return crypto.createHash('sha256')
    .update('aces:' + name).digest();
}

/* createNode(opts) -> a live Pear node.
 * opts:
 *   storageDir  where the writable core lives
 *               (default: a fresh temp dir)
 *   key         hex/Buffer of a peer core to
 *               follow read-only at start
 * Returns the { publish, subscribe } contract
 * plus the Pear-specific handles.
 */
async function createNode(opts) {
  opts = opts || {};
  const Hypercore = require('hypercore');

  const store = opts.storageDir || tmpStore();
  // our own writable log
  const own = new Hypercore(store);
  await own.ready();

  // every core we read from (ours + peers'),
  // keyed by hex so we never double-add one
  const cores = new Map();
  const subs = new Set();
  const swarms = [];

  // decode a stored block into an event object
  function decode(buf) {
    try { return JSON.parse(buf.toString()); }
    catch (e) { return { _raw: buf.toString() }; }
  }

  // fire subscribers for a single event
  function emit(ev) {
    subs.forEach(fn => fn(ev));
  }

  // watch a core: replay what it already holds,
  // then emit every future block (local append
  // or replicated from a peer) exactly once.
  // drain is guarded so overlapping triggers
  // (append / download / refresh) never double-
  // emit or race the cursor.
  async function watch(core) {
    const hex = core.key.toString('hex');
    if (cores.has(hex)) return;
    cores.set(hex, core);
    let cursor = 0, busy = false;
    async function drain() {
      if (busy) return;
      busy = true;
      try {
        while (cursor < core.length) {
          const buf = await core.get(cursor,
            { wait: true });
          cursor++;
          emit(decode(buf));
        }
      } finally { busy = false; }
    }
    core.drain = drain;
    core.on('append', drain);
    core.on('download', drain);
    await drain();
  }

  // learn every followed core's latest length
  // (replication won't emit until a reader core
  // is told to update), then drain each. Called
  // after any new stream connects.
  async function refresh() {
    for (const core of cores.values()) {
      if (!core.writable) {
        try { await core.update({ wait: true }); }
        catch (e) { /* peer not ready yet */ }
      }
      if (core.drain) await core.drain();
    }
  }

  await watch(own);

  // -- the contract -------------------------
  // publish: append a fact to our own log.
  async function publish(event) {
    await own.append(
      Buffer.from(JSON.stringify(event)));
    return event;
  }
  // subscribe: called for every event on every
  // core we follow. Returns an unsubscribe fn.
  function subscribe(fn) {
    subs.add(fn);
    return () => subs.delete(fn);
  }

  // -- peers --------------------------------
  const openStreams = new Set();

  // follow a peer's core by its public key
  async function follow(key) {
    const Hypercore = require('hypercore');
    const k = Buffer.isBuffer(key)
      ? key : Buffer.from(key, 'hex');
    if (cores.has(k.toString('hex'))) return;
    const rc = new Hypercore(tmpStore(), k);
    await rc.ready();
    await watch(rc);
    // mux this new core onto every open stream
    for (const s of openStreams)
      rc.replicate(s);
    return rc;
  }

  // Open ONE hypercore protocol stream that
  // carries ALL our cores, and return it. The
  // caller pipes it to a peer's matching stream
  // (a test stream pair, or a hyperswarm
  // connection — replication is identical).
  // hypercore.replicate(bool) mints the stream;
  // replicate(stream) muxes another core onto it.
  function addStream(isInitiator) {
    let stream = null;
    for (const core of cores.values())
      stream = stream
        ? (core.replicate(stream), stream)
        : core.replicate(isInitiator);
    if (!stream)
      stream = own.replicate(isInitiator);
    openStreams.add(stream);
    stream.on('close',
      () => openStreams.delete(stream));
    // once the pipe is live, learn peer lengths
    // and drain. A tick lets the caller pipe it.
    setTimeout(() => refresh(), 0);
    return stream;
  }

  /* joinSwarm(opts) — REAL DHT discovery.
   * Needs a UDP-capable host (node/bun on a
   * real network); it is a no-op-until-
   * connected elsewhere. Each connection is
   * just another duplex handed to addStream,
   * so replication is identical to the test.
   * opts: { name?, topic?, bootstrap? }
   */
  async function joinSwarm(o) {
    o = o || {};
    const Hyperswarm = require('hyperswarm');
    const swarm = new Hyperswarm(
      o.bootstrap ? { bootstrap: o.bootstrap }
        : {});
    // a swarm connection is already a protocol-
    // capable duplex; mux every core onto it.
    swarm.on('connection', conn => {
      openStreams.add(conn);
      for (const core of cores.values())
        core.replicate(conn);
      conn.on('close',
        () => openStreams.delete(conn));
    });
    const topic = o.topic ||
      topicOf(o.name || 'aces');
    swarm.join(topic,
      { server: true, client: true });
    await swarm.flush();
    swarms.push(swarm);
    return swarm;
  }

  async function close() {
    for (const s of swarms) await s.destroy();
    for (const c of cores.values())
      await c.close();
  }

  return {
    publish, subscribe,          // the contract
    follow, addStream, joinSwarm, // pear extras
    sync: refresh,   // catch up a followed peer
    close,
    key: own.key,                 // share this
    keyHex: own.key.toString('hex'),
  };
}

module.exports = { createNode, topicOf };
