/* ==============================================
 * VIEW — one spec, three     (<=50 col house)
 * targets: ASCII, React, React Native.
 * ----------------------------------------------
 * NEXT.md item 3. The ascii kits (ui.js,
 * store-ui.js) already prove
 * state -> view-tree -> string. This module
 * generalizes the middle: components return a
 * NEUTRAL VIEW NODE —
 *
 *     { kind, props, children }
 *
 * — and that node IS the DSL (Domain-Specific
 * Language). Three thin backends walk it:
 *
 *   toAscii(node)            -> string
 *   toReact(node, world)     -> element tree
 *   toReactNative(node, world) -> element tree
 *
 * The DSL starts deliberately tiny — box, text,
 * row, button — and grows only as screens
 * demand. An unknown kind THROWS: the set is
 * closed, same doctrine as platform.js.
 *
 * No React in this repo. The React backends
 * take an injected `world` ({ createElement,
 * dispatch, View, Text, Pressable }) — the
 * same "control the world" move as deps.js, so
 * tests fake the framework and CI never needs
 * npm install. A button's `action` prop is a
 * plain ACES action; pressing it just calls
 * world.dispatch(action). The view layer never
 * mutates anything — it asks, like react().
 * ============================================ */

'use strict';

// -- constructors: the whole vocabulary --------
const node = (kind, props, children) =>
  ({ kind, props: props || {},
     children: children || [] });

const text = value =>
  node('text', { value });
const button = (label, action) =>
  node('button', { label, action });
const row = (...children) =>
  node('row', null, children);
const box = (title, ...children) =>
  node('box', { title }, children);

function unknown(n) {
  return new Error(
    'unknown view kind: ' + n.kind);
}

/* -- backend 1: ASCII --------------------------
 * Every node renders to an array of lines;
 * row zips arrays side by side, box frames
 * them. Pure string math, zero I/O.
 */
const pad = (s, w) =>
  s + ' '.repeat(w - s.length);
const widest = ls => Math.max(
  0, ...ls.map(l => l.length));

function lines(n) {
  switch (n.kind) {
    case 'text':
      return [String(n.props.value)];
    case 'button':
      return ['[ ' + n.props.label + ' ]'];
    case 'row': {
      const cols = n.children.map(lines);
      const h = Math.max(
        0, ...cols.map(c => c.length));
      const ws = cols.map(widest);
      const out = [];
      for (let i = 0; i < h; i++)
        out.push(cols.map((c, j) =>
          pad(c[i] || '', ws[j]))
          .join(' ').trimEnd());
      return out;
    }
    case 'box': {
      const inner =
        n.children.flatMap(lines);
      const t = n.props.title;
      const head = t ? '- ' + t + ' ' : '';
      const w = Math.max(widest(inner),
        head.length + 2);
      return [
        '.-' + head +
          '-'.repeat(w - head.length) + '-.',
        ...inner.map(l =>
          '| ' + pad(l, w) + ' |'),
        "'-" + '-'.repeat(w) + "-'",
      ];
    }
    default: throw unknown(n);
  }
}
const toAscii = n => lines(n).join('\n');

/* -- backend 2: React (DOM) --------------------
 * world = { createElement, dispatch }
 */
function toReact(n, world) {
  const ce = world.createElement;
  const kids = n.children.map(
    c => toReact(c, world));
  switch (n.kind) {
    case 'text':
      return ce('span', null,
        String(n.props.value));
    case 'button':
      return ce('button', {
        onClick: () =>
          world.dispatch(n.props.action),
      }, n.props.label);
    case 'row':
      return ce('div', { style: {
        display: 'flex',
        flexDirection: 'row',
        gap: 8 } }, ...kids);
    case 'box':
      return ce('div', { style: {
        border: '1px solid currentColor',
        padding: 8 } },
        n.props.title
          ? ce('strong', null, n.props.title)
          : null,
        ...kids);
    default: throw unknown(n);
  }
}

/* -- backend 3: React Native -------------------
 * world = { createElement, dispatch,
 *           View, Text, Pressable }
 * RN has no div/span: raw strings must live
 * inside <Text>, presses use <Pressable>. Those
 * three components are injected, never imported.
 */
function toReactNative(n, world) {
  const ce = world.createElement;
  const kids = n.children.map(
    c => toReactNative(c, world));
  switch (n.kind) {
    case 'text':
      return ce(world.Text, null,
        String(n.props.value));
    case 'button':
      return ce(world.Pressable, {
        onPress: () =>
          world.dispatch(n.props.action),
      }, ce(world.Text, null,
        n.props.label));
    case 'row':
      return ce(world.View, { style: {
        flexDirection: 'row',
        gap: 8 } }, ...kids);
    case 'box':
      return ce(world.View, { style: {
        borderWidth: 1,
        padding: 8 } },
        n.props.title
          ? ce(world.Text,
              { style: {
                fontWeight: 'bold' } },
              n.props.title)
          : null,
        ...kids);
    default: throw unknown(n);
  }
}

module.exports = {
  node, text, button, row, box,
  toAscii, toReact, toReactNative,
};
