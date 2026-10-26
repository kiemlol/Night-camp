/* quests.js — the main story as farming quests, the daily board, the login calendar, reputation (the Game Bible pillars 1,
   2 and 8; the user's quest rules: no private scenes, farming objectives, coins only — "เควสจะไม่ให้เลเวล ให้แค่เงิน").
     the story    js/quests_data.js in order; one quest at a time, taken and handed in at the camp; objectives: kill ·
                  hand in materials · quest-only drops (by day / by night) · life-skill finds · a story boss (its key
                  item drops for the hero who hit it) · a talk · a coin cost. Each quest asks a level (its Lv − 2): no EXP
                  comes from quests, the hero farms up to it. Taking and handing in show the story panels (assets/story).
                  A quest that needs what the game hasn't got yet (the new maps) waits: "the next chapter comes in an update"
     the board    three dailies a day by the hero's level (hunt 300 · deliver 50 · the daytime sunlight 10); coins + season
                  tokens + reputation; the ones not done wait up to 3 days · the week's chest after 5 days of dailies
     calendar     28 boxes, one per day the game is opened (not in a row: a missed day loses nothing)
     reputation   ชาวค่าย · ป๋าหมูหริ่ง (refine −5% a rank) · ลุงโกโก้ (broker slots) · ผู้อพยพ, ranks 1–5
     the bot      "ให้บอทฟาร์ม": the quest's monster only, on its map (the guiding flame takes you there), Auto on
   Page: J → เควส. Tracker: a small box under the minimap. Saved: nightcamp.quests.v1.
   Hooks: NC.skillKills, NC.addMat, NC.HUD.init, NC.Hub pages; NC.Quests.reached(id) tells storyboss.js. */
