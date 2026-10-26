/* forge.js — ป๋าหมูหริ่ง, the camp's blacksmith (a hog-badger), and his forge beside the plaza (the item plan,
   2026-09-28). Walk up to him and press B (or click him):
     ตีอาวุธ        a weapon of every type made from materials + ore + coins (js/forgecraft.js, 2026-10-04: one per type
                    and grade, picked by type, the hero's job's types first; the greatswords' own src.craft / shop and
                    the legend from the five boss trophies); a made weapon gets its grade's option rows like a drop
     อาวุธของฉัน    every copy in the bag: เจาะแถวออฟ (3,000,000 coins + a หินเจาะออฟ: a new row, 4 at the most, never
                    fails), ใส่หินออฟ (a หินออฟ + 15,000 coins: the row becomes the kind picked, its tier rolled again;
                    แต้มช่าง: a stone that is not เทพ adds a point to the copy, at 9 the next one is เทพ for sure),
                    ขาย (not the one in hand)
   The two stones are materials (NC.MATERIALS, dropped by js/wbag.js). Art: assets/forge/ (tools/gs_art.py forge).
   Hooks like shop.js: NC.buildWorld (the forge prop and its footprint), NC.Party.update /
   collect / draw / drawTags (the smith hammers and talks), NC.HUD.init / panel (the window), B and clicks near him
   (caught before shop.js's B). Test: ?forge opens the window, ?pos=2655,2986 stands you by him. */
