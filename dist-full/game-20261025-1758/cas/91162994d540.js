/* online/boot.js — loaded right after core.js: with ?online the page is the online game's client. The world, the
   hero's level, bag, skills and every reward live on the Go server, so nothing of the offline save is read or written:
   the page runs as a fresh, unsaved game (NC.ONLINE: js/core.js) under the lobby (online/lobby.js), without the title film, and the
   server's snapshots fill it (online/world.js). Without ?online nothing here does anything.
   Every online page shows the player menu (NC.PLAYER_VIEW: js/menuwin.js, js/online/flow.js). */
(function () {
  'use strict';
  if (!window.NC.ONLINE) return;
  // The address carries the server and its key, nothing else (2026-10-21, the owner: "ลบสวิชออกให้หมด อย่าให้เหลือ"):
  // whatever else a link adds is dropped at once (and nothing would read it: the game has no test switches).
  const q = new URLSearchParams(location.search);
  let changed = false;
  for (const k of [...q.keys()]) if (k !== 'online' && k !== 'serverkey') { q.delete(k); changed = true; }
  if (changed) history.replaceState(null, '', location.pathname + '?' + q.toString().replace(/=(&|$)/g, '$1') + location.hash);
  // The page's real address, kept for the code that must go back to this build's file (update.js, servers.js).
  // The public site shows only its root (the owner, 2026-10-20: "ให้ขึ้นแค่ https://play.nightcamp.app"): the long
  // /game-<stamp>/index.html?online=…&serverkey=… is swapped for "/" once the page has loaded and every script has read it;
  // build_web.py --build puts <base data-nc-site> in the page so the files that load later still come from this folder,
  // and a reload of "/" goes through the site's root page to the newest build. Local pages keep their address.
  window.NC.PAGE = Object.freeze({ path: location.pathname, search: location.search, hash: location.hash });
  if (document.querySelector('base[data-nc-site]')) {
    addEventListener('load', function hideAddress() {
try { history.replaceState(null, '', '/'); } catch (e) { /* the address stays as it is */ }
    }, { once: true });
  }
  document.documentElement.classList.add('nc-online');
  window.NC.PLAYER_VIEW = true; document.documentElement.classList.add('nc-player');
})();
