/* bugreport.js — แจ้งบัค / เสนอแนะ inside the game (2026-10-18, the user: "ทำระบบ แจ้งบัคและพิมเสนอแนะ ภายในเกม").
   Layout A of assets/gen/nightcamp_rp_a_raw.png with layout C's status stamps (the user's pick), css/bugreport.css:
     แจ้งบัค        ปัญหาแบบไหน (7 chips) · เกิดบ่อยแค่ไหน · เกิดอะไรขึ้น (5–1000 letters); on the right, in the dark card, the
                    game screen taken when the window opened (แนบภาพหน้าจอนี้), what goes with the report, ส่งรายงาน
     เสนอแนะ        the same without "how often", its own chips (jobs & skills, items & fashion, ..., friends & guilds)
     รายงานของฉัน   the player's reports with the team's stamp (ได้รับแล้ว · ทีมอ่านแล้ว · กำลังดูอยู่ · แก้แล้ว! · ขอบคุณ! ·
                    ปิดแล้ว) and reply; reports still waiting in this browser show รอส่ง
   Online (NC.Online) every call is the Go server's nc_report RPC over HTTP (a screenshot is bigger than a socket message;
   server patch tools/online/patches/004_reports.patch: table nc_reports, one report every 20 s and 15 a day per player,
   JPEG up to 170 KB). Offline, or when the server can't be reached, a report waits in this browser
   (nightcamp.bugreport.v1, the newest 20, screens on the newest 3) and goes out the next time this browser plays online.
   What goes with a report (ctx): map, place, level, job, the build, online or not, browser, screen, frame rate, the
   graphics level, AUTO, the last errors on the page; the server adds the hero and the server it knows itself.
   Opens from: the ESC menu (side button แจ้งบัค / เสนอแนะ), the chat (/บัค /bug /แจ้งบัค /เสนอแนะ /idea /รายงาน),
   NC.BugReport.open('bug' | 'idea' | 'mine'). When the team has answered: a chat line and a red dot on the ESC
   menu's button (checked 20 s after the world is entered, then every 10 minutes). Test: ?bugreport opens it. */
