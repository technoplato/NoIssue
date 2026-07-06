#!/usr/bin/env node
/* ==============================================
 * TEST — one view spec       (<=50 col house)
 * Proves view.js: ONE node tree renders to
 * ascii, React, and React Native; buttons
 * dispatch real ACES actions in both React
 * worlds; the kind set is closed. React and RN
 * are FAKED via injection (deps.js doctrine) —
 * no npm install, no framework, just shape.
 * No test framework either. `node test-view.js`.
 * ============================================ */

'use strict';

const { createRuntime } = require('./core');
const {
  text, button, row, box,
  toAscii, toReact, toReactNative,
} = require('./view');

let pass = 0, fail = 0;
function ok(name, cond) {
  console.log(
    (cond ? '  ok   ' : '  FAIL ') + name);
  cond ? pass++ : fail++;
}

// a fake createElement: returns plain data we
// can assert on. Same signature as React's.
const ce = (type, props, ...children) =>
  ({ type, props: props || {},
     children: children.filter(
       c => c !== null) });

// find every node of a type in a fake tree
function grep(el, type, hits) {
  hits = hits || [];
  if (el && el.type === type) hits.push(el);
  for (const c of (el && el.children) || [])
    if (c && c.children) grep(c, type, hits);
    else if (c && c.type === type)
      hits.push(c);
  return hits;
}

async function main() {
  // one real machine: the counter
  const counter = {
    initial: { total: 0 },
    decide: (s, a) => a.type === 'add'
      ? [{ type: 'Added', n: a.n }] : [],
    evolve: (s, e) => e.type === 'Added'
      ? { total: s.total + e.n } : s,
  };
  const rt = createRuntime(counter, {});
  await rt.dispatch({ type: 'add', n: 41 });

  // ONE view spec, written once, from state:
  const view = s => box('counter',
    text('total: ' + s.total),
    row(
      button('+1', { type: 'add', n: 1 }),
      button('+10', { type: 'add', n: 10 })));

  // -- target 1: ascii ------------------------
  const art = toAscii(view(rt.getState()));
  ok('ascii shows the folded state (41)',
    art.includes('total: 41'));
  ok('ascii frames the box with its title',
    art.includes('- counter ') &&
    art.startsWith('.-') &&
    art.trimEnd().endsWith("-'"));
  ok('ascii row puts buttons side by side',
    /\[ \+1 \]\s+\[ \+10 \]/.test(art));

  // -- target 2: React (faked DOM world) ------
  const rTree = toReact(view(rt.getState()),
    { createElement: ce,
      dispatch: rt.dispatch });
  ok('react: box -> div, title -> strong',
    rTree.type === 'div' &&
    grep(rTree, 'strong').length === 1);
  const btns = grep(rTree, 'button');
  ok('react: two buttons in a flex row',
    btns.length === 2 &&
    grep(rTree, 'div').some(d =>
      (d.props.style || {})
        .flexDirection === 'row'));

  // press +10: onClick must dispatch the real
  // ACES action into the real runtime.
  await btns[1].props.onClick();
  ok('react click dispatched (41 -> 51)',
    rt.getState().total === 51);

  // -- target 3: React Native (faked) ---------
  const View = 'RN.View', Text = 'RN.Text',
    Pressable = 'RN.Pressable';
  const nTree = toReactNative(
    view(rt.getState()),
    { createElement: ce, View, Text,
      Pressable, dispatch: rt.dispatch });
  ok('rn: box -> View, strings live in Text',
    nTree.type === View &&
    grep(nTree, Text).length >= 3);
  const press = grep(nTree, Pressable);
  ok('rn: buttons are Pressables',
    press.length === 2);
  await press[0].props.onPress();
  ok('rn press dispatched (51 -> 52)',
    rt.getState().total === 52);

  // -- the point, stated as a test ------------
  const again = toAscii(view(rt.getState()));
  ok('same spec, three targets, one truth',
    again.includes('total: 52'));

  // -- closed set -----------------------------
  let msg = '';
  try {
    toAscii({ kind: 'blink', props: {},
      children: [] });
  } catch (e) { msg = e.message; }
  ok('unknown kind refuses loudly',
    /unknown view kind/.test(msg));

  console.log('\n  ' + pass + ' passed, ' +
    fail + ' failed');
  process.exit(fail ? 1 : 0);
}

main().catch(e => {
  console.error(e); process.exit(1);
});
