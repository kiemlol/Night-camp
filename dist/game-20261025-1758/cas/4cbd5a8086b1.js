/* p3_frienddetail.js — ดูรายละเอียดเพื่อน: a click on a person's card on the journal's เพื่อน page (J → เพื่อน, js/p3_jsocial.js)
   opens their page IN PLACE, mockup B the user picked (2026-10-18: "เอาแบบ B (หน้าตัวละครในสมุด) สร้างจริงเลย";
   assets/gen/nightcamp_fd_b_raw.png, assets/gen/make_frienddetail_prompts.py):
     left   "‹ เพื่อน" back, the hero standing big and breathing (drawn live from their look with NC.drawAvatar, like the bag's
            character window) and what they wear in slots around them: หมวก แว่น ผ้าคลุม | เสื้อ (ชุดยาว) กางเกง | อาวุธ แฟชั่น
     right  a dark card: the name + online dot, Lv · job, guild (its gem in the guild's colour), party, place; two record tiles
            (the shared tower หอดาวร่วง's floor this week, or the Dark Root floor while they are down there; the collection
            book's count) and a chip when their shop is open; the buttons ชวนเข้าปาร์ตี้ (NC.PartyNet.invite) · กระซิบ (the chat
            with "/w name ") · ไปหาเพื่อน (the guiding flame, NC.Econ.warp) · ดวล (NC.PvP.challenge: same map, near) · ลบเพื่อน
            (press twice) or เพิ่มเพื่อน for someone who is not a friend yet (every card on the page opens, all three columns).
   Only what the game knows of another hero is shown: net.js presence (eq + the costume layer lk, nm, lv, jb, mp) and its
   fields gu (guild.js), pt (partynet.js), pf (social.js), rk (season.js: [lv, หอดาวร่วง floor this week, collection count]),
   rt (darkroot.js: a run's floor), sh (vend.js → r.shop). Accessories, stats and refines don't travel, so they aren't here.
   A friend who is offline shows the look, level and place last seen (p3_jsocial.js's record), greyed, with only ลบเพื่อน.
   Wraps NC.Hub.tab('friends') render + click again (after p3_jsocial.js). css/p3_frienddetail.css. Tests: TF.fd. */
