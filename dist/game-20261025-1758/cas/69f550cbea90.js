/* online/srvsel.js — เลือกเซิร์ฟเวอร์: the online game's server page (?online), from the user's pick B
   (assets/gen/nightcamp_chsrv_b_raw.png, 2026-10-18): over the painted night camp, the logo, the account chip and one tall
   card per server, each with a painted picture of its world (assets/srvsel/srv_<1..6>.jpg by the server's number, round
   again after 6), its number badge and name, the operator's tag (แนะนำ / ใหม่), its light (ลื่นไหล / คนเยอะ / เต็ม /
   ปิดปรับปรุง / ติดต่อไม่ได้) with the ping bars, the account's heroes there, the day it opened and "เล่นล่าสุด". The
   picked card glows gold; เข้าเกม (or a double click, Enter) goes on to the character select of that server.
   It is the front door: shown over the character select (online/lobby.js) when the page opens, once per tab (a reload
   after a server move or an update goes straight on). The server chip
   under the account on the character select opens it again. The list, the lights, the heroes and the move are
   online/servers.js (NC.OnlineServers); a move to another server before the world is in happens in place.
   Test: ?online&servers (a local page also lists the local Docker server). */
(function () {
  'use strict';
  const NC = window.NC, O = NC.Online;
  if (!O || !O.enabled) return;
  const S = () => NC.OnlineServers;
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const SEEN = 'nightcamp.online.srvpicked'; // (sessionStorage: this tab went past the page)
  const PICS = 6;
  const pic = (s) => `assets/srvsel/srv_${((Math.max(1, s.no | 0) - 1) % PICS) + 1}.jpg`;
  const LIGHT = { smooth: 'ลื่นไหล', busy: 'คนเยอะ', full: 'เต็ม', maintenance: 'ปิดปรับปรุง', offline: 'ติดต่อไม่ได้' };
  const MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const dateOf = (d) => { const m = /^(\d{4})-(\d\d)-(\d\d)/.exec(d || ''); return m ? `${+m[3]} ${MONTHS[+m[2] - 1]} ${m[1]}` : ''; };
  const norm = (u) => String(u || '').replace(/\/+$/, '');
  const jobName = (id) => (NC.JOBS && NC.JOBS[id] && NC.JOBS[id].name) || '';

  let root = null, list = [], sel = '', busy = false, open = false, seq = 0;

  function build() {
    root = document.createElement('div');
    root.className = 'ss-root'; root.hidden = true; root.tabIndex = -1;
    root.innerHTML = `
      <div class="ss-bg"></div>
      <img class="ss-logo" src="assets/loading/logo.png" alt="Night Camp">
      <div class="ss-acct" hidden><i></i><span></span></div>
      <div class="ss-cards"></div>
      <div class="ss-msg" hidden></div>
      <div class="ss-btns">
        <button class="kw-btn grey ss-refresh"><img src="assets/srvsel/ic_refresh.png" alt="">รีเฟรช</button>
        <button class="kw-btn gold ss-go">เข้าเกม</button>
      </div>
      <div class="ss-note">ตัวละครอยู่กับเซิร์ฟเวอร์ของตัวเอง ย้ายข้ามเซิร์ฟเวอร์ไม่ได้</div>
      <div class="ss-copy">© 2026 Night Camp. Original content rights reserved.</div>`;
    document.body.appendChild(root);
    $('.ss-refresh', root).onclick = () => refresh(true);
    $('.ss-go', root).onclick = () => enter();
    const cards = $('.ss-cards', root);
    cards.addEventListener('click', (e) => { const c = e.target.closest('.ss-card'); if (c) pick(c.dataset.url); });
    cards.addEventListener('dblclick', (e) => { const c = e.target.closest('.ss-card'); if (c) { pick(c.dataset.url); enter(); } });
    addEventListener('keydown', onKey, true);
    addEventListener('resize', () => { if (open) drawFaces(); });
  }
  function onKey(e) {
    if (!open) return;
    e.stopImmediatePropagation(); // (the character select under us hears nothing: its Enter, Delete, arrows)
    if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
      const i = list.findIndex((s) => s.url === sel), j = Math.max(0, Math.min(list.length - 1, i + (e.code === 'ArrowLeft' ? -1 : 1)));
      if (list[j]) pick(list[j].url);
    } else if (e.code === 'Enter' || e.code === 'NumpadEnter') enter();
    else if (e.code === 'Escape' && sessionGet()) close(); // (back to the character select, once the page was passed)
    else return;
    e.preventDefault();
  }
  const sessionGet = () => { try { return sessionStorage.getItem(SEEN); } catch (e) { return null; } };
  const sessionSet = () => { try { sessionStorage.setItem(SEEN, '1'); } catch (e) { /* blocked */ } };

  // ---------------- the cards ----------------
  function bars(ms) {
    const n = ms == null ? 0 : ms < 60 ? 4 : ms < 120 ? 3 : ms < 250 ? 2 : 1;
    return `<span class="ss-sig">${[1, 2, 3, 4].map((k) => `<i class="${k <= n ? 'on' : ''}" style="height:${30 + k * 17}%"></i>`).join('')}</span>`;
  }
  function card(s) {
    const st = s.state || (s.status === 'maintenance' ? 'maintenance' : ''), maint = st === 'maintenance', off = st === 'offline';
    const H = (s.heroes = S().heroesOn(s.url)), heroes = (H && H.heroes) || []; // (fresh: the character select under us fills it)
    const tag = s.tags.includes('recommended') ? '<span class="ss-tag rec">แนะนำ</span>' : s.tags.includes('new') ? '<span class="ss-tag new">ใหม่</span>'
      : s.from === 'local' || /127\.0\.0\.1|localhost/.test(s.url) ? '<span class="ss-tag test">ทดสอบ</span>' : '';
    const light = maint ? `<img class="ss-wrench" src="assets/srvsel/ic_wrench.png" alt=""><span>ปิดปรับปรุง</span>`
      : `<i class="ss-dot ${st || 'wait'}"></i><span class="ss-st">${st ? LIGHT[st] || st : 'กำลังเช็ก…'}</span>${off ? '' : bars(s.ms) + `<b class="ss-ms">${s.ms != null ? s.ms + ' ms' : ''}</b>`}`;
    const who = maint ? '' : `<div class="ss-box ss-heroes">${heroes.length
      ? `<span>ตัวละครของคุณ: ${heroes.length}</span><span class="ss-faces">${heroes.slice(0, 3).map((h, i) => `<span class="ss-face" title="${esc(h.name)} · Lv ${h.lv | 0}${jobName(h.job) ? ' · ' + esc(jobName(h.job)) : ''}"><canvas data-face="${esc(s.url)}|${i}"></canvas></span>`).join('')}</span>`
      : `<span class="ss-none">${H ? 'ยังไม่มีตัวละคร' : 'ยังไม่เคยเข้า'}</span>`}</div>`;
    return `<div class="ss-card${s.url === sel ? ' sel' : ''}${maint ? ' maint' : ''}${off ? ' off' : ''}" data-url="${esc(s.url)}" role="button" tabindex="-1">` +
      '<div class="ss-cbar"><i></i><i></i></div>' +
      `<div class="ss-pic"><img src="${pic(s)}" alt="">${maint ? '<span class="ss-stamp">ปิดปรับปรุง</span>' : ''}</div>` +
      `<div class="ss-name"><b class="ss-no">${s.no ? 'S' + s.no : 'T'}</b><span class="ss-nm${[...String(s.name)].length > 13 ? ' long' : ''}">${esc(s.name)}</span></div>${tag}` +
      `<div class="ss-box ss-light">${light}</div>${who}` +
      `<div class="ss-open">${s.opened ? 'เปิดเมื่อ: ' + dateOf(s.opened) : ''}</div>` +
      (s.lastPlayed ? '<div class="ss-last"><img src="assets/srvsel/laurel.png" alt=""><span>เล่นล่าสุด</span><img class="r" src="assets/srvsel/laurel.png" alt=""></div>' : '') +
      '</div>';
  }
  function drawFaces() {
    const W = NC.OnlineWorld;
    for (const cv of root.querySelectorAll('canvas[data-face]')) {
      const [url, i] = cv.dataset.face.split('|'), s = list.find((x) => x.url === url), h = s && s.heroes && s.heroes.heroes[+i];
      if (!h || !W || !NC.headSpot || !NC.drawAvatar) continue;
      let eq;
      try { eq = W.equipOf(h.equip, h.look, h.appearance); } catch (e) { continue; }
      if (!eq.weapon) eq.weapon = 'sword'; // (the pose needs one; it is not drawn)
      if (!eq.pants) eq.pants = 'pants_traveler';
      const r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1, Z = Math.max(48, Math.round(r.width * dpr)) || 96;
      cv.width = Z; cv.height = Z;
      const c = cv.getContext('2d');
      try {
        const hs = NC.headSpot(eq), k = Z / hs.w;
        NC.drawAvatar(c, eq, Z / 2 - hs.x * k, Z * 0.54 - hs.y * k, k, 1, { noWeapon: true, t: 0.3 });
      } catch (e) { console.warn('srvsel: face', e); }
    }
  }
  function render() {
    if (!root) return;
    const cards = $('.ss-cards', root), keep = cards.scrollLeft;
    cards.innerHTML = list.length ? list.map(card).join('') : '<div class="ss-wait">กำลังโหลดรายชื่อเซิร์ฟเวอร์…</div>';
    cards.classList.toggle('one', list.length === 1);
    cards.scrollLeft = keep;
    drawFaces();
    const s = list.find((x) => x.url === sel), why = !s ? 'เลือกเซิร์ฟเวอร์ก่อน' : s.state === 'maintenance' || s.status === 'maintenance' ? 'เซิร์ฟเวอร์นี้ปิดปรับปรุงอยู่'
      : s.state === 'offline' ? 'ติดต่อเซิร์ฟเวอร์นี้ไม่ได้ ลองรีเฟรช' : s.state === 'full' && !(s.heroes && s.heroes.n) ? 'เซิร์ฟเวอร์นี้เต็ม ลองเซิร์ฟเวอร์อื่น' : '';
    const go = $('.ss-go', root);
    go.disabled = busy || !!why;
    go.title = why;
    msg(busy ? 'กำลังเปลี่ยนเซิร์ฟเวอร์…' : why && s ? why : '');
    // the account chip: the one this browser keeps for the picked server (each server has its own)
    const a = s && O.store.get('nightcamp.online.acct:' + norm(s.url), null), chip = $('.ss-acct', root);
    chip.hidden = !a;
    if (a) $('span', chip).innerHTML = 'บัญชี: <b>' + esc(a.kind === 'device' ? 'ผู้มาเยือน' : a.name || 'ผู้เล่น') + '</b>';
  }
  function msg(t) { const m = $('.ss-msg', root); m.hidden = !t; m.textContent = t || ''; }
  function pick(url) { if (!url || busy) return; sel = url; render(); const c = root.querySelector('.ss-card.sel'); if (c) c.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }

  async function refresh(again) {
    const my = ++seq, X = S();
    if (!X) return;
    if (again) for (const s of list) { s.state = ''; s.ms = null; }
    render();
    let l;
    try { l = await X.list(); } catch (e) { l = []; }
    if (my !== seq) return;
    // (keep what was read before until the new light comes)
    for (const s of l) { const was = list.find((x) => x.url === s.url); if (was && !again) { s.state = was.state; s.ms = was.ms; } }
    list = l;
    if (!list.some((s) => s.url === sel)) sel = (list.find((s) => s.current) || list.find((s) => s.lastPlayed) || list[0] || {}).url || '';
    render();
    await Promise.all(list.map((s) => X.load(s).then(() => { if (my === seq) render(); }).catch(() => {})));
  }

  // ---------------- in / out ----------------
  let heroSig = '', heroT = 0;
  const heroesNow = () => list.map((s) => JSON.stringify(S().heroesOn(s.url) || null)).join('|');
  function show() {
    if (!root || !S()) return;
    open = true; root.hidden = false; busy = false;
    clearInterval(heroT); heroT = setInterval(() => { const h = heroesNow(); if (h !== heroSig) { heroSig = h; render(); } }, 1500);
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); // (the key window under us keeps no focus)
    root.focus({ preventScroll: true });
    refresh(false);
  }
  function close() {
    if (!root) return;
    open = false; root.hidden = true; seq++; clearInterval(heroT);
    sessionSet();
    const key = document.querySelector('.cs-keybox:not([hidden]) .cs-key-in');
    if (key) setTimeout(() => key.focus(), 0);
  }
  function enter() {
    const s = list.find((x) => x.url === sel), go = $('.ss-go', root);
    if (!s || busy || go.disabled) return;
    if (norm(s.url) === norm(O.origin)) { close(); return; } // (the character select under us is already this server's)
    busy = true; render();
    try {
      sessionSet();
      S().pick(s); // (in place: a new client and the lobby starts again; a loaded world reloads the page)
      setTimeout(() => { busy = false; close(); }, 250);
    } catch (e) { busy = false; render(); msg((e && e.message) || 'เปลี่ยนเซิร์ฟเวอร์ไม่ได้'); }
  }

  // ---------------- the front door and the way back ----------------
  const frontDoor = () => !sessionGet();
  const baseInit = NC.HUD.init.bind(NC.HUD);
  NC.HUD.init = function (g) {
    baseInit(g); // (online/lobby.js builds the character select and connects under us)
    build();
    if (frontDoor()) show();
    // the server line under the account on the character select: its name from the list, a click comes back here
    const tie = () => {
      const srv = document.querySelector('.cs-srv');
      if (!srv || srv.dataset.ss) return !!srv;
      srv.dataset.ss = '1'; srv.classList.add('ss-link'); srv.title = 'เปลี่ยนเซิร์ฟเวอร์';
      srv.addEventListener('click', () => show());
      return true;
    };
    if (!tie()) { const t = setInterval(() => { if (tie()) clearInterval(t); }, 500); }
    O.on('server', () => { const srv = document.querySelector('.cs-srv span'); if (srv) srv.textContent = 'เซิร์ฟเวอร์ ' + O.origin.replace(/^https?:\/\//, ''); });
    setInterval(() => { // (the operator's name for the server we are on, once the list knows it)
      const srv = document.querySelector('.cs-srv span'), s = list.find((x) => norm(x.url) === norm(O.origin));
      if (srv && s && s.name && !srv.textContent.includes(s.name)) srv.textContent = 'เซิร์ฟเวอร์ ' + s.name;
    }, 1000);
    if (!frontDoor() && S()) S().list().then((l) => { list = l; }).catch(() => {});
  };

  NC.ServerSelect = { show, close, refresh, get open() { return open; }, get list() { return list; } };
})();
