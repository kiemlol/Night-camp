/* partywin.js — the party window (P) in the K look (css/kui.css + css/partywin.css), layout "A" of the social pages
   (assets/gen/nightcamp_pg_party_a_raw.png, 2026-10-01): a party of REAL players (js/partynet.js; the AI friends of
   party.js are a test tool only).
     top left    the night camp (assets/kui/party_camp.jpg) with the game's own campfire burning in the middle and the
                 party standing round it, drawn live with the rig in their outfits; name tags, a crown on the leader's
     under it    the four places: a portrait, name, level and job, the map they are in (a green dot when it is mine),
                 and the leader's buttons on the others' cards (ให้เป็นหัวตี้, ให้ออก) or ออกจากปาร์ตี้ on mine
     right       กติกาปาร์ตี้, only the leader changes it: ของดรอป (ใครเจอคนนั้นได้, ผลัดกันรับ, สุ่มให้สมาชิก, หัวตี้เก็บ)
                 and EXP (ต่างคนต่างได้, แบ่งเท่ากัน); under it the players online to invite
     bottom      the last hand-over line ("มิร่า ได้ วุ้นเรืองแสง ×2 (ผลัดกันรับ)")
   It takes over NC.HUD.panel('party') (P, the menu's P button). */
(function () {
  'use strict';
  const NC = window.NC, PN = NC.PartyNet;
  if (!PN) return;
  const $ = (id) => document.getElementById(id);
  const G = () => NC.game;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const icon = (k) => ((NC.ASSET_MANIFEST || {})[k] || {}).src || '';
  const ART = 'assets/kui/party_camp.jpg', TAU = Math.PI * 2;
  const LOOT_IC = { f: 'ic_lootf', t: 'ic_loott', r: 'ic_lootr', l: 'ic_crown' }, EXP_IC = { o: 'ic_expo', e: 'ic_expe' };
  // where they stand (x as a fraction of the stage, feet y as a fraction) by how many there are: round the fire
  const SPOT_SETS = [null, [[0.34, 0.88]], [[0.32, 0.88], [0.68, 0.88]], [[0.16, 0.9], [0.34, 0.86], [0.7, 0.87]],
    [[0.14, 0.9], [0.32, 0.86], [0.68, 0.86], [0.86, 0.9]]];
  const spotsFor = (n) => SPOT_SETS[Math.max(1, Math.min(4, n))];
  const FIRE = [0.5, 0.95];
  const TONGUES = [[-30, 40, 86, 1.7], [34, 42, 92, 3.1], [0, 62, 138, 0], [-14, 30, 62, 4.4], [18, 28, 56, 5.2]]; // (camp.js)
  const BODY = 1.95, TAG = 0.8;
  const WIDE = 880;
  const fitK = (w, h) => Math.min(1, (400 * w) / (WIDE * h));

  let win = null, stage = null, raf = 0;
  const sparks = [];
  const net = () => NC.Net;
  const online = () => !!(net() && net().room);
  const rem = (peer) => net() && net().remotes.get(peer);
  const looks = new Map();
  function memberLook(peer, remote) {
    if (remote && remote.equip) { looks.set(peer, { eq: remote.equip }); return remote.equip; }
    const social = NC.OnlineStore && NC.OnlineStore.social;
    const live = social && [...(social.online || []), ...(social.friends || [])].find((p) => p.id === peer && p.portrait);
    const portrait = live && live.portrait, w = NC.OnlineWorld, cached = looks.get(peer);
    if (portrait && portrait.equip && w && w.equipOf) {
      const key = JSON.stringify(portrait);
      if (cached && cached.key === key) return cached.eq;
      const eq = w.equipOf(portrait.equip, portrait.appearance ? { hair: 'created' } : null, portrait.appearance);
      // The public portrait has no legs; provide the same base outfit as the channel window.
      if (!eq.pants) eq.pants = 'pants_traveler';
      if (!eq.top) eq.top = 'top_traveler';
      looks.set(peer, { key, eq });
      return eq;
    }
    return cached ? cached.eq : null;
  }
  // who is shown: me, then the others in the party's order (the leader first)
  function people() {
    const g = G(), p = g.player, R = PN.roster(), meP = PN.me();
    const mine = { peer: meP || 'me', me: true, name: p.name || 'คุณ', lv: p.lv, job: p.job, map: g.mapId, eq: NC.lookEquip ? NC.lookEquip(p.equip) : p.equip, hp: p.hp / Math.max(1, p.maxHp) };
    for (const peer of looks.keys()) if (!R || !R.mem.includes(peer)) looks.delete(peer);
    if (!R) return [mine];
    const order = R.mem.slice().sort((a, b) => (a === R.lead ? -1 : b === R.lead ? 1 : 0));
    return order.map((peer) => {
      if (peer === meP) return mine;
      const r = rem(peer);
      const m = PN.member && PN.member(peer);
      if (m) return { peer, name: m.name || PN.nameOf(peer), lv: m.lv, job: m.job, map: m.mapId,
        eq: memberLook(peer, r), hp: m.maxHp > 0 ? m.hp / m.maxHp : 0, dd: !!m.dead, off: m.online === false };
      return r ? { peer, name: r.name, lv: r.lv, job: r.job, map: r.map, eq: r.equip, hp: r.hpPct / 100, dd: r.dd } : { peer, name: 'ผู้เล่น', lv: 0, job: 'traveler', map: null, eq: null, off: true };
    });
  }

  // ---------------- building the window ----------------
  function build() {
    win = document.createElement('div');
    win.id = 'partywin'; win.className = 'kw-panel'; win.hidden = true;
    const radio = (k, ic, name, kind) => `<button class="pw-radio" data-${kind}="${k}"><i></i><img src="${icon(ic)}" alt=""><span>${name}</span></button>`;
    win.innerHTML = '<div class="pw-wrap"><section class="kw-win pw-win">' +
      '<header class="kw-title"><span>ปาร์ตี้</span><span class="pw-count" id="pw-count"></span><button class="kw-x" id="pw-close" aria-label="ปิด">✕</button></header>' +
      '<div class="pw-body"><div class="pw-main">' +
      `<div class="pw-scene" style="background-image:url(${ART})"><canvas id="pw-stage"></canvas><div class="pw-people" id="pw-people"></div></div>` +
      '<div class="pw-slots" id="pw-slots"></div></div>' +
      '<aside class="pw-side"><div class="pw-box pw-rules"><div class="pw-bh"><span>กติกาปาร์ตี้</span><small id="pw-who"></small></div>' +
      '<div class="pw-rb"><div class="pw-rt">ของดรอป</div>' + Object.entries(PN.LOOT).map(([k, n]) => radio(k, LOOT_IC[k], n, 'loot')).join('') +
      '<div class="pw-rt">EXP</div>' + Object.entries(PN.EXPM).map(([k, n]) => radio(k, EXP_IC[k], n, 'exp')).join('') +
      '<div class="pw-rnote" id="pw-rnote"></div></div></div>' +
      '<div class="pw-box pw-inv"><div class="pw-bh"><span>ชวนเข้าปาร์ตี้</span><small id="pw-on"></small></div><div class="pw-list kw-scroll" id="pw-list"></div></div></aside></div>' +
      '<div class="pw-news" id="pw-news"><img src="' + icon('ic_lootf') + '" alt=""><span id="pw-newst"></span></div>' +
      '</section></div>';
    document.body.appendChild(win);
    stage = $('pw-stage');
    $('pw-close').addEventListener('click', close);
    win.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act], [data-loot], [data-exp]');
      if (!b || b.disabled) return;
      const R = PN.roster();
      if (b.dataset.loot) PN.setRule(b.dataset.loot, R && R.exp);
      else if (b.dataset.exp) PN.setRule(R && R.loot, b.dataset.exp);
      else if (b.dataset.act === 'leave') PN.leave();
      else if (b.dataset.act === 'kick') PN.kick(b.dataset.peer);
      else if (b.dataset.act === 'lead') PN.lead(b.dataset.peer);
      else if (b.dataset.act === 'inv') { const r = PN.invite(b.dataset.peer); if (r !== 'ok') G().toast(PN.actionError ? PN.actionError(r) : { full: 'ปาร์ตี้เต็มแล้ว', busy: 'คนนี้อยู่ในปาร์ตี้อื่น', lead: 'หัวตี้เท่านั้นที่ชวนได้', dup: 'ชวนไปแล้ว', off: 'คนนี้ไม่ได้ออนไลน์แล้ว' }[r] || 'ชวนไม่ได้'); }
      render();
    });
    PN.ticks.push(() => { if (win && !win.hidden) render(); });
  }

  // ---------------- open / close ----------------
  function open() { render(); if (!raf) raf = requestAnimationFrame(loop); }
  function close() {
    NC.HUD.panel('party', false);
    const g = G();
    if (g) g.paused = false;
  }
  function fit() {
    const wrap = win.querySelector('.pw-wrap');
    wrap.style.transform = 'translate(-50%, -50%)';
    const k = Math.min(1, (innerWidth - 16) / wrap.offsetWidth, (innerHeight - 16) / wrap.offsetHeight);
    if (k < 1) wrap.style.transform = `translate(-50%, -50%) scale(${k.toFixed(4)})`;
  }
  addEventListener('resize', () => setTimeout(() => { if (win && !win.hidden) { fit(); faces(); } }, 0));
  setInterval(() => { if (win && !win.hidden) render(true); }, 1000); // (the others' maps, levels and HP move on)

  // ---------------- the HTML parts ----------------
  let lastSlots = '', lastList = '', lastLooks = '';
  function render(soft) {
    if (!win || win.hidden) return;
    const g = G(), R = PN.roster(), L = PN.isLeader(), ppl = people(), meP = PN.me();
    $('pw-count').textContent = R ? `สมาชิก ${ppl.length} / ${PN.MAX}` : 'ยังไม่ได้อยู่ปาร์ตี้';
    // the tags over the people
    const sr = stage.getBoundingClientRect(), TG = TAG * fitK(sr.width || 1, sr.height || 1), SP = spotsFor(ppl.length);
    $('pw-people').innerHTML = ppl.map((m, i) => {
      const [x, y] = SP[i], lead = R && R.lead === m.peer;
      return `<div class="pw-person" style="left:${(x * 100).toFixed(2)}%;top:${((y - TG) * 100).toFixed(2)}%;height:${(TG * 100).toFixed(2)}%">` +
        `<span class="pw-tag${m.me ? ' you' : ''}">${lead ? `<img class="pw-crown" src="${icon('ic_crown')}" alt="">` : ''}<b>${esc(m.me ? 'คุณ' : m.name)}</b></span></div>`;
    }).join('');
    // the four places
    let h = '';
    for (let i = 0; i < PN.MAX; i++) {
      const m = ppl[i];
      if (!m) {
        h += '<div class="pw-slot empty"><div class="pw-face"><span class="pw-plus">+</span></div><div class="pw-sname">ว่าง</div>' +
          `<div class="pw-sjob">${online() ? 'ชวนจากรายชื่อด้านขวา' : 'เล่นออนไลน์เพื่อชวนเพื่อน'}</div></div>`;
        continue;
      }
      const lead = R && R.lead === m.peer, same = !m.off && m.map && m.map === g.mapId, J = NC.JOBS[m.job] || {};
      let btns = '';
      if (m.me) btns = R ? `<button class="kw-btn blue pw-sbtn" data-act="leave">${L && R.mem.length === 1 ? 'ยุบปาร์ตี้' : 'ออกจากปาร์ตี้'}</button>` : '';
      else if (L) btns = `<button class="kw-btn blue pw-sbtn" data-act="lead" data-peer="${esc(m.peer)}">ให้เป็นหัวตี้</button><button class="kw-btn grey pw-sbtn" data-act="kick" data-peer="${esc(m.peer)}">ให้ออก</button>`;
      h += `<div class="pw-slot${m.me ? ' you' : ''}${lead ? ' lead' : ''}"><div class="pw-face"><canvas data-face="${i}"></canvas>${lead ? `<img class="pw-fcrown" src="${icon('ic_crown')}" alt="หัวตี้">` : ''}` +
        `${m.dd ? '<span class="pw-badge">หมดแรง</span>' : ''}</div>` +
        `<div class="pw-sname">${esc(m.me ? m.name + ' (คุณ)' : m.name)}</div><div class="pw-sjob">${m.off ? 'ออฟไลน์' : `Lv ${m.lv} · ${esc(J.name || '')}`}</div>` +
        `<div class="pw-smap${same ? ' same' : ''}${m.off ? '' : ' online'}"><i></i>${esc(m.off ? '—' : net() ? net().mapName(m.map) : (NC.MAPS[m.map] || {}).name || '')}</div>` +
        `<div class="pw-hp"><i style="width:${(Math.max(0, Math.min(1, m.hp || 0)) * 100).toFixed(1)}%"></i></div>${btns}</div>`;
    }
    const lookKey = JSON.stringify(ppl.map((m) => [m.peer, m.eq]));
    if (h !== lastSlots) { $('pw-slots').innerHTML = h; lastSlots = h; lastLooks = lookKey; faces(); }
    else if (lookKey !== lastLooks) { lastLooks = lookKey; faces(); }
    // the rules
    const loot = R ? R.loot : 'f', exp = R ? R.exp : 'o';
    for (const b of win.querySelectorAll('[data-loot]')) { b.classList.toggle('on', b.dataset.loot === loot); b.disabled = !L; }
    for (const b of win.querySelectorAll('[data-exp]')) { b.classList.toggle('on', b.dataset.exp === exp); b.disabled = !L; }
    $('pw-who').innerHTML = R ? `<img src="${icon('ic_crown')}" alt="">${L ? 'คุณเป็นหัวตี้' : 'เฉพาะหัวตี้'}` : '';
    const gap = ppl.filter((m) => !m.off && m.lv).map((m) => m.lv), wide = gap.length > 1 && Math.max(...gap) - Math.min(...gap) > PN.GAP;
    $('pw-rnote').textContent = !R ? 'ชวนเพื่อนจากรายชื่อด้านล่างเพื่อเริ่มปาร์ตี้' : exp === 'e'
      ? `แบ่งให้สมาชิกที่อยู่แมพเดียวกัน · ยืนใกล้กันผูกด้ายเชิด${NC.PARTY_RULES ? ` EXP +${Math.round(NC.PARTY_RULES.thread.exp * 100)}% ดรอป +${Math.round(NC.PARTY_RULES.thread.drop * 100)}% ต่อเส้น` : ''}${wide ? ` · เลเวลห่างเกิน ${PN.GAP} ไม่ได้ส่วนแบ่ง` : ''}` // (js/partybonds.js)
      : 'แบ่งเฉพาะสมาชิกที่อยู่แมพเดียวกัน · ยา เหรียญ และของที่เก็บเองไม่แบ่ง';
    // the players online
    renderList(R, L);
    const last = PN.log[PN.log.length - 1];
    $('pw-newst').textContent = last ? last.text : online() ? 'ของที่ได้จากมอนจะแบ่งตามกติกาของหัวตี้ · แชทปาร์ตี้: /p ข้อความ' : 'ปาร์ตี้คือเพื่อนที่ออนไลน์อยู่จริง · เปิดเกมจากลิงก์ออนไลน์เพื่อเจอกัน';
    if (!soft) fit();
  }
  function renderList(R, L) {
    const g = G(), list = net() ? [...net().remotes.values()].filter((r) => r.named) : [];
    list.sort((a, b) => (a.map === g.mapId ? 0 : 1) - (b.map === g.mapId ? 0 : 1) || Math.abs(a.lv - g.player.lv) - Math.abs(b.lv - g.player.lv));
    $('pw-on').textContent = online() ? `ออนไลน์ ${list.length} คน` : 'ออฟไลน์';
    const full = R && R.mem.length >= PN.MAX, can = !R || L;
    let h = '';
    for (const r of list.slice(0, 20)) {
      const mine = R && R.mem.includes(r.peer), other = !mine && r.pt && r.pt[1] > 1, sent = PN.invited(r.peer);
      const a = PN.actionFor && PN.actionFor(r);
      const state = a ? `<button class="kw-btn ${a.disabled ? 'grey' : 'blue'} pw-ibtn" data-act="inv" data-peer="${esc(r.peer)}"${a.disabled ? ' disabled' : ''}${a.tip ? ` title="${esc(a.tip)}"` : ''}>${esc(a.label)}</button>`
        : mine ? '<span class="pw-st in">ในปาร์ตี้</span>' : other ? '<span class="pw-st">อยู่ปาร์ตี้อื่น</span>' : sent ? '<span class="pw-st">รอตอบ…</span>'
        : `<button class="kw-btn blue pw-ibtn" data-act="inv" data-peer="${esc(r.peer)}"${full || !can ? ' disabled' : ''}>ชวน</button>`;
      h += `<div class="pw-row"><canvas data-mini="${esc(r.peer)}" width="96" height="96"></canvas><div class="pw-rn"><b>${esc(r.name)}</b>` +
        `<small>Lv ${r.lv} · ${esc((NC.JOBS[r.job] || {}).name || '')}${r.map === g.mapId ? '' : ' · ' + esc(net().mapName(r.map))}</small></div>${state}</div>`;
    }
    if (!list.length) h = `<div class="pw-empty">${online() ? 'ตอนนี้ยังไม่มีใครออนไลน์' : 'เกมนี้ยังไม่ได้ออนไลน์<br>เปิดจากลิงก์ออนไลน์ของเกมเพื่อเจอเพื่อน'}</div>`;
    if (h !== lastList) {
      $('pw-list').innerHTML = h; lastList = h;
      for (const cv of $('pw-list').querySelectorAll('canvas[data-mini]')) { const r = rem(cv.dataset.mini); if (r) mini(cv, r.equip); }
    }
  }
  // faces (drawn with the rig, like hud.js's portrait)
  const portraits = new WeakMap();
  function face(cv, equip, zoom, headY) {
    if (!equip) return;
    portraits.set(cv, equip);
    drawFace(cv, equip, zoom, headY);
    const sp = NC.Sprites;
    if (sp && sp.of) {
      const names = sp.of.scan(equip);
      if (sp.missing(names)) sp.need(names, 0).then(() => {
        if (cv.isConnected && portraits.get(cv) === equip) drawFace(cv, equip, zoom, headY);
      });
    }
  }
  function drawFace(cv, equip, zoom, headY) {
    const r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    const W = Math.max(1, Math.round(r.width * dpr)), H = Math.max(1, Math.round(r.height * dpr));
    cv.width = W; cv.height = H;
    const c = cv.getContext('2d'), hs = NC.headSpot(equip), k = (Math.min(W, H) * zoom) / hs.w;
    NC.drawAvatar(c, equip, W / 2 - hs.x * k, H * headY - hs.y * k, k, 1, { noWeapon: true, t: 0.3 });
  }
  function mini(cv, equip) {
    const c = cv.getContext('2d'), S = cv.width;
    c.clearRect(0, 0, S, S);
    c.save(); c.beginPath(); c.arc(S / 2, S / 2, S * 0.46, 0, TAU); c.clip();
    c.fillStyle = '#e4f2ff'; c.fillRect(0, 0, S, S);
    const hs = NC.headSpot(equip), k = (S * 0.77) / hs.w;
    NC.drawAvatar(c, equip, S / 2 - hs.x * k, S * 0.58 - hs.y * k, k, 1, { noWeapon: true });
    c.restore();
  }
  function faces() {
    const ppl = people();
    for (const cv of win.querySelectorAll('canvas[data-face]')) { const m = ppl[+cv.dataset.face]; if (m) face(cv, m.eq, 0.8, 0.6); }
  }

  // ---------------- the stage: the fire and the party round it ----------------
  function drawStage(t) {
    const r = stage.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    const W = Math.max(1, Math.round(r.width * dpr)), H = Math.max(1, Math.round(r.height * dpr));
    if (stage.width !== W || stage.height !== H) { stage.width = W; stage.height = H; }
    const c = stage.getContext('2d'), fk = fitK(W, H), k = (H / 400) * fk, fx = W * FIRE[0], fy = H * FIRE[1], R = PN.roster();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, W, H);
    const fl = 1 + 0.05 * Math.sin(t * 7.3) + 0.03 * Math.sin(t * 13.1);
    const gr = c.createRadialGradient(fx, fy - 40 * k, 10 * k, fx, fy - 40 * k, 420 * k * fl);
    gr.addColorStop(0, 'rgba(255,170,80,0.34)'); gr.addColorStop(1, 'rgba(255,140,60,0)');
    c.fillStyle = gr; c.fillRect(0, 0, W, H);
    const ppl = people(), SP = spotsFor(ppl.length);
    const who = ppl.map((m, i) => ({ m, x: SP[i][0], y: SP[i][1], ph: i * 1.3 })).filter((w) => w.m.eq);
    // a ring under the leader, a soft one under me
    for (const w of who) {
      const lead = R && R.lead === w.m.peer;
      if (!lead && !w.m.me) continue;
      const x = W * w.x, y = H * w.y, pulse = 0.75 + 0.25 * Math.sin(t * 3 + w.ph);
      c.save(); c.globalCompositeOperation = 'lighter'; c.lineWidth = 5 * k;
      c.strokeStyle = lead ? `rgba(255,214,110,${0.75 * pulse})` : `rgba(140,205,255,${0.55 * pulse})`;
      c.shadowColor = lead ? 'rgba(255,200,90,0.9)' : 'rgba(120,190,255,0.8)'; c.shadowBlur = 16 * k;
      c.beginPath(); c.ellipse(x, y, 96 * k, 23 * k, 0, 0, TAU); c.stroke();
      c.restore();
    }
    const b = NC.SPR.camp_firebase, V = NC.VFX;
    const drawFire = () => {
      if (!b) return;
      const s = (215 * k) / b.w, bw = b.w * s, bh = b.h * s;
      c.drawImage(b.img, fx - bw * b.ax, fy - bh * (b.ay || 1), bw, bh);
      if (V && V.flame) {
        const cx = fx - bw * b.ax + bw * 0.5, cy = fy - bh * (b.ay || 1) + bh * 0.58;
        for (const [dx, fw, fh, ph] of TONGUES) {
          const flick = 0.84 + 0.16 * Math.sin(t * 5.3 + ph * 2) + 0.06 * Math.sin(t * 13 + ph);
          V.flame(c, cx + dx * s + Math.sin(t * 2.1 + ph) * 3 * s, cy, fw * s, fh * s * flick, t * 7 + ph, V.PAL.fire, 1);
        }
      }
    };
    who.sort((a, b2) => a.y - b2.y);
    let fireDone = false;
    for (const w of who) {
      if (!fireDone && w.y > FIRE[1] - 0.06) { drawFire(); fireDone = true; }
      const x = W * w.x, y = H * w.y, ks = BODY * k;
      c.fillStyle = 'rgba(20,14,30,0.3)';
      c.beginPath(); c.ellipse(x, y, 70 * k, 17 * k, 0, 0, TAU); c.fill();
      const ac = NC.animCtx ? NC.animCtx(w.m.eq) : undefined, Pz = NC.Anim.sample(w.m.dd ? 'sit' : 'idle', t + w.ph, ac);
      Pz.face = w.x < FIRE[0] ? 1 : -1;
      c.save();
      if (w.m.off) c.globalAlpha = 0.45;
      if (!(NC.HeroSpine && NC.HeroSpine.preview && NC.HeroSpine.preview(c, w.m.eq, x, y, ks, { t: t + w.ph, clip: w.m.dd ? 'sit' : 'idle', face: Pz.face, key: 'party' + who.indexOf(w) }))) // (the hero rig, js/herospine.js)
        NC.drawHero(c, w.m.eq, Pz, x, y, { scale: ks });
      c.restore();
    }
    if (!fireDone) drawFire();
    if (Math.random() < 0.35) sparks.push({ x: fx + (Math.random() - 0.5) * 60 * k, y: fy - 70 * k, vx: (Math.random() - 0.5) * 20, vy: -(40 + Math.random() * 50), life: 1.4 + Math.random() });
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.life -= 1 / 60; s.x += (s.vx / 60) * k; s.y += (s.vy / 60) * k; s.vx += Math.sin(t * 3 + i) * 0.6;
      if (s.life <= 0) { sparks.splice(i, 1); continue; }
      c.fillStyle = `rgba(255,${160 + Math.round((60 * s.life) / 2.4)},90,${Math.min(1, s.life)})`;
      c.beginPath(); c.arc(s.x, s.y, 2.4 * k, 0, TAU); c.fill();
    }
    c.restore();
  }
  function loop() {
    raf = 0;
    if (!win || win.hidden) return;
    drawStage(performance.now() / 1000);
    raf = requestAnimationFrame(loop);
  }
  PN.drawWindow = (t) => { if (win && !win.hidden) drawStage(t); }; // (tests: a background tab has no animation frames)
  PN.people = people; // (the party list under the hero's frame shows the same people in the same order: js/partylist.js)

  // ---------------- hooks: P and the menu's P button open this window ----------------
  const baseInit = NC.HUD.init.bind(NC.HUD);
  NC.HUD.init = function (game) { baseInit(game); build(); };
  const basePanel = NC.HUD.panel.bind(NC.HUD);
  NC.HUD.panel = function (id, show) {
    if (win && id === 'party') {
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
    if (e.code !== 'Escape' || !win || win.hidden) return;
    e.stopImmediatePropagation(); e.preventDefault();
    close();
  }, true);
})();
