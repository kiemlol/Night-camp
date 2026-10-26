/* online/update.js — players learn about a deploy while they play (2026-10-18: "ผู้เล่นจะรู้ได้ยังไงว่าเรา deploy ระหว่างเล่น
   ... popup ให้กดอัปเดต"). Web side only, no server change:
   - /version.json at the site root, written by tools/online/live/deploy_web.sh when it switches the root page (no-cache):
     { build: "game-<stamp>", force, note, notice? }. The page knows its own folder from <meta name="nc-build">
     (tools/online/build_web.py --build). Read every 2 min (every 30 s while a notice is up) and after every reconnect.
   - another build -> a small card "มีอัปเดตใหม่" [อัปเดตตอนนี้] [ภายหลัง] that doesn't stop the game (again 10 min after
     ภายหลัง); the update waits while the hero fights (online/flow.js's 5 s timer). force:true, a new server protocol
     (/nc/update, which conn.js reads again on every reconnect) or a join refused as "update required" -> no ภายหลัง,
     60 s, then the update by itself.
   - the update opens the new folder's page with the same address (or reloads) and remembers the hero in sessionStorage:
     the next page enters the same slot by itself (the server kept everything).
   - notice { at: unix ms, text } (deploy_server.sh --notice-min N writes it ~5 min before its blue/green switch and
     clears it after): a banner on top, "เซิร์ฟเวอร์จะอัปเดตใน m:ss (ประมาณ 10 วินาที)"; while the socket is down around
     that time "กำลังอัปเดตเซิร์ฟเวอร์…" (over the lobby's curtain too) until conn.js is back.
   No version.json (local dev, another static host) = nothing happens; without ?online this file does nothing.
   Versions (2026-10-18, the user: "ทำเรื่อง ver ด้วย", picked "v0.5.0 + วันที่"): deploy_web.sh puts release.json
   { build, version, date, notes } in the build folder and the same in version.json (online/release.js reads and words
   them). The card says "v0.5.0 → v0.5.1 · 18 ต.ค. 69 17:42" and the first notes; the page's own release.json gives the
   label on the server and character select, ESC → ตั้งค่า → เวอร์ชันเกม, and "มีอะไรใหม่" once per version (in the world,
   out of a fight, nothing else open; a browser that never had an account here starts on this version without it).
   Big signs (2026-10-19, the user: "ทำป้าย ประกาศใหญ่ๆ เลยๆ"): a forced update is a sign in the middle of a dimmed screen
   (the game under it still plays until the countdown), and "มีอะไรใหม่" a board with the version large and the notes
   split into ของใหม่ and แก้ไข (a note starting "แก้" is a fix). An update players may put off stays the small card.
   Styles: css/update.css (added from here). Test hooks: NC.OnlineUpdate. */
