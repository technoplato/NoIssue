#!/usr/bin/env node
/* ==============================================
 * TEST — platform enum       (<=50 col house)
 * Proves the declarative tree (platform.js):
 *   1. the enum is closed and exhaustive
 *   2. every planet detects from data alone
 *   3. precedence: specific beats general
 *   4. backends are DERIVED, never hand-listed
 *   5. a malformed leaf is a build error
 * Detection is pure over injected globals, so
 * we can stand on ten fake planets in one run.
 * No framework. `node test-platform.js`.
 * ============================================ */

'use strict';

const P = require('./platform');

let pass = 0, fail = 0;
function ok(name, cond) {
  console.log(
    (cond ? '  ok   ' : '  FAIL ') + name);
  cond ? pass++ : fail++;
}

// -- 1. closed + exhaustive -------------------
// (platform.js already validate()d itself at
// load — requiring it without a throw IS the
// build check. Assert the census anyway.)
ok('enum is closed: 11 leaves, 4 kinds',
  P.leaves().length === 11 &&
  Object.keys(P.TREE).length === 4);

// -- 2. ten fake planets ----------------------
const planets = [
  [{ WebSocketPair: 1 },
    'serverless.cloudflare-worker'],
  [{ WebSocketPair: 1, DurableObject: 1 },
    'serverless.durable-object'],
  [{ process: { env: { FIREBASE_CONFIG: 'x' },
      versions: { node: '20' } } },
    'serverless.firebase-fn'],
  [{ process: { env: { K_SERVICE: 'fn' },
      versions: { node: '20' } } },
    'serverless.gcp-cloud-fn'],
  [{ navigator: { product: 'ReactNative' } },
    'native.react-native'],
  [{ window: 1, document: 1 },
    'web.plain-html'],
  [{ window: 1, document: 1, React: 1 },
    'web.react'],
  [{ Bun: 1 }, 'runtime.bun'],
  [{ process: { versions: { node: '20' } } },
    'runtime.node'],
  [{}, 'unknown'],
];
for (const [g, want] of planets)
  ok('detects ' + want, P.detect(g) === want);

// -- 3. precedence is declaration order -------
ok('bun outranks node (bun ships both)',
  P.detect({ process: { versions:
    { node: '20', bun: '1.1' } } })
  === 'runtime.bun');
ok('firebase-fn outranks plain node',
  P.detect({ process: {
    env: { FIREBASE_CONFIG: 'x' },
    versions: { node: '20' } } })
  !== 'runtime.node');

// -- 4. backends derive from caps -------------
const node = P.diagnose(
  { process: { versions: { node: '20' } } });
ok('node: admin + pear derived',
  node.backends.includes('instant-admin') &&
  node.backends.includes('pear'));
const web = P.diagnose(
  { window: 1, document: 1 });
ok('web: client derived, admin FORBIDDEN',
  web.backends.includes('instant-client') &&
  !web.backends.includes('instant-admin'));
ok('unknown planet: memory only',
  P.diagnose({}).backends
    .join() === 'memory');
ok('recommend() = default + full stack',
  P.recommend({}).use === 'memory' &&
  P.recommend({ Bun: 1 }).stack
    .includes('pear'));

// -- 5. malformed leaf = build error ----------
let msg = '';
try {
  P.validate({ web: { oops: {
    caps: { admin: false },  // caps missing
    sniff: () => true,       // client/pear/..
  } } });
} catch (e) { msg = e.message; }
ok('half-declared leaf refuses to build',
  /missing cap/.test(msg));

// -- and the ground we stand on ---------------
ok('this very test runs on runtime.node',
  P.detect() === 'runtime.node');
ok('report() renders the box',
  P.report().includes('runtime.node'));

console.log('\n  ' + pass + ' passed, ' +
  fail + ' failed');
process.exit(fail ? 1 : 0);
