/* screenshake.js — camera shake and impact zoom stay off throughout the game.
   Load before the intro so films also start without shake (owner, 2026-10-18). */
(function () {
  'use strict';
  const NC = (window.NC = window.NC || {});
  const KEY = 'nightcamp.shake.v1';
  NC.ScreenShake = {
    enabled: () => false,
    // Keep the former settings API for callers with an older saved preference.
    set() {
      if (NC.game) NC.game.shake = 0;
      if (NC.GLFX && NC.GLFX.clearZoom) NC.GLFX.clearZoom();
      try { localStorage.setItem(KEY, 'off'); } catch (e) { /* storage blocked */ }
    },
  };
  NC.ScreenShake.set();
})();
