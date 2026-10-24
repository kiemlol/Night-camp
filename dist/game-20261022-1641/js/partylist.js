/* partylist.js — the party list under the hero's frame, laid out like the user's reference (2026-10-19, a phone game's
   party list: "ปรับ ui ให้หน่อยๆ ของปาร์ตี้ๆ ให้ได้แบบนี้เลยๆ ในธีมเราๆ"), drawn in our HUD's look (the hero frame's plum
   glass, the gold ring, the ink outline, Mitr words and 'Baloo 2' numbers):
     header   a pill "ปาร์ตี้ n/MAX" with the menu's party icon (assets/ic_party.png), and a round chevron beside it that
              folds the cards away; the choice is kept per browser (localStorage, nightcamp.partylist.fold)
     cards    one per member, me too (a soft green ring, my name green), in the roster's order (the leader first, as
              the party window: PN.people() of js/partywin.js): a round portrait over the card's left edge (the head
              drawn with the rig), the job's badge at its foot (its class icon from NC.CLASSES, the one the class
              picker shows, on a disc in the job's own number colour NC.DmgFX.JOBCOL), a crown before the leader's
              name, "Lv.N", a slim HP bar (red under 30%, empty when fallen) and one short word top right:
                ต่างแมพ  on another map (the map's name in its tooltip)
                ออกห่าง  on my map but past the party thread's reach (NC.PARTY_RULES.thread.reach of js/partybonds.js,
                         600 until that file is in)
                หมดแรง   fallen            ออฟไลน์  gone from the game          (nothing while near)
   One list for both games: offline (js/partynet.js over net.js) and ?online (js/online/social.js from self.party)
   answer NC.PartyNet the same way, so this file only reads it: no party rules or data here. It shows while I am in a
   party with someone else (alone: hidden, as before). The AI friends' test rows (js/party.js, ?aiparty) keep hud2.css's
   .pm look. Placed by hud2.css / mobile.css / online.css (.partybox), and under the lessons' tracker or the phone's
   hero frame when they reach lower (what online/social.js did for its list). Look: css/partylist.css. */
