/* online/extras.js — the rest of the hero's own systems online (?online), each through the web's own window:
     check-in   the J page's ปฏิทิน tab: the server's month (nc_checkin_status / nc_checkin_claim, backend checkin*.go),
                claimed by itself a moment after the world comes in, as quests.js's calendar does offline; the boxes are
                drawn by quests.js from NC.Quests.calCells (the server's slots and their words)
     travel     ลูกไฟนำทาง (the J page's warp tab, economy.js + p3_jsocial.js; NC.Econ.warp for the other "go" buttons):
                {action:'travel', mapId}; the lit fires and today's free warps are the server's (self.econ, self.travel)
     books      สมุดสะสม / สมุดมอน = self.book (book.js's NC.Book.book filled in place); giving a spare copy up for a star
                = {action:'book', itemId, copyId}; the life book's "found" = self.matSeen (p.matSeen)
     crows      the farm's crows are the server's (self.farmCrows, it decides the shoo and the peck), drawn with
                life_farm.js's own crow; L.noLocalCrows stops the local ones
     AUTO       the auto farm's on / off goes to the server ({action:'auto', kind:'start'|'stop'}): a logout with AUTO on
                a farm field farms on offline. Coming back, self.offlineFarm.last is shown once ("ระหว่างที่ไม่อยู่"),
                then {action:'seen', kind:'offline'}
     sitting    sitting down / standing up = {action:'rest', kind:'sit'|'stand'} (the server's rest regen)
     lessons    the lessons' and the journey's counters get the hero's kills from the server's reward events (NC.skillKills
                never runs online: the kills are the server's) and his dummy hits from its combat events; their own coins, potions and handouts are not paid here
                (NC.Lessons.noPay / NC.Journey.noPay): the server has no lessons yet
   Load after online/life.js. */