(function () {
  'use strict';
  const NC = window.NC;
  const $ = (sel, root) => (root || document).querySelector(sel);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  if (NC.ASSET_MANIFEST_BUGREPORT) Object.assign(NC.ASSET_MANIFEST, NC.ASSET_MANIFEST_BUGREPORT);
  const ICON = (k) => ((NC.ASSET_MANIFEST_BUGREPORT || {})[k] || {}).src || '';
  const KEY = 'nightcamp.bugreport.v1';
  const TEXT_MIN = 5, TEXT_MAX = 1000, SHOT_MAX = 160000, GAP = 21000;

  // ---------------- what the page saw: the last errors and the frame rate (from now on) ----------------
  const errors = [];
  const noteErr = (s) => { s = String(s || '').replace(/\s+/g, ' ').trim().slice(0, 200); if (s && errors[errors.length - 1] !== s) { errors.push(s); if (errors.length > 6) errors.shift(); } };
  addEventListener('error', (e) => noteErr((e.message || 'error') + (e.filename ? ` @ ${String(e.filename).split('/').pop()}:${e.lineno}` : '')));
  addEventListener('unhandledrejection', (e) => noteErr('promise: ' + ((e.reason && (e.reason.message || e.reason)) || '')));
  const cerr = console.error;
  console.error = function () { try { noteErr('console: ' + [...arguments].map((a) => (a && a.message) || String(a)).join(' ')); } catch (x) { /* never mind */ } return cerr.apply(this, arguments); };
  let frames = 0, fpsNow = 0, fpsAt = performance.now();
  (function count() {
    frames++;
    const t = performance.now();
    if (t - fpsAt >= 2000) { fpsNow = Math.round(frames * 1000 / (t - fpsAt)); frames = 0; fpsAt = t; }
    requestAnimationFrame(count);
  })();

  // ---------------- the chips ----------------
  const TOPICS = {
    bug: [['combat', 'ต่อสู้ & สกิล', 'rp_combat'], ['items', 'ไอเทม & อุปกรณ์', 'rp_items'], ['maps', 'แมพ & มอนสเตอร์', 'rp_maps'], null,
      ['quests', 'เควส', 'rp_quests'], ['ui', 'หน้าต่าง & ปุ่ม', 'rp_ui'], ['net', 'แลค & เชื่อมต่อ', 'rp_net'], ['other', 'อื่น ๆ', 'rp_other']],
    idea: [['combat', 'อาชีพ & สกิล', 'rp_combat'], ['items', 'ไอเทม & แฟชั่น', 'rp_items'], ['maps', 'แมพ & มอนสเตอร์', 'rp_maps'], null,
      ['quests', 'เควส & เรื่องราว', 'rp_quests'], ['social', 'เพื่อน & กิลด์', 'rp_social'], ['ui', 'หน้าต่าง & ปุ่ม', 'rp_ui'], ['other', 'อื่น ๆ', 'rp_other']],
  };
  const OFTEN = [['once', 'ครั้งเดียว'], ['sometimes', 'บางครั้ง'], ['always', 'ทุกครั้ง']];
  const STAMP = { new: 'ได้รับแล้ว', seen: 'ทีมอ่านแล้ว', working: 'กำลังดูอยู่', fixed: 'แก้แล้ว!', thanks: 'ขอบคุณ!', closed: 'ปิดแล้ว', queued: 'รอส่ง' };
  const topicName = (kind, id) => { const t = (TOPICS[kind] || TOPICS.bug).find((x) => x && x[0] === id); return t ? t[1] : id; };
  const OFTEN_NAME = Object.fromEntries(OFTEN);

  // ---------------- this browser's part: reports waiting to go, which answers were seen ----------------
  let local = { queue: [], seen: {} };
  try { local = Object.assign(local, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* blocked */ }
  const keep = () => {
    local.queue = local.queue.slice(-20);
    local.queue.forEach((r, i) => { if (i < local.queue.length - 3) delete r.shot; });
    try { localStorage.setItem(KEY, JSON.stringify(local)); } catch (e) { local.queue.forEach((r) => delete r.shot); try { localStorage.setItem(KEY, JSON.stringify(local)); } catch (x) { /* full */ } }
  };
  const reqId = () => { const a = new Uint8Array(12); crypto.getRandomValues(a); return [...a].map((b) => 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'[b % 57]).join(''); };

  // ---------------- the server ----------------
  const O = () => NC.Online;
  const online = () => { const o = O(); return !!(o && o.enabled && o.session); };
  const inWorld = () => online() && !!(window.__ncOnline && window.__ncOnline.ready);
  const call = (payload) => O().rpc('nc_report', payload, true); // (over HTTP: conn.js O.rpc's third argument)
  const refused = (e) => !!(e && e.status >= 400 && e.status < 500 && e.status !== 408); // the server said no (not: no answer)

  // ---------------- the game screen ----------------
  function grab() {
    try {
      const cv = document.getElementById('view');
      if (!cv || !cv.width || !cv.height) return '';
      const k = Math.min(1, 960 / cv.width, 600 / cv.height);
      const c = document.createElement('canvas');
      c.width = Math.round(cv.width * k); c.height = Math.round(cv.height * k);
      const x = c.getContext('2d');
      x.fillStyle = '#0d0f22'; x.fillRect(0, 0, c.width, c.height);
      x.drawImage(cv, 0, 0, c.width, c.height);
      let q = 0.8, url = '';
      for (;;) {
        url = c.toDataURL('image/jpeg', q);
        if ((url.length - 23) * 0.75 <= SHOT_MAX || q < 0.3) break;
        q -= 0.12;
      }
      return (url.length - 23) * 0.75 <= SHOT_MAX ? url : '';
    } catch (e) { return ''; } // (a tainted canvas: no screen)
  }

  // ---------------- what goes with a report ----------------
  function context() {
    const g = NC.game, p = g && g.player, M = g && NC.MAPS && NC.MAPS[g.mapId], J = p && NC.JOBS && NC.JOBS[p.job];
    const o = O(), gfx = NC.Gfx, html = document.documentElement.classList;
    const c = {
      map: (g && g.mapId) || '', mapName: (M && M.name) || '', x: p ? Math.round(p.x) : 0, y: p ? Math.round(p.y) : 0,
      lv: p ? p.lv | 0 : 0, job: (p && p.job) || '', jobName: (J && J.name) || '', jobLv: p ? p.jobLv | 0 : 0,
      hp: p ? Math.round(p.hp) + '/' + Math.round(p.maxHp || 0) : '',
      online: online(), build: (o && o.release && o.release.contentVersion) || 'offline', host: location.host,
      ua: navigator.userAgent, lang: navigator.language || '',
      screen: `${screen.width}x${screen.height}@${(window.devicePixelRatio || 1).toFixed(2)}`, view: `${innerWidth}x${innerHeight}`,
      fps: fpsNow, mobile: html.contains('mob'), auto: !!(NC.Auto && NC.Auto.on), time: new Date().toString().slice(0, 33),
      errors: errors.slice(),
    };
    try { if (gfx) { c.gfx = gfx.level(); c.gpu = (gfx.D && gfx.D.cls) || ''; c.gfxMode = (gfx.S && gfx.S.mode) || ''; } } catch (e) { /* not ready */ }
    for (const k of Object.keys(c)) if (typeof c[k] === 'string') c[k] = c[k].slice(0, 290);
    while (c.errors.length && new Blob([JSON.stringify(c)]).size > 4800) c.errors.shift(); // (the server takes 6 KB)
    return c;
  }
  function infoLine(c) {
    const where = c.mapName || c.map || 'ไม่ทราบแมพ';
    const who = c.lv ? `Lv ${c.lv} ${c.jobName || c.job}` : '';
    const srv = c.online ? (c.host || 'ออนไลน์') : 'ออฟไลน์';
    return [where, who, srv, c.build !== 'offline' ? 'v' + c.build : '', c.fps ? c.fps + ' FPS' : ''].filter(Boolean).map(esc).join(' · ');
  }

  // ---------------- the window ----------------
  let win = null, tab = 'bug', shot = '', ctxNow = null, sending = false, mine = [], mineAt = 0;
  const form = { bug: { topic: '', often: '', text: '', attach: true }, idea: { topic: '', often: '', text: '', attach: false } };
  const shots = {};
  let mineSel = '';

  function build() {
    win = document.createElement('div');
    win.id = 'bgr';
    win.className = 'kw-panel bgr-panel';
    win.hidden = true;
    win.innerHTML = `<div class="bgr-wrap"><section class="kw-win bgr-win" role="dialog" aria-label="แจ้งบัค / เสนอแนะ">
      <header class="kw-title"><span>แจ้งบัค &amp; เสนอแนะ</span><button class="kw-x" data-act="close" aria-label="ปิด">✕</button></header>
      <nav class="kw-tabs bgr-tabs">
        <button class="kw-tab" data-tab="bug"><img src="${ICON('rp_bug')}" alt=""><span>แจ้งบัค</span></button>
        <button class="kw-tab" data-tab="idea"><img src="${ICON('rp_idea')}" alt=""><span>เสนอแนะ</span></button>
        <button class="kw-tab" data-tab="mine"><img src="${ICON('rp_mine')}" alt=""><span>รายงานของฉัน <b class="bgr-n"></b></span></button>
      </nav>
      <div class="bgr-body">
        <div class="bgr-page" data-page="form">
          <div class="bgr-form">
            <h3 class="bgr-h" data-f="topicH"></h3>
            <div class="bgr-chips" data-f="chips"></div>
            <h3 class="bgr-h" data-f="oftenH">เกิดบ่อยแค่ไหน?</h3>
            <div class="bgr-often" data-f="often">${OFTEN.map(([id, name]) => `<button class="bgr-opt" data-often="${id}"><i></i>${name}</button>`).join('')}</div>
            <h3 class="bgr-h" data-f="textH"></h3>
            <div class="bgr-text"><textarea data-f="text" maxlength="${TEXT_MAX + 200}"></textarea><span class="bgr-count" data-f="count"></span></div>
          </div>
          <div class="kw-card bgr-side">
            <div class="bgr-shot" data-f="shot"></div>
            <label class="bgr-check"><input type="checkbox" data-f="attach"><i></i><span>แนบภาพหน้าจอนี้</span></label>
            <div class="bgr-info"><span data-f="info"></span><span class="bgr-more" data-act="detail">ดูทั้งหมด</span><div class="bgr-detail" data-f="detail"></div></div>
            <div class="bgr-btns"><button class="kw-btn gold" data-act="send"></button><button class="kw-btn grey" data-act="close">ยกเลิก</button></div>
            <div class="bgr-msg" data-f="msg"></div>
            <div class="bgr-thanks">ทีมงานอ่านทุกเรื่อง ขอบคุณนะ!</div>
          </div>
        </div>
        <div class="bgr-page" data-page="list" hidden>
          <div class="bgr-listcol"><div class="bgr-list kw-scroll" data-f="list"></div></div>
          <div class="kw-card bgr-view" data-f="view"></div>
        </div>
      </div>
    </section></div>
    <div class="bgr-zoom" hidden><img alt=""></div>`;
    document.body.appendChild(win);
    win.addEventListener('keydown', (e) => { if (e.key !== 'Escape') e.stopPropagation(); }); // (typing here never reaches the game's keys)
    win.addEventListener('keyup', (e) => e.stopPropagation());
    win.addEventListener('click', (e) => {
      const t = e.target.closest('[data-act],[data-tab],[data-topic],[data-often],[data-row]');
      if (e.target === win) return close();
      if (!t) return;
      if (t.dataset.tab) return show(t.dataset.tab);
      if (t.dataset.topic) { form[tab].topic = t.dataset.topic; F('chips').classList.remove('want'); return paintForm(); }
      if (t.dataset.often) { form[tab].often = form[tab].often === t.dataset.often ? '' : t.dataset.often; return paintForm(); }
      if (t.dataset.row) { mineSel = t.dataset.row; return paintList(); }
      const a = t.dataset.act;
      if (a === 'close') close();
      else if (a === 'send') send();
      else if (a === 'detail') F('detail').classList.toggle('on');
      else if (a === 'shot') loadShot(t.dataset.id);
      else if (a === 'zoom') zoom(t.getAttribute('src'));
    });
    F('text').addEventListener('input', () => { form[tab].text = F('text').value; paintCount(); });
    F('attach').addEventListener('change', () => { form[tab].attach = F('attach').checked; paintShot(); });
    win.querySelector('.bgr-zoom').addEventListener('click', (e) => { e.currentTarget.hidden = true; });
  }
  const F = (k) => win.querySelector(`[data-f="${k}"]`);

  function open(which) {
    const was = win && !win.hidden;
    if (!win) build();
    if (!was) {
      shot = grab();                      // the screen as it was a moment before the window
      ctxNow = context();
      if (NC.HUD && NC.HUD.panel) NC.HUD.panel('pause', false); // (opened from the ESC menu: the menu closes)
    }
    win.hidden = false;
    if (NC.game) NC.game.paused = true;  // (the world runs on behind it: js/keeprun.js; this keeps the hero's keys off)
    show(which || tab);
    fit();
    refreshMine();
  }
  function close() {
    if (!win || win.hidden) return;
    win.hidden = true;
    win.querySelector('.bgr-zoom').hidden = true;
    if (NC.game) NC.game.paused = false;
  }
  function fit() {
    const wrap = win.querySelector('.bgr-wrap');
    if (document.documentElement.classList.contains('mob-port')) { wrap.style.transform = ''; return; }
    wrap.style.transform = 'translate(-50%, -50%)';
    const k = Math.min(1, (innerWidth - 16) / wrap.offsetWidth, (innerHeight - 16) / wrap.offsetHeight);
    if (k < 1) wrap.style.transform = `translate(-50%, -50%) scale(${k.toFixed(4)})`;
  }
  addEventListener('resize', () => setTimeout(() => { if (win && !win.hidden) fit(); }, 0));
  addEventListener('keydown', (e) => { if (e.code === 'Escape' && win && !win.hidden) { e.stopImmediatePropagation(); e.preventDefault(); close(); } }, true);

  function show(t) {
    if (!['bug', 'idea', 'mine'].includes(t)) t = 'mine';
    tab = t;
    for (const b of win.querySelectorAll('[data-tab]')) b.classList.toggle('on', b.dataset.tab === t);
    const isForm = t === 'bug' || t === 'idea';
    win.querySelector('[data-page="form"]').hidden = !isForm;
    win.querySelector('[data-page="list"]').hidden = isForm;
    if (isForm) { paintForm(); F('msg').textContent = ''; F('msg').className = 'bgr-msg'; }
    else { fresh = new Set(mine.filter(isNew).map((r) => r.id)); markSeen(); paintList(); }
    paintTabs();
  }
  function paintTabs() {
    const n = mine.length + local.queue.length;
    win.querySelector('[data-tab="mine"] .bgr-n').textContent = n ? `(${n})` : '';
    win.querySelector('[data-tab="mine"]').classList.toggle('news', tab !== 'mine' && newsCount() > 0);
  }

  // ---------------- the form ----------------
  function paintForm() {
    const f = form[tab], bug = tab === 'bug';
    F('topicH').textContent = bug ? 'ปัญหาแบบไหน?' : 'เรื่องอะไรดี?';
    F('chips').innerHTML = TOPICS[tab].map((t) => (t ? `<button class="bgr-chip${f.topic === t[0] ? ' on' : ''}" data-topic="${t[0]}"><img src="${ICON(t[2])}" alt="">${esc(t[1])}</button>` : '<i class="bgr-brk"></i>')).join('');
    F('oftenH').hidden = F('often').hidden = !bug;
    for (const b of win.querySelectorAll('[data-often]')) b.classList.toggle('on', f.often === b.dataset.often);
    F('textH').textContent = bug ? 'เกิดอะไรขึ้น?' : 'อยากเสนออะไร?';
    const ta = F('text');
    ta.placeholder = bug ? 'เล่าว่าเกิดอะไรขึ้น ตอนนั้นกำลังทำอะไรอยู่ (เช่น ใช้สกิลไหน ตีมอนตัวไหน กดปุ่มอะไร)'
      : 'อยากให้เกมมีอะไรเพิ่ม หรืออยากให้ปรับตรงไหน เล่าได้เลย';
    if (ta.value !== f.text) ta.value = f.text;
    F('attach').checked = f.attach && !!shot;
    F('attach').disabled = !shot;
    F('info').innerHTML = 'ส่งไปด้วย: ' + infoLine(ctxNow || context());
    F('detail').innerHTML = detailHtml(ctxNow || context());
    win.querySelector('[data-act="send"]').textContent = sending ? 'กำลังส่ง…' : bug ? 'ส่งรายงาน' : 'ส่งข้อเสนอแนะ';
    win.querySelector('[data-act="send"]').disabled = sending;
    paintShot(); paintCount();
  }
  function paintShot() {
    const box = F('shot');
    box.classList.toggle('off', !form[tab].attach);
    box.innerHTML = shot ? `<img src="${shot}" alt="ภาพหน้าจอ">` : '<div class="none">ถ่ายภาพหน้าจอไม่ได้ในเครื่องนี้<br>ส่งแค่ข้อความได้เลย</div>';
  }
  function paintCount() {
    const n = [...F('text').value.trim()].length, el = F('count');
    el.textContent = `${n} / ${TEXT_MAX}`;
    el.classList.toggle('over', n > TEXT_MAX);
  }
  function detailHtml(c) {
    const rows = [['แมพ', `${c.mapName || ''} (${c.map}) ${c.x}, ${c.y}`], ['ตัวละคร', `Lv ${c.lv} ${c.jobName || c.job} · Job ${c.jobLv} · HP ${c.hp}`],
      ['เกม', `${c.online ? 'ออนไลน์ ' + c.host : 'ออฟไลน์'} · ${c.build}${c.auto ? ' · AUTO' : ''}`], ['เครื่อง', `${c.screen} · ${c.view} · ${c.fps} FPS · ภาพระดับ ${c.gfx != null ? c.gfx : '-'} ${c.gpu || ''}`],
      ['เบราว์เซอร์', c.ua]];
    if (c.errors && c.errors.length) rows.push(['ข้อผิดพลาดล่าสุด', c.errors.join(' | '), 'err']);
    return rows.map(([k, v, cls]) => `<div${cls ? ` class="${cls}"` : ''}><b>${esc(k)}:</b> ${esc(v)}</div>`).join('');
  }
  function say(text, kind) { const el = F('msg'); el.textContent = text; el.className = 'bgr-msg' + (kind ? ' ' + kind : ''); }

  async function send() {
    if (sending) return;
    const f = form[tab], kind = tab, text = F('text').value.trim();
    if (!f.topic) { F('chips').classList.remove('want'); void F('chips').offsetWidth; F('chips').classList.add('want'); return say(kind === 'bug' ? 'เลือกก่อนว่าเป็นปัญหาแบบไหน' : 'เลือกก่อนว่าเป็นเรื่องอะไร', 'bad'); }
    if ([...text].length < TEXT_MIN) { F('text').focus(); return say('พิมพ์รายละเอียดอีกนิดนะ', 'bad'); }
    if ([...text].length > TEXT_MAX) return say(`ยาวเกิน ${TEXT_MAX} ตัวอักษร ลองย่อหน่อยนะ`, 'bad');
    const r = { action: 'send', requestId: reqId(), kind, topic: f.topic, often: kind === 'bug' ? f.often : '', text,
      ctx: ctxNow || context(), shot: f.attach && shot ? shot : '', at: Date.now() };
    sending = true; paintForm(); say('กำลังส่ง…', 'wait');
    let done = false, msg = '';
    if (online()) {
      try {
        const res = await call(wire(r));
        done = true;
        msg = res && res.left != null && res.left <= 3 ? `ส่งแล้ว ขอบคุณมาก! (วันนี้ส่งได้อีก ${res.left} เรื่อง)` : 'ส่งแล้ว ขอบคุณมาก! ทีมงานจะอ่านทุกเรื่อง';
      } catch (e) {
        if (refused(e)) { sending = false; paintForm(); return say((e && e.message) || 'ส่งไม่ได้ ลองใหม่อีกครั้ง', 'bad'); }
      }
    }
    if (!done) {
      local.queue.push(r); keep();
      msg = online() ? 'ยังติดต่อเซิร์ฟเวอร์ไม่ได้ เก็บไว้ในเครื่องแล้ว จะส่งให้เองอีกครั้ง' : 'เล่นออฟไลน์อยู่: เก็บไว้ในเครื่องแล้ว จะส่งให้เองตอนเล่นออนไลน์';
      flushSoon();
    }
    sending = false;
    form[kind].text = ''; form[kind].topic = ''; form[kind].often = '';
    paintForm(); say(msg);
    mineAt = 0; refreshMine();
    setTimeout(() => { if (win && !win.hidden && tab === kind) show('mine'); }, 1600);
  }
  const wire = (r) => ({ action: 'send', requestId: r.requestId, kind: r.kind, topic: r.topic, often: r.often, text: r.text, ctx: r.ctx, shot: r.shot || '' });

  // the reports that waited in this browser go out one by one (the server takes one every 20 s)
  let flushing = 0;
  function flushSoon(ms) { if (!flushing) flushing = setTimeout(flush, ms || GAP); }
  async function flush() {
    flushing = 0;
    if (!local.queue.length) return;
    if (!online()) return flushSoon(60000);
    const r = local.queue[0];
    try {
      await call(wire(r));
      local.queue.shift(); keep();
      mineAt = 0; refreshMine();
    } catch (e) {
      if (refused(e)) {
        const m = (e && e.message) || '';
        if (/ถี่|ครบ/.test(m)) return flushSoon(/ครบ/.test(m) ? 3600000 : GAP); // (too soon / today's 15: later)
        local.queue.shift(); keep();                                              // (a report the server never takes)
      }
    }
    if (local.queue.length) flushSoon(GAP);
  }

  // ---------------- รายงานของฉัน ----------------
  async function refreshMine(force) {
    if (!online() || (!force && performance.now() - mineAt < 15000 && mineAt)) { if (win && !win.hidden) { paintTabs(); if (tab === 'mine') paintList(); } return; }
    mineAt = performance.now();
    try {
      const res = await call({ action: 'mine' });
      mine = (res && res.reports) || [];
    } catch (e) { /* keep what we had */ }
    news();
    if (win && !win.hidden) {
      paintTabs();
      if (tab === 'mine') { for (const r of mine) if (isNew(r)) fresh.add(r.id); markSeen(); paintList(); }
    }
  }
  let fresh = new Set(); // (answers the player sees for the first time on this visit: a red dot on the row)
  const isNew = (r) => (r.status !== 'new' || !!r.reply) && local.seen[r.id] !== r.updated;
  const newsCount = () => mine.filter(isNew).length;
  function markSeen() {
    let changed = false;
    for (const r of mine) if (isNew(r)) { local.seen[r.id] = r.updated; changed = true; }
    if (changed) {
      const ids = new Set(mine.map((r) => r.id));
      for (const id of Object.keys(local.seen)) if (!ids.has(id)) delete local.seen[id];
      keep();
    }
    news();
  }
  function news() { document.documentElement.classList.toggle('bgr-news', newsCount() > 0); }

  // ---------------- the player's reports ----------------
  const fmtAt = (t) => { const d = new Date(t); return isNaN(d) ? '' : d.toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); };
  const kindIcon = (k) => ICON(k === 'idea' ? 'rp_idea' : 'rp_bug');
  function rowHtml(r, sel) {
    const st = r.status || 'new', isNews = fresh.has(r.id);
    return `<button class="bgr-row${sel ? ' on' : ''}${isNews ? ' news' : ''}" data-row="${esc(r.id)}"><img src="${kindIcon(r.kind)}" alt="">
      <span class="t">${esc(topicName(r.kind, r.topic))}<small>${esc(fmtAt(r.at))}</small></span>
      <span class="x">${esc(r.text)}</span><span class="bgr-stamp ${esc(st)}">${esc(STAMP[st] || st)}</span></button>`;
  }
  function paintList() {
    const rows = local.queue.map((q) => ({ id: 'q:' + q.requestId, kind: q.kind, topic: q.topic, often: q.often, text: q.text, status: 'queued', at: q.at, shot: !!q.shot, queued: q })).reverse().concat(mine);
    if (!rows.find((r) => r.id === mineSel)) mineSel = rows.length ? rows[0].id : '';
    F('list').innerHTML = rows.length ? rows.map((r) => rowHtml(r, r.id === mineSel)).join('')
      : `<div class="bgr-empty"><img src="${ICON('rp_mine')}" alt="">${online() ? 'ยังไม่มีรายงาน<br>เจอบัคหรืออยากเสนออะไร บอกทีมงานได้เลย' : 'ยังไม่มีรายงานที่ส่งจากเครื่องนี้<br>(รายงานที่ส่งแล้วดูได้ตอนเล่นออนไลน์)'}</div>`;
    paintView(rows.find((r) => r.id === mineSel));
  }
  function paintView(r) {
    const v = F('view');
    if (!r) { v.innerHTML = '<div class="none">รายงานที่ส่งจะขึ้นที่นี่ พร้อมคำตอบจากทีมงาน</div>'; return; }
    const st = r.status || 'new';
    const head = `<div class="hd"><img src="${kindIcon(r.kind)}" alt=""><span><b>${esc(r.kind === 'idea' ? 'เสนอแนะ' : 'แจ้งบัค')} · ${esc(topicName(r.kind, r.topic))}</b>
      <small>${esc(fmtAt(r.at))}${r.often ? ' · ' + esc(OFTEN_NAME[r.often] || r.often) : ''}</small></span><span class="bgr-stamp ${esc(st)}">${esc(STAMP[st] || st)}</span></div>`;
    const reply = r.reply ? `<div class="bgr-reply"><b>ทีมงาน:</b> ${esc(r.reply)}</div>` : '';
    const queuedNote = r.queued ? '<div class="bgr-reply">ยังไม่ได้ส่ง: เก็บไว้ในเครื่องนี้ จะส่งให้เองตอนเล่นออนไลน์</div>' : '';
    const s = shots[r.id] || (r.queued && r.queued.shot) || '';
    const shotPart = s ? `<img class="bigshot" data-act="zoom" src="${esc(s)}" alt="ภาพหน้าจอ">` : r.shot && !r.queued ? `<button class="kw-btn blue shotbtn" data-act="shot" data-id="${esc(r.id)}">ดูภาพหน้าจอที่แนบ</button>` : '';
    v.innerHTML = head + `<div class="body kw-scroll">${esc(r.text)}${shotPart}</div>` + reply + queuedNote;
  }
  async function loadShot(id) {
    try {
      const res = await call({ action: 'shot', id });
      shots[id] = (res && res.shot) || '';
      paintList();
    } catch (e) { const b = F('view').querySelector('.shotbtn'); if (b) b.textContent = (e && e.message) || 'โหลดภาพไม่ได้'; }
  }
  function zoom(src) { const z = win.querySelector('.bgr-zoom'); z.querySelector('img').src = src; z.hidden = false; }

  // ---------------- the ways in ----------------
  (NC.MENU_SIDE = NC.MENU_SIDE || []).push({ id: 'bugreport', name: 'แจ้งบัค / เสนอแนะ', icon: 'rp_bug', run: () => open('bug') });
  const C = (NC.chatCmds = NC.chatCmds || {});
  C['/บัค'] = C['/แจ้งบัค'] = C['/bug'] = C['/report'] = () => open('bug');
  C['/เสนอแนะ'] = C['/idea'] = C['/ไอเดีย'] = () => open('idea');
  C['/รายงาน'] = C['/reports'] = () => open('mine');

  // when the team answered: one chat line and the menu's dot (20 s after the world is up, then every 10 minutes)
  let told = 0;
  setInterval(async () => {
    if (!inWorld()) return;
    if (local.queue.length) flushSoon(3000);
    if (told && performance.now() - told < 600000) return;
    told = performance.now();
    await refreshMine(true);
    const n = newsCount();
    if (n && NC.Chat) NC.Chat.add({ ch: 'sys', kind: 'job', text: `ทีมงานตอบรายงานของคุณ ${n} เรื่อง · ดูได้ที่ ESC › แจ้งบัค / เสนอแนะ › รายงานของฉัน (หรือพิมพ์ /รายงาน)` });
  }, 20000);

  NC.BugReport = { open, close, context, grab, get isOpen() { return !!win && !win.hidden; } };
})();
