/* ==============================================
 * CONVERSATION UI  — ascii cards (<=50 col house)
 * ----------------------------------------------
 * Renders the RUBRIC (the fair, stripped view) as
 * a stack of swipeable cards. Each card shows the
 * flattened text, a hermetic tag, the wager count,
 * and a verdict slot: '?' until revealed, then
 * HUMAN / AGENT. Role and kind never leak here.
 *
 * NON-CAPTIVE: swiping is not possible in a pipe,
 * so the legend names the gesture -> action:
 *   left = human, right = agent (PlaceWager).
 * ============================================ */

'use strict';

function pad(s, w) {
  s = String(s);
  return s.length >= w
    ? s.slice(0, w) : s + ' '.repeat(w - s.length);
}

function frame(title, body) {
  const bar = '[ ' + title + ' ]';
  const W = Math.max(
    ...body.concat([bar]).map(l => l.length)) + 1;
  const row = s => '| ' + pad(s, W) + '|';
  const edge = c => c + '-'.repeat(W + 1) + c;
  return [edge('.'), row(bar), row(''),
    ...body.map(row), edge("'")].join('\n');
}

// one card = 2 lines: text, then meta strip
function card(c) {
  const verdict = c.revealed
    ? c.revealed.toUpperCase() : '?';
  const herm = c.hermetic ? ' [sealed]' : '';
  const meta = '  ' + c.id + herm
    + '  wagers:' + c.wagers
    + '  verdict:' + verdict;
  return [' "' + clip(c.text, 30) + '"', meta, ''];
}
function clip(s, n) {
  s = String(s);
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

function renderConv(state, rubric) {
  const body = [];
  for (const c of rubric) body.push(...card(c));
  body.push('-'.repeat(30));
  body.push(' pot: ' + state.pot
    + '   ' + scoreLine(state.scores));
  body.push(' left=human  right=agent  (wager)');
  return frame('who is it?', body);
}
function scoreLine(scores) {
  const keys = Object.keys(scores);
  if (!keys.length) return 'no scores yet';
  return keys.map(k => k + ':' + scores[k]).join(' ');
}

module.exports = { renderConv };
