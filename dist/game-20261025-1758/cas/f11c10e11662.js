/* darkroot_ui.js — the windows of รากต้นไม้มืด (js/darkroot.js), the mockups the user took (2026-10-12, "ทำเลย" on the
   picks offered: lobby A, ranking B; assets/gen/nightcamp_tower_lobby_a_raw.png / nightcamp_tower_board_b_raw.png):
     the lobby (T at the root gate in the camp)   left: the painted cross-section of the roots (assets/root/ui_map.jpg)
       with the ten zones, a winding path of 100 floor dots (gold = cleared this season, glowing = next, dim = deeper),
       a boss portrait on every 10th floor and its campfire (lit = a checkpoint); right: SOLO / PARTY (2–4), the floor's
       card (its goal, the wind of the week, the first-clear rewards, my best time, the start buttons), the party's four
       slots with READY ticks (or the solo rules); at the bottom the season line, the Root Seed exchange and RANKING
     the ranking                                  SOLO / PARTY tabs, this week / this season / all time, the job filter;
       left the root's depth gauge (assets/root/ui_depth.png) with where the top 3 and I stopped; right the podium hall
       (assets/root/ui_stage.jpg: the top 3 in their outfits, a party's members side by side), the list from #4 and my
       place pinned at the bottom
   Sizes in --u like every K window (css/darkroot.css). NC.Root.openLobby() / openBoard(mode). Test: ?rootlobby,
   ?rootboard. */
