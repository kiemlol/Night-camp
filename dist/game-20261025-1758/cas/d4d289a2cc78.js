/* online/oldlooks.js — the server-driven looks the old online client drew, back online (2026-10-24,
   docs/team/online-missing-looks.md). The old client (js/online.js) re-sent every server event and snapshot as the window
   events nightcamp:online-event ({ ...event }) and nightcamp:online-snapshot ({ snapshot }), and each job's, the dungeon's
   online looks (js/online-<name>.js) listen there; the current client (online/conn.js) only has NC.Online.on(...), so
   none of them drew anything. This sends both window events from it, once each. The modules world.js already calls
   itself (online-meters, -wisp, -pets, -wolfhunter, -puppeteer, -statuses) no longer listen to the window, so
   nothing is handled twice. The old looks read the other heroes from NC.Online.remotes, which online/world.js keeps; their
   meters (the class-3 ring, the families' gauges) are copied onto them from each snapshot's players here, as the old
   client copied a hero's whole record.
   It starts once the page has loaded, so world.js has applied a snapshot (the mirrors made and moved) before the old looks
   read it. Load after online/conn.js and before the js/online-<name>.js files it serves. */
(function () {
  'use strict';
  const NC = window.NC, O = NC.Online;
  if (!O || !O.enabled || typeof O.on !== 'function') return;
  function start() {
    O.on('event', (ev) => {
      if (ev && typeof ev.type === 'string') window.dispatchEvent(new CustomEvent('nightcamp:online-event', { detail: { ...ev, receivedAt: performance.now() } }));
    });
    O.on('snapshot', (snap) => {
      if (!snap) return;
      const R = O.remotes;
      if (R && Array.isArray(snap.players)) for (const pl of snap.players) { const r = pl && R.get(pl.id); if (r) r.meters = pl.meters || {}; }
      window.dispatchEvent(new CustomEvent('nightcamp:online-snapshot', { detail: { snapshot: snap, receivedAt: performance.now() } }));
    });
  }
  if (typeof document !== 'undefined' && document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
