/* progression.js — the slower level curve and its catch-ups (the Game Bible, pillar 2; the user, 2026-09-30: "โตตลอด
   แต่เลเวลไม่ไว ... ระวังไม่ให้ผู้เล่นใหม่รู้สึกว่าตามคนเก่าไม่มีวันทัน"; the user chose it over Codex's
   mobile-progression-2026-09-30 the same day, docs/game-bible-online-plan.md).
     the curve     monsters keep their EXP (stats.js NC.monsterExpBudget x the species' expK, Codex's reward formula,
                   the same numbers as before his change) but a level now asks monster EXP x (12 + 0.05 Lv^2.4)
                   kills: ~2 bot hours to Lv 20, ~300 to Lv 99 (was 4.5). (A monster at its level is the reward
                   budget, not stats.js NC.xpNext: that became Codex's kill-count curve and would count the kills twice.)
     job levels    by tier, in kills of the tier's reference level: the traveler 10 levels in ~10 min, a 1st job 50
                   in ~8 h, a 2nd job ~150 h, a 3rd job ~400 h
     แสงนำทาง       below the median level of the top 100 heroes, EXP +50 / +100 / +150% at 10 / 20 / 30 levels behind
                   (offline: the heroes seen by net.js presence; online the server counts its whole character store)
     ไออุ่นกองไฟ     logging out in the camp stores rested EXP: half a level a day away, three days at the most; it
                   doubles the EXP of kills until it is spent
     death         from Lv 20 a faint costs 1% of the level's EXP (never a level); a ขนนกไออุ่น (ลุงโกโก้, 800
                   coins) is used up instead
   Every number is in NC.EXPERIENCE (exported to world.json experience: backend/progression.go, catch_up.go, rested.go,
   faint_cost.go and Unity read it); its id names the curve, and a save of Codex's curve keeps its levels and the
   fraction of each bar (NC.migrateExperience). Online (NC.Online.active) the server owns all of it: nothing here
   spends or saves, js/online-progress.js shows the server's numbers.
   Hooks: NC.xpNext / NC.jobNext (replaced), NC.migrateExperience, NC.gainXp, NC.hurtPlayer, NC.saveGame / NC.loadGear
   (own key), the merchant's list (NC.Shop.POTIONS), the Base EXP bar's badge. */
