/* ==============================================
 * PARSE — parser-PRINTERS    (<=50 col house)
 * ----------------------------------------------
 * Point-Free's swift-parsing idea, in ACES
 * house JS: one SPEC is both directions.
 *
 *   p.parse(text)  -> { value, rest } | null
 *   p.print(value) -> text | null
 *
 * Failure is a value (null), never a throw —
 * same doctrine as decide(): the caller turns
 * a null into a Rejected fact if it matters.
 *
 * THE LAWS (test-parse.js holds us to them):
 *   parseAll(p, p.print(v))  deep-equals v
 *   p.print(parseAll(p, s))  ===  s
 * A spec that parses what it cannot print (or
 * prints what it cannot parse) is a bug.
 *
 * Why ACES cares: routes. A navigation route
 * table written as a parser-printer means
 * decide() VALIDATES a destination by parsing
 * it, and the UI PRINTS state back into the
 * URL — one source of truth, zero drift
 * between "what links exist" and "what state
 * is legal" (swift-url-routing's trick).
 *
 * Conventions:
 * - a VOID part (literal) carries no value;
 *   seq() collects only non-void values, and
 *   yields a scalar when exactly one remains.
 * - map(p, fwd, bwd): bwd returns UNDEFINED
 *   to say "not my value" (lets alt() route
 *   printing); any other return (even null)
 *   is the inner value to print.
 * ============================================ */

'use strict';

// -- primitives --------------------------------

// exact text. Parses to nothing (void); prints
// itself regardless of value.
function lit(text) {
  return {
    void: true,
    parse: s => s.startsWith(text)
      ? { value: null, rest: s.slice(text.length) }
      : null,
    print: () => text,
  };
}

// non-negative integer, e.g. ids and ports
const int = {
  parse: s => {
    const m = /^\d+/.exec(s);
    return m ? { value: +m[0],
      rest: s.slice(m[0].length) } : null;
  },
  print: v => Number.isInteger(v) && v >= 0
    ? String(v) : null,
};

// one URI path segment: chars up to '/'
const segment = {
  parse: s => {
    const m = /^[^/]+/.exec(s);
    return m ? { value: m[0],
      rest: s.slice(m[0].length) } : null;
  },
  print: v => typeof v === 'string' &&
    v.length && !v.includes('/') ? v : null,
};

// everything that remains
const restOf = {
  parse: s => ({ value: s, rest: '' }),
  print: v => typeof v === 'string' ? v : null,
};

// -- combinators -------------------------------

// run parts left to right. Value = the non-void
// values (scalar if exactly one). Print undoes
// that shape and concatenates.
function seq(...parts) {
  const bearing = parts
    .map((p, i) => p.void ? -1 : i)
    .filter(i => i >= 0);
  return {
    void: bearing.length === 0,
    parse(s) {
      const vals = [];
      for (const p of parts) {
        const r = p.parse(s);
        if (!r) return null;
        if (!p.void) vals.push(r.value);
        s = r.rest;
      }
      const value =
        bearing.length === 0 ? null :
        bearing.length === 1 ? vals[0] : vals;
      return { value, rest: s };
    },
    print(value) {
      const vals =
        bearing.length === 0 ? [] :
        bearing.length === 1 ? [value] : value;
      if (bearing.length > 1 &&
          (!Array.isArray(vals) ||
           vals.length !== bearing.length))
        return null;
      let out = '', vi = 0;
      for (const p of parts) {
        const piece = p.void
          ? p.print()
          : p.print(vals[vi++]);
        if (piece === null) return null;
        out += piece;
      }
      return out;
    },
  };
}

// first branch that answers. Printing asks
// each branch in turn; bwd's undefined (see
// map) lets a branch decline a foreign value.
function alt(...branches) {
  return {
    parse(s) {
      for (const b of branches) {
        const r = b.parse(s);
        if (r) return r;
      }
      return null;
    },
    print(v) {
      for (const b of branches) {
        const t = b.print(v);
        if (t !== null) return t;
      }
      return null;
    },
  };
}

// bidirectional map. fwd lifts the parsed
// value; bwd lowers it for printing and
// returns undefined to refuse (not mine).
function map(p, fwd, bwd) {
  return {
    void: p.void,
    parse(s) {
      const r = p.parse(s);
      return r &&
        { value: fwd(r.value), rest: r.rest };
    },
    print(v) {
      const inner = bwd(v);
      return inner === undefined
        ? null : p.print(inner);
    },
  };
}

// a constant screen/case: text <-> value
function tag(text, value) {
  const same = v =>
    JSON.stringify(v) === JSON.stringify(value);
  return map(lit(text),
    () => value,
    v => same(v) ? null : undefined);
}

// zero or more, separated by literal `sep`
function many(p, sep) {
  return {
    parse(s) {
      const out = [];
      const first = p.parse(s);
      if (!first)
        return { value: out, rest: s };
      out.push(first.value);
      s = first.rest;
      for (;;) {
        const tail = sep
          ? (s.startsWith(sep)
              ? p.parse(s.slice(sep.length))
              : null)
          : p.parse(s);
        if (!tail) break;
        out.push(tail.value);
        s = tail.rest;
      }
      return { value: out, rest: s };
    },
    print(vs) {
      if (!Array.isArray(vs)) return null;
      const parts = vs.map(v => p.print(v));
      if (parts.some(x => x === null))
        return null;
      return parts.join(sep || '');
    },
  };
}

// parse and demand the WHOLE input was eaten.
// This is the front door for validators.
function parseAll(p, s) {
  const r = p.parse(String(s));
  return r && r.rest === '' ? r.value : null;
}

// -- the house address, as one spec ------------
// aces://<user>/<kind>/<id>/<field>
// (world.js today does this with regex; this
// spec both validates AND builds addresses.)
const uriRoute = map(
  seq(lit('aces://'), segment, lit('/'),
      segment, lit('/'), segment, lit('/'),
      segment),
  ([user, kind, id, field]) =>
    ({ user, kind, id, field }),
  u => u && u.user && u.kind && u.id && u.field
    ? [u.user, u.kind, u.id, u.field]
    : undefined);

module.exports = {
  lit, int, segment, restOf,
  seq, alt, map, tag, many,
  parseAll, uriRoute,
};
