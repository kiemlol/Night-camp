/* The web online client's side of the world clock (backend/clock.go, plan F17). Offline each page counts its own day
   from 23:40 (js/game.js:33, :150: a game minute every two seconds). Online there is one clock for everyone, a pure
   function of the server time every snapshot carries (`serverTime`, ms): so the sky, the HUD dial and every rule that
   reads the hour (the lightkeeper's night light) agree with the server. The page keeps counting between snapshots.
   Load after daynight.js and online/conn.js, before game.js. The current client uses NC.Online's snapshot event;
   the window event remains for the older online.js client. */
(function () {
  'use strict';
  const NC = window.NC;
  const MINUTES_PER_SECOND = 0.5, DAY_MINUTES = 1440; // backend clockMinutesPerSecond, dayMinutes
  const Clock = (NC.WorldClock = {
    /** The world's time of day, 0..1440, at a server time in ms (backend worldMinutes). */
    minutes(serverTime) {
      const m = ((serverTime / 1000) * MINUTES_PER_SECOND) % DAY_MINUTES;
      return m < 0 ? m + DAY_MINUTES : m;
    },
  });
  function apply(snapshot) {
    const at = snapshot?.serverTime, game = NC.game;
    if (!game || typeof at !== 'number' || !Number.isFinite(at)) return;
    game.minutes = Clock.minutes(at);
  }
  const O = NC.Online;
  if (O && O.enabled && typeof O.on === 'function') {
    // Full and delta snapshots both carry the world's time, even with no change to the hero's record.
    O.on('snapshot', apply);
    const offlineRate = NC.clockRate;
    NC.clockRate = function () {
      // The server advances uniformly; the offline game's accelerated daytime would drift between snapshots.
      return O.enabled ? 1 : offlineRate ? offlineRate.apply(this, arguments) : 1;
    };
  }
  window.addEventListener('nightcamp:online-snapshot', (event) => apply(event.detail?.snapshot));
})();
