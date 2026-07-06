/* ==============================================
 * ARCHETYPE: assistant       (<=50 col house)
 * ----------------------------------------------
 * "Talk to the calculator." The whole feature
 * is a fold + a bag of senses (llm.js):
 *
 *   MOUNT           the page/CLI woke up
 *    -> probe       do we HAVE speech + llm?
 *    -> offer       ask the human politely
 *    -> listen      one utterance
 *    -> interpret   LLM: words -> a PLAN
 *    -> perform     dispatch real actions
 *    -> listen      ... loop while enabled
 *
 * Every stage lands as a FACT, including the
 * refusals: no LLM on this planet is
 * OfferDeclined, LLM word-salad is Rejected.
 * Replay the log and you replay the whole
 * conversation with the machine.
 *
 * The LLM is fed (by the interpret PROCESSOR)
 * a catalog of live state + legal actions —
 * world.describe() — and must answer STRICT
 * JSON: {"target": "...", "actions": [...]}.
 * decide() validates that plan against the
 * allowed target list; the model gets no
 * authority the fold does not grant.
 *
 * Browser vs CLI is ONLY a senses swap
 * (llm.js): Chrome's on-device Gemini Nano
 * here, readline + any remote model there.
 * The archetype cannot tell the difference.
 *
 * ACES letters, owned by this archetype:
 *   ACTION  MOUNT|CAPS|ANSWER|HEARD|
 *           INTERPRETED|FAILED|STOP
 *   EVENT   Mounted|CapsProbed|OfferMade|
 *           OfferDeclined|Enabled|Disabled|
 *           Heard|Planned|Rejected
 *   EFFECT  probe|offer|listen|interpret|
 *           perform
 *   STATE   {phase, caps, heard, plans}
 * ============================================ */

'use strict';

// phases: idle -> probing -> offered ->
//         on | off  (off is terminal-polite)
function createAssistant(opts) {
  opts = opts || {};
  const targets = opts.targets ||
    ['calc', 'store', 'nav', 'ledger'];

  const planShape = p =>
    p && targets.includes(p.target) &&
    Array.isArray(p.actions) &&
    p.actions.length > 0 &&
    p.actions.every(a => a &&
      typeof a.type === 'string');

  return {
    initial: {
      phase: 'idle',
      caps: { speech: false, llm: false },
      heard: [], plans: 0,
    },

    decide(state, action) {
      const a = action || {};
      if (a.type === 'MOUNT')
        return state.phase === 'idle'
          ? [{ type: 'Mounted' }] : [];
      if (a.type === 'CAPS') {
        const both = a.speech && a.llm;
        return [both
          ? { type: 'OfferMade',
              caps: { speech: true,
                llm: true } }
          : { type: 'OfferDeclined',
              reason: !a.llm
                ? 'no-llm-on-this-planet'
                : 'no-speech-on-this-planet',
              caps: { speech: !!a.speech,
                llm: !!a.llm } }];
      }
      if (a.type === 'ANSWER')
        return [a.yes
          ? { type: 'Enabled' }
          : { type: 'Disabled',
              why: 'declined' }];
      if (a.type === 'HEARD')
        return state.phase !== 'on' ? [] :
          a.text && a.text.trim()
            ? [{ type: 'Heard',
                text: a.text.trim() }]
            : [];         // silence ends loop
      if (a.type === 'INTERPRETED')
        return planShape(a.plan)
          ? [{ type: 'Planned',
              plan: a.plan }]
          : [{ type: 'Rejected',
              reason: 'bad-plan',
              got: a.plan }];
      if (a.type === 'FAILED')
        return [{ type: 'Rejected',
          reason: a.stage + '-failed',
          why: String(a.why) }];
      if (a.type === 'STOP')
        return state.phase === 'on'
          ? [{ type: 'Disabled',
              why: 'stopped' }] : [];
      return [];
    },

    evolve(state, ev) {
      if (ev.type === 'Mounted')
        return { ...state, phase: 'probing' };
      if (ev.type === 'OfferMade')
        return { ...state, phase: 'offered',
          caps: ev.caps };
      if (ev.type === 'OfferDeclined')
        return { ...state, phase: 'off',
          caps: ev.caps };
      if (ev.type === 'Enabled')
        return { ...state, phase: 'on' };
      if (ev.type === 'Disabled')
        return { ...state, phase: 'off' };
      if (ev.type === 'Heard')
        return { ...state, heard:
          [...state.heard, ev.text] };
      if (ev.type === 'Planned')
        return { ...state,
          plans: state.plans + 1 };
      return state;
    },

    // every effect here is served by a senses
    // processor; results come back as ACTIONS.
    react(state, ev) {
      if (ev.type === 'Mounted')
        return [{ type: 'probe' }];
      if (ev.type === 'OfferMade')
        return [{ type: 'offer' }];
      if (ev.type === 'Enabled')
        return [{ type: 'listen' }];
      if (ev.type === 'Heard')
        return [{ type: 'interpret',
          text: ev.text }];
      if (ev.type === 'Planned')
        return [{ type: 'perform',
          plan: ev.plan },
          { type: 'listen' }];
      if (ev.type === 'Rejected' &&
          state.phase === 'on')
        return [{ type: 'listen' }];
      return [];
    },

    resolve(state, uri) {
      const f = uri
        .replace(/^assistant:\/\//, '');
      if (f === 'phase') return state.phase;
      if (f === 'heard') return state.heard;
      throw new Error('no such uri: ' + uri);
    },

    render(state) {
      const V = require('./view');
      return V.toAscii(V.box('assistant',
        V.text('phase  ' + state.phase),
        V.text('speech ' +
          state.caps.speech),
        V.text('llm    ' + state.caps.llm),
        V.text('heard  ' +
          state.heard.length +
          '  plans ' + state.plans)));
    },
  };
}

/* processorsFor(senses, world) — the bridge.
 * senses: llm.js bag. world: {
 *   describe() -> string   live state + the
 *                          action catalog
 *   perform(plan)          dispatch into the
 *                          target runtime
 *   offerText              the question
 * }
 * Results re-enter as actions via api
 * .dispatch — the runtime hands processors
 * that api as their 2nd argument (core.js).
 */
function processorsFor(senses, world) {
  const back = (api, action) =>
    api.dispatch(action);
  return {
    probe: async (fx, api) => {
      const [sp, lm] = await Promise.all([
        senses.speech.detect(),
        senses.llm.detect()]);
      await back(api, { type: 'CAPS',
        speech: !!sp, llm: !!lm });
      return [];
    },
    offer: async (fx, api) => {
      const yes = await senses.ask.confirm(
        world.offerText ||
        'Talk to the arcade with your ' +
        'voice? (on-device model)');
      await back(api,
        { type: 'ANSWER', yes });
      return [];
    },
    listen: async (fx, api) => {
      try {
        const text =
          await senses.speech.listen();
        await back(api,
          { type: 'HEARD', text });
      } catch (e) {
        await back(api, { type: 'FAILED',
          stage: 'listen', why: e.message });
      }
      return [];
    },
    interpret: async (fx, api) => {
      try {
        const raw = await
          senses.llm.generate({
            system: world.describe(),
            prompt: fx.text });
        const m = /\{[\s\S]*\}/.exec(raw);
        await back(api, {
          type: 'INTERPRETED',
          plan: m ? JSON.parse(m[0]) : null,
        });
      } catch (e) {
        await back(api, { type: 'FAILED',
          stage: 'interpret',
          why: e.message });
      }
      return [];
    },
    perform: async fx => {
      await world.perform(fx.plan);
      return [];
    },
  };
}

module.exports =
  { createAssistant, processorsFor };
