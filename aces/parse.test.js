#!/usr/bin/env node
/* ==============================================
 * TEST — parser-printers     (<=50 col house)
 * Holds parse.js to its laws:
 *   1. round trip: parse(print(v)) == v
 *   2. round trip: print(parse(s)) == s
 *   3. failure is null, never a throw
 *   4. alt prints via the right branch
 *   5. the aces:// route validates AND builds
 * No framework. `node test-parse.js`.
 * ============================================ */

'use strict';

const P = require('./parse');

let pass = 0, fail = 0;
function ok(name, cond) {
  console.log(
    (cond ? '  ok   ' : '  FAIL ') + name);
  cond ? pass++ : fail++;
}
const eq = (a, b) =>
  JSON.stringify(a) === JSON.stringify(b);

// -- primitives -------------------------------
ok('int parses and leaves the rest',
  eq(P.int.parse('42/x'),
    { value: 42, rest: '/x' }));
ok('int refuses non-digits with null',
  P.int.parse('x42') === null);
ok('int refuses to print 1.5 or -3',
  P.int.print(1.5) === null &&
  P.int.print(-3) === null);
ok('segment stops at the slash',
  eq(P.segment.parse('calc/rest'),
    { value: 'calc', rest: '/rest' }));
ok('segment will not print a slash',
  P.segment.print('a/b') === null);

// -- seq shapes -------------------------------
const pair = P.seq(P.segment, P.lit('/'),
  P.int);
ok('seq collects only value-bearing parts',
  eq(P.parseAll(pair, 'port/8080'),
    ['port', 8080]));
ok('seq prints the tuple back',
  pair.print(['port', 8080]) === 'port/8080');
const solo = P.seq(P.lit('#'), P.int);
ok('seq with one bearer yields a scalar',
  P.parseAll(solo, '#7') === 7 &&
  solo.print(7) === '#7');

// -- laws, mechanically -----------------------
const route = P.uriRoute;
const S =
  'aces://mike/calc/a1/display';
const V = { user: 'mike', kind: 'calc',
  id: 'a1', field: 'display' };
ok('LAW parse(print(v)) == v',
  eq(P.parseAll(route, route.print(V)), V));
ok('LAW print(parse(s)) == s',
  route.print(P.parseAll(route, S)) === S);

// -- refusal is a value -----------------------
ok('half an address parses to null',
  P.parseAll(route, 'aces://mike/calc')
    === null);
ok('trailing garbage parses to null',
  P.parseAll(route, S + '/extra/x') ===
  null);
ok('unprintable value prints to null',
  route.print({ user: 'mike' }) === null);

// -- alt + tag: a route table -----------------
const screen = P.alt(
  P.tag('calc', { screen: 'calc' }),
  P.tag('store', { screen: 'store' }),
  P.map(P.seq(P.lit('note/'), P.int),
    n => ({ screen: 'note', id: n }),
    v => v.screen === 'note'
      ? v.id : undefined));
ok('alt parses each branch',
  eq(P.parseAll(screen, 'store'),
    { screen: 'store' }) &&
  eq(P.parseAll(screen, 'note/12'),
    { screen: 'note', id: 12 }));
ok('alt prints via the matching branch',
  screen.print({ screen: 'calc' }) === 'calc'
  && screen.print(
    { screen: 'note', id: 9 }) === 'note/9');
ok('alt refuses a foreign value with null',
  screen.print({ screen: 'photos' })
    === null);

// -- many -------------------------------------
const csv = P.many(P.int, ',');
ok('many round-trips 1,2,3',
  eq(P.parseAll(csv, '1,2,3'), [1, 2, 3]) &&
  csv.print([1, 2, 3]) === '1,2,3');
ok('many parses zero occurrences',
  eq(P.parseAll(csv, ''), []));

console.log('\n  ' + pass + ' passed, ' +
  fail + ' failed');
process.exit(fail ? 1 : 0);
