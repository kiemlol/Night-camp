/* season.js — after Lv 99 (the Game Bible, pillar 5: "พอ Max Level แล้วทำอะไรต่อ?").
     กลุ่มดาว     EXP earned at Lv 99 turns into star points (one per half a Lv 98): put them in five constellations — พลัง
                 (ATK +1%), ทนทาน (damage taken −0.5%), ว่องไว (attack speed +1%), เวทดารา (MATK +1%), นักเดินทาง (materials
                 found +0.5%) — 30 points a season at most (the cap grows each season: catch-up for newcomers)
     หอดาวร่วง    a shared endless tower: floor f is a dungeon (dungeongen.js) of Lv 88+f monsters, +4% HP a floor; 30 kills
                 open the stairs down; every 10th floor a dungeon boss guards them. The week's deepest floor is the ranking;
                 each floor's first clear this week pays coins (+ an option stone every 5th, a meteor ore every 10th). From
                 Lv 90, J → ท้ายเกม. Resets every week (the seed changes).
     บอสโลก       at 12:00, 19:30 and 22:00 (the viewer's clock) the night form of a dungeon boss wakes on a field map (the map
                 turns with the day), Lv 99, told 10 minutes before; its HP grows with the heroes online on that map; the
                 auto farm can't hurt it (come and play); 15 minutes; coins, season tokens, stones and its boss items
     ฤดูกาล       three months each: a number, the constellations' cap, the ranking (online heroes' records through net.js)
   PvP (the faction war, the arena) needs the game's own server (net.js carries looks, not hits): not built.
   Saved: nightcamp.season.v1. Hooks: NC.gainXp, NC.skillModSources, NC.addMat, NC.makeEnemy, NC.damageEnemy, NC.skillTicks,
   NC.Net fields, NC.Hub page. */
