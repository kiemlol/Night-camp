/* mobile.js — the HUD for phones and tablets (touch), held upright or sideways (the user, 2026-09-30: "ทำ hud สำหรับเกม
   mobile ในมือถือด้วย สำหรับเเนวตั้งเเละเเนวนอน"). Mockups: landscape assets/gen/nightcamp_mob_hud1_raw.png (+ the
   menu grid of mob_hud2), portrait assets/gen/nightcamp_mob_port_a_raw.png. css/mobile.css draws it.
   On a touch screen (or ?mobile, or the Esc menu's setting) the page gets html.mob plus .mob-port / .mob-land:
     the view   a phone gets its own zoom (portrait: ~620 world units across; landscape: ~800 tall) and the hero is lifted
                clear of the thumbs (game.js calls NC.viewFit and NC.camShift)
     left thumb a floating joystick (analog: game.input.mx / my)
     right thumb ATTACK (holds Space: the combo; a life skill's strike; fishing's hold), the 8 hotbar slots four at a
                time round it (the page button flips 1-4 / 5-8; they are hud.js's own .hslot, moved here, so icons, levels,
                SP and cooldowns keep updating), the two potions, AUTO, and an action button when something can be used
                (a tree, a vein, water, a teacher, Uncle Coco: it presses B)
     aiming     at the tapped monster, else the nearest one near (it becomes the target); none: the way we walk
     taps       a tap on a monster targets it; a tap on anything else is a click there (Uncle Coco, a teacher, a
                tree, a player's shop sign ...)
     menu       the round menu button opens a grid of every window button (the old menu tray, moved), sit, AUTO
                settings, full screen, and the coins
     chat       a round button opens the chat as a sheet; the newest line shows beside it for a few seconds, and a red
                badge counts the lines since the chat was last opened
   Every button is a key press for the game (a KeyboardEvent on the page), so the game and the feature files react as
   to the keyboard. Nothing here runs without html.mob; turning it off puts every moved piece back. */