(function () {
  'use strict';
  const NC = window.NC, O = NC.Online, W = NC.OnlineWorld;
  if (!O || !O.enabled || !W) return;
  const G = () => NC.game;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = (n) => (NC.fmtCoins ? NC.fmtCoins(n) : String(n));
  const log = (t, k) => NC.HUD && NC.HUD.log(t, k || 'level');
  const self = () => (W.snap && W.snap.self) || null;
  const today = () => { const d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };
  const mapName = (id) => (NC.MAPS[id] || {}).name || id;

  // ---------------- check-in: the J page's calendar ----------------
  let ck = null, ckBusy = false;
  const lineText = (ls) => (ls || []).map((l) => l.text || (l.name ? `${l.name} ×${l.n}` : '')).filter(Boolean).join(' · ');
  const ckCount = (t) => (Array.isArray(t && t.claimed) ? t.claimed.length : (t && t.claimed) | 0); // (the server sends the days or their number)
  NC.Quests.calCells = () => {
    if (!ck || !ck.month) return { got: 0, cells: [], note: 'กำลังอ่านปฏิทินจากเซิร์ฟเวอร์…' };
    const m = ck.month, f = ck.first7 || {}, f7 = (f.rewards || []).length;
    const bits = [`ปฏิทินเดือนนี้ (เริ่มใหม่ทุกวันที่ 1) · เปิดเกมวันไหนได้กล่องวันนั้น ไม่ต้องติดต่อกัน`];
    if (f7 && ckCount(f) < f7) bits.push(`7 วันแรก: ได้แล้ว ${ckCount(f)}/${f7}`);
    if (ck.today && ck.today.claimed) bits.push('วันนี้รับแล้ว');
    return { got: ckCount(m), cells: (m.rewards || []).map((r) => lineText(r.lines)), note: bits.join(' · ') };
  };
  async function ckLoad() {
    try { const r = await O.rpc('nc_checkin_status', {}); if (r && r.ok !== false) ck = r; } catch (e) { console.warn('online checkin: status', e); }
    if (NC.Hub && NC.Hub.refresh) try { NC.Hub.refresh(); } catch (e) { /* the journal is closed */ }
  }
  async function ckClaim() {
    if (ckBusy) return;
    ckBusy = true;
    try {
      const r = await O.rpc('nc_checkin_claim', {});
      if (r && r.ok) {
        if (r.status) ck = r.status;
        for (const g of r.granted || []) {
          const what = lineText(g.lines);
          if (!what) continue;
          log(g.track === 'first7' ? `ของขวัญ 7 วันแรก วันที่ ${g.slot}: ${what}` : g.track === 'comeback' ? `ยินดีต้อนรับกลับ: ${what}` : `ปฏิทินค่าย วันที่ ${g.slot}: ${what}`);
        }
      } else if (r && r.reason) console.info('online checkin:', r.reason);
    } catch (e) { console.warn('online checkin: claim', e); }
    ckBusy = false;
    if (NC.Hub && NC.Hub.refresh) try { NC.Hub.refresh(); } catch (e) { /* closed */ }
  }
  let ckDay = 0;
  async function ckDaily() {
    if (!W.ready || ckDay === today()) return;
    ckDay = today();
    await ckLoad();
    if (ck && ck.today && ck.today.available) await ckClaim();
  }
  let ckArmed = false; // (a moment after the world comes in, then once a minute for midnight)
  W.selfHooks.push(() => { if (!ckArmed) { ckArmed = true; setTimeout(function tick() { ckDaily(); setTimeout(tick, 60000); }, 2500); } });

  // ---------------- travel: ลูกไฟนำทาง ----------------
  function econSync(s) {
    const E = NC.Econ && NC.Econ.state;
    if (!E) return;
    const v = (s.econ && s.econ.visited) || {};
    for (const k of Object.keys(E.visited || {})) if (!v[k] && k !== (G() && G().mapId)) delete E.visited[k];
    E.visited = E.visited || {};
    for (const k of Object.keys(v)) E.visited[k] = 1;
    if (s.travel) { E.warpDay = today(); E.warpsUsed = s.travel.used | 0; }
  }
  let econSeen = null, travelSeen = null;
  W.selfHooks.push((s) => { if (s.econ !== econSeen || s.travel !== travelSeen) { econSeen = s.econ; travelSeen = s.travel; econSync(s); } });
  let travelT = 0;
  function travel(game, id) {
    const p = game.player, T = (self() && self().travel) || {}, c = T.costs ? T.costs[id] : null;
    if (!NC.MAPS[id] || id === game.mapId) return;
    if (p.dead > 0) { game.toast('ฟื้นก่อน แล้วค่อยใช้ลูกไฟนำทาง'); return; }
    if (c != null && (p.coins || 0) < c) { game.toast(`เหรียญไม่พอ · ต้องใช้ ${fmt(c)}`); return; }
    if (Date.now() - travelT < 1500) return;
    travelT = Date.now();
    W.send({ action: 'travel', mapId: id });
    NC.HUD.panel('journal', false); game.paused = false;
    log(`ลูกไฟนำทางกำลังพาไป ${mapName(id)}…`, 'sys');
  }
  if (NC.Econ) NC.Econ.warp = travel;
  const TW = NC.Hub && NC.Hub.tab && NC.Hub.tab('warp');
  if (TW) {
    const base = TW.click;
    TW.click = function (e, game) {
      const go = e.target.closest('[data-warp]');
      if (go && !go.disabled) { travel(game || G(), go.dataset.warp); return false; }
      return base ? base.call(this, e, game) : false;
    };
  }
  W.eventHooks.push((ev) => {
    if (!ev || ev.type !== 'travel') return;
    log(`ลูกไฟนำทางพาไป ${mapName(ev.mapId)}${ev.gold ? ` (${fmt(ev.gold)} เหรียญ)` : ' (ฟรี)'}`, 'item');
  });

  // ---------------- the books ----------------
  let bookSeen = null, seenSeen = null, featsSeen = null;
  W.selfHooks.push((s) => {
    const B = NC.Book && NC.Book.book;
    if (B && s.book && s.book !== bookSeen) {
      bookSeen = s.book;
      B.items = Object.assign({}, s.book.items || {}); B.sh = Object.assign({}, s.book.sh || {}); B.kills = Object.assign({}, s.book.kills || {});
      const g = G(); if (g && NC.applyGear) NC.applyGear(g); // (the book's status points and weapon bonuses)
    }
    // สมุดมอน's boss tab: the bosses the hero felled are the server's count (self.feats.bk, titles.go observeTitleKill:
    // every map, dungeon and story boss he had a hand in; feats is left out until the first one)
    if (NC.JBook && NC.JBook.bossKills && s.feats !== featsSeen) {
      featsSeen = s.feats;
      NC.JBook.bossKills((s.feats && s.feats.bk) || {});
    }
    const g = G();
    if (g && g.player && (s.matSeen !== seenSeen || !g.player.matSeen)) {
      seenSeen = s.matSeen;
      g.player.matSeen = new Set(Array.isArray(s.matSeen) ? s.matSeen : Object.keys(s.mats || {}));
    }
  });
  // giving a spare copy up for a star (book.js picks the copy: the lowest refine, the fewest rows, never a worn one)
  function spare(p, id) {
    const C = NC.GEAR;
    if (!C) return null;
    return C.copies(p, id).filter((c) => { for (const k in p.equip) if (p.equip[k] === c.id && C.wornIn(p, k) === c) return false; return true; })
      .sort((a, b) => (a.ref || 0) - (b.ref || 0) || a.rows.length - b.rows.length)[0] || null;
  }
  for (const id of ['book', 'mon']) {
    const T = NC.Hub && NC.Hub.tab && NC.Hub.tab(id);
    if (!T) continue;
    const base = T.click;
    T.click = function (e, game) {
      const st = e.target.closest('[data-star]');
      if (st && !st.disabled && NC.ITEMS[st.dataset.star]) {
        const g = game || G(), c = spare(g.player, st.dataset.star);
        if (c) { W.send({ action: 'book', itemId: c.id, copyId: c.u }); log(`ลงดาว ${NC.ITEMS[c.id].name}…`, 'item'); }
        return false;
      }
      return base ? base.call(this, e, game) : false;
    };
  }

  // ---------------- the farm's crows ----------------
  const L = NC.Life;
  if (L) {
    L.noLocalCrows = true;
    const crows = new Map(); // id -> the crow life_farm.js draws ({ x, y, state, face, q })
    const FX = NC.FX;
    L.ticks.push((game, dt) => {
      const list = (game.mapId === 'homefarm' && self() && self().farmCrows) || [];
      const live = new Set();
      for (const v of list) {
        live.add(v.id);
        let c = crows.get(v.id);
        const q = (game.world.lfGarden || []).find((x) => x.i === v.plot) || { i: v.plot, x: v.x, y: v.y + 8 };
        if (!c) {
          c = { q, x: v.x, y: v.y, state: v.phase, face: v.face < 0 ? -1 : 1, t: 0 };
          c.fx = FX.add({ type: 'lfcrow', layer: 'sorted', life: 1e9, x: c.x, y: c.y, sort: q.y, crow: c });
          crows.set(v.id, c);
        }
        const me = self(); // (shooed = it left early with the hero by it, as the server judged: its own positions)
        if (c.state === 'peck' && v.phase === 'out' && me && Math.hypot(me.x - v.x, me.y - v.y) < 230) FX.text(c.x, c.y - 90, 'ไล่อีกาไปแล้ว!', '#ffe0b0', 20);
        c.state = v.phase; c.face = v.face < 0 ? -1 : 1;
        const k = Math.min(1, dt * 10); // (the server's position, slid to)
        c.x += (v.x - c.x) * k; c.y += (v.y - c.y) * k;
        c.fx.x = c.x; c.fx.y = c.y; c.fx.sort = c.state === 'peck' ? q.y + 12 : q.y + 40;
      }
      for (const [id, c] of crows) if (!live.has(id)) { c.fx.dead = true; crows.delete(id); }
    });
  }

  // ---------------- AUTO (and the offline farm), sitting ----------------
  // (W.sat: what the server was last told; online/market.js sits the hero first when a shop opens: the server's sit
  // closes a shop, so it must come before the shop, never after)
  let autoSent = false;
  W.sat = false;
  setInterval(() => {
    const g = G();
    if (!W.ready || !g || !g.player) return;
    const on = !!(NC.Auto && NC.Auto.on);
    if (on !== autoSent) { autoSent = on; W.send({ action: 'auto', kind: on ? 'start' : 'stop' }); }
    const sit = !!g.player.sit;
    if (sit !== W.sat) { W.sat = sit; W.send({ action: 'rest', kind: sit ? 'sit' : 'stand' }); }
  }, 250);
  let awayShown = 0;
  W.selfHooks.push((s) => {
    const last = s.offlineFarm && s.offlineFarm.last;
    if (!last || last.seen || awayShown === last.to) return;
    awayShown = last.to;
    setTimeout(() => showAway(last), 1200);
  });
  function showAway(r) {
    const h = Math.floor((r.seconds || 0) / 3600), m = Math.round(((r.seconds || 0) % 3600) / 60);
    const mats = (r.mats || []).map((x) => `${esc((NC.MATERIALS[x.id] || {}).name || x.id)} ×${(x.n || x.count) | 0}`).join(' · ');
    const el = document.createElement('div');
    el.className = 'jn-reward ol-away';
    el.innerHTML = '<img class="ch" src="assets/journey/chest_open.png" alt=""><h3>ระหว่างที่คุณไม่อยู่</h3>' +
      `<p>ออโต้ฟาร์มต่อที่${esc(mapName(r.map))} ${[h ? h + ' ชม.' : '', m || !h ? m + ' นาที' : ''].filter(Boolean).join(' ')} · ปราบ ${(r.kills | 0).toLocaleString()} ตัว</p>` +
      `<p>+${(r.xp | 0).toLocaleString()} EXP · +${(r.jobXp | 0).toLocaleString()} Job EXP${r.lvTo > r.lvFrom ? ` · Lv ${r.lvFrom | 0} → ${r.lvTo | 0}` : ''}</p>` +
      (mats ? `<p>${mats}</p>` : '') + (r.reason ? `<p>${esc(r.reason)}</p>` : r.dayCap ? '<p>ครบเวลาฟาร์มออฟไลน์ของวันนี้แล้ว</p>' : '') +
      '<button class="kw-btn gold">รับ</button>';
    el.querySelector('button').addEventListener('click', () => { el.remove(); W.send({ action: 'seen', kind: 'offline' }); });
    document.body.appendChild(el);
  }

  // ---------------- the lessons and the journey ----------------
  if (NC.Lessons) NC.Lessons.noPay = true;
  if (NC.Journey) NC.Journey.noPay = true;
  // kept per hero on this device (the page is a fresh, unsaved game online: before this every visit began at lesson 1);
  // once the server's record names the hero, after online/quests.js has written his story in (a new hero here starts
  // where that story stands)
  // The key names the hero by account and name: s.id is the ACCOUNT (backend c.ID = the user id), so with only the id
  // every hero of one account shared one save, and a new hero was handed the first one's lessons and journey
  // (2026-10-19, Discord). A hero without its own save yet starts where its server story stands (lessons.js migrate)
  // and its journey is done past Lv 20 (journey.js useSave); the lessons pay nothing online (noPay), so nothing pays twice.
  W.selfHooks.push((s) => {
    if (!s || !s.id || !s.name) return;
    const key = `@${O.origin || ''}#${s.id}~${s.name}`;
    if (NC.Lessons && NC.Lessons.useSave) NC.Lessons.useSave('nightcamp.lessons.v1' + key, G());
    if (NC.Journey && NC.Journey.useSave) NC.Journey.useSave('nightcamp.journey.v1' + key, G());
    if (NC.invLockKey) NC.invLockKey('nightcamp.inv.v1' + key); // (the bag's material locks, js/inventory.js)
  });
  // ...which are the hero's on the server since 2026-10-24 (econ.locks, backend mat_lock.go; Discord NC-139 / NC-144)
  const sendLock = (id, on) => W.send({ action: 'lock', kind: on ? 'on' : 'off', itemId: id });
  W.selfHooks.push((s) => {
    if (!s || !s.id || !s.name || !NC.invServerLocks) return;
    NC.invServerLocks((s.econ && s.econ.locks) || [], sendLock);
  });
  // Solo monster materials go straight into the pouch. Ground loot and potion
  // receipts are already counted by world.js and must not be counted here again.
  let lastMats = null, lastMatsJ = '', lastMatsHero = null;
  W.selfHooks.push((s, first) => {
    if (!s) return;
    const mats = s.mats || {}, j = JSON.stringify(mats);
    if (first || s.id !== lastMatsHero) {
      lastMats = Object.assign({}, mats); lastMatsJ = j; lastMatsHero = s.id;
      return; // another hero's inventory or a reconnect is not a new drop
    }
    if (j === lastMatsJ) return;
    const was = lastMats;
    lastMats = Object.assign({}, mats); lastMatsJ = j;
    if (!was || !NC.Lessons || !NC.Lessons.ev) return;
    for (const k in mats) if (/^mat_/.test(k) && (mats[k] || 0) > (was[k] || 0)) { NC.Lessons.ev('loot'); break; }
  });
  W.eventHooks.push((ev) => {
    if (!ev || ev.type !== 'reward' || !ev.monsterType) return;
    const sp = ev.monsterType;
    if (NC.Lessons && NC.Lessons.ev) { NC.Lessons.ev('kill'); NC.Lessons.ev('k_' + sp); if (NC.Auto && NC.Auto.on) NC.Lessons.ev('autokill'); }
    const J = NC.Journey && NC.Journey.state;
    if (J && J.ev) { J.ev.kill = (J.ev.kill || 0) + 1; J.ev['k_' + sp] = (J.ev['k_' + sp] || 0) + 1; }
  });
  // the hero's hits on a camp dummy (lesson L3 "ตีหุ่นฟาง"): world.js stops NC.damageEnemy for the server's monsters, so
  // lessons.js's own dummy counter never ran online; the server's combat events count instead (a miss too, as offline)
  W.eventHooks.push((ev) => {
    if (!ev || ev.type !== 'combat' || (ev.sourceId !== W.me && ev.actorId !== W.me)) return;
    const e = W.mirrors.get(ev.targetId);
    if (e && e.dummy && NC.Lessons && NC.Lessons.ev) NC.Lessons.ev('dummy');
  });
})();
