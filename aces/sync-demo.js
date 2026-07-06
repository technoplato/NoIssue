#!/usr/bin/env node
/* two calculators, one bus. Type on A only.  */
'use strict';
const { createRuntime } = require('./core');
const calc = require('./calculator');
const { createBus, inMemorySync } = require('./sync');
const { connect } = require('./mesh');

(async () => {
  const bus = createBus();
  const A = createRuntime(calc.machine, { nodeId: 'A' });
  const B = createRuntime(calc.machine, { nodeId: 'B' });
  connect(A, inMemorySync(bus));
  connect(B, inMemorySync(bus));

  const keys = ['1', '2', '*', '(', '3', '+', '4', ')'];
  for (const k of keys)
    await A.dispatch({ type: 'KEY', key: k });
  await new Promise(r => setTimeout(r, 5));

  console.log('actions sent to A only:',
    keys.join(' '));
  console.log('\nNODE A            NODE B');
  const la = A.render().split('\n');
  const lb = B.render().split('\n');
  for (let i = 0; i < la.length; i++)
    console.log(pad(la[i]) + '  ' + (lb[i] || ''));
  console.log('\nA.value =', A.getState().value,
    ' B.value =', B.getState().value,
    ' (B never touched)');
})();
function pad(s) { return s + ' '.repeat(Math.max(0, 16 - s.length)); }
