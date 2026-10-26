/* ranks.js — the leaderboard (N) (the user, 2026-10-01: "ทำ leader board"), layout "A" of the social pages
   (assets/gen/nightcamp_pg_rank_a_raw.png): a night stage with three podiums on top (assets/kui/rank_stage.jpg; the
   game stands the top 3 on them in their own outfits, numbers and name plates), the category tabs above it, a job
   filter, the list from #4, and my own place pinned at the bottom.
   Categories: เลเวล (level, then EXP), ล่าบอส (bosses killed this season), ฆ่ามอน (monsters killed this season), ความรวย
   (coins), อาชีพเสริม (the life skills' levels added up), กิลด์ (guild EXP: js/guild.js writes it into guilds/{gid}).
   Seasons: three months each (the same numbers as season.js); the season's kills and bosses start again at 0.
   Every player writes their own ranks/{uid} on NC.Store (js/store.js) when it changed (at most every 60 s; at once
   for a level or a job): name, job, line (the 1st job: the filter), lv, xp, lvs (lv x 1000 + EXP ‰: one number to sort
   by), boss, kills, coins, life, guild, gcolor, eq (the look), season, t.
   NC.Ranks: open(cat) · push() (write mine now). Hooks: NC.skillKills (the counts), NC.HUD.init / panel, the N key. */
