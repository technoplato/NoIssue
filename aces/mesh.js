/* ==============================================
 * MESH  —  wire a node to sync   (<=50 col house)
 * ----------------------------------------------
 * Elixir-ish: send an action to ONE node; its
 * events fan out to the others. connect() does
 * the two-way bridge for a runtime:
 *   OUT  local-origin events  -> sync.publish
 *   IN   remote events        -> runtime.ingest
 * Echoes are filtered by _origin, so nothing
 * loops. Returns an unsubscribe.
 * ============================================ */

'use strict';

function connect(rt, sync) {
  // OUT: publish only what THIS node decided.
  const off1 = rt.subscribe(m => {
    if (m.t !== 'event') return;
    if (m.e._origin !== rt.nodeId) return;
    sync.publish(m.e);
  });
  // IN: ingest what OTHER nodes decided.
  const off2 = sync.subscribe(e => {
    if (e._origin === rt.nodeId) return;
    rt.ingest(e);
  });
  return () => { off1(); off2(); };
}

module.exports = { connect };
