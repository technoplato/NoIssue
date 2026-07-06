/* ==============================================
 * VERSION — event schema SemVer (<=50 col house)
 * ----------------------------------------------
 * SemVer = Semantic Versioning (major.minor.
 * patch). NEXT.md item 1: the spine of a log
 * that outlives the code that wrote it.
 *
 * The contract we enforce:
 *   - package.json#version is the ONE source
 *     of truth for "current version".
 *   - A MINOR bump means "an event's shape
 *     changed". Every minor therefore ships a
 *     migration that lifts the previous shape
 *     into the new one. (A no-op minor still
 *     writes an identity migration — being
 *     explicit is the point.)
 *   - A PATCH never changes event shape, so
 *     events carry only 'major.minor' as `v`.
 *   - A MAJOR bump is a new era (breaking);
 *     migrations reset. Out of scope here.
 *
 * Checks run at DEFINITION time, so a skipped
 * migration is a build error, not a runtime
 * surprise years later mid-replay:
 *   - a migration must exist for every minor
 *     from 1 up to current (missing = throw)
 *   - a migration beyond the current version
 *     is also a throw (code and package.json
 *     disagree about what "current" means)
 *
 * THE LOG IS NEVER REWRITTEN. Old events stay
 * in the log in their original shape forever;
 * migration happens at FOLD time, on the copy
 * handed to evolve/react. History is history.
 *
 * Peers negotiate: both sides speak the LOWER
 * version until both upgrade. negotiate() is
 * that one-line treaty.
 * ============================================ */

'use strict';

// '1.2.3' -> { major:1, minor:2, patch:3 }
function parse(v) {
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(v || '');
  if (!m) throw new Error(
    'bad semver: ' + JSON.stringify(v));
  return {
    major: +m[1], minor: +m[2], patch: +m[3],
  };
}

// '1.2' -> { major:1, minor:2 }  (event tags)
function parseTag(t) {
  const m = /^(\d+)\.(\d+)$/.exec(t || '');
  if (!m) throw new Error(
    'bad version tag: ' + JSON.stringify(t));
  return { major: +m[1], minor: +m[2] };
}

// semver compare: -1 | 0 | 1
function cmp(a, b) {
  const x = parse(a), y = parse(b);
  for (const k of ['major', 'minor', 'patch']) {
    if (x[k] !== y[k])
      return x[k] < y[k] ? -1 : 1;
  }
  return 0;
}

// engine metadata that must survive migration
// even if a migration forgets to spread it.
const META = ['_id', '_seq', '_at', '_origin'];
function keepMeta(src, out) {
  for (const k of META)
    if (k in src && !(k in out)) out[k] = src[k];
  return out;
}

/* defineSchema({ version, migrations })
 *   version    — the package.json string.
 *                Pass it straight through:
 *                require('./package.json')
 *                  .version
 *   migrations — { '1.1': fn, '1.2': fn, ... }
 *                fn lifts an event FROM the
 *                previous minor's shape TO the
 *                keyed version's shape. Pure;
 *                returns a NEW event object.
 * Returns { tag, stamp, migrate, version }.
 */
function defineSchema(opts) {
  const cur = parse(opts.version);
  const migrations = opts.migrations || {};
  const tag = cur.major + '.' + cur.minor;

  // -- build-time check 1: no gaps ------------
  for (let m = 1; m <= cur.minor; m++) {
    const key = cur.major + '.' + m;
    if (typeof migrations[key] !== 'function')
      throw new Error(
        'version ' + opts.version + ' declared' +
        ' but migration "' + key + '" is ' +
        'missing. Every minor bump ships a ' +
        'migration (identity if shape kept).');
  }

  // -- build-time check 2: none from the future
  for (const key of Object.keys(migrations)) {
    const k = parseTag(key);
    const ahead =
      k.major !== cur.major ||
      k.minor > cur.minor || k.minor < 1;
    if (ahead) throw new Error(
      'migration "' + key + '" is outside ' +
      'version ' + opts.version + '. Bump ' +
      'package.json (or delete the stray).');
  }

  // stamp a freshly DECIDED event with the
  // current tag. New facts are born current.
  function stamp(e) {
    return { ...e, v: tag };
  }

  // lift an event to the current shape. Events
  // with no `v` are the genesis shape ('M.0').
  // The caller's LOG keeps the original; only
  // the folded copy is upgraded.
  function migrate(e) {
    const t = parseTag(e.v || cur.major + '.0');
    if (t.major !== cur.major) throw new Error(
      'event from major ' + t.major + ', we ' +
      'are ' + tag + '. Majors are eras; ' +
      'cross-era replay needs an importer.');
    if (t.minor > cur.minor) throw new Error(
      'event v' + e.v + ' is from the future ' +
      '(we fold ' + tag + '). Peers must ' +
      'negotiate() to the lower version.');
    if (t.minor === cur.minor) return e;
    let out = e;
    for (let m = t.minor + 1;
         m <= cur.minor; m++) {
      const fn = migrations[cur.major + '.' + m];
      out = keepMeta(out, { ...fn(out) });
    }
    return { ...out, v: tag };
  }

  return { tag, stamp, migrate,
    version: opts.version };
}

// both peers speak the LOWER version until both
// have upgraded. Returns that version string.
function negotiate(mine, theirs) {
  return cmp(mine, theirs) <= 0 ? mine : theirs;
}

/* versioned(machine, schema) -> machine
 * The whole point: core.js never learns that
 * versioning exists. Wrap any machine —
 *   decide  stamps `v` on new events
 *   evolve  migrates before folding
 *   react   sees the migrated shape too
 * replay() and ingest() flow through the same
 * evolve, so ancient logs and remote peers get
 * lifted for free. Zero engine changes.
 */
function versioned(machine, schema) {
  const react = machine.react || (() => []);
  return {
    ...machine,
    decide: (s, a) =>
      (machine.decide(s, a) || [])
        .map(schema.stamp),
    evolve: (s, e) =>
      machine.evolve(s, schema.migrate(e)),
    react: (s, e) =>
      react(s, schema.migrate(e)),
  };
}

module.exports = {
  parse, parseTag, cmp,
  defineSchema, negotiate, versioned,
};