(function () {
  'use strict';
  const NC = window.NC;
  const $ = (id) => document.getElementById(id);
  const G = () => NC.game;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const KEY = 'nightcamp.touch.v1';
  const root = document.documentElement;

  // ---------------- on or off, upright or sideways ----------------
  let pref = 'auto';
  try { pref = localStorage.getItem(KEY) || 'auto'; } catch (e) { /* storage blocked */ }
  const touchDevice = () => (navigator.maxTouchPoints || 0) > 0 && matchMedia('(pointer: coarse)').matches;
  const wanted = () => { const m = pref; return m === 'on' || (m === 'auto' && touchDevice()); };
  let on = false, port = false, built = false;
  const typing = () => { const t = document.activeElement; return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA'); };

  // game.js resize: the zoom, the HUD scale, the classes
  NC.viewFit = function (game, cv) {
    const want = wanted();
    // (the phone's keyboard shrinks the page while typing: keep the orientation it had)
    if (!typing() || !on) port = innerHeight > innerWidth;
    root.classList.toggle('mob-port', want && port);
    root.classList.toggle('mob-land', want && !port);
    if (want !== on) { on = want; root.classList.toggle('mob', on); if (built) place(on); }
    if (!on) return;
    const W = cv.width, H = cv.height;
    game.scale = port ? Math.min(H / 1080, W / 620) : H / 800;
    game.vw = W / game.scale; game.vh = H / game.scale;
    const base = Math.min(innerWidth, innerHeight) / 390; // (1 on a phone 390 px across)
    root.style.setProperty('--m', clamp(base, 0.82, 1.7) + 'px');
    root.style.setProperty('--u', (port ? 0.46 : 0.4) * clamp(base, 0.82, 2.2) + 'px');
  };
  // the hero lifted clear of the thumbs (world units; game.js adds it to the camera)
  NC.camShift = function (game) {
    if (!on) return 0;
    return port ? 0.085 * game.vh : 0.02 * game.vh;
  };
  function setPref(v) {
    pref = v;
    try { localStorage.setItem(KEY, v); } catch (e) { /* storage blocked */ }
    dispatchEvent(new Event('resize')); // (game.js resize -> NC.viewFit)
  }
  NC.Mobile = { get on() { return on; }, get port() { return port; }, pref: () => pref, set: setPref };
  // the Esc menu's settings (js/menuwin.js)
  (NC.MENU_SETTINGS = NC.MENU_SETTINGS || []).push({
    name: 'ปุ่มแบบมือถือ', note: 'จอย ปุ่มโจมตี ปุ่มสกิลบนจอ', opts: [['auto', 'อัตโนมัติ'], ['on', 'เปิด'], ['off', 'ปิด']],
    get: () => pref, set: setPref,
  });

  // ---------------- key presses for the game ----------------
  const KEYNAME = { Space: ' ', KeyB: 'b', KeyX: 'x', KeyZ: 'z', Escape: 'Escape' };
  function keyOf(code) { return KEYNAME[code] || (code.startsWith('Key') ? code.slice(3).toLowerCase() : code.startsWith('Digit') ? code.slice(5) : code); }
  const down = new Set();
  const FIGHT = { Space: 1, KeyQ: 1, KeyE: 1, KeyR: 1, KeyF: 1, Digit3: 1, Digit4: 1, Digit5: 1, Digit6: 1 };
  let fightAt = -1e9; // (the last attack or skill press: the hero turns to the target for it)
  function press(code) {
    if (down.has(code)) return;
    down.add(code);
    if (FIGHT[code]) fightAt = performance.now();
    document.body.dispatchEvent(new KeyboardEvent('keydown', { code, key: keyOf(code), bubbles: true, cancelable: true }));
  }
  function release(code) {
    if (!down.has(code)) return;
    down.delete(code);
    document.body.dispatchEvent(new KeyboardEvent('keyup', { code, key: keyOf(code), bubbles: true, cancelable: true }));
  }
  function releaseAll() { for (const c of [...down]) release(c); }
  addEventListener('blur', releaseAll);
  // a button that holds a key while a finger is on it
  function holdKey(el, code) {
    el.addEventListener('pointerdown', (e) => {
      if (!on) return;
      e.preventDefault();
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* (a synthetic pointer) */ }
      el.classList.add('pressed');
      press(code);
    });
    const end = () => { el.classList.remove('pressed'); release(code); };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('lostpointercapture', end);
  }

  // ---------------- building the controls ----------------
  const SLOT_CODE = { q: 'KeyQ', e: 'KeyE', r: 'KeyR', f: 'KeyF', 3: 'Digit3', 4: 'Digit4', 5: 'Digit5', 6: 'Digit6' };
  let mb = null, stick = null, knob = null, zone = null, skills = null, page = 0, moved = [], unread = 0, lineT = 0;
  const S = { id: null, x0: 0, y0: 0, vx: 0, vy: 0, active: false };
  function build() {
    const hud = $('hud');
    if (!hud || built) return;
    mb = document.createElement('div');
    mb.id = 'mb';
    mb.innerHTML =
      '<div class="mb-zone" id="mb-zone"><div class="mb-stick" id="mb-stick"><i class="a u"></i><i class="a d"></i><i class="a l"></i><i class="a r"></i><b class="mb-knob" id="mb-knob"></b></div></div>' +
      '<button class="mb-chat" id="mb-chat" aria-label="แชท"><i></i><em class="mb-badge" id="mb-badge" hidden></em></button><div class="mb-chatline" id="mb-chatline" hidden></div>' +
      '<div class="mb-right" id="mb-right">' +
        '<div class="mb-items" id="mb-items"></div>' +
        '<div class="mb-skills" id="mb-skills"></div>' +
        '<button class="mb-page" id="mb-page" aria-label="สลับหน้าสกิล">1/2</button>' +
        `<button class="mb-attack" id="mb-attack" aria-label="โจมตี"><img id="mb-atkimg" src="${((NC.ASSET_MANIFEST || {}).ic_sword || {}).src || 'assets/ic_sword.png'}" alt=""><b id="mb-atktxt">โจมตี</b></button>` +
        '<button class="mb-act" id="mb-act" hidden><img id="mb-actimg" alt=""><b id="mb-acttxt"></b></button>' +
      '</div>' +
      '<button class="mb-menu" id="mb-menu" aria-label="เมนู"><i></i><i></i><i></i></button>' +
      '<div class="mb-pop" id="mb-pop" hidden><div class="mb-pop-in"><div class="mb-pop-top" id="mb-pop-top"><span>เมนู</span></div>' +
        '<div class="mb-pop-grid" id="mb-pop-grid"></div>' +
        '<div class="mb-pop-row"><button class="mb-pbtn" id="mb-sit">นั่งพัก</button><button class="mb-pbtn" id="mb-autoset">ตั้งค่า AUTO</button>' +
        '<button class="mb-pbtn" id="mb-full">เต็มจอ</button></div></div></div>' +
      '<div class="mb-exp" id="mb-exp"></div>';
    hud.appendChild(mb);
    stick = $('mb-stick'); knob = $('mb-knob'); zone = $('mb-zone'); skills = $('mb-skills');

    // the joystick: wherever the left thumb lands in its zone (near the resting stick: from there)
    zone.addEventListener('pointerdown', (e) => {
      if (!on || S.id !== null) return;
      e.preventDefault();
      try { zone.setPointerCapture(e.pointerId); } catch (err) { /* (a synthetic pointer) */ }
      const zr = zone.getBoundingClientRect(), sr = stick.getBoundingClientRect(), R = sr.width / 2;
      const cx = sr.left + R, cy = sr.top + R;
      S.id = e.pointerId; S.active = true;
      if (Math.hypot(e.clientX - cx, e.clientY - cy) < R * 1.4) { S.x0 = cx; S.y0 = cy; }
      else { S.x0 = clamp(e.clientX, zr.left + R, zr.right - R); S.y0 = clamp(e.clientY, zr.top + R, zr.bottom - R); }
      stick.style.left = S.x0 - zr.left - R + 'px'; stick.style.top = S.y0 - zr.top - R + 'px';
      stick.classList.add('on');
      moveStick(e.clientX, e.clientY);
    });
    zone.addEventListener('pointermove', (e) => { if (e.pointerId === S.id) moveStick(e.clientX, e.clientY); });
    const endStick = (e) => {
      if (e.pointerId !== S.id) return;
      S.id = null; S.active = false; S.vx = S.vy = 0;
      stick.classList.remove('on'); stick.style.left = stick.style.top = '';
      knob.style.transform = '';
    };
    zone.addEventListener('pointerup', endStick);
    zone.addEventListener('pointercancel', endStick);
    zone.addEventListener('lostpointercapture', endStick);

    // the right thumb
    holdKey($('mb-attack'), 'Space');
    const act = $('mb-act');
    holdKey(act, 'KeyB');
    $('mb-page').addEventListener('click', () => { page = page ? 0 : 1; skills.classList.toggle('p2', page === 1); $('mb-page').textContent = page ? '2/2' : '1/2'; });

    // the menu
    const pop = $('mb-pop');
    $('mb-menu').addEventListener('click', () => { pop.hidden = !pop.hidden; });
    pop.addEventListener('click', (e) => {
      if (e.target === pop) { pop.hidden = true; return; }
      if (e.target.closest('.mbtn, .mb-pbtn')) setTimeout(() => { pop.hidden = true; }, 0);
    });
    $('mb-sit').addEventListener('click', () => { press('KeyX'); release('KeyX'); });
    $('mb-autoset').addEventListener('click', () => { const g = G(); g.paused = NC.HUD.panel('autofarm', true); });
    $('mb-full').addEventListener('click', () => {
      const d = document;
      if (d.fullscreenElement) { if (d.exitFullscreen) d.exitFullscreen(); }
      else if (root.requestFullscreen) root.requestFullscreen().catch(() => {});
    });
    // the chat
    $('mb-chat').addEventListener('click', () => {
      const open = root.classList.toggle('mob-chat');
      if (open) { const l = $('cw-list'); if (l) l.scrollTop = l.scrollHeight; unread = 0; $('mb-badge').hidden = true; $('mb-chatline').hidden = true; }
    });
    // the newest chat line beside the button, the unread count on it (js/chat.js adds the lines to #cw-list)
    const list = $('cw-list');
    if (list) new MutationObserver((recs) => {
      if (!on || root.classList.contains('mob-chat')) return;
      let added = 0;
      for (const r of recs) added += [...r.addedNodes].filter((n) => n.nodeType === 1).length;
      if (!added) return;
      unread = Math.min(99, unread + added);
      const b = $('mb-badge'); b.textContent = unread; b.hidden = false;
      const last = list.lastElementChild, line = $('mb-chatline');
      line.textContent = last ? last.textContent.replace(/\s+/g, ' ').trim() : '';
      line.hidden = !line.textContent;
      clearTimeout(lineT); lineT = setTimeout(() => { line.hidden = true; }, 6000);
    }).observe(list, { childList: true });

    // taps on the world
    const view = $('view');
    let t0 = null;
    view.addEventListener('touchstart', (e) => {
      if (!on) return;
      e.preventDefault(); // (no page zoom or scroll, no emulated mouse clicks)
      const t = e.changedTouches[0];
      if (!t0) t0 = { id: t.identifier, x: t.clientX, y: t.clientY, at: performance.now(), far: false };
    }, { passive: false });
    view.addEventListener('touchmove', (e) => {
      if (!on || !t0) return;
      e.preventDefault();
      for (const t of e.changedTouches) if (t.identifier === t0.id && Math.hypot(t.clientX - t0.x, t.clientY - t0.y) > 16) t0.far = true;
    }, { passive: false });
    view.addEventListener('touchend', (e) => {
      if (!on || !t0) return;
      e.preventDefault();
      for (const t of e.changedTouches) if (t.identifier === t0.id) {
        const tap = !t0.far && performance.now() - t0.at < 450;
        const x = t.clientX, y = t.clientY;
        t0 = null;
        if (tap) tapAt(x, y);
      }
    }, { passive: false });
    view.addEventListener('touchcancel', () => { t0 = null; });

    built = true;
    if (on) place(true);
  }
  function moveStick(x, y) {
    const R = stick.getBoundingClientRect().width / 2;
    let dx = x - S.x0, dy = y - S.y0;
    const d = Math.hypot(dx, dy), max = R * 0.62;
    if (d > max) { dx = (dx / d) * max; dy = (dy / d) * max; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    const k = d / max;
    if (k < 0.2) { S.vx = S.vy = 0; } else { S.vx = dx / max; S.vy = dy / max; }
  }

  // a tap on the world: a monster -> the target; anything else -> a click there (the NPCs, the life nodes, shop signs)
  function tapAt(x, y) {
    const g = G(), p = g && g.player;
    if (!p || g.paused) return;
    const wx = g.cam.x + (x * g.dpr) / g.scale, wy = g.cam.y + (y * g.dpr) / g.scale;
    let best = null, bd = 1e9;
    for (const e of g.enemies) {
      if (e.dead) continue;
      const dx = wx - e.x, dy = wy - (e.y - 60), r = Math.max(70, (e.r || 26) * 2);
      if (Math.abs(dx) < r && dy > -r * 2.2 && dy < r && Math.abs(dx) + Math.abs(dy) < bd) { bd = Math.abs(dx) + Math.abs(dy); best = e; }
    }
    if (best) {
      g.target = best; g.targetT = g.time; locked = best;
      if (NC.Auto && NC.Auto.on && NC.Auto.pick && NC.Auto.pick(g, best)) return; // (AUTO hunts it next: js/autofarm.js)
      if (NC.FX) NC.FX.ring(best.x, best.y, 10, 90, '255,216,115', 0.35, 5);
      return;
    }
    const view = $('view');
    const o = { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, buttons: 1, view: window };
    view.dispatchEvent(new MouseEvent('mousedown', o));
    view.dispatchEvent(new MouseEvent('mouseup', Object.assign(o, { buttons: 0 })));
  }

  // ---------------- moving the HUD's own pieces in and out ----------------
  function keep(el, into) { if (!el) return; moved.push([el, el.parentNode, el.nextSibling]); into.appendChild(el); }
  function place(yes) {
    if (!built) return;
    releaseAll();
    if (!yes) {
      for (const [el, parent, next] of moved.reverse()) parent.insertBefore(el, next && next.parentNode === parent ? next : null);
      moved = [];
      $('mb-pop').hidden = true;
      root.classList.remove('mob-chat');
      return;
    }
    if (moved.length) return;
    const hud = $('hud');
    // the 8 skill slots round ATTACK, the two potions above them
    for (const k of NC.HOTKEYS || []) {
      const s = $('hs-' + k);
      if (!s) continue;
      keep(s, skills);
      if (!s._mb) { s._mb = true; s.dataset.code = SLOT_CODE[k]; holdKey(s, SLOT_CODE[k]); }
    }
    const items = hud.querySelectorAll('.hotbar .hslot.item');
    [...items].forEach((s, i) => {
      keep(s, $('mb-items'));
      const code = i ? 'Digit2' : 'Digit1';
      if (!s._mb) { s._mb = true; holdKey(s, code); }
    });
    keep(hud.querySelector('.af'), $('mb-items'));
    keep(hud.querySelector('.expbars'), $('mb-exp'));
    keep(hud.querySelector('.menubar'), $('mb-pop-grid'));
    // (the window buttons get their names under them in the grid: the title without its key)
    for (const b of $('mb-pop-grid').querySelectorAll('.mbtn')) if (!b.querySelector('.mb-lbl')) {
      const t = b.dataset.panel === 'pause' ? 'ตั้งค่า' : (b.title || '').replace(/\s*\([^)]*\)\s*$/, '').split(/[:/·]/)[0].trim();
      if (t) { const l = document.createElement('span'); l.className = 'mb-lbl'; l.textContent = t; b.appendChild(l); }
    }
    keep(hud.querySelector('.coins'), $('mb-pop-top'));
    skills.classList.toggle('p2', page === 1);
  }

  // ---------------- every frame ----------------
  let locked = null, lastAct = '', lastAtk = '', lastP2 = null, lastParty = null;
  const baseUpdate = NC.updatePlayer;
  NC.updatePlayer = function (game, dt) {
    if (on && game.player) {
      const I = game.input, p = game.player;
      if (S.active && (S.vx || S.vy)) { I.mx = S.vx; I.my = S.vy; }
      if (!(NC.Auto && NC.Auto.on)) aim(game, p);
    }
    return baseUpdate.apply(this, arguments);
  };
  // aim: the locked target, else the nearest monster near (it becomes the target); none: the way we walk. While walking
  // without attacking the hero faces the way he goes (no walking backwards); an attack or a skill turns him to the target
  function aim(game, p) {
    const M = game.mouse;
    if (locked && (locked.dead || !game.enemies.includes(locked) || NC.dist(p.x, p.y, locked.x, locked.y) > 900)) locked = null;
    let t = locked;
    if (!t) {
      let bd = 470;
      for (const e of game.enemies) {
        if (e.dead || (e.passive && !e.angry)) continue;
        const d = NC.dist(p.x, p.y, e.x, e.y);
        if (d < bd) { bd = d; t = e; }
      }
    }
    const fighting = [...down].some((c) => FIGHT[c]) || performance.now() - fightAt < 900 || !(S.active && (S.vx || S.vy));
    if (t) { game.target = t; game.targetT = game.time; }
    if (t && fighting) { M.active = true; M.wx = t.x; M.wy = t.y - 50; }
    else M.active = false;
  }
  // the HUD: the action button, the page button, the attack button's look during a life skill
  const baseHud = NC.HUD.update.bind(NC.HUD);
  NC.HUD.update = function (game) {
    baseHud(game);
    if (!on || !built) return;
    const p = game.player, L = NC.Life;
    // life skills: ATTACK strikes (the tool's picture on it)
    const busy = p && (p.lifeAct || p.fishAct);
    let atk = 'sword';
    if (busy && L) {
      const tool = p.lifeAct ? p.lifeAct.tool : 'rod', T = L.TOOLS[tool];
      atk = T ? L.lifeIcon(T.sprite(L.toolTier(p, tool))) : 'sword';
    }
    if (atk !== lastAtk) {
      lastAtk = atk;
      $('mb-atkimg').src = atk === 'sword' ? (((NC.ASSET_MANIFEST || {}).ic_sword || {}).src || 'assets/ic_sword.png') : atk;
      $('mb-atktxt').textContent = atk === 'sword' ? 'โจมตี' : 'กด!';
      $('mb-attack').classList.toggle('life', atk !== 'sword');
    }
    // something to use near us: a teacher, a node (tree, vein, water, a garden plot), Uncle Coco
    let label = '', img = '';
    if (p && !busy && p.dead <= 0 && L) {
      const m = L.mentors.find((q) => q.here(game) && NC.dist(p.x, p.y, q.x, q.y) < 180);
      const n = L.nearest ? L.nearest(game, p) : null;
      if (m && (!n || NC.dist(p.x, p.y, m.x, m.y) <= NC.dist(p.x, p.y, n.x, n.y))) { label = 'คุย'; img = L.lifeIcon(m.sprite) || ''; }
      else if (n) {
        label = n.verb || 'ใช้';
        const T = L.TOOLS[(L.SKILLS[n.skill] || {}).tool];
        img = T ? L.lifeIcon(T.sprite(L.toolTier(p, L.SKILLS[n.skill].tool))) : '';
      }
    }
    const sh = NC.Shop;
    if (!label && p && sh && game.world && game.world.shop && NC.dist(p.x, p.y, sh.npc.x, sh.npc.y) < sh.talk + 30) { label = 'ค้าขาย'; img = NC.matIcon ? NC.matIcon('ic_coin') : ''; }
    const key = label + '|' + img;
    if (key !== lastAct) {
      lastAct = key;
      const act = $('mb-act');
      act.hidden = !label;
      $('mb-acttxt').textContent = label;
      const im = $('mb-actimg');
      if (img) { im.src = img; im.hidden = false; } else im.hidden = true;
    }
    // a party: the target frame moves out of its way (portrait). Any party list: the AI friends' (js/party.js) or the real
    // party's (js/partylist.js, 2026-10-19: taller now, with my own card)
    const party = !!document.querySelector('#hud .partybox:not([hidden])');
    if (party !== lastParty) { lastParty = party; root.classList.toggle('mb-party', party); }
    // the page button only when slots 5-8 hold something
    const p2 = ['3', '4', '5', '6'].some((k) => { const s = $('hs-' + k); return s && !s.classList.contains('empty'); });
    if (p2 !== lastP2) { lastP2 = p2; $('mb-page').hidden = !p2; if (!p2 && page) $('mb-page').click(); }
  };

  // ---------------- start: after every file has built its HUD pieces ----------------
  const baseInit = NC.HUD.init.bind(NC.HUD);
  NC.HUD.init = function (game) {
    baseInit(game);
    build();
    if (on) {
      // a phone: no pinch zoom, the notch areas usable
      const meta = document.querySelector('meta[name=viewport]');
      if (meta) meta.content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover';
    }
  };
  // (a window opening closes the menu grid)
  const basePanel = NC.HUD.panel.bind(NC.HUD);
  NC.HUD.panel = function () { const pop = $('mb-pop'); if (pop) pop.hidden = true; releaseAll(); return basePanel.apply(this, arguments); };
})();
