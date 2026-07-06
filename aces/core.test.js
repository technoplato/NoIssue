#!/usr/bin/env node
/* ==============================================
 * TEST  —  tiny runner           (<=50 col house)
 * Proves the three claims that matter:
 *   1. replay determinism
 *   2. an UNWIRED side effect crashes the test
 *   3. two nodes converge over sync
 * No framework. `node test.js`.
 * ============================================ */

'use strict';

const { createRuntime } = require('./core');
const calc = require('./calculator');
const { Deps, withDeps, processorsFromDeps } =
  require('./deps');
const { createBus, inMemorySync } = require('./sync');
const { connect } = require('./mesh');

let pass = 0, fail = 0;
function ok(name, cond) {
  console.log((cond ? '  ok   ' : '  FAIL ') + name);
  cond ? pass++ : fail++;
}
const keys = ks => ks.map(k => ({ type: 'KEY', key: k }));

async function main() {
  // -- 1. replay determinism --------------------
  {
    const rt = createRuntime(calc.machine, {});
    for (const a of keys(['9', '*', '6']))
      await rt.dispatch(a);
    const live = rt.getState().value;
    const rebuilt = rt.replay(rt.getLog()).value;
    ok('replay is deterministic (54==54)',
      live === 54 && rebuilt === 54);
  }

  // -- 2. unwired side effect crashes -----------
  // '=' fires a 'speak' effect. speak.say is
  // unimplemented by default, so dispatch must
  // reject. That is the safety net: a test can
  // never silently perform real I/O.
  {
    const rt = createRuntime(calc.machine, {
      processors: processorsFromDeps(Deps),
    });
    for (const a of keys(['2', '+', '2']))
      await rt.dispatch(a);
    let threw = false;
    try { await rt.dispatch({ type: 'KEY', key: '=' }); }
    catch (e) {
      threw = /unimplemented/.test(e.message);
    }
    ok('unwired speak crashes the test', threw);
  }

  // -- 2b. same effect, now WIRED, does not crash
  {
    const said = [];
    await withDeps(
      { speak: { say: t => said.push(t) } },
      async () => {
        const rt = createRuntime(calc.machine, {
          processors: processorsFromDeps(Deps),
        });
        for (const a of keys(['2', '+', '2', '=']))
          await rt.dispatch(a);
        ok('wired speak was called once',
          said.length === 1 &&
          said[0] === 'equals 4');
      });
  }

  // -- 3. two nodes converge over sync ----------
  // Send actions to node A only; node B must reach
  // the same value with no direct contact.
  {
    const bus = createBus();
    const a = createRuntime(calc.machine,
      { nodeId: 'A' });
    const b = createRuntime(calc.machine,
      { nodeId: 'B' });
    connect(a, inMemorySync(bus));
    connect(b, inMemorySync(bus));
    for (const act of keys(['7', '*', '6']))
      await a.dispatch(act);
    await new Promise(r => setTimeout(r, 5));
    ok('node B converged to node A (42)',
      b.getState().value === 42 &&
      a.getState().value === 42);
    ok('B holds all 3 facts from A',
      b.getLog().length === 3);
  }

  console.log('\n  ' + pass + ' passed, '
    + fail + ' failed');
  process.exit(fail ? 1 : 0);
}
main();
