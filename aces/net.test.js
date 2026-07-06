#!/usr/bin/env node
/* ==============================================
 * TEST-NET  —  multi-backend      (<=50 col)
 * proves: converge across TWO networks at once,
 * and a dead backend cannot stall publish.
 * ============================================ */

'use strict';
const { createRuntime } = require('./core');
const calc = require('./calculator');
const { createBus, inMemorySync } = require('./sync');
const { combineSync } = require('./multisync');
const { connect } = require('./mesh');
const { report, detect } = require('./platform');

let pass = 0, fail = 0;
function ok(n, c) {
  console.log((c ? '  ok   ' : '  FAIL ') + n);
  c ? pass++ : fail++;
}

async function main() {
  console.log(report());
  console.log('detected runtime:', detect(), '\n');

  // two independent "networks": pretend one is
  // InstantDB, one is Pear. Both in-memory here.
  const instant = createBus();
  const pear = createBus();
  const fabric = () => combineSync([
    { name: 'instant', sync: inMemorySync(instant) },
    { name: 'pear', sync: inMemorySync(pear) },
  ], { timeoutMs: 200 });

  const A = createRuntime(calc.machine, { nodeId: 'A' });
  const B = createRuntime(calc.machine, { nodeId: 'B' });
  connect(A, fabric());
  connect(B, fabric());

  for (const k of ['8', '*', '8'])
    await A.dispatch({ type: 'KEY', key: k });
  await new Promise(r => setTimeout(r, 10));

  ok('B converged over 2 nets (64)',
    B.getState().value === 64);
  ok('event reached BOTH networks',
    instant.log.length === 3 &&
    pear.log.length === 3);
  ok('no dupes despite 2 delivery paths',
    B.getLog().length === 3);

  // a dead backend must not stall publish
  const deadSync = {
    publish: () => new Promise(() => {}), // hangs
    subscribe: () => () => {},
  };
  const guarded = combineSync([
    { name: 'ok', sync: inMemorySync(createBus()) },
    { name: 'dead', sync: deadSync },
  ], { timeoutMs: 50 });
  const t0 = Date.now();
  const res = await guarded.publish(
    { _id: 'x:1', _origin: 'x', type: 'Ping' });
  const dt = Date.now() - t0;
  ok('publish survives dead backend (<150ms)',
    dt < 150);
  ok('dead backend reported, ok backend fine',
    res.some(r => r.ok) &&
    res.some(r => r.ok === false));

  console.log('\n  ' + pass + ' passed, '
    + fail + ' failed');
  process.exit(fail ? 1 : 0);
}
main();
