/* online/botreport.js — the journal's สรุปบอท (js/report.js) counts the online farm too (?online). Discord #114: every
   number of an online run stayed 0 (the monsters, EXP, Job EXP, the materials, the drops), because report.js counts
   through the offline game's own steps (NC.gainXp, NC.skillKills, NC.lootHeard, NC.addMat), and online the server
   kills, pays and drops: none of them runs. Now, while report.js has a run open (the auto farm is on):
     a kill, EXP, Job EXP   the server's reward event for the hero (backend combat.go: xp, jobXp, monsterType; a chest
                            is no kill, as offline)
     the levels             the hero's record (self.lv, self.jobLv)
     the materials          what the record's materials grew by (self.mats; whatever way they reach the bag)
     the drops              a piece of gear the server drops for the hero (his own loot on the ground, online/world.js
                            syncLoot), with the monster killed nearest to it (else the map)
     the EXP a fall cost    the record's fall note (self.faint, as online/faint.js reads it)
   The coins, the potions and the falls are report.js's own poll, online as offline. Load after online/world.js. */
(function () {
  'use strict';
  const NC = window.NC, O = NC.Online, W = NC.OnlineWorld;
  if (!O || !O.enabled || !W) return;
  const run = () => (NC.Report && NC.Report.state && NC.Report.state.run) || null;
  const G = () => NC.game;

  // the kills (kept a while: a gear drop says which monster it came from)
  let kills = [];
  W.eventHooks.push((ev) => {
    if (!ev || ev.type !== 'reward' || !ev.monsterType) return;
    const r = run(), g = G();
    if (!r || !g) return;
    const e = W.mirrors && W.mirrors.get(ev.monsterId);
    if (!/^chest_/.test(ev.monsterType)) {
      r.kills++;
      if (e) { kills.push({ x: e.x, y: e.y, type: ev.monsterType, t: g.time }); if (kills.length > 40) kills.shift(); }
    }
    r.xp += Math.max(0, Math.round(+ev.xp || 0));
    r.jxp += Math.max(0, Math.round(+ev.jobXp || 0));
  });

  let mats = null, matsHero = null, faintAt;
  const seenLoot = new WeakSet();
  W.selfHooks.push((s, first) => {
    const r = run(), g = G(), p = g && g.player;
    // the materials: what each grew by since the last record (a new hero or a reconnect starts over)
    const now = s.mats || null;
    if (now) {
      if (first || !mats || s.id !== matsHero) { mats = Object.assign({}, now); matsHero = s.id; }
      else {
        if (r) for (const k in now) { const d = (now[k] | 0) - (mats[k] | 0); if (d > 0) r.mats[k] = (r.mats[k] || 0) + d; }
        mats = Object.assign({}, now);
      }
    }
    // a fall's EXP
    const f = s.faint, at = (f && f.at) || 0;
    if (first || faintAt === undefined) faintAt = at;
    else if (at && at !== faintAt) { faintAt = at; if (r && !f.feather && +f.lost > 0) r.xpLost += Math.round(+f.lost); }
    if (!r || !p) return;
    r.lv1 = Math.max(r.lv1 || 0, p.lv); r.jlv1 = p.jobLv; // (a job change starts the Job levels again)
    // the gear the server dropped for the hero
    for (const l of g.loot) {
      if (!l || !l.online || !l.id || seenLoot.has(l)) continue;
      seenLoot.add(l);
      if (!NC.ITEMS[l.id] || r.drops.length >= 300) continue;
      let from = '', best = 260;
      for (const k of kills) { const d = Math.hypot(k.x - l.x, k.y - l.y); if (d < best && g.time - k.t < 10) { best = d; from = k.type; } }
      r.drops.push([l.id, l.inst && l.inst.sh ? 1 : 0, from ? ((NC.MONSTERS[from] || {}).name || from) : ((NC.MAPS[g.mapId] || {}).name || '')]);
    }
  });
})();
