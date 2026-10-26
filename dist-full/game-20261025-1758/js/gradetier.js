/* gradetier.js — the colour grades of gear pieces (the user, 2026-10-12: "อยากเพิ่มระบบเกรดสีของไอเทม เป็น tier" → 6
   grades; the grade works through the option rows; a polish stone raises it; a grade seal keeps it when a polish fails;
   a safety stone for refining (js/refine.js); the seal and the safety stone will also be sold in the coming item shop;
   mockups assets/gen/nightcamp_tier_*: the bag A (frames in the grade colour), the forge A (Papa Moo beside it)).
     ด้าน · เงา · วาว · แวววาว · เจิดจ้า · ราตรี (renamed 2026-10-20, the user's set A: the old names ธรรมดา / ดี / หายาก /
     ล้ำค่า / ตำนาน clashed with the item rarities and the option rows' tiers; each grade keeps its light colour on drops)
   Each COPY rolls its grade when it drops or is made (c.g 0..5); since 2026-10-20 a piece is coloured by its item's rarity
   and its grade shows as 0-5 polish gems ◆ (player feedback: one colour per meaning; the forge's grade page a list). A grade
   lifts the copy's option rows (it never adds power of its own, so the balance passes stay right):
     เงา: a ดี row at least · วาว: every row ดี or better · แวววาว: a เทพ row, the rest ดี · เจิดจ้า: two เทพ rows and a
     special ◆ row · ราตรี: every row เทพ, a ◆ row, and the night: ATK/MATK +8% (a weapon) or damage taken −3% (armour)
     at night. A piece with fewer rows gets the few rows its grade needs (never past 4: drilling stays the forge's).
   Where a grade comes from: monsters (60/28/9/2.6/0.4), elites, iron chests and root cores (40/34/18/6.5/1.5), gold
   chests (20/35/30/12/3), bosses (วาว or better: 70/25/5), the forge's crafts (50/35/12/3); the deeper floors of
   รากต้นไม้มืด lift the upper grades (up to x2.5 at floor 100) and only its floors 91-100 and the great bosses give ราตรี.
   The world's legend weapons are always เจิดจ้า. Old copies get the grade their rows already have.
   ขัดเกรด at ป๋าหมูหริ่ง (a forge tab): หินขัดเกรด (+ coins) raise the grade one step: 90 / 70 / 45 / 20%, and เจิดจ้า →
   ราตรี 8% with a แก่นราตรี too. From วาว up a failure has a half chance to drop the grade one step (the best row
   loses a step, a ◆ row under เจิดจ้า turns plain) unless a ตราผนึกเกรด is on (it is used only when it saves the grade).
   แต้มช่าง: every failure adds one to that copy; at 10 the next polish lands.
   Saved with the copy (js/gearbag.js `g`, `gp`), in the players' stalls (js/gearopts.js) and party hand-overs
   (js/partynet.js). Hooks: NC.gearMakeHooks, NC.damageEnemy (what made the drop), NC.invEntryHook (js/inventory.js: every
   piece is its own bag cell in its own grade), NC.copyTag (js/gearbag.js: the copies list), NC.drawLoot, NC.skillModSources,
   NC.FORGE_TABS, NC.gearPicked. NC.Grade: GRADES, of(c), set(c, g), polish(game, c, seal), roll(src). */
