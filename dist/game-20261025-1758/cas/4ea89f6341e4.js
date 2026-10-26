/* gwar_ui.js — the screens of ศึกชิงกองไฟ (js/gwar.js) in the K look (css/gwar.css):
     the war bar     both guilds (the defender, the challenger) with how long each held the great fire, the five fires in
                     map order with their firewood, the land, the time left, who holds the great fire, my firewood and
                     kills, a leave button
     the feed        kills and fires changing hands, under the bar; big words (the start, the great fire taken, the last
                     minute)
     fallen          the wait, and where to come back: the camp or one of my side's fires that no enemy stands in
     Tab             the scoreboard of both sides
     the end         who holds the land now, both tables, my war and my war embers
     the war board   at the camp's gate (T or a click): the four lands, who holds each, who challenges it this week, the
                     schedule, the rules; sign up to challenge (a leader or an officer), enter when the war is on
   While on a land the guide's spirit (#journey) steps aside. Their final look waits for the user's pick of the mockups. */
(function () {
  'use strict';
  const NC = window.NC, GW = NC.GW;
  if (!GW) return;
  const R = GW.RULES, FIRES = GW.FIRES, SIDE = GW.SIDE;
  const $ = (id) => document.getElementById(id);
  const G = () => NC.game;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const icon = (k) => ((NC.ASSET_MANIFEST || {})[k] || {}).src || '';
  const clock = (s) => { s = Math.max(0, Math.ceil(s)); const h = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60), ss = s % 60; return h ? `${h}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}` : `${mm}:${String(ss).padStart(2, '0')}`; };
  const jobName = (j) => ((NC.JOBS || {})[j] || {}).name || j || '';
  const DAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
  let bar = null, feedEl = null, bigEl = null, deadEl = null, scoreEl = null, endEl = null, boardEl = null;

  function build() {
    if (bar) return;
    const hud = $('hud') || document.body;
    bar = document.createElement('div'); bar.id = 'gwr-bar'; bar.hidden = true;
    feedEl = document.createElement('div'); feedEl.id = 'gwr-feed';
    bigEl = document.createElement('div'); bigEl.id = 'gwr-big';
    deadEl = document.createElement('div'); deadEl.id = 'gwr-dead'; deadEl.hidden = true;
    scoreEl = document.createElement('div'); scoreEl.className = 'gwr-win peek'; scoreEl.id = 'gwr-score'; scoreEl.hidden = true;
    endEl = document.createElement('div'); endEl.className = 'gwr-win'; endEl.id = 'gwr-end'; endEl.hidden = true;
    boardEl = document.createElement('div'); boardEl.className = 'gwr-win'; boardEl.id = 'gwr-board'; boardEl.hidden = true;
    hud.append(bar, feedEl, bigEl, deadEl);
    document.body.append(scoreEl, endEl, boardEl); // (the windows over the whole screen, like the other K windows)
    bar.addEventListener('click', (e) => { if (e.target.closest('[data-gw=leave]')) GW.leave('ออกจากศึกชิงกองไฟ'); });
    deadEl.addEventListener('click', (e) => {
      const b = e.target.closest('[data-sp]');
      if (!b || b.disabled) return;
      GW.spawnAt = Number(b.dataset.sp);
      dead(true);
    });
    endEl.addEventListener('click', (e) => { if (e.target.closest('[data-gw=home]')) { endEl.hidden = true; GW.leave(); } });
    boardEl.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-gw]');
      if (!b) { if (e.target === boardEl) close(); return; }
      const z = b.dataset.z;
      if (b.dataset.gw === 'close') close();
      else if (b.dataset.gw === 'enter') { const why = GW.enter(z); if (why === 'ok') close(); else note(WHY[why] || why); }
      else if (b.dataset.gw === 'sign') { b.disabled = true; const r = await GW.signUp(z); note(r === 'ok' ? `ลงชื่อท้าชิง${GW.ZONE[z].name}แล้ว · มาสู้กันวันเสาร์ 20:00` : SIGN[r] || r); board(); }
      else if (b.dataset.gw === 'unsign') { await GW.unSign(z); note('ถอนการท้าชิงแล้ว'); board(); }
    });
  }
  const close = () => { boardEl.hidden = true; const g = G(); if (g) g.paused = false; };
  const note = (t) => { const g = G(); if (g && g.toast) g.toast(t); };
  const WHY = { noguild: 'ต้องอยู่ในกิลด์ก่อน (กด O)', closed: 'ศึกยังไม่เปิด', over: 'ศึกครั้งนี้จบแล้ว', notyours: 'กิลด์คุณไม่ได้สู้ที่นี่', crowd: `ฝั่งของคุณครบ ${R.perSide} คนแล้ว`, wait: 'รอสักครู่' };
  const SIGN = { noguild: 'ต้องอยู่ในกิลด์ก่อน', rank: 'หัวหน้าหรือรองหัวหน้ากิลด์เท่านั้นที่ลงชื่อท้าชิงได้', running: 'ศึกกำลังเปิดอยู่ ลงชื่อได้หลังศึกจบ', already: 'กิลด์ของคุณลงชื่อท้าชิงดินแดนอื่นไว้แล้ว (สัปดาห์ละ 1 ดินแดน)', own: 'กิลด์ของคุณครองดินแดนนี้อยู่แล้ว', taken: 'มีกิลด์ลงชื่อท้าชิงดินแดนนี้ครบแล้ว' };

  // ---------------- the war bar ----------------
  let lastBar = '';
  function hud() {
    build();
    const g = G(), m = GW.match, z = GW.zone();
    document.body.classList.toggle('gwr-on', !!z);
    if (!z || !GW.side || !m) { bar.hidden = true; feedEl.textContent = ''; deadEl.hidden = true; lastBar = ''; return; }
    const holder = m.fires[GW.GREAT].own;
    const team = (s) => `<div class="gwr-team ${s}${s === GW.side ? ' mine' : ''}${holder === s ? ' hold' : ''}"><small class="role">${m.owner ? SIDE[s].name : SIDE[s].free}</small>` +
      `<b>${esc(GW.sideName(m, s))}</b><small>ถือไฟใหญ่ ${clock(m.hold[s])}</small></div>`;
    const fires = FIRES.map((f, i) => {
      const st = m.fires[i], big = f.kind === 'great', mx = R[f.kind].max;
      const img = m.ph === 'p' || (big && st.own) ? 'gwi_great' : st.own ? (st.own === 'b' ? 'gwi_fire_b' : 'gwi_fire_r') : 'gwi_ash';
      const under = st.own && (st.own === 'b' ? st.nr > st.nb : st.nb > st.nr);
      const pct = m.ph === 'p' ? 100 : st.own ? Math.round((100 * st.fuel) / mx) : Math.round((100 * st.lit) / R.lightS);
      return `<div class="gwr-f${big ? ' great' : ''}${st.own && m.ph === 'f' ? ' ' + st.own : ''}${under ? ' hit' : ''}" title="${esc(f.name)}"><img src="${icon(img)}" alt=""><i><u style="width:${pct}%"></u></i></div>`;
    }).join('');
    const phase = m.ph === 'p' ? `เริ่มใน ${clock(R.prep - m.t)}` : m.ph === 'e' ? 'จบศึก' : `เหลือ ${clock(m.left)}`;
    const great = m.ph === 'p' ? 'ยังไม่เริ่ม' : holder ? esc(GW.sideName(m, holder)) : 'ไม่มีใครถือ (เถ้า)';
    const h = `<div class="gwr-row">${team('b')}<div class="gwr-fires">${fires}</div>${team('r')}</div>` +
      `<div class="gwr-sub"><span>${esc(z.name)}</span><span class="t">${phase}</span><span>ไฟใหญ่: ${great}</span>` +
      `<span><img src="${icon('gwi_wood')}" alt=""> ${GW.me.carry | 0}/${R.carry | 0}</span><span>ล้มศัตรู ${GW.me.k | 0} · ล้ม ${GW.me.d | 0}</span><button data-gw="leave">ออกจากศึก</button></div>`;
    if (h !== lastBar) { bar.innerHTML = h; lastBar = h; }
    bar.hidden = false;
    feed();
    if (g.player.dead > 0) dead(true); else if (!deadEl.hidden) deadEl.hidden = true;
    if (!scoreEl.hidden) score();
  }
  function feed() {
    build();
    const t = Date.now();
    feedEl.innerHTML = GW.feed.filter((l) => t - l.t < 9000).slice(-4).map((l) => `<div class="${l.side || ''}" style="opacity:${t - l.t > 7000 ? 0.4 : 1}">${esc(l.text)}</div>`).join('');
  }
  let bigT = 0;
  function big(text, sub) {
    build();
    bigEl.innerHTML = esc(text) + (sub ? `<small>${esc(sub)}</small>` : '');
    bigEl.classList.add('show');
    clearTimeout(bigT); bigT = setTimeout(() => bigEl.classList.remove('show'), 1800);
  }
  function dead(show) {
    build();
    const g = G(), p = g && g.player;
    if (!show || !p || p.dead <= 0 || !GW.on()) { deadEl.hidden = true; return; }
    if (GW.spawnAt >= 0 && !GW.spawnOk(GW.spawnAt)) GW.spawnAt = -1;
    const C = GW.CAMPS[GW.side];
    const opt = (i, name, img, ok) => `<button data-sp="${i}"${ok ? '' : ' disabled'} class="${GW.spawnAt === i ? 'on' : ''}"><img src="${icon(img)}" alt="">${esc(name)}</button>`;
    let h = `<b>ฟื้นใน ${Math.ceil(p.dead)} วินาที</b><span>เลือกที่ฟื้น (ไฟที่มีศัตรูยืนอยู่ฟื้นไม่ได้)</span><div class="gwr-sp">${opt(-1, C.name, 'gwi_banner', true)}`;
    FIRES.forEach((f, i) => { const st = GW.match && GW.match.fires[i]; if (st && st.own === GW.side) h += opt(i, f.name, i === GW.GREAT ? 'gwi_great' : GW.side === 'b' ? 'gwi_fire_b' : 'gwi_fire_r', GW.spawnOk(i)); });
    deadEl.innerHTML = h + '</div>';
    deadEl.hidden = false;
  }

  // ---------------- the scoreboard (hold Tab) ----------------
  function table(s) {
    const rows = GW.people().filter((q) => q.side === s).sort((a, b) => b.k - a.k || b.c - a.c);
    return `<table class="gwr-table"><tr><th>ชื่อ</th><th>อาชีพ</th><th>ล้มศัตรู</th><th>ล้ม</th><th>จุดไฟ</th><th>ฟืน</th></tr>` +
      rows.map((q) => `<tr class="${q.mine ? 'me' : ''}"><td>${esc(q.name)}</td><td>${esc(jobName(q.job))}</td><td class="n">${q.k}</td><td class="n">${q.d}</td><td class="n">${q.c}</td><td class="n">${q.w}</td></tr>`).join('') + '</table>';
  }
  const col = (m, s) => !m.gid[s] ? `<div class="gwr-card ${s}"><h3>${m.owner ? SIDE[s].name : SIDE[s].free}</h3><div class="gwr-note" style="text-align:left">ไม่มีกิลด์มาสู้ฝั่งนี้</div></div>` : `<div class="gwr-card ${s}"><h3>${esc(GW.sideName(m, s))} · ${m.owner ? SIDE[s].name : SIDE[s].free}</h3><div class="gwr-note" style="text-align:left;margin:0 0 4px">ถือกองไฟใหญ่รวม ${clock(m.hold[s])}</div>${table(s)}</div>`;
  function score() {
    build();
    const m = GW.match, z = GW.zone();
    if (!m || !z) return;
    scoreEl.innerHTML = `<div class="card"><div class="ptitle"><span>${esc(z.name)} · ตารางศึก</span></div><div class="gwr-body"><div class="gwr-cols">${col(m, 'b')}${col(m, 'r')}</div>` +
      `<div class="gwr-note">ปล่อย Tab เพื่อปิด</div></div></div>`;
  }
  addEventListener('keydown', (e) => {
    if (e.code !== 'Tab' || !GW.on() || !GW.side) return;
    const t = document.activeElement;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    e.preventDefault();
    build(); score(); scoreEl.hidden = false;
  }, true);
  addEventListener('keyup', (e) => { if (e.code === 'Tab' && scoreEl) scoreEl.hidden = true; }, true);

  // ---------------- the end ----------------
  function end(m) {
    build();
    const z = GW.ZONE[m.zone] || GW.zone() || { name: '' }, w = m.win, mine = w && w === GW.side, rw = GW.lastReward || { n: 0 };
    const kept = w === 'b' && m.owner && m.gid.b === m.owner;
    const title = !w ? 'ไม่มีใครได้ดินแดน' : kept ? `${esc(GW.sideName(m, w))} ป้องกันไว้ได้!` : `${esc(GW.sideName(m, w))} ยึด${esc(z.name)}ได้!`;
    endEl.innerHTML = `<div class="card"><div class="ptitle"><span>${esc(z.name)} · ผลศึก</span></div><div class="gwr-body">` +
      `<div class="gwr-result"><b class="${w || 'd'}">${title}</b>${w ? `ครอง${esc(z.name)}ไปทั้งสัปดาห์` : 'กองไฟใหญ่เป็นเถ้าตอนหมดเวลา'}</div><div class="gwr-cols">${col(m, 'b')}${col(m, 'r')}</div>` +
      `<div class="gwr-mine">ศึกของคุณ: ล้มศัตรู ${GW.me.k | 0} · จุดไฟ ${GW.me.c | 0} · เติมฟืน ${GW.me.w | 0}` +
      `<img src="${icon('gw_ember')}" alt="">${rw.n ? `ถ่านศึก +${rw.n}${mine ? ' (ฝั่งชนะ)' : ''}` : 'รับรางวัลศึกนี้ไปแล้ว'}</div>` +
      `<div class="gwr-btns"><button data-gw="home">กลับค่าย</button></div><div class="gwr-note">กลับค่ายเองใน ${R.endHold} วินาที</div></div></div>`;
    endEl.hidden = false;
    big(title.replace(/&[a-z]+;/g, ''), mine ? 'ฝั่งเราชนะ!' : w ? 'ฝั่งเราแพ้ศึกนี้' : '');
  }

  // ---------------- the war board at the gate: the four lands ----------------
  function board() {
    build();
    const t = Date.now(), win = GW.windowAt(t), gid = GW.mySide ? null : null; // (gid: below)
    const myGid = (NC.Guild && NC.Guild.gid && NC.Guild.gid()) || '';
    const gd = NC.Guild && NC.Guild.guild && NC.Guild.guild();
    const status = win.open ? `<span class="gwr-status open">ศึกเปิดอยู่ · เหลือ ${clock((win.end - t) / 1000)}</span>` :
      `<span class="gwr-status">ศึกครั้งหน้า วัน${DAYS[new Date(win.next).getDay()]} ${String(new Date(win.next).getHours()).padStart(2, '0')}:00 · อีก ${clock((win.next - t) / 1000)}</span>`;
    const cards = GW.ZONES.map((z) => {
      const sd = GW.sidesOf(z.id), s = GW.seenMatch(z.id), m = s && s.m;
      const owner = sd.owner ? `<b>${esc(sd.b && sd.b.name)}</b>` : '<span class="gwr-none">ยังไม่มีเจ้าของ</span>';
      const ch = sd.owner ? (sd.r ? esc(sd.r.name) : '-') : [sd.b, sd.r].filter(Boolean).map((q) => esc(q.name)).join(' · ') || '-';
      const live = m && m.ph !== 'x' ? `<div class="gwr-live">กำลังรบ · ${m.fires[GW.GREAT].own ? 'ไฟใหญ่: ' + esc(GW.sideName(m, m.fires[GW.GREAT].own)) : 'ไฟใหญ่เป็นเถ้า'} · เหลือ ${clock(m.left)}</div>` : '';
      const inIt = myGid && ((sd.b && sd.b.gid === myGid) || (sd.r && sd.r.gid === myGid));
      const signed = myGid && (sd.owner ? sd.r && sd.r.gid === myGid : inIt);
      const why = GW.canEnter(z.id);
      let btn = '';
      if (win.open) btn = `<button data-gw="enter" data-z="${z.id}"${why === 'ok' ? '' : ' disabled'}>${why === 'ok' ? 'เข้าสนาม' : esc(WHY[why] || why)}</button>`;
      else if (signed) btn = `<button class="grey" data-gw="unsign" data-z="${z.id}">ถอนการท้าชิง</button>`;
      else if (!(sd.owner && sd.owner === myGid)) btn = `<button data-gw="sign" data-z="${z.id}"${gd ? '' : ' disabled'}>ท้าชิงดินแดนนี้</button>`;
      else btn = `<span class="gwr-status open">ดินแดนของเรา · ป้องกันวันเสาร์</span>`;
      return `<div class="gwr-zone${inIt ? ' mine' : ''}"><img src="${esc(z.pic)}" alt=""><div class="gwr-zt"><h3>${esc(z.name)}</h3><small>${esc(z.note)}</small>` +
        `<div>เจ้าของ: ${owner}</div><div>${sd.owner ? 'ผู้ท้าชิงสัปดาห์นี้' : 'ผู้ท้าชิง (2 กิลด์)'}: ${ch}</div>${live}<div class="gwr-zb">${btn}</div></div></div>`;
    }).join('');
    const rule = (img, txt) => `<div><img src="${icon(img)}" alt="">${txt}</div>`;
    boardEl.innerHTML = `<div class="card wide"><div class="ptitle"><span>ศึกชิงกองไฟ · กระดานศึก 4 ดินแดน</span><button data-gw="close">×</button></div><div class="gwr-body">` +
      `<div>${status} ศึกละ ${R.minutes} นาที · เจ้าของดินแดนป้องกัน ผู้ท้าชิงบุก</div><div class="gwr-zones">${cards}</div>` +
      `<div class="gwr-rules">` +
      rule('gwi_great', 'หมดเวลาแล้วใครถือกองไฟใหญ่อยู่ ได้ครองดินแดนทั้งสัปดาห์ (ถ้าเป็นเถ้า เจ้าของเดิมได้ต่อ)') +
      rule('gwi_ash', `ยืนในวงไฟศัตรูให้มากกว่าเขา ไฟจะมอดจนเป็นเถ้า แล้วยืน ${R.lightS} วินาทีเพื่อจุดเป็นสีเรา`) +
      rule('gwi_fire_b', 'ไฟเล็กเป็นจุดฟื้น และแต่ละกองทำให้ฝั่งเราดับไฟศัตรูเร็วขึ้น 15%') +
      rule('gwi_axe', `ตัดต้นไม้ (กด B) ได้ฟืน ถือได้ ${R.carry} มัด เดินเข้าวงไฟเราเพื่อเติม · นอกแสงไฟมองเห็นแค่รอบตัว`) +
      rule('gwi_banner', `หัวหน้า/รองหัวหน้ากิลด์ลงชื่อท้าชิงได้สัปดาห์ละ 1 ดินแดน · ตายไม่เสียอะไร รอ ${R.respawnS} วินาที`) +
      rule('gw_ember', 'รางวัล: ถ่านศึก (ฝั่งชนะได้มากกว่า) ไว้แลกของแต่งตัว ไม่มีของเพิ่มพลัง') + `</div>` +
      `<div class="gwr-note">${gd ? `กิลด์ของคุณ: ${esc(gd.name)}` : 'คุณยังไม่มีกิลด์ (กด O)'} · ห้ามใช้ออโต้ในศึก</div>` +
      `<div class="gwr-btns"><button class="grey" data-gw="close">ปิด</button></div></div></div>`;
    boardEl.hidden = false;
    const g = G(); if (g) g.paused = true;
  }
  GW.ui.refresh = () => { if (boardEl && !boardEl.hidden) board(); };
  addEventListener('keydown', (e) => { if (e.code === 'Escape' && boardEl && !boardEl.hidden) { close(); e.stopImmediatePropagation(); } }, true);

  Object.assign(GW.ui, { hud, feed, big, dead, end, board, score });
})();
