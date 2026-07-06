#!/usr/bin/env node
/* ==============================================
 * TEST — pear.live            (<=50 col house)
 * Proves REAL hypercore replication behind the
 * { publish, subscribe } contract — no mock,
 * no DHT, no network. Two nodes, a stream pair,
 * an event crosses:
 *   1. a node publishes to its own hypercore
 *   2. a peer that follows its key RECEIVES it
 *      via subscribe, over real replication
 *   3. replay-on-follow: facts published BEFORE
 *      the peer connected still arrive
 *   4. the peer key round-trips (32 bytes)
 *
 * Needs the Holepunch deps installed:
 *   cd aces && npm install
 *   npm run test:pear
 * The DHT/swarm half (joinSwarm) needs a
 * UDP-capable host and is NOT exercised here;
 * addStream drives the identical replication.
 * ============================================ */

'use strict';

let createNode;
try {
  ({ createNode } = require('./pear.live'));
  require('hypercore');
} catch (e) {
  console.log('  skip  pear.live: deps not ' +
    'installed (cd aces && npm install)');
  process.exit(0);
}

let pass = 0, fail = 0;
function ok(name, cond) {
  console.log(
    (cond ? '  ok   ' : '  FAIL ') + name);
  cond ? pass++ : fail++;
}
const wait = ms =>
  new Promise(r => setTimeout(r, ms));

async function main() {
  const a = await createNode();
  const b = await createNode();

  // A writes two facts BEFORE B ever connects,
  // to prove replay-on-follow (claim 3).
  await a.publish({ type: 'Minted', n: 1 });
  await a.publish({ type: 'Minted', n: 2 });

  ok('own hypercore key is 32 bytes',
    a.key.length === 32 &&
    a.keyHex.length === 64);

  // B follows A's key and collects events.
  const got = [];
  b.subscribe(ev => got.push(ev));
  await b.follow(a.keyHex);

  // wire a real replication stream pair between
  // A's and B's cores — exactly what a swarm
  // connection would be on a UDP host, minus the
  // DHT. addStream mints one node's protocol
  // stream; pipe the two together.
  const s1 = a.addStream(true);
  const s2 = b.addStream(false);
  s1.pipe(s2).pipe(s1);

  // let replication settle; nudge catch-up
  for (let i = 0; i < 40 && got.length < 2; i++) {
    await b.sync();
    await wait(50);
  }

  ok('peer received both facts over ' +
    'replication', got.length === 2);
  ok('facts arrived in log order',
    got[0] && got[0].n === 1 &&
    got[1] && got[1].n === 2);

  // a NEW fact after connect also propagates
  await a.publish({ type: 'Minted', n: 3 });
  for (let i = 0; i < 40 && got.length < 3; i++)
    await wait(50);
  ok('live fact after connect propagates',
    got.length === 3 && got[2].n === 3);

  await a.close(); await b.close();
  console.log('\n  ' + pass + ' passed, ' +
    fail + ' failed');
  process.exit(fail ? 1 : 0);
}

main().catch(e => {
  console.error(e); process.exit(1);
});
