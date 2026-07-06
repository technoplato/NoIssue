/* ==============================================
 * PLATFORM — a declarative      (<=50 col house)
 * nested ENUM of runtimes.
 * ----------------------------------------------
 * ENUM here means a CLOSED, EXHAUSTIVE set: the
 * whole world of places ACES can run, written as
 * one tree of DATA — kind -> leaf -> facts. No
 * `if` ladders; detection, capabilities, and
 * recommend() are all DERIVED by walking it.
 *
 *   serverless: durable-object,
 *               cloudflare-worker,
 *               firebase-fn, gcp-cloud-fn
 *   native:     react-native
 *   web:        react, svelte, plain-html
 *   runtime:    node, bun, deno
 *
 * Each leaf declares two things:
 *   sniff(g) -> bool   am I this place?
 *   caps               what can I HONESTLY do?
 *     admin      @instantdb/admin (server SDK;
 *                needs the SECRET token, so
 *                never true in a browser)
 *     client     @instantdb/core (public app
 *                id only — browser-safe)
 *     pear       Holepunch swarm (needs real
 *                sockets + native deps)
 *     persistent can state survive a restart?
 *
 * validate() runs at load: a leaf missing a cap
 * or a sniff is a BUILD error, not a runtime
 * surprise — same doctrine as version.js.
 *
 * ORDER IS MEANING: kinds and leaves are tried
 * top-to-bottom, first sniff wins. Specific
 * before general (durable-object before plain
 * worker, react before plain-html, bun before
 * node — bun also reports process.versions.node).
 * ============================================ */

'use strict';

// tiny constructor so every leaf reads the same
function leaf(caps, sniff) {
  return { caps, sniff };
}

// sniff helpers — pure over an injected globals
// object `g`, so tests can fake any planet.
const has = (g, k) => typeof g[k] !== 'undefined';
const env = g =>
  (has(g, 'process') && g.process.env) || {};
const vers = g =>
  (has(g, 'process') && g.process.versions) || {};
const dom = g =>
  has(g, 'window') && has(g, 'document');

const TREE = {
  serverless: {
    // DO = Durable Object: a cloudflare worker
    // plus an identity and its own storage.
    'durable-object': leaf(
      { admin: true, client: false,
        pear: false, persistent: true },
      g => has(g, 'WebSocketPair') &&
           has(g, 'DurableObject')),
    // stateless isolate: compute, no memory of
    // you. admin SDK ok (secrets live in env).
    'cloudflare-worker': leaf(
      { admin: true, client: false,
        pear: false, persistent: false },
      g => has(g, 'WebSocketPair')),
    'firebase-fn': leaf(
      { admin: true, client: false,
        pear: false, persistent: false },
      g => !!env(g).FIREBASE_CONFIG &&
           !!vers(g).node),
    'gcp-cloud-fn': leaf(
      { admin: true, client: false,
        pear: false, persistent: false },
      g => (!!env(g).FUNCTION_TARGET ||
            !!env(g).K_SERVICE) &&
           !!vers(g).node),
  },
  native: {
    'react-native': leaf(
      { admin: false, client: true,
        pear: false, persistent: true },
      g => has(g, 'navigator') &&
        g.navigator.product === 'ReactNative'),
  },
  web: {
    // browsers NEVER get admin: that SDK wants
    // the secret token, and a browser is enemy
    // territory for secrets. client SDK only.
    react: leaf(
      { admin: false, client: true,
        pear: false, persistent: true },
      g => dom(g) && (has(g, 'React') ||
        has(g, '__REACT_DEVTOOLS_GLOBAL_HOOK__'))),
    svelte: leaf(
      { admin: false, client: true,
        pear: false, persistent: true },
      g => dom(g) && has(g, '__svelte')),
    'plain-html': leaf(
      { admin: false, client: true,
        pear: false, persistent: true },
      g => dom(g)),
  },
  runtime: {
    bun: leaf(
      { admin: true, client: false,
        pear: true, persistent: true },
      g => has(g, 'Bun') || !!vers(g).bun),
    deno: leaf(
      // npm compat runs admin; hypercore's
      // native deps do not — honest no on pear.
      { admin: true, client: false,
        pear: false, persistent: true },
      g => has(g, 'Deno')),
    node: leaf(
      { admin: true, client: false,
        pear: true, persistent: true },
      g => !!vers(g).node),
  },
};

