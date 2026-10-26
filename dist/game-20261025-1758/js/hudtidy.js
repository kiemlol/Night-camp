/* hudtidy.js — the main screen tidied (with css/hudtidy.css; the user: "ชอบคล้ายๆเเบบเก่าครับ เเค่จัดให้มันดีดีเฉยๆก็ได้").
   After every module has made its part of the HUD (HUD.init), my shop's pill (vend.js, shown while my shop is open),
   the AUTO button (autofarm.js), the coin counter (materials.js) and the menu buttons go into one bottom-right column
   (.hud-br), stacked in that order, so they never cover each other whatever their sizes; and the menu button ESC goes
   last (life.js adds H after it).
   Load after the files that add HUD parts (autofarm.js, materials.js, shop.js, party.js, vend.js, life.js), before game.js. */
(function () {
  'use strict';
  const NC = window.NC;
  const baseInit = NC.HUD.init.bind(NC.HUD);
  NC.HUD.init = function (game) {
    baseInit(game);
    const hud = document.getElementById('hud'), bar = hud && hud.querySelector('.menubar');
    if (!bar) return;
    const esc = bar.querySelector('[data-panel="pause"]');
    if (esc) bar.appendChild(esc); // (the menu last)
    const col = document.createElement('div');
    col.className = 'hud-br';
    for (const el of [hud.querySelector('.vend-pill'), hud.querySelector('.af'), hud.querySelector('.coins'), bar]) if (el) col.appendChild(el);
    hud.appendChild(col);
  };
})();
