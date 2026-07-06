/* ==============================================
 * PLATFORM  —  descriptive         (<=50 col)
 * diagnostic. "Where am I running, and which
 * sync backends can I actually use here?"
 * ----------------------------------------------
 * Pure detection, no imports. Returns a plain
 * object you can JSON.stringify and log. The mesh
 * uses recommend() to pick adapters per host.
 *
 * Targets covered:
 *   node | bun | cfworker | durable | rn | web
 * Backends:
 *   instant-admin  server SDK (node/bun only)
 *   instant-client browser/rn SDK
 *   pear           holepunch p2p (node/bun only)
 *   memory         always works (offline/test)
 * ============================================ */

'use strict';

function detect(g) {
  g = g || globalThis;
  const has = k => typeof g[k] !== 'undefined';
  const proc = has('process') ? g.process : null;
  const vers = (proc && proc.versions) || {};

  if (has('Bun') || vers.bun) return 'bun';
  if (has('WebSocketPair')) {
    // cloudflare runtime. DO adds a stateful class.
    // DO = Durable Object.
    return has('DurableObject')
      ? 'durable' : 'cfworker';
  }
  if (has('navigator') &&
      g.navigator.product === 'ReactNative')
    return 'rn';
  if (has('window') && has('document')) return 'web';
  if (vers.node) return 'node';
  return 'unknown';
}

// what each target can honestly do
const CAP = {
  node:    ['instant-admin', 'pear', 'memory'],
  bun:     ['instant-admin', 'pear', 'memory'],
  cfworker:['instant-admin', 'memory'],
  durable: ['instant-admin', 'memory'],
  rn:      ['instant-client', 'memory'],
  web:     ['instant-client', 'memory'],
  unknown: ['memory'],
};

function diagnose(g) {
  const target = detect(g);
  const backends = CAP[target] || CAP.unknown;
  const warn = [];
  if (!backends.includes('pear'))
    warn.push('pear p2p unavailable here; ' +
      'uses instant + memory');
  if (target === 'unknown')
    warn.push('unrecognized runtime; ' +
      'memory-only fallback');
  return {
    target,
    backends,
    default: backends[0],
    persistent: target !== 'unknown',
    warnings: warn,
  };
}

// pretty one-screen report
function report(g) {
  const d = diagnose(g);
  const L = [];
  L.push('.--- ACES platform ---.');
  L.push('| target : ' + pad(d.target, 9) + '|');
  L.push('| default: ' + pad(d.default, 9) + '|');
  L.push('| sync   :            |');
  for (const b of d.backends)
    L.push('|   + ' + pad(b, 14) + '|');
  for (const w of d.warnings)
    L.push('| ! ' + pad(w.slice(0, 16), 16) + '|');
  L.push("'---------------------'");
  return L.join('\n');
}
function pad(s, w) {
  s = String(s);
  return s.length >= w ? s
    : s + ' '.repeat(w - s.length);
}

module.exports = { detect, diagnose, report, CAP };
