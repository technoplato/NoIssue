/* ==============================================
 * UI  —  ascii component kit      (<=50 col house)
 * ----------------------------------------------
 * Atomic design, no framework. Every component is
 * a PURE function  props -> string[] (lines).
 * Compose by stacking/joining lines.
 *
 *   atom      button, display, label
 *   molecule  keyRow      (a row of buttons)
 *   organism  keypad      (rows stacked)
 *   template  device      (frame around a screen)
 *   screen    renderCalc  (wires state -> device)
 *
 * NON-CAPTIVE note: nothing is "clickable" in a
 * pipe. So a button is a LABEL + the ACTION it
 * would emit. Rendering shows the label; the
 * harness "clicks" by dispatching that action.
 * The map is printed under the pad as a legend.
 * ============================================ */

'use strict';

// ---- atoms ----
function button(label) {           // -> "[ 7 ]"
  return '[ ' + String(label) + ' ]';
}
function display(text, width) {    // right-aligned
  const s = String(text);
  const body = s.length > width
    ? '…' + s.slice(-(width - 1))
    : s.padStart(width);
  return '|' + body + '|';
}

// ---- molecule ----
function keyRow(keys) {            // -> one line
  return ' ' + keys.map(button).join('');
}

// ---- organism ----
function keypad(rows) {            // -> line[]
  return rows.map(keyRow);
}

// ---- template ----
// frames a screen body (line[]); auto-sizes to
// the widest line so nothing ever spills out.
function device(title, body) {
  const bar = '[ ' + title + ' ]';
  const all = body.concat([bar]);
  const W = Math.max(...all.map(l => l.length)) + 1;
  const top = '.' + '-'.repeat(W + 1) + '.';
  const bot = "'" + '-'.repeat(W + 1) + "'";
  const row = s => '| ' + padTo(s, W) + '|';
  return [top, row(bar), row(''),
          ...body.map(row), bot].join('\n');
}
function padTo(s, w) {
  return s.length >= w ? s
    : s + ' '.repeat(w - s.length);
}

// ---- screen: calculator ----
const KEYS = [
  ['7', '8', '9', '/'],
  ['4', '5', '6', '*'],
  ['1', '2', '3', '-'],
  ['0', '.', '=', '+'],
  ['(', ')', '^', 'C'],
];
function renderCalc(state) {
  const W = 19;                    // display width
  const live = state.value == null
    ? '' : '= ' + trimNum(state.value);
  const body = [
    ' ' + display(state.display, W),
    ' ' + display(live, W),
    '',
    ...keypad(KEYS),
    '',
    ' < back  = eval  C clear',
  ];
  return device(state.mode, body);
}
function trimNum(v) {
  return String(Math.round(v * 1e10) / 1e10);
}

module.exports = {
  button, display, keyRow, keypad, device,
  renderCalc,
};
