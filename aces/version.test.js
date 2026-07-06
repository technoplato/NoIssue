#!/usr/bin/env node
/* ==============================================
 * TEST — event versioning    (<=50 col house)
 * Proves the SemVer spine (version.js):
 *   1. a skipped migration is a BUILD error
 *   2. a stray future migration is too
 *   3. ancient events fold through the chain
 *   4. new events are born stamped
 *   5. the log itself is NEVER rewritten
 *   6. peers negotiate down to the lower v
 *   7. the real package.json wires clean
 *   8. events from the future refuse loudly
 * No framework. `node test-version.js`.
 * ============================================ */

'use strict';

const { createRuntime } = require('./core');
const {
  defineSchema, negotiate, versioned,
} = require('./version');

let pass = 0, fail = 0;
function ok(name, cond) {
  console.log(
    (cond ? '  ok   ' : '  FAIL ') + name);
  cond ? pass++ : fail++;
}
function throws(fn, re) {
  try { fn(); return false; }
  catch (e) { return re.test(e.message); }
}

/* The guinea pig: a counter whose Added event
 * changed shape twice.
 *   v1.0  { type:'Added', n }        signed n
 *   v1.1  n renamed -> amount        still signed
 *   v1.2  amount unsigned + sign     the split
 * decide() below writes the CURRENT (1.2) shape;
 * migrations lift the two ancestors up to it.
 */
const schema = defineSchema({
  version: '1.2.0',
  migrations: {
    '1.1': e => e.type !== 'Added' ? e :
      { type: 'Added', amount: e.n },
    '1.2': e => e.type !== 'Added' ? e :
      { type: 'Added',
        amount: Math.abs(e.amount),
        sign: e.amount < 0 ? -1 : 1 },
  },
});

const counter = {
  initial: { total: 0 },
  decide: (s, a) => a.type !== 'add' ? [] :
    [{ type: 'Added',
       amount: Math.abs(a.n),
       sign: a.n < 0 ? -1 : 1 }],
  evolve: (s, e) => e.type !== 'Added' ? s :
    { total: s.total + e.sign * e.amount },
};

async function main() {
  // -- 1. skipped migration = build error -----
  ok('missing minor migration throws at define',
    throws(() => defineSchema({
      version: '1.2.0',
      migrations: { '1.2': e => e },
    }), /migration "1\.1" is missing/));

  // -- 2. migration from the future -----------
  ok('stray future migration throws at define',
    throws(() => defineSchema({
      version: '1.1.0',
      migrations: {
        '1.1': e => e, '1.3': e => e },
    }), /outside version/));

  // -- 3 + 4 + 5. the mixed-era log -----------
  {
    const rt = createRuntime(
      versioned(counter, schema),
      { nodeId: 'me' });

    // two facts from elder eras arrive over
    // sync, original shapes intact:
    await rt.ingest({ type: 'Added', n: 5,
      v: '1.0', _id: 'x:0', _origin: 'x' });
    await rt.ingest({ type: 'Added', amount: -3,
      v: '1.1', _id: 'x:1', _origin: 'x' });
    // one modern fact decided right here:
    await rt.dispatch({ type: 'add', n: 4 });

    ok('elder events fold thru the chain (5-3+4)',
      rt.getState().total === 6);

    const log = rt.getLog();
    ok('new event is born stamped v1.2',
      log[2].v === '1.2' &&
      log[2].sign === 1 && log[2].amount === 4);

    // the log holds HISTORY, not translations:
    ok('log keeps originals — never rewritten',
      log[0].v === '1.0' && 'n' in log[0] &&
      log[1].v === '1.1' && log[1].amount === -3);

    ok('mixed-era replay is deterministic',
      rt.replay(log).total === 6);
  }

  // -- 6. version treaty ----------------------
  ok('peers negotiate to the lower version',
    negotiate('1.2.0', '1.4.1') === '1.2.0' &&
    negotiate('2.0.0', '1.9.9') === '1.9.9' &&
    negotiate('1.3.0', '1.3.0') === '1.3.0');

  // -- 7. package.json is the source of truth -
  {
    const v = require('./package.json').version;
    const live = defineSchema({ version: v });
    ok('package.json (' + v + ') wires clean',
      live.tag === '1.0');
  }

  // -- 8. refuse the future, loudly -----------
  {
    const rt = createRuntime(
      versioned(counter, schema));
    let msg = '';
    try {
      await rt.ingest({ type: 'Added',
        amount: 1, sign: 1, v: '1.3',
        _id: 'y:0', _origin: 'y' });
    } catch (e) { msg = e.message; }
    ok('event from the future refuses loudly',
      /negotiate/.test(msg));
  }

  console.log('\n  ' + pass + ' passed, ' +
    fail + ' failed');
  process.exit(fail ? 1 : 0);
}

main().catch(e => {
  console.error(e); process.exit(1);
});
