#!/usr/bin/env node
/* ==============================================
 * CLI harness  —  thinnest GUI   (<=50 col house)
 * Two verbs only: SEND ACTIONS, OBSERVE STATE.
 * The business logic never knows this exists.
 *
 *   node cli.js                 interactive
 *   node cli.js 2 + 3 '*' 4 =   batch
 *   node cli.js --uri calc://value 2 + 3 =
 * ============================================ */

'use strict';

const readline = require('readline');
const { createRuntime } = require('./core');
const { machine } = require('./calculator');

// EFFECT PROCESSORS. 'speak' is TTS on a phone,
// console here. Same react(), different host.
const processors = {
  speak: async fx => {
    process.stdout.write('\n  (speak) ' + fx.text + '\n');
    return [];
  },
  'effect/unhandled': async () => [],
};

const rt = createRuntime(machine, { processors });

async function feed(keys) {
  for (const k of keys)
    await rt.dispatch({ type: 'KEY', key: k });
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length && !args.includes('-i')) {
    let uri = null; const keys = [];
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--uri') { uri = args[++i]; continue; }
      keys.push(args[i]);
    }
    await feed(keys);
    console.log(uri ? rt.resolve(uri) : rt.render());
    return;
  }
  console.log('\n keys 0-9 . + - * / ^ ( )  '
    + '=eval C clear <back q quit\n');
  console.log(rt.render());
  const rl = readline.createInterface({
    input: process.stdin, output: process.stdout,
    prompt: '\n > ',
  });
  rl.prompt();
  rl.on('line', async line => {
    const s = line.trim();
    if (s === 'q') return rl.close();
    if (s === 'log')
      return say(rt.getLog().map(e =>
        '  #' + e._seq + ' ' + e.type + ' '
        + (e.key || e.value || '')).join('\n'), rl);
    if (s.startsWith('uri '))
      return say('  ' + JSON.stringify(
        rt.resolve(s.slice(4).trim())), rl);
    for (const c of s.replace(/\s+/g, ''))
      await rt.dispatch({ type: 'KEY', key: c });
    console.clear();
    console.log(rt.render());
    rl.prompt();
  });
  rl.on('close', () => {
    console.log('\n bye.\n'); process.exit(0);
  });
}
function say(msg, rl) { console.log(msg); rl.prompt(); }

main();