(function () {
  'use strict';
  const NC = window.NC, ITEMS = NC.ITEMS, FX = NC.FX, W = NC.GEAR;
  if (!W) return;
  if (NC.ASSET_MANIFEST_GRADE && NC.ASSET_MANIFEST) Object.assign(NC.ASSET_MANIFEST, NC.ASSET_MANIFEST_GRADE);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const fmt = (n) => NC.fmtCoins(n);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  // ---------------- the six grades ----------------
  const GRADES = [
    { key: 'g0', name: 'ด้าน', en: 'MATTE', color: '#ece6d8', rgb: '236,230,216' },
    { key: 'g1', name: 'เงา', en: 'GLOSSY', color: '#7fe07a', rgb: '127,224,122' },
    { key: 'g2', name: 'วาว', en: 'SHINY', color: '#6fb6ff', rgb: '111,182,255' },
    { key: 'g3', name: 'แวววาว', en: 'GLEAMING', color: '#c792ff', rgb: '199,146,255' },
    { key: 'g4', name: 'เจิดจ้า', en: 'BRILLIANT', color: '#ffc94d', rgb: '255,201,77' },
    { key: 'g5', name: 'ราตรี', en: 'NIGHT', color: '#ff4f86', rgb: '255,79,134' },
  ];
  GRADES.forEach((G) => { NC.RARITY[G.key] = { name: G.name, color: G.color, rgb: G.rgb, w: 0 }; }); // (the bag's colour keys)
  const TOP = GRADES.length - 1;
  const WHAT = ['แถวออฟสุ่มตามปกติ', 'มีออฟ "ดี" อย่างน้อย 1 แถว', 'ทุกแถวเป็น "ดี" ขึ้นไป', 'มีออฟ "เทพ" 1 แถว ที่เหลือ "ดี"',
    'มีออฟเทพ 2 แถว + แถวพิเศษ ◆', 'ทุกแถวเทพ + แถวพิเศษ ◆ + พลังราตรี (กลางคืน)'];
  const MIN_ROWS = [0, 1, 1, 2, 2, 3];

  // ---------------- rows ----------------
  const OPT = W.OPT;
  const isSpecial = (r) => !!(r && OPT[r.k] && OPT[r.k].special);
  const normalKinds = (it) => (NC.optKindsFor ? NC.optKindsFor(it, false) : Object.keys(OPT).filter((k) => !OPT[k].special));
  const specialKinds = (it) => (NC.optKindsFor ? NC.optKindsFor(it, true) : []);
  const canRow = (it) => normalKinds(it).length > 0;
  function setTier(c, r, tier, it) { // (the same kind and sub, the value rolled again in the new tier)
    if (isSpecial(r) || r.tier === tier) return;
    const rest = c.rows.filter((x) => x !== r), nr = W.rollRow(rest, r.k, r.sub, tier, it, {});
    const i = c.rows.indexOf(r);
    if (i >= 0 && nr.k === r.k) c.rows[i] = nr;
  }
  // lift a copy's rows to its grade (never lowers a row that is already better)
  function apply(c) {
    const it = ITEMS[c.id], g = c.g | 0;
    if (!it || !canRow(it)) return;
    while (c.rows.length < Math.min(W.MAX_ROWS, MIN_ROWS[g])) c.rows.push(W.rollRow(c.rows, undefined, undefined, 0, it, {}));
    const plain = () => c.rows.filter((r) => !isSpecial(r));
    const low = () => plain().slice().sort((a, b) => a.tier - b.tier);
    if (g >= 1 && !plain().some((r) => r.tier >= 1) && plain().length) setTier(c, low()[0], 1, it);
    if (g >= 2) for (const r of plain()) if (r.tier < 1) setTier(c, r, 1, it);
    const gods = () => plain().filter((r) => r.tier === 2).length;
    const wantGod = g >= 5 ? plain().length : g >= 4 ? 2 : g >= 3 ? 1 : 0;
    for (let n = 0; gods() < wantGod && n < 6; n++) { const r = low().find((x) => x.tier < 2); if (!r) break; setTier(c, r, 2, it); }
    if (g >= 4 && !c.rows.some(isSpecial)) { // the special row: the worst plain row turns special
      const ks = specialKinds(it);
      if (ks.length) {
        const r = low()[0];
        if (r && c.rows.length >= Math.min(W.MAX_ROWS, MIN_ROWS[g] + 1)) c.rows[c.rows.indexOf(r)] = W.rollRow(c.rows.filter((x) => x !== r), pick(ks), undefined, 2, it, {});
        else if (c.rows.length < W.MAX_ROWS) c.rows.push(W.rollRow(c.rows, pick(ks), undefined, 2, it, {}));
      }
    }
    delete c._fx;
  }
  // the grade a copy's rows already have (old copies, copies from before this file)
  function derive(c) {
    const rows = c.rows || [], plain = rows.filter((r) => !isSpecial(r)), gods = plain.filter((r) => r.tier === 2).length, sp = rows.some(isSpecial);
    const it = ITEMS[c.id], k = it && NC.gearKind ? NC.gearKind(it) : 'A';
    let g = 0;
    if (plain.length && gods === plain.length && plain.length >= 3 && sp) g = 4; // (ราตรี is never derived: only rolled or polished)
    else if (gods >= 2 && sp) g = 4;
    else if (gods >= 1) g = 3;
    else if (plain.length && plain.every((r) => r.tier >= 1)) g = 2;
    else if (plain.some((r) => r.tier >= 1)) g = 1;
    if (k === 'L') g = Math.max(g, 4);
    return g;
  }
  const of = (c) => { if (!c) return 0; if (c.g == null || !(c.g >= 0 && c.g <= TOP)) c.g = derive(c); return c.g; };

  // ---------------- what a drop rolls ----------------
  const TABLE = {
    mon: [60, 28, 9, 2.6, 0.4, 0], elite: [40, 34, 18, 6.5, 1.5, 0], gold: [20, 35, 30, 12, 3, 0],
    boss: [0, 0, 70, 25, 5, 0], craft: [50, 35, 12, 3, 0, 0],
  };
  const BIG = new Set(['lava_dragon', 'aurelion', 'hundred_string', 'sb_aurel', 'sb_aurel2', 'sb_lumen3', 'sb_severin', 'sb_puppet6', 'eclipse_knight']);
  let cur = null; // (the monster whose fall is being handled: what made a drop)
  const isBoss = (e) => !!(e && ((NC.BOSSES && NC.BOSSES[e.type]) || (NC.DUNGEON_BOSSES && NC.DUNGEON_BOSSES[e.type]) || e.storyBoss || e.worldBoss || e.guildBoss || e.rootTag === 'boss'));
  const isElite = (e) => !!(e && (e.elite || e.champ || e.rootTag === 'elite' || e.rootTag === 'key' || (NC.MONSTERS[e.type] && NC.MONSTERS[e.type].eliteOf)));
  function srcOfKill(e) {
    if (!e) return 'mon';
    const t = e.type || '';
    if (/^chest_/.test(t)) return /gold/.test(t) ? 'gold' : /iron/.test(t) ? 'elite' : 'mon';
    if (isBoss(e)) return 'boss';
    return isElite(e) ? 'elite' : 'mon';
  }
  function roll(src, e) {
    const w = (TABLE[src] || TABLE.mon).slice();
    const depth = e && e.rootF ? e.rootF / 100 : 0; // (รากต้นไม้มืด: deeper is better)
    // (a boss's drops roll as on the field, deep or not: the user, 2026-10-12, "เรทดรอปของบอสต้องยากพอๆกับตีบอสปกติ")
    for (let g = 2; g < TOP; g++) w[g] *= src === 'boss' ? 1 : 1 + 1.5 * depth;
    if (src === 'boss' && e) w[TOP] = e.rootF >= 91 ? 1.5 : BIG.has(e.type) || e.worldBoss ? 0.5 : 0;
    const sum = w.reduce((a, b) => a + b, 0);
    let r = Math.random() * sum;
    for (let g = 0; g <= TOP; g++) if ((r -= w[g]) < 0) return g;
    return 0;
  }
  (NC.gearMakeHooks = NC.gearMakeHooks || []).push((c, it, o) => {
    if (!o || (o.src !== 'drop' && o.src !== 'craft')) return;
    let g = o.src === 'craft' ? roll('craft') : roll(srcOfKill(cur), cur);
    if (NC.gearKind && NC.gearKind(it) === 'L') g = Math.max(g, 4); // (the world's legends)
    c.g = g;
    apply(c);
  });
  const baseDmg = NC.damageEnemy;
  NC.damageEnemy = function (game, e) {
    const was = cur;
    cur = e;
    try { return baseDmg.apply(this, arguments); } finally { cur = was; }
  };

  // ---------------- a piece's colour is its item's rarity, its grade the polish gems ◆ ----------------
  // (2026-10-20 player feedback: the bag's cells were in the grade colour while the forge's lists name a piece in its
  // rarity colour, two colours meaning two things; "make the cell the name's colour and show the grade as a picture".
  // The four rarities take the grade palette's keys of the same colours (g0 cream, g2 blue, g3 violet, g4 gold), so every
  // window that styled g0..g5 keeps its look; the grade is 0-5 gems: ดี ◆ ... ราตรี ◆◆◆◆◆. Stars stay the level band.)
  const TINT = { common: 'g0', rare: 'g2', epic: 'g3', legend: 'g4' };
  const tintOf = (id) => TINT[(ITEMS[id] || {}).rarity] || 'g0';
  const rarityColor = (id) => (NC.RARITY[(ITEMS[id] || {}).rarity] || NC.RARITY.common).color;
  // the gems: all = the five places with the empty ones (cards, the forge), else only the ones earned (cells, rows)
  function gems(g, cls, all) {
    g = Math.max(0, Math.min(TOP, g | 0));
    if (!all && !g) return '';
    let s = '';
    const nx = /\bnx\b/.test(cls || ''); // (the forge's after slot: its new gem lit)
    for (let i = 0; i < (all ? TOP : g); i++) s += i < g ? `<s class="on${nx && i === g - 1 ? ' nw' : ''}"></s>` : '<s></s>';
    return `<i class="gt-gems${g >= TOP ? ' top' : ''}${cls ? ' ' + cls : ''}" title="เกรดขัด: ${GRADES[g].name}">${s}</i>`;
  }

  // ---------------- the bag: a piece in its rarity's colour, its gems in the corner (a kind's cell: its best copy's) ----------------
  const bestOf = (p, id) => W.copies(p, id).reduce((a, c) => (!a || of(c) > of(a) || (of(c) === of(a) && (c.ref || 0) > (a.ref || 0)) ? c : a), null);
  NC.invEntryHook = function (en, p) {
    if (!W.isInst(en.id) || (en.kind !== 'item' && !en.copy)) return; // (en.copy: the cell's own piece, in the bag or the storage)
    const c = en.copy || bestOf(p, en.id);
    if (!c) return;
    const g = of(c);
    en.rarity = tintOf(en.id); en.rank = (en.rank || 1) * 10 + g; en.gem = g; // (sorted by rarity, then by grade)
  };
  NC.copyTag = (c) => `<i class="gt-tag">${gems(of(c), 'tag', true)}${GRADES[of(c)].name}</i>`;
  NC.copyStyle = (c) => ` style="color:${rarityColor(c.id)}"`;
  // a piece's colour key (g0 / g2 / g3 / g4: its rarity) for the other places that colour a piece: the worn slots, Uncle
  // Coco's gear tab, the stall cells; two copies of one weapon tell apart by their gems (NC.copyGems)
  NC.copyGradeKey = (c) => (c ? tintOf(c.id) : null);
  NC.wornGradeKey = (p, k) => NC.copyGradeKey(W.wornIn(p, k));
  NC.gradeGems = gems;
  NC.copyGems = (c, cls, all) => (c ? gems(of(c), cls, all) : '');
  NC.wornGems = (p, k) => NC.copyGems(W.wornIn(p, k), 'slot'); // (js/inventory.js: the worn slots' corner)
  NC.invCardExtras.push((p, id, one) => {
    if (!W.isInst(id)) return '';
    const c = one || bestOf(p, id);
    if (!c) return '';
    const g = of(c), G = GRADES[g];
    let h = `<div class="gt-line"><b>เกรดขัด ${gems(g, 'line', true)} ${G.name}</b><span>${WHAT[g]}</span></div>`;
    if ((one ? [one] : W.copies(p, id)).some((x) => of(x) === TOP)) h += `<div class="gt-night">☾ ราตรี: กลางคืน${ITEMS[id].slot === 'weapon' ? ' ATK/MATK +8%' : ' ดาเมจที่โดน −3%'}</div>`;
    return h;
  });
  // a cell's corner: the piece's gems along the top (the level band's "★3" of look A is gone since 2026-10-20: players
  // read the stars as a second grade, "what is the star, why do two gold swords have different stars"; Lv is on the card)
  const baseBadge = NC.invBadge;
  NC.invBadge = function (p, en) {
    const h = baseBadge ? baseBadge.apply(this, arguments) : '';
    if (!en || (en.kind !== 'item' && !en.copy) || !W.isInst(en.id)) return h;
    return h + (en.gem ? gems(en.gem, 'cell') : '');
  };
  // the card's buttons: ตีบวก (to the refine box below) and ขัดเกรด (at the forge)
  NC.invRefineBtn = (p, id) => (W.isInst(id) ? '<button class="iv-btn grey" data-act="gt:refine">ตีบวก</button><button class="iv-btn gold" data-act="gt:grade">ขัดเกรด</button>' : '');
  NC.invActs.push((game, a, en) => {
    if (a === 'gt:refine') { const box = document.querySelector('.iv-detail .rf-box'); if (box) box.scrollIntoView({ behavior: 'smooth', block: 'center' }); return true; }
    if (a !== 'gt:grade') return false;
    const f = game.world && game.world.forge, p = game.player;
    if (!f || NC.dist(p.x, p.y, f.x, f.y) > 420) { game.toast('ขัดเกรดได้ที่โรงตีเหล็กของป๋าหมูหริ่ง'); return true; }
    const c = en && en.copy ? en.copy : en && en.id ? bestOf(p, en.id) : null;
    if (c) { sel = c.u; jump = true; }
    NC.HUD.panel('bag', false);
    setTimeout(() => { game.paused = NC.HUD.panel('forge', true); const t = document.querySelector('[data-fgtab="grade"]'); if (t) t.click(); }, 0);
    return true;
  });
  // the night's power of the ราตรี pieces worn
  NC.skillModSources.push((p) => {
    if (!p || p.kind !== 'player' || !NC.isNightNow || !NC.game || !NC.isNightNow(NC.game)) return null;
    let m = null;
    for (const k in p.equip) {
      const c = W.wornIn(p, k);
      if (!c || of(c) !== TOP) continue;
      m = m || {};
      if (k === 'weapon') { m.atk = (m.atk || 0) + 8; m.matk = (m.matk || 0) + 8; } else m.taken = (m.taken || 0) + 3;
    }
    return m;
  });

  // ---------------- on the ground and when picked up ----------------
  const baseDropAt = W.dropAt;
  W.dropAt = function (game, x, y) {
    const c = baseDropAt.apply(this, arguments);
    if (c) setTimeout(() => { const G = GRADES[of(c)]; if (of(c) >= 2) { FX.ring(x, y, 20, 150 + of(c) * 30, G.rgb, 0.7, 10); FX.stars(x, y - 70, 8 + of(c) * 5, G.rgb, { speed: 260 + of(c) * 30 }); } }, 0);
    return c;
  };
  // a dropped copy stands in its grade's light pillar (Codex art, assets/grade/pillar_0..5.jpg on black, added with
  // 'lighter'; the drop mockup assets/gen/nightcamp_tier_drop_raw.png), breathing, with its star tag over it
  const PILLAR = GRADES.map((G, g) => { const im = new Image(); im.src = `assets/grade/pillar_${g}.jpg`; return im; });
  const PH = 400, FOOT = 0.922; // (world height of a pillar picture; where its ground ring sits in it)
  // (the tag over a drop: its grade's gems as in the bag, 2026-10-20, the painted gem pictures; the frame keeps the light's colour)
  const GEM = ['on', 'off'].map((k) => { const im = new Image(); im.src = `assets/grade/gem_${k}.png`; return im; });
  function starTag(ctx, x, y, g) {
    const G = GRADES[g], w = 86, h = 22, ok = GEM.every((im) => im.complete && im.naturalWidth);
    ctx.save();
    ctx.beginPath(); if (NC.rrect) NC.rrect(ctx, x - w / 2, y - h / 2, w, h, 11); else ctx.rect(x - w / 2, y - h / 2, w, h);
    ctx.fillStyle = 'rgba(27,30,51,0.92)'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = G.color; ctx.stroke();
    for (let i = 0; i < TOP; i++) {
      const cx = x - 32 + i * 16;
      if (ok) { ctx.drawImage(GEM[i < g ? 0 : 1], cx - 6, y - 8, 11.75, 16); continue; }
      ctx.beginPath(); ctx.moveTo(cx, y - 6); ctx.lineTo(cx + 4.5, y); ctx.lineTo(cx, y + 6); ctx.lineTo(cx - 4.5, y); ctx.closePath(); // (the pictures still loading)
      ctx.fillStyle = i < g ? '#bfeaff' : 'rgba(150,150,180,0.35)'; ctx.fill();
    }
    ctx.restore();
  }
  const baseLoot = NC.drawLoot;
  NC.drawLoot = function (ctx, game, l) {
    if (!l || !l.inst || l.potion) return baseLoot.apply(this, arguments);
    const g = of(l.inst), t = game.time, bob = Math.sin(t * 3 + l.x * 0.01) * 6, im = PILLAR[g];
    const live = NC.DropLight && NC.DropLight.draw(ctx, game, l); // (every grade: the live shader light D in its colour, js/droplight.js; the pictures stay as the fallback without WebGL2)
    if (live) { /* drawn */ } else if (im.complete && im.naturalWidth) {
      const k = PH / im.naturalHeight, w = im.naturalWidth * k * 1.2, br = 1 + 0.04 * Math.sin(t * 2.4 + l.x * 0.02), h = PH * br;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.9 + 0.1 * Math.sin(t * 3 + l.x * 0.03);
      ctx.drawImage(im, l.x - w / 2, l.y - h * FOOT, w, h);
      if (g >= 3) { ctx.globalAlpha = 0.35 + 0.2 * Math.sin(t * 2 + l.x * 0.05); ctx.drawImage(im, l.x - w / 2, l.y - h * FOOT, w, h); } // (the upper grades burn brighter)
      ctx.restore();
    } else { // (the picture still loading: the old beam)
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(${GRADES[g].rgb},0.7)`; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(l.x, l.y, 40, 14, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
    if (g >= 4 && FX.stars && Math.random() < 0.1) FX.stars(l.x + NC.rand(-26, 26), l.y - NC.rand(60, 300), 1, GRADES[g].rgb, { speed: 40 });
    if (live) return; // (js/droplight.js draws the item itself, over its light)
    ctx.drawImage(NC.itemIcon(l.id, 128), l.x - 34, l.y - 100 - l.z + bob, 68, 68);
    if (g >= 1) starTag(ctx, l.x, l.y - 118 - l.z + bob, g);
  };
  NC.gradeStarTag = starTag;
  if (NC.gearPicked) NC.gearPicked.push((game, c) => {
    const g = of(c);
    if (g >= 3) NC.HUD.log(`ได้รับ [${GRADES[g].name}] ${NC.copyName(c)}!`, 'level');
    if (g >= 4 && NC.Loot && NC.Loot.news) NC.Loot.news(game, `${game.player.name || 'นักเดินทาง'} ได้ [${GRADES[g].name}] ${ITEMS[c.id].name}!`);
  });

  // ---------------- the stones (materials) ----------------
  const MAT = NC.MATERIALS;
  if (MAT) {
    MAT.mat_polish = { name: 'หินขัดเกรด', price: 3000, desc: 'หินลับมีดเนื้อเนียนสีเทาฟ้า ป๋าหมูหริ่งใช้ขัดของให้เกรดสีขึ้นหนึ่งขั้น' };
    MAT.mat_grade_seal = { name: 'ตราผนึกเกรด', price: 0, rare: true, keep: true, noNpc: true, desc: 'ตราขี้ผึ้งสีม่วง ติดไว้ตอนขัดเกรด ถ้าพลาดเกรดจะไม่ตก (ใช้หมดเฉพาะครั้งที่ช่วยไว้)' };
    MAT.mat_safety = { name: 'หินกันแตก', price: 0, rare: true, keep: true, noNpc: true, desc: 'หินโล่สีฟ้าเงิน ใช้ตอนตีบวก +9 / +10 ถ้าพลาดของจะไม่แตกและไม่ถอย (ใช้หมดเฉพาะครั้งที่ช่วยไว้)' };
    MAT.mat_night_core = { name: 'แก่นราตรี', price: 0, rare: true, keep: true, noNpc: true, desc: 'แก่นสีแดงอมม่วงที่มีดาวมืดอยู่ข้างใน ใช้ขัดของเกรดเจิดจ้าให้เป็นราตรี (รากต้นไม้มืดชั้น 91–100, บอสใหญ่)' };
    const baseIcon = NC.matIcon;
    const ICON = { mat_polish: 'gt_polish', mat_grade_seal: 'gt_seal', mat_safety: 'gt_safety', mat_night_core: 'gt_core' };
    NC.matIcon = (id) => (ICON[id] && NC.ASSET_MANIFEST[ICON[id]] ? NC.ASSET_MANIFEST[ICON[id]].src : baseIcon(id));
    const baseSource = NC.matSource;
    const SRC = { mat_polish: 'หัวหน้าฝูง · หีบเหล็ก/ทอง · บอส · แลกเมล็ดราก', mat_grade_seal: 'บอส (หายาก) · แลกเมล็ดราก · ร้านไอเทม', mat_safety: 'บอส (หายาก) · แลกเมล็ดราก · ร้านไอเทม',
      mat_night_core: 'รากต้นไม้มืดชั้น 91–100 · บอสใหญ่' };
    NC.matSource = (id) => SRC[id] || baseSource(id);
  }
  // they fall: polish stones from elites, chests and bosses; seals and safety stones from bosses now and then;
  // night cores from the deep roots' bosses and the great bosses
  NC.skillKills.push((game, e) => {
    if (!e || e._heroT == null || game.time - e._heroT > 3 || e.lootless) return;
    const src = srcOfKill(e), add = (id, n) => { NC.addMat(game, id, n); NC.HUD.log(`ได้รับ ${MAT[id].name}${n > 1 ? ' ×' + n : ''}`, 'item'); };
    if (src === 'boss') {
      add('mat_polish', 1 + Math.floor(Math.random() * 2));
      if (Math.random() < 0.04) add('mat_grade_seal', 1);
      if (Math.random() < 0.04) add('mat_safety', 1);
      if ((e.rootF >= 91 || BIG.has(e.type) || e.worldBoss) && Math.random() < (e.rootF >= 91 ? 0.6 : 0.2)) add('mat_night_core', 1);
    } else if (src === 'gold' || src === 'elite') { if (Math.random() < (src === 'gold' ? 0.5 : 0.12)) add('mat_polish', 1); }
    else if (Math.random() < 0.002) add('mat_polish', 1);
  });

  // ---------------- ขัดเกรด at ป๋าหมูหริ่ง (a forge tab) ----------------
  const RATE = [90, 70, 45, 20, 8];
  const STONES = [1, 1, 2, 3, 4];
  const COIN = { 1: 5000, 2: 15000, 3: 40000, 4: 80000 }, COINK = [1, 1.5, 2.5, 4, 8];
  const PITY = 10;
  const coinsOf = (c, g) => Math.round((COIN[NC.gearGrade ? NC.gearGrade(ITEMS[c.id]) : 1] || 5000) * COINK[g]);
  function chanceOf(c) { const g = of(c); return (c.gp | 0) >= PITY - 1 ? 100 : RATE[g]; }
  function needOf(c) {
    const g = of(c);
    return { stones: STONES[g], coins: coinsOf(c, g), core: g === 4 ? 1 : 0 };
  }
  // one step down: the best plain row loses a step, a ◆ row under เจิดจ้า turns into a plain one
  function drop(c) {
    const it = ITEMS[c.id];
    c.g = Math.max(0, of(c) - 1);
    const plain = c.rows.filter((r) => !isSpecial(r)).sort((a, b) => b.tier - a.tier);
    if (plain[0] && plain[0].tier > 0) setTier(c, plain[0], plain[0].tier - 1, it);
    if (c.g < 4) { const s = c.rows.find(isSpecial), ks = normalKinds(it); if (s && ks.length) c.rows[c.rows.indexOf(s)] = W.rollRow(c.rows.filter((x) => x !== s), undefined, undefined, 1, it, {}); }
    delete c._fx;
  }
  let sel = null, seal = true, last = null, armedU = 0, jump = false; // (jump: a piece picked from outside, its row scrolled into view)
  function polish(game, c, useSeal) {
    const p = game.player, g = of(c);
    if (g >= TOP) return { ok: false, text: 'เกรดสูงสุดแล้ว' };
    const need = needOf(c), cnt = (id) => NC.matCount(p, id);
    if (cnt('mat_polish') < need.stones || (p.coins || 0) < need.coins || cnt('mat_night_core') < need.core) return { ok: false, text: 'ของไม่พอ' };
    const take = (id, n) => { p.mats[id] -= n; if (p.mats[id] <= 0) delete p.mats[id]; };
    take('mat_polish', need.stones); if (need.core) take('mat_night_core', need.core);
    p.coins -= need.coins; if (NC.Econ) NC.Econ.sink('polish', need.coins);
    const ch = chanceOf(c), win = Math.random() * 100 < ch;
    let text;
    if (win) {
      c.g = g + 1; c.gp = 0; apply(c);
      text = `สำเร็จ! ${NC.copyName(c)} เป็นเกรด${GRADES[c.g].name}`;
      NC.HUD.log(text, 'level');
      if (c.g >= 4 && NC.Loot && NC.Loot.news) NC.Loot.news(game, `${p.name || 'นักเดินทาง'} ขัด ${ITEMS[c.id].name} ได้เกรด${GRADES[c.g].name}!`);
    } else {
      c.gp = Math.min(PITY - 1, (c.gp | 0) + 1);
      const risky = g >= 2, falls = risky && Math.random() < 0.5;
      if (falls && useSeal && cnt('mat_grade_seal') > 0) { take('mat_grade_seal', 1); text = `ไม่สำเร็จ · ตราผนึกเกรดช่วยไว้ เกรดไม่ตก (แต้มช่าง ${c.gp}/${PITY})`; }
      else if (falls) { drop(c); text = `ไม่สำเร็จ · เกรดตกเหลือ${GRADES[c.g].name} (แต้มช่าง ${c.gp}/${PITY})`; }
      else text = `ไม่สำเร็จ · เกรดยังอยู่ (แต้มช่าง ${c.gp}/${PITY})`;
      NC.HUD.log(text, 'warn');
    }
    W.changed(game, c);
    if (NC.saveTrade) NC.saveTrade(game);
    return { ok: win, text };
  }
  const iconCache = new Map();
  const iconOf = (id) => { if (!iconCache.has(id)) { try { iconCache.set(id, NC.itemIcon(id, 96).toDataURL()); } catch (e) { iconCache.set(id, ''); } } return iconCache.get(id); };
  // the forge mockup A (assets/gen/nightcamp_tier_forge_a_raw.png): before -> after slots with their grade pills and what
  // the next grade gives, the chance with the smith's pity, the cost with the warning, the two switches (the grade seal,
  // the safety stone) and the big gold button, the six grades along the bottom
  // (2026-10-20 player feedback "picking what to polish is hard, the piece must be picked from a list": the copies down the
  // left as the refine page's, js/refinewin.js, in two tabs; the slots take the piece's rarity colour and its gems + grade)
  const slot = (c, g, nx) => { // (its foot: the Lv it needs, where the level band's stars were)
    return `<div class="gt2-slotw"><div class="gt2-slot ${tintOf(c.id)}"><img src="${iconOf(c.id)}" alt=""><span class="gt2-stars">Lv ${ITEMS[c.id].lvReq || 1}</span></div>` +
      `<span class="gt2-pill">${gems(g, nx ? 'pill nx' : 'pill', true)}<em>${GRADES[g].name}</em></span><b>${esc(ITEMS[c.id].name)}</b></div>`; };
  const sw = (on, attr, dis) => `<button class="gt2-sw${on ? ' on' : ''}" ${attr} ${dis ? 'disabled' : ''}><i></i><span>${on ? 'เปิด' : 'ปิด'}</span></button>`;
  let ltab = 'w'; // the list's tab: w weapons, a the rest
  const isW = (c) => ITEMS[c.id].slot === 'weapon';
  (NC.FORGE_TABS = NC.FORGE_TABS || []).push({
    key: 'grade', label: 'ขัดเกรด',
    render(body, game) {
      const p = game.player, worn = (x) => Object.keys(p.equip).some((k) => W.wornIn(p, k) === x);
      const rank = (x) => ({ common: 1, rare: 2, epic: 3, legend: 4 }[ITEMS[x.id].rarity] || 0);
      const all = W.copies(p).filter((c) => ITEMS[c.id] && canRow(ITEMS[c.id]))
        .sort((a, b) => worn(b) - worn(a) || of(b) - of(a) || rank(b) - rank(a) || (b.ref || 0) - (a.ref || 0) || (ITEMS[a.id].name > ITEMS[b.id].name ? 1 : -1));
      const legend = '<div class="gt-legend"><b>เกรดขัด</b>' + GRADES.map((G, i) => `<span>${i ? gems(i, 'lg') : '<i class="gt-none">–</i>'}${G.name}</span>`).join('') + '</div>';
      if (!all.length) { body.innerHTML = '<div class="gt-empty">ยังไม่มีของที่ขัดเกรดได้ (อาวุธ ชุด หมวก เครื่องประดับที่มีออฟ)</div>' + legend; return; }
      const picked = all.find((x) => x.u === sel);
      if (picked) ltab = isW(picked) ? 'w' : 'a'; // (opened on a piece: its tab)
      let list = all.filter((x) => isW(x) === (ltab === 'w'));
      if (!list.length) { ltab = ltab === 'w' ? 'a' : 'w'; list = all.filter((x) => isW(x) === (ltab === 'w')); }
      const c = list.find((x) => x.u === sel) || list[0];
      sel = c.u;
      const g = of(c), cnt = (id) => NC.matCount(p, id);
      const left = '<div class="rw-left gt3-left"><nav class="rw-tabs">' +
        `<button class="${ltab === 'w' ? 'on' : ''}" data-gttab="w">อาวุธ</button><button class="${ltab === 'a' ? 'on' : ''}" data-gttab="a">ชุด · หมวก</button></nav>` +
        `<div class="rw-list" data-tab="${ltab}">` + list.map((x) => `<button class="rw-row gt3-row${x.u === c.u ? ' on' : ''}" data-gtsel="${x.u}" style="--rc:${rarityColor(x.id)}">` +
          `<img class="${tintOf(x.id)}" src="${iconOf(x.id)}" alt=""><span><b>${esc(NC.copyName(x))}</b><small>${worn(x) ? 'สวมอยู่ · ' : ''}${GRADES[of(x)].name}</small></span>` +
          gems(of(x), 'row', true) + '</button>').join('') + '</div></div>';
      let h = '<div class="gt2">';
      if (g >= TOP) {
        h += `<div class="gt2-top">${slot(c, g)}<div class="gt2-gives"><b>เกรดราตรีแล้ว</b>เกรดสูงสุด ขัดต่อไม่ได้</div></div>`;
      } else {
        const need = needOf(c), ch = chanceOf(c), ok = cnt('mat_polish') >= need.stones && (p.coins || 0) >= need.coins && cnt('mat_night_core') >= need.core;
        const safe = NC.refineSafe ? NC.refineSafe.get() : true;
        h += `<div class="gt2-top">${slot(c, g)}<span class="gt2-arrow"></span>${slot(c, g + 1, true)}<div class="gt2-gives">${WHAT[g + 1]}</div></div>` +
          `<div class="gt2-box gt2-chance"><span class="gt2-pct">โอกาส <b>${ch}%</b></span><span class="gt2-div"></span>` +
          `<div class="gt2-pity"><span>แต้มช่าง <b>${c.gp | 0}/${PITY}</b></span><i><s style="width:${((c.gp | 0) / PITY) * 100}%"></s></i></div><small>ครบ 10: สำเร็จแน่</small></div>` +
          `<div class="gt2-box gt2-cost"><div class="gt2-costs"><span class="${cnt('mat_polish') >= need.stones ? '' : 'bad'}"><img src="${NC.matIcon('mat_polish')}" alt=""><span>หินขัดเกรด<b>×${need.stones}</b><small>มี ${cnt('mat_polish')}</small></span></span>` +
            (need.core ? `<span class="${cnt('mat_night_core') >= 1 ? '' : 'bad'}"><img src="${NC.matIcon('mat_night_core')}" alt=""><span>แก่นราตรี<b>×1</b><small>มี ${cnt('mat_night_core')}</small></span></span>` : '') +
            `<span class="${(p.coins || 0) >= need.coins ? '' : 'bad'}"><img src="${NC.matIcon('ic_coin')}" alt=""><span><b class="gt2-coin">${fmt(need.coins)} เหรียญ</b></span></span></div>` +
            (g >= 2 ? '<div class="gt2-warn"><i>!</i><span>พลาดแล้วอาจเกรดตก 1 ขั้น</span><small>ตั้งแต่วาวขึ้นไป</small></div>' : '<div class="gt2-warn ok"><i>✓</i><span>เกรดนี้พลาดแล้วไม่ตก</span></div>') + '</div>' +
          '<div class="gt2-bottom"><div class="gt2-toggles">' +
            `<div class="gt2-box gt2-tog"><img src="${NC.matIcon('mat_grade_seal')}" alt=""><span><b>ตราผนึกเกรด ×${cnt('mat_grade_seal')}</b><small>พลาดแล้วเกรดไม่ตก</small></span>${sw(seal, 'data-gtseal="1"', g < 2)}</div>` +
            `<div class="gt2-box gt2-tog"><img src="${NC.matIcon('mat_safety')}" alt=""><span><b>หินกันแตก ×${cnt('mat_safety')}</b><small>ตีบวก +9 / +10 ไม่แตก ไม่ถอย</small></span>${sw(safe, 'data-gtsafe="1"')}</div>` +
          `</div><button class="kw-btn gold gt2-go" data-gtgo="${c.u}" ${ok ? '' : 'disabled'}>${armedU === c.u ? 'กดอีกครั้ง' : 'ขัด!'}</button></div>`;
      }
      if (last && last.u === c.u) h += `<div class="gt-res ${last.ok ? 'ok' : 'bad'}">${esc(last.text)}</div>`;
      // (the list keeps its scroll over a redraw of the same tab; a new tab or a piece picked from the bag shows its row)
      const keep = !jump && body.querySelector(`.gt3-left .rw-list[data-tab="${ltab}"]`), top = keep ? keep.scrollTop : 0;
      jump = false;
      body.innerHTML = '<div class="gt3">' + left +
        '<div class="gt3-main">' + h + '</div>' + legend + '</div></div>'; // (h opens .gt2; the legend under it in the right column)
      const nl = body.querySelector('.gt3-left .rw-list');
      if (nl && keep) nl.scrollTop = top;
      else if (nl) { const on = nl.querySelector('.rw-row.on'); if (on) nl.scrollTop = Math.max(0, on.offsetTop - nl.offsetTop - 8); }
    },
    click(b, game) {
      if (b.dataset.gttab) { ltab = b.dataset.gttab; sel = null; armedU = 0; return true; }
      if (b.dataset.gtsel) { sel = Number(b.dataset.gtsel); armedU = 0; return true; }
      if (b.dataset.gtseal) { seal = !seal; return true; }
      if (b.dataset.gtsafe) { if (NC.refineSafe) NC.refineSafe.set(!NC.refineSafe.get()); return true; }
      if (b.dataset.gtgo) {
        const c = W.bag(game.player).find((x) => x.u === Number(b.dataset.gtgo));
        if (!c) return true;
        if (of(c) >= 2 && armedU !== c.u) { armedU = c.u; setTimeout(() => { if (armedU === c.u) { armedU = 0; if (NC.Forge && NC.Forge.render) NC.Forge.render(); } }, 3000); return true; }
        armedU = 0;
        const r = polish(game, c, seal);
        last = { u: c.u, ok: r.ok, text: r.text };
        const f = game.world && game.world.forge;
        if (f && FX.stars) { if (r.ok) FX.stars(f.x, f.y - 60, 14 + of(c) * 4, GRADES[of(c)].rgb, { speed: 300 }); else if (NC.VFX && NC.VFX.smoke) NC.VFX.smoke(f.x, f.y - 60, 6, '#5a5060', '#9a90a0', { size: 0.9, lifeK: 0.7 }); }
        return true;
      }
      return false;
    },
  });


  NC.Grade = { GRADES, TOP, WHAT, of, set: (c, g) => { c.g = Math.max(0, Math.min(TOP, g | 0)); apply(c); }, apply, derive, roll, polish, chanceOf, needOf, srcOfKill,
    select: (u) => { sel = u; armedU = 0; jump = true; }, // (js/craftgo.js: the bag card's ขัดเกรด opens the page on that piece)
    // (js/online/craft.js once it sent a polish to the server: the next press starts at "กดอีกครั้ง" again; left armed, a
    // quick third press ran the browser's own polish() - a fake success and a fake option row, Discord #102 2026-10-20)
    disarm: () => { armedU = 0; } };
})();
