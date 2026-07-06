/* ==============================================
 * ARCHETYPE: conversation        (<=50 col house)
 * The stacking game itself.
 * ----------------------------------------------
 * A conversation is a strip of MESSAGES between
 * participants. Each participant is secretly a
 * HUMAN or an AGENT; the whole game is guessing
 * which. Bettors place a WAGER on each message
 * block; a REVEAL settles the pot.
 *
 * Two fairness rules baked into the data:
 *  1. RUBRIC STRIPPING. When a bettor judges a
 *     message, the view hides its ROLE (human/
 *     agent) AND its KIND (text/tool/research).
 *     A tool_call would give the game away, so
 *     the rubric shows only the final CONTENT,
 *     every message flattened to one shape.
 *  2. HERMETIC flag. An agent message may be
 *     produced in a sealed sandbox — no human
 *     input or output, tools only. We record it
 *     as a property of the fact, not a claim to
 *     trust later.
 *
 * ACES letters are OWNED here.
 *   ACTION  PostMessage|PlaceWager|Reveal
 *   EVENT   MessagePosted|WagerPlaced|
 *           TruthRevealed|WagerSettled|Rejected
 *   EFFECT  {type:'notify', text}
 *   STATE   {messages,wagers,revealed,scores,pot}
 *
 * evolve is a pure left-fold. Message ids are the
 * index ('m0','m1'), so decide stays pure — no
 * random, no clock inside the fold.
 * ============================================ */

'use strict';

const ROLES = new Set(['human', 'agent']);
const KINDS = new Set(['text', 'tool_call', 'research']);

// ---- helpers (pure) ----
function msgById(state, id) {
  return state.messages.find(m => m.id === id);
}
function wagersFor(state, id) {
  return state.wagers[id] || [];
}
function reject(reason, id) {
  return [{ type: 'Rejected', reason, id }];
}

// the sanitized text a bettor may see: a tool_call
// or research shows only its final output, flat.
function rubricText(m) {
  if (m.kind === 'text') return m.content;
  return m.output != null ? m.output
    : '(produced a result)';
}

// ---- decide helpers ----
function decidePost(state, a) {
  if (!ROLES.has(a.role))
    return reject('bad-role', null);
  if (!KINDS.has(a.kind))
    return reject('bad-kind', null);
  if (!a.content && a.output == null)
    return reject('empty', null);
  const id = 'm' + state.messages.length;
  return [{
    type: 'MessagePosted',
    id, role: a.role, kind: a.kind,
    content: a.content || '',
    output: a.output != null ? a.output : null,
    hermetic: !!a.hermetic,
  }];
}
function decideWager(state, a) {
  const m = msgById(state, a.messageId);
  if (!m) return reject('no-message', a.messageId);
  if (state.revealed[a.messageId])
    return reject('already-revealed', a.messageId);
  if (!ROLES.has(a.guess))
    return reject('bad-guess', a.messageId);
  if (!(a.stake > 0))
    return reject('bad-stake', a.messageId);
  return [{
    type: 'WagerPlaced',
    messageId: a.messageId, bettor: a.bettor,
    guess: a.guess, stake: a.stake,
  }];
}
// Reveal produces the truth fact AND one settled
// fact per open wager — every payout is auditable.
function decideReveal(state, a) {
  const m = msgById(state, a.messageId);
  if (!m) return reject('no-message', a.messageId);
  if (state.revealed[a.messageId])
    return reject('already-revealed', a.messageId);
  const out = [{
    type: 'TruthRevealed',
    messageId: a.messageId, role: m.role,
  }];
  for (const w of wagersFor(state, a.messageId)) {
    const won = w.guess === m.role;
    out.push({
      type: 'WagerSettled',
      messageId: a.messageId, bettor: w.bettor,
      won, delta: won ? w.stake : -w.stake,
    });
  }
  return out;
}

// ---- evolve helpers ----
function foldPosted(state, ev) {
  const m = {
    id: ev.id, role: ev.role, kind: ev.kind,
    content: ev.content, output: ev.output,
    hermetic: ev.hermetic,
  };
  return { ...state,
    messages: [...state.messages, m],
    lastReject: null };
}
function foldWager(state, ev) {
  const list = wagersFor(state, ev.messageId);
  return { ...state,
    wagers: { ...state.wagers,
      [ev.messageId]: [...list, {
        bettor: ev.bettor, guess: ev.guess,
        stake: ev.stake,
      }] },
    pot: state.pot + ev.stake,
    lastReject: null };
}
function foldRevealed(state, ev) {
  return { ...state,
    revealed: { ...state.revealed,
      [ev.messageId]: ev.role } };
}
function foldSettled(state, ev) {
  const s = { ...state.scores };
  s[ev.bettor] = (s[ev.bettor] || 0) + ev.delta;
  return { ...state, scores: s,
    pot: state.pot - Math.abs(ev.delta) };
}

const machine = {
  initial: {
    messages: [], wagers: {}, revealed: {},
    scores: {}, pot: 0, lastReject: null,
  },

  // DECIDE: sole judge of validity; refusals are
  // Rejected facts, never throws.
  decide(state, action) {
    const a = action || {};
    if (a.type === 'PostMessage')
      return decidePost(state, a);
    if (a.type === 'PlaceWager')
      return decideWager(state, a);
    if (a.type === 'Reveal')
      return decideReveal(state, a);
    return [];
  },

  // EVOLVE: pure fold of one fact -> state.
  evolve(state, ev) {
    if (ev.type === 'MessagePosted')
      return foldPosted(state, ev);
    if (ev.type === 'WagerPlaced')
      return foldWager(state, ev);
    if (ev.type === 'TruthRevealed')
      return foldRevealed(state, ev);
    if (ev.type === 'WagerSettled')
      return foldSettled(state, ev);
    if (ev.type === 'Rejected')
      return { ...state, lastReject: ev };
    return state;
  },

  // REACT: a reveal asks the world to announce it.
  react(state, ev) {
    if (ev.type !== 'TruthRevealed') return [];
    return [{ type: 'notify',
      text: 'revealed ' + ev.messageId
        + ' = ' + ev.role }];
  },

  // RESOLVE addresses state. The rubric view is
  // the fair judging surface — role + kind hidden.
  //   conv://rubric   all judgeable cards
  //   conv://scores   net per bettor
  //   conv://pot
  resolve(state, uri) {
    const f = uri
      .replace(/^conv:\/\//, '')
      .replace(/^.*\/conv\/[^/]+\//, '');
    if (f === 'rubric') return rubricView(state);
    if (f === 'scores') return state.scores;
    if (f === 'pot') return state.pot;
    if (f === 'messages') return state.messages;
    throw new Error('no such uri: ' + uri);
  },

  render(state) {
    const { renderConv } = require('./conversation-ui');
    return renderConv(state, rubricView(state));
  },
};

// the stripped, fair view: no role, no kind —
// unless a card is already revealed.
function rubricView(state) {
  return state.messages.map(m => {
    const role = state.revealed[m.id] || null;
    return {
      id: m.id,
      text: rubricText(m),
      hermetic: m.hermetic,
      revealed: role,           // null until reveal
      wagers: wagersFor(state, m.id).length,
    };
  });
}

module.exports = { machine, rubricView };
