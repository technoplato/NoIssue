/* ==============================================
 * ARCHETYPE: navigation      (<=50 col house)
 * ----------------------------------------------
 * NEXT.md item 4 + Michael's ask: navigation
 * is STATE, and the route table is a
 * PARSER-PRINTER (parse.js). One spec is the
 * whole truth about which screens exist:
 *
 *   decide() judges a destination by PARSING
 *   it — an unparseable route becomes a
 *   Rejected fact, never a broken screen.
 *   react() asks the world to PRINT state
 *   back into the address bar (a 'hash'
 *   effect; the browser wires it to
 *   location.hash, tests wire a spy).
 *
 * Settings are folded state too (glyph size,
 * sound), so they replay and sync like every
 * other fact. The current screen is
 * addressable:
 *   aces://<user>/device/<id>/screen
 *
 * ACES letters, owned by this archetype:
 *   ACTION  {type:'NAVIGATE', to}
 *           {type:'BACK'}
 *           {type:'SET', key, value}
 *   EVENT   NavigatedTo|WentBack|
 *           SettingChanged|Rejected
 *   EFFECT  {type:'hash', text}
 *   STATE   {screen, stack, settings}
 * ============================================ */

'use strict';

const P = require('./parse');

// -- the route table: one parser-printer ------
// Adding a screen = adding a line HERE; decide,
// the address bar, and render all follow.
const SCREENS = ['calc', 'store', 'ledger',
  'platform', 'settings'];
const route = P.alt(...SCREENS.map(name =>
  P.tag(name, { screen: name })));

// settings the archetype will accept, with
// their closed sets of legal values.
const SETTINGS = {
  glyph: ['sm', 'md', 'lg'],
  sound: [true, false],
};

const machine = {
  initial: {
    screen: 'calc',
    stack: [],                // for BACK
    settings: { glyph: 'md', sound: true },
  },

  decide(state, action) {
    const a = action || {};
    if (a.type === 'NAVIGATE') {
      const dest = P.parseAll(route,
        String(a.to || ''));
      if (!dest)
        return [{ type: 'Rejected',
          reason: 'no-such-screen',
          to: a.to }];
      if (dest.screen === state.screen)
        return [];             // already there
      return [{ type: 'NavigatedTo',
        screen: dest.screen }];
    }
    if (a.type === 'BACK')
      return state.stack.length
        ? [{ type: 'WentBack' }]
        : [{ type: 'Rejected',
            reason: 'nothing-back' }];
    if (a.type === 'SET') {
      const legal = SETTINGS[a.key];
      if (!legal || !legal.some(v =>
          v === a.value))
        return [{ type: 'Rejected',
          reason: 'no-such-setting',
          key: a.key, value: a.value }];
      if (state.settings[a.key] === a.value)
        return [];
      return [{ type: 'SettingChanged',
        key: a.key, value: a.value }];
    }
    return [];
  },

  evolve(state, ev) {
    if (ev.type === 'NavigatedTo')
      return { ...state,
        stack: [...state.stack, state.screen],
        screen: ev.screen };
    if (ev.type === 'WentBack')
      return { ...state,
        screen: state.stack[
          state.stack.length - 1],
        stack: state.stack.slice(0, -1) };
    if (ev.type === 'SettingChanged')
      return { ...state, settings: {
        ...state.settings,
        [ev.key]: ev.value } };
    return state;
  },

  // after any move, ask the world to show the
  // printed route in its address bar. PRINT is
  // the same spec that validated the parse.
  react(state, ev) {
    if (ev.type === 'NavigatedTo' ||
        ev.type === 'WentBack')
      return [{ type: 'hash',
        text: route.print(
          { screen: state.screen }) }];
    return [];
  },

  resolve(state, uri) {
    const f = uri
      .replace(/^nav:\/\//, '')
      .replace(/^.*\/device\/[^/]+\//, '');
    if (f === 'screen') return state.screen;
    if (f === 'stack') return state.stack;
    if (f === 'settings')
      return state.settings;
    throw new Error('no such uri: ' + uri);
  },

  // dogfood: render through view.js nodes
  render(state) {
    const V = require('./view');
    const rows = SCREENS.map(s =>
      V.text((s === state.screen
        ? '> ' : '  ') + s));
    const set = Object.entries(state.settings)
      .map(([k, v]) =>
        V.text('  ' + k + ' = ' + v));
    return V.toAscii(V.box('navigation',
      ...rows,
      V.text(''),
      V.text('settings'),
      ...set));
  },
};

module.exports =
  { machine, route, SCREENS, SETTINGS };