(function () {
  'use strict';
  const NC = window.NC, H = NC.Hub;
  const TF = H && H.tab ? H.tab('friends') : null;
  if (!TF || !NC.Social || !TF.p3) return;
  const esc = H.esc, G = () => NC.game, ITEMS = NC.ITEMS;
  const baseRender = TF.render, baseClick = TF.click;
  const S = () => NC.Social.state;
  const net = () => NC.Net;
  const people = () => (net() && net().remotes ? [...net().remotes.values()].filter((r) => r.named) : []);
  const jobName = (j) => ((NC.JOBS || {})[j] || {}).name || '';
  const mapName = (id) => ((NC.MAPS || {})[id] && NC.MAPS[id].name) || id || '';
  const num = (n) => Math.round(n || 0).toLocaleString('en-US');
  const toast = (g, t) => { if (g && g.toast) g.toast(t); };
  const man = (k) => ((NC.ASSET_MANIFEST || {})[k] || {}).src || '';
  const IC = {
    party: 'assets/ic_party.png', map: 'assets/ic_map.png', book: 'assets/bible/ic_collection.png', guild: 'assets/bible/ic_guild.png',
    root: 'assets/root/rt_gate.png', star: 'assets/bible/ic_rank.png', shop: 'assets/shop/shop_stall.png',
    fire: 'assets/kui/ic_pfire.png', duel: 'assets/ic_sword.png',
  };
  const ago = (t) => {
    const m = Math.floor((Date.now() - t) / 60000);
    return m < 1 ? 'เมื่อสักครู่' : m < 60 ? `${m} นาทีก่อน` : m < 1440 ? `${Math.floor(m / 60)} ชั่วโมงก่อน` : `${Math.floor(m / 1440)} วันก่อน`;
  };

  // who is open: { name, peer } (peer = the online player it was opened from; a friend is found again by name)
  let who = null, armRm = 0, raf = 0, lastD = '';
  const live = (w) => {
    const all = people();
    return (w.peer && all.find((r) => r.peer === w.peer && r.name === w.name)) || all.find((r) => r.name === w.name) || null;
  };
  const isFriend = (name) => (S().friends || []).includes(name);
  function personOf(key) {
    const k = key.slice(0, 1), v = key.slice(2);
    if (k === 'f') return v ? { name: v, peer: null } : null;
    const r = net() && net().remotes ? net().remotes.get(v) : null;
    return r && r.named ? { name: r.name, peer: v } : null;
  }

  // ---------------- the cards on the list open the page ----------------
  function markCards(el) {
    for (const card of el.querySelectorAll('.p3f-card')) {
      const cv = card.querySelector('canvas[data-pt]'), unf = card.querySelector('[data-unf]');
      const key = cv ? cv.dataset.pt : unf ? 'f:' + unf.dataset.unf : '';
      if (!key) continue;
      card.dataset.fd = key;
      card.title = 'คลิกเพื่อดูรายละเอียด';
    }
  }

  // ---------------- the page ----------------
  // the worn slots, around the hero as in the mockup (left column, right column, under the feet)
  const SLOTS = [['hat', 'หมวก', 'L'], ['glasses', 'แว่น', 'L'], ['cape', 'ผ้าคลุม', 'L'], ['top', 'เสื้อ', 'R'], ['pants', 'กางเกง', 'R'],
    ['weapon', 'อาวุธ', 'B'], ['fashion', 'แฟชั่น', 'B']];
  function slotHtml(eq, key, label) {
    let id = null, lbl = label, covered = false, extra = '';
    if (eq) {
      if (key === 'top' && eq.robe) { id = eq.robe; lbl = 'ชุดยาว'; }
      else if (key === 'fashion') {
        id = eq.frobe || eq.fhat || null;
        if (eq.frobe && eq.fhat && ITEMS[eq.fhat]) extra = `<canvas class="p3d-sub" data-ic="${esc(eq.fhat)}" width="64" height="64"></canvas>`; // (both: the hat rides in the corner)
      } else id = eq[key] || null;
      if (key === 'pants' && eq.robe) covered = true;
    }
    const it = id && ITEMS[id];
    const names = [it && it.name, key === 'fashion' && eq && eq.frobe && eq.fhat && ITEMS[eq.fhat] ? ITEMS[eq.fhat].name : ''].filter(Boolean).join(' + ');
    const tip = it ? `${lbl}: ${names}${covered ? ' (อยู่ใต้ชุดยาว)' : ''}` : `${lbl}: ว่าง`;
    return `<div class="p3d-slot${covered ? ' covered' : ''}" title="${esc(tip)}"><span class="p3d-box ${it ? 'r-' + esc(it.rarity || 'common') : 'empty'}">` +
      (it ? `<canvas data-ic="${esc(id)}" width="128" height="128"></canvas>` : '') + extra + '</span>' +
      `<span class="p3d-lbl"><b>${lbl}</b><i>${it ? esc(names) : '(ว่าง)'}</i></span></div>`;
  }

  function guildRow(r) {
    const gu = r && Array.isArray(r.gu) ? r.gu : null;
    if (!gu) return `<div class="p3d-r dim"><img src="${IC.guild}" alt=""><span>${r ? 'ยังไม่มีกิลด์' : 'กิลด์: ไม่รู้ (ออฟไลน์)'}</span></div>`;
    const col = /^#[0-9a-f]{6}$/i.test(gu[2] || '') ? gu[2] : '#7c6ad6', gem = man('gem_' + Math.max(0, Math.min(11, gu[3] | 0)));
    return `<div class="p3d-r"><span class="p3d-gem" style="background:${col}">${gem ? `<img src="${gem}" alt="">` : ''}</span><span>${esc(gu[1] || 'กิลด์')}${gu[4] ? ` <small>Lv ${gu[4] | 0}</small>` : ''}</span></div>`;
  }
  function partyRow(r) {
    if (!r) return `<div class="p3d-r dim"><img src="${IC.party}" alt=""><span>ปาร์ตี้: ไม่รู้ (ออฟไลน์)</span></div>`;
    const PN = NC.PartyNet, R = PN && PN.roster(), mine = R && R.mem.includes(r.peer), MAX = (PN && PN.MAX) || 4;
    const n = r.pt && r.pt[0] && r.pt[1] > 0 ? r.pt[1] : mine ? R.mem.length : 0;
    const t = mine ? `ปาร์ตี้เดียวกับคุณ ${n}/${MAX}` : n ? `อยู่ในปาร์ตี้ ${n}/${MAX}` : r.pf ? 'กำลังหาปาร์ตี้' : 'ยังไม่มีปาร์ตี้';
    return `<div class="p3d-r${n || r.pf ? '' : ' dim'}"><img src="${IC.party}" alt=""><span>${t}</span></div>`;
  }
  function placeRow(r, o, game) {
    if (r) return `<div class="p3d-r"><img src="${IC.map}" alt=""><span>${esc(mapName(r.map))}${r.map === game.mapId ? ' <small>แมพเดียวกับคุณ</small>' : ''}</span></div>`;
    return `<div class="p3d-r dim"><img src="${IC.map}" alt=""><span>${o ? `${esc(mapName(o.map))} <small>เห็นล่าสุด ${ago(o.t)}</small>` : 'ยังไม่เคยเห็นออนไลน์'}</span></div>`;
  }
  function tiles(r) {
    if (!r) return '';
    let h = '';
    const rk = Array.isArray(r.rk) ? r.rk : null;
    if (r.rt && r.rt[0] && r.rt[1]) h += `<div class="p3d-tile"><img src="${IC.root}" alt=""><span>รากต้นไม้มืด<br>กำลังลงชั้น ${r.rt[1] | 0}</span></div>`;
    else h += `<div class="p3d-tile${rk && rk[1] ? '' : ' dim'}"><img src="${IC.star}" alt=""><span>หอดาวร่วง<br>${rk && rk[1] ? `ชั้น ${num(rk[1])} สัปดาห์นี้` : 'ยังไม่ขึ้นสัปดาห์นี้'}</span></div>`;
    if (rk) h += `<div class="p3d-tile"><img src="${IC.book}" alt=""><span>สมุดสะสม · ${num(rk[2])} ชิ้น</span></div>`;
    const sh = r.shop;
    if (sh && Array.isArray(sh.items)) h += `<div class="p3d-chip" title="${esc(sh.title || '')}"><img src="${IC.shop}" alt=""><span>เปิดร้านอยู่ · ${num(sh.items.length)} ชิ้น</span></div>`;
    return h;
  }
  const btn = (cls, label, attrs, off, tip, img) =>
    `<button class="kw-btn ${cls} p3d-b"${attrs ? ' ' + attrs : ''}${off ? ' disabled' : ''}${tip ? ` title="${esc(tip)}"` : ''}>${img ? `<img src="${img}" alt="">` : ''}${label}</button>`;
  function buttons(r, fr, game) {
    const PN = NC.PartyNet, offTip = 'เพื่อนออฟไลน์อยู่';
    let h = '';
    // ชวนเข้าปาร์ตี้ (partynet's answers, like the list's cards)
    if (!r) h += btn('blue', 'ชวนเข้าปาร์ตี้', '', true, offTip);
    else if (!PN) h += btn('blue', 'ชวนเข้าปาร์ตี้', '', true, 'ชวนปาร์ตี้ได้เมื่อเล่นออนไลน์');
    else if (PN.actionFor) {
      const a = PN.actionFor(r);
      h += btn(a.disabled ? 'grey' : 'blue', esc(a.label), `data-inv="${esc(r.peer)}"`, a.disabled, a.tip);
    }
    else {
      const R = PN.roster(), mine = R && R.mem.includes(r.peer), other = !mine && r.pt && r.pt[1] > 1;
      if (mine) h += btn('blue', 'อยู่ปาร์ตี้เดียวกันแล้ว', '', true);
      else if (other) h += btn('blue', 'อยู่ปาร์ตี้อื่นแล้ว', '', true);
      else if (PN.invited(r.peer)) h += btn('blue', 'ชวนแล้ว รอเขาตอบ…', '', true);
      else h += btn('blue', 'ชวนเข้าปาร์ตี้', `data-inv="${esc(r.peer)}"`);
    }
    h += btn('blue', 'กระซิบ', r ? 'data-fdw="1"' : '', !r, r ? `พิมพ์ /w ${who.name} ข้อความ` : offTip);
    // ไปหาเพื่อน: the guiding flame (economy.js's own warp and price)
    const goLbl = fr ? 'ไปหาเพื่อน' : 'ไปหาเขา';
    if (!r) h += btn('gold', goLbl, '', true, offTip, IC.fire);
    else if (r.map === game.mapId) h += btn('gold', 'อยู่แมพเดียวกันแล้ว', '', true, '', IC.fire);
    else h += btn('gold', goLbl, NC.Econ ? `data-go="${esc(r.map)}"` : '', !NC.Econ, `วาร์ปไป${mapName(r.map)} ด้วยลูกไฟนำทาง`, IC.fire);
    // ดวล (pvp.js: the same map and near; on the arena map a best-of-3 match)
    const duelOk = r && NC.PvP && NC.PvP.challenge && r.map === game.mapId;
    h += btn('blue', 'ดวล', duelOk ? `data-fdduel="${esc(r.peer)}"` : '', !duelOk, !r ? offTip : r.map !== game.mapId ? 'ดวลได้เมื่ออยู่แมพเดียวกัน' : 'ท้าดวล (ต้องอยู่ใกล้กัน)', IC.duel);
    // ลบเพื่อน (twice: the second press is social.js's own data-unf) / เพิ่มเพื่อน
    if (fr) h += armRm > Date.now() ? btn('red', 'กดอีกครั้งเพื่อลบเพื่อน', `data-unf="${esc(who.name)}"`, false, '', '') : btn('grey', 'ลบเพื่อน', 'data-fdrm="1"');
    else h += btn('blue', 'เพิ่มเพื่อน', `data-add="${esc(who.name)}"`, !r);
    return h;
  }

  function renderDetail(el, game) {
    const r = live(who), fr = isFriend(who.name), o = r ? null : TF.p3.seen()[who.name] || null;
    const eq = r ? r.equip : o && o.eq;
    const lv = r ? r.lv : o && o.lv, job = r ? r.job : o && o.job;
    let h = `<div class="p3d${r ? '' : ' off'}"><div class="p3d-doll">` +
      `<canvas class="p3d-hero"></canvas>${eq ? '' : '<span class="p3d-q">?</span>'}` +
      '<button class="kw-btn blue p3d-back" data-fdback="1">‹ เพื่อน</button>';
    for (const col of ['L', 'R', 'B']) h += `<div class="p3d-col ${col}">` + SLOTS.filter((s) => s[2] === col).map((s) => slotHtml(eq, s[0], s[1])).join('') + '</div>';
    h += '</div><aside class="p3d-card">' +
      `<div class="p3d-nm"><b>${esc(who.name)}</b><i class="p3d-dot${r ? ' on' : ''}" title="${r ? 'ออนไลน์อยู่' : 'ออฟไลน์'}"></i>${r ? '' : '<em>ออฟไลน์</em>'}</div>` +
      `<div class="p3d-lv">${lv ? `Lv ${lv | 0}${jobName(job) ? ' · ' + esc(jobName(job)) : ''}` : 'ยังไม่รู้เลเวล'}</div>` +
      `<div class="p3d-rows">${guildRow(r)}${partyRow(r)}${placeRow(r, o, game)}</div>` +
      `<div class="p3d-mid">${r ? tiles(r) : '<p class="p3d-offnote">ข้อมูลจะกลับมาเมื่อเพื่อนออนไลน์ · ปุ่มต่าง ๆ ใช้ได้ตอนเขาอยู่ในเกม</p>'}</div>` +
      `<div class="p3d-bs">${buttons(r, fr, game)}</div></aside></div>`;
    el.innerHTML = h;
    for (const cv of el.querySelectorAll('canvas[data-ic]')) {
      try { cv.getContext('2d').drawImage(NC.itemIcon(cv.dataset.ic, cv.width), 0, 0); } catch (e) { console.warn('p3_frienddetail: icon', e); }
    }
    TF.p3.mark(game); // (the list's own 1 s check stays quiet while this page shows)
    lastD = dsig(game);
    drawHero();
    if (!raf) raf = requestAnimationFrame(loop);
  }

  // ---------------- the hero, breathing ----------------
  function drawHero() {
    const cv = who && document.querySelector('#hb-page .p3d-hero');
    if (!cv) return false;
    const r = live(who), o = r ? null : TF.p3.seen()[who.name], eq = r ? r.equip : o && o.eq;
    const b = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    const W = Math.max(1, Math.round(b.width * dpr)), Hh = Math.max(1, Math.round(b.height * dpr));
    if (cv.width !== W || cv.height !== Hh) { cv.width = W; cv.height = Hh; }
    const c = cv.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, W, Hh);
    if (!eq || !NC.drawAvatar) return true;
    // the mockup: feet at 74% of the slot area's height, a little right of its middle, the body ~2.75 px a world unit
    const k = Hh / 236, fx = W * 0.52, fy = Hh * 0.745;
    c.fillStyle = 'rgba(42,36,53,0.14)';
    c.beginPath(); c.ellipse(fx, fy, 56 * k, 8.5 * k, 0, 0, Math.PI * 2); c.fill();
    const moves = (r && r.moves) || { idle: 'idle', set: 'basic' };
    let idle;
    try { idle = NC.Anim.movesFor(moves, ITEMS[eq.weapon]).idle; } catch (e) { idle = undefined; }
    try { NC.drawAvatar(c, eq, fx, fy, k, 1, { t: performance.now() / 1000, idle }); } catch (e) { console.warn('p3_frienddetail: hero', e); }
    return true;
  }
  function loop() {
    raf = 0;
    if (!who || !H.isOpen() || H.page !== 'friends') return;
    if (drawHero()) raf = requestAnimationFrame(loop);
  }

  // what the page shows: redraw while open when it changes (someone moves, levels, changes clothes, answers an invite)
  function dsig(game) {
    const r = who && live(who), PN = NC.PartyNet, R = PN && PN.roster();
    return JSON.stringify([who, !!r, r && [r.lv, r.job, r.map, r.equip, r.gu, r.pt, r.pf, r.rk, r.rt && r.rt.slice(0, 2), r.shop && r.shop.items && r.shop.items.length,
      PN ? PN.invited(r.peer) : 0, PN && PN.actionFor && PN.actionFor(r)], R, S().friends, game && game.mapId, armRm > Date.now()]);
  }
  setInterval(() => {
    if (!who) return;
    const g = G();
    if (!g || !H.isOpen() || H.page !== 'friends') { who = null; armRm = 0; return; } // (closed or another page: next time the list)
    if (dsig(g) !== lastD) H.refresh();
  }, 500);

  function whisper(g, name) {
    NC.HUD.panel('journal', false); g.paused = false;
    setTimeout(() => {
      const i = document.getElementById('cw-text');
      if (!i) { toast(g, `พิมพ์ /w ${name} ข้อความ ในแชท`); return; }
      i.value = `/w ${name} `; i.focus();
      try { i.setSelectionRange(i.value.length, i.value.length); } catch (e) { /* (some inputs) */ }
    }, 60);
  }

  TF.render = function (el, game) {
    if (who && !live(who) && !isFriend(who.name)) { toast(game, `${who.name} ออกจากเกมไปแล้ว`); who = null; } // (not a friend and gone)
    if (who) { renderDetail(el, game); return; }
    baseRender.call(this, el, game);
    markCards(el);
  };
  TF.click = function (e, game) {
    const g = game || G();
    if (!who) {
      const card = e.target.closest('.p3f-card[data-fd]');
      if (card && !e.target.closest('button')) { const w = personOf(card.dataset.fd); if (w) { who = w; armRm = 0; document.getElementById('hb-page').scrollTop = 0; return true; } }
      return baseClick.call(this, e, game);
    }
    if (e.target.closest('[data-fdback]')) { who = null; armRm = 0; return true; }
    if (e.target.closest('[data-fdw]')) { whisper(g, who.name); return false; }
    const du = e.target.closest('[data-fdduel]');
    if (du) {
      const res = NC.PvP.challenge(du.dataset.fdduel);
      if (res === 'ok') { NC.HUD.panel('journal', false); g.paused = false; return false; } // (pvp.js says it sent the challenge)
      toast(g, { off: 'คนนี้ไม่ได้ออนไลน์แล้ว', busy: 'กำลังดวลอยู่', far: 'เข้าไปใกล้กันก่อน แล้วค่อยท้าดวล', dup: 'ท้าไปแล้ว รอเขาตอบ' }[res] || 'ท้าดวลไม่ได้');
      return true;
    }
    if (e.target.closest('[data-fdrm]')) { armRm = Date.now() + 3000; return true; }
    if (e.target.closest('[data-unf]')) armRm = 0;
    return baseClick.call(this, e, game); // (p3_jsocial / social.js: ชวน, ไปหาเพื่อน, ลบ, เพิ่มเพื่อน)
  };
  TF.fd = { open(name, peer) { who = { name, peer: peer || null }; armRm = 0; H.open('friends'); H.refresh(); }, close() { who = null; H.refresh(); }, get who() { return who; }, draw: drawHero }; // (tests)
})();