(function () {
  'use strict';
  const NC = window.NC, PN = NC.PartyNet;
  if (!PN) return;
  const $ = (id) => document.getElementById(id);
  const G = () => NC.game;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const icon = (k) => ((NC.ASSET_MANIFEST || {})[k] || {}).src || `assets/${k}.png`;
  const TICK_MS = 250, LOW_HP = 0.3, THREAD_REACH = 600, GAP_PX = 8, FACE_PX = 112, BADGE_PX = 64;
  const MIN_FIT = 0.7, BOTTOM_ROOM = 0.09; // (the list shrinks to the room left, to 70% at most: smaller is unreadable; the EXP bars' strip)
  const FLOOR_SEL = '#hud .chatwin, #mb-items > *, #mb-chat, #mb-exp';
  const FOLD_KEY = 'nightcamp.partylist.fold', FALLBACK_ICON = 'sword', FALLBACK_COLOUR = '#ffd873';
  const reach = () => (NC.PARTY_RULES && NC.PARTY_RULES.thread && NC.PARTY_RULES.thread.reach) || THREAD_REACH;
  const mapName = (id) => (NC.Net && NC.Net.mapName ? NC.Net.mapName(id) : (NC.MAPS[id] || {}).name || id || '');
  const CHEVRON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="o" d="M6 15l6-6 6 6"/><path class="f" d="M6 15l6-6 6 6"/></svg>';

  // ---------------- folded or not (per browser; storage may throw in a private window: then this visit only) ----------------
  function readFold() {
    try { return localStorage.getItem(FOLD_KEY) === '1'; } catch (e) { console.warn('partylist: fold not read', e); return false; }
  }
  function saveFold(on) {
    try { localStorage.setItem(FOLD_KEY, on ? '1' : '0'); } catch (e) { console.warn('partylist: fold not kept', e); }
  }

  // ---------------- what each card says ----------------
  function statusOf(m, dd, g) {
    if (m.off) return { text: 'ออฟไลน์', kind: 'off' };
    if (dd) return { text: 'หมดแรง', kind: 'down' };
    if (m.me) return null;
    if (m.map && m.map !== g.mapId) return { text: 'ต่างแมพ', kind: 'map', tip: mapName(m.map) };
    const w = PN.where && PN.where(m.peer);
    if (w && Number.isFinite(w.x) && Number.isFinite(w.y) && Math.hypot(w.x - g.player.x, w.y - g.player.y) > reach()) return { text: 'ออกห่าง', kind: 'far' };
    return null;
  }
  // the members as cards: new objects (PN.people's own are left alone)
  function cardsNow() {
    const g = G(), R = PN.roster && PN.roster();
    if (!g || !g.player || !R || !PN.people) return [];
    return PN.people().map((m) => {
      const dd = m.me ? g.player.dead > 0 : !!m.dd;
      return Object.assign({}, m, { lead: R.lead === m.peer, dd, word: statusOf(m, dd, g) });
    });
  }
  // the job's badge: the class icon of the job, or of the job it grew from
  function classIcon(job) {
    const line = NC.jobLine ? NC.jobLine(job) : [job];
    for (const j of line) {
      const J = NC.JOBS[j], C = J && (NC.CLASSES || []).find((c) => c.id === J.cls);
      if (C && C.icon && NC.ITEMS[C.icon]) return C.icon;
    }
    return NC.ITEMS[FALLBACK_ICON] ? FALLBACK_ICON : null;
  }
  const jobColour = (job) => (NC.DmgFX && NC.DmgFX.JOBCOL && NC.DmgFX.JOBCOL[job]) || FALLBACK_COLOUR;

  // ---------------- drawing the portraits and badges ----------------
  const drawn = new WeakMap(); // canvas -> the key of what is on it
  function paintFace(cv, equip) {
    const c = cv.getContext('2d'), S = cv.width;
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, S, S);
    if (!equip) return;
    const hs = NC.headSpot(equip), k = (S * 0.72) / hs.w; // (a little wider than the hero frame's 0.77: the ring is thick)
    NC.drawAvatar(c, equip, S / 2 - hs.x * k, S * 0.63 - hs.y * k, k, 1, { noWeapon: true, t: 0.3 });
  }
  function face(cv, equip) {
    const key = JSON.stringify(equip || null);
    if (drawn.get(cv) === key) return;
    drawn.set(cv, key);
    paintFace(cv, equip);
    const sp = NC.Sprites;
    if (!equip || !sp || !sp.of) return;
    const names = sp.of.scan(equip);
    if (!sp.missing(names)) return;
    sp.need(names, 0).then(() => { if (cv.isConnected && drawn.get(cv) === key) paintFace(cv, equip); })
      .catch((e) => console.warn('partylist: portrait art', e));
  }
  function badge(el, job) {
    if (drawn.get(el) === job) return;
    drawn.set(el, job);
    el.style.setProperty('--job', jobColour(job));
    el.title = (NC.JOBS[job] || {}).name || '';
    const cv = el.querySelector('canvas'), c = cv.getContext('2d'), S = cv.width, id = classIcon(job);
    c.clearRect(0, 0, S, S);
    if (id && NC.itemIcon) c.drawImage(NC.itemIcon(id, BADGE_PX), S * 0.07, S * 0.07, S * 0.86, S * 0.86);
  }

  // ---------------- the box ----------------
  let box = null, cardsEl = null, countEl = null, foldBtn = null, folded = false, lastKey = '';
  function mount() {
    box = document.createElement('div');
    box.id = 'partylist'; box.className = 'partybox ptl-box'; box.hidden = true;
    box.innerHTML = '<div class="ptl-head"><div class="ptl-pill"><img src="assets/ic_party.png" alt=""><span>ปาร์ตี้</span><b class="ptl-count"></b></div>' +
      `<button type="button" class="ptl-fold">${CHEVRON}</button></div><div class="ptl-cards"></div>`;
    cardsEl = box.querySelector('.ptl-cards'); countEl = box.querySelector('.ptl-count'); foldBtn = box.querySelector('.ptl-fold');
    foldBtn.addEventListener('click', () => { setFold(!folded); saveFold(folded); });
    setFold(readFold());
    ($('hud') || document.body).appendChild(box);
  }
  function setFold(on) {
    folded = on;
    box.classList.toggle('folded', on);
    cardsEl.hidden = on;
    foldBtn.setAttribute('aria-expanded', on ? 'false' : 'true');
    foldBtn.setAttribute('aria-label', on ? 'แสดงรายชื่อปาร์ตี้' : 'ซ่อนรายชื่อปาร์ตี้');
  }
  // under the lessons' tracker, and on a phone under the hero's frame, when they reach lower than the CSS place
  // (the tracker's own box can be shorter than its rows on a phone on its side: the lowest of them counts)
  const lowest = (el) => [el, ...el.children].reduce((y, c) => { const b = c.getBoundingClientRect(); return b.height ? Math.max(y, b.bottom) : y; }, 0);
  function place() {
    const tr = $('lstrack'), frame = document.documentElement.classList.contains('mob') && document.querySelector('#hud .cframe');
    const bottom = Math.max(tr && !tr.hidden ? lowest(tr) : 0, frame ? frame.getBoundingClientRect().bottom : 0);
    const top = bottom ? Math.round(bottom + GAP_PX) + 'px' : '';
    if (box.style.top !== top) box.style.top = top;
  }
  // a short screen (a phone on its side, the tracker open): every size is in --pl, so the list shrinks evenly to the room
  // left above what lies under it: the chat box (PC), the phone's potions / AUTO row, chat button and EXP bars
  function floorUnder(r) {
    let y = innerHeight * (1 - BOTTOM_ROOM);
    for (const el of document.querySelectorAll(FLOOR_SEL)) {
      const b = el.getBoundingClientRect();
      if (b.height && b.top > r.top && b.left < r.right && b.right > r.left) y = Math.min(y, b.top - GAP_PX);
    }
    return y;
  }
  function fit() {
    const r = box.getBoundingClientRect(), k0 = Number(box.style.getPropertyValue('--fit')) || 1;
    if (!r.height) return;
    const k = Math.max(MIN_FIT, Math.min(1, (floorUnder(r) - r.top) / (r.height / k0)));
    if (Math.abs(k - k0) > 0.02) box.style.setProperty('--fit', k.toFixed(3));
  }
  function cardHtml(m) {
    return `<div class="ptl-card${m.me ? ' me' : ''}${m.lead ? ' lead' : ''}" data-peer="${esc(m.peer)}">` +
      `<div class="ptl-face"><canvas width="${FACE_PX}" height="${FACE_PX}"></canvas><span class="ptl-badge"><canvas width="${BADGE_PX}" height="${BADGE_PX}"></canvas></span></div>` +
      '<div class="ptl-top">' + (m.lead ? `<img class="ptl-crown" src="${esc(icon('ic_crown'))}" alt="หัวตี้">` : '') +
      '<span class="ptl-name"></span><span class="ptl-lv"></span><span class="ptl-word"></span></div><div class="ptl-hp"><i></i></div></div>';
  }
  const setText = (el, t) => { if (el.textContent !== t) el.textContent = t; };
  function update(card, m) {
    setText(card.querySelector('.ptl-name'), m.name || 'ผู้เล่น');
    setText(card.querySelector('.ptl-lv'), m.lv ? `Lv.${m.lv}` : '');
    const w = card.querySelector('.ptl-word'), word = m.word;
    setText(w, word ? word.text : '');
    w.className = 'ptl-word' + (word ? ' ' + word.kind : '');
    if (word && word.tip) w.title = word.tip; else w.removeAttribute('title');
    const f = m.dd || m.off ? 0 : Math.max(0, Math.min(1, m.hp || 0));
    card.querySelector('.ptl-hp i').style.width = (100 * f).toFixed(1) + '%';
    card.classList.toggle('low', !m.dd && !m.off && f < LOW_HP);
    card.classList.toggle('down', !!m.dd);
    card.classList.toggle('off', !!m.off);
    face(card.querySelector('.ptl-face > canvas'), m.eq);
    badge(card.querySelector('.ptl-badge'), m.job || 'traveler');
  }
  function render() {
    if (!box) return;
    const list = cardsNow(), show = list.length > 1;
    if (box.hidden === show) box.hidden = !show;
    if (!show) return;
    place();
    setText(countEl, `${list.length}/${PN.MAX}`);
    const key = list.map((m) => `${m.peer}:${m.lead ? 1 : 0}${m.me ? 1 : 0}`).join('|');
    if (key !== lastKey) { lastKey = key; cardsEl.innerHTML = list.map(cardHtml).join(''); }
    list.forEach((m, i) => { if (cardsEl.children[i]) update(cardsEl.children[i], m); });
    fit();
  }
  function tick() {
    try { render(); } catch (e) { console.warn('partylist: render', e); }
  }
  PN.drawList = tick; // (tests: draw now instead of waiting for the next quarter second)

  // ---------------- hooks ----------------
  const baseInit = NC.HUD.init.bind(NC.HUD);
  NC.HUD.init = function (game) {
    baseInit(game);
    mount();
    setInterval(tick, TICK_MS);
  };
})();