(function () {
  'use strict';
  const NC = window.NC;
  const KEY = 'nightcamp.progress.v1';
  const E = NC.EXPERIENCE;
  // (the current client leaves NC.Online.active off for game.js and has NC.Online.enabled: online/world.js)
  const online = () => !!(NC.Online && (NC.Online.active || NC.Online.enabled));

  // ---------------- the rules (world.json experience) ----------------
  const CODEX = { id: E.id, xpNext: NC.xpNext, jobNext: NC.jobNext }; // stats.js, mobile-progression-2026-09-30
  E.id = 'game-bible-2026-09-30';
  E.catchUp = { top: 100, minHeroes: 5, steps: [[10, 0.5], [20, 1], [30, 1.5]] }; // [levels behind, EXP bonus]
  E.rested = { place: 'camp', minAwaySeconds: 60, levelsPerDay: 0.5, maxLevels: 1.5 };
  E.faint = { fromLevel: 20, share: 0.01, feather: { id: 'feather', price: 800 } };

  // ---------------- the curves ----------------
  NC.xpBase = CODEX.xpNext;
  const mob = (lv) => NC.monsterExpBudget(lv) * 1.15; // a monster at its level (species expK ~1.15 on average)
  const kills = (lv) => 12 + 0.05 * Math.pow(lv, 2.4);
  NC.xpNext = (lv) => Math.round(mob(lv) * kills(lv));
  NC.killsPerLevel = kills;

  // job levels: kills of monsters at the tier's reference level; the tier is the job asked about (a job id, a tier
  // number or a hero), else the hero's own
  const TIER = { 0: { ref: 5, k: (j) => 8 }, 1: { ref: 25, k: (j) => 10 + 1.4 * j }, 2: { ref: 70, k: (j) => 6.7 * Math.pow(j, 1.5) },
    3: { ref: 99, k: (j) => 17.9 * Math.pow(j, 1.5) } };
  const JOB_FLOOR = CODEX.jobNext(1, 0); // the old first job level (70)
  const tierOf = (job) => {
    if (typeof job === 'number') return job;
    const p = NC.game && NC.game.player, id = typeof job === 'string' ? job : job && job.job ? job.job : p && p.job;
    const J = NC.JOBS[id];
    return J ? J.tier || 0 : 0;
  };
  NC.jobNext = (j, job) => { const T = TIER[tierOf(job)] || TIER[1]; return Math.max(JOB_FLOOR, Math.round(mob(T.ref) * 0.75 * T.k(j))); };

  // ---------------- saves of Codex's curve ----------------
  // his requirements, for the server to move his online saves the same way (world.json experience.previous)
  const previous = { id: CODEX.id, baseXp: {}, jobXpByTier: {} };
  for (let lv = 1; lv <= NC.LV_MAX; lv++) previous.baseXp[lv] = CODEX.xpNext(lv);
  for (let tier = 0; tier <= 3; tier++) {
    previous.jobXpByTier[tier] = {};
    for (let j = 1; j <= NC.LV_MAX; j++) previous.jobXpByTier[tier][j] = CODEX.jobNext(j, tier);
  }
  E.previous = previous;
  const fraction = (xp, need) => NC.clamp((Number.isFinite(xp) ? xp : 0) / need, 0, 1 - 1e-9);
  const baseMigrate = NC.migrateExperience; // (older saves: stats.js, from the first curve)
  NC.migrateExperience = function (p, version) {
    if (version !== previous.id) return baseMigrate.apply(this, arguments);
    p.xp = Math.floor(fraction(p.xp, previous.baseXp[p.lv] || 1) * NC.xpNext(p.lv));
    p.jobXp = Math.floor(fraction(p.jobXp, previous.jobXpByTier[tierOf(p)][p.jobLv] || 1) * NC.jobNext(p.jobLv, p));
    if (p.lv >= NC.LV_MAX) p.xp = 0;
    if (p.jobLv >= NC.jobMax(p)) p.jobXp = 0;
    p.experienceVersion = E.id;
  };

  // ---------------- the save: rested EXP, feathers, when we left ----------------
  const st = { rested: 0, feathers: 0, left: 0, inCamp: false };
  function load(game) {
    const p = game.player;
    let s = null;
    if (!NC.ONLINE) try { s = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { s = null; }
    if (s) Object.assign(st, { rested: +s.rested || 0, feathers: +s.feathers || 0, left: +s.left || 0, inCamp: !!s.inCamp });
    // away in the camp: half a level a day, three days' worth at the most
    const away = st.left && st.inCamp ? Date.now() - st.left : 0;
    st.rested = restedAfter(st.rested, away, p.lv);
    p.feathers = st.feathers;
  }
  function restedAfter(rested, awayMs, lv) {
    const R = E.rested;
    if (!(awayMs > R.minAwaySeconds * 1e3) || lv >= NC.LV_MAX) return rested;
    const next = NC.xpNext(lv);
    return Math.min(next * R.maxLevels, rested + next * R.levelsPerDay * (awayMs / 86400e3));
  }
  function save(game) {
    if (game.noSave) return;
    const p = game.player;
    st.feathers = p.feathers || 0; st.left = Date.now(); st.inCamp = !game.world || !game.world.field;
    const record = { rested: st.rested, feathers: st.feathers, left: st.left, inCamp: st.inCamp };
    try { localStorage.setItem(KEY, JSON.stringify(record)); } catch (e) { /* storage blocked */ }
  }
  (NC.loadHooks || (NC.loadHooks = [])).push((game) => load(game));
  (NC.saveHooks || (NC.saveHooks = [])).push((game) => save(game));
  addEventListener('beforeunload', () => { if (NC.game && NC.game.player) save(NC.game); });
  NC.Progress = st;
  NC.Progress.restedAfter = restedAfter;

  // ---------------- แสงนำทาง: behind the heroes online ----------------
  // catchUpBonus(median, lv): the steps are the same on the server (backend/catch_up.go)
  NC.catchUpBonus = (median, lv) => E.catchUp.steps.reduce((bonus, [behind, k]) => (median - lv >= behind ? k : bonus), 0);
  function guideBonus(p) {
    const net = NC.Net;
    if (!net || !net.online || !net.remotes) return 0;
    const lvs = [...net.remotes.values()].map((r) => r.lv || 0).filter((v) => v > 0).sort((a, b) => b - a).slice(0, E.catchUp.top);
    if (lvs.length < E.catchUp.minHeroes) return 0;
    return NC.catchUpBonus(lvs[Math.floor(lvs.length / 2)], p.lv);
  }
  NC.guideBonus = () => (NC.game ? guideBonus(NC.game.player) : 0);

  (NC.xpFilters || (NC.xpFilters = [])).push((game, n, jn) => {
    if (online()) return [n, jn]; // (the server's EXP; its orbs are only looks)
    const p = game.player;
    const k = 1 + guideBonus(p);
    if (st.rested > 0 && n > 0 && p.lv < NC.LV_MAX) {
      const extra = Math.min(st.rested, n);
      st.rested -= extra;
      n += extra;
      if (st.rested <= 0) NC.HUD.log('ไออุ่นกองไฟหมดแล้ว · EXP กลับเป็นปกติ', 'sys');
    }
    return [Math.round(n * k), Math.round((jn || 0) * k)];
  });

  // ---------------- death: 1% of the level's EXP from Lv 20 ----------------
  const baseHurt = NC.hurtPlayer;
  NC.hurtPlayer = function (game, dmg, fromX) {
    const p = game.player, was = p.dead > 0 || p.hp <= 0;
    const r = baseHurt.apply(this, arguments);
    if (!was && (p.dead > 0 || p.hp <= 0) && !online()) onFaint(game);
    return r;
  };
  NC.faintLine = (lost, feather, left) => feather ? `ขนนกไออุ่นปกป้อง EXP ไว้ (เหลือ ${left} อัน)`
    : `หมดแรง เสีย EXP ${lost.toLocaleString()} (1% ของเลเวล) · ขนนกไออุ่นกันได้`;
  function onFaint(game) {
    const p = game.player, F = E.faint;
    if (p.lv < F.fromLevel || p.lv >= NC.LV_MAX) return;
    if ((p.feathers || 0) > 0) {
      p.feathers--;
      NC.HUD.log(NC.faintLine(0, true, p.feathers), 'item');
      return;
    }
    const loss = Math.min(p.xp, Math.round(NC.xpNext(p.lv) * F.share));
    if (loss <= 0) return;
    p.xp -= loss;
    NC.HUD.log(NC.faintLine(loss, false, 0), 'warn');
    if (NC.Progress.onDeath) NC.Progress.onDeath(loss);
  }

  // ---------------- the merchant sells the feather ----------------
  if (NC.Shop && NC.Shop.POTIONS && !NC.Shop.POTIONS.some((q) => q.id === E.faint.feather.id))
    NC.Shop.POTIONS.push({ id: E.faint.feather.id, name: 'ขนนกไออุ่น', what: 'หมดแรงครั้งหน้าไม่เสีย EXP (ใช้อัตโนมัติ)', icon: 'assets/progress/ic_feather.png',
      price: E.faint.feather.price, key: 'feathers' });

  // ---------------- the Base EXP bar's badge: ไออุ่น x2 / แสงนำทาง +N% ----------------
  // offline from here, online from the server's snapshot (js/online-progress.js fills NC.Progress.online)
  NC.Progress.boost = () => (online() ? NC.Progress.online || { rested: 0, guide: 0 } : { rested: st.rested, guide: NC.guideBonus() });
  NC.boostText = (b) => [b.rested >= 1 ? 'ไออุ่น ×2' : '', b.guide > 0 ? `แสงนำทาง +${Math.round(b.guide * 100)}%` : ''].filter(Boolean).join(' · ');
  function drawBoost() {
    const bar = document.querySelector('.xbar.base');
    if (!bar) return;
    let tag = bar.querySelector('.xp-boost');
    if (!tag) {
      tag = document.createElement('span'); tag.className = 'xp-boost';
      tag.style.cssText = 'left:50%;transform:translate(-50%,-50%);color:#ffd27a;white-space:nowrap';
      bar.appendChild(tag);
    }
    const b = NC.Progress.boost(), text = NC.boostText(b);
    if (tag.textContent !== text) tag.textContent = text;
    tag.hidden = !text;
    tag.title = text ? `EXP จากมอน${b.rested >= 1 ? ` ×2 อีก ${Math.round(b.rested).toLocaleString()} แต้ม (ไออุ่นกองไฟ)` : ''}${b.guide > 0 ? ` · +${Math.round(b.guide * 100)}% (ตามหลังเลเวลกลางของ 100 อันดับแรก)` : ''}` : '';
  }
  setInterval(drawBoost, 1000);

  // ---------------- a line when the game starts ----------------
  const baseInit = NC.HUD.init;
  NC.HUD.init = function (game) {
    baseInit.apply(this, arguments);
    setTimeout(() => {
      if (st.rested > 1 && !online()) NC.HUD.log(`ไออุ่นกองไฟ: EXP ×2 อีก ${Math.round(st.rested).toLocaleString()} แต้ม (สะสมตอนพักในค่าย)`, 'level');
    }, 1500);
  };
})();
