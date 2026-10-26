/* uifix.js — the part of the UI audit's fixes (2026-10-17, css/uifix.css) that needs a measurement.
     the hotbar   on wide screens hudtidy puts the chat, the hotbar and the menu column on one row, but the hotbar has grown
                  since (8 skill keys, 2 potions, the arts 7/8, the dash): at 16:9 it slid under the chat (the Q slot and
                  the Base EXP bar) and under the menu tray. When the row is too short it is now centred in the room left
                  between them and scaled down just enough (from its bottom edge). Measured on resize and every second
                  (slots come and go). Phones have their own HUD (js/mobile.js): nothing to do there. */
(function () {
  'use strict';
  let last = '';
  function fitHotbar() {
    const hb = document.querySelector('#hud .hotbar');
    if (!hb) return;
    if (document.documentElement.classList.contains('mob') || !hb.getClientRects().length) { if (last) { hb.style.left = hb.style.transform = hb.style.transformOrigin = ''; last = ''; } return; }
    hb.style.left = ''; hb.style.transform = ''; // (the natural place, read in the same task: no flicker)
    const H = hb.getBoundingClientRect();
    const box = (sel) => { const e = document.querySelector(sel); return e && e.getClientRects().length ? e.getBoundingClientRect() : null; };
    const C = box('#hud .chatwin'), B = box('#hud .hud-br');
    const beside = (R) => R && R.bottom > H.top + 6 && R.top < H.bottom - 6; // (on the hotbar's row)
    const L = beside(C) ? C.right + 12 : 8, R = beside(B) ? B.left - 12 : innerWidth - 8;
    if (H.left >= L && H.right <= R) { last = ''; return; }
    const room = R - L, s = Math.min(1, room / H.width);
    hb.style.transformOrigin = '50% 100%';
    hb.style.left = (L + room / 2).toFixed(1) + 'px';
    hb.style.transform = `translateX(-50%) scale(${s.toFixed(3)})`;
    last = s.toFixed(3);
  }
  addEventListener('resize', () => setTimeout(fitHotbar, 60));
  setInterval(fitHotbar, 1000);
  const NC = window.NC;
  if (NC && NC.HUD && NC.HUD.init) {
    const baseInit = NC.HUD.init.bind(NC.HUD);
    NC.HUD.init = function (game) { baseInit(game); setTimeout(fitHotbar, 0); };
  }
  if (NC) NC.UIFix = { fitHotbar };
})();