(function () {
  'use strict';
  const NC = window.NC, ITEMS = NC.ITEMS, MAT = NC.MATERIALS, H = NC.Hub, Q = NC.QUESTS_DATA || [];
  if (!H) return;
  const esc = H.esc, fmt = (n) => NC.fmtCoins(n), KEY = 'nightcamp.quests.v1';
  const G = () => NC.game;
  const dayKey = (d) => { d = d || new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };
  let st = { i: 0, on: false, prog: {}, flags: {}, keys: [], daily: {}, cal: { days: [], got: 0 }, week: {}, tokens: 0, rep: {} };
  try { if (!NC.ONLINE) st = Object.assign(st, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* blocked */ }
  const save = () => { if (G() && G().noSave) return; try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* blocked */ } };
  const cur = () => Q[st.i] || null;
  const inCamp = (game) => !!(game && game.world && game.world.shop);
  // (js/storynpc.js: a quest is taken from and handed to its giver, a story NPC standing in a map)
  const canTalk = (game, q) => (NC.questTalk ? NC.questTalk(game, q) : inCamp(game));
  const whereOf = (q) => (NC.questWhere ? NC.questWhere(q) : 'ค่ายกลางป่า');
  const lvNeed = (q) => Math.max(1, q.lv - 2);

  // ---------------- reputation ----------------
  const REP = { camp: 'ชาวค่าย', smith: 'ป๋าหมูหริ่ง', merchant: 'ลุงโกโก้', refugees: 'ผู้อพยพ' };
  const RANKS = [0, 500, 1500, 4000, 10000];
  const rankOf = (k) => { const v = st.rep[k] || 0; let r = 0; RANKS.forEach((t, i) => { if (v >= t) r = i; }); return r; };
  const addRep = (k, n) => { const before = rankOf(k); st.rep[k] = (st.rep[k] || 0) + n; if (rankOf(k) > before) NC.HUD.log(`ชื่อเสียงกับ${REP[k]} ขึ้นเป็นขั้น ${rankOf(k)}!`, 'level'); };
  NC.refineDiscount = () => 1 - 0.05 * rankOf('smith');

  // ---------------- progress ----------------
  const P = (k) => st.prog[k] || 0;
  const bump = (k, n, max, label) => { const was = P(k); st.prog[k] = Math.min(max, was + n); if (st.prog[k] !== was) { save(); tracker(); if (label) NC.FX.num(G().player.x, G().player.y - 180, label, { fill: '#ffe7a6', size: 26 }); } };
  const isNight = (game) => (NC.isNightNow ? NC.isNightNow(game) : false);
  NC.skillKills.push((game, e) => {
    const q = cur();
    if (!q || !st.on || e._heroT == null || game.time - e._heroT > 3) return;
    q.obj.forEach((o, k) => {
      if (o.k === 'kill' && e.type === o.sp) bump(k, 1, o.n);
      else if (o.k === 'boss' && e.type === o.sp && !e.rootTag) { /* (a boss's shade in รากต้นไม้มืด is not the story's boss: js/rootloot.js) */ bump(k, 1, 1, `ได้ ${q.keys[0] || 'ของเควส'}!`); if (q.key && !st.keys.includes(q.key)) st.keys.push(q.key); }
      else if (o.k === 'qd' && e.type === o.sp && P(k) < o.n && (!o.when || (o.when === 'night') === isNight(game)) && Math.random() < o.ch) bump(k, 1, o.n, `+1 ${o.name}`);
    });
    // the dailies' hunt
    for (const d of todays()) if (d.kind === 'hunt' && !d.done && e.type === d.sp) { d.n = Math.min(d.need, (d.n || 0) + 1); if (d.n % 25 === 0 || d.n === d.need) save(); }
  });
  const baseAdd = NC.addMat;
  NC.addMat = function (game, id, n) {
    const q = cur();
    if (q && st.on && n > 0) q.obj.forEach((o, k) => { if (o.k === 'life' && o.ids.includes(id)) bump(k, n, o.n); });
    return baseAdd.apply(this, arguments);
  };
  const objDone = (q, o, k, p) => {
    if (o.k === 'talk') return q.id !== 'MQ08' || ((NC.JOBS[p.job] || {}).tier || 0) >= 1; // (ห้าทางเดิน asks for the job change: it waits for it)
    if (o.k === 'mat') return NC.matCount(p, o.id) >= o.n;
    if (o.k === 'pay') return (p.coins || 0) >= o.n;
    if (o.k === 'boss') return P(k) >= 1;
    return P(k) >= o.n;
  };
  const objText = (o, k, p) => {
    if (o.k === 'kill') return `ล่า${esc((NC.MONSTERS[o.sp] || {}).name || o.sp)} <b>${P(k)}/${o.n}</b>`;
    if (o.k === 'mat') return `ส่ง${esc((MAT[o.id] || {}).name || o.id)} <b>${Math.min(NC.matCount(p, o.id), o.n)}/${o.n}</b>`;
    if (o.k === 'qd') return `${esc(o.name)} <b>${P(k)}/${o.n}</b> <small>(จาก${esc((NC.MONSTERS[o.sp] || {}).name || o.sp)}${o.when === 'night' ? ' กลางคืน' : o.when === 'day' ? ' กลางวัน' : ''})</small>`;
    if (o.k === 'life') return `${esc(o.text)} <b>${P(k)}/${o.n}</b>`;
    if (o.k === 'boss') return `ล้ม <b>${esc(o.name)}</b> ${P(k) ? '✔' : ''}`;
    if (o.k === 'pay') return `จ่าย ${fmt(o.n)} เหรียญ <small>(${esc(o.text)})</small>`;
    return `<small>${esc(o.text)}</small>`;
  };
  NC.Quests = {
    state: st, data: Q, cur,
    reached(id) { const k = Q.findIndex((q) => q.id === id); return k >= 0 && (st.i > k || (st.i === k && st.on)); },
    done: (id) => { const k = Q.findIndex((q) => q.id === id); return k >= 0 && st.i > k; },
    hasKey: (k) => st.keys.includes(k),
    take: (game) => take(game), handIn: (game) => handIn(game), ready: (q, p) => ready(q, p), lvNeed, objText: (o, k, p) => objText(o, k, p),
    objDone: (q, o, k, p) => objDone(q, o, k, p), // (js/journey.js: AUTO plays the next objective not done)
  };

  // ---------------- taking and handing in ----------------
  function take(game, force) {
    if (NC.Quests.online && NC.Quests.online('take', game)) return; // (?online: the server takes it, js/online/quests.js)
    const q = cur(), p = game.player;
    if (!q || st.on || !q.ok) return;
    if (!force && !canTalk(game, q)) { game.toast('รับเควสได้ที่ ' + whereOf(q)); return; }
    if (p.lv < lvNeed(q)) { game.toast(`ต้อง Lv ${lvNeed(q)} ขึ้นไป · ฟาร์มก่อนนะ`); return; }
    st.on = true; st.prog = {}; save();
    NC.HUD.log(`รับเควส: ${q.title}`, 'level');
    panel(q.story.a, q.title);
    tracker();
    if (NC.StoryBoss) { /* (the story boss appears on its map from now) */ }
  }
  function ready(q, p) { return q.obj.every((o, k) => objDone(q, o, k, p)); }
  function handIn(game) {
    if (NC.Quests.online && NC.Quests.online('handin', game)) return; // (?online: the server hands it in)
    const q = cur(), p = game.player;
    if (!q || !st.on) return;
    if (!canTalk(game, q)) { game.toast('ส่งเควสได้ที่ ' + whereOf(q)); return; }
    if (!ready(q, p)) return;
    for (const o of q.obj) {
      if (o.k === 'mat') { p.mats[o.id] -= o.n; if (p.mats[o.id] <= 0) delete p.mats[o.id]; }
      if (o.k === 'pay') { p.coins -= o.n; if (NC.Econ) NC.Econ.sink('quest', o.n); }
    }
    p.coins = (p.coins || 0) + q.coins; if (NC.Econ) NC.Econ.faucet('quest', q.coins);
    addRep('camp', 60 + q.lv * 3);
    if (/บทที่ 4|บทที่ 9/.test(q.ch)) addRep('refugees', 80);
    for (const k of q.keys) if (!st.keys.includes(k)) st.keys.push(k);
    NC.HUD.log(`ส่งเควส ${q.title} · ได้ ${fmt(q.coins)} เหรียญ`, 'level');
    NC.FX.stars(p.x, p.y - 90, 18, '255,220,120', { speed: 280 });
    const story = q.story.d;
    st.i++; st.on = false; st.prog = {}; save(); NC.saveGame(game);
    panel(story, q.title, CHOICE[q.id]);
    tracker();
  }
  // the choices the story remembers (flags for later chapters)
  const CHOICE = {
    MQ07: { key: 'honest_lily', a: 'บอกความจริง: ไม่เชื่อ', b: 'ปลอบว่าเขาย้ายไปจริง ๆ' },
    MQ22: { key: 'scarf_told', a: 'บอกลิลลี่', b: 'เก็บเป็นความลับ' },
    MQ32: { key: 'noel_trusted', a: 'เก็บความลับของโนเอล', b: 'บอกเฮเซล' },
  };

  // ---------------- the story panel ----------------
  let pan = null;
  function panel(story, title, choice) {
    if (!story || !story.length) { if (choice) st.flags[choice.key] = true; return; }
    const [img, ...lines] = story, game = G();
    if (!pan) {
      pan = document.createElement('div');
      pan.className = 'sp-pop'; pan.hidden = true;
      pan.innerHTML = '<div class="sp-card"><img class="sp-img" alt=""><div class="sp-title"></div><div class="sp-text"><b class="sp-who"></b><p class="sp-line"></p></div>' +
        '<div class="sp-btns"></div></div>';
      document.body.appendChild(pan);
    }
    let n = 0;
    const show = () => {
      const [who, line] = lines[n] || ['', ''];
      pan.querySelector('.sp-img').src = `assets/story/${img}.jpg`;
      pan.querySelector('.sp-title').textContent = title;
      pan.querySelector('.sp-who').textContent = who || '';
      pan.querySelector('.sp-line').textContent = line;
      const last = n >= lines.length - 1, B = pan.querySelector('.sp-btns');
      B.innerHTML = last && choice ? `<button class="kw-btn blue" data-c="a">${esc(choice.a)}</button><button class="kw-btn grey" data-c="b">${esc(choice.b)}</button>`
        : `<button class="kw-btn gold" data-c="next">${last ? 'ไปต่อ' : 'ต่อไป ›'}</button>`;
    };
    pan.onclick = (e) => {
      const b = e.target.closest('[data-c]');
      if (!b) return;
      if (b.dataset.c === 'next' && n < lines.length - 1) { n++; show(); return; }
      if (choice && (b.dataset.c === 'a' || b.dataset.c === 'b')) { st.flags[choice.key] = b.dataset.c === 'a'; save(); }
      pan.hidden = true; if (game) game.paused = false;
    };
    show(); pan.hidden = false; if (game) game.paused = true;
  }

  // ---------------- the bot farms the quest ----------------
  function botFarm(game, o) {
    const A = NC.Auto;
    if (!A) return;
    const sp = o.sp, where = Object.keys(NC.ROSTER || {}).find((m) => JSON.stringify(NC.ROSTER[m]).includes(`"${sp}"`));
    const off = Object.keys(NC.MONSTERS).filter((x) => x !== sp);
    A.set.off = off;
    NC.HUD.panel('journal', false); game.paused = false;
    const go = () => { if (!A.on) A.toggle(game); NC.HUD.log(`ออโต้ฟาร์ม: ล่าเฉพาะ${(NC.MONSTERS[sp] || {}).name || sp} (ตั้งค่าได้ที่ Z)`, 'level'); };
    if (where && where !== game.mapId && NC.MAPS[where]) { NC.Maps.go(game, where); setTimeout(go, 1500); } else go();
  }

  // ---------------- dailies, the week, the calendar ----------------
  function todays() {
    const g = G(), p = g && g.player;
    if (!p) return [];
    const k = dayKey();
    if (!st.daily[k]) {
      const lv = p.lv, sp = Object.keys(NC.LOOT_DATA ? NC.LOOT_DATA.top : {}).filter((s) => { const t = NC.LOOT_DATA.top[s]; return t >= lv - 8 && t <= lv + 18; });
      const pool = sp.length ? sp : ['slime_green'];
      const seed = (k % 97) + lv;
      const a = pool[seed % pool.length], b = pool[(seed * 7 + 3) % pool.length];
      const mat = ((NC.MAT_DROPS || {})[b] || [])[0];
      st.daily[k] = [
        { kind: 'hunt', sp: a, need: 300, n: 0 },
        { kind: 'deliver', id: mat ? mat[0] : 'mat_leaf_jelly', need: 50 },
        { kind: 'sun', id: 'mat_sunspark', need: 10 },
      ];
      const keys = Object.keys(st.daily).sort(); while (keys.length > 3) delete st.daily[keys.shift()]; // (3 days wait at the most)
      save();
    }
    return Object.values(st.daily).flat();
  }
  const dailyCoins = (p) => Math.max(300, p.lv * 100);
  function claimDaily(game, dk, i) {
    if (NC.Quests.online && NC.Quests.online('daily', game, dk, i)) return; // (?online: the server pays the daily)
    const p = game.player, d = (st.daily[dk] || [])[i];
    if (!d || d.done) return;
    if (d.kind !== 'hunt') { if (NC.matCount(p, d.id) < d.need) return; p.mats[d.id] -= d.need; if (p.mats[d.id] <= 0) delete p.mats[d.id]; }
    else if ((d.n || 0) < d.need) return;
    d.done = true;
    const c = dailyCoins(p); p.coins += c; st.tokens += 10; addRep(d.kind === 'deliver' ? 'merchant' : 'camp', 40);
    if (NC.Econ) NC.Econ.faucet('daily', c);
    const wk = Math.floor((Date.now() / 86400000 + 3) / 7);
    st.week[wk] = st.week[wk] || []; if (!st.week[wk].includes(dk)) st.week[wk].push(dk);
    NC.HUD.log(`ทำรายวันเสร็จ · ${fmt(c)} เหรียญ · ตราฤดูกาล +10`, 'level');
    save(); NC.saveGame(game);
  }
  function weekChest(game) {
    if (NC.Quests.online && NC.Quests.online('week', game)) return; // (?online: the server opens the week's chest)
    const p = game.player, wk = Math.floor((Date.now() / 86400000 + 3) / 7), days = (st.week[wk] || []).length;
    if (days < 5 || st.week['got' + wk]) return;
    st.week['got' + wk] = 1;
    const c = p.lv * 500; p.coins += c; st.tokens += 50; p.feathers = (p.feathers || 0) + 2;
    NC.addMat(game, 'mat_opt_stone', 2);
    if (NC.Econ) NC.Econ.faucet('weekly', c);
    NC.HUD.log(`หีบประจำสัปดาห์: ${fmt(c)} เหรียญ · หินออฟ 2 · ขนนกไออุ่น 2 · ตราฤดูกาล 50`, 'level');
    save(); NC.saveGame(game);
  }
  const CAL = [['coins', 1000], ['red', 10], ['coins', 2000], ['feather', 1], ['blue', 10], ['coins', 5000], ['opt', 1],
    ['coins', 3000], ['red', 20], ['feather', 2], ['coins', 8000], ['blue', 20], ['opt', 2], ['tokens', 50],
    ['coins', 10000], ['red', 30], ['feather', 3], ['coins', 15000], ['opt', 3], ['blue', 30], ['tokens', 100],
    ['coins', 20000], ['feather', 4], ['opt', 4], ['coins', 30000], ['tokens', 150], ['drill', 1], ['title', 'นักเดินทางผู้ไม่ลืมค่าย']];
  const CAL_TH = { coins: (v) => `${fmt(v)} เหรียญ`, red: (v) => `ยาแดง ${v}`, blue: (v) => `ยาฟ้า ${v}`, feather: (v) => `ขนนกไออุ่น ${v}`, opt: (v) => `หินออฟ ${v}`,
    tokens: (v) => `ตราฤดูกาล ${v}`, drill: (v) => `หินเจาะออฟ ${v}`, title: (v) => `ฉายา "${v}"` };
  function calendar(game) {
    if (NC.Quests.online && NC.Quests.online('calendar', game)) return; // (?online: the server's calendar)
    const k = dayKey(), p = game.player;
    if (st.cal.days.includes(k) || st.cal.got >= CAL.length) return;
    st.cal.days.push(k);
    const [kind, v] = CAL[st.cal.got++];
    // (potions: the size of the hero's level, js/potions.js)
    const potQ = (kind === 'red' || kind === 'blue') && NC.POT ? NC.POT.add(p, kind, NC.POT.sizeFor(p.lv), v) : null;
    if (kind === 'coins') p.coins += v; else if (potQ) { /* given */ } else if (kind === 'red') p.potions += v; else if (kind === 'blue') p.spPotions += v;
    else if (kind === 'feather') p.feathers = (p.feathers || 0) + v; else if (kind === 'opt') NC.addMat(game, 'mat_opt_stone', v);
    else if (kind === 'drill') NC.addMat(game, 'mat_drill_stone', v); else if (kind === 'tokens') st.tokens += v; else if (kind === 'title') st.flags.title = v;
    NC.HUD.log(`ปฏิทินค่าย วันที่ ${st.cal.got}: ${potQ ? `${potQ.name} ${v}` : CAL_TH[kind](v)}`, 'level');
    save(); NC.saveGame(game);
  }
  NC.Quests.tokens = () => st.tokens;
  NC.Quests.panel = (story, title, choice) => panel(story, title, choice); // (js/online/quests.js: the server's story panels)
  NC.Quests.tracker = () => tracker();
  NC.Quests.online = null; // (js/online/quests.js: fn(op, game, ...) -> true when the server does it)
  NC.Quests.calCells = null; // (js/online/extras.js: the calendar's boxes from the server's check-in)
  NC.Quests.spendTokens = (n) => { if (st.tokens < n) return false; st.tokens -= n; save(); return true; };

  // ---------------- the page ----------------
  let qtab = 'story';
  NC.Quests.openCalendar = () => { qtab = 'cal'; H.open('quest'); };
  function render(el, game) {
    const p = game.player, q = cur(), camp = q ? canTalk(game, q) : inCamp(game);
    const tabs = [['story', 'เนื้อเรื่อง'], ['daily', 'รายวัน'], ['cal', 'ปฏิทิน'], ['rep', 'ชื่อเสียง']];
    let h = `<div class="bb-h">เควส <small>ตราฤดูกาล ${st.tokens}</small></div><div class="bb-chips">${tabs.map(([k, n]) => `<button class="bb-chip ${qtab === k ? 'on' : ''}" data-qt="${k}">${n}</button>`).join('')}</div>`;
    if (qtab === 'story') {
      if (!q) h += '<div class="bb-empty">จบเนื้อเรื่องที่มีตอนนี้แล้ว</div>';
      else if (!q.ok) h += `<div class="bb-detail"><b>${esc(q.ch)}</b><br>${esc(q.title)}<br><span class="dim">เนื้อเรื่องตอนต่อไปจะมาในอัปเดตหน้า (แมพใหม่: ${esc(q.map)})</span></div>`;
      else {
        const lvOk = p.lv >= lvNeed(q), rd = st.on && ready(q, p);
        h += `<div class="bb-sub">${esc(q.ch)}</div><div class="bb-detail"><b style="font-size:calc(21*var(--u))">${esc(q.title)}</b><br>` +
          `<span class="dim">${esc(q.map)} · ต้อง Lv ${lvNeed(q)} · รางวัล ${fmt(q.coins)} เหรียญ${q.keys.length ? ' · ' + esc(q.keys.join(' · ')) : ''}</span>` +
          (st.on ? '<div style="margin-top:calc(8*var(--u))">' + q.obj.map((o, k) => `<div class="${objDone(q, o, k, p) ? 'ok' : ''}">${objDone(q, o, k, p) ? '✔' : '•'} ${objText(o, k, p)}` +
            ((o.k === 'kill' || o.k === 'qd') && !objDone(q, o, k, p) ? ` <button class="kw-btn blue" data-bot="${k}" style="height:calc(30*var(--u));font-size:calc(14*var(--u));margin:0 0 0 calc(6*var(--u))">ให้บอทฟาร์ม</button>` : '') + '</div>').join('') + '</div>' : '') +
          '<div>' + (!st.on ? `<button class="kw-btn gold" data-q="take" ${camp && lvOk ? '' : 'disabled'}>รับเควส</button>` : `<button class="kw-btn gold" data-q="in" ${camp && rd ? '' : 'disabled'}>ส่งเควส</button>`) +
          (q.story.a && st.on ? '<button class="kw-btn grey" data-q="again">ดูเรื่องราวอีกครั้ง</button>' : '') + '</div>' +
          (!camp ? `<div class="dim">รับและส่งเควสกับ ${esc(whereOf(q))}</div>` : '') + (!lvOk ? `<div class="dim">ฟาร์มให้ถึง Lv ${lvNeed(q)} ก่อน (เควสไม่ให้ EXP)</div>` : '') + '</div>';
        const next = Q.slice(st.i + 1, st.i + 4);
        if (next.length) h += '<div class="bb-h2">ถัดไป</div><div class="bb-list">' + next.map((n) => `<div class="bb-row done"><div class="t"><b>${esc(n.title)}</b><small>${esc(n.ch)} · Lv ${lvNeed(n)}${n.ok ? '' : ' · รออัปเดต'}</small></div></div>`).join('') + '</div>';
      }
    } else if (qtab === 'daily') {
      todays();
      const wk = Math.floor((Date.now() / 86400000 + 3) / 7), days = (st.week[wk] || []).length;
      h += `<div class="bb-sub">3 ใบต่อวัน · ใบที่ยังไม่ทำเก็บไว้ได้ 3 วัน · ใบละ ${fmt(dailyCoins(p))} เหรียญ + ตราฤดูกาล 10</div><div class="bb-list">`;
      for (const dk of Object.keys(st.daily).sort().reverse()) st.daily[dk].forEach((d, i) => {
        const have = d.kind === 'hunt' ? d.n || 0 : NC.matCount(p, d.id), can = !d.done && have >= d.need;
        const what = d.kind === 'hunt' ? `ล่า${esc((NC.MONSTERS[d.sp] || {}).name || d.sp)}` : d.kind === 'sun' ? 'ส่งประกายแดด (ได้เฉพาะกลางวัน)' : `ส่ง${esc((MAT[d.id] || {}).name || d.id)}`;
        h += `<div class="bb-row ${d.done ? 'done' : can ? 'on' : ''}"><div class="t"><b>${what}</b><small>${dk === dayKey() ? 'วันนี้' : 'ค้างจากวันก่อน'} · ${Math.min(have, d.need)}/${d.need}</small>` +
          `<div class="bb-bar"><i style="width:${Math.min(100, (have / d.need) * 100)}%"></i></div></div>` +
          (d.done ? '<span class="n">✔</span>' : `<button class="kw-btn gold" data-daily="${dk}:${i}" ${can ? '' : 'disabled'}>รับรางวัล</button>`) + '</div>';
      });
      h += '</div>' + `<div class="bb-h2">หีบประจำสัปดาห์ <small>ทำรายวันแล้ว ${days}/5 วัน</small></div>` +
        `<div class="bb-row ${days >= 5 ? 'on' : ''}"><img src="${H.icon('ic_season')}" alt=""><div class="t"><b>หีบสัปดาห์</b><small>${fmt(p.lv * 500)} เหรียญ · หินออฟ 2 · ขนนกไออุ่น 2 · ตราฤดูกาล 50</small></div>` +
        `<button class="kw-btn gold" data-week="1" ${days >= 5 && !st.week['got' + wk] ? '' : 'disabled'}>${st.week['got' + wk] ? 'รับแล้ว' : 'เปิดหีบ'}</button></div>`;
    } else if (qtab === 'cal') {
      // (?online: the server's month, js/online/extras.js: { got, cells: [text], note })
      const oc = NC.Quests.calCells && NC.Quests.calCells(), got = oc ? oc.got : st.cal.got, cells = oc ? oc.cells : CAL.map(([k, v]) => CAL_TH[k](v));
      h += `<div class="bb-sub">${oc && oc.note ? esc(oc.note) : 'เปิดเกมวันไหนได้กล่องวันนั้น ไม่ต้องติดต่อกัน ขาดแล้วไม่เริ่มใหม่'} · ได้แล้ว ${got}/${cells.length}</div><div class="bb-grid" style="grid-template-columns:repeat(7,minmax(0,1fr))">` +
        cells.map((t, i) => `<div class="bb-cell ${i < got ? 'r-rare' : i === got ? 'sel' : ''}" style="aspect-ratio:auto;padding:calc(6*var(--u));font-size:calc(13*var(--u));text-align:center;cursor:default">` +
          `<div><b>วันที่ ${i + 1}</b><br>${esc(t)}${i < got ? '<br>✔' : ''}</div></div>`).join('') + '</div>';
    } else {
      h += '<div class="bb-list">' + Object.entries(REP).map(([k, n]) => {
        const v = st.rep[k] || 0, r = rankOf(k), next = RANKS[r + 1];
        const perk = { camp: 'ส่วนลดวาร์ป ฉายา', smith: `ค่าตีบวก −${5 * r}%`, merchant: 'ช่องฝากขายเพิ่ม', refugees: 'ชุดผ้าคลุมผู้อพยพ (เร็ว ๆ นี้)' }[k];
        return `<div class="bb-row"><div class="t"><b>${n} · ขั้น ${r}</b><small>${v.toLocaleString()} แต้ม${next ? ` · ขั้นต่อไป ${next.toLocaleString()}` : ' · สูงสุด'} · ${perk}</small>` +
          `<div class="bb-bar"><i style="width:${next ? Math.min(100, ((v - RANKS[r]) / (next - RANKS[r])) * 100) : 100}%"></i></div></div></div>`;
      }).join('') + '</div><div class="bb-note">ชื่อเสียงได้จากเควสหลัก รายวัน และส่งของ · ป๋าหมูหริ่งให้ส่วนลดตีบวกตามขั้น</div>';
    }
    el.innerHTML = h;
  }
  H.add({ id: 'quest', name: 'เควส', icon: 'ic_quest', order: 5, render,
    click(e, game) {
      const t = e.target.closest('[data-qt]'); if (t) { qtab = t.dataset.qt; return true; }
      const b = e.target.closest('[data-q]');
      if (b && !b.disabled) { if (b.dataset.q === 'take') take(game); else if (b.dataset.q === 'in') handIn(game); else panel(cur().story.a, cur().title); return true; }
      const bot = e.target.closest('[data-bot]'); if (bot) { botFarm(game, cur().obj[Number(bot.dataset.bot)]); return false; }
      const d = e.target.closest('[data-daily]'); if (d && !d.disabled) { const [dk, i] = d.dataset.daily.split(':'); claimDaily(game, dk, Number(i)); return true; }
      const w = e.target.closest('[data-week]'); if (w && !w.disabled) { weekChest(game); return true; }
      return false;
    },
    dot(game) { const q = cur(); return !!(q && q.ok && ((!st.on && game.player.lv >= lvNeed(q)) || (st.on && ready(q, game.player)))); } });

  // ---------------- the tracker under the minimap ----------------
  let trk = null;
  function tracker() {
    const g = G();
    if (!trk || !g || !g.player) return;
    const q = cur(), p = g.player;
    if (!q || !q.ok) { trk.hidden = true; return; }
    trk.hidden = false;
    trk.innerHTML = `<b>${esc(q.title)}</b>` + (st.on ? q.obj.filter((o) => o.k !== 'talk').map((o) => { const k = q.obj.indexOf(o); return `<div class="${objDone(q, o, k, p) ? 'ok' : ''}">${objText(o, k, p)}</div>`; }).join('')
      : `<div>${p.lv >= lvNeed(q) ? 'กลับค่ายเพื่อรับเควส (J)' : `ฟาร์มให้ถึง Lv ${lvNeed(q)} เพื่อรับเควสต่อไป`}</div>`);
  }
  const baseInit = NC.HUD.init.bind(NC.HUD);
  NC.HUD.init = function (game) {
    baseInit(game);
    trk = document.createElement('div');
    trk.className = 'qt-box'; trk.title = 'เควส (J)';
    trk.addEventListener('click', () => { H.open('quest'); });
    (document.getElementById('hud') || document.body).appendChild(trk);
    tracker();
    setInterval(tracker, 2000);
    setTimeout(() => calendar(game), 2500);
    if (st.i === 0 && !st.on && !NC.ONLINE) setTimeout(() => { if (cur() && cur().id === 'MQ00' && inCamp(game)) take(game, true); }, 3000); // (the first one comes by itself)
  };
})();
