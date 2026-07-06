#!/usr/bin/env node
/* ==============================================
 * TEST-CONV  —  the game          (<=50 col)
 * proves: rubric hides role+kind, a tool_call
 * masquerades as text, wagers settle, replay holds.
 * ============================================ */

'use strict';
const { createRuntime } = require('./core');
const conv = require('./conversation');

let pass = 0, fail = 0;
function ok(n, c) {
  console.log((c ? '  ok   ' : '  FAIL ') + n);
  c ? pass++ : fail++;
}

async function main() {
  const notes = [];
  const rt = createRuntime(conv.machine, {
    nodeId: 'game',
    processors: { notify: async fx =>
      (notes.push(fx.text), []) },
  });

  // m0: a human text; m1: an AGENT tool_call whose
  // output masquerades as an ordinary line.
  await rt.dispatch({ type: 'PostMessage',
    role: 'human', kind: 'text',
    content: 'i grew up in Ohio' });
  await rt.dispatch({ type: 'PostMessage',
    role: 'agent', kind: 'tool_call',
    output: 'the capital of Ohio is Columbus',
    hermetic: true });

  const rubric = rt.resolve('conv://rubric');
  const leak = JSON.stringify(rubric);
  ok('rubric hides role', !/human|agent/.test(leak)
    || /revealed/.test(leak) && !/"role"/.test(leak));
  ok('rubric hides kind (no tool_call)',
    !/tool_call/.test(leak));
  ok('tool_call shows only its output',
    rubric[1].text === 'the capital of Ohio is Columbus');
  ok('hermetic flag survives to rubric',
    rubric[1].hermetic === true);

  // two bettors wager on m1 (the agent card)
  await rt.dispatch({ type: 'PlaceWager',
    messageId: 'm1', bettor: 'ren',
    guess: 'agent', stake: 10 });
  await rt.dispatch({ type: 'PlaceWager',
    messageId: 'm1', bettor: 'mishka',
    guess: 'human', stake: 10 });
  ok('pot holds both stakes (20)',
    rt.resolve('conv://pot') === 20);

  // reveal settles: ren right (+10), mishka wrong (-10)
  await rt.dispatch({ type: 'Reveal', messageId: 'm1' });
  const scores = rt.resolve('conv://scores');
  ok('winner +stake, loser -stake',
    scores.ren === 10 && scores.mishka === -10);
  ok('reveal fired a notify effect',
    notes.some(t => /m1 = agent/.test(t)));

  // cannot wager on a revealed card
  await rt.dispatch({ type: 'PlaceWager',
    messageId: 'm1', bettor: 'late',
    guess: 'human', stake: 5 });
  ok('wager after reveal is Rejected',
    rt.getState().lastReject &&
    rt.getState().lastReject.reason === 'already-revealed');

  // replay determinism
  const before = JSON.stringify(rt.getState().scores);
  const after = JSON.stringify(
    rt.replay(rt.getLog()).scores);
  ok('replay rebuilds identical scores', before === after);

  console.log('\n' + rt.render());
  console.log('\n  ' + pass + ' passed, '
    + fail + ' failed');
  process.exit(fail ? 1 : 0);
}
main();
