#!/usr/bin/env node
/* ==============================================
 * TEST — navigation archetype (<=50 col house)
 * Proves nav.js:
 *   1. the route table gatekeeps NAVIGATE —
 *      bad destinations become Rejected FACTS
 *   2. moves print the hash via react()
 *   3. BACK pops honestly; empty back refuses
 *   4. settings fold, replay, and validate
 *   5. screen is addressable by URI
 * No framework. `node test-nav.js`.
 * ============================================ */

'use strict';

const { createRuntime } = require('./core');
const nav = require('./nav');

let pass = 0, fail = 0;
function ok(name, cond) {
  console.log(
    (cond ? '  ok   ' : '  FAIL ') + name);
  cond ? pass++ : fail++;
}

async function main() {
  const hashes = [];   // the world's spy
  const rt = createRuntime(nav.machine, {
    processors: {
      hash: fx =>
        (hashes.push(fx.text), []),
    },
    nodeId: 't',
  });

  // -- happy path -----------------------------
  await rt.dispatch(
    { type: 'NAVIGATE', to: 'store' });
  ok('navigates to a real screen',
    rt.getState().screen === 'store');
  ok('react printed the hash via the route',
    hashes.join() === 'store');

  // -- the gate: refusals are facts -----------
  await rt.dispatch(
    { type: 'NAVIGATE', to: 'photos' });
  const rej = rt.getLog().filter(e =>
    e.type === 'Rejected');
  ok('unknown screen -> Rejected fact',
    rej.length === 1 &&
    rej[0].reason === 'no-such-screen' &&
    rt.getState().screen === 'store');
  await rt.dispatch(
    { type: 'NAVIGATE', to: 'store' });
  ok('same-screen NAVIGATE is a no-op',
    rt.getLog().length === 2);

  // -- back -----------------------------------
  await rt.dispatch(
    { type: 'NAVIGATE', to: 'settings' });
  await rt.dispatch({ type: 'BACK' });
  ok('BACK pops to the previous screen',
    rt.getState().screen === 'store' &&
    hashes[hashes.length - 1] === 'store');
  await rt.dispatch({ type: 'BACK' });
  await rt.dispatch({ type: 'BACK' });
  ok('BACK past the floor refuses as a fact',
    rt.getLog().some(e =>
      e.reason === 'nothing-back'));

  // -- settings fold + validate ---------------
  await rt.dispatch({ type: 'SET',
    key: 'glyph', value: 'lg' });
  await rt.dispatch({ type: 'SET',
    key: 'crt', value: 'on' });
  const s = rt.getState().settings;
  ok('legal setting folds in',
    s.glyph === 'lg');
  ok('unknown setting -> Rejected fact',
    rt.getLog().some(e =>
      e.reason === 'no-such-setting'));

  // -- replay determinism ---------------------
  const before =
    JSON.stringify(rt.getState());
  ok('replay rebuilds the exact nav state',
    JSON.stringify(
      rt.replay(rt.getLog())) === before);

  // -- addressable ----------------------------
  ok('screen resolves by global URI',
    rt.resolve(
      'aces://mike/device/d1/screen')
      === rt.getState().screen);
  ok('screen resolves by local URI too',
    rt.resolve('nav://screen') ===
    rt.getState().screen);

  // -- render (through view.js nodes) ---------
  ok('render marks the current screen',
    rt.render().includes(
      '> ' + rt.getState().screen));

  console.log('\n  ' + pass + ' passed, ' +
    fail + ' failed');
  process.exit(fail ? 1 : 0);
}

main().catch(e => {
  console.error(e); process.exit(1);
});
