/* ==============================================
 * LLM — senses as DEPENDENCIES (<=50 col house)
 * ----------------------------------------------
 * Michael's rule: dependencies are the things
 * that cause side effects. So the assistant's
 * three senses — an LLM (Large Language
 * Model), a speech listener, and a way to ask
 * the human a yes/no — are modeled exactly
 * like deps.js models the world:
 *
 *   unimplementedSenses()  every call THROWS
 *                          (the test default)
 *   scriptedSenses(script) deterministic
 *                          doubles for tests
 *   browserSenses(w)       Chrome's on-device
 *                          Prompt API (Gemini
 *                          Nano) + Web Speech
 *
 * Swapping this ONE bag is what moves the
 * assistant between planets: browser today, a
 * CLI tomorrow (readline listener + remote
 * LLM), a server the day after. The archetype
 * (assistant.js) never knows which world it
 * woke up in — same doctrine as sync.js.
 *
 * Every face has the same shape:
 *   llm:    detect() -> bool | Promise<bool>
 *           generate({system, prompt})
 *             -> Promise<string>
 *   speech: detect() -> bool
 *           listen() -> Promise<string>
 *   ask:    confirm(text) -> Promise<bool>
 * ============================================ */

'use strict';

function unimplemented(label) {
  return () => {
    throw new Error(
      'unimplemented sense: ' + label);
  };
}

// the safe default: a test that reaches an
// unwired sense dies loudly, never silently.
function unimplementedSenses() {
  return {
    llm: {
      detect: () => false,
      generate: unimplemented('llm.generate'),
    },
    speech: {
      detect: () => false,
      listen: unimplemented('speech.listen'),
    },
    ask: {
      confirm: unimplemented('ask.confirm'),
    },
  };
}

/* scripted doubles. script = {
 *   llm: true, speech: true, yes: true,
 *   phrases: ['nine times six'],   // heard
 *   replies: ['{"target":...}'],   // llm out
 * } — arrays are consumed in order.
 */
function scriptedSenses(script) {
  const s = script || {};
  const phrases = (s.phrases || []).slice();
  const replies = (s.replies || []).slice();
  return {
    llm: {
      detect: () => !!s.llm,
      generate: async () =>
        replies.length
          ? replies.shift()
          : '(silence)',
    },
    speech: {
      detect: () => !!s.speech,
      listen: async () =>
        phrases.length
          ? phrases.shift() : '',
    },
    ask: {
      confirm: async () => !!s.yes,
    },
  };
}

/* the live browser world. `w` = window.
 * - LLM: Chrome's built-in Prompt API
 *   (window.LanguageModel, Gemini Nano,
 *   on-device). detect() is honest: it asks
 *   availability(), it does not guess.
 * - speech: Web Speech API, one utterance
 *   per listen() call.
 * - ask: confirm() — primitive but honest.
 */
function browserSenses(w) {
  return {
    llm: {
      detect: async () => {
        try {
          if (!w.LanguageModel) return false;
          const a = await
            w.LanguageModel.availability();
          return a !== 'unavailable';
        } catch (e) { return false; }
      },
      generate: async ({ system, prompt }) => {
        const s = await w.LanguageModel.create(
          { initialPrompts: [{ role: 'system',
            content: system }] });
        try { return await s.prompt(prompt); }
        finally { s.destroy && s.destroy(); }
      },
    },
    speech: {
      detect: () =>
        !!(w.SpeechRecognition ||
           w.webkitSpeechRecognition),
      listen: () => new Promise((res, rej) => {
        const R = w.SpeechRecognition ||
          w.webkitSpeechRecognition;
        const r = new R();
        r.lang = 'en-US';
        r.onresult = ev => res(
          ev.results[0][0].transcript);
        r.onerror = ev =>
          rej(new Error(ev.error));
        r.start();
      }),
    },
    ask: {
      confirm: async text => w.confirm(text),
    },
  };
}

module.exports = {
  unimplementedSenses,
  scriptedSenses,
  browserSenses,
};
