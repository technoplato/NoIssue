/* ==============================================
 * PEAR  —  holepunch-shaped      (<=50 col house)
 * ----------------------------------------------
 * P2P sync over Holepunch (the Pear runtime).
 * Events are an append-only log = a HYPERCORE;
 * many writers merge via AUTOBASE; peers find each
 * other on the DHT via HYPERSWARM. We depend only
 * on the { publish, subscribe } SHAPE, same as
 * instant + memory, so multisync treats all three
 * identically.
 *
 * P2P = Peer To Peer.  DHT = Distributed Hash
 * Table (how peers discover each other).
 *
 * Lazy-requires the holepunch deps so this file
 * loads on a Worker or a phone where they cannot
 * run. Wire a real store + swarm on node/bun.
 * This is the seam, confirmed against the pear
 * docs when we install the toolchain.
 * ============================================ */

'use strict';

// cfg: { topic, storageDir, bootstrap? }
function pearSync(cfg) {
  cfg = cfg || {};
  let core, swarm;

  function open() {
    if (core) return core;
    let Hypercore, Hyperswarm;
    try {
      Hypercore = require('hypercore');
      Hyperswarm = require('hyperswarm');
    } catch (e) {
      throw new Error(
        'install hypercore + hyperswarm ' +
        'to use pear sync');
    }
    core = new Hypercore(
      cfg.storageDir || './.pear-aces');
    swarm = new Hyperswarm();
    swarm.on('connection', conn =>
      core.replicate(conn));
    swarm.join(topicKey(cfg.topic || 'aces'));
    return core;
  }

  return {
    publish: async event => {
      const c = open();
      await c.append(
        Buffer.from(JSON.stringify(event)));
    },
    subscribe: cb => {
      const c = open();
      let live = true;
      (async () => {
        for await (const block of
          c.createReadStream({ live: true })) {
          if (!live) break;
          cb(JSON.parse(block.toString()));
        }
      })();
      return () => { live = false; };
    },
  };
}

// derive a 32-byte swarm topic from a string
function topicKey(name) {
  const crypto = require('crypto');
  return crypto.createHash('sha256')
    .update('aces:' + name).digest();
}

module.exports = { pearSync };