// where we land when no sniff matches. memory
// only — we refuse to guess at capabilities.
const UNKNOWN = leaf(
  { admin: false, client: false,
    pear: false, persistent: false },
  () => true);

// -- the build-time exhaustiveness check -------
// every leaf must declare every cap (a boolean)
// and a sniff function. Forgot one? The module
// refuses to load. The enum stays closed.
const CAPS =
  ['admin', 'client', 'pear', 'persistent'];
function validate(tree) {
  for (const kind of Object.keys(tree)) {
    for (const name of Object.keys(tree[kind])) {
      const l = tree[kind][name];
      const at = kind + '.' + name;
      if (typeof l.sniff !== 'function')
        throw new Error(
          'leaf ' + at + ' has no sniff()');
      for (const c of CAPS)
        if (typeof (l.caps || {})[c] !==
            'boolean')
          throw new Error('leaf ' + at +
            ' missing cap "' + c + '"');
    }
  }
  return true;
}
validate(TREE);

// flat list of every 'kind.name' path
function leaves(tree) {
  tree = tree || TREE;
  const out = [];
  for (const k of Object.keys(tree))
    for (const n of Object.keys(tree[k]))
      out.push(k + '.' + n);
  return out;
}

// walk the tree in declared order; first sniff
// that answers true names the planet we are on.
function detect(g) {
  g = g || globalThis;
  for (const kind of Object.keys(TREE))
    for (const name of Object.keys(TREE[kind]))
      if (TREE[kind][name].sniff(g))
        return kind + '.' + name;
  return 'unknown';
}

function leafAt(path) {
  if (path === 'unknown') return UNKNOWN;
  const [kind, name] = path.split('.');
  return TREE[kind][name];
}

// caps -> the sync backends they permit. This
// is the DERIVATION the enum exists for: no
// leaf lists backends by hand, so a leaf can
// never claim a backend its caps forbid.
function backendsOf(caps) {
  const b = [];
  if (caps.admin) b.push('instant-admin');
  if (caps.client) b.push('instant-client');
  if (caps.pear) b.push('pear');
  b.push('memory');       // always, everywhere
  return b;
}

function diagnose(g) {
  const target = detect(g);
  const l = leafAt(target);
  const backends = backendsOf(l.caps);
  const warn = [];
  if (!l.caps.pear)
    warn.push('no pear p2p here');
  if (!l.caps.persistent)
    warn.push('stateless: replay from sync');
  if (target === 'unknown')
    warn.push('unrecognized: memory only');
  return {
    target, backends,
    default: backends[0],
    caps: { ...l.caps },
    warnings: warn,
  };
}

// recommend() — what NEXT.md item 2 asked to
// derive: the adapter stack for wherever we
// happen to be standing.
function recommend(g) {
  const d = diagnose(g);
  return { use: d.default, stack: d.backends };
}

// pretty one-screen report, sized to content
function report(g) {
  const d = diagnose(g);
  const rows = [
    'target : ' + d.target,
    'default: ' + d.default,
    'sync   :',
    ...d.backends.map(b => '  + ' + b),
    ...d.warnings.map(w => '! ' + w),
  ];
  const w = Math.max(
    ...rows.map(r => r.length), 19);
  const pad = s =>
    s + ' '.repeat(w - s.length);
  return [
    '.--- ACES platform ' +
      '-'.repeat(w - 17) + '.',
    ...rows.map(r => '| ' + pad(r) + ' |'),
    "'" + '-'.repeat(w + 2) + "'",
  ].join('\n');
}

module.exports = {
  TREE, leaves, validate,
  detect, diagnose, recommend, report,
};
