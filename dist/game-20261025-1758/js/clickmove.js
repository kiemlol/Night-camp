/* clickmove.js — right-click the ground to walk there using Travel's collision-safe paths.
   Keyboard/joystick walking and left-click attacks keep their existing controls. PlayerMenu's earlier
   capture listener still owns clicks on other heroes. Load after playermenu.js and questauto.js. */
(function () {
  'use strict';
  const NC = window.NC;
  const editing = (el) => el && (['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName) || el.isContentEditable);
  function available(game) {
    return !!(game && game.player && game.world && game.player.dead <= 0 && !game.paused && !game.hold && !game.warping &&
      NC.Travel && NC.Auto && NC.Auto.findPath && !editing(document.activeElement));
  }
  function go(game, x, y) {
    if (!available(game) || !Number.isFinite(x) || !Number.isFinite(y)) return false;
    const p = game.player, T = NC.Travel;
    const path = NC.Auto.findPath(game, p.x, p.y, x, y);
    const end = path && path[path.length - 1];
    // The pathfinder ends on safe ground when a click falls inside a tree or a river bank.
    if (!end || !game.world.fits(end[0], end[1], 20)) {
      if (T.on && T.target && T.target.clickMove) T.stop('');
      if (game.toast) game.toast('เดินไปจุดนี้ไม่ได้');
      return false;
    }
    if (NC.QuestAuto && NC.QuestAuto.on) NC.QuestAuto.stop('');
    if (!T.go(game, { map: game.mapId, x: end[0], y: end[1], r: 12, name: 'จุดที่คลิก', clickMove: true })) return false;
    if (NC.FX && NC.FX.ring) NC.FX.ring(end[0], end[1], 10, 55, '110,245,170', 0.45, 4);
    return true;
  }
  NC.ClickMove = { go };
  addEventListener('mousedown', (e) => {
    const view = document.getElementById('view'), game = NC.game;
    if (e.button !== 2 || !view || e.target !== view || !available(game)) return;
    // Do not let the old canvas right-click duel fallback interpret a ground order as a challenge.
    e.preventDefault(); e.stopImmediatePropagation();
    const rect = view.getBoundingClientRect();
    if (!(rect.width > 0 && rect.height > 0 && game.scale > 0)) return;
    const x = game.cam.x + (e.clientX - rect.left) * view.width / rect.width / game.scale;
    const y = game.cam.y + (e.clientY - rect.top) * view.height / rect.height / game.scale;
    go(game, x, y);
  }, true);
})();