(function () {
  'use strict';
  const NC = window.NC, S = NC.Store;
  if (!S) return;
  const $ = (id) => document.getElementById(id);
  const G = () => NC.game;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const clean = (s, n) => (NC.Net && NC.Net.clean ? NC.Net.clean(s, n) : String(s == null ? '' : s).trim().slice(0, n));
  const fmt = (n) => (NC.fmtCoins ? NC.fmtCoins(Math.round(n)) : Math.round(n).toLocaleString());
  const icon = (k) => ((NC.ASSET_MANIFEST || {})[k] || {}).src || '';
  const KEY = 'nightcamp.ranks.v1', TAU = Math.PI * 2;
  const SLOTS = ['hat', 'hair', 'top', 'pants', 'shoes', 'weapon', 'robe', 'cape', 'glasses'];
  const seasonNo = () => (NC.Season && NC.Season.seasonNo ? NC.Season.seasonNo() : (() => { const d = new Date(); return 1 + Math.max(0, Math.floor(((d.getFullYear() - 2026) * 12 + d.getMonth() - 9) / 3)); })());
  function daysLeft() { // the season ends when its third month does
    const s = seasonNo(), m0 = 9 + (s - 1) * 3, end = new Date(2026 + Math.floor((m0 + 3) / 12), (m0 + 3) % 12, 1);
    return Math.max(0, Math.ceil((end - Date.now()) / 86400000));
  }
  const CATS = [
    { id: 'lv', name: 'เลเวล', field: 'lvs', show: (d) => `Lv ${d.lv | 0} · ${Math.floor((+d.xp || 0) * 100)}%` },
    { id: 'boss', name: 'ล่าบอส', field: 'boss', season: true, show: (d) => `ล่าบอส ${(d.boss | 0).toLocaleString()} ตัว` },
    { id: 'kills', name: 'ฆ่ามอน', field: 'kills', season: true, show: (d) => `${(d.kills | 0).toLocaleString()} ตัว` },
    { id: 'coins', name: 'ความรวย', field: 'coins', show: (d) => `${fmt(+d.coins || 0)} เหรียญ` },
    { id: 'life', name: 'อาชีพเสริม', field: 'life', show: (d) => `อาชีพเสริมรวม Lv ${d.life | 0}` },
    { id: 'pvp', name: 'ประลอง', field: 'pvp', season: true, show: (d) => `ชนะดวล ${(d.pvp | 0).toLocaleString()} ครั้ง` }, // (pvp.js: duels won this season)
    { id: 'guild', name: 'กิลด์', field: 'score', coll: 'guilds', show: (d) => `Lv ${Math.max(1, d.lv | 0)} · ${Math.round(d.score || 0).toLocaleString()} EXP` },
  ];
  // the job filter: the 1st-job lines, each with the weapon it starts with
  const LINE_WEAPON = { knight: 'sword', mage: 'staff', archer: 'bow', rogue: 'dagger', priest: 'staff_holy', acolyte: 'staff_holy', merchant: 'axe', ninja: 'dagger' };
  function lineOf(job) {
    let j = job, J = NC.JOBS[j], n = 0;
    while (J && J.tier > 1 && J.from && n++ < 6) { j = J.from; J = NC.JOBS[j]; }
    return J && J.tier === 1 ? j : 'traveler';
  }
  const lines = () => Object.keys(NC.JOBS).filter((j) => NC.JOBS[j].tier === 1);

  // ---------------- my counts this season ----------------
  let st = { season: seasonNo(), kills: 0, boss: 0 };
  try { if (!NC.ONLINE) st = Object.assign(st, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* blocked */ }
  const save = () => { if (G() && G().noSave) return; try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* blocked */ } };
  const isBoss = (e) => !!((NC.BOSSES && NC.BOSSES[e.type]) || (NC.DUNGEON_BOSSES && NC.DUNGEON_BOSSES[e.type]) || e.boss || e.isBoss || e.worldBoss || e.guildBoss || e.storyBoss);
  if (NC.skillKills) NC.skillKills.push((game, e) => {
    if (e._heroT == null || game.time - e._heroT > 3 || e.lootless || /^chest_/.test(e.type || '')) return;
    if (st.season !== seasonNo()) { st = { season: seasonNo(), kills: 0, boss: 0 }; }
    st.kills++;
    if (isBoss(e)) { st.boss++; push(true); }
    dirty = true;
  });
  // a duel won (pvp.js tells NC.pvpEnds): one more this season, written at once
  (NC.pvpEnds = NC.pvpEnds || []).push((res) => {
    if (res !== 'win') return;
    if (st.season !== seasonNo()) st = { season: seasonNo(), kills: 0, boss: 0 };
    st.pvp = (st.pvp | 0) + 1; save(); push(true);
  });
  let dirty = false;
  setInterval(() => { if (dirty) { dirty = false; save(); } }, 10000);

  // ---------------- my row in the store ----------------
  let uid = null, lastSig = '', lastT = 0, lastLv = 0;
  function lifeSum(p) {
    const L = NC.Life;
    if (!L || !L.SKILLS) return 0;
    let s = 0;
    for (const id of Object.keys(L.SKILLS)) { try { s += L.lvOf(p, id) | 0; } catch (e) { /* (no record yet) */ } }
    return s;
  }
  function row() {
    const g = G(), p = g.player, gd = NC.Guild && NC.Guild.guild && NC.Guild.gid() ? NC.Guild.guild() : null;
    const xp = p.lv >= (NC.LV_MAX || 99) ? 0 : Math.max(0, Math.min(0.999, p.xp / Math.max(1, NC.xpNext(p.lv))));
    return {
      name: clean(p.name, 16) || 'ผู้เล่น', job: p.job, line: lineOf(p.job), lv: p.lv, xp: +xp.toFixed(3), lvs: p.lv * 1000 + Math.floor(xp * 1000),
      boss: st.season === seasonNo() ? st.boss : 0, kills: st.season === seasonNo() ? st.kills : 0, coins: Math.round(p.coins || 0), life: lifeSum(p),
      pvp: st.season === seasonNo() ? st.pvp | 0 : 0,
      guild: gd ? clean(gd.name, 16) : null, gcolor: gd ? gd.color : null, gemb: gd ? gd.emblem | 0 : null,
      eq: SLOTS.map((s) => p.equip[s] || null), season: seasonNo(),
    };
  }
  function push(force) {
    const g = G();
    if (!uid || !g || !g.player || g.noRanks) return;
    const r = row(), sig = JSON.stringify(r), now = Date.now();
    if (sig === lastSig) return;
    if (!force && now - lastT < 60000 && r.lv === lastLv) return;
    lastSig = sig; lastT = now; lastLv = r.lv;
    r.t = now;
    for (const k in cache) delete cache[k]; // (my own row changed: the boards read again)
    return S.set('ranks/' + uid, r);
  }
  S.ready.then(() => { uid = S.me(); setTimeout(() => push(true), 4000); setInterval(() => push(false), 15000); });

  // ======================================================================================================
  // ---------------- the window (N), layout A ----------------
  const ART = 'assets/kui/rank_stage.jpg', AW = 1280, AH = 533, BAND = [22, 442];
  // the podiums: [centre x, top y (where the feet stand), the front's number spot y], 1st in the middle
  const POD = { 1: [639, 258, 294], 2: [380, 294, 326], 3: [902, 303, 334] };
  const MEDAL = { 1: ['#ffd35c', '#c98a1a'], 2: ['#e6ecf5', '#8d9bb0'], 3: ['#f2a46a', '#a85a2c'] };
  const art = new Image();
  art.src = ART;
  let win = null, stage = null, raf = 0, cat = 'lv', job = 'all', rows = [], meRow = null, myRank = null, fetchedT = 0, busy = false;
  const cache = {};

  function build() {
    win = document.createElement('div');
    win.id = 'rankwin'; win.className = 'kw-panel'; win.hidden = true;
    win.innerHTML = '<div class="rk-wrap"><section class="kw-win rk-win">' +
      '<header class="kw-title"><span>ตารางอันดับ</span><span class="rk-season" id="rk-season"></span><button class="kw-x" id="rk-close" aria-label="ปิด">✕</button></header>' +
      `<nav class="kw-tabs rk-tabs">${CATS.map((c) => `<button class="kw-tab" data-cat="${c.id}">${c.name}</button>`).join('')}</nav>` +
      '<div class="rk-filter" id="rk-filter"></div>' +
      '<div class="rk-stage"><canvas id="rk-stage"></canvas><div class="rk-plates" id="rk-plates"></div></div>' +
      '<div class="rk-list kw-scroll" id="rk-list"></div><div class="rk-me" id="rk-me"></div></section></div>';
    document.body.appendChild(win);
    stage = $('rk-stage');
    $('rk-close').addEventListener('click', close);
    win.addEventListener('click', (e) => {
      const c = e.target.closest('[data-cat]');
      if (c) { cat = c.dataset.cat; load(); return; }
      const j = e.target.closest('[data-job]');
      if (j) { job = j.dataset.job; render(); }
    });
  }
  function open(c) { if (c) cat = c; render(); Promise.resolve(push(true)).catch(() => {}).then(load); if (!raf) raf = requestAnimationFrame(loop); }
  function close() { NC.HUD.panel('ranks', false); const g = G(); if (g) g.paused = false; }
  function fit() {
    const wrap = win.querySelector('.rk-wrap');
    wrap.style.transform = 'translate(-50%, -50%)';
    const k = Math.min(1, (innerWidth - 16) / wrap.offsetWidth, (innerHeight - 16) / wrap.offsetHeight);
    if (k < 1) wrap.style.transform = `translate(-50%, -50%) scale(${k.toFixed(4)})`;
  }
  addEventListener('resize', () => setTimeout(() => { if (win && !win.hidden) { fit(); faces(); } }, 0));
  setInterval(() => { if (win && !win.hidden) { if (Date.now() - fetchedT > 60000) load(); else renderMe(); } }, 15000);

  const C = () => CATS.find((c) => c.id === cat);
  async function load() {
    const c = C();
    render();
    if (busy) return;
    const hit = cache[cat];
    if (hit && Date.now() - hit.t < 20000) { rows = hit.rows; fetchedT = hit.t; myRank = hit.me; render(); return; }
    busy = true;
    try {
      let list = await S.query(c.coll || 'ranks', { order: [c.field, 'desc'], limit: 100 });
      if (c.season) list = list.filter((r) => r.data.season === seasonNo());
      if (c.id === 'guild' && NC.Guild && NC.Guild.gid()) { // (my own guild: its live numbers)
        const gid = NC.Guild.gid(), t = NC.Guild.totals();
        list = list.filter((r) => r.id !== gid).concat({ id: gid, data: Object.assign({}, NC.Guild.guild(), { score: t.exp, lv: t.lv, n: t.n }) }).sort((a, b) => (b.data.score || 0) - (a.data.score || 0));
      }
      list = list.filter((r) => (r.data[c.field] || 0) > 0 || !c.season);
      rows = list;
      // my place when I am further down than the list goes
      let me = null;
      if (c.id === 'guild') { const gid = NC.Guild && NC.Guild.gid(); const i = list.findIndex((r) => r.id === gid); me = gid ? (i >= 0 ? i + 1 : null) : null; }
      else {
        const i = list.findIndex((r) => r.id === uid);
        if (i >= 0) me = i + 1;
        else { const mine = row()[c.field] || 0; try { me = (await S.query('ranks', { where: [[c.field, '>', mine]] })).filter((r) => !c.season || r.data.season === seasonNo()).length + 1; } catch (e) { me = null; } }
      }
      myRank = me; fetchedT = Date.now();
      cache[cat] = { rows, t: fetchedT, me };
    } catch (e) { console.warn('ranks: load', e); rows = []; }
    busy = false;
    render();
  }

  // ---------------- the HTML ----------------
  const jobName = (j) => (NC.JOBS[j] || {}).name || '';
  function lineIcon(l) { const w = LINE_WEAPON[l]; return w && NC.ITEMS[w] && NC.itemIcon ? NC.itemIcon(w, 64) : ''; }
  const iconSrc = (x) => (x && x.toDataURL ? x.toDataURL() : x || '');
  const lineImg = (l, cls) => { const s = iconSrc(lineIcon(l)); return s ? `<img${cls ? ` class="${cls}"` : ''} src="${s}" alt="">` : ''; }; // (a traveler has no line yet)
  function visible() {
    if (cat === 'guild' || job === 'all') return rows;
    return rows.filter((r) => r.data.line === job);
  }
  let lastList = '';
  function render() {
    if (!win || win.hidden) return;
    const c = C(), list = visible();
    $('rk-season').textContent = `ฤดูกาล ${seasonNo()} · เหลือ ${daysLeft()} วัน`;
    for (const b of win.querySelectorAll('[data-cat]')) b.classList.toggle('on', b.dataset.cat === cat);
    $('rk-filter').innerHTML = cat === 'guild' ? '<span class="rk-fnote">กิลด์เรียงตาม EXP กิลด์ทั้งหมด</span>'
      : `<button class="rk-job${job === 'all' ? ' on' : ''}" data-job="all"><b>ทั้งหมด</b></button>` +
        lines().map((l) => `<button class="rk-job${job === l ? ' on' : ''}" data-job="${l}" title="${esc(jobName(l))}">${lineImg(l)}<span>${esc(jobName(l))}</span></button>`).join('');
    // the plates over the podiums
    const M = stageMap();
    $('rk-plates').innerHTML = [1, 2, 3].map((n) => {
      const r = list[n - 1], [x] = POD[n], y = POD[n][2] + 18;
      if (!r) return `<div class="rk-plate empty" style="left:${((M.x(x) / M.W) * 100).toFixed(2)}%;top:${((M.y(y) / M.H) * 100).toFixed(2)}%">ว่าง</div>`;
      const d = r.data;
      return `<div class="rk-plate p${n}" style="left:${((M.x(x) / M.W) * 100).toFixed(2)}%;top:${((M.y(y) / M.H) * 100).toFixed(2)}%">` +
        `<b>${esc(clean(d.name, 16))}</b>${cat === 'guild' ? `<small>สมาชิก ${Math.max(1, d.n | 0)} คน</small>` : d.guild ? `<small style="color:color-mix(in srgb, ${/^#[0-9a-f]{6}$/i.test(d.gcolor) ? d.gcolor : '#8a6a2a'} 55%, #2a2435)">[${esc(clean(d.guild, 16))}]</small>` : ''}` +
        `<i>${cat === 'guild' ? '' : esc(jobName(d.job)) + ' · '}${esc(c.show(d))}</i></div>`;
    }).join('');
    // the list from #4
    let h = '';
    list.slice(3, 50).forEach((r, i) => {
      const d = r.data, n = i + 4, mine = cat === 'guild' ? r.id === (NC.Guild && NC.Guild.gid()) : r.id === uid;
      h += `<div class="rk-row${mine ? ' me' : ''}"><span class="rk-no">#${n}</span>` +
        (cat === 'guild' ? `<span class="rk-gem"><i style="background:${/^#[0-9a-f]{3,8}$/i.test(d.color) ? d.color : '#ccc'}"></i><img src="${icon('gem_' + (d.emblem | 0))}" alt=""></span>` : `<canvas data-face="${esc(r.id)}"></canvas>`) +
        `<b class="rk-name">${esc(clean(d.name, 16))}</b><span class="rk-guild">${cat !== 'guild' && d.guild ? '[' + esc(clean(d.guild, 16)) + ']' : ''}</span>` +
        `<span class="rk-job2">${cat === 'guild' ? `สมาชิก ${Math.max(1, d.n | 0)}` : `${lineImg(d.line)}${esc(jobName(d.job))}`}</span><span class="rk-score">${esc(c.show(d))}</span></div>`;
    });
    if (!list.length) h = `<div class="rk-empty">${busy ? 'กำลังโหลด…' : 'ยังไม่มีใครในตารางนี้'}</div>`;
    else if (list.length <= 3) h = '<div class="rk-empty">ยังไม่มีอันดับที่ 4 ลงไป</div>';
    if (h !== lastList) { $('rk-list').innerHTML = h; lastList = h; }
    renderMe();
    fit();
    faces();
  }
  function renderMe() {
    const el = $('rk-me'), c = C(), g = G();
    if (!el || !g) return;
    const ago = fetchedT ? Math.max(0, Math.round((Date.now() - fetchedT) / 60000)) : null;
    const when = ago == null ? '' : ago < 1 ? 'อัปเดตเมื่อสักครู่' : `อัปเดต ${ago} นาทีที่แล้ว`;
    if (cat === 'guild') {
      const gd = NC.Guild && NC.Guild.gid() ? NC.Guild.guild() : null;
      el.innerHTML = gd ? `<span class="rk-gem"><i style="background:${/^#[0-9a-f]{3,8}$/i.test(gd.color) ? gd.color : '#ccc'}"></i><img src="${icon('gem_' + (gd.emblem | 0))}" alt=""></span><b>กิลด์ของคุณ «${esc(clean(gd.name, 16))}» · ${myRank ? '#' + myRank : 'ยังไม่ติดอันดับ'} · Lv ${NC.Guild.totals().lv}</b><span>${when}</span>`
        : `<b>คุณยังไม่มีกิลด์ (กด O)</b><span>${when}</span>`;
      return;
    }
    const d = row();
    el.innerHTML = `<canvas data-face="${esc(uid || 'me')}"></canvas>${lineImg(d.line, 'rk-mejob')}` +
      `<b>คุณ · ${myRank ? '#' + myRank : '—'} · ${esc(c.show(d))} · ${esc(jobName(d.job))}</b><span>${when}</span>`;
  }
  function eqOf(id) {
    if (id === uid || id === 'me') return NC.lookEquip ? NC.lookEquip(G().player.equip) : G().player.equip;
    const r = rows.find((x) => x.id === id), e = { hat: null, hair: 'hair_brown', top: 'top_traveler', pants: 'pants_traveler', shoes: 'shoes_traveler', weapon: 'sword', robe: null, cape: null, glasses: null };
    if (r && Array.isArray(r.data.eq)) SLOTS.forEach((s, i) => { const v = r.data.eq[i]; if (v === null || (typeof v === 'string' && NC.ITEMS[v] && (!NC.ITEMS[v].slot || NC.ITEMS[v].slot === s))) e[s] = v; });
    return e;
  }
  function faces() {
    for (const cv of win.querySelectorAll('canvas[data-face]')) {
      const eq = eqOf(cv.dataset.face), r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
      const W = Math.max(1, Math.round(r.width * dpr)), H = Math.max(1, Math.round(r.height * dpr));
      if (cv.width === W && cv.height === H && cv.dataset.done === JSON.stringify(eq)) continue;
      cv.width = W; cv.height = H; cv.dataset.done = JSON.stringify(eq);
      const c = cv.getContext('2d');
      c.save(); c.beginPath(); c.arc(W / 2, H / 2, Math.min(W, H) * 0.47, 0, TAU); c.clip();
      c.fillStyle = '#e4f2ff'; c.fillRect(0, 0, W, H);
      const hs = NC.headSpot(eq), k = (Math.min(W, H) * 0.78) / hs.w;
      NC.drawAvatar(c, eq, W / 2 - hs.x * k, H * 0.6 - hs.y * k, k, 1, { noWeapon: true });
      c.restore();
    }
  }

  // ---------------- the stage ----------------
  function stageMap() {
    const r = stage.getBoundingClientRect(), W = r.width || 1, H = r.height || 1, bh = BAND[1] - BAND[0];
    const k = Math.max(W / AW, H / bh), ox = (W - AW * k) / 2, oy = -BAND[0] * k + (H - bh * k) / 2;
    return { k, x: (ax) => ox + ax * k, y: (ay) => oy + ay * k, W, H };
  }
  function medal(c, x, y, r, n) {
    const [f, d] = MEDAL[n];
    c.save();
    // two laurel sprigs
    c.strokeStyle = d; c.fillStyle = f; c.lineWidth = r * 0.12;
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
      const a = Math.PI / 2 + s * (0.55 + i * 0.36), lx = x + Math.cos(a) * r * 1.28, ly = y + Math.sin(a) * r * 1.05;
      c.save(); c.translate(lx, ly); c.rotate(a + s * 0.9); c.beginPath(); c.ellipse(0, 0, r * 0.3, r * 0.13, 0, 0, TAU); c.fill(); c.lineWidth = r * 0.08; c.strokeStyle = '#2a2435'; c.stroke(); c.restore();
    }
    c.beginPath(); c.arc(x, y, r, 0, TAU);
    const g = c.createLinearGradient(x, y - r, x, y + r); g.addColorStop(0, f); g.addColorStop(1, d);
    c.fillStyle = g; c.fill(); c.lineWidth = r * 0.16; c.strokeStyle = '#2a2435'; c.stroke();
    c.font = `800 ${Math.round(r * 1.3)}px 'Baloo 2', 'Mitr', sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineWidth = r * 0.22; c.strokeStyle = '#2a2435'; c.lineJoin = 'round'; c.strokeText(String(n), x, y + r * 0.08);
    c.fillStyle = '#fff'; c.fillText(String(n), x, y + r * 0.08);
    c.restore();
  }
  function drawStage(t) {
    const r = stage.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    const W = Math.max(1, Math.round(r.width * dpr)), H = Math.max(1, Math.round(r.height * dpr));
    if (stage.width !== W || stage.height !== H) { stage.width = W; stage.height = H; }
    const c = stage.getContext('2d'), bh = BAND[1] - BAND[0], k = Math.max(W / AW, H / bh), ox = (W - AW * k) / 2, oy = -BAND[0] * k + (H - bh * k) / 2;
    const X = (ax) => ox + ax * k, Y = (ay) => oy + ay * k;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, W, H);
    if (art.complete && art.naturalWidth) c.drawImage(art, ox, oy, AW * k, AH * k);
    const list = visible();
    for (const n of [2, 3, 1]) {
      const [px, py, my] = POD[n], d = list[n - 1] && list[n - 1].data;
      medal(c, X(px), Y(my), 25 * k, n);
      if (!d) continue;
      const x = X(px), y = Y(py);
      if (cat === 'guild') {
        const s = NC.SPR['gem_' + (d.emblem | 0)], R = (n === 1 ? 62 : 52) * k, cy = y - R - 14 * k + Math.sin(t * 2 + n) * 3 * k;
        c.save(); c.fillStyle = /^#[0-9a-f]{6}$/i.test(d.color) ? d.color : '#ccc'; c.beginPath(); c.arc(x, cy, R * 0.86, 0, TAU); c.fill();
        if (s) c.drawImage(s.img, x - R, cy - R, R * 2, R * 2);
        c.restore();
        continue;
      }
      const eq = eqOf(list[n - 1].id), ac = NC.animCtx ? NC.animCtx(eq) : undefined, Pz = NC.Anim.sample('idle', t + n * 0.9, ac);
      Pz.face = n === 3 ? -1 : 1;
      c.fillStyle = 'rgba(20,14,30,0.28)'; c.beginPath(); c.ellipse(x, y, 60 * k, 13 * k, 0, 0, TAU); c.fill();
      if (!(NC.HeroSpine && NC.HeroSpine.preview && NC.HeroSpine.preview(c, eq, x, y, (n === 1 ? 1.85 : 1.7) * k, { t: t + n * 0.9, face: Pz.face, key: 'ranks' + n }))) // (the hero rig's idle, js/herospine.js)
        NC.drawHero(c, eq, Pz, x, y, { scale: (n === 1 ? 1.85 : 1.7) * k });
    }
  }
  function loop() {
    raf = 0;
    if (!win || win.hidden) return;
    drawStage(performance.now() / 1000);
    raf = requestAnimationFrame(loop);
  }

  // ---------------- the menu button (N), the key ----------------
  const baseInit = NC.HUD.init.bind(NC.HUD);
  NC.HUD.init = function (game) {
    baseInit(game);
    build();
    const bar = document.querySelector('.menubar'), gear = bar && bar.querySelector('[data-panel="pause"]');
    if (bar) {
      const b = document.createElement('button');
      b.className = 'mbtn'; b.title = 'ตารางอันดับ (N)';
      b.innerHTML = `<img src="${icon('ic_crown')}" alt=""><b>N</b>`;
      b.addEventListener('click', () => { game.paused = NC.HUD.panel('ranks'); });
      bar.insertBefore(b, gear || null);
    }
    const keys = document.querySelector('#pause .keys');
    if (keys && !keys.querySelector('[data-k="N"]')) { const li = document.createElement('li'); li.dataset.k = 'N'; li.innerHTML = '<kbd>N</kbd> ตารางอันดับ'; keys.appendChild(li); }
  };
  const basePanel = NC.HUD.panel.bind(NC.HUD);
  NC.HUD.panel = function (id, show) {
    if (win && id === 'ranks') {
      const on = show === undefined ? win.hidden : show;
      basePanel('pause', false); // closes every other window
      win.hidden = !on;
      if (on) open();
      return on;
    }
    if (win) win.hidden = true;
    return basePanel(id, show);
  };
  addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && win && !win.hidden) { e.stopImmediatePropagation(); e.preventDefault(); close(); return; }
    if (e.code !== 'KeyN' || e.repeat || !NC.game || !NC.game.player) return;
    const t = document.activeElement;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    NC.game.paused = NC.HUD.panel('ranks');
  }, true);

  NC.Ranks = { open: (c) => { if (NC.game) NC.game.paused = NC.HUD.panel('ranks', true); if (c) { cat = c; load(); } }, push: () => push(true), row, state: st,
    drawWindow: (t) => { if (win && !win.hidden) drawStage(t); }, reload: () => { for (const k in cache) delete cache[k]; load(); } };
})();
