/* online/rootboss.js — ผู้ถูกรากสิง online (?online): the game server runs the root-possessed bosses (backend
   root_bosses*.go: the clock, where one comes up, its walk, the sink, the fight); the web's own js/rootboss.js only draws
   the server's boss (the person look, the aura) and js/rootbossfx.js its painted pieces.
     the clock  NC.RootBoss.server: rootboss.js's own clock stays off. (2026-10-18, the user: "แสดงตัวซ้ำๆ ตัวหนังสือขึ้น
                ไม่หยุด": the local clock brought up a local copy of the boss, every snapshot swept it away as a local
                spawn, the next frame made it again, and each new copy woke with "ตื่นแล้ว!" and its shockwave, about 20
                times a second)
     notices    the server's event rootBoss {boss, name, out, mapId, zone, label, text}: its text said the way
                rootboss.js says its own (a toast and the log)
   Load after online/world.js. */
(function () {
  'use strict';
  const NC = window.NC, O = NC.Online, W = NC.OnlineWorld, RB = NC.RootBoss;
  if (!O || !O.enabled || !W || !RB) return;
  RB.server = true;
  W.eventHooks.push((ev) => {
    if (!ev || ev.type !== 'rootBoss' || typeof ev.text !== 'string' || !ev.text) return;
    const g = NC.game;
    if (g && g.toast) g.toast(ev.text);
    if (NC.HUD && NC.HUD.log) NC.HUD.log(ev.text, 'warn');
  });
})();
