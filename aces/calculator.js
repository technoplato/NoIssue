/* ==============================================
 * ARCHETYPE: calculator          (<=50 col house)
 * ----------------------------------------------
 * The TI-8x reduced to its form: a strip of
 * TOKENS folded from KEY facts, projected into a
 * DISPLAY that eagerly shows the expression AND
 * its live value when the expression parses.
 *
 * ACES here, and note: every letter is OWNED by
 * this archetype. A "KEY" makes no sense to a
 * store; "AddToCart" makes none here.
 *   ACTION  {type:'KEY', key}
 *   EVENT   KeyPressed|Backspaced|Cleared|
 *           Evaluated
 *   EFFECT  {type:'speak', text}
 *   STATE   {tokens, display, value, mode}
 *
 * Precedence is NOT a fold trick. evolve just
 * appends the key to tokens; the value is
 * re-derived each event by evaluate() below,
 * a shunting-yard pass (see notes there).
 * ============================================ */

'use strict';

const DIG = new Set('0123456789'.split(''));
// op -> [precedence, associativity]
const OP = {
  '+': [2, 'L'], '-': [2, 'L'],
  '*': [3, 'L'], '/': [3, 'L'],
  '^': [4, 'R'],
};

// tokens -> RPN (shunting-yard) -> number.
// RPN = Reverse Polish Notation.
// This is where "3*4^2 = 48 not 144" is decided:
// ^ outranks *, and ^ is right-assoc so
// 2^3^2 = 2^(3^2). Returns {ok, value|error}.
function evaluate(tokens) {
  const out = [], st = [];
  for (const t of tokens) {
    if (t.kind === 'num') { out.push(t); continue; }
    if (t.kind === 'op') {
      const [p, a] = OP[t.text];
      while (st.length) {
        const top = st[st.length - 1];
        if (top.kind !== 'op') break;
        const [tp] = OP[top.text];
        if (tp > p || (tp === p && a === 'L'))
          out.push(st.pop());
        else break;
      }
      st.push(t);
    } else if (t.text === '(') st.push(t);
    else if (t.text === ')') {
      while (st.length &&
             st[st.length - 1].text !== '(')
        out.push(st.pop());
      if (!st.length) return badParen();
      st.pop();
    }
  }
  while (st.length) {
    const t = st.pop();
    if (t.text === '(') return badParen();
    out.push(t);
  }
  return evalRpn(out);
}
function badParen() {
  return { ok: false, error: 'paren' };
}
function evalRpn(rpnTokens) {
  const s = [];
  for (const t of rpnTokens) {
    if (t.kind === 'num') { s.push(t.value); continue; }
    if (s.length < 2)
      return { ok: false, error: 'partial' };
    const b = s.pop(), a = s.pop();
    s.push(apply(t.text, a, b));
  }
  if (s.length !== 1)
    return { ok: false, error: 'partial' };
  const v = s[0];
  if (!Number.isFinite(v))
    return { ok: false, error: 'math' };
  return { ok: true, value: v };
}
function apply(op, a, b) {
  if (op === '+') return a + b;
  if (op === '-') return a - b;
  if (op === '*') return a * b;
  if (op === '/') return a / b;
  return Math.pow(a, b);
}

// tokens -> canonical spaced expression string
function stringify(tokens) {
  if (!tokens.length) return '0';
  return tokens.map(t => t.text).join(' ')
    .replace(/\( /g, '(').replace(/ \)/g, ')');
}

// fold one key onto the token strip
function pushKey(tokens, key) {
  const last = tokens[tokens.length - 1];
  if (DIG.has(key) || key === '.') {
    if (last && last.kind === 'num') {
      if (key === '.' && last.text.includes('.'))
        return tokens;            // no 2nd dot
      return withText(tokens, last.text + key);
    }
    const text = key === '.' ? '0.' : key;
    return [...tokens, num(text)];
  }
  if (OP[key])
    return [...tokens, { kind: 'op', text: key }];
  if (key === '(' || key === ')')
    return [...tokens, { kind: 'paren', text: key }];
  return tokens;
}
function num(text) {
  return { kind: 'num', text, value: parseFloat(text) };
}
function withText(tokens, text) {
  return [...tokens.slice(0, -1), num(text)];
}
function trim(v) {
  return String(Math.round(v * 1e10) / 1e10);
}

const machine = {
  initial: {
    tokens: [], display: '0', value: null,
    mode: 'basic',
  },

  // DECIDE: only place an action is judged worthy
  // of becoming a fact.
  decide(state, action) {
    if (action.type !== 'KEY') return [];
    const k = action.key;
    if (k === 'C') return [{ type: 'Cleared' }];
    if (k === '<')
      return state.tokens.length
        ? [{ type: 'Backspaced' }] : [];
    if (k === '=')
      return state.value == null
        ? [] : [{ type: 'Evaluated', value: state.value }];
    if (OP[k] && !state.tokens.length && k !== '-')
      return [];               // op needs a lhs
    return [{ type: 'KeyPressed', key: k }];
  },

  // EVOLVE: fold the fact, re-derive projection
  evolve(state, ev) {
    let tokens = state.tokens;
    if (ev.type === 'KeyPressed')
      tokens = pushKey(tokens, ev.key);
    else if (ev.type === 'Backspaced')
      tokens = backspace(tokens);
    else if (ev.type === 'Cleared')
      tokens = [];
    else if (ev.type === 'Evaluated')
      tokens = [num(trim(ev.value))];
    const r = evaluate(tokens);
    return {
      ...state, tokens,
      display: stringify(tokens),
      value: r.ok ? r.value : null,
    };
  },

  // REACT: a deliberate '=' asks the world to
  // speak the answer (an EFFECT, not a fact).
  // TTS = Text To Speech (the 'speak' processor).
  react(state, ev) {
    if (ev.type === 'Evaluated')
      return [{ type: 'speak',
        text: 'equals ' + trim(ev.value) }];
    return [];
  },

  // RESOLVE: address any morsel of state.
  // Local form:  calc://display
  // Global form: aces://<user>/calc/<id>/display
  //   (the World layer strips the prefix and
  //    hands us just the field; see world.js)
  resolve(state, uri) {
    const f = uri
      .replace(/^calc:\/\//, '')
      .replace(/^.*\/calc\/[^/]+\//, '');
    if (f === 'display') return state.display;
    if (f === 'value')   return state.value;
    if (f === 'mode')    return state.mode;
    if (f === 'tokens')  return state.tokens;
    throw new Error('no such uri: ' + uri);
  },

  render(state) {
    const { renderCalc } = require('./ui');
    return renderCalc(state);
  },
};

function backspace(tokens) {
  const last = tokens[tokens.length - 1];
  if (last && last.kind === 'num'
      && last.text.length > 1)
    return withText(tokens, last.text.slice(0, -1));
  return tokens.slice(0, -1);
}

module.exports = { machine, evaluate };
