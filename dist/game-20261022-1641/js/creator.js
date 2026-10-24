/* creator.js — the character creator: a full screen in the camp's dressing tent (assets/look/creator_bg.jpg) with the
   hero standing on the rug (drawn live, breathing, turning, cheering) and the choices around it: boy / girl, the
   hairstyle and its colour, the eyes and their colour, the mouth, the name. The look is made by js/look.js and worn
   as the hair_look item. Opens for a new hero (NC.HUD.askName; the old name box is gone), once for a hero made
   before the creator existed, and from the menu (ESC > ปรับแต่งตัวละคร). ?create opens it (testing).
   Load after hud.js. The screen is built here (css/creator.css); keys don't reach the game while it is open. */
(function () {
  'use strict';
  const NC = window.NC;
  const LK = NC.Look;
  if (!LK) return;
  const SEEN = 'nightcamp.creator.seen';
  const LOOK_WAIT_MS = 250; // a new hero before the look sheet has loaded: how often askName tries the creator again
  const NAMES = ['ข้าวปั้น', 'โมจิ', 'ต้นกล้า', 'ฟ้าใส', 'ลูกไฟ', 'มะปราง', 'ส้มโอ', 'กะทิ', 'ทับทิม', 'ดาวเหนือ', 'ขนมปัง', 'ใบเตย',
    'พายุ', 'ก้อนเมฆ', 'จันทร์เจ้า', 'ลูกพีช', 'เมเปิ้ล', 'หมอกควัน', 'สายรุ้ง', 'แสนดี', 'น้ำหวาน', 'ภูผา'];

  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
  let root = null, cv = null, ctx = null, game = null, mode = 'new', look = null, name = '', face = 1;
  let t = 0, act = null, actT = 0, spin = 0, spinDir = 0, last = 0, running = false, showHat = false, bgImg = null;
  let locked = false, sending = false; // (the name can't be changed / the server is making the hero)
  const ui = {};

  // ---------------- the screen ----------------
  function build() {
    root = el('div', 'cr-root');
    root.hidden = true;
    root.innerHTML = `
      <img class="cr-bg" src="assets/look/creator_bg.jpg" alt="">
      <div class="cr-shade"></div>
      <canvas class="cr-stage"></canvas>
      <div class="cr-title"><span>สร้างตัวละคร</span></div>
      <div class="cr-side">
      <section class="cr-panel cr-left">
        <div class="cr-sec">
          <h3>เพศ</h3>
          <div class="cr-gender">
            <button data-g="m"><i>♂</i>ชาย</button>
            <button data-g="f"><i>♀</i>หญิง</button>
          </div>
        </div>
        <div class="cr-sec">
          <h3>ทรงผม <em class="cr-hair-name"></em></h3>
          <div class="cr-grid cr-hairs"></div>
        </div>
        <div class="cr-sec cr-prem-sec">
          <h3 class="cr-prem-h">✦ ทรงผมพรีเมียม <em class="cr-prem-name"></em></h3>
          <div class="cr-grid cr-hairs cr-prem"></div>
        </div>
        <div class="cr-sec">
          <h3>สีผม <em class="cr-hc-name"></em></h3>
          <div class="cr-swatches cr-hcs"></div>
        </div>
      </section>
      <section class="cr-panel cr-right">
        <div class="cr-sec">
          <h3>ดวงตา <em class="cr-eyes-name"></em></h3>
          <div class="cr-grid cr-eyes"></div>
        </div>
        <div class="cr-sec">
          <h3>สีตา <em class="cr-ec-name"></em></h3>
          <div class="cr-swatches cr-ecs"></div>
        </div>
        <div class="cr-sec">
          <h3>ปาก <em class="cr-mouth-name"></em></h3>
          <div class="cr-grid cr-mouths"></div>
        </div>
      </section>
      </div>
      <div class="cr-turn">
        <button class="cr-round" data-turn="-1" title="หันซ้าย">◀</button>
        <button class="cr-pill cr-emote" title="ลองท่าทาง">ท่าทาง ✦</button>
        <button class="cr-pill cr-hat" title="ใส่ / ถอดหมวก" hidden>หมวก</button>
        <button class="cr-round" data-turn="1" title="หันขวา">▶</button>
      </div>
      <div class="cr-bottom">
        <div class="cr-name">
          <span class="cr-count"></span>
          <input class="cr-input" maxlength="16" autocomplete="off" spellcheck="false" placeholder="ตั้งชื่อตัวละคร...">
          <button class="cr-dice" title="สุ่มชื่อ">🎲</button>
        </div>
        <div class="cr-err"></div>
        <div class="cr-actions">
          <button class="cr-btn cr-random">🎲 สุ่มหน้าตา</button>
          <button class="cr-btn cr-cancel">ยกเลิก</button>
          <button class="cr-btn cr-go">เริ่มผจญภัย ▶</button>
        </div>
      </div>
      <div class="cr-ask" hidden>
        <div class="cr-ask-box" role="dialog" aria-label="ยืนยันชื่อตัวละคร">
          <div class="cr-ask-q"></div>
          <div class="cr-ask-note">ชื่อตั้งได้ครั้งเดียว สร้างแล้วเปลี่ยนไม่ได้</div>
          <div class="cr-ask-btns">
            <button class="cr-btn cr-ask-no">แก้ชื่อ</button>
            <button class="cr-btn cr-go cr-ask-yes">ยืนยัน สร้างเลย</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(root);
    const q = (s) => root.querySelector(s);
    Object.assign(ui, {
      hairs: q('.cr-hairs:not(.cr-prem)'), prem: q('.cr-prem'), premSec: q('.cr-prem-sec'), premName: q('.cr-prem-name'), hcs: q('.cr-hcs'), eyes: q('.cr-eyes'), ecs: q('.cr-ecs'), mouths: q('.cr-mouths'),
      hairName: q('.cr-hair-name'), hcName: q('.cr-hc-name'), eyesName: q('.cr-eyes-name'), ecName: q('.cr-ec-name'), mouthName: q('.cr-mouth-name'),
      input: q('.cr-input'), err: q('.cr-err'), go: q('.cr-go'), cancel: q('.cr-cancel'), title: q('.cr-title span'), hat: q('.cr-hat'),
      turn: q('.cr-turn'), titleBox: q('.cr-title'), count: q('.cr-count'), dice: q('.cr-dice'),
      ask: q('.cr-ask'), askQ: q('.cr-ask-q'),
    });
    cv = q('.cr-stage'); ctx = cv.getContext('2d');
    bgImg = q('.cr-bg');
    bgImg.addEventListener('load', () => root.classList.add('bg-on'));
    if (bgImg.complete && bgImg.naturalWidth) root.classList.add('bg-on');

    root.querySelectorAll('.cr-gender button').forEach((b) => b.addEventListener('click', () => setGender(b.dataset.g)));
    root.querySelectorAll('[data-turn]').forEach((b) => b.addEventListener('click', () => turn(Number(b.dataset.turn))));
    q('.cr-emote').addEventListener('click', emote);
    ui.hat.addEventListener('click', () => { showHat = !showHat; ui.hat.classList.toggle('on', showHat); refreshPreview(); });
    q('.cr-random').addEventListener('click', () => { look = LK.random(look.g); refreshAll(); play('cheer'); });
    ui.dice.addEventListener('click', () => { if (ui.input.readOnly) return; ui.input.value = NAMES[Math.floor(Math.random() * NAMES.length)]; check(); });
    ui.input.addEventListener('input', check);
    ui.go.addEventListener('click', confirm);
    // The online lobby wraps close to return to its slots instead of revealing the unnamed preview world.
    ui.cancel.addEventListener('click', () => { if (!sending) NC.Creator.close(false); });
    q('.cr-ask-no').addEventListener('click', () => askSure(null));
    q('.cr-ask-yes').addEventListener('click', sure);
    // while open, no key reaches the game (Enter: done, Esc: back out when there is a way back; in the name box: yes / no)
    addEventListener('keydown', (e) => {
      if (!root || root.hidden) return;
      e.stopPropagation();
      if (!ui.ask.hidden) {
        if (e.key === 'Enter' && !e.repeat) { e.preventDefault(); sure(); }
        else if (e.key === 'Escape') askSure(null);
        return;
      }
      if (e.key === 'Enter' && !e.repeat) { e.preventDefault(); confirm(); }
      else if (e.key === 'Escape' && !ui.cancel.hidden && !sending) NC.Creator.close(false);
    }, true);
    addEventListener('keyup', (e) => { if (root && !root.hidden) e.stopPropagation(); }, true);
    addEventListener('resize', () => { if (root && !root.hidden) layoutThumbs(); });
  }

  // ---------------- the choices ----------------
  const DPR = () => Math.min(2, window.devicePixelRatio || 1);
  function option(list, cls, pick, sel, label) {
    const b = el('button', 'cr-opt ' + cls);
    b.title = label;
    b.dataset.id = sel;
    b.appendChild(el('canvas'));
    b.addEventListener('click', pick);
    list.appendChild(b);
    return b;
  }
  function fillLists() {
    const g = look.g;
    ui.hairs.innerHTML = ''; ui.prem.innerHTML = ''; ui.eyes.innerHTML = ''; ui.mouths.innerHTML = ''; ui.hcs.innerHTML = ''; ui.ecs.innerHTML = '';
    for (const [id, nm] of LK.HAIRS[g]) option(ui.hairs, 'hair', () => { look.hair = id; refreshAll(); play('fidgetLook'); }, id, nm);
    // premium: picked with its own colour, a cheer and a burst of sparkles
    for (const [id, nm, hc] of LK.PREMIUM[g]) option(ui.prem, 'hair prem', () => {
      const again = look.hair === id;
      look.hair = id;
      if (hc && !again) look.hc = hc;
      refreshAll(); play('cheer'); burst();
    }, id, nm);
    ui.premSec.hidden = !LK.PREMIUM[g].length;
    for (const [id, nm] of LK.EYES[g]) option(ui.eyes, 'eyes', () => { look.eyes = id; refreshAll(); }, id, nm);
    for (const [id, nm] of LK.MOUTHS) option(ui.mouths, 'mouth', () => { look.mouth = id; refreshAll(); }, id, nm);
    for (const c of LK.HAIR_COLORS) swatch(ui.hcs, c, () => { look.hc = c[0]; refreshAll(); });
    for (const c of LK.EYE_COLORS) swatch(ui.ecs, c, () => { look.ec = c[0]; refreshAll(); });
  }
  function swatch(list, c, pick) {
    const b = el('button', 'cr-sw');
    b.title = c[1]; b.dataset.id = c[0];
    b.style.setProperty('--c', LK.swatch(c));
    b.addEventListener('click', pick);
    list.appendChild(b);
  }
  // the pictures on the buttons: drawn at the button's size (they change with the colours and the face)
  function layoutThumbs() {
    const d = DPR();
    root.querySelectorAll('.cr-opt').forEach((b) => {
      const c = b.firstChild, r = b.getBoundingClientRect(), w = Math.max(8, Math.round(r.width * d)), h = Math.max(8, Math.round(r.height * d));
      if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    });
    drawThumbs();
  }
  function drawThumbs() {
    root.querySelectorAll('.cr-opt').forEach((b) => {
      const id = b.dataset.id;
      if (b.classList.contains('hair')) LK.thumb(b.firstChild, Object.assign({}, look, { hair: id }), 'head');
      else if (b.classList.contains('eyes')) LK.thumb(b.firstChild, Object.assign({}, look, { eyes: id }), 'eyes');
      else LK.thumb(b.firstChild, Object.assign({}, look, { mouth: id }), 'mouth');
    });
  }
  function mark() {
    const on = (list, id) => list.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.id === id));
    on(ui.hairs, look.hair); on(ui.prem, look.hair); on(ui.eyes, look.eyes); on(ui.mouths, look.mouth); on(ui.hcs, look.hc); on(ui.ecs, look.ec);
    root.querySelectorAll('.cr-gender button').forEach((b) => b.classList.toggle('on', b.dataset.g === look.g));
    const nm = (list, id) => (list.find((o) => o[0] === id) || ['', ''])[1];
    ui.hairName.textContent = nm(LK.HAIRS.m.concat(LK.HAIRS.f), look.hair);
    ui.premName.textContent = nm(LK.PREMIUM.m.concat(LK.PREMIUM.f), look.hair);
    ui.eyesName.textContent = nm(LK.EYES.m.concat(LK.EYES.f), look.eyes);
    ui.mouthName.textContent = nm(LK.MOUTHS, look.mouth);
    ui.hcName.textContent = nm(LK.HAIR_COLORS, look.hc);
    ui.ecName.textContent = nm(LK.EYE_COLORS, look.ec);
  }
  function setGender(g) {
    if (look.g === g) return;
    // the other set of hairstyles and eyes, starting from that set's usual face (the colours stay)
    const d = LK.DEFAULTS[g];
    look = Object.assign({}, look, { g, hair: d.hair, eyes: d.eyes, mouth: d.mouth });
    fillLists();
    refreshAll();
    requestAnimationFrame(layoutThumbs);
    play('cheer');
  }
  let previewId = null;
  function refreshPreview() { previewId = LK.preview(look); }
  function refreshAll() {
    look = LK.clean(look);
    refreshPreview();
    mark();
    drawThumbs();
  }

  // ---------------- the hero on the rug ----------------
  // sparkles round the head (a premium hairstyle picked): x, y relative to the head's middle, in head widths
  const sparks = [];
  function burst() {
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2, r = 0.35 + Math.random() * 0.55;
      sparks.push({ x: Math.cos(a) * r, y: Math.sin(a) * r * 0.9 - 0.1, vx: Math.cos(a) * 0.25, vy: -0.2 - Math.random() * 0.35,
        t: -Math.random() * 0.35, life: 0.8 + Math.random() * 0.7, s: 0.03 + Math.random() * 0.045, gold: Math.random() < 0.65 });
    }
  }
  function drawSparks(dt, hx, hy, hw) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i];
      p.t += dt;
      if (p.t < 0) continue;
      if (p.t > p.life) { sparks.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      const k = p.t / p.life, a = Math.sin(Math.PI * k), R = p.s * hw * (0.6 + 0.4 * Math.sin(p.t * 14)), x = hx + p.x * hw, y = hy + p.y * hw;
      ctx.fillStyle = p.gold ? `rgba(255,214,110,${a})` : `rgba(255,255,255,${a})`;
      ctx.beginPath(); // a four-pointed star
      for (let j = 0; j < 8; j++) { const rr = j % 2 ? R * 0.28 : R, aa = (j * Math.PI) / 4; ctx.lineTo(x + Math.cos(aa) * rr, y + Math.sin(aa) * rr); }
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  // (the hero rig, js/herospine.js, draws him as in the game - the user, 2026-10-18: "หน้าแต่งตัวตัวละครยังเป็นกระดูกเก่านะ":
  // then a cheer is his weapon's third attack, as the game plays a cheer; the fidgets keep him standing; the button plays
  // his weapon's three attacks in turn - empty-handed, the fighting stance)
  let rigAct = null, rigT = 0;
  const rigOn = () => { const HSp = NC.HeroSpine; return !!(HSp && HSp.canPreview && HSp.canPreview(equipNow())); };
  function rigPlay(n) {
    const eq = equipNow(), atk = eq.weapon ? NC.HeroSpine.moves(eq).filter((m) => /^ตี/.test(m.label)) : [];
    rigAct = atk.length ? atk[(n - 1) % atk.length] : { clip: 'ready', d: 1.6 };
    rigT = 0; act = null;
  }
  function play(name) {
    if (rigOn()) { if (name === 'cheer') rigPlay(3); return; }
    if (NC.Anim.CLIPS[name]) { act = name; actT = 0; }
  }
  const EMOTES = ['cheer', 'fidgetStretch', 'fidgetLook'];
  let emoteI = 0;
  function emote() {
    if (rigOn()) { rigPlay(1 + (emoteI++ % 3)); return; }
    play(EMOTES[emoteI++ % EMOTES.length]);
  }
  function turn(dir) { if (!spinDir) { spinDir = dir; spin = 0; } }
  function equipNow() {
    const p = game.player;
    return Object.assign({}, p.equip, { hair: previewId || p.equip.hair, hat: showHat ? p.equip.hat : null });
  }
  // where the rug is on the screen (the picture is drawn with object-fit: cover, object-position 50% 62%)
  function rugAt(W, H) {
    const iw = (bgImg && bgImg.naturalWidth) || 1672, ih = (bgImg && bgImg.naturalHeight) || 941;
    const k = Math.max(W / iw, H / ih), ox = (W - iw * k) * 0.5, oy = (H - ih * k) * 0.62;
    return [ox + 0.5 * iw * k, oy + 0.795 * ih * k, k];
  }
  function draw(dt) {
    const d = DPR(), W = Math.round(cv.clientWidth * d), H = Math.round(cv.clientHeight * d);
    if (!W || !H) return;
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    ctx.clearRect(0, 0, W, H);
    t += dt;
    const eq = equipNow(), c = NC.animCtx(eq);
    let P;
    if (act) {
      const clip = NC.Anim.CLIPS[act];
      actT += dt;
      if (actT >= clip.dur) act = null;
      P = act ? NC.Anim.sample(act, actT, c, 'idle') : NC.Anim.sample('idle', t, c);
    } else P = NC.Anim.sample('idle', t, c);
    // a turn: the cut-out spins round (avatar.js narrows it and flips it over half way)
    if (spinDir) {
      spin += dt / 0.42;
      if (spin >= 1) { face = spinDir; spinDir = 0; spin = 0; }
    }
    P.face = spinDir ? -spinDir : face;
    if (spinDir) P.turn = Math.PI * spin;
    // the hero: about half the screen tall, feet on the middle of the rug (on a tall narrow screen: above the menus)
    const narrow = root.classList.contains('narrow');
    let [x, y] = rugAt(W, H);
    // how tall the hero is with this hair (the head picture's top edge, over the feet)
    const spot = NC.headSpot(eq), HS = NC.SPR[(NC.ITEMS[eq.hair] || {}).head] || null;
    let top = spot.y - spot.w * 0.75;
    if (HS && HS.head) { const hw = HS.head[2] * HS.w, k = spot.w / hw; top = spot.y - (HS.head[1] * HS.h + 0.55 * hw) * k; }
    const tall = -top;
    const tr = ui.turn.getBoundingClientRect(), tb = ui.titleBox.getBoundingClientRect();
    y = Math.min(y, (tr.top - 6) * d);
    if (narrow) x = W / 2;
    const room = y - (tb.bottom + 34) * d; // (the name tag goes over the head)
    const s = Math.max(0.5, Math.min((narrow ? 0.34 : 0.52) * H, room) / tall);
    // a soft light and the shadow on the rug
    const g = ctx.createRadialGradient(x, y - tall * s * 0.45, 0, x, y - tall * s * 0.45, tall * s * 0.9);
    g.addColorStop(0, 'rgba(255,220,150,0.20)'); g.addColorStop(1, 'rgba(255,220,150,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(40,20,20,0.28)';
    ctx.beginPath(); ctx.ellipse(x, y, 44 * s, 11 * s, 0, 0, Math.PI * 2); ctx.fill();
    if (rigAct) { rigT += dt; if (rigT >= rigAct.d + 0.2) rigAct = null; }
    const HSp = NC.HeroSpine, ro = { t: rigAct ? rigT : t, clip: rigAct ? rigAct.clip : 'idle', face: P.face, turn: P.turn, key: 'creator' };
    if (act || !(HSp && HSp.preview && HSp.preview(ctx, eq, x, y, s, ro))) NC.drawHero(ctx, eq, P, x, y, { scale: s });
    if (sparks.length) drawSparks(dt, x + spot.x * s * (P.face < 0 ? -1 : 1), y + spot.y * s, spot.w * s);
    // the name over the head, like in the game
    const nm = (ui.input.value || '').trim();
    if (nm) {
      const fy = y + top * s - 10 * d;
      ctx.font = `600 ${Math.round(20 * d * Math.min(1.4, s / 2.2))}px Mitr, sans-serif`;
      ctx.textAlign = 'center'; ctx.lineJoin = 'round';
      ctx.lineWidth = 5 * d; ctx.strokeStyle = '#2a2435'; ctx.strokeText(nm, x, fy);
      ctx.fillStyle = '#fff3cf'; ctx.fillText(nm, x, fy);
    }
  }
  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    draw(dt);
  }

  // ---------------- open / done ----------------
  function open(g, opts) {
    if (!LK.ready()) return false;
    if (!root) build();
    game = g;
    mode = (opts && opts.mode) || (g.player.name ? 'edit' : 'new');
    const pause = document.getElementById('pause');
    if (pause) pause.hidden = true;
    look = LK.clean(LK.mine || LK.DEFAULTS.m);
    ui.input.value = g.player.name || '';
    ui.err.textContent = '';
    ui.title.textContent = mode === 'new' ? 'สร้างตัวละคร' : 'ปรับแต่งตัวละคร';
    ui.cancel.hidden = mode === 'new';
    ui.cancel.textContent = mode === 'first' ? 'ข้าม' : 'ยกเลิก';
    // online a hero's name is given once (backend hero_name.go): the dressing room shows it, it can't be typed over
    locked = !!(NC.Creator.online && mode !== 'new' && g.player.name && g.player.name !== 'Traveler');
    ui.input.readOnly = locked;
    root.classList.toggle('name-locked', locked);
    if (locked) ui.title.textContent = 'ปรับแต่งหน้าตา';
    ui.ask.hidden = true;
    sending = false; busyUi();
    showHat = false;
    ui.hat.hidden = !g.player.equip.hat;
    ui.hat.classList.remove('on');
    root.classList.toggle('narrow', innerWidth < innerHeight * 0.95);
    fillLists();
    refreshAll();
    root.hidden = false;
    requestAnimationFrame(() => { layoutThumbs(); root.classList.add('in'); });
    g.paused = true;
    face = 1; act = null; rigAct = null; spinDir = 0; t = 0;
    play('cheer');
    if (!running) { running = true; last = performance.now(); requestAnimationFrame(frame); }
    if (mode === 'new') setTimeout(() => ui.input.focus(), 400);
    check();
    return true;
  }
  function close(saved) {
    if (!root || root.hidden) return;
    if (game && !game.noSave) { try { localStorage.setItem(SEEN, '1'); } catch (e) { /* storage blocked */ } }
    root.classList.remove('in');
    root.hidden = true;
    running = false;
    if (game) game.paused = false;
    if (!saved && mode === 'first' && NC.HUD) NC.HUD.log('ปรับหน้าตาได้ทุกเมื่อที่เมนู (ESC) > ปรับแต่งตัวละคร', 'sys');
  }
  // ---------------- the name: no hero without one ----------------
  // Checked as the player types: the start button stays off until the name is good, and the line under the box says why.
  // The server checks again (backend character_customization.go createAppearance: 2-16 runes, no < > or control
  // characters; wordfilter.go: no rude or reserved words such as GM / แอดมิน / ทีมงาน, and not its default "Traveler").
  // Here a little stricter, as online games are: Thai or English letters, digits and single spaces, at least one letter,
  // no Thai vowel or tone mark without its consonant, no marks piled up.
  const cleanName = (s) => String(s || '').trim().replace(/\s+/g, ' ');
  function nameProblem(n) {
    const len = [...n].length;
    if (!len) return 'ตั้งชื่อตัวละครก่อนเริ่มผจญภัย';
    if (len < 2) return 'ชื่อต้องยาวอย่างน้อย 2 ตัวอักษร';
    if (len > 16) return 'ชื่อยาวได้ไม่เกิน 16 ตัวอักษร';
    if (!/^[\p{Script=Thai}A-Za-z0-9 ]+$/u.test(n)) return 'ใช้ได้เฉพาะอักษรไทย อังกฤษ ตัวเลข และเว้นวรรค';
    if (!/\p{L}/u.test(n)) return 'ชื่อต้องมีตัวอักษรอย่างน้อย 1 ตัว';
    if (/(^| )\p{M}/u.test(n)) return 'สระหรือวรรณยุกต์ต้องตามหลังพยัญชนะ';
    if (/\p{M}{3,}|(\p{M})\1/u.test(n)) return 'สระหรือวรรณยุกต์ซ้อนกันเกินไป';
    if (n.toLowerCase() === 'traveler') return 'ชื่อนี้สงวนไว้ ใช้ไม่ได้';
    return '';
  }
  // the name as it stands (a hero's own old name always passes: an old save may have been named under looser rules)
  const problemNow = () => { const n = cleanName(ui.input.value); return locked || (mode !== 'new' && n && n === game.player.name) ? '' : nameProblem(n); };
  function say(t, bad) { ui.err.textContent = t || ''; ui.err.classList.toggle('soft', !bad); }
  function check() {
    const n = cleanName(ui.input.value), len = [...n].length, why = problemNow();
    ui.count.textContent = locked ? '' : len + '/16';
    ui.count.classList.toggle('full', len >= 16);
    ui.go.disabled = sending || !!why;
    if (locked) say('ชื่อตั้งได้ครั้งเดียว เปลี่ยนไม่ได้ · ปรับได้แค่หน้าตา');
    else say(why, !!why && !!n);
  }
  function bad(t) {
    say(t, true);
    if (!ui.input.readOnly) ui.input.focus();
    ui.err.classList.remove('cr-shake'); void ui.err.offsetWidth; ui.err.classList.add('cr-shake');
  }
  const goLabel = () => (mode === 'new' ? 'เริ่มผจญภัย ▶' : 'บันทึก ✔');
  function busyUi() {
    ui.go.textContent = sending ? (mode === 'new' ? 'กำลังสร้างตัวละคร…' : 'กำลังบันทึก…') : goLabel();
    ui.go.disabled = sending || !!problemNow();
    ui.cancel.disabled = sending;
    root.classList.toggle('sending', sending);
  }

  // Online (NC.Creator.online, set by js/online/lobby.js and js/online/flow.js) the server makes or dresses the hero:
  // create({ name, look }) / dress({ name, look }) answer a promise; a refusal stays here, under the name, to be fixed.
  // A new hero's name is asked once more first (it is for good).
  function confirm() {
    if (sending) return;
    const n = cleanName(ui.input.value), why = problemNow();
    if (why) { bad(why); return; }
    const on = NC.Creator.online, send = on && (mode === 'new' ? on.create : on.dress);
    if (send) { if (mode === 'new') askSure(n); else toServer(send, n); return; }
    const p = game.player, first = !p.name;
    p.name = n;
    LK.wear(game, look);
    close(true);
    if (NC.HUD) NC.HUD.log(first ? `ยินดีต้อนรับ ${n}! ปราบมอนสเตอร์เพื่อเก็บ EXP แล้วอัพสเตตัส (C) และสกิล (K)` : `บันทึกหน้าตาของ ${n} แล้ว`, 'sys');
    if (NC.FX && NC.FX.stars) NC.FX.stars(p.x, p.y - 70, 16, '255,230,150', { speed: 240, size: 0.9 });
  }
  let asking = '';
  function askSure(n) {
    asking = n || '';
    ui.ask.hidden = !n;
    if (n) { ui.askQ.innerHTML = ''; ui.askQ.append('ใช้ชื่อ ', Object.assign(document.createElement('b'), { textContent: n }), ' ใช่ไหม?'); }
    else if (!ui.input.readOnly) ui.input.focus();
  }
  function sure() { const n = asking; askSure(null); if (n) toServer(NC.Creator.online.create, n); }
  function toServer(send, n) {
    sending = true; busyUi();
    const was = mode;
    Promise.resolve().then(() => send({ name: n, look: LK.clean(look) })).then(() => {
      sending = false; busyUi();
      close(true);
      if (NC.HUD) NC.HUD.log(was === 'new' ? `ยินดีต้อนรับ ${n}! ปราบมอนสเตอร์เพื่อเก็บ EXP แล้วอัพสเตตัส (C) และสกิล (K)` : `บันทึกหน้าตาของ ${n} แล้ว`, 'sys');
    }, (e) => {
      sending = false; busyUi();
      bad((e && e.message) || 'เซิร์ฟเวอร์ไม่ตอบ ลองใหม่อีกครั้ง');
    });
  }

  NC.Creator = { open, close, get isOpen() { return !!root && !root.hidden; }, draw: (dt) => root && !root.hidden && draw(dt || 0) };

  // ---------------- hooks: naming the hero is the creator (a new hero, the menu's ปรับแต่งตัวละคร) ----------------
  const hud = NC.HUD;
  const baseAsk = hud.askName;
  hud.askName = function () {
    const g = this.game;
    // (before the look sheet has loaded the creator can't open: it opens as soon as it can, never the old name box)
    const tryOpen = () => { if (!open(g)) setTimeout(tryOpen, LOOK_WAIT_MS); };
    tryOpen();
    return baseAsk.apply(this, arguments);
  };
  const baseInit = hud.init;
  hud.init = function (g) {
    const r = baseInit.apply(this, arguments);
    // a hero made before the creator: shown once (not in test runs that name the hero)
    let seen = false;
    try { seen = !!localStorage.getItem(SEEN); } catch (e) { seen = true; }
    setTimeout(() => {
      if (root && !root.hidden) return;
      if (g.player.name && !LK.mine && !seen && !NC.ONLINE && !g.noSave) open(g, { mode: 'first' });
    }, 0);
    return r;
  };
})();
