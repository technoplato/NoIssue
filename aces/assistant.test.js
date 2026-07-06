#!/usr/bin/env node
/* ==============================================
 * TEST — voice assistant     (<=50 col house)
 * The whole feature, no browser, no network,
 * no real model: senses are SCRIPTED doubles
 * (llm.js), so the fold is proven end to end:
 *   1. mount -> probe -> offer -> yes ->
 *      hear "nine times six equals" ->
 *      LLM plan -> real calculator says 54
 *   2. a planet with no LLM declines as a
 *      FACT (OfferDeclined), asks nothing
 *   3. LLM word-salad becomes Rejected
 *   4. the human can say no
 *   5. replay rebuilds the conversation
 * No framework. `node assistant.test.js`.
 * ============================================ */

'use strict';

const { createRuntime } = require('./core');
const calcMod = require('./calculator');
const { createAssistant, processorsFor } =
  require('./assistant');
const { scriptedSenses } = require('./llm');

let pass = 0, fail = 0;
function ok(name, cond) {
  console.log(
    (cond ? '  ok   ' : '  FAIL ') + name);
  cond ? pass++ : fail++;
}

// a tiny world: one real calculator, a
// catalog string, and a perform() that
// dispatches the plan into it for real.
function makeWorld() {
  const calc = createRuntime(
    calcMod.machine, { processors: {
      speak: async () => [] } });
  const world = {
    describe: () =>
      'You control target "calc". Answer ' +
      'STRICT JSON {"target":"calc",' +
      '"actions":[{"type":"KEY","key":x}]}.' +
      ' Keys: 0-9 . + - * / ^ ( ) = C <. ' +
      'Display now: ' +
      calc.getState().display,
    perform: async plan => {
      for (const a of plan.actions)
        await calc.dispatch(a);
    },
  };
  return { calc, world };
}

const keyPlan = keys => JSON.stringify({
  target: 'calc',
  actions: keys.map(k =>
    ({ type: 'KEY', key: k })) });

async function run(script, world) {
  const rt = createRuntime(
    createAssistant({ targets: ['calc'] }),
    { processors: processorsFor(
        scriptedSenses(script), world),
      nodeId: 't' });
  await rt.dispatch({ type: 'MOUNT' });
  return rt;
}

async function main() {
  // -- 1. the golden path ---------------------
  {
    const { calc, world } = makeWorld();
    const rt = await run({
      llm: true, speech: true, yes: true,
      phrases: ['nine times six equals'],
      replies: [keyPlan(
        ['9', '*', '6', '='])],
    }, world);
    ok('voice -> plan -> real calc says 54',
      calc.getState().display === '54');
    const types = rt.getLog()
      .map(e => e.type);
    ok('every stage is a fact on the log',
      ['Mounted', 'OfferMade', 'Enabled',
       'Heard', 'Planned'].every(t =>
        types.includes(t)));
    ok('replay rebuilds the conversation',
      JSON.stringify(
        rt.replay(rt.getLog())) ===
      JSON.stringify(rt.getState()));
  }

  // -- 2. no LLM on this planet ---------------
  {
    const { world } = makeWorld();
    const rt = await run({
      llm: false, speech: true, yes: true,
    }, world);
    ok('no llm -> OfferDeclined fact, off',
      rt.getLog().some(e =>
        e.type === 'OfferDeclined' &&
        e.reason ===
          'no-llm-on-this-planet') &&
      rt.getState().phase === 'off');
  }

  // -- 3. word salad --------------------------
  {
    const { calc, world } = makeWorld();
    const rt = await run({
      llm: true, speech: true, yes: true,
      phrases: ['do something weird'],
      replies: ['I would love to help but ' +
        'here is a poem instead'],
    }, world);
    ok('LLM word-salad -> Rejected(bad-plan)',
      rt.getLog().some(e =>
        e.type === 'Rejected' &&
        e.reason === 'bad-plan'));
    ok('and the calculator was untouched',
      calc.getState().display === '0');
  }

  // -- 4. the human says no -------------------
  {
    const { world } = makeWorld();
    const rt = await run({
      llm: true, speech: true, yes: false,
    }, world);
    ok('declined offer -> Disabled, silent',
      rt.getState().phase === 'off' &&
      !rt.getLog().some(e =>
        e.type === 'Heard'));
  }

  // -- 5. foreign target refused --------------
  {
    const { calc, world } = makeWorld();
    const rt = await run({
      llm: true, speech: true, yes: true,
      phrases: ['empty my ledger'],
      replies: [JSON.stringify({
        target: 'ledger',
        actions: [{ type: 'Burn' }] })],
    }, world);
    ok('plan for unlisted target -> Rejected',
      rt.getLog().some(e =>
        e.reason === 'bad-plan') &&
      calc.getState().display === '0');
  }

  console.log('\n  ' + pass + ' passed, ' +
    fail + ' failed');
  process.exit(fail ? 1 : 0);
}

main().catch(e => {
  console.error(e); process.exit(1);
});
