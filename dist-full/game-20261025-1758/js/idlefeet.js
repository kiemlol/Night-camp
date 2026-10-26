/* idlefeet.js — is the player's own hero standing still? (the user, 2026-10-06: "เวลา idle ใช้ขาใหม่ แต่เวลาวิ่งหรือเดิน
   ให้ใช้ขาเดิม"): NC.heroStanding() is true while NC.drawPlayer draws a hero that neither walks, runs, dashes, attacks
   nor casts, so js/lowerbody.js can give it the standing legs (front foot toward the viewer, back foot turned half
   toward us). Everything else (windows, the studio, other players, ghosts) gets the usual side-on legs.
   Load after js/entities.js (NC.drawPlayer). */
(function () {
  'use strict';
  const NC = window.NC;
  let standing = false;
  NC.heroStanding = () => standing;
  const baseDP = NC.drawPlayer;
  NC.drawPlayer = function (ctx, game) {
    const p = game && game.player;
    standing = !!p && !p.moving && !p.dash && !(p.atk && p.atk.on) && !p.cast && p.dead <= 0;
    try { return baseDP.apply(this, arguments); } finally { standing = false; }
  };
})();
