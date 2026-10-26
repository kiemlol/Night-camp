/* p3_autofarm.js — the auto-farm settings window #autofarm (mockup p3_autofarm A). Built from the picked mockup (UI audit
   round 3, 2026-10-17): a sky-blue title bar with the on/off pill, four cream cards in a 2x2 grid (monsters as portrait
   tiles with a tick, the range as two big rows, the 8 hotbar slots with their key caps, potions + rest as pill groups and
   toggles) and a strip with the note and a big green START.
   autofarm.js keeps its own markup (#af-body, now hidden) and every rule: this file reads that body after each of its
   renders (a MutationObserver: renderWin is inside autofarm.js) and draws the cards in #p3af. The buttons carry the same
   data-* as autofarm.js's chips (data-mon / data-all / data-boss / data-range / data-hp / data-sp / data-rest /
   data-loot), so its click handler changes and saves the settings; the few new buttons (skill slots, use all / basic
   only, START, an empty slot) change NC.Auto.set here and save it under the same key. */
(function () {
  'use strict';
  const NC = window.NC;
  if (!NC || !NC.HUD || !NC.Auto) return;
  const $ = (id) => document.getElementById(id);
  const KEY = 'nightcamp.auto.v1';
  const ICON = {
    mon: 'assets/bible/ic_monbook.png', range: 'assets/ic_map.png', skill: 'assets/ic_skills.png', pot: 'assets/ic_potion.png',
    map: 'assets/ic_map.png', pin: 'assets/craftgo/cg_pin.png',
  };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(NC.Auto.set)); } catch (e) { /* storage blocked */ } };
  const isBoss = (t) => !!(NC.BOSSES && NC.BOSSES[t]);
  const nameOf = (t) => (NC.MONSTERS[t] && NC.MONSTERS[t].name) || t;
  let win = null, box = null, queued = false;
  const seenBoss = {};

  // the bosses of this map (autofarm.js lists their names on one chip; here each gets a tile)
  function bossTypes(game) {
    const m = (seenBoss[game.mapId] = seenBoss[game.mapId] || new Set());
    for (const e of game.enemies) if (e.type && isBoss(e.type)) m.add(e.type);
    for (const r of game.respawns || []) if (r.type && isBoss(r.type)) m.add(r.type);
    return [...m].filter((t) => NC.MONSTERS[t]);
  }
  function thumb(cv, type) {
    const s = NC.SPR[type], c = cv.getContext('2d'), S = cv.width;
    c.clearRect(0, 0, S, S);
    if (!s || !s.img) return;
    const k = Math.min((S * 0.92) / s.img.width, (S * 0.92) / s.img.height);
    c.drawImage(s.img, (S - s.img.width * k) / 2, (S - s.img.height * k) / 2, s.img.width * k, s.img.height * k);
  }
  function skillSrc(S) {
    if (!S) return '';
    if (NC.ASSET_MANIFEST[S.icon]) return NC.ASSET_MANIFEST[S.icon].src;
    return NC.SPR[S.icon] ? NC.SPR[S.icon].src || '' : '';
  }
  const tick = '<span class="p3af-tick" aria-hidden="true"></span>';
  const card = (cls, icon, title, inner) =>
    `<section class="p3af-card ${cls}"><header><span class="p3af-ic"><img src="${icon}" alt=""></span><b>${title}</b></header><div class="p3af-in">${inner}</div></section>`;

  function render() {
    queued = false;
    if (!win || win.hidden || !box) return;
    const game = NC.game, p = game && game.player;
    if (!p) return;
    const S = NC.Auto.set, body = $('af-body');
    // the monsters of this map, as autofarm.js listed them (its own "seen here" list, in its order)
    const mons = body ? [...body.querySelectorAll('[data-mon]')].map((b) => ({
      type: b.dataset.mon, on: b.classList.contains('on'), lv: ((b.querySelector('em') || {}).textContent || '').trim(),
    })) : [];
    const bosses = body && body.querySelector('[data-boss]') ? bossTypes(game) : [];
    const mapName = (NC.MAPS[game.mapId] || {}).name || '';
    const tiles = mons.map((m) => `<button class="p3af-mon${m.on ? ' on' : ''}" data-mon="${esc(m.type)}" title="${esc(nameOf(m.type))}">${tick}` +
      `<canvas width="128" height="128" data-thumb="${esc(m.type)}"></canvas><b>${esc(nameOf(m.type))}</b><em>${esc(m.lv)}</em></button>`)
      .concat(bosses.map((t) => `<button class="p3af-mon boss${S.boss ? ' on' : ''}" data-boss="1" title="ตีบอสด้วย (บอสทุกตัวในแมพนี้)">${tick}` +
        `<i>บอส</i><canvas width="128" height="128" data-thumb="${esc(t)}"></canvas><b>${esc(nameOf(t))}</b><em>${S.boss ? 'ตีด้วย' : 'ไม่ตี'}</em></button>`));
    const n = tiles.length;
    const monIn = `<div class="p3af-sub">มอนที่จะฟาร์ม · ${esc(mapName)}</div>` +
      (n ? `<div class="p3af-mons n${Math.min(n, 9)}">${tiles.join('')}</div>` +
        '<div class="p3af-pair"><button class="p3af-pill blue" data-all="on">ทั้งหมด</button><button class="p3af-pill" data-all="off">ไม่เลือก</button></div>'
        : '<div class="p3af-empty">แมพนี้ไม่มีมอนสเตอร์ · ไปที่ทุ่งล่ามอนก่อนแล้วค่อยเปิดออโต้</div>');
    const rangeIn =
      `<button class="p3af-range${S.range === 'map' ? ' on' : ''}" data-range="map"><span class="p3af-rpic"><img src="${ICON.map}" alt=""></span><b>ทั้งแมพ</b>${tick}</button>` +
      `<button class="p3af-range${S.range === 'near' ? ' on' : ''}" data-range="near"><span class="p3af-rpic ring"><img src="${ICON.pin}" alt=""></span>` +
      `<b>รัศมีรอบตัว</b>${tick}</button>` + NC.Auto.rangeControls('p3af-radius') +
      // (2026-10-19: autofarm.js's share / group / flee; its click handler switches them)
      '<div class="p3af-plays">' +
      `<button class="p3af-tog sm${S.share ? ' on' : ''}" data-share="1" title="ไม่ไล่มอนที่ผู้เล่นอื่น (นอกปาร์ตี้) กำลังตีอยู่"><span>ไม่แย่งมอนคนอื่น</span>${tick}</button>` +
      `<button class="p3af-tog sm${S.group ? ' on' : ''}" data-group="1" title="อยู่ในปาร์ตี้: ล่าใกล้ ๆ หัวตี้ ช่วยตีมอนที่รุมเพื่อน ด้ายเชิดจะได้ขึ้น"><span>เกาะกลุ่มตี้</span>${tick}</button>` +
      `<button class="p3af-tog sm wide${S.flee ? ' on' : ''}" data-flee="1" title="เลือดต่ำกว่า 30% และยังดื่มยาแดงไม่ได้: ถอยออกจากฝูงครู่หนึ่ง แล้วกลับมาสู้ · ไม่มียาเลย: ถอยแล้วนั่งพักจน HP 70% (ปิดตรงนี้ ไม่ถอย ไม่นั่ง)"><span>ถอยเมื่อเลือดน้อยและยังดื่มยาไม่ได้</span>${tick}</button></div>`;
    const keys = NC.HOTKEYS || ['q', 'e', 'r', 'f'];
    const slots = keys.map((k) => {
      const id = NC.skillForKey(p, k), Sk = id && NC.SKILLS[id], src = skillSrc(Sk);
      if (!Sk) return `<button class="p3af-slot empty" data-p3slot="${k}" title="ช่องว่าง"><i>${k.toUpperCase()}</i><span class="p3af-sk"></span>${tick}</button>`;
      const on = S.skills && S.slots[k] !== false;
      return `<button class="p3af-slot${on ? ' on' : ''}${S.skills ? '' : ' off'}" data-p3slot="${k}" title="${esc(Sk.name || '')}"><i>${k.toUpperCase()}</i>` +
        `<span class="p3af-sk">${src ? `<img src="${src}" alt="">` : ''}</span>${tick}</button>`;
    }).join('');
    const allOn = S.skills && keys.every((k) => S.slots[k] !== false);
    const skillIn = `<div class="p3af-slots">${slots}</div>` +
      `<div class="p3af-pair"><button class="p3af-pill${allOn ? ' blue' : ''}" data-p3="useall">ใช้ทุกสกิล</button>` +
      `<button class="p3af-pill${S.skills ? '' : ' blue'}" data-p3="basic">ตีธรรมดาอย่างเดียว</button></div>`;
    const pct = (v) => (v ? Math.round(v * 100) + '%' : 'ไม่ใช้');
    const potIn =
      '<div class="p3af-lbl">ดื่มยาแดงเมื่อ HP ต่ำกว่า</div><div class="p3af-pills">' +
      [0, 0.3, 0.5, 0.7].map((v) => `<button class="p3af-pill${S.hpPot === v ? ' blue' : ''}" data-hp="${v}">${pct(v)}</button>`).join('') + '</div>' +
      '<div class="p3af-lbl">ดื่มยาฟ้าเมื่อ SP ต่ำกว่า</div><div class="p3af-pills">' +
      [0, 0.2, 0.4].map((v) => `<button class="p3af-pill${S.spPot === v ? ' blue' : ''}" data-sp="${v}">${pct(v)}</button>`).join('') + '</div>' +
      `<button class="p3af-tog${S.rest ? ' on' : ''}" data-rest="1"><span>นั่งพักเมื่อ HP/SP ต่ำและยาหมด (ไม่มีมอนใกล้ ๆ)</span>${tick}</button>` +
      // (2026-10-19: the drops after the fight round the hero / at once / never; autofarm.js's data-lootw)
      '<div class="p3af-lootrow"><span class="p3af-lbl">เก็บของ</span>' +
      [['fight', 'ตีก่อนแล้วเก็บ', 'ล้างมอนรอบตัวให้หมดก่อน แล้วกวาดเก็บของทีเดียว'], ['near', 'เก็บทันที', 'ของที่ใกล้กว่ามอนตัวถัดไป เก็บก่อน (แบบเดิม)'], ['off', 'ไม่เก็บ', 'ไม่เดินไปเก็บของดรอป']]
        .map(([v, t, tip]) => `<button class="p3af-pill${(v === 'off' ? !S.loot : S.loot && (S.lootWhen === 'near' ? 'near' : 'fight') === v) ? ' blue' : ''}" data-lootw="${v}" title="${tip}">${t}</button>`).join('') +
      '</div>';
    // the support mode of a support job (js/autosupport.js): its own four cards in the same frame
    if (NC.AutoSupport && NC.AutoSupport.active(game)) { box.innerHTML = NC.AutoSupport.cards(game, { card, tick, esc, potIn }); NC.AutoSupport.drawn(box); return; }
    const on = NC.Auto.on;
    box.innerHTML = '<div class="p3af-grid">' +
      card('c-mon', ICON.mon, 'มอนสเตอร์', monIn) + card('c-range', ICON.range, 'ระยะล่า', rangeIn) +
      card('c-skill', ICON.skill, 'สกิล', skillIn) + card('c-pot', ICON.pot, 'ยาและการพัก', potIn) + '</div>' +
      '<div class="p3af-foot"><div class="p3af-note"><span>กด <b>Z</b> หรือปุ่ม AUTO เปิด/ปิด · เดินเอง (WASD) คลิกตีเอง เปลี่ยนแมพ หรือหมดแรง = หยุด · สู้กลับมอนในขอบเขตที่เลือก</span></div>' +
      `<button class="p3af-go${on ? ' stop' : ''}" data-p3="go">${on ? 'หยุดฟาร์ม' : 'เริ่มฟาร์ม'}</button></div>`;
    box.querySelectorAll('canvas[data-thumb]').forEach((cv) => thumb(cv, cv.dataset.thumb));
  }
  // the window fits the screen: on a short one (--u follows the height) it was taller than its 96vh and scrolled, and the
  // thin blue bar of that scroll stood on the bare ground while the radius was dragged (Discord #128). --m is made
  // smaller until it fits (#p3af's side margin is 10 --m: the size in use).
  function fit() {
    if (!win || win.hidden || !box) return;
    const cardEl = win.querySelector('.card');
    win.style.removeProperty('--m');
    for (let i = 0; i < 4 && cardEl.scrollHeight > cardEl.clientHeight + 1; i++) {
      const m = parseFloat(getComputedStyle(box).marginLeft) / 10;
      if (!(m > 0)) break;
      win.style.setProperty('--m', (m * Math.pow(cardEl.clientHeight / cardEl.scrollHeight, 1.15)).toFixed(4) + 'px');
    }
  }
  const later = () => { if (!queued) { queued = true; Promise.resolve().then(() => { render(); fit(); }); } };
  NC.P3AF = { render: later }; // (js/autosupport.js: draw again after a change of its own)

  // the buttons this file adds (the others are autofarm.js's own data-* and reach its handler first)
  function onClick(ev) {
    const b = ev.target.closest('button');
    if (!b || !box || !box.contains(b)) return;
    const game = NC.game, p = game && game.player, S = NC.Auto.set, d = b.dataset;
    if (!p) return;
    if (d.p3slot) {
      const k = d.p3slot, id = NC.skillForKey(p, k);
      if (!id || !NC.SKILLS[id]) { game.toast(`ช่อง ${k.toUpperCase()} ว่างอยู่ · ใส่สกิลลงแถบได้ที่หน้าสกิล (กด K)`); return; }
      if (!S.skills) { S.skills = true; S.slots[k] = true; } else S.slots[k] = S.slots[k] === false;
    } else if (d.p3 === 'useall') { S.skills = true; S.slots = {}; }
    else if (d.p3 === 'basic') S.skills = false;
    else if (d.p3 === 'go') {
      if (NC.Auto.on) { NC.Auto.toggle(game); render(); return; }
      NC.HUD.panel('autofarm', false); game.paused = false; // (start and watch him go)
      NC.Auto.toggle(game);
      if (!NC.Auto.on) game.toast('เริ่มออโต้ฟาร์มไม่ได้ตอนหมดแรง');
      return;
    } else { if (d.mon || d.all || d.boss || d.range || d.hp || d.sp || d.rest || d.loot || d.lootw || d.share || d.group || d.flee) later(); return; }
    save(); render(); fit();
  }

  const baseInit = NC.HUD.init.bind(NC.HUD);
  NC.HUD.init = function (game) {
    baseInit(game);
    win = $('autofarm');
    const cardEl = win && win.querySelector('.card'), body = $('af-body');
    if (!cardEl || !body) return;
    cardEl.classList.add('p3af-win');
    box = document.createElement('div');
    box.id = 'p3af';
    body.after(box);
    win.addEventListener('click', onClick); // (after autofarm.js's own handler, which saves its settings first)
    // autofarm.js re-renders #af-body after every change and when the window opens: draw the cards again then
    new MutationObserver(later).observe(body, { childList: true });
    const onoff = $('af-onoff');
    if (onoff) new MutationObserver(later).observe(onoff, { childList: true, characterData: true, subtree: true });
    addEventListener('resize', () => { if (win && !win.hidden) later(); });
    later();
  };
})();
