/* online/faint.js — what a fall cost, online (?online). The server takes it (backend faint_cost.go: from Lv 20, 1% of the
   level's EXP, never a level; a ขนนกไออุ่น is used up instead) and leaves a note on the hero, self.faint
   { at, lost | feather, left }. Before this file nothing read it online: the หมดแรง screen opened without a word on EXP.
   A new note now goes to the chat log (the line progression.js writes offline) and to the screen's EXP card
   (NC.P3Fallen.exp, js/p3_fallen.js). The selfHooks run before world.js opens the screen in the same snapshot, so
   P3Fallen keeps the note for the screen about to open. Load after online/world.js. */
(function () {
  'use strict';
  const NC = window.NC, O = NC.Online, W = NC.OnlineWorld;
  if (!O || !O.enabled || !W) return;
  let seen; // the last note's time: the first snapshot's note (an earlier fall, a reconnect) is not news
  W.selfHooks.push((s, first) => {
    const f = s.faint, at = (f && f.at) || 0;
    if (first || seen === undefined) { seen = at; return; }
    if (!at || at === seen) return;
    seen = at;
    const cost = { lost: Math.max(0, +f.lost || 0), feather: !!f.feather, left: +f.left || 0 };
    if (!cost.feather && !(cost.lost > 0)) return;
    if (NC.faintLine && NC.HUD && NC.HUD.log) NC.HUD.log(NC.faintLine(cost.lost, cost.feather, cost.left), cost.feather ? 'item' : 'warn');
    if (NC.P3Fallen && NC.P3Fallen.exp) NC.P3Fallen.exp(cost);
  });
})();