(function () {
  'use strict';
  const NC = window.NC, TAU = Math.PI * 2, ITEMS = NC.ITEMS, MAT = NC.MATERIALS, P = NC.Party, W = NC.WBAG, V = NC.VFX;
  const $ = (id) => document.getElementById(id);
  const fmt = (n) => NC.fmtCoins(n);
  if (NC.ASSET_MANIFEST_FORGE) Object.assign(NC.ASSET_MANIFEST, NC.ASSET_MANIFEST_FORGE);

  // the stones (materials: the pouch lists them, the merchant buys them)
  MAT.mat_opt_stone = { name: 'หินออฟ', price: 2000, desc: 'หินรูนสีม่วง สลักรูปช่องเสียบ ป๋าหมูหริ่งใช้เปลี่ยนออฟของอาวุธหนึ่งแถว' };
  MAT.mat_drill_stone = { name: 'หินเจาะออฟ', price: 50000, rare: true, desc: 'ผลึกสีครามเป็นเกลียวสว่าน ใช้เจาะแถวออฟใหม่ให้อาวุธ หายากมาก!' };
  const baseIcon = NC.matIcon;
  NC.matIcon = (id) => (NC.ASSET_MANIFEST_FORGE && NC.ASSET_MANIFEST_FORGE[id] ? NC.ASSET_MANIFEST_FORGE[id].src : baseIcon(id));
  const baseSource = NC.matSource;
  NC.matSource = (id) => (id === 'mat_opt_stone' ? 'มอนทุกชนิด (น้อยมาก) · บอส · หีบ' : id === 'mat_drill_stone' ? 'บอส · หีบทอง · มอน Lv 50+ (หายากมาก)' : baseSource(id));

  const DRILL = { coins: 3000000, stone: 'mat_drill_stone' }, STONE = { coins: 15000, stone: 'mat_opt_stone' }; // (x3 in the 2026-10-02 balance pass: was 1,000,000 / 5,000)
  // แต้มช่าง (the balance round of 2026-10-04): every option stone that does not come out เทพ adds a point to that copy
  // (c.pi, saved by gearbag.js); at PITY - 1 points the next stone is เทพ for sure — bad luck ends at 10 stones a row
  const PITY = 10;
  // (2026-10-04) the "my weapons" tab: only weapons (the bag also holds armour and hat copies), read by any weapon's own
  // numbers (greatswords keep theirs in it.gs, the other types in it.sw / it.wc) — it threw on the first non-greatsword;
  // and no copy worn in any slot can be sold here (an armour copy sold while worn came back on the next load: free coins)
  const winfoOf = (it) => (it && (it.gs || it.sw || it.wc)) || {};
  const myWeapons = (p) => W.copies(p).filter((c) => ITEMS[c.id] && (ITEMS[c.id].slot === 'weapon' || NC.optKindsFor)); // (armour has rows too: js/gearopts.js)
  const kindsFor = (it) => (NC.optKindsFor ? NC.optKindsFor(it) : Object.keys(W.OPT));
  const subsOf = (O, it) => (O.subsFor ? O.subsFor(it) : O.subs);
  const wornAny = (p, c) => Object.keys(p.equip).some((k) => W.wornIn(p, k) === c);
  const wText = (it) => (it.gs ? (it.gs.text !== '—' ? it.gs.text : 'ดาบธรรมดา') : it.abilText || ((NC.WTYPES && NC.WTYPES[it.wtype] && NC.WTYPES[it.wtype].name) || ''));
  // (camp.js's NC.CAMP_SPOT.forge, 2026-10-17: the plaza's south-west edge, in the firelight; it stood at 740, 1300, the
  // small camp's spot, hidden among the star hill's trees once the camp grew. The smith stands east of it, facing his anvil)
  const FORGE = Object.assign({ x: 2480, y: 2870 }, NC.CAMP_SPOT && NC.CAMP_SPOT.forge, { k: 1.22 });
  const SMITH = { x: FORGE.x + 235, y: FORGE.y + 26 }, TALK = 250;
  const ANVIL = { x: FORGE.x - 24, y: FORGE.y - 116 }; // (where the hammer lands: sparks)
  const GREET = ['มาแล้วเหรอ! มีอะไรให้ป๋าตีไหม?', 'ดาบดี ๆ ต้องตีด้วยใจ!', 'เจาะออฟไหม? แพงหน่อยแต่คุ้มนะ', 'อ้าว ถือดาบอะไรมาน่ะ ขอดูหน่อย'];
  const CHAT = ['ตึง! ตึง! ตึง!', 'เหล็กต้องร้อนถึงจะตีดี', 'หินเจาะออฟหายากนะ เจอแล้วเก็บไว้ดี ๆ', 'ดาบใหญ่นี่แหละของป๋า!', 'ได้ยินว่ามังกรลาวามีหัวใจเป็นไฟ...'];
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const NPC = { kind: 'ally', npc: true, forgeNpc: true, name: 'ป๋าหมูหริ่ง', x: SMITH.x, y: SMITH.y, sort: SMITH.y, dead: 0, face: -1, t: 0, wave: 0,
    say: '', sayT: 0, near: false, hammer: 0, beat: 2 };
  NC.Forge = { npc: NPC, at: FORGE, talk: TALK, refresh: render };
  NC.Forge.render = () => render();   // (hook: an added tab re-draws after its own changes)
  const here = (game) => !!(game && game.world && game.world.forge);
  const nearHim = (game) => here(game) && game.player.dead <= 0 && NC.dist(game.player.x, game.player.y, NPC.x, NPC.y) < TALK + 40;

  // ---------------- the forge: a prop of the camp ----------------
  const baseBuild = NC.buildWorld;
  NC.buildWorld = function () {
    const w = baseBuild.apply(this, arguments), s = NC.SPR.forge_prop;
    if (!s || !w.shop) return w; // (the camp only: where the merchant is)
    const fw = s.w * FORGE.k, fh = s.h * FORGE.k;
    // (2026-10-17, on the plaza where heroes walk round it: it fades when the hero is behind it, as camp.js's tents do)
    const prop = { kind: 'prop', name: 'forge_prop', x: FORGE.x, y: FORGE.y, scale: FORGE.k, flip: false, sort: FORGE.y, shadow: [185, 30],
      canopy: { x0: FORGE.x - fw * 0.48, x1: FORGE.x + fw * 0.48, y0: FORGE.y - fh, y1: FORGE.y - 30 } };
    // the ground is cleared for it: the bushes, rocks, logs and grass the camp scattered there go (and what they blocked)
    const inBox = (x, y) => x > FORGE.x - 200 && x < FORGE.x + 290 && y > FORGE.y - 130 && y < FORGE.y + 50;
    w.props = w.props.filter((q) => !(inBox(q.x, q.y) && /bush|rock|log|grass|flower|fern|shroom|pebble/.test(q.name || '')));
    for (let gy = Math.floor((FORGE.y - 130) / w.CELL); gy <= (FORGE.y + 50) / w.CELL; gy++)
      for (let gx = Math.floor((FORGE.x - 200) / w.CELL); gx <= (FORGE.x + 290) / w.CELL; gx++)
        if (gx >= 0 && gy >= 0 && gx < w.GW && gy < w.GH) w.solid[gy * w.GW + gx] = 0;
    w.props.push(prop);
    const mark = (cx, cy, rx, ry) => {
      for (let gy = Math.floor((cy - ry) / w.CELL); gy <= (cy + ry) / w.CELL; gy++)
        for (let gx = Math.floor((cx - rx) / w.CELL); gx <= (cx + rx) / w.CELL; gx++) {
          if (gx < 0 || gy < 0 || gx >= w.GW || gy >= w.GH) continue;
          const nx = (gx * w.CELL + w.CELL / 2 - cx) / rx, ny = (gy * w.CELL + w.CELL / 2 - cy) / ry;
          if (nx * nx + ny * ny <= 1) w.solid[gy * w.GW + gx] = 1;
        }
    };
    // its floor, corners too, as camp.js's houses (2026-10-17: a hero walking round it never stands inside the furnace)
    for (let gy = Math.floor((FORGE.y - 118) / w.CELL); gy < Math.ceil((FORGE.y + 12) / w.CELL); gy++)
      for (let gx = Math.floor((FORGE.x - fw * 0.49) / w.CELL); gx < Math.ceil((FORGE.x + fw * 0.51) / w.CELL); gx++)
        if (gx >= 0 && gy >= 0 && gx < w.GW && gy < w.GH) w.solid[gy * w.GW + gx] = 1;
    mark(SMITH.x, SMITH.y - 4, 30, 13);
    // (no light of its own: the campfire stays the camp's only light, the user's rule, 2026-10-17; the furnace's mouth is
    // painted orange, and the hammer's sparks still flash)
    w.forge = NPC;
    return w;
  };

  // ---------------- the smith: among the characters ----------------
  function say(text) { NPC.say = text; NPC.sayT = 3.6; }
  const baseUpdate = P.update;
  P.update = function (game, dt) {
    baseUpdate.call(P, game, dt);
    if (!here(game)) return;
    const p = game.player, d = NC.dist(p.x, p.y, NPC.x, NPC.y);
    NPC.t += dt; NPC.wave = Math.max(0, NPC.wave - dt); NPC.sayT = Math.max(0, NPC.sayT - dt); NPC.hammer = Math.max(0, NPC.hammer - dt);
    const near = d < TALK && p.dead <= 0;
    if (near && !NPC.near) { NPC.wave = 1.2; say(pick(GREET)); }
    NPC.near = near;
    // he hammers at the anvil now and then (sparks fly off it)
    NPC.beat -= dt;
    if (NPC.beat <= 0 && !near) {
      NPC.beat = NC.rand(0.55, 0.8) * (Math.random() < 0.15 ? 5 : 1);
      NPC.hammer = 0.28;
      setTimeout(() => {
        if (NC.dist(p.x, p.y, ANVIL.x, ANVIL.y) < 1400) { V.sparks(ANVIL.x, ANVIL.y, 7, '255,190,90', { size: 0.7, max: 520 }); V.light(ANVIL.x, ANVIL.y, 160, '255,170,80', 0.8, 0.18); }
      }, 170);
    }
    if (near && d < 700 && Math.abs(p.x - NPC.x) > 24) NPC.face = p.x < NPC.x ? -1 : 1; else if (!near) NPC.face = -1; // (at work: towards the anvil)
    if (d < 560 && NPC.sayT <= 0 && Math.random() < dt / 11) say(pick(near ? GREET : CHAT));
  };
  const baseCollect = P.collect;
  P.collect = function (list, visible) {
    baseCollect.call(P, list, visible);
    if (here(NC.game) && visible(NPC.x - 120, NPC.y - 220, NPC.x + 120, NPC.y + 40)) list.push(NPC);
  };
  const baseDraw = P.draw;
  P.draw = function (ctx, game, a) {
    if (!a.forgeNpc) return baseDraw.call(P, ctx, game, a);
    const b = Math.sin(a.t * 2.2) * 0.016, pose = a.hammer > 0.12 && NC.SPR.smith_b ? 'smith_b' : 'smith';
    NC.drawSpr(ctx, pose, a.x, a.y, { flip: a.face < 0, sx: 1 + b * 0.5, sy: 1 - b });
  };
  function bubble(ctx, text, x, y, alpha) {
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.font = "500 20px 'Mitr', sans-serif";
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = Math.min(380, ctx.measureText(text).width + 30), h = 40;
    ctx.beginPath(); NC.rrect(ctx, x - w / 2, y - h, w, h, 14);
    ctx.fillStyle = '#fffaf0'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = NC.OUTLINE; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 9, y - 2); ctx.lineTo(x, y + 12); ctx.lineTo(x + 9, y - 2); ctx.closePath();
    ctx.fillStyle = '#fffaf0'; ctx.fill(); ctx.stroke();
    ctx.fillRect(x - 7, y - 6, 14, 6);
    ctx.fillStyle = NC.OUTLINE; ctx.fillText(text, x, y - h / 2 + 1, w - 20);
    ctx.restore();
  }
  const baseTags = P.drawTags;
  P.drawTags = function (ctx, game) {
    baseTags.call(P, ctx, game);
    if (!here(game) || !NC.drawTag) return;
    const c = game.cam;
    if (NPC.x < c.x - 300 || NPC.x > c.x + game.vw + 300 || NPC.y < c.y - 300 || NPC.y > c.y + game.vh + 300) return;
    NC.drawTag(ctx, NPC.name, NPC.x, NPC.y + 32, 22, '#ffb27a');
    NC.drawTag(ctx, 'ช่างตีเหล็ก · ตีดาบ · เจาะออฟ', NPC.x, NPC.y + 58, 16, '#e8e0d2');
    if (NPC.sayT > 0) bubble(ctx, NPC.say, NPC.x, NPC.y - 196, NC.clamp(NPC.sayT / 0.3, 0, 1) * NC.clamp((3.6 - NPC.sayT) / 0.15, 0, 1));
    else if (NPC.near) NC.drawTag(ctx, 'กด B หรือคลิก เพื่อคุยกับป๋า', NPC.x, NPC.y - 204 + Math.sin(game.time * 4) * 3, 20, '#fff3cf');
  };

  // ---------------- the window ----------------
  let win = null, tab = 'mine', sel = null, row = 0, kind = 'atk', sub = null, armed = { k: '', t: 0 }, lock = null; // (lock: the kind a made weapon's first row is set to)
  let ftype = null, fall = false; // (the make tab: the weapon type shown, and whether every type is listed or the job's own)
  const G = () => NC.game;
  // what a weapon is made of: js/forgecraft.js for every type (the greatswords' own src through it), else the greatswords
  const FC = () => NC.FORGE_CRAFT;
  const srcOf = (id) => (FC() ? FC().src(id) : ITEMS[id] && ITEMS[id].gs && ITEMS[id].gs.src) || {};
  const gsRecipes = () => NC.GS.list.filter((id) => { const s = ITEMS[id].gs.src; return s.craft || s.shop; });
  const makeTypes = (p) => {
    const all = FC() ? FC().types() : ['gsword'];
    const mine = NC.jobWeaponTypes ? NC.jobWeaponTypes(p.job) : null;
    const own = mine ? all.filter((t) => mine.has(t)) : all;
    return fall || !own.length ? all : own;
  };
  const recipes = (t) => (FC() ? FC().list(t) : gsRecipes());
  const has = (p, id) => NC.matCount(p, id);
  function canMake(p, id) {
    const s = srcOf(id);
    if (s.shop) return p.coins >= s.shop;
    return !!s.craft && p.coins >= (s.coins || 0) && Object.keys(s.craft).every((m) => has(p, m) >= s.craft[m]);
  }
  const icon = (id, n) => { try { return NC.itemIcon(id, n || 96).toDataURL(); } catch (e) { return ''; } };
  const iconCache = new Map();
  const iconOf = (id) => { if (!iconCache.has(id)) iconCache.set(id, icon(id)); return iconCache.get(id); };

  function build(game) {
    win = document.createElement('div');
    win.id = 'forge'; win.className = 'panel'; win.hidden = true;
    win.innerHTML = '<div class="card shop forge"><div class="ptitle"><span id="fg-title">โรงตีเหล็กป๋าหมูหริ่ง</span>' +
      `<span class="sh-coins" id="fg-coinbox"><img src="${NC.matIcon('ic_coin')}" alt=""><b id="fg-coins">0</b></span>` +
      '<button id="fg-close" aria-label="ปิด">✕</button></div>' +
      '<div class="sh-tabs"><button data-fgtab="mine">ของของฉัน · เจาะออฟ</button><button data-fgtab="make">ตีอาวุธ</button>' +
      // (hook: more tabs from other files, NC.FORGE_TABS = [{ key, label, render(body, game), click(button, game) -> true }])
      (NC.FORGE_TABS || []).map((T) => `<button data-fgtab="${T.key}">${T.label}</button>`).join('') +
      '<span class="sh-where" id="fg-stones"></span></div><div id="fg-body"></div></div>';
    document.body.appendChild(win);
    $('fg-close').addEventListener('click', () => { NC.HUD.panel('forge', false); game.paused = false; });
    win.addEventListener('click', (ev) => {
      const t = ev.target.closest('button');
      if (!t || t.disabled) return;
      if (t.dataset.fgtab) { tab = t.dataset.fgtab; render(); return; }
      const XT = (NC.FORGE_TABS || []).find((T) => T.key === tab);   // (hook: an added tab's own buttons)
      if (XT && XT.click && XT.click(t, game)) { render(); return; }
      clickBody(t, game);
    });
  }
  // the buttons of the two own tabs (also pressed from the crafting window, js/craftgo.js, which draws them in its page):
  // making a weapon there needs the smith near or the crafting window's go-ahead (NC.CraftGo.ok: out of combat, an
  // allowed map); drilling, stones and selling only next to him (2026-10-17: they stay in the camp)
  function clickBody(t, game) {
    if (t.dataset.copy) { sel = Number(t.dataset.copy); row = 0; render(); return true; }
    if (t.dataset.row !== undefined) { row = Number(t.dataset.row); render(); return true; }
    if (t.dataset.kind) { kind = t.dataset.kind; sub = null; render(); return true; }
    if (t.dataset.sub) { sub = t.dataset.sub; render(); return true; }
    if (t.dataset.make) { if (nearHim(game) || (NC.CraftGo && NC.CraftGo.ok(game))) make(game, t.dataset.make, t); return true; }
    if (t.dataset.lock !== undefined) { lock = t.dataset.lock || null; render(); return true; }
    if (t.dataset.ftype) { ftype = t.dataset.ftype; render(); return true; }
    if (t.dataset.fall !== undefined) { fall = !fall; ftype = null; render(); return true; }
    if ((t.id === 'fg-drill' || t.id === 'fg-stone' || t.id === 'fg-sell') && !nearHim(game)) return true;
    if (t.id === 'fg-drill') { drill(game, t); return true; }
    if (t.id === 'fg-stone') { stone(game, t); return true; }
    if (t.id === 'fg-sell') { sell(game, t); return true; }
    if (t.id === 'fg-use') { W.use(game, sel); render(); return true; }
    return false;
  }
  // (craftgo.js) its page shows one of the two own tabs: render() then draws into that page, not into this window
  let into = null;
  NC.Forge.into = (body, t) => { into = body || null; if (t) tab = t; };
  NC.Forge.click = (t, game) => clickBody(t, game);
  NC.Forge.near = (game) => nearHim(game);
  NC.Forge.select = (u) => { sel = u; row = 0; };
  // a costly button needs a second click within 3 s
  function confirm(btn, key, text) {
    if (armed.k === key && performance.now() - armed.t < 3000) { armed.k = ''; return true; }
    armed = { k: key, t: performance.now() };
    const was = btn.textContent;
    btn.textContent = text;
    setTimeout(() => { if (btn.isConnected && armed.k === key) { btn.textContent = was; armed.k = ''; } }, 3100);
    return false;
  }
  function coinFx() { const b = $('fg-coinbox'); if (b) { b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); } }
  function hammerFx(game) {
    NPC.hammer = 0.35; NPC.wave = 0.6;
    const p = game.player, at = here(game) ? ANVIL : { x: p.x + 30 * (p.face || 1), y: p.y - 60 }; // (away from the camp: sparks at the hero's kit)
    V.sparks(at.x, at.y, 16, '255,200,110', { size: 0.9, max: 640 }); V.light(at.x, at.y, 240, '255,170,80', 1, 0.3);
    if (NC.Sound && NC.Sound.play) NC.Sound.play('hit');
  }

  function render() {
    const page = into && into.isConnected && !into.closest('[hidden]') ? into : null; // (craftgo.js's page)
    if (!page && (!win || win.hidden)) return;
    const game = G(), p = game.player;
    if (!page) {
      $('fg-coins').textContent = fmt(p.coins);
      $('fg-stones').innerHTML = `<img src="${NC.matIcon('mat_drill_stone')}" alt="">หินเจาะออฟ <b>${has(p, 'mat_drill_stone')}</b> · ` +
        `<img src="${NC.matIcon('mat_opt_stone')}" alt="">หินออฟ <b>${has(p, 'mat_opt_stone')}</b>`;
      win.querySelectorAll('[data-fgtab]').forEach((b) => b.classList.toggle('on', b.dataset.fgtab === tab));
    }
    const body = page || $('fg-body');
    const XT = (NC.FORGE_TABS || []).find((T) => T.key === tab);   // (hook: an added tab draws itself)
    if (XT) { XT.render(body, game); return; }
    if (tab === 'make') {
      // the types the hero's job can hold first (ทุกชนิด lists all 30); the one held, else the first, is shown
      const types = makeTypes(p), heldT = p.equip.weapon && NC.wtypeOf ? NC.wtypeOf(ITEMS[p.equip.weapon]) : null;
      if (!types.includes(ftype)) ftype = types.includes(heldT) ? heldT : types[0];
      const tname = (t) => (NC.WTYPES && NC.WTYPES[t] ? NC.WTYPES[t].name : t);
      const jobs = Object.keys(NC.JOB_WEAPONS || {}).filter((j) => NC.JOB_WEAPONS[j].includes(ftype) && NC.JOBS[j]).map((j) => NC.JOBS[j].name);
      body.innerHTML = (FC() ? '<div class="fg-kinds fg-types">' + types.map((t) => `<button data-ftype="${t}" class="${t === ftype ? 'on' : ''}">${tname(t)}</button>`).join('') +
        `<button data-fall class="fg-all${fall ? ' on' : ''}">${fall ? '✔ ' : ''}ทุกชนิด</button></div>` +
        `<div class="fg-jobs">${tname(ftype)} · ${jobs.length ? 'อาชีพที่ใช้ได้: ' + jobs.join(', ') : 'ทุกอาชีพ'}</div>` : '') +
        (NC.optKindsFor ? `<div class="fg-kinds fg-lock"><span>ล็อกออฟแถวแรก (+หินออฟ 1 ก้อน · มี ${has(p, STONE.stone)}):</span><button data-lock="" class="${lock ? '' : 'on'}">ไม่ล็อก</button>` +
          NC.optKindsFor(ITEMS[recipes(ftype)[0]] || { slot: 'weapon' }).map((k) => `<button data-lock="${k}" class="${k === lock ? 'on' : ''}">${W.OPT[k].th}</button>`).join('') + '</div>' : '') +
        '<div class="fg-make">' + recipes(ftype).map((id) => {
        const it = ITEMS[id], s = srcOf(id), ok = canMake(p, id), R = NC.RARITY[it.rarity], wi = winfoOf(it), K = NC.GS.KIND[wi.kind] || NC.GS.KIND.A;
        const need = s.shop ? `<span>${fmt(s.shop)} เหรียญ</span>` : Object.keys(s.craft).map((m) =>
          `<span class="${has(p, m) >= s.craft[m] ? '' : 'fg-miss'}"><img src="${NC.matIcon(m)}" alt="">${MAT[m] ? MAT[m].name : m} ${has(p, m)}/${s.craft[m]}</span>`).join('') +
          `<span class="${p.coins >= s.coins ? '' : 'fg-miss'}">${fmt(s.coins)} เหรียญ</span>`;
        return `<div class="fg-recipe"><img class="fg-ic" src="${iconOf(id)}" alt=""><div class="fg-rt"><b style="color:${R.color}">${it.name}</b>` +
          `<small>${K.th} · ATK ${wi.atk} · ต้อง Lv ${it.lvReq}${it.gs && it.gs.text !== '—' ? ' · ' + it.gs.text : ''}</small>` +
          `<div class="fg-need">${need}</div></div><button class="big" data-make="${id}" ${ok ? '' : 'disabled'}>${s.shop ? 'ซื้อ' : s.forge ? 'หลอม' : 'ตี'}</button></div>`;
      }).join('') + '</div><div class="st-note">อาวุธที่ตีเสร็จได้แถวออฟตามเกรดเหมือนของดรอป · ของออปพิเศษ ปลุกเวท และของบอสยังต้องลุ้นจากมอน' +
        (ftype === 'gsword' ? ' · ดาบตำนานต้องใช้ถ้วยรางวัลบอสครบ 5 อย่าง' : ' · แร่และไม้ได้จากอาชีพเสริม (ขุดแร่ ตัดไม้) หรือซื้อจากร้านผู้เล่น') + '</div>';
      return;
    }
    // my weapons: the list, then what can be done to the one picked
    const list = myWeapons(p);
    if (!list.length) { body.innerHTML = '<div class="fg-empty">ยังไม่มีของที่เจาะออฟได้ ลองล่ามอนหรือให้ป๋าตีให้สักเล่มสิ</div>'; return; }
    if (!list.some((c) => c.u === sel)) sel = (W.worn(p) || list[0]).u;
    const c = list.find((x) => x.u === sel), it = ITEMS[c.id], cur = wornAny(p, c), wi = winfoOf(it);
    row = Math.min(row, Math.max(0, c.rows.length - 1));
    const KINDS = kindsFor(it);
    if (!KINDS.includes(kind)) { kind = KINDS[0]; sub = null; }
    const O = W.OPT[kind], SUBS = subsOf(O, it);
    if (SUBS && !SUBS.includes(sub)) sub = SUBS[0];
    const sameOther = c.rows.filter((r, i) => i !== row && r.k === kind).length;
    const canDrill = c.rows.length < W.MAX_ROWS && p.coins >= DRILL.coins && has(p, DRILL.stone) > 0;
    const canStone = c.rows.length > 0 && p.coins >= STONE.coins && has(p, STONE.stone) > 0 && sameOther < W.MAX_SAME;
    body.innerHTML = '<div class="fg-wrap"><div class="fg-list">' + list.map((x) => {
      const X = ITEMS[x.id], R = NC.RARITY[X.rarity], god = x.rows.filter((r) => r.tier === 2).length;
      return `<button class="fg-copy${x.u === sel ? ' sel' : ''}" data-copy="${x.u}"><img src="${iconOf(x.id)}" alt="">` +
        `<span><b style="color:${R.color}">${X.name}</b><small>ออฟ ${x.rows.length}/${W.MAX_ROWS}${god ? ` · เทพ ${god}` : ''}${W.worn(p) === x ? ' · ถืออยู่' : ''}</small></span>` +
        `${NC.copyGems ? NC.copyGems(x, 'fg') : ''}</button>`; // (the grade's gems, js/gradetier.js)
    }).join('') + '</div><div class="fg-side">' +
      `<div class="fg-head"><img src="${iconOf(c.id)}" alt=""><div><b style="color:${NC.RARITY[it.rarity].color}">${it.name}</b>` +
      `<small>${it.slot === 'weapon' ? `Lv ${it.lvReq || 1} · ATK ${wi.atk || (it.dmg ? Math.round((it.dmg[0] + it.dmg[1]) / 2) : '-')} · ${wText(it)}` : `${NC.SLOT_NAME[it.slot] || 'เครื่องประดับ'} · Lv ${it.lvReq || 1}`}</small></div></div>` +
      '<div class="fg-rows">' + c.rows.map((r, i) => `<button class="fg-row${i === row ? ' sel' : ''}" data-row="${i}" style="color:${W.TIER[r.tier].color}">` +
        `แถว ${i + 1}: ${NC.rowText(r)} <i>${W.TIER[r.tier].th}</i></button>`).join('') +
      Array.from({ length: W.MAX_ROWS - c.rows.length }, () => '<div class="fg-row fg-hole">— ยังไม่ได้เจาะ —</div>').join('') + '</div>' +
      `<div class="fg-act"><b>เจาะแถวออฟใหม่</b><span>${fmt(DRILL.coins)} เหรียญ + หินเจาะออฟ 1 ก้อน · ได้ออฟสุ่ม 1 แถว (สูงสุด ${W.MAX_ROWS} แถว) · ไม่มีวันพลาด</span>` +
      `<button class="big" id="fg-drill" ${canDrill ? '' : 'disabled'}>${c.rows.length >= W.MAX_ROWS ? 'ครบ 4 แถวแล้ว' : 'เจาะแถวออฟ'}</button></div>` +
      `<div class="fg-act"><b>ใส่หินออฟ ที่แถว ${row + 1}</b><span>หินออฟ 1 ก้อน + ${fmt(STONE.coins)} เหรียญ · เลือกชนิดเอง ระดับสุ่ม (ธรรมดา 60% · ดี 30% · เทพ 10%)` +
        ` · แต้มช่าง <b>${c.pi || 0}/${PITY - 1}</b>${(c.pi || 0) >= PITY - 1 ? ' ครบแล้ว: ครั้งนี้ได้เทพแน่นอน!' : ' (ไม่ออกเทพได้ 1 แต้ม ครบแล้วครั้งถัดไปได้เทพแน่นอน)'}</span>` +
      '<div class="fg-kinds">' + KINDS.map((k) => `<button data-kind="${k}" class="${k === kind ? 'on' : ''}">${W.OPT[k].th}</button>`).join('') + '</div>' +
      (SUBS ? '<div class="fg-kinds fg-subs">' + SUBS.map((s) => `<button data-sub="${s}" class="${s === sub ? 'on' : ''}">${O.subTh(s)}</button>`).join('') + '</div>' : '') +
      `<button class="big" id="fg-stone" ${canStone ? '' : 'disabled'}>${sameOther >= W.MAX_SAME ? 'ชนิดนี้มี 2 แถวแล้ว' : 'ใส่หินออฟ'}</button></div>` +
      `<div class="fg-act fg-last">${cur ? `<span>✔ ${it.slot === 'weapon' ? 'ถือ' : 'ใส่'}อยู่</span>` : `<button id="fg-use">${it.slot === 'weapon' ? 'ถือเล่มนี้' : 'ใส่ชิ้นนี้'}</button>`}` +
      (W.noSale && W.noSale(c) ? '<span>อาวุธเริ่มต้น ขายไม่ได้</span>' // (js/gearbag.js noSale: the starter and class weapons)
        : `<button id="fg-sell" ${cur || wornAny(p, c) ? 'disabled' : ''}>ขาย ${fmt(W.sellPrice ? W.sellPrice(c) : W.priceOf(c))} เหรียญ</button>`) + '</div></div></div>';
  }

  function make(game, id, btn) {
    const p = game.player, s = srcOf(id);
    if (!canMake(p, id)) return;
    if (W.room && !W.room(p)) { game.toast(`กระเป๋าอุปกรณ์เต็ม (${W.bagCap ? W.bagCap(p) : W.BAG_MAX} ชิ้น) · ขายหรือฝากคลังที่ลุงโกโก้ก่อน`); return; }
    if (lock && has(p, STONE.stone) < 1) { game.toast('ล็อกออฟต้องใช้หินออฟ 1 ก้อน · กด "ไม่ล็อก" เพื่อตีแบบสุ่ม'); return; }
    if (!s.shop && !confirm(btn, 'make' + id, 'กดอีกครั้งเพื่อตี')) return;
    const c = craft(game, id, lock);
    if (!c) return;
    if (into) sel = c.u; else { tab = 'mine'; sel = c.u; } // (in the crafting window the page stays on making)
    render();
  }
  // paying and making, no questions asked (also js/forgemake.js's ตีอาวุธ page, 2026-10-17): the copy made, or null
  function craft(game, id, lockKind) {
    const p = game.player, s = srcOf(id);
    if (!canMake(p, id)) return null;
    if (s.shop) p.coins -= s.shop;
    else { p.coins -= s.coins || 0; for (const m in s.craft) { p.mats[m] -= s.craft[m]; if (p.mats[m] <= 0) delete p.mats[m]; } }
    const lk = lockKind && has(p, STONE.stone) > 0 && kindsFor(ITEMS[id]).includes(lockKind) ? lockKind : null; // (a locked row: one more หินออฟ)
    if (lk) { p.mats[STONE.stone] -= 1; if (p.mats[STONE.stone] <= 0) delete p.mats[STONE.stone]; }
    const c = W.add(game, W.make(id, { src: 'craft', lock: lk, by: p.name || '' }));
    hammerFx(game); coinFx();
    say(s.forge ? 'เตาหลอมโบราณ... ติดไฟแล้ว!! ดาบในตำนาน!' : pick(['เสร็จแล้ว! ร้อน ๆ เลยนะ', 'ฝีมือป๋าเอง รับรองคม!', 'เอาไปใช้ให้คุ้มนะ!']));
    game.toast(`ได้รับ ${ITEMS[id].name}!`);
    NC.HUD.log(`ป๋าหมูหริ่งตี ${ITEMS[id].name} ให้ · ออฟ ${c.rows.map(NC.rowText).join(' · ') || 'ไม่มี'}`, 'item');
    NC.saveTrade && NC.saveTrade(game);
    return c;
  }
  Object.assign(NC.Forge, { craft, canMake, srcOf, recipes, kindsFor, STONE, makeTypes: (p, all) => { const was = fall; fall = !!all; const t = makeTypes(p); fall = was; return t; } });
  function drill(game, btn) {
    const p = game.player, c = myWeapons(p).find((x) => x.u === sel);
    if (!c || c.rows.length >= W.MAX_ROWS || p.coins < DRILL.coins || has(p, DRILL.stone) < 1) return;
    if (!confirm(btn, 'drill', `กดอีกครั้ง: จ่าย ${fmt(DRILL.coins)} + หินเจาะออฟ`)) return;
    p.coins -= DRILL.coins; p.mats[DRILL.stone] -= 1; if (p.mats[DRILL.stone] <= 0) delete p.mats[DRILL.stone];
    const r = W.rollRow(c.rows, undefined, undefined, undefined, ITEMS[c.id]);
    c.rows.push(r);
    W.changed(game, c);
    hammerFx(game); coinFx();
    say(r.tier === 2 ? 'โอ้โห! ออฟเทพเลย!!' : 'เจาะทะลุแล้ว! แถวใหม่มาแล้ว');
    NC.HUD.log(`เจาะแถวออฟที่ ${c.rows.length}: ${NC.rowText(r)} (${W.TIER[r.tier].th})`, 'item');
    NC.saveTrade && NC.saveTrade(game);
    row = c.rows.length - 1; render();
  }
  function stone(game, btn) {
    const p = game.player, c = myWeapons(p).find((x) => x.u === sel);
    if (!c || !c.rows[row] || p.coins < STONE.coins || has(p, STONE.stone) < 1) return;
    const others = c.rows.filter((r, i) => i !== row);
    if (others.filter((r) => r.k === kind).length >= W.MAX_SAME) return;
    p.coins -= STONE.coins; p.mats[STONE.stone] -= 1; if (p.mats[STONE.stone] <= 0) delete p.mats[STONE.stone];
    const sure = (c.pi || 0) >= PITY - 1;
    const r = W.rollRow(others, kind, sub, sure ? 2 : undefined, ITEMS[c.id]);
    c.pi = r.tier === 2 ? 0 : (c.pi || 0) + 1;
    c.rows[row] = r;
    W.changed(game, c);
    hammerFx(game); coinFx();
    say(r.tier === 2 ? (sure ? 'แต้มช่างครบ! ป๋าตั้งใจตีเต็มที่ เทพแน่นอน!' : 'เทพ!! ป๋าก็ตกใจ!') : r.tier === 1 ? 'ออกมาดีนะ!' : 'ธรรมดาไปหน่อย ลองอีกทีไหม?');
    NC.HUD.log(`ใส่หินออฟแถว ${row + 1}: ${NC.rowText(r)} (${W.TIER[r.tier].th})`, 'item');
    NC.saveTrade && NC.saveTrade(game);
    render();
  }
  function sell(game, btn) {
    const p = game.player, c = myWeapons(p).find((x) => x.u === sel);
    if (!c || W.worn(p) === c || wornAny(p, c) || (W.noSale && W.noSale(c))) return;
    const price = W.sellPrice ? W.sellPrice(c) : W.priceOf(c); // (the day's sales lower it: js/endgame_audit.js)
    if (!confirm(btn, 'sell' + c.u, `กดอีกครั้งเพื่อขาย ${fmt(price)} เหรียญ`)) return;
    W.remove(game, c);
    if (NC.gearSold) NC.gearSold();
    p.coins += price; coinFx();
    if (W.countSale) W.countSale(game, c, price); // (the day's gear count: js/economy.js, the owner 2026-10-07)
    say('ขอบใจ! เดี๋ยวป๋าหลอมใหม่');
    NC.HUD.log(`ขาย ${ITEMS[c.id].name} ได้ ${fmt(price)} เหรียญ`, 'item');
    NC.saveTrade && NC.saveTrade(game);
    sel = null; render();
  }

  // ---------------- hooks into the HUD ----------------
  const baseInit = NC.HUD.init.bind(NC.HUD);
  NC.HUD.init = function (game) {
    baseInit(game);
    build(game);
  };
  const basePanel = NC.HUD.panel.bind(NC.HUD);
  NC.HUD.panel = function (id, show) {
    if (id === 'forge' && show !== false && NC.CraftGo) { NC.CraftGo.open('make'); return true; } // (any opener: the crafting window instead)
    if (id === 'forge') {
      const on = show === undefined ? win.hidden : show;
      basePanel('pause', false); // closes every other window
      win.hidden = !on;
      if (on) { armed.k = ''; into = null; render(); }
      return on;
    }
    if (win) win.hidden = true;
    return basePanel(id, show);
  };
  // (2026-10-17, the user: "เปิดงานฝีมือหน้าเดียว") talking to him opens the crafting window (js/craftgo.js) on his stations;
  // his old window stays in the page but no longer opens
  const open = (game) => { NPC.wave = 1.2; say(pick(GREET)); if (NC.CraftGo) NC.CraftGo.open('make'); else game.paused = NC.HUD.panel('forge', true); };
  // B next to him opens his window (caught before shop.js's B, which opens the pouch anywhere)
  addEventListener('keydown', (e) => {
    const game = NC.game;
    if (e.code !== 'KeyB' || e.repeat || !game || !game.player) return;
    const t = document.activeElement;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    if (win && !win.hidden) { e.stopImmediatePropagation(); NC.HUD.panel('forge', false); game.paused = false; return; }
    if (!nearHim(game)) return;
    if (NC.CraftGo && NC.CraftGo.isOpen()) { e.stopImmediatePropagation(); NC.CraftGo.close(); return; }
    e.stopImmediatePropagation();
    if (NC.Lessons && NC.Lessons.talk && NC.Lessons.talk(game, 'smith')) return; // (js/lessons.js: a quest waits with him)
    open(game);
  }, true);
  addEventListener('mousedown', (e) => {
    const game = NC.game;
    if (e.button !== 0 || !game || !here(game) || e.target !== $('view') || !win || !win.hidden) return;
    const wx = game.cam.x + (e.clientX * game.dpr) / game.scale, wy = game.cam.y + (e.clientY * game.dpr) / game.scale;
    if (Math.abs(wx - NPC.x) > 70 || wy < NPC.y - 180 || wy > NPC.y + 16) return;
    e.stopImmediatePropagation(); e.preventDefault();
    if (nearHim(game)) { if (!(NC.Lessons && NC.Lessons.talk && NC.Lessons.talk(game, 'smith'))) open(game); } // (js/lessons.js)
    else game.toast('เดินเข้าไปใกล้ป๋าหมูหริ่งก่อนนะ');
  }, true);

  const css = document.createElement('style');
  css.textContent = `
    .card.forge .sh-where img{width:calc(26*var(--u));height:calc(26*var(--u));vertical-align:middle;margin:0 calc(3*var(--u))}
    .card.forge .sh-where b{color:#ffd873}
    .fg-make{display:flex;flex-direction:column;gap:calc(8*var(--u));max-height:calc(520*var(--u));overflow-y:auto;padding-right:calc(6*var(--u))}
    .fg-recipe{display:flex;align-items:center;gap:calc(12*var(--u));padding:calc(8*var(--u)) calc(12*var(--u));border-radius:calc(12*var(--u));background:rgba(255,255,255,.05);border:calc(2*var(--u)) solid rgba(255,255,255,.08)}
    .fg-ic{width:calc(64*var(--u));height:calc(64*var(--u));object-fit:contain}
    .fg-rt{flex:1;display:flex;flex-direction:column;gap:calc(2*var(--u));min-width:0}.fg-rt small{color:#cfc6b8;font-size:calc(15*var(--u))}
    .fg-need{display:flex;flex-wrap:wrap;gap:calc(4*var(--u)) calc(12*var(--u));font-size:calc(15*var(--u));color:#e8e0d2}
    .fg-need img{width:calc(24*var(--u));height:calc(24*var(--u));vertical-align:middle;margin-right:calc(2*var(--u))}.fg-miss{color:#ff8a8a}
    .fg-wrap{display:grid;grid-template-columns:calc(360*var(--u)) 1fr;gap:calc(16*var(--u))}
    .fg-list{display:flex;flex-direction:column;gap:calc(6*var(--u));max-height:calc(540*var(--u));overflow-y:auto;padding-right:calc(4*var(--u))}
    .fg-copy{display:flex;align-items:center;gap:calc(10*var(--u));text-align:left;cursor:pointer;padding:calc(4*var(--u)) calc(8*var(--u));border-radius:calc(10*var(--u));border:calc(3*var(--u)) solid var(--ink);background:#3b3747;color:#f4efe6;font:inherit}
    .fg-copy.sel{background:#5a5068;outline:calc(3*var(--u)) solid #ffd873}
    .fg-copy img{width:calc(48*var(--u));height:calc(48*var(--u));object-fit:contain}.fg-copy span{display:flex;flex-direction:column}.fg-copy small{color:#cfc6b8;font-size:calc(14*var(--u))}
    .fg-side{display:flex;flex-direction:column;gap:calc(10*var(--u))}
    .fg-head{display:flex;align-items:center;gap:calc(12*var(--u))}.fg-head img{width:calc(72*var(--u));height:calc(72*var(--u));object-fit:contain}
    .fg-head div{display:flex;flex-direction:column}.fg-head small{color:#cfc6b8;font-size:calc(15*var(--u))}
    .fg-rows{display:flex;flex-direction:column;gap:calc(4*var(--u))}
    .fg-row{text-align:left;cursor:pointer;padding:calc(3*var(--u)) calc(12*var(--u));border-radius:calc(8*var(--u));border:calc(2*var(--u)) solid rgba(255,255,255,.12);background:rgba(20,18,30,.45);font:500 calc(17*var(--u))/1.6 'Mitr',sans-serif}
    .fg-row.sel{border-color:#ffd873}.fg-row i{font-style:normal;opacity:.75;font-size:calc(14*var(--u));margin-left:calc(6*var(--u))}
    .fg-hole{color:#8a8274;cursor:default;font-style:italic}
    .fg-act{display:flex;flex-direction:column;gap:calc(6*var(--u));padding:calc(8*var(--u)) calc(12*var(--u));border-radius:calc(12*var(--u));background:rgba(255,255,255,.05)}
    .fg-act span{font-size:calc(15*var(--u));color:#cfc6b8}.fg-act .big{align-self:flex-start}
    .fg-kinds{display:flex;flex-wrap:wrap;gap:calc(5*var(--u))}
    .fg-kinds button,.fg-last button{cursor:pointer;padding:0 calc(12*var(--u));border-radius:calc(8*var(--u));border:calc(2*var(--u)) solid var(--ink);background:#4a4555;color:#f4efe6;font:500 calc(15*var(--u))/1.8 'Mitr',sans-serif}
    .fg-kinds button.on{background:#ffd873;color:var(--ink)}.fg-subs button{font-size:calc(14*var(--u))}
    .fg-types{margin-bottom:calc(6*var(--u))}.fg-types .fg-all{margin-left:auto;background:#3b3747}.fg-types .fg-all.on{background:#7bc6ff;color:var(--ink)}
    .fg-jobs{font-size:calc(15*var(--u));color:#cfc6b8;margin:0 0 calc(8*var(--u)) calc(2*var(--u))}
    .fg-last{flex-direction:row;align-items:center;gap:calc(10*var(--u))}.fg-last button:disabled{opacity:.4;cursor:default}
    .fg-empty{padding:calc(30*var(--u));text-align:center;color:#cfc6b8}`;
  document.head.appendChild(css);
})();