(function () {
  'use strict';
  const NC = window.NC, H = NC.Hub;
  if (!H) return;
  const esc = H.esc, fmt = (n) => NC.fmtCoins(n), KEY = 'nightcamp.season.v1';
  const G = () => NC.game;
  const weekNo = () => Math.floor((Date.now() / 86400000 + 3) / 7);
  const seasonNo = () => { const d = new Date(); return 1 + Math.max(0, Math.floor(((d.getFullYear() - 2026) * 12 + d.getMonth() - 9) / 3)); };
  let st = { starXp: 0, stars: { atk: 0, guard: 0, swift: 0, arcane: 0, wander: 0 }, spent: 0, tower: {}, wb: {}, best: {} };
  try { if (!NC.ONLINE) st = Object.assign(st, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* blocked */ }
  const save = () => { if (G() && G().noSave) return; try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* blocked */ } };

  // ---------------- the constellations ----------------
  const CONS = { atk: ['พลัง', 'ATK +1%', { atk: 1 }], guard: ['ทนทาน', 'ดาเมจที่โดน −0.5%', { taken: 0.5 }], swift: ['ว่องไว', 'ความเร็วโจมตี +1%', { aspd: 1 }],
    arcane: ['เวทดารา', 'MATK +1%', { matk: 1 }], wander: ['นักเดินทาง', 'วัตถุดิบที่เก็บได้ +0.5%', {}] };
  const cap = () => 30 * seasonNo();
  const perPoint = () => Math.round(NC.xpNext(98) * 0.5);
  const points = () => Math.floor(st.starXp / perPoint());
  const free = () => Math.min(points(), cap()) - st.spent;
  (NC.xpFilters || (NC.xpFilters = [])).push((game, n, jn) => {
    const p = game.player;
    if (p.lv >= NC.LV_MAX && n > 0) { const before = points(); st.starXp += n; if (points() > before) { NC.HUD.log(`ได้แต้มดาว! (ลงได้ที่ J → ท้ายเกม)`, 'level'); save(); } }
    return [n, jn];
  });
  NC.skillModSources.push((p) => {
    if (!p || p.kind !== 'player') return null;
    const m = {};
    for (const k in CONS) for (const s in CONS[k][2]) m[s] = (m[s] || 0) + CONS[k][2][s] * (st.stars[k] || 0);
    return Object.keys(m).length ? m : null;
  });
  const baseAdd = NC.addMat;
  NC.addMat = function (game, id, n) {
    if (n > 0 && /^mat_/.test(id) && Math.random() * 100 < (st.stars.wander || 0) * 0.5) n += 1;
    return baseAdd.apply(this, arguments);
  };

  // ---------------- the tower ----------------
  const TOWER_MOBS = ['raptor', 'rhino_beetle', 'elder_treant', 'magma_golem', 'fire_imp', 'lava_worm', 'mist_wraith', 'kappa', 'shadow_heron', 'salamander', 'fire_bat', 'bone_knight'];
  const TBOSS = ['bat_king', 'ant_queen', 'crypt_lord', 'lava_dragon'];
  const floorOf = (id) => (/^tower_(\d+)$/.exec(id || '') || [])[1] | 0;
  function defineFloor(f) {
    const id = 'tower_' + f;
    if (NC.MAPS[id]) return id;
    const L = 88 + f, w = weekNo(), boss = f % 10 === 0 ? TBOSS[(f / 10 - 1) % TBOSS.length] : null;
    const pick = (k) => TOWER_MOBS[(w * 7 + f * 3 + k * 5) % TOWER_MOBS.length];
    NC.MAPS[id] = { name: `หอดาวร่วง ชั้น ${f}`, lvText: `Lv ${L}–${L + 4}${boss ? ' · บอสเฝ้าบันได' : ''}`, parent: 'camp', W: 3800, H: 3000, seed: w * 1000 + f,
      dungeon: { theme: ['cave', 'crypt', 'lava'][f % 3], rooms: 9, room: [230, 400], tunnel: 190, loops: 0.3, chests: f % 5 === 0 ? 2 : 1, traps: 3, chest: 'chest_iron',
        boss: !!boss, bossChest: !!boss, pools: f % 3 === 2 ? 0.4 : 0 },
      lv: Object.assign({ slime: [L, L + 2], hollow: [L + 1, L + 4], chest_wood: [L, L], chest_iron: [L, L], chest_gold: [L, L] }, boss ? { [boss]: [L + 4, L + 4] } : {}),
      spawns: [['slime', 10], ['hollow', 11]], bosses: boss ? [[boss]] : undefined, dungeonFloor: true, tower: f, secret: true };
    // (its stairs are given only when it is built, below: the world maps never see the tower's floors)
    NC.ROSTER[id] = { '*': { slime: [[pick(0), 1], [pick(1), 1]], hollow: [[pick(2), 2], [pick(3), 1]] } };
    // (the next floor's name is read by the stairs: made now, built when walked into)
    if (!NC.MAPS['tower_' + (f + 1)]) setTimeout(() => defineFloor(f + 1), 0);
    return id;
  }
  const towerWarps = (f) => [{ id: 'out', to: 'camp', place: 'entrance' }, { id: 'down', to: 'tower_' + (f + 1), at: 'up', place: 'deep' }];
  const baseField = NC.buildField;
  NC.buildField = function (def) {
    if (def && def.tower) { defineFloor(def.tower + 1); def = Object.assign({}, def, { warps: towerWarps(def.tower) }); }
    return baseField.call(this, def);
  };
  const baseMake = NC.makeEnemy;
  NC.makeEnemy = function (type, x, y, lv) {
    const e = baseMake.apply(this, arguments), g = G(), f = g && floorOf(g.mapId || (g.world && g.world.mapId));
    if (e && f) { e.maxHp = Math.round(e.maxHp * (1 + 0.04 * f)); e.hp = e.maxHp; }
    return e;
  };
  let kills = 0, held = null, towerFloor = 0;
  NC.skillKills.push((game, e) => { if (floorOf(game.mapId) && e._heroT != null) kills++; });
  NC.skillTicks.push((game, p, dt) => {
    const f = floorOf(game.mapId);
    if (f !== towerFloor) { towerFloor = f; kills = 0; held = null; if (f) { defineFloor(f + 1); NC.HUD.log(`หอดาวร่วง ชั้น ${f} · ล่าให้ครบ 30 ตัวเพื่อเปิดบันได`, 'level'); } }
    if (!f) return;
    const i = game.portals.findIndex((pt) => pt.id === 'down');
    if (kills < 30) { if (i >= 0) held = game.portals.splice(i, 1)[0]; return; }
    if (held) {
      game.portals.push(held); held = null;
      NC.HUD.log(`บันไดลงชั้น ${f + 1} เปิดแล้ว!`, 'level');
      const w = weekNo(), T = (st.tower[w] = st.tower[w] || { best: 0 });
      if (f > T.best) {
        T.best = f; st.best.tower = Math.max(st.best.tower || 0, f);
        const c = f * 2000; p.coins += c; if (NC.Econ) NC.Econ.faucet('tower', c);
        if (f % 5 === 0) NC.addMat(game, 'mat_opt_stone', 1);
        if (f % 10 === 0) NC.addMat(game, 'lf_starore', 2);
        NC.HUD.log(`ผ่านชั้น ${f} ครั้งแรกของสัปดาห์ · ${fmt(c)} เหรียญ${f % 5 === 0 ? ' · หินออฟ' : ''}${f % 10 === 0 ? ' · แร่ดาวตก 2' : ''}`, 'item');
        save();
      }
    }
  });
  function enterTower(game, f) {
    const p = game.player;
    if (p.lv < 90) { game.toast('หอดาวร่วงเปิดให้ Lv 90 ขึ้นไป'); return; }
    NC.HUD.panel('journal', false); game.paused = false;
    NC.Maps.go(game, defineFloor(f || 1));
  }

  // ---------------- the world boss ----------------
  const TIMES = [[12, 0], [19, 30], [22, 0]];
  const FIELDS = ['meadow', 'woods', 'wind', 'swamp', 'canyon', 'volcano', 'lake', 'prime'];
  const WB = ['bat_king', 'ant_queen', 'crypt_lord', 'lava_dragon'];
  const dayIdx = () => Math.floor(Date.now() / 86400000);
  const today = () => { const d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };
  function wbNow() {
    const d = new Date(), m = d.getHours() * 60 + d.getMinutes();
    for (let i = 0; i < TIMES.length; i++) {
      const t = TIMES[i][0] * 60 + TIMES[i][1];
      if (m >= t - 10 && m < t + 15) return { i, soon: m < t, map: FIELDS[(dayIdx() + i) % FIELDS.length], type: WB[(dayIdx() + i) % WB.length], key: today() + ':' + i };
    }
    return null;
  }
  const others = (game) => (NC.Net && NC.Net.remotes ? [...NC.Net.remotes.values()].filter((r) => r.map === game.mapId).length : 0);
  function spawnWB(game, w) {
    const p = game.player, D = NC.DUNGEON_BOSSES && NC.DUNGEON_BOSSES[w.type];
    const at = [game.world.spawn ? game.world.spawn.x + 400 : p.x + 400, game.world.spawn ? game.world.spawn.y : p.y];
    const e = NC.makeEnemy(w.type, at[0], at[1], 99);
    if (!e) return;
    e.worldBoss = { key: w.key, t: 15 * 60 };
    e.maxHp = Math.round(e.maxHp * 3 * (1 + 0.6 * others(game))); e.hp = e.maxHp;
    e.name = 'ร่างราตรี ' + (D ? D.name : e.name);
    game.enemies.push(e);
    st.wb[w.key] = 'up'; save();
    NC.HUD.log(`บอสโลก ${e.name} ปรากฏที่ ${NC.MAPS[game.mapId].name}!`, 'level');
  }
  let told = '';
  setInterval(() => {
    const g = G(); if (!g || !g.player) return;
    if (NC.Online && NC.Online.enabled) return; // (?online: the server's world bosses)
    const w = wbNow();
    if (!w) return;
    if (w.soon && told !== w.key) { told = w.key; NC.HUD.log(`อีกไม่ถึง 10 นาที บอสโลก ร่างราตรี${(NC.DUNGEON_BOSSES[w.type] || {}).name || ''} จะตื่นที่ ${(NC.MAPS[w.map] || {}).name}`, 'level'); if (NC.Chat) NC.Chat.add({ ch: 'sys', kind: 'level', text: `🔔 บอสโลกกำลังจะตื่นที่ ${(NC.MAPS[w.map] || {}).name}` }); }
    if (!w.soon && !st.wb[w.key] && g.mapId === w.map) spawnWB(g, w);
  }, 5000);
  const baseDmg = NC.damageEnemy;
  NC.damageEnemy = function (game, e, r) {
    if (e && e.worldBoss && NC.Auto && NC.Auto.on && r && r.dmg > 0) { if (!e._autoTold) { e._autoTold = 1; NC.HUD.log('บอสโลกต้องตีเอง ปิดออโต้ฟาร์ม (Z) ก่อน', 'warn'); } r = Object.assign({}, r, { dmg: 0 }); }
    const was = e.hp, out = baseDmg.call(this, game, e, r, ...[].slice.call(arguments, 3));
    if (e && e.worldBoss && !e.worldBoss.own && was > 0 && e.hp <= 0) { // (own: a world boss with its own ending, js/baphomet.js)
      const p = game.player, c = 50000; p.coins += c; if (NC.Econ) NC.Econ.faucet('worldboss', c);
      NC.addMat(game, 'mat_opt_stone', 3); if (Math.random() < 0.3) NC.addMat(game, 'mat_drill_stone', 1);
      if (NC.Quests && NC.Quests.state) { NC.Quests.state.tokens += 40; }
      st.wb[e.worldBoss.key] = 'done'; st.best.wb = (st.best.wb || 0) + 1; save();
      NC.HUD.log(`ล้มบอสโลกสำเร็จ! ${fmt(c)} เหรียญ · หินออฟ 3 · ตราฤดูกาล 40`, 'level');
      if (NC.Loot) NC.Loot.news(game, `${p.name || 'นักเดินทาง'} ล้ม ${e.name} ได้!`);
    }
    return out;
  };
  NC.skillTicks.push((game, p, dt) => {
    for (const e of game.enemies) if (e.worldBoss && !e.worldBoss.own && !e.dead && e.hp > 0 && (e.worldBoss.t -= dt) <= 0) { e.dead = true; e.hp = 0; NC.HUD.log(`${e.name} กลับเข้าความมืดไปแล้ว`, 'warn'); }
  });
  // ---------------- the ranking (online) ----------------
  if (NC.Net) NC.Net.fields.push({ key: 'rk', get: () => { const g = G(); return g && g.player ? [g.player.lv, (st.tower[weekNo()] || {}).best || 0, NC.Book ? NC.Book.count() : 0] : null; } });
  if (NC.Net) NC.Net.hooks.push((r, pr) => { r.rk = Array.isArray(pr.rk) ? pr.rk.map((v) => v | 0) : null; });

  // ---------------- the page ----------------
  let etab = 'stars';
  function render(el, game) {
    const p = game.player, w = weekNo(), T = st.tower[w] || { best: 0 };
    const tabs = [['stars', 'กลุ่มดาว'], ['tower', 'หอดาวร่วง'], ['wb', 'บอสโลก'], ['rank', 'อันดับ']];
    let h = `<div class="bb-h">ท้ายเกม <small>ฤดูกาลที่ ${seasonNo()}</small></div><div class="bb-chips">${tabs.map(([k, n]) => `<button class="bb-chip ${etab === k ? 'on' : ''}" data-et="${k}">${n}</button>`).join('')}</div>`;
    if (etab === 'stars') {
      const pts = Math.min(points(), cap()), prog = (st.starXp % perPoint()) / perPoint();
      h += `<div class="bb-sub">ถึง Lv 99 แล้ว EXP จะกลายเป็นแต้มดาว (1 แต้ม = ครึ่งเลเวลของ Lv 98) · ฤดูกาลนี้ลงได้สูงสุด ${cap()} แต้ม</div>` +
        `<div class="bb-tiles"><div class="bb-tile"><b>${free()}</b><span>แต้มว่าง</span></div><div class="bb-tile"><b>${pts}</b><span>แต้มทั้งหมด / ${cap()}</span></div>` +
        `<div class="bb-tile"><b>${Math.round(prog * 100)}%</b><span>ไปแต้มถัดไป${p.lv < NC.LV_MAX ? ' (ต้อง Lv 99)' : ''}</span></div><div class="bb-tile"><b>${st.spent}</b><span>ลงแล้ว</span></div></div><div class="bb-list">` +
        Object.entries(CONS).map(([k, [n, what]]) => `<div class="bb-row"><img src="${H.icon('ic_season')}" alt=""><div class="t"><b>${n} · ${st.stars[k] || 0}</b><small>${what} ต่อแต้ม</small></div>` +
          `<button class="kw-btn gold" data-star="${k}" ${free() > 0 ? '' : 'disabled'}>+1</button></div>`).join('') + '</div>' +
        `<div class="bb-form"><button class="kw-btn grey" data-reset="1" ${st.spent ? '' : 'disabled'}>คืนแต้มทั้งหมด (${fmt(100000)} เหรียญ)</button></div>`;
    } else if (etab === 'tower') {
      const starts = [1]; for (let f = 10; f <= T.best; f += 10) starts.push(f + 1);
      h += `<div class="bb-sub">ดันเจี้ยนไม่สิ้นสุด ชั้นละ Lv 88+ชั้น มอนแกร่งขึ้น 4% ต่อชั้น · ล่าครบ 30 ตัวเปิดบันได · ทุก 10 ชั้นมีบอส · รีเซ็ตทุกสัปดาห์</div>` +
        `<div class="bb-tiles"><div class="bb-tile"><b>${T.best}</b><span>ชั้นลึกสุดสัปดาห์นี้</span></div><div class="bb-tile"><b>${st.best.tower || 0}</b><span>ลึกสุดตลอดกาล</span></div>` +
        `<div class="bb-tile"><b>${floorOf(game.mapId) || '—'}</b><span>อยู่ชั้น</span></div><div class="bb-tile"><b>${kills}/30</b><span>ล่าในชั้นนี้</span></div></div>` +
        `<div class="bb-form">${starts.map((f) => `<button class="kw-btn ${f === 1 ? 'gold' : 'blue'}" data-tower="${f}" ${p.lv >= 90 ? '' : 'disabled'}>เริ่มชั้น ${f}</button>`).join('')}</div>` +
        (p.lv < 90 ? '<div class="bb-note">หอดาวร่วงเปิดให้ Lv 90 ขึ้นไป</div>' : '');
    } else if (etab === 'wb') {
      const now = wbNow();
      h += '<div class="bb-sub">บอสโลกตื่นวันละ 3 รอบ (12:00 · 19:30 · 22:00 ตามเวลาเครื่อง) ในแมพที่หมุนทุกวัน · ต้องเล่นเอง ออโต้ฟาร์มตีไม่ได้ · 15 นาที</div><div class="bb-list">' +
        TIMES.map(([hh, mm], i) => { const map = FIELDS[(dayIdx() + i) % FIELDS.length], type = WB[(dayIdx() + i) % WB.length], key = today() + ':' + i;
          return `<div class="bb-row ${now && now.i === i ? 'on' : st.wb[key] === 'done' ? 'done' : ''}"><img src="${H.icon('ic_rank')}" alt=""><div class="t"><b>${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')} · ร่างราตรี${esc((NC.DUNGEON_BOSSES[type] || {}).name || type)}</b>` +
            `<small>${esc((NC.MAPS[map] || {}).name || map)}${st.wb[key] === 'done' ? ' · ล้มแล้ว ✔' : now && now.i === i ? (now.soon ? ' · ใกล้ตื่นแล้ว' : ' · ตื่นอยู่!') : ''}</small></div>` +
            (now && now.i === i && game.mapId !== map && NC.Econ ? `<button class="kw-btn gold" data-go="${map}">ไปที่นั่น</button>` : '') + '</div>'; }).join('') +
        (NC.WorldBossRows ? NC.WorldBossRows(game, esc) : '') + '</div>'; // (more world bosses: js/baphomet.js)
    } else {
      const rows = [[p.name || 'คุณ', p.lv, T.best, NC.Book ? NC.Book.count() : 0, true]];
      if (NC.Net && NC.Net.remotes) for (const r of NC.Net.remotes.values()) if (r.rk) rows.push([r.name, r.rk[0], r.rk[1], r.rk[2], false]);
      rows.sort((a, b) => b[2] - a[2] || b[1] - a[1]);
      h += '<div class="bb-sub">อันดับของคนที่ออนไลน์อยู่ตอนนี้ (อันดับทั้งเซิร์ฟเวอร์ต้องรอเซิร์ฟเวอร์ของเกม)</div><table class="bb-table"><tr><th>#</th><th>ชื่อ</th><th class="num">Lv</th><th class="num">หอดาวร่วง</th><th class="num">สมุดสะสม</th></tr>' +
        rows.map((r, i) => `<tr class="${r[4] ? 'me' : ''}"><td>${i + 1}</td><td>${esc(r[0])}</td><td class="num">${r[1]}</td><td class="num">${r[2]}</td><td class="num">${r[3]}</td></tr>`).join('') + '</table>';
    }
    el.innerHTML = h;
  }
  H.add({ id: 'endgame', name: 'ท้ายเกม', icon: 'ic_rank', order: 70, render,
    click(e, game) {
      const t = e.target.closest('[data-et]'); if (t) { etab = t.dataset.et; return true; }
      const s = e.target.closest('[data-star]'); if (s && free() > 0) { st.stars[s.dataset.star] = (st.stars[s.dataset.star] || 0) + 1; st.spent++; save(); NC.applyGear(game); return true; }
      const r = e.target.closest('[data-reset]'); if (r && (game.player.coins || 0) >= 100000) { game.player.coins -= 100000; if (NC.Econ) NC.Econ.sink('stars', 100000); for (const k in st.stars) st.stars[k] = 0; st.spent = 0; save(); NC.applyGear(game); return true; }
      const tw = e.target.closest('[data-tower]'); if (tw && !tw.disabled) { enterTower(game, Number(tw.dataset.tower)); return false; }
      const go = e.target.closest('[data-go]'); if (go && NC.Econ) { NC.Econ.warp(game, go.dataset.go); return false; }
      return false;
    },
    dot: () => free() > 0 });
  // (times, openWorldBoss: the PC shop row's บอส button and its badge, js/hudshop.js; the tab turns through the page's
  // own บอสโลก button, so a redraw that keeps its own tab, js/p3_jgacha.js, turns with it)
  function openWorldBoss() {
    etab = 'wb'; H.open('endgame');
    const chip = document.querySelector('#hb-page [data-et="wb"]');
    if (chip) chip.click();
  }
  NC.Season = { state: st, seasonNo, defineFloor, wbNow, times: TIMES, openWorldBoss };
})();