(function () {
  'use strict';
  const NC = window.NC, R = NC.Root, S = NC.Store;
  if (!R) return;
  const $ = (id) => document.getElementById(id);
  const G = () => NC.game;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const clean = (s, n) => (NC.Net && NC.Net.clean ? NC.Net.clean(s, n) : String(s == null ? '' : s).trim().slice(0, n));
  const fmt = (n) => (NC.fmtCoins ? NC.fmtCoins(Math.round(n)) : Math.round(n).toLocaleString());
  const icon = (k) => ((NC.ASSET_MANIFEST || {})[k] || {}).src || (NC.SPR[k] && NC.SPR[k].img && NC.SPR[k].img.src) || (/^ic_/.test(k) ? `assets/bible/${k}.png` : ''); // (the journal's icons: assets/bible)
  const TAU = Math.PI * 2;
  const SLOTS = ['hat', 'hair', 'top', 'pants', 'shoes', 'weapon', 'robe', 'cape', 'glasses'];
  const st = R.state;
  const jobName = (j) => (NC.JOBS[j] || {}).name || '';
  const LINE_WEAPON = { knight: 'sword', mage: 'staff', archer: 'bow', rogue: 'dagger', priest: 'staff_holy', acolyte: 'staff_holy', merchant: 'axe', ninja: 'dagger' };
  const lineSrc = (l) => { const w = LINE_WEAPON[l], x = w && NC.ITEMS[w] && NC.itemIcon ? NC.itemIcon(w, 64) : ''; return x && x.toDataURL ? x.toDataURL() : x || ''; };
  const lines = () => Object.keys(NC.JOBS).filter((j) => NC.JOBS[j].tier === 1);

  // the pictures of the windows
  const img = (src) => { const i = new Image(); i.src = src; return i; };
  const MAP = img('assets/root/ui_map.jpg'), STAGE = img('assets/root/ui_stage.jpg'), DEPTH = img('assets/root/ui_depth2.jpg');
  // the map painting's ten layers (rows of the 1024 px picture, measured on its dark lines)
  const BANDS = [0, 95, 190, 290, 372, 470, 568, 668, 760, 868, 1024].map((y) => y / 1024); // (the repainted map, root_map3: its ten layers)

  // a hero's face in a round canvas (as the leaderboard's)
  function face(cv, eq) {
    const r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    const W = Math.max(1, Math.round(r.width * dpr)), H = Math.max(1, Math.round(r.height * dpr)), sig = JSON.stringify(eq) + W;
    if (cv.dataset.done === sig) return;
    cv.width = W; cv.height = H; cv.dataset.done = sig;
    const c = cv.getContext('2d');
    c.save(); c.beginPath(); c.arc(W / 2, H / 2, Math.min(W, H) * 0.47, 0, TAU); c.clip();
    c.fillStyle = cv.dataset.bg || '#e4f2ff'; c.fillRect(0, 0, W, H);
    try { const hs = NC.headSpot(eq), k = (Math.min(W, H) * 0.78) / hs.w; NC.drawAvatar(c, eq, W / 2 - hs.x * k, H * 0.6 - hs.y * k, k, 1, { noWeapon: true }); } catch (e) { /* (a look not loaded yet) */ }
    c.restore();
  }
  const eqFrom = (arr) => {
    const e = { hat: null, hair: 'hair_brown', top: 'top_traveler', pants: 'pants_traveler', shoes: 'shoes_traveler', weapon: 'sword', robe: null, cape: null, glasses: null };
    if (Array.isArray(arr)) SLOTS.forEach((s, i) => { const v = arr[i]; if (v === null || (typeof v === 'string' && NC.ITEMS[v] && (!NC.ITEMS[v].slot || NC.ITEMS[v].slot === s))) e[s] = v; });
    return e;
  };
  const myEq = () => (NC.lookEquip ? NC.lookEquip(G().player.equip) : G().player.equip);
  function fit(win) {
    const wrap = win.querySelector('.rt-wrap');
    wrap.style.transform = 'translate(-50%, -50%)';
    const k = Math.min(1, (innerWidth - 16) / wrap.offsetWidth, (innerHeight - 16) / wrap.offsetHeight);
    if (k < 1) wrap.style.transform = `translate(-50%, -50%) scale(${k.toFixed(4)})`;
  }

  // ======================================================================================================
  // ---------------- the lobby (A) ----------------
  // measured on the mockup (assets/gen/nightcamp_tower_lobby_a_raw.png, its window 1167 px wide = 1170 u): the map 671 x
  // 722 on the left, the column 469 wide on the right (folder tabs 50, the floor card 367, the party 265), the season bar
  // 55 at the bottom
  let lw = null, sel = 1, mode = 'solo', raf = 0, shop = false, hoverF = 0;
  function buildLobby() {
    lw = document.createElement('div');
    lw.id = 'rootlobby'; lw.className = 'kw-panel'; lw.hidden = true;
    lw.innerHTML = '<div class="rt-wrap"><section class="kw-win rt-lobby">' +
      '<header class="kw-title"><span>รากต้นไม้มืด · 100 ชั้น</span><button class="kw-x" data-x="1" aria-label="ปิด">✕</button></header>' +
      '<div class="rt-body"><div class="rt-map"><canvas id="rt-map"></canvas><div class="rt-zones" id="rt-zones"></div></div>' +
      '<div class="rt-side"><nav class="rt-mode"><button data-mode="solo">เดี่ยว</button><button data-mode="party">ปาร์ตี้ (2–4)</button></nav>' +
      '<div class="rt-card" id="rt-card"></div><div class="rt-team" id="rt-team"></div></div></div>' +
      '<footer class="rt-foot" id="rt-foot"></footer><div class="rt-shop" id="rt-shop" hidden></div></section></div>';
    document.body.appendChild(lw);
    lw.addEventListener('click', lobbyClick);
    const cv = $('rt-map');
    cv.addEventListener('mousemove', (e) => { const f = hitFloor(e); if (f !== hoverF) { hoverF = f; cv.style.cursor = f ? 'pointer' : ''; } });
    cv.addEventListener('click', (e) => { const f = hitFloor(e); if (f) { sel = f; renderLobby(); } });
    $('rt-zones').innerHTML = R.ZONES.map((Z, i) => `<div class="rt-zone" style="top:${(((BANDS[i] + BANDS[i + 1]) / 2) * 100).toFixed(2)}%"><b>${esc(Z.name)}</b><small>${Z.first}–${Z.last} (Lv ${R.LV(Z.first)}–${R.LV(Z.last)})</small></div>`).join('');
  }
  function openLobby() {
    const g = G();
    if (!g) return;
    R.roll();
    sel = Math.min(R.FLOORS, Math.max(1, st.s.best + 1));
    const pn = NC.PartyNet;
    mode = pn && pn.pid && pn.pid() ? 'party' : 'solo';
    shop = false;
    g.paused = NC.HUD.panel('rootlobby', true);
  }
  function closeLobby() { NC.HUD.panel('rootlobby', false); const g = G(); if (g) g.paused = false; }

  // the floor dots on the painting: [x, y] as fractions (as the mockup: the dots in the middle of each band rising toward
  // the boss portrait at 0.763, its campfire at 0.855; the zone's plate at 0.275)
  const BOSS_X = 0.763, FIRE_X = 0.855;
  function nodeAt(f) {
    const i = Math.floor((f - 1) / 10), k = (f - 1) % 10, y0 = BANDS[i], y1 = BANDS[i + 1], cy = (y0 + y1) / 2, bh = y1 - y0;
    if (k === 9) return [BOSS_X, cy];
    return [0.445 + k * 0.0315, cy + (0.2 - k * 0.035) * bh * (i % 2 ? -1 : 1) * 0.7 + Math.sin(k * 0.9 + i) * 0.1 * bh];
  }
  function hitFloor(e) {
    const cv = $('rt-map'), r = cv.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    let best = 0, bd = 0.03;
    for (let f = 1; f <= R.FLOORS; f++) { const [nx, ny] = nodeAt(f), d = Math.hypot(nx - x, (ny - y) * (r.height / r.width)); if (d < bd) { bd = d; best = f; } }
    return best;
  }
  function bossPortrait(c, type, x, y, rad, on) {
    c.save();
    c.beginPath(); c.arc(x, y, rad, 0, TAU);
    c.fillStyle = '#231a38'; c.fill();
    c.save(); c.clip();
    const s = NC.SPR[type], human = NC.STORY_BOSSES && NC.STORY_BOSSES[type];
    if (!(s && s.img) && human && human.equip) { // (a story boss is a rigged human: their face)
      try { const eq = Object.assign({ glasses: null }, human.equip), hs = NC.headSpot(eq), k = (rad * 1.7) / hs.w; NC.drawAvatar(c, eq, x - hs.x * k, y + rad * 0.25 - hs.y * k, k, 1, { noWeapon: true }); } catch (e) { /* (not loaded) */ }
    } else if (s && s.img) {
      const k = (rad * 2.25) / Math.max(s.img.width, s.img.height * 0.8), w = s.img.width * k, h = s.img.height * k;
      c.drawImage(s.img, x - w / 2, y - h * 0.42, w, h);
    } else {
      c.fillStyle = '#e8d6ff'; c.font = `800 ${Math.round(rad * 1.1)}px 'Baloo 2', sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('?', x, y + rad * 0.06);
    }
    if (!on) { c.fillStyle = 'rgba(20,14,34,0.35)'; c.fillRect(x - rad, y - rad, rad * 2, rad * 2); }
    c.restore();
    c.beginPath(); c.arc(x, y, rad, 0, TAU);
    c.lineWidth = rad * 0.2; c.strokeStyle = '#2a2435'; c.stroke();
    c.lineWidth = rad * 0.11; c.strokeStyle = on ? '#f0bf45' : '#c9a24a'; c.beginPath(); c.arc(x, y, rad * 0.9, 0, TAU); c.stroke();
    c.restore();
  }
  const LOCK = img('assets/root/ri_lock.png');
  function drawMap(t) {
    const cv = $('rt-map');
    if (!cv) return;
    const r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1, W = Math.max(1, Math.round(r.width * dpr)), H = Math.max(1, Math.round(r.height * dpr));
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    const c = cv.getContext('2d'), X = (x) => x * W, Y = (y) => y * H, u = W / 671;
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, W, H);
    // the painting covers the panel (its layers fill the height; the sides are cut a little)
    if (MAP.complete && MAP.naturalWidth) { const s = H / MAP.naturalHeight, w = MAP.naturalWidth * s; c.drawImage(MAP, (W - w) / 2, 0, w, H); }
    else { c.fillStyle = '#1b1530'; c.fillRect(0, 0, W, H); }
    const best = st.s.best, next = Math.min(R.FLOORS, best + 1), reach = Math.floor((next - 1) / 10); // (the zone the next floor is in)
    c.lineCap = 'round'; c.lineJoin = 'round';
    // the path: each zone's dots to its boss, then down to the next zone's first dot; cleared gold, the rest violet
    const seg = (f) => { const [ax, ay] = nodeAt(f), [bx, by] = nodeAt(f + 1); return [X(ax), Y(ay), X(bx), Y(by)]; };
    for (let f = 1; f < R.FLOORS; f++) {
      const [ax, ay, bx, by] = seg(f), down = f % 10 === 0;
      c.beginPath(); c.moveTo(ax, ay);
      if (down) c.bezierCurveTo(ax - 40 * u, ay + 30 * u, bx + 60 * u, by - 30 * u, bx, by); else c.lineTo(bx, by);
      const gold = f < best + 1 && f + 1 <= best + 1;
      c.lineWidth = 7 * u; c.strokeStyle = 'rgba(20,14,30,0.55)'; c.stroke();
      c.lineWidth = (gold ? 4.5 : 3.2) * u; c.strokeStyle = gold ? '#ffd35c' : 'rgba(186,160,236,0.75)'; c.stroke();
    }
    // the dots, the bosses, their campfires, the locks
    for (let f = 1; f <= R.FLOORS; f++) {
      const [x0, y0] = nodeAt(f), x = X(x0), y = Y(y0), done = f <= best, isNext = f === next && best < R.FLOORS, boss = f % 10 === 0, zi = Math.floor((f - 1) / 10);
      if (boss) {
        bossPortrait(c, R.zoneOf(f).boss, x, y, 27 * u, done || zi <= reach);
        const fire = NC.SPR.rt_fire_on;
        if (fire && fire.img) { const h = 38 * u, w = (fire.img.width / fire.img.height) * h; c.globalAlpha = done ? 1 : 0.8; c.drawImage(fire.img, X(FIRE_X) - w / 2, y + 16 * u - h, w, h); c.globalAlpha = 1; }
        continue;
      }
      if (zi > reach && f % 10 === 8 && LOCK.complete && LOCK.naturalWidth) { // (a lock on every zone not reached yet)
        const s = 26 * u; c.drawImage(LOCK, x - s / 2, y - s / 2, s, s * (LOCK.naturalHeight / LOCK.naturalWidth)); continue;
      }
      const rad = (isNext ? 9.5 : 7) * u;
      if (isNext) { c.beginPath(); c.arc(x, y, rad * (1.8 + 0.25 * Math.sin(t * 4)), 0, TAU); c.fillStyle = 'rgba(120,220,255,0.35)'; c.fill(); }
      c.beginPath(); c.arc(x, y, rad, 0, TAU);
      c.fillStyle = done ? '#ffd35c' : isNext ? '#ffffff' : '#c6b2f0'; c.fill();
      c.lineWidth = (isNext ? 3.5 : 2.6) * u; c.strokeStyle = isNext ? '#3b8fdc' : '#2a2435'; c.stroke();
      if (isNext) { c.beginPath(); c.arc(x, y, rad * 0.45, 0, TAU); c.fillStyle = '#7fd0ff'; c.fill(); }
    }
    // the floor picked (its number under it) and the deepest one (a gold tag over it)
    const [sx, sy] = nodeAt(sel);
    if (sel % 10 !== 0) {
      c.beginPath(); c.arc(X(sx), Y(sy), 13 * u, 0, TAU); c.lineWidth = 3 * u; c.strokeStyle = '#7fe0ff'; c.stroke();
    } else { c.beginPath(); c.arc(X(sx), Y(sy), 33 * u, 0, TAU); c.lineWidth = 3.5 * u; c.strokeStyle = '#7fe0ff'; c.stroke(); }
    numberUnder(c, String(sel), X(sx), Y(sy) + (sel % 10 ? 25 : 46) * u, u);
    if (best > 0) { const [bx, by] = nodeAt(best); tag(c, `ลึกสุด: ชั้น ${best}`, X(bx) - 4 * u, Y(by) - 28 * u, u, '#2a2435', '#ffd35c'); }
    // the party's members' floors (in a run): their names by their dots
    const run = R.run();
    if (run && run.mode === 'party') for (const o of R.others()) { const [ox, oy] = nodeAt(o.rt[1] || 1); tag(c, o.r.name, X(ox), Y(oy) - 22 * u, u, '#fff', '#8b5bd6'); }
  }
  function numberUnder(c, text, x, y, u) {
    c.save(); c.font = `800 ${Math.round(19 * u)}px 'Baloo 2', 'Mitr', sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
    c.lineWidth = 5 * u; c.strokeStyle = '#2a2435'; c.strokeText(text, x, y); c.fillStyle = '#fff'; c.fillText(text, x, y); c.restore();
  }
  function tag(c, text, x, y, u, fg, bg) {
    c.save();
    c.font = `700 ${Math.round(13.5 * u)}px 'Mitr', sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    const w = c.measureText(text).width + 18 * u, h = 23 * u;
    c.beginPath(); NC.rrect ? NC.rrect(c, x - w / 2, y - h / 2, w, h, 6 * u) : c.rect(x - w / 2, y - h / 2, w, h);
    c.fillStyle = bg; c.fill(); c.lineWidth = 2.6 * u; c.strokeStyle = '#2a2435'; c.stroke();
    // (a little pointer under it)
    c.beginPath(); c.moveTo(x - 6 * u, y + h / 2 - 1); c.lineTo(x, y + h / 2 + 7 * u); c.lineTo(x + 6 * u, y + h / 2 - 1); c.closePath(); c.fill(); c.stroke();
    c.fillRect(x - 5 * u, y + h / 2 - 3 * u, 10 * u, 3 * u);
    c.fillStyle = fg; c.fillText(text, x, y + 0.5 * u);
    c.restore();
  }

  // the right column
  function pn() { return NC.PartyNet && NC.PartyNet.pid && NC.PartyNet.pid() ? NC.PartyNet : null; }
  function teamList() { // [{ me, name, lv, eq, ready, lead, peer }]
    const P = pn(), g = G(), out = [];
    if (!P) return out;
    const roster = P.roster(), lead = roster && roster.lead, me = NC.Net.me();
    for (const peer of P.members()) {
      if (peer === me) out.push({ me: true, name: g.player.name || 'คุณ', lv: g.player.lv, eq: myEq(), ready: R.lobby.ready || !!R.run(), lead: peer === lead, peer });
      else { const r = NC.Net.remotes.get(peer); if (r) out.push({ name: r.name, lv: r.lv, eq: r.equip, ready: !!(r.rt && (r.rt[7] === 1 || r.rt[0])), lead: peer === lead, peer, inRun: !!(r.rt && r.rt[0]) }); }
    }
    return out;
  }
  // a bust portrait: head and shoulders in a rounded square
  function bust(cv, eq) {
    const r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    const W = Math.max(1, Math.round(r.width * dpr)), H = Math.max(1, Math.round(r.height * dpr)), sig = JSON.stringify(eq) + W;
    if (cv.dataset.done === sig) return;
    cv.width = W; cv.height = H; cv.dataset.done = sig;
    const c = cv.getContext('2d');
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#fbf3e3'); g.addColorStop(1, '#e9d9bd');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    try { const hs = NC.headSpot(eq), k = (W * 0.6) / hs.w; NC.drawAvatar(c, eq, W / 2 - hs.x * k, H * 0.52 - hs.y * k, k, 1, { noWeapon: true }); } catch (e) { /* (not loaded) */ }
  }
  const GOAL_ART = { fires: 'rt_fire_on', keys: 'rt_seed', hunt: 'ri_hunt', elite: 'ri_elite', waves: 'ri_waves', dark: 'ri_dark' }; // (the goal's picture in its box)
  function goalPic(I) {
    if (I.kind === 'boss') return `<canvas class="rt-gboss" data-boss="${esc(I.boss)}"></canvas>`;
    const k = GOAL_ART[I.kind], s = k && NC.ASSET_MANIFEST[k] ? NC.ASSET_MANIFEST[k].src : icon(I.goal.icon);
    return `<img src="${s}" alt="">`;
  }
  function renderLobby() {
    if (!lw || lw.hidden) return;
    const g = G(), p = g.player, T = mode === 'party' ? teamList() : null, I = R.floorInfo(sel, mode === 'party' ? Math.max(1, T.length) : 1), wd = R.wind();
    for (const b of lw.querySelectorAll('[data-mode]')) b.classList.toggle('on', b.dataset.mode === mode);
    const cp = R.cpFor(sel), bestT = st.s.t[sel], doneS = !!st.first.s[sel], doneW = !!st.first.w[sel], seedOk = R.seedOk(g, sel);
    const P = pn(), lead = P && P.isLeader(), run = R.run(), leaderRun = R.lobby.leaderRun;
    let btns;
    if (run) btns = `<button class="kw-btn grey rt-b2" disabled>กำลังอยู่ในราก<br>ชั้น ${run.floor | 0}</button><button class="kw-btn gold rt-enter" disabled>เข้า</button>`;
    else if (mode === 'party' && !P) btns = '<button class="kw-btn grey rt-b2" data-act="partywin">ยังไม่มีปาร์ตี้<br>หาปาร์ตี้ (P)</button><button class="kw-btn gold rt-enter" disabled>เข้า</button>';
    else if (mode === 'party' && !lead) {
      btns = `<button class="kw-btn grey rt-b2" data-act="ready">${R.lobby.ready ? 'ยกเลิก<br>พร้อม' : 'กด<br>พร้อม'}</button>` +
        `<button class="kw-btn gold rt-enter" data-act="follow" ${leaderRun && leaderRun.id ? '' : 'disabled'}>${leaderRun && leaderRun.id ? 'ตามหัวตี้' : 'รอหัวตี้'}</button>`;
    } else {
      btns = `<button class="kw-btn grey rt-b2" data-act="start" data-f="${cp | 0}" ${cp > 1 ? '' : 'disabled'}>เริ่มที่<br>กองไฟ ชั้น ${cp > 1 ? cp | 0 : '—'}</button>` +
        '<button class="kw-btn gold rt-enter" data-act="start" data-f="1">เข้า</button>';
    }
    const boss = I.boss ? (NC.MONSTERS[I.boss] || NC.DUNGEON_BOSSES[I.boss] || {}).name : '';
    $('rt-card').innerHTML = `<div class="rt-ch"><b>ชั้น ${sel}</b><span> - ${esc(I.zone.name)} - ${I.lvText}</span></div>` +
      `<div class="rt-goalrow"><span class="rt-gpic">${goalPic(I)}</span><div>${I.boss ? `<b>เงาราก${esc(boss || '')}</b>` : ''}${esc(I.text)}</div></div>` +
      `<div class="rt-windtag"><img src="${icon('ri_moon')}" alt=""><span>ลมสัปดาห์นี้: ${esc(wd.name)} -<br>${esc(wd.text)}</span></div>` +
      `<div class="rt-rw"><span class="lab">ผ่านครั้งแรก:</span><img src="${icon('ic_coin')}" alt=""><b>${fmt(I.coins)} เหรียญ${doneS ? ' ✔' : ''},</b>` +
        `<img src="${icon('rt_seed')}" alt=""><b>${seedOk ? `เมล็ดราก x${I.seeds}${doneW ? ' ✔' : ''}` : 'ไม่ได้เมล็ด'}</b>${I.stone ? `<img src="${NC.matIcon ? NC.matIcon('mat_opt_stone') : ''}" alt="" title="หินออฟ">` : ''}</div>` +
      `<div class="rt-best">เวลาดีที่สุดของชั้นนี้: <b>${bestT != null ? R.clock(bestT) : '—'}</b></div>` +
      `<div class="rt-btns">${btns}</div>`;
    // the party / the solo rules
    if (mode === 'party') {
      let h = '<div class="rt-th">ปาร์ตี้</div><div class="rt-slots">';
      for (let i = 0; i < 4; i++) {
        const m = T[i];
        h += m ? `<div class="rt-slot${m.me ? ' me' : ''}"><span class="rt-pic"><canvas data-bust="${i}"></canvas>${m.ready ? '<i class="rt-ok"><em>✓</em>พร้อม</i>' : ''}</span><b>${esc(clean(m.name, 12))}</b><small>Lv ${m.lv}${m.inRun ? ' · ในราก' : ''}</small></div>`
          : '<button class="rt-slot empty" data-act="partywin"><span class="rt-pic"><i>+</i></span><b>+ ชวน</b><small>&nbsp;</small></button>';
      }
      h += '</div><div class="rt-hint"><i>!</i>มอนแกร่งขึ้นตามจำนวนสมาชิก</div>';
      $('rt-team').innerHTML = h;
      lw._team = T;
    } else {
      $('rt-team').innerHTML = `<div class="rt-th">เล่นเดี่ยว</div><div class="rt-solo"><div class="rt-slot me"><span class="rt-pic"><canvas data-bust="me"></canvas></span><b>${esc(clean(p.name || 'คุณ', 12))}</b><small>Lv ${p.lv}</small></div><ul>` +
        '<li>ตายแล้วจบรอบ เริ่มใหม่ที่กองไฟหลังบอสได้</li><li>เวลาของแต่ละชั้นขึ้นตารางอันดับเดี่ยว</li>' +
        `<li>ออโต้ฟาร์มใช้ในรากไม่ได้</li><li>มอนต่ำกว่าเราเกิน ${R.SEED_GAP} เลเวล ไม่ได้เมล็ดราก</li></ul></div>` +
        '<div class="rt-hint"><i>!</i>ชวนเพื่อนได้ที่แท็บปาร์ตี้ (2–4 คน)</div>';
      lw._team = null;
    }
    // the season bar
    const seeds = NC.matCount ? NC.matCount(p, 'mat_rootseed') : 0;
    const T0 = R.sumTime(st.s, st.s.best, st.a);
    $('rt-foot').innerHTML = `<img src="${icon('ic_rank')}" alt=""><b>ฤดูกาล ${R.seasonNo()}</b><span> - ${st.s.best ? `ลึกสุด: ชั้น ${st.s.best} - ${hms(T0)}` : 'ยังไม่ผ่านชั้นไหน'}${myRank ? ` - อันดับ #${myRank}` : ''}</span>` +
      `${R.footExtra ? R.footExtra(p) : ''}<button class="rt-seedbtn" data-act="shop" title="แลกเมล็ดราก"><img src="${icon('rt_seed')}" alt=""><b>${seeds}</b></button><button class="kw-btn blue rt-rankbtn" data-act="board"><i class="rt-bars"><s></s><s></s><s></s></i>อันดับ</button>`;
    renderShop();
    if (R.lobbyAfter) R.lobbyAfter(lw, sel); // (js/rootloot.js: its exchange window)
    fit(lw);
    for (const cv of lw.querySelectorAll('canvas[data-bust]')) {
      const k = cv.dataset.bust;
      bust(cv, k === 'me' ? myEq() : (lw._team && lw._team[+k] ? lw._team[+k].eq : myEq()));
    }
    const gb = lw.querySelector('canvas[data-boss]');
    if (gb) { const r = gb.getBoundingClientRect(), dpr = window.devicePixelRatio || 1; gb.width = Math.round(r.width * dpr); gb.height = Math.round(r.height * dpr); bossPortrait(gb.getContext('2d'), gb.dataset.boss, gb.width / 2, gb.height / 2, gb.height * 0.44, true); }
  }
  let myRank = null, rankT = 0;
  async function loadMyRank() {
    if (!S || Date.now() - rankT < 20000) return;
    rankT = Date.now();
    const mine = R.score(st.s.best, R.sumTime(st.s, st.s.best, st.a));
    if (!mine) { myRank = null; return; }
    try { myRank = (await S.query('root', { where: [['sScore', '>', mine]] })).filter((r) => r.data.season === R.seasonNo() && r.id !== R.uid()).length + 1; } catch (e) { myRank = null; }
    renderLobby();
  }

  // the Root Seed exchange
  const SHOP = [
    { id: 'mat_polish', n: 2, cost: 6 }, { id: 'mat_grade_seal', n: 1, cost: 25 }, { id: 'mat_safety', n: 1, cost: 25 }, // (js/gradetier.js)
    { id: 'mat_opt_stone', n: 1, cost: 8 }, { id: 'lf_moonsilver', n: 2, cost: 6 }, { id: 'lf_starore', n: 1, cost: 6 },
    { id: 'bl_dark_sap', n: 3, cost: 5 }, { id: 'bl_moon_dew', n: 3, cost: 5 }, { id: 'mat_drill_stone', n: 1, cost: 60 },
    { frame: 'bark', name: 'กรอบเปลือกราก', cost: 30 }, { frame: 'sap', name: 'กรอบยางม่วง', cost: 45 }, { frame: 'star', name: 'กรอบดาวในราก', cost: 70 },
  ];
  const FRAMES = { bark: 'กรอบเปลือกราก', sap: 'กรอบยางม่วง', star: 'กรอบดาวในราก', heart: 'กรอบหัวใจราก (ผ่านชั้น 100)', crown: 'กรอบมงกุฎราก (Top 10 ฤดูกาล)' };
  R.FRAMES = FRAMES;
  function renderShop() {
    const el = $('rt-shop');
    el.hidden = !shop;
    if (!shop) return;
    const p = G().player, seeds = NC.matCount ? NC.matCount(p, 'mat_rootseed') : 0, M = NC.MATERIALS || {};
    el.innerHTML = `<div class="rt-shoph"><img src="${icon('rt_seed')}" alt=""><b>แลกเมล็ดราก</b><span>มีอยู่ ${seeds}</span><button class="kw-x" data-act="shopx">✕</button></div><div class="rt-shopl kw-scroll">` +
      SHOP.map((s, i) => {
        if (s.frame) {
          const have = st.frames.includes(s.frame), on = st.frame === s.frame;
          return `<div class="rt-si"><i class="rt-frame f-${s.frame}"></i><b>${esc(s.name)}</b><small>ขอบรูปของคุณในตารางอันดับ</small>` +
            (have ? `<button class="kw-btn ${on ? 'grey' : 'blue'}" data-act="frame" data-i="${i}">${on ? 'ใส่อยู่' : 'ใส่'}</button>` : `<button class="kw-btn gold" data-act="buy" data-i="${i}" ${seeds >= s.cost ? '' : 'disabled'}>${s.cost} เมล็ด</button>`) + '</div>';
        }
        const m = M[s.id] || {};
        return `<div class="rt-si"><img src="${NC.matIcon ? NC.matIcon(s.id) : ''}" alt=""><b>${esc(m.name || s.id)} ×${s.n}</b><small>${esc((m.desc || '').slice(0, 46))}</small>` +
          `<button class="kw-btn gold" data-act="buy" data-i="${i}" ${seeds >= s.cost ? '' : 'disabled'}>${s.cost} เมล็ด</button></div>`;
      }).join('') + st.frames.filter((f) => !SHOP.some((s) => s.frame === f)).map((f) => `<div class="rt-si"><i class="rt-frame f-${f}"></i><b>${esc(FRAMES[f] || f)}</b><small>ได้จากรากต้นไม้มืด</small><button class="kw-btn ${st.frame === f ? 'grey' : 'blue'}" data-act="framex" data-f="${f}">${st.frame === f ? 'ใส่อยู่' : 'ใส่'}</button></div>`).join('') + '</div>';
  }
  function buy(i) {
    const s = SHOP[i], g = G(), p = g.player, seeds = NC.matCount ? NC.matCount(p, 'mat_rootseed') : 0;
    if (!s || seeds < s.cost) return;
    if (s.frame && st.frames.includes(s.frame)) return;
    p.mats.mat_rootseed = seeds - s.cost;
    if (s.frame) { st.frames.push(s.frame); st.frame = s.frame; R.save(); R.push(); NC.HUD.log(`ได้${s.name}`, 'item'); }
    else { NC.addMat(g, s.id, s.n); NC.HUD.log(`แลก ${(NC.MATERIALS[s.id] || {}).name || s.id} ×${s.n} (${s.cost} เมล็ดราก)`, 'item'); }
    if (NC.saveTrade) NC.saveTrade(g);
  }
  function lobbyClick(e) {
    const g = G();
    if (e.target.closest('[data-x]')) { closeLobby(); return; }
    const m = e.target.closest('[data-mode]');
    if (m) { mode = m.dataset.mode; renderLobby(); return; }
    const a = e.target.closest('[data-act]');
    if (!a || a.disabled) return;
    const act = a.dataset.act;
    if (R.lobbyAct && R.lobbyAct(act, a, g)) { if (act !== 'shop') shop = false; renderLobby(); return; } // (js/rootloot.js)
    if (act === 'start') { R.startRun(g, Number(a.dataset.f), mode); return; }
    if (act === 'ready') { R.lobby.ready = !R.lobby.ready; R.lobby.floor = sel; renderLobby(); return; }
    if (act === 'follow') { R.followLeader(g); return; }
    if (act === 'partywin') { closeLobby(); setTimeout(() => { if (NC.game) NC.game.paused = NC.HUD.panel('party', true); }, 0); return; }
    if (act === 'board') { closeLobby(); setTimeout(() => openBoard(mode), 0); return; }
    if (act === 'shop') { shop = !shop; renderLobby(); return; }
    if (act === 'shopx') { shop = false; renderLobby(); return; }
    if (act === 'buy') { buy(Number(a.dataset.i)); renderLobby(); return; }
    if (act === 'frame') { const s = SHOP[Number(a.dataset.i)]; st.frame = st.frame === s.frame ? null : s.frame; R.save(); R.push(); renderLobby(); return; }
    if (act === 'framex') { st.frame = st.frame === a.dataset.f ? null : a.dataset.f; R.save(); R.push(); renderLobby(); }
  }

  // ======================================================================================================
  // ---------------- the ranking (B) ----------------
  // measured on the mockup (assets/gen/nightcamp_tower_board_b_raw.png, its window 1073 px = 1075 u): the tabs row 43 tall,
  // the depth column 212 wide down the whole body, the main column 820 wide: the podium hall 265, the list 333 (a header
  // row and seven rows of 43), the note, my place 57
  let bw = null, bmode = 'solo', period = 's', job = 'all', rows = [], busy = false, fetched = 0;
  const cache = {};
  const PER = { w: 'สัปดาห์นี้', s: 'ฤดูกาล', a: 'ตลอดกาล' };
  const hms = (t) => { t = Math.max(0, Math.round(t)); const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60, p = (n) => String(n).padStart(2, '0'); return h ? `${h}h ${p(m)}m ${p(s)}s` : `${m}m ${p(s)}s`; };
  const hm = (t) => { t = Math.max(0, Math.round(t)); const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60); return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`; };
  R.hms = hms;
  function buildBoard() {
    bw = document.createElement('div');
    bw.id = 'rootboard'; bw.className = 'kw-panel'; bw.hidden = true;
    bw.innerHTML = '<div class="rt-wrap"><section class="kw-win rt-board">' +
      '<header class="kw-title"><span>อันดับหอคอย · รากต้นไม้มืด</span><button class="kw-x" data-x="1" aria-label="ปิด">✕</button></header>' +
      '<div class="rb-bar"><nav class="rb-tabs"><button data-bm="solo">เดี่ยว</button><button data-bm="party">ปาร์ตี้</button></nav>' +
      '<div class="rb-chips" id="rb-chips"></div><label class="rb-jobw"><select class="rb-job" id="rb-job"></select></label></div>' +
      '<div class="rb-body"><div class="rb-depth"><div class="rb-dh">ความลึกของราก</div><canvas id="rb-depth"></canvas></div>' +
      '<div class="rb-main"><div class="rb-stage"><canvas id="rb-stage"></canvas><div class="rb-plates" id="rb-plates"></div></div>' +
      '<div class="rb-list"><div class="rb-head" id="rb-head"></div><div class="rb-rows kw-scroll" id="rb-list"></div></div>' +
      '<div class="rb-note">เรียงตามชั้นที่ลึกที่สุด ถ้าเท่ากันดูเวลาที่เร็วกว่า · รางวัลฤดูกาล: ฉายาและกรอบราก</div>' +
      '<div class="rb-me" id="rb-me"></div></div></div></section></div>';
    document.body.appendChild(bw);
    bw.addEventListener('click', (e) => {
      if (e.target.closest('[data-x]')) { closeBoard(); return; }
      const m = e.target.closest('[data-bm]'); if (m) { bmode = m.dataset.bm; load(); return; }
      const c = e.target.closest('[data-per]'); if (c) { period = c.dataset.per; load(); }
    });
    $('rb-job').addEventListener('change', (e) => { job = e.target.value; renderBoard(); });
  }
  function openBoard(m) {
    const g = G();
    if (!g) return;
    if (m) bmode = m;
    g.paused = NC.HUD.panel('rootboard', true);
  }
  function closeBoard() { NC.HUD.panel('rootboard', false); const g = G(); if (g) g.paused = false; }
  const coll = () => (bmode === 'party' ? 'rootp' : 'root');
  const inPeriod = (d) => (period === 'a' ? true : period === 's' ? d.season === R.seasonNo() : d.week === R.weekNo() && d.season === R.seasonNo());
  const myPartyKey = () => {
    const P = pn();
    if (!P || !NC.Net) return null;
    const ids = [R.uid()];
    for (const peer of P.members()) { if (peer === NC.Net.me()) continue; const r = NC.Net.remotes.get(peer); if (r && r.ud) ids.push(r.ud); }
    return ids.length > 1 ? R.partyKey(ids) : null;
  };
  async function load() {
    renderBoard();
    if (!S || busy) return;
    const key = bmode + period;
    const hit = cache[key];
    if (hit && Date.now() - hit.t < 20000) { rows = hit.rows; renderBoard(); return; }
    busy = true;
    try {
      if (bmode === 'solo') await Promise.resolve(R.push()).catch(() => {});
      const field = period + 'Score';
      let list = await S.query(coll(), { order: [field, 'desc'], limit: 120 });
      list = list.filter((r) => inPeriod(r.data) && (r.data[field] || 0) > 0);
      rows = list; fetched = Date.now();
      cache[key] = { rows, t: fetched };
    } catch (e) { console.warn('darkroot board', e); rows = []; }
    busy = false;
    renderBoard();
  }
  setInterval(() => { if (bw && !bw.hidden && Date.now() - fetched > 60000) { for (const k in cache) delete cache[k]; load(); } }, 15000);
  function visible() { return job === 'all' ? rows : rows.filter((r) => r.data.line === job); }
  const F = (d) => d[period + 'F'] | 0, T = (d) => +d[period + 'T'] || 0;
  const frameCls = (d) => (d && d.frame && FRAMES[d.frame] ? ' f-' + d.frame : '');
  function renderBoard() {
    if (!bw || bw.hidden) return;
    for (const b of bw.querySelectorAll('[data-bm]')) b.classList.toggle('on', b.dataset.bm === bmode);
    $('rb-chips').innerHTML = ['w', 's', 'a'].map((k) => `<button class="${period === k ? 'on' : ''}" data-per="${k}">${k === 's' ? 'ฤดูกาล ' + R.seasonNo() : PER[k]}</button>`).join('');
    const js = $('rb-job');
    if (!js.options.length) js.innerHTML = '<option value="all">ทุกอาชีพ</option>' + lines().map((l) => `<option value="${l}">${esc(jobName(l))}</option>`).join('');
    js.value = job;
    const list = visible(), party = bmode === 'party';
    // the plates on the podiums
    const M = stageMap();
    $('rb-plates').innerHTML = [1, 2, 3].map((n) => {
      const r = list[n - 1], P0 = POD[n], left = ((M.x(P0[0]) / M.W) * 100).toFixed(2), top = ((M.y(P0[3]) / M.H) * 100).toFixed(2);
      if (!r) return `<div class="rb-plate p${n} empty" style="left:${left}%;top:${top}%"><b>ว่าง</b></div>`;
      const d = r.data;
      return `<div class="rb-plate p${n}" style="left:${left}%;top:${top}%"><b>${esc(clean(d.name, party ? 20 : 16))}</b><i>ชั้น ${F(d)}${n === 1 ? ' - ' + hm(T(d)) : ''}</i></div>`;
    }).join('');
    // the list from #4: a header row, then the rows
    $('rb-head').className = 'rb-head' + (party ? ' party' : '');
    $('rb-head').innerHTML = party ? '<span>อันดับ</span><span>ชื่อปาร์ตี้</span><span>สมาชิก</span><span>ชั้นลึกสุด</span><span>เวลา</span><span>อาชีพหลัก / กิลด์</span>'
      : '<span>อันดับ</span><span>ชื่อ</span><span>อาชีพ</span><span>ชั้นลึกสุด</span><span>เวลา</span><span>กิลด์</span>';
    let h = '';
    list.slice(3, 60).forEach((r, i) => {
      const d = r.data, n = i + 4, mine = party ? r.id === myPartyKey() : r.id === R.uid();
      const lead = party && d.mem && d.mem[0] ? d.mem[0] : null;
      if (party) {
        h += `<div class="rb-row party${mine ? ' me' : ''}"><span class="rb-no">#${n}</span><b class="rb-name">${esc(clean(d.name, 20))}</b>` +
          `<span class="rb-mems">${(d.mem || []).slice(0, 4).map((m, k) => `<canvas data-pf="${esc(r.id)}:${k}" title="${esc(clean(m.name, 16))}"></canvas>`).join('')}</span>` +
          `<span class="rb-floor">ชั้น ${F(d)}</span><span class="rb-time">${hms(T(d))}</span>` +
          `<span class="rb-job2">${lead && lineSrc(lead.line) ? `<img src="${lineSrc(lead.line)}" alt="">` : ''}${esc(d.guild ? clean(d.guild, 16) : lead ? jobName(lead.job) : '')}</span></div>`;
      } else {
        h += `<div class="rb-row${mine ? ' me' : ''}"><span class="rb-no">#${n}</span><span class="rb-who"><canvas class="rb-face${frameCls(d)}" data-sf="${esc(r.id)}"></canvas><b class="rb-name">${esc(clean(d.name, 16))}</b></span>` +
          `<span class="rb-job2">${lineSrc(d.line) ? `<img src="${lineSrc(d.line)}" alt="">` : ''}${esc(jobName(d.job))}</span>` +
          `<span class="rb-floor">ชั้น ${F(d)}</span><span class="rb-time">${hms(T(d))}</span><span class="rb-guild">${d.guild ? esc(clean(d.guild, 14)) : '—'}</span></div>`;
      }
    });
    if (!list.length) h = `<div class="rb-empty">${busy ? 'กำลังโหลด…' : 'ยังไม่มีใครในตารางนี้ · ลงไปในรากแล้วเป็นคนแรก!'}</div>`;
    else if (list.length <= 3) h = '<div class="rb-empty">ยังไม่มีอันดับที่ 4 ลงไป</div>';
    $('rb-list').innerHTML = h;
    renderMe(list);
    fit(bw);
    faces(list);
  }
  function renderMe(list) {
    const el = $('rb-me'), party = bmode === 'party';
    let rank = null, text = '';
    if (party) {
      const key = myPartyKey(), i = key ? list.findIndex((r) => r.id === key) : -1;
      if (i >= 0) { rank = i + 1; text = `ปาร์ตี้ของคุณ - ชั้น ${F(list[i].data)} - ${hms(T(list[i].data))}`; }
      else text = key ? 'ปาร์ตี้นี้ยังไม่มีสถิติในช่วงนี้' : 'คุณยังไม่ได้อยู่ในปาร์ตี้ (กด P)';
    } else {
      const rec = period === 's' ? st.s : period === 'w' ? st.w : st.a, f = rec.best;
      const t = period === 'a' ? R.sumTime(st.a, f) : period === 's' ? R.sumTime(st.s, f, st.a) : R.sumTime(st.w, f, st.s, st.a);
      const i = list.findIndex((r) => r.id === R.uid());
      rank = i >= 0 ? i + 1 : f > 0 ? list.filter((r) => (r.data[period + 'Score'] || 0) > R.score(f, t)).length + 1 : null;
      text = f ? `คุณ - ชั้น ${f} - ${hms(t)}` : 'คุณ - ยังไม่ผ่านชั้นไหนในช่วงนี้';
    }
    el.innerHTML = `<canvas class="rb-mface${st.frame ? ' f-' + st.frame : ''}" data-sf="me"></canvas><span class="rb-mno">${rank ? '#' + rank : '—'}</span><b>${esc(text)}</b>`;
    const cv = el.querySelector('canvas'); if (cv) face(cv, myEq());
  }
  function faces(list) {
    for (const cv of bw.querySelectorAll('canvas[data-sf]')) { const id = cv.dataset.sf; if (id === 'me') continue; const r = list.find((x) => x.id === id); if (r) face(cv, eqFrom(r.data.eq)); }
    for (const cv of bw.querySelectorAll('canvas[data-pf]')) { const [id, k] = cv.dataset.pf.split(':'), r = list.find((x) => x.id === id), m = r && r.data.mem && r.data.mem[+k]; if (m) face(cv, eqFrom(m.eq)); }
  }

  // the podium hall (ui_stage.jpg, 1536 x 600): [centre x, the top where they stand, the number on the front, the plate]
  const AW = 1536, AH = 600, OY = -8;
  const POD = { 1: [767, 250, 300, 342], 2: [450, 298, 336, 372], 3: [1088, 310, 346, 380] };
  const MEDAL = { 1: ['#ffe27a', '#d99a1e'], 2: ['#f2f5fa', '#9aa8bd'], 3: ['#ffbf86', '#c06a2e'] };
  function stageMap() {
    const cv = $('rb-stage'), r = cv.getBoundingClientRect(), W = r.width || 1, H = r.height || 1;
    const k = W / AW, ox = 0, oy = OY * k;
    return { k, x: (ax) => ox + ax * k, y: (ay) => oy + ay * k, W, H };
  }
  // a big number on the podium's front with a laurel sprig each side (as the mockup)
  function podNumber(c, x, y, s, n) {
    const [f, d] = MEDAL[n];
    c.save();
    c.lineJoin = 'round';
    for (const side of [-1, 1]) for (let i = 0; i < 4; i++) {
      const a = Math.PI / 2 + side * (0.5 + i * 0.32), lx = x + side * s * 0.62 + Math.cos(a) * s * 0.3 * side, ly = y + s * 0.18 - i * s * 0.2;
      c.save(); c.translate(lx, ly); c.rotate(side * (0.9 + i * 0.12)); c.beginPath(); c.ellipse(0, 0, s * 0.17, s * 0.075, 0, 0, TAU);
      c.fillStyle = f; c.fill(); c.lineWidth = s * 0.04; c.strokeStyle = '#2a2435'; c.stroke(); c.restore();
    }
    c.font = `800 ${Math.round(s)}px 'Baloo 2', 'Mitr', sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    const g = c.createLinearGradient(x, y - s / 2, x, y + s / 2); g.addColorStop(0, f); g.addColorStop(1, d);
    c.lineWidth = s * 0.16; c.strokeStyle = '#2a2435'; c.strokeText(String(n), x, y + s * 0.06);
    c.fillStyle = g; c.fillText(String(n), x, y + s * 0.06);
    c.restore();
  }
  function head(c, eq, x, y, size) { // a hero's head (and a little of the shoulders) standing on a podium
    try { const hs = NC.headSpot(eq), k = size / hs.w; NC.drawAvatar(c, eq, x - hs.x * k, y - hs.y * k, k, 1, { noWeapon: true }); } catch (e) { /* (not loaded) */ }
  }
  function drawStage(t) {
    const cv = $('rb-stage');
    if (!cv) return;
    const r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1, W = Math.max(1, Math.round(r.width * dpr)), H = Math.max(1, Math.round(r.height * dpr));
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    const c = cv.getContext('2d'), k = W / AW, oy = OY * k, X = (ax) => ax * k, Y = (ay) => oy + ay * k;
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, W, H);
    if (STAGE.complete && STAGE.naturalWidth) c.drawImage(STAGE, 0, oy, AW * k, AH * k);
    const list = visible(), party = bmode === 'party';
    for (const n of [2, 3, 1]) {
      const [px, py, ny] = POD[n], d = list[n - 1] && list[n - 1].data;
      podNumber(c, X(px), Y(ny), (n === 1 ? 74 : 62) * k, n);
      if (!d) continue;
      if (party) { // the members' heads in a row on the podium (the middle ones a little higher)
        const mem = (d.mem || []).slice(0, 4), size = (n === 1 ? 112 : 104) * k, gap = (n === 1 ? 80 : 70) * k, x0 = X(px) - ((mem.length - 1) * gap) / 2;
        // (standing behind the podium: only what shows above its top is drawn)
        c.save(); c.beginPath(); c.rect(0, 0, W, Y(py) + 6 * k); c.clip();
        mem.forEach((m, i) => { const mid = Math.abs(i - (mem.length - 1) / 2) < 1 ? 1 : 0; head(c, eqFrom(m.eq), x0 + i * gap, Y(py) - size * (0.5 + 0.1 * mid) + Math.sin(t * 2 + i + n) * 1.5 * k, size); });
        c.restore();
        continue;
      }
      const eq = eqFrom(d.eq), ac = NC.animCtx ? NC.animCtx(eq) : undefined, Pz = NC.Anim.sample('idle', t + n * 0.9, ac);
      Pz.face = n === 3 ? -1 : 1;
      c.fillStyle = 'rgba(20,14,30,0.3)'; c.beginPath(); c.ellipse(X(px), Y(py), 62 * k, 13 * k, 0, 0, TAU); c.fill();
      if (!(NC.HeroSpine && NC.HeroSpine.preview && NC.HeroSpine.preview(c, eq, X(px), Y(py) + 4 * k, (n === 1 ? 2.4 : 2.15) * k, { t: t + n * 0.9, face: Pz.face, key: 'tower' + n }))) // (the hero rig's idle, js/herospine.js)
        NC.drawHero(c, eq, Pz, X(px), Y(py) + 4 * k, { scale: (n === 1 ? 2.4 : 2.15) * k });
    }
  }
  // the depth column: floors 100 (top) to 1 on the left, flag tags where the top 3, #4 and I stopped
  const TAGS = [['#e8344a', true], ['#4f95ea'], ['#f09a3a'], ['#8a66dc']];
  function drawDepth() {
    const cv = $('rb-depth');
    if (!cv) return;
    const r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1, W = Math.max(1, Math.round(r.width * dpr)), H = Math.max(1, Math.round(r.height * dpr));
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    const c = cv.getContext('2d'), u = W / 205;
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, W, H);
    const s = NC.SPR.ui_depth, top = 6 * u, bot = H - 4 * u, colX = W * 0.5;
    if (DEPTH.complete && DEPTH.naturalWidth) { // (the painted column covers the panel)
      const k = Math.max(W / DEPTH.naturalWidth, H / DEPTH.naturalHeight), w = DEPTH.naturalWidth * k, h = DEPTH.naturalHeight * k;
      c.drawImage(DEPTH, (W - w) / 2, H - h, w, h);
      const fade = c.createLinearGradient(0, 0, W * 0.3, 0); fade.addColorStop(0, 'rgba(239,228,201,0.9)'); fade.addColorStop(1, 'rgba(239,228,201,0)');
      c.fillStyle = fade; c.fillRect(0, 0, W * 0.3, H); // (a pale band under the numbers)
    } else if (s && s.img) { const h = bot - top, w = W * 0.72; c.drawImage(s.img, colX - w / 2, top, w, h); }
    const yOf = (f) => H - 50 * u - ((f - 1) / 99) * (H - 50 * u - 40 * u);
    c.font = `700 ${Math.round(19 * u)}px 'Baloo 2', 'Mitr', sans-serif`; c.textAlign = 'left'; c.textBaseline = 'middle';
    for (const f of [1, 20, 40, 60, 80, 100]) {
      const y = yOf(f);
      c.fillStyle = '#2a2435'; c.fillText(String(f), 8 * u, y);
      c.strokeStyle = '#2a2435'; c.lineWidth = 2.2 * u; c.beginPath(); c.moveTo((f === 100 ? 44 : f === 1 ? 24 : 34) * u, y); c.lineTo(58 * u, y); c.stroke();
    }
    const list = visible(), marks = [];
    list.slice(0, 4).forEach((r0, i) => marks.push({ f: F(r0.data), col: TAGS[i][0], crown: !!TAGS[i][1] }));
    let me = 0;
    if (bmode === 'solo') me = (period === 's' ? st.s : period === 'w' ? st.w : st.a).best;
    else { const key = myPartyKey(), d = key && list.find((x) => x.id === key); if (d) me = F(d.data); }
    if (me) marks.push({ f: me, col: '#5fc256' });
    marks.sort((a, b) => b.f - a.f);
    let lastY = -1e9;
    for (const m of marks) {
      const y0 = yOf(Math.max(1, m.f));
      let y = Math.max(y0, lastY + 30 * u);
      lastY = y;
      const tx = W * 0.66, text = String(m.f);
      c.font = `800 ${Math.round(18 * u)}px 'Baloo 2', 'Mitr', sans-serif`; c.textAlign = 'center';
      const w = c.measureText(text).width + (m.crown ? 34 : 18) * u, h = 27 * u;
      // the line from the column to the tag
      c.strokeStyle = '#2a2435'; c.lineWidth = 3.5 * u; c.beginPath(); c.moveTo(colX - 4 * u, y0); c.lineTo(tx - w / 2 - 8 * u, y); c.stroke();
      c.strokeStyle = m.col; c.lineWidth = 1.8 * u; c.stroke();
      c.beginPath(); c.arc(colX - 4 * u, y0, 3.5 * u, 0, TAU); c.fillStyle = '#fff'; c.fill(); c.lineWidth = 1.8 * u; c.strokeStyle = '#2a2435'; c.stroke();
      c.beginPath(); c.moveTo(tx - w / 2 - 11 * u, y); c.lineTo(tx - w / 2, y - h / 2); c.lineTo(tx + w / 2, y - h / 2); c.lineTo(tx + w / 2, y + h / 2); c.lineTo(tx - w / 2, y + h / 2); c.closePath();
      c.fillStyle = m.col; c.fill(); c.lineWidth = 2.8 * u; c.strokeStyle = '#2a2435'; c.stroke();
      if (m.crown) { const cs = NC.SPR.ic_crown; if (cs && cs.img) c.drawImage(cs.img, tx - w / 2 + 2 * u, y - 9 * u, 18 * u, 16 * u); }
      c.lineJoin = 'round'; c.lineWidth = 4 * u; c.strokeStyle = '#2a2435'; c.strokeText(text, tx + (m.crown ? 8 : 0) * u, y + 1 * u);
      c.fillStyle = '#fff'; c.fillText(text, tx + (m.crown ? 8 : 0) * u, y + 1 * u);
    }
  }
  function loop() {
    raf = 0;
    const t = performance.now() / 1000;
    let any = false;
    if (lw && !lw.hidden) { drawMap(t); any = true; }
    if (bw && !bw.hidden) { drawStage(t); drawDepth(); any = true; }
    if (any) raf = requestAnimationFrame(loop);
  }
  const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };
  setInterval(() => { if (lw && !lw.hidden) renderLobby(); }, 1500);
  addEventListener('resize', () => setTimeout(() => { if (lw && !lw.hidden) renderLobby(); if (bw && !bw.hidden) renderBoard(); }, 0));

  // ---------------- the windows in the HUD's panel system ----------------
  const baseInit = NC.HUD.init.bind(NC.HUD);
  NC.HUD.init = function (game) {
    baseInit(game);
    buildLobby(); buildBoard();
  };
  const basePanel = NC.HUD.panel.bind(NC.HUD);
  NC.HUD.panel = function (id, show) {
    if (lw && (id === 'rootlobby' || id === 'rootboard')) {
      const win = id === 'rootlobby' ? lw : bw, other = id === 'rootlobby' ? bw : lw;
      const on = show === undefined ? win.hidden : show;
      basePanel('pause', false); // (closes every other window)
      other.hidden = true;
      win.hidden = !on;
      if (on) { if (id === 'rootlobby') { renderLobby(); loadMyRank(); } else load(); kick(); }
      return on;
    }
    if (lw) lw.hidden = true;
    if (bw) bw.hidden = true;
    return basePanel(id, show);
  };
  addEventListener('keydown', (e) => {
    if (e.code !== 'Escape') return;
    if (lw && !lw.hidden) { e.stopImmediatePropagation(); e.preventDefault(); if (shop) { shop = false; renderLobby(); } else closeLobby(); }
    else if (bw && !bw.hidden) { e.stopImmediatePropagation(); e.preventDefault(); closeBoard(); }
  }, true);

  R.openLobby = openLobby;
  R.openBoard = openBoard;
})();