(function () {
  'use strict';
  const NC = window.NC, O = NC.Online, R = NC.Release;
  if (!O || !O.enabled) return;
  const safeBuild = (b) => (typeof b === 'string' && /^[\w.-]{1,80}$/.test(b) ? b : '');
  const desktop = window.NCDesktop;
  const DESKTOP = !!(desktop && desktop.app === 'pc');
  const BUNDLED = !!(desktop && desktop.bundled === true);
  const BUILD = (BUNDLED && safeBuild(desktop.buildId)) || ((document.querySelector('meta[name="nc-build"]') || {}).content || '').trim();
  const VERSION_URL = '/version.json';
  const POLL = 120000, POLL_NOTICE = 30000, LATER = 600000, FORCE_S = 60, FORCE_FIGHT_S = 30, RESUME = 'nightcamp.online.resume', AUTO = 'nightcamp.online.autoupdate';
  const SEEN = 'nightcamp.online.seenver', CARD_NOTES = 4, NEWS_WAIT = 2000;
  const SUB = 'ตัวละครและของทุกอย่างอยู่บนเซิร์ฟเวอร์ อัปเดตแล้วกลับเข้าเกมด้วยตัวเดิม';
  const SUB_FORCE = 'กด "อัปเดตตอนนี้" เกมจะรีโหลด 1 ครั้ง แล้วกลับเข้าตัวละครเดิมเอง ของทุกอย่างอยู่บนเซิร์ฟเวอร์ครบ';
  const isFix = (note) => /^แก้/.test(note);
  const $ = (s, r) => (r || document).querySelector(s);
  const clean = (t, n) => String(t == null ? '' : t).replace(/\s+/g, ' ').trim().slice(0, n || 160);
  const downloadURL = (value) => {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && url.hostname && !url.username && !url.password && !url.hash ? url.href : '';
    } catch (e) { return ''; }
  };
  const fightLeft = () => (NC.OnlineFlow && NC.OnlineFlow.fightLeft ? NC.OnlineFlow.fightLeft() : 0);
  const mmss = (s) => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const log = (t) => { if (NC.HUD && NC.HUD.log) NC.HUD.log(t, 'sys'); };

  const link = document.createElement('link');
  link.rel = 'stylesheet'; link.href = 'css/update.css';
  document.head.appendChild(link);

  // ---------------- version.json ----------------
  let latest = '', latestRel = null, pollT = 0, polling = false, none = false, serverPollAt = 0;
  async function poll() {
    clearTimeout(pollT);
    if (polling || none) return;
    polling = true;
    try {
      const r = await fetch(VERSION_URL + '?t=' + Date.now(), { cache: 'no-store', credentials: 'omit' });
      if (r.ok && /json/i.test(r.headers.get('content-type') || '')) read(await r.json());
      else if (r.status === 404 && !BUILD && !DESKTOP) none = true; // (a local browser page without the file: stop asking)
    } catch (e) { /* no network, a broken file: nothing */ }
    // A desktop app already in the world also needs the server's latest minimum.
    // Limit the extra request to once per two minutes, including when a server notice
    // makes the site-version poll run every 30 seconds.
    if (DESKTOP && O.status === 'online' && Date.now() - serverPollAt >= POLL) {
      serverPollAt = Date.now();
      try { await O.refreshRelease(); } catch (e) { /* the release event already shows a mandatory gate; retry network errors later */ }
    }
    polling = false;
    if (none) return;
    pollT = setTimeout(poll, notice || switching ? POLL_NOTICE : POLL);
  }
  function read(v) {
    if (!v || typeof v !== 'object') return;
    const b = safeBuild(v.build);
    if (b) { latest = b; latestRel = R ? R.parse(v) : null; }
    if (BUILD && b && b !== BUILD) want({ build: b, force: v.force === true, note: clean(v.note), rel: latestRel });
    setNotice(v.notice);
  }

  // ---------------- the update card ----------------
  let offer = null, card = null, blocker = null, locked = false, tickT = 0, laterT = 0, laterUntil = 0, forceAt = 0, going = false;
  // (pressed during a fight: AUTO goes off and the update starts the moment the fight's 5 s are over — 2026-10-20, the owner:
  // "มันกดอัพไม่ได้อ่ะ": the button stayed grey while AUTO kept the hero fighting, and the 5 s started again with every hit)
  let armed = false;
  const stopAuto = () => { const g = NC.game, A = NC.Auto; if (g && A && A.on && A.stop) A.stop(g, 'อัปเดตเกม'); };
  function want(o) {
    const mandatory = !!(o.mandatory || (offer && offer.mandatory));
    const force = !!(mandatory || o.force || (offer && offer.force));
    const rel = o.rel || (o.build && o.build === latest ? latestRel : null) || (offer && offer.rel) || null;
    offer = { build: o.build || (offer && offer.build) || '', note: o.note || (offer && offer.note) || '', force, mandatory, rel,
      appVersion: o.appVersion || (offer && offer.appVersion) || '',
      downloadUrl: Object.prototype.hasOwnProperty.call(o, 'downloadUrl') ? downloadURL(o.downloadUrl) : (offer && offer.downloadUrl) || '' };
    if (force && !forceAt) forceAt = performance.now() + FORCE_S * 1000;
    if (!force && performance.now() < laterUntil) return; // (ภายหลัง: the 10 min timer shows it again)
    showCard();
  }
  // The server's minimum desktop build is a hard gate. Stop the live connection and
  // cover the entire window so the player cannot keep using the old app under the sign.
  function lockScreen() {
    if (locked) return;
    locked = true;
    if (!blocker) {
      blocker = document.createElement('div');
      blocker.className = 'up-blocker';
      Object.assign(blocker.style, { position: 'fixed', inset: '0', zIndex: '99998', background: 'rgba(9, 10, 26, .78)' });
      document.body.appendChild(blocker);
    }
    card.style.zIndex = '99999';
    card.setAttribute('role', 'alertdialog');
    card.setAttribute('aria-modal', 'true');
    card.tabIndex = -1;
    stopAuto();
    if (NC.game) NC.game.paused = true;
    O.stop();
    ($('.up-go', card).hidden ? card : $('.up-go', card)).focus();
  }
  window.addEventListener('keydown', (e) => {
    if (!locked) return;
    if (e.key === 'Tab') { e.preventDefault(); ($('.up-go', card).hidden ? card : $('.up-go', card)).focus(); return; }
    if ((e.key === 'Enter' || e.key === ' ') && e.target === $('.up-go', card)) return;
    e.preventDefault(); e.stopImmediatePropagation();
  }, true);
  function build() {
    card = document.createElement('div');
    card.className = 'kw-win up-card';
    card.hidden = true;
    card.setAttribute('role', 'status');
    card.innerHTML = `
      <div class="kw-title up-title">มีอัปเดตใหม่</div>
      <div class="up-body">
        <img class="up-ic" src="assets/kui/app_icon_192.png" alt="">
        <div class="up-text">
          <div class="up-q"></div>
          <div class="up-vline"></div>
          <ul class="up-notes"></ul>
          <div class="up-sub"></div>
          <div class="up-line"></div>
        </div>
      </div>
      <div class="up-btns"><button class="kw-btn grey up-later">ภายหลัง</button><button class="kw-btn gold up-go">อัปเดตตอนนี้</button></div>`;
    document.body.appendChild(card);
    // (the card never keeps the focus: the game's keys go on working under it)
    card.addEventListener('pointerdown', (e) => { if (e.target.closest('button')) e.preventDefault(); });
    $('.up-later', card).onclick = later;
    $('.up-go', card).onclick = () => {
      if (going || $('.up-go', card).disabled) return;
      if (DESKTOP) {
        const url = downloadURL(offer && offer.downloadUrl);
        if (url) window.open(url, '_blank', 'noopener,noreferrer');
        return;
      }
      if (fightLeft() > 0) { armed = true; stopAuto(); tick(); return; } // (out of the fight first: the server's 5 s rule)
      update(false);
    };
  }
  function showCard() {
    if (!card) build();
    $('.up-title', card).textContent = DESKTOP ? (offer.force ? 'ประกาศอัปเดตแอป' : 'มีแอปเวอร์ชันใหม่') : (offer.force ? 'ประกาศอัปเดต' : 'มีอัปเดตใหม่');
    $('.up-q', card).textContent = DESKTOP ? 'ต้องติดตั้งแอป Night Camp เวอร์ชันใหม่' : (offer.force ? 'ต้องอัปเดตเกมก่อนเล่นต่อ' : 'Night Camp มีเวอร์ชันใหม่แล้ว');
    $('.up-sub', card).textContent = DESKTOP ? 'ไฟล์เกมอยู่ในตัวติดตั้ง ดาวน์โหลดตัวติดตั้งเวอร์ชันใหม่แล้วเปิดเกมอีกครั้ง' : (offer.force ? SUB_FORCE : SUB);
    $('.up-vline', card).textContent = DESKTOP && offer.appVersion ? `v${desktop.version} → v${offer.appVersion}` : versionLine(offer.rel);
    fillNotes($('.up-notes', card), offer.rel && offer.rel.notes.length ? offer.rel.notes : offer.note ? [offer.note] : [], CARD_NOTES);
    $('.up-later', card).hidden = offer.force;
    $('.up-later', card).textContent = DESKTOP ? 'รับทราบ' : 'ภายหลัง';
    $('.up-go', card).hidden = DESKTOP && !offer.downloadUrl;
    $('.up-go', card).textContent = DESKTOP ? 'ดาวน์โหลดตัวติดตั้ง' : 'อัปเดตตอนนี้';
    $('.up-btns', card).style.display = DESKTOP && offer.force && !offer.downloadUrl ? 'none' : '';
    card.classList.toggle('force', offer.force);
    card.hidden = false;
    tick();
    if (offer.mandatory) lockScreen();
  }
  // "v0.5.0 → v0.5.1 · 18 ต.ค. 69 17:42" (the page's own version when it knows it)
  function versionLine(rel) {
    if (!R || !rel || !rel.version) return '';
    const to = R.label(rel, true);
    return mine && mine.version !== rel.version ? `v${mine.version} → ${to}` : to;
  }
  function fillNotes(ul, notes, max) {
    const li = (text, cls) => { const el = document.createElement('li'); el.textContent = text; if (cls) el.className = cls; return el; };
    const shown = notes.slice(0, max).map((n) => li(n));
    const more = notes.length > max ? [li(`…และอีก ${notes.length - max} อย่าง`, 'more')] : [];
    ul.replaceChildren(...shown, ...more);
  }
  function later() {
    if (!card || offer.force) return;
    armed = false;
    card.hidden = true; clearTimeout(tickT);
    laterUntil = performance.now() + LATER;
    clearTimeout(laterT);
    laterT = setTimeout(() => { laterUntil = 0; if (offer && !going) showCard(); }, LATER);
  }
  function tick() {
    clearTimeout(tickT);
    if (!card || card.hidden) return;
    const f = DESKTOP ? 0 : fightLeft(), go = $('.up-go', card);
    if (DESKTOP) {
      $('.up-line', card).textContent = offer.mandatory
        ? (offer.downloadUrl ? 'ต้องติดตั้งแอปเวอร์ชันใหม่ก่อนเล่นต่อ' : 'ยังไม่มีลิงก์ดาวน์โหลด กรุณาติดต่อทีมงาน')
        : 'ติดตั้งแอปเวอร์ชันใหม่เมื่อสะดวก';
      $('.up-line', card).classList.remove('fight');
      // Packaged files cannot become a different web build by reloading. Keep the server notice,
      // but never start the web update timer or send the player to a remote build folder.
      return;
    }
    if (armed && f <= 0 && !going) { update(false); return; }
    const parts = [];
    if (offer.force) {
      const left = (forceAt - performance.now()) / 1000;
      if (!autoOk) parts.push('กดอัปเดตเพื่อเล่นต่อ');
      else if (left > 0) parts.push(`อัปเดตเองใน ${mmss(left)}`);
      else if (!going && (f <= 0 || left < -FORCE_FIGHT_S)) update(true); // (a fight holds it up to 30 s more)
    }
    if (f > 0 && !going) parts.unshift(armed ? `ปิด AUTO แล้ว · อัปเดตเองเมื่อพ้นการต่อสู้ใน ${Math.ceil(f)} วินาที`
      : `กำลังต่อสู้อยู่ · กดอัปเดตได้เลย (ปิด AUTO ให้ แล้วอัปเดตเมื่อพ้นการต่อสู้ ${Math.ceil(f)} วินาที)`);
    $('.up-line', card).textContent = parts.join(' · ');
    $('.up-line', card).classList.toggle('fight', f > 0);
    go.disabled = going;
    go.textContent = going ? 'กำลังอัปเดต…' : armed && f > 0 ? `รออีก ${Math.ceil(f)} วินาที…` : 'อัปเดตตอนนี้';
    $('.up-later', card).disabled = going;
    // (the small card: under the banner and the lobby's message line when they show; the forced sign stays in the middle)
    let below = 0;
    for (const el of [bar, $('.cs-root:not([hidden]) .cs-msg:not([hidden])')]) {
      const r = el && !el.hidden && el.getBoundingClientRect();
      if (r && r.height && r.top < innerHeight / 2) below = Math.max(below, r.bottom + 10);
    }
    card.style.top = below && !offer.force ? `max(calc(96 * var(--u)), ${Math.round(below)}px)` : '';
    if (!going) tickT = setTimeout(tick, 250);
  }

  // ---------------- the update itself: the new folder's page, the same hero ----------------
  // (one update by itself per 5 min at most: a build that names itself wrong, or a server that keeps refusing, can't
  //  reload the page over and over; the card's button still works)
  let lastSlot = null, autoOk = true;
  try { autoOk = Date.now() - (+sessionStorage.getItem(AUTO) || 0) > 300000; } catch (e) { /* */ }
  function rememberHero() {
    const active = NC.OnlineLobby && NC.OnlineLobby.slots && NC.OnlineLobby.slots.active;
    if (Number.isInteger(active)) lastSlot = active;
    try { if (lastSlot != null) sessionStorage.setItem(RESUME, JSON.stringify({ slot: lastSlot, server: O.origin, at: Date.now() })); } catch (e) { /* storage blocked */ }
  }
  // A local graphics-setting change may reload the installed build. It must
  // never use update(), which means "install a newer web build" on the site.
  function reloadClient() {
    if (going) return;
    going = true;
    rememberHero();
    O.stop();
    location.reload();
  }
  function update(auto) {
    if (DESKTOP) return; // a desktop update needs a new installer, never a page reload
    if (going) return;
    going = true;
    if (card && !card.hidden) tick();
    try { if (auto === true) sessionStorage.setItem(AUTO, String(Date.now())); } catch (e) { /* */ }
    rememberHero();
    O.stop(); // (the server sees the hero leave now, not at a timeout)
    // (the address bar may show only the site root: boot.js keeps this page's real path and query in NC.PAGE)
    const page = NC.PAGE || { path: location.pathname, search: location.search, hash: location.hash };
    const to = offer && offer.build, path = page.path, seg = '/' + BUILD + '/';
    if (to && BUILD && to !== BUILD && path.includes(seg)) location.replace(path.replace(seg, '/' + to + '/') + page.search + page.hash);
    else location.reload();
  }
  // after an update: the lobby's slots arrive -> enter the same hero (one go; 3 min at most after the update)
  let resume = null, resumed = false;
  try { resume = JSON.parse(sessionStorage.getItem(RESUME) || 'null'); sessionStorage.removeItem(RESUME); } catch (e) { resume = null; }
  if (resume && !(Date.now() - resume.at < 180000 && resume.server === O.origin && Number.isInteger(resume.slot))) resume = null;
  if (resume) {
    lastSlot = resume.slot; // (a hero that doesn't get in this time is still the one the next update brings back)
    const baseChars = O.characters;
    O.characters = function () {
      return baseChars.apply(this, arguments).then((list) => {
        const r = resume, s = r && list && list.slots && list.slots[r.slot];
        resume = null;
        if (s && !s.empty) setTimeout(() => { const L = NC.OnlineLobby; if (L && L.act && !L.entered) { resumed = true; L.act(r.slot); } }, 0);
        return list;
      });
    };
  }

  // ---------------- the server's notice: a banner counting down to the switch ----------------
  let notice = null, doneAt = 0, switching = false, finishedUntil = 0, bannerT = 0, bar = null;
  function setNotice(n) {
    const at = n && typeof n === 'object' ? Number(n.at) : NaN;
    if (!Number.isFinite(at) || at <= 0) { if (notice) { notice = null; banner(); } return; }
    if (at === doneAt) return; // (this switch is over; the file may still name it for a moment)
    notice = { at, text: clean(n.text, 120) };
    banner();
  }
  function banner() {
    clearTimeout(bannerT);
    const now = Date.now();
    let text = '', sub = '', kind = '';
    if (switching) { text = 'กำลังอัปเดตเซิร์ฟเวอร์…'; sub = 'เดี๋ยวต่อกลับเข้าเกมเอง ของทุกอย่างอยู่ครบ'; kind = 'busy'; }
    else if (finishedUntil > now) { text = 'อัปเดตเซิร์ฟเวอร์เสร็จแล้ว'; kind = 'done'; }
    else if (notice) {
      const left = (notice.at - now) / 1000;
      if (left > 0) { text = `เซิร์ฟเวอร์จะอัปเดตใน ${mmss(left)} (ประมาณ 10 วินาที)`; sub = notice.text; kind = left <= 60 ? 'soon' : ''; }
      else if (left > -600) { text = 'กำลังอัปเดตเซิร์ฟเวอร์…'; sub = notice.text || 'เกมจะหลุดสักครู่แล้วต่อเอง'; kind = 'busy'; } // (the switch comes after the image is built)
      else notice = null; // (a notice nobody cleared)
    }
    if (!text) { if (bar) bar.hidden = true; return; }
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'up-bar';
      bar.setAttribute('role', 'status');
      bar.innerHTML = '<img class="up-bar-ic" src="assets/kui/mn_settings.png" alt=""><div><div class="up-bar-t"></div><div class="up-bar-s"></div></div>';
      document.body.appendChild(bar);
    }
    $('.up-bar-t', bar).textContent = text;
    $('.up-bar-s', bar).textContent = sub;
    bar.className = 'up-bar' + (kind ? ' ' + kind : '');
    bar.hidden = false;
    // (over the lobby: under its message line, which sits at the same place)
    const m = $('.cs-root:not([hidden]) .cs-msg:not([hidden])'), r = m && m.getBoundingClientRect();
    bar.style.top = r && r.height && r.top < innerHeight / 2 ? Math.round(r.bottom + 8) + 'px' : '';
    bannerT = setTimeout(banner, 250);
  }
  const nearSwitch = () => !!notice && Date.now() > notice.at - 60000;
  const lobbyLine = () => { // (online/lobby.js has just said "การเชื่อมต่อหลุด…" in red: during a switch the banner says what it is)
    const m = $('.cs-root .cs-msg');
    if (m && !m.hidden) { m.hidden = true; m.classList.remove('bad'); }
    banner();
  };

  // ---------------- this build's version: release.json in its own folder (deploy_web.sh) ----------------
  let mine = null, badge = null, rowAdded = false;
  const playedBefore = (() => { // (read before this page signs in: an account key here = a player who knew older versions)
    try { return Object.keys(localStorage).some((k) => k.startsWith('nightcamp.online.acct:')); } catch (e) { return false; }
  })();
  const seenVersion = () => { try { return localStorage.getItem(SEEN) || ''; } catch (e) { return null; } };
  const markSeen = (v) => { try { localStorage.setItem(SEEN, v); } catch (e) { /* storage blocked */ } };
  async function loadMine() {
    if (!BUILD || !R) return; // (only a deployed build has one: local dev shows no version)
    try {
      const r = await fetch('release.json?t=' + Date.now(), { cache: 'no-store', credentials: 'omit' });
      if (r.ok && /json/i.test(r.headers.get('content-type') || '')) setMine(await r.json());
    } catch (e) { /* no network, a broken file: no version shown */ }
  }
  function setMine(v) {
    const rel = R && R.parse(v);
    if (!rel || !rel.version) return;
    mine = rel;
    if (!badge) {
      badge = document.createElement('div');
      badge.className = 'up-verbadge'; badge.setAttribute('aria-hidden', 'true');
      document.body.appendChild(badge);
    }
    badge.textContent = R.label(mine); // (shown by css/update.css over the server and character select only)
    addSettingsRow();
    if (!playedBefore && seenVersion() === '') markSeen(mine.version); // (a new player: these notes are no news to them)
    watchNews();
  }
  function addSettingsRow() {
    if (rowAdded) return;
    rowAdded = true;
    (NC.MENU_SETTINGS = NC.MENU_SETTINGS || []).push({ // (js/menuwin.js, ESC → ตั้งค่า → อื่น ๆ)
      name: 'เวอร์ชันเกม', group: 'more',
      get note() { return R.label(mine, true); },
      get opts() { return mine.notes.length ? [['news', 'มีอะไรใหม่']] : []; },
      get: () => '',
      set: (v) => { if (v === 'news') showNews(); },
    });
  }

  // ---------------- "มีอะไรใหม่": this version's notes, once ----------------
  let news = null, newsT = 0, clearSince = 0, newsFocus = null, newsPaused = false;
  const newsDue = () => { const s = seenVersion(); return !!mine && mine.notes.length > 0 && s !== null && s !== mine.version; };
  function watchNews() {
    clearInterval(newsT);
    if (!newsDue()) return;
    newsT = setInterval(() => {
      if (!newsDue()) { clearInterval(newsT); return; }
      if (!calm()) { clearSince = 0; return; }
      if (!clearSince) clearSince = performance.now();
      if (performance.now() - clearSince >= NEWS_WAIT) { clearInterval(newsT); showNews(); }
    }, 1000);
  }
  // in the world, alive, out of a fight, no update going, nothing else open (online/checkin.js's popup waits for this one too)
  function calm() {
    const W = NC.OnlineWorld, g = NC.game;
    if (!W || !W.ready || !g || !g.player || g.player.dead > 0 || going || fightLeft() > 0 || (card && !card.hidden)) return false;
    return ![...document.querySelectorAll('.kw-panel, .cs-root, .ss-root, #preload, #intro, #prologue')]
      .some((el) => el !== news && !el.hidden && el.getClientRects().length);
  }
  function buildNews() {
    news = document.createElement('div');
    news.className = 'kw-panel up-news'; news.hidden = true;
    news.innerHTML = `
      <section class="kw-win up-news-win" role="dialog" aria-modal="true" aria-labelledby="up-news-title" tabindex="-1">
        <header class="kw-title"><span id="up-news-title">มีอะไรใหม่</span><button class="kw-x up-news-x" aria-label="ปิด">✕</button></header>
        <div class="up-news-head">
          <img class="up-ic" src="assets/kui/app_icon_192.png" alt="">
          <div><div class="up-news-kicker">อัปเดตใหม่มาแล้ว!</div><div class="up-news-ver"></div><div class="up-news-date"></div></div>
        </div>
        <div class="up-news-body"><div class="up-news-cols">
          <section class="up-news-sec new"><div class="up-news-tag">ของใหม่</div><ul class="up-notes up-news-list up-news-new"></ul></section>
          <section class="up-news-sec fix"><div class="up-news-tag">แก้ไข</div><ul class="up-notes up-news-list up-news-fix"></ul></section>
        </div></div>
        <div class="up-btns"><button class="kw-btn gold up-news-ok">เล่นต่อเลย!</button></div>
      </section>`;
    news.addEventListener('click', (e) => { if (e.target === news || e.target.closest('.up-news-x, .up-news-ok')) closeNews(); });
    news.addEventListener('keydown', (e) => {
      e.stopPropagation(); // (the game's hotkeys don't fire under the window)
      if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); closeNews(); }
      if (e.key === 'Tab') { // (the focus stays on the window's two buttons)
        e.preventDefault();
        const bs = [...news.querySelectorAll('button')], i = bs.indexOf(document.activeElement);
        bs[(i + (e.shiftKey ? bs.length - 1 : 1) + bs.length) % bs.length].focus();
      }
    }, true);
    document.body.appendChild(news);
  }
  function showNews() {
    if (!mine || !R) return;
    if (!news) buildNews();
    markSeen(mine.version);
    $('.up-news-ver', news).textContent = 'v' + mine.version;
    $('.up-news-date', news).textContent = R.when(mine.date, true);
    const notes = mine.notes.length ? mine.notes.slice(0, R.MAX_NOTES) : ['ปรับปรุงและแก้ไขเล็กน้อย'];
    for (const [kind, list] of [['new', notes.filter((n) => !isFix(n))], ['fix', notes.filter(isFix)]]) {
      fillNotes($('.up-news-' + kind, news), list, R.MAX_NOTES);
      $('.up-news-sec.' + kind, news).hidden = !list.length;
    }
    if (!news.hidden) return;
    newsFocus = document.activeElement;
    const g = NC.game;
    newsPaused = !!(g && g.paused);
    if (g) g.paused = true;
    news.hidden = false;
    $('.up-news-ok', news).focus();
  }
  function closeNews() {
    if (!news || news.hidden) return;
    news.hidden = true;
    const g = NC.game;
    if (g) g.paused = newsPaused;
    if (newsFocus && newsFocus.isConnected) newsFocus.focus();
  }

  // ---------------- the connection's moments ----------------
  let baseProto = null, wasOnline = false, dropped = false;
  O.on('release', (r) => {
    const id = O.clientIdentity, policy = id && id.desktop && id.policy;
    if (id && id.desktop && (O.mandatoryUpdate || (policy && policy.build > id.appBuild))) {
      want({ force: !!O.mandatoryUpdate, mandatory: !!O.mandatoryUpdate,
        appVersion: policy && policy.version, downloadUrl: policy && policy.url,
        note: policy && policy.notes || 'มีแอปเวอร์ชันใหม่แล้ว' });
    }
    if (baseProto == null) { baseProto = r.protocolVersion; return; }
    if (r.protocolVersion !== baseProto) want({ build: latest !== BUILD ? latest : '', force: true, note: 'เซิร์ฟเวอร์เปลี่ยนรุ่นแล้ว' });
  });
  O.on('status', (s, why) => {
    if (s === 'online') {
      const L = NC.OnlineLobby;
      if (L && L.slots && L.slots.active != null) lastSlot = L.slots.active;
      if (resumed) { resumed = false; log('อัปเดตเกมแล้ว · กลับมาที่ตัวเดิม'); }
      if (switching) { switching = false; doneAt = notice ? notice.at : doneAt; notice = null; finishedUntil = Date.now() + 5000; banner(); }
      if (dropped) poll(); // (after every reconnect: the web may have been deployed with the server)
      wasOnline = true; dropped = false;
      return;
    }
    if (s === 'reconnecting' && wasOnline) {
      dropped = true;
      if (nearSwitch() && !switching) { switching = true; banner(); }
      if (switching) lobbyLine();
    }
    if (s === 'error') {
      if (switching) { switching = false; banner(); } // (the reconnects ran out: the lobby's slots take over)
      if (/update required/i.test(why || '')) want({ build: latest !== BUILD ? latest : '', force: true, note: 'เกมเวอร์ชันนี้ไม่ตรงกับเซิร์ฟเวอร์แล้ว' });
    }
  });

  poll();
  loadMine();
  // (tests: NC.OnlineUpdate.read({build:'x'}), .want({build, rel}), .setMine(release), .showNews(), .poll(), .state)
  NC.OnlineUpdate = { poll, read, update, reloadClient, want, setMine, showNews, closeNews,
    get state() { return { BUILD, latest, offer, notice, switching, laterUntil, lastSlot, going, mine }; } };
})();
