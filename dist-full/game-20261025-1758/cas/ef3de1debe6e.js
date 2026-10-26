/* menuwin.js — the game menu (ESC): controls, settings, appearance and the animation viewer.
   The hidden #pause retains the control descriptions that feature modules add. */
(function () {
  'use strict';
  const NC = window.NC;
  const $ = (id) => document.getElementById(id);
  const G = () => NC.game;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const icon = (k) => ((NC.ASSET_MANIFEST || {})[k] || {}).src || '';
  if (NC.ASSET_MANIFEST_KUI) Object.assign(NC.ASSET_MANIFEST, NC.ASSET_MANIFEST_KUI);
  const Shake = NC.ScreenShake;

  // the keys: [key caps, word, the old menu's kbd text to find its full line, columns of 12 (default 3)]
  const KEYS = [
    [['W', 'A', 'S', 'D'], 'เดิน', 'WASD', 4],
    [['mouse'], 'คลิก โจมตี', 'คลิกซ้าย', 3],
    [['คลิกขวา'], 'เดินไปยังจุดที่คลิก', 'คลิกขวา', 5],
    [['Q', 'E', 'R', 'F'], 'ใช้สกิล', 'Q', 5],
    [['1'], 'ยาแดง', '1'], [['2'], 'ยาฟ้า', '2'], [['C'], 'สถานะ', 'C'], [['K'], 'หน้าสกิล', 'K'],
    [['I'], 'กระเป๋า', 'I'], [['B'], 'กระเป๋าวัสดุ', 'B'], [['M'], 'แผนที่', 'M'], [['P'], 'ปาร์ตี้', 'P'],
    [['H'], 'อาชีพเสริม', 'H'], [['V'], 'ตั้งร้าน', 'V'], [['Z'], 'ออโต้ฟาร์ม', 'Z'], [['X'], 'นั่งพัก', 'X'],
    [['G'], 'สลับอาวุธ', 'G'], [['Enter'], 'แชท', 'Enter'], [['ESC'], 'เมนู', 'ESC'],
  ];
  // on a phone (html.mob, js/mobile.js) the controls part shows the touch controls instead: [the button's look, words, 6 = a wide row]
  const TOUCH = [
    ['<i class="mn-t joy"><b></b></i>', 'ลากนิ้วซ้ายตรงไหนก็ได้ = เดิน', 6],
    ['<i class="mn-t atk">ตี</i>', 'ปุ่มโจมตี · กดค้างตีเป็นคอมโบ', 6],
    ['<i class="mn-t sk">Q</i><i class="mn-t sk">E</i>', 'สกิลรอบปุ่มโจมตี · ปุ่ม 1/2 สลับชุด', 6],
    ['<i class="mn-t act">ตัดไม้</i>', 'ปุ่มทอง: ตัดไม้ ขุดแร่ ตกปลา คุย ค้าขาย', 6],
    ['<i class="mn-t tap">แตะ</i>', 'แตะมอน = เลือกเป้า · แตะ NPC ป้ายร้าน = เปิด', 6],
    ['<i class="mn-t menu"><b></b><b></b><b></b></i>', 'เมนู: ทุกหน้าต่าง นั่งพัก เต็มจอ', 6],
    ['<i class="mn-t pot r"></i><i class="mn-t pot b"></i>', 'ยาแดง · ยาฟ้า', 3],
    ['<i class="mn-t auto">AUTO</i>', 'ออโต้ฟาร์ม', 3],
    ['<i class="mn-t chat"><b></b></i>', 'แชท', 3],
    ['<i class="mn-t turn"></i>', 'หมุนจอได้ทั้งแนวตั้งแนวนอน', 3],
  ];
  const KNOWN = new Set(['WASD', 'คลิกซ้าย', 'คลิกขวา', 'Space', 'Q', 'E', 'R', 'F', '1', '2', 'C', 'K', 'I', 'B', 'M', 'P', 'H', 'V', 'Z', 'X', 'G', 'Enter', 'ESC']);
  const SIDE = [
    ['resume', 'เล่นต่อ', 'mn_resume', 'gold'], ['controls', 'ปุ่มควบคุม', 'mn_controls'], ['settings', 'ตั้งค่า', 'mn_settings'],
    ['creator', 'ปรับแต่งตัวละคร', 'mn_creator'],
  ];
  // Online players use the appearance editor and the player settings.
  const PLAYER = !!NC.PLAYER_VIEW;
  const sideList = () => SIDE
    .map((b) => (PLAYER && b[0] === 'creator' ? ['creator', 'ปรับแต่งหน้าตา', b[2]] : b))
    .concat((NC.MENU_SIDE || []).map((b) => [b.id, b.name, b.icon, b.cls]));
  const PAGES = ['controls', 'settings'];
  // the settings in groups: a row's own S.group, else by its name; rows nobody placed land in อื่น ๆ
  const GROUPS = [['perf', 'ความลื่นและคุณภาพภาพ'], ['sound', 'เสียง'], ['look', 'ภาพและเอฟเฟกต์'], ['play', 'การเล่น'], ['screen', 'หน้าจอและแชท'], ['more', 'อื่น ๆ']];
  // (ความลื่นและคุณภาพภาพ: js/gfx.js rows first, then the crowd's and js/otherfx.js)
  const GROUP_OF = { 'เครื่องของคุณ': 'perf', 'คุณภาพภาพ': 'perf', 'ความคมของภาพ': 'perf', 'จำกัดเฟรม': 'perf',
    'เพลง': 'sound', 'เสียงเอฟเฟกต์': 'sound', 'ผู้เล่นอื่นบนจอ': 'perf', 'ความมันตอนตีโดน': 'look', 'การเก็บของ': 'play',
    'ยาแดง (ปุ่ม 1)': 'play', 'ยาฟ้า (ปุ่ม 2)': 'play', 'ป็อปอัพผลตีบวก / ทำของ': 'play', 'ปุ่มแบบมือถือ': 'screen' };

  let win = null, heroCv = null, raf = 0, t0 = 0;

  // ---------------- building the window ----------------
  function build() {
    win = document.createElement('div');
    win.id = 'menuwin'; win.className = 'kw-panel'; win.hidden = true;
    win.innerHTML = '<div class="mn-wrap"><section class="kw-win mn-win">' +
      '<header class="kw-title"><span>เมนู</span><button class="kw-x" id="mn-close" aria-label="ปิด">✕</button></header>' +
      '<div class="mn-body"><nav class="mn-side" id="mn-side">' +
        sideList().map(([id, name, ic, cls]) => `<button class="mn-btn ${cls || ''}" data-go="${id}"><span class="mn-ic">${icon(ic) ? `<img src="${icon(ic)}" alt="">` : ''}</span><b>${name}</b></button>`).join('') +
        '<div class="mn-hero"><canvas id="mn-hero"></canvas></div>' +
        '<div class="mn-copy">© 2026 Night Camp<br><a href="https://nightcamp.app/th/terms" target="_blank" rel="noopener noreferrer">ข้อกำหนดและสิทธิ์</a></div></nav>' +
        '<div class="mn-page kw-scroll" id="mn-page">' +
          '<section class="mn-sec" id="mn-controls"><h3>ปุ่มควบคุม</h3><div class="mn-keys" id="mn-keys"></div></section>' +
          '<section class="mn-sec" id="mn-settings"><h3>ตั้งค่า</h3><div class="mn-sets" id="mn-sets"></div></section>' +
          '<section class="mn-sec mn-rights"><h3>สิทธิ์และแอสเซ็ต</h3>' +
            '<p>© 2026 Night Camp สงวนสิทธิ์ในงานต้นฉบับของเกม ห้ามใช้บอตเก็บไฟล์จำนวนมาก หรือใช้งานที่ Night Camp ถือสิทธิ์สร้างชุดข้อมูล ค้นหา หรือฝึก AI โดยไม่ได้รับอนุญาต</p>' +
            '<p>งานของบุคคลที่สามยังเป็นไปตามใบอนุญาตของเจ้าของเดิม และการใช้ที่กฎหมายอนุญาตยังคงทำได้</p>' +
            '<a href="https://nightcamp.app/th/terms" target="_blank" rel="noopener noreferrer">อ่านข้อกำหนดฉบับเต็ม ↗</a></section>' +
        '</div></div></section></div>';
    document.body.appendChild(win);
    heroCv = $('mn-hero');
    $('mn-close').addEventListener('click', close);
    $('mn-side').addEventListener('click', (e) => { const b = e.target.closest('[data-go]'); if (b) go(b.dataset.go); });
    $('mn-page').addEventListener('scroll', spy, { passive: true });
    $('mn-sets').addEventListener('click', (e) => { const b = e.target.closest('[data-set]'); if (b) setting(b.dataset.set, b.dataset.v); });
    heroCv.parentNode.addEventListener('click', () => { t0 = performance.now() / 1000; }); // (cheers again)
  }

  // ---------------- the side buttons ----------------
  function go(id) {
    const extra = (NC.MENU_SIDE || []).find((b) => b.id === id);
    if (extra) return extra.run();
    if (id === 'resume') return close();
    if (id === 'creator') { close(); if (NC.HUD.askName) NC.HUD.askName(); return; }
    const sec = $('mn-' + id), page = $('mn-page');
    if (sec && document.documentElement.classList.contains('mob-port')) sec.scrollIntoView({ block: 'start', behavior: 'smooth' });
    else if (sec) page.scrollTo({ top: sec.offsetTop - page.offsetTop - 6, behavior: 'smooth' });
    light(id);
  }
  function light(id) { for (const b of $('mn-side').querySelectorAll('[data-go]')) b.classList.toggle('on', b.dataset.go === id); }
  function spy() {
    const page = $('mn-page'), top = page.scrollTop + 60;
    let cur = PAGES[0];
    for (const id of PAGES) if ($('mn-' + id).offsetTop - page.offsetTop <= top) cur = id;
    if (page.scrollTop + page.clientHeight >= page.scrollHeight - 4) cur = PAGES[PAGES.length - 1];
    light(cur);
  }

  // ---------------- the parts ----------------
  const oldLines = () => [...document.querySelectorAll('#pause .keys li')];
  function lineOf(kbd) {
    const li = oldLines().find((l) => [...l.querySelectorAll('kbd')].some((k) => k.textContent.trim() === kbd));
    return li ? li.textContent.replace(/\s+/g, ' ').trim() : '';
  }
  function cap(k) {
    if (k === 'mouse') return '<span class="mn-cap mouse"><i></i></span>';
    return `<span class="mn-cap${k.length > 2 ? ' long' : ''}">${esc(k)}</span>`;
  }
  function renderKeys() {
    const touch = document.documentElement.classList.contains('mob');
    $('mn-controls').querySelector('h3').firstChild.textContent = touch ? 'วิธีเล่นบนมือถือ' : 'ปุ่มควบคุม';
    if (touch) {
      $('mn-keys').innerHTML = TOUCH.map(([caps, word, span]) => `<div class="mn-key w${span}"><span class="mn-caps">${caps}</span><span class="mn-word">${esc(word)}</span></div>`).join('');
      return;
    }
    const list = [...KEYS];
    // keys other files added to #pause's lines (not in the list above): their own words
    for (const li of oldLines()) for (const k of li.querySelectorAll('kbd')) {
      const t = k.textContent.trim();
      if (KNOWN.has(t) || list.some((e) => e[2] === t)) continue;
      const after = (li.textContent.split(t)[1] || '').replace(/^[\s—\-–:·]+/, '').split(/[—·(]/)[0].trim();
      const word = after.slice(0, 18) || t; // (a long word gets more of the 12 columns: "สมุดนักเดินทาง" broke mid-word in 3)
      list.push([[t], word, t, word.length > 10 ? 5 : word.length > 6 ? 4 : 3]);
    }
    $('mn-keys').innerHTML = list.map(([caps, word, find, span]) =>
      `<div class="mn-key w${span || 3}" title="${esc(lineOf(find))}"><span class="mn-caps">${caps.map(cap).join('')}</span><span class="mn-word">${esc(word)}</span></div>`).join('');
  }
  function chatSize() {
    const w = document.querySelector('.chatwin');
    if (!w) return null;
    return ['s', 'm', 'l'].find((s) => w.classList.contains('size-' + s)) || 'm';
  }
  function renderSets() {
    const aura = NC.Aura99 ? NC.Aura99.mode() : null, chat = chatSize();
    const row = (name, key, opts, cur, note) => `<div class="mn-set"><span class="mn-sname">${name}${note ? `<small>${note}</small>` : ''}</span><span class="mn-pills">` +
      opts.map(([v, t]) => `<button class="mn-pill${v === cur ? ' on' : ''}" data-set="${key}" data-v="${v}">${t}</button>`).join('') + '</span></div>';
    const rows = { perf: [], sound: [], look: [], play: [], screen: [], more: [] };
    if (aura) rows.look.push(row('ออร่าเลเวล 99', 'aura', [['full', 'เต็ม'], ['lite', 'เบา'], ['off', 'ปิด']], aura, 'แสงรอบตัวเมื่อถึง Base Lv 99'));
    if (chat) rows.screen.push(row('กล่องแชท', 'chat', [['s', 'เล็ก'], ['m', 'กลาง'], ['l', 'ใหญ่']], chat));
    if (document.fullscreenEnabled) rows.screen.push(row('เต็มจอ', 'full', [['on', 'เปิด'], ['off', 'ปิด']], document.fullscreenElement ? 'on' : 'off', 'ซ่อนแถบของเบราว์เซอร์ (ปุ่ม F11 ก็ได้)'));
    // settings other files add: NC.MENU_SETTINGS [{ name, note, opts: [[value, label]], get(), set(value), group?, dev? }] (js/mobile.js)
    const order = Object.keys(GROUP_OF), late = [];
    (NC.MENU_SETTINGS || []).forEach((S, i) => {
      if (PLAYER && S.dev) return;
      late.push([order.includes(S.name) ? order.indexOf(S.name) : 99, rows[S.group || GROUP_OF[S.name]] || rows.more, row(S.name, 'x' + i, S.opts, S.get(), S.note)]);
    });
    late.sort((a, b) => a[0] - b[0]).forEach(([, list, h]) => list.push(h)); // (เพลง before เสียงเอฟเฟกต์, whatever the script order)
    $('mn-sets').innerHTML = GROUPS.filter(([k]) => rows[k].length).map(([k, t]) => `<div class="mn-sgroup">${t}</div>` + rows[k].join('')).join('');
  }
  document.addEventListener('fullscreenchange', () => { if (win && !win.hidden) renderSets(); });
  function setting(key, v) {
    if (key === 'aura' && NC.Aura99) NC.Aura99.set(v);
    if (key === 'full') {
      const d = document;
      if (v === 'on' && !d.fullscreenElement) d.documentElement.requestFullscreen().catch(() => {});
      if (v === 'off' && d.fullscreenElement) d.exitFullscreen().catch(() => {});
    }
    if (key[0] === 'x' && (NC.MENU_SETTINGS || [])[+key.slice(1)]) NC.MENU_SETTINGS[+key.slice(1)].set(v);
    if (key === 'chat') {
      const b = $('cw-size');
      for (let i = 0; b && i < 3 && chatSize() !== v; i++) b.click();
    }
    renderSets();
  }
  // ---------------- open / close ----------------
  function open() {
    renderKeys(); renderSets();
    $('mn-page').scrollTop = 0; light('controls');
    fit();
    t0 = performance.now() / 1000;
    if (!raf) raf = requestAnimationFrame(loop);
  }
  function close() {
    NC.HUD.panel('pause', false);
    const g = G();
    if (g) g.paused = false;
  }
  function fit() {
    const wrap = win.querySelector('.mn-wrap');
    wrap.style.transform = 'translate(-50%, -50%)';
    const k = Math.min(1, (innerWidth - 16) / wrap.offsetWidth, (innerHeight - 16) / wrap.offsetHeight);
    if (k < 1) wrap.style.transform = `translate(-50%, -50%) scale(${k.toFixed(4)})`;
  }
  addEventListener('resize', () => setTimeout(() => { if (win && !win.hidden) fit(); }, 0));

  // our hero: cheers when the menu opens, then breathes
  function drawHero() {
    const g = G(), p = g && g.player;
    if (!p || !heroCv) return;
    const r = heroCv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    const W = Math.max(1, Math.round(r.width * dpr)), H = Math.max(1, Math.round(r.height * dpr));
    if (heroCv.width !== W || heroCv.height !== H) { heroCv.width = W; heroCv.height = H; }
    const c = heroCv.getContext('2d'), k = Math.min(H / 150, W / 105), fx = W * 0.5, fy = H * 0.95;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, W, H);
    c.fillStyle = 'rgba(42,36,53,0.16)';
    c.beginPath(); c.ellipse(fx, fy, 40 * k, 9 * k, 0, 0, Math.PI * 2); c.fill();
    const eq = NC.lookEquip ? NC.lookEquip(p.equip) : p.equip, t = performance.now() / 1000, a = t - t0;
    // (the hero rig's idle, as in the game - js/herospine.js; the old cut-out's cheer only without it)
    if (NC.HeroSpine && NC.HeroSpine.preview && NC.HeroSpine.preview(c, eq, fx, fy, k, { t, noWeapon: true })) return;
    const ac = NC.animCtx ? NC.animCtx(eq) : undefined;
    const P = a < 1.2 && NC.Anim.CLIPS.cheer ? NC.Anim.sample('cheer', a, ac) : NC.Anim.sample('idle', t, ac);
    P.face = 1;
    NC.drawHero(c, eq, P, fx, fy, { scale: k, noWeapon: true }); // (a wave, not a sword in the air)
  }
  function loop() {
    raf = 0;
    if (!win || win.hidden) return;
    drawHero();
    raf = requestAnimationFrame(loop);
  }

  // ---------------- hooks: ESC and the menu tray's ESC button open this window ----------------
  const baseInit = NC.HUD.init.bind(NC.HUD);
  NC.HUD.init = function (game) {
    baseInit(game);
    build();
    // Skill and combat callers still write shake; the player camera always reads 0.
    let v = Shake.enabled() ? game.shake || 0 : 0;
    Object.defineProperty(game, 'shake', { configurable: true, enumerable: true, get: () => (Shake.enabled() ? v : 0), set: (x) => { v = Shake.enabled() ? x : 0; } });
  };
  const basePanel = NC.HUD.panel.bind(NC.HUD);
  NC.HUD.panel = function (id, show) {
    if (win && id === 'pause') {
      const on = show === undefined ? win.hidden : show;
      basePanel('pause', false); // closes every window (the old menu stays hidden)
      win.hidden = !on;
      if (on) open();
      return on;
    }
    if (win) win.hidden = true;
    return basePanel(id, show);
  };
})();
