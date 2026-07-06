/* ==============================================
 * ARCHETYPE: token ledger    (<=50 col house)
 * ----------------------------------------------
 * The token economy for the games, as an
 * event-sourced ledger. TOKENS ARE LEDGER
 * UNITS, NOT MONEY: nothing in this file
 * touches a payment rail. Real rails (Stripe,
 * a Solana wallet, HTTP-402/x402) live behind
 * processors OUTSIDE the fold; when one of
 * them confirms a real-world purchase, that
 * confirmation enters as a RecordPurchase
 * ACTION and the mint becomes a fact here.
 *
 * FAIRNESS RULES — Michael's explicit design,
 * enforced mechanically, so "nothing of a
 * ponzi nature is possible" by construction:
 *
 *  1. NO UNBACKED MINT. Tokens exist only as
 *     a fact that references a recorded
 *     external purchase (source + ref +
 *     cents). No purchase, no mint.
 *  2. NO DOUBLE MINT. A backing ref is
 *     consumed forever; replaying the same
 *     Shopify order mints nothing twice.
 *  3. CONSERVATION. sum(balances) is always
 *     exactly minted - burned. Tokens never
 *     appear or vanish inside the fold.
 *  4. NO NEGATIVES. You spend what you hold.
 *  5. GENESIS HUMILITY. The genesis wallet
 *     (Michael's) may never end richer than
 *     ANY other account: every other account
 *     always holds >= what genesis holds.
 *     Genesis cannot mint to itself, and any
 *     event that would leave genesis above
 *     someone is Rejected.
 *
 * decide() proves an action safe by folding
 * the candidate events over a scratch copy
 * with the real evolve, then checking the
 * invariants — the fold is its own oracle.
 *
 * RATE: 100 tokens per cent. The $14.28
 * Shopify emoji = 1428 cents = 142,800
 * tokens (his "about 100x the value" seed).
 *
 * ACES letters, owned by this archetype:
 *   ACTION  RecordPurchase|Transfer|Burn
 *   EVENT   TokensMinted|Transferred|
 *           Burned|Rejected
 *   EFFECT  {type:'notify', text}
 *   STATE   {genesis, accounts, minted,
 *            burned, refs}
 * ============================================ */

'use strict';

const RATE = 100;    // tokens per cent

const posInt = n =>
  Number.isInteger(n) && n > 0;

// the standing law of the ledger. Exported so
// tests (and audits) can hold any state to it.
function violation(state) {
  const g = state.genesis;
  let sum = 0;
  for (const [id, bal] of
       Object.entries(state.accounts)) {
    if (!Number.isInteger(bal) || bal < 0)
      return 'negative-balance:' + id;
    sum += bal;
    if (id !== g &&
        bal < (state.accounts[g] || 0))
      return 'genesis-humility';
  }
  if (sum !== state.minted - state.burned)
    return 'conservation';
  return null;
}

function createLedger(genesis) {
  genesis = genesis || 'genesis';

  const initial = {
    genesis,
    accounts: { [genesis]: 0 },
    minted: 0, burned: 0,
    refs: {},          // consumed backing refs
  };

  function evolve(state, ev) {
    const acc = { ...state.accounts };
    if (ev.type === 'TokensMinted') {
      acc[ev.account] =
        (acc[ev.account] || 0) + ev.amount;
      return { ...state, accounts: acc,
        minted: state.minted + ev.amount,
        refs: { ...state.refs,
          [ev.backing.ref]: true } };
    }
    if (ev.type === 'Transferred') {
      acc[ev.from] = acc[ev.from] - ev.amount;
      acc[ev.to] =
        (acc[ev.to] || 0) + ev.amount;
      return { ...state, accounts: acc };
    }
    if (ev.type === 'Burned') {
      acc[ev.account] =
        acc[ev.account] - ev.amount;
      return { ...state, accounts: acc,
        burned: state.burned + ev.amount };
    }
    return state;
  }

  // fold candidates on a scratch copy; any
  // broken law turns the WHOLE action into a
  // single Rejected fact. Never throws.
  function guarded(state, events) {
    let s = state;
    for (const e of events) s = evolve(s, e);
    const law = violation(s);
    return law
      ? [{ type: 'Rejected', reason: law }]
      : events;
  }

  function decide(state, action) {
    const a = action || {};

    if (a.type === 'RecordPurchase') {
      if (!a.account || !a.source || !a.ref)
        return [{ type: 'Rejected',
          reason: 'purchase-incomplete' }];
      if (a.account === genesis)
        return [{ type: 'Rejected',
          reason: 'genesis-cannot-mint' }];
      if (!posInt(a.cents))
        return [{ type: 'Rejected',
          reason: 'bad-cents', got: a.cents }];
      if (state.refs[a.ref])
        return [{ type: 'Rejected',
          reason: 'ref-already-minted',
          ref: a.ref }];
      return guarded(state, [{
        type: 'TokensMinted',
        account: a.account,
        amount: a.cents * RATE,
        backing: { cents: a.cents,
          source: a.source, ref: a.ref },
      }]);
    }

    if (a.type === 'Transfer') {
      if (!posInt(a.amount) || !a.from ||
          !a.to || a.from === a.to)
        return [{ type: 'Rejected',
          reason: 'bad-transfer' }];
      if ((state.accounts[a.from] || 0) <
          a.amount)
        return [{ type: 'Rejected',
          reason: 'insufficient',
          from: a.from }];
      return guarded(state, [{
        type: 'Transferred', from: a.from,
        to: a.to, amount: a.amount }]);
    }

    if (a.type === 'Burn') {
      if (!posInt(a.amount) ||
          (state.accounts[a.account] || 0)
            < a.amount)
        return [{ type: 'Rejected',
          reason: 'bad-burn' }];
      return guarded(state, [{
        type: 'Burned', account: a.account,
        amount: a.amount,
        why: a.why || '' }]);
    }

    return [];
  }

  function react(state, ev) {
    if (ev.type === 'TokensMinted')
      return [{ type: 'notify',
        text: ev.amount + ' tokens -> ' +
          ev.account + ' (backed by ' +
          ev.backing.source + ' ' +
          ev.backing.ref + ')' }];
    return [];
  }

  function render(state) {
    const V = require('./view');
    const rows = Object.entries(state.accounts)
      .sort((a, b) => b[1] - a[1])
      .map(([id, bal]) => V.text(
        (id === genesis ? id + ' *' : id)
          .padEnd(14) +
        String(bal).padStart(10)));
    return V.toAscii(V.box('ledger',
      ...rows,
      V.text(''),
      V.text('minted ' + state.minted +
        '  burned ' + state.burned),
      V.text('* genesis (must stay poorest)')));
  }

  function resolve(state, uri) {
    const f = uri
      .replace(/^ledger:\/\//, '')
      .replace(/^.*\/ledger\/[^/]+\//, '');
    if (f === 'supply')
      return state.minted - state.burned;
    if (f.startsWith('balance/'))
      return state.accounts[
        f.slice('balance/'.length)] || 0;
    throw new Error('no such uri: ' + uri);
  }

  return { initial, decide, evolve, react,
    render, resolve };
}

module.exports = {
  createLedger, violation, RATE,
  machine: createLedger('genesis'),
};
