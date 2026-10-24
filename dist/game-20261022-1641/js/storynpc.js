/* storynpc.js — the story's people standing in the world (the user, 2026-10-02: "ทำ npc เลย"). The main quests are taken
   from and handed to their giver (js/quests_data.js `giver`, from the story bible's "ผู้ให้" column via
   assets/gen/loot/quests_build.py): walk up to them and click, or press T. Over each head: a gold "!" when they have the
   next quest for us (grey while our level is too low), a gold "?" when it can be handed in, a grey "?" while it is going.
   Who stands where, and when they are there (from / until: quest ids, by the story's progress):
     ค่ายกลางป่า   ตาลูเมน (by the fire, until his chapter) · เฮเซล · ลิลลี่ · เมล · ฟินน์ · โนเอล · บรูโน (the training ground)
                  ไอวี่ (chapter 1 only) · ธีโอ (after the salt warehouse, until chapter 13) · โอวลีน (from chapter 5)
     ป่าเห็ดเรืองแสง ภูตเห็ด · ทุ่งลมหวีดหน้าผา ปู่ชอว์น (by the stone ring) · หนองพิษ แม่มดหนอง (by her hut)
   The givers that were already in the game: ลุงโกโก้ (js/shop.js) and ยายกระต่าย (js/life_farm.js, the farm).
   Art: assets/npc/ (assets/gen/make_storynpc_prompts.py -> Codex -> tools/monster_cut.py --dir npc). Drawn among the
   characters like the merchant (NC.Party hooks). Hooks: NC.questTalk / NC.questWhere (quests.js), NC.Party, T, clicks.
   Test: ?quest=MQ20 (the chain starts there), NC.StoryNPC.list. */
(function () {
  'use strict';
  const NC = window.NC, P = NC.Party, TAU = Math.PI * 2;
  if (!P) return;
  if (NC.ASSET_MANIFEST_NPC) Object.assign(NC.ASSET_MANIFEST, NC.ASSET_MANIFEST_NPC); // (assets/npc.manifest.js)
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const TALK = 230;

  // id: name, title (under the name), map, at, sprite, h (world units), from / until (quest ids), lines (idle talk)
  const DEFS = {
    lumen: { name: 'ตาลูเมน', title: 'ผู้เฝ้าไฟ', map: 'camp', at: [1410, 1585], h: 165, until: 'MQ151',
      lines: ['เข้ามาใกล้ไฟสิ เจ้าหนู', 'ไฟคืนนี้อุ่นดีนะ', 'ข้าเหลาไม้ไปเรื่อย ๆ มือมันว่างไม่เป็น', 'ระฆังพลบค่ำดังเมื่อไร ทุกคนต้องกลับมาที่ไฟ'] },
    hazel: { name: 'กัปตันเฮเซล', title: 'หัวหน้าคาราวาน', map: 'camp', at: [2150, 1470], h: 170,
      lines: ['ขอบแสงคืนนี้เงียบผิดปกติ', 'ถ้าจะออกไป อย่ากลับมาหลังระฆัง', 'ค่ายนี้อยู่ได้เพราะทุกคนช่วยกัน', 'ถืออาวุธให้มั่นก่อนออกนอกไฟ'] },
    lily: { name: 'ลิลลี่', title: 'กับลูกเจี๊ยบพุดดิ้ง', map: 'camp', at: [1650, 1640], h: 112,
      lines: ['พี่! พุดดิ้งหิวอีกแล้ว', 'พี่เห็นแสงในกองไฟด้วยใช่ไหม', 'วันนี้ไม่มีชื่อถูกขีดเลยนะ', 'มือพี่เย็นจัง'] },
    mel: { name: 'ซิสเตอร์เมล', title: 'ผู้รักษา', map: 'camp', at: [1270, 1300], h: 158,
      lines: ['แสงแดดในขวด เก็บได้แค่ตอนกลางวันนะ', 'ใครเจ็บมาทางนี้เลย', 'พักข้างไฟก่อนออกไปอีกรอบนะ'] },
    finn: { name: 'ฟินน์', title: 'พรานนำทาง', map: 'camp', at: [1860, 1560], h: 160,
      lines: ['วันนี้ป่าเงียบดี ไปล่ากันไหม!', 'ฮ่า ๆ ธนูข้าไม่เคยพลาด... เกือบไม่เคย', 'กระดานล่าค่าหัวมีงานใหม่นะ'] },
    noel: { name: 'โนเอล', title: 'ผู้นำทางเงา', map: 'camp', at: [1960, 1360], h: 150,
      lines: ['...', 'อย่าเดินชิดไฟนัก', 'เงาวันนี้ยาวกว่าเมื่อวาน', 'ระวังตัวด้วยล่ะ'] },
    bruno: { name: 'บรูโน', title: 'อาจารย์นักรบคลั่ง', map: 'camp', at: [2440, 1500], h: 205,
      lines: ['ฮ่า! ตีหุ่นฟางให้มันพังสิ!', 'ขวานหนักแค่ไหน ใจต้องหนักกว่า', 'มาฝึกกับข้าไหม เจ้าตัวเล็ก'] },
    ivy: { name: 'หมอไอวี่', title: 'หมอประจำค่าย', map: 'camp', at: [1240, 1460], h: 160, until: 'MQ14',
      lines: ['ช่วยเก็บดอกบัวใต้จันทร์ให้หน่อยได้ไหม', 'ใครไอทั้งคืน มาหาฉันนะ', 'ตัวเธอไม่อุ่นเลยนะ...'] },
    theo: { name: 'ธีโอ', title: 'เด็กหนุ่มที่ขอเดินตาม', map: 'camp', at: [1740, 1700], h: 148, from: 'MQ42b', until: 'MQ133',
      lines: ['พี่! วันนี้ผมจดท่าใหม่ไว้แล้ว', 'ผมถือของได้นะ ให้ผมไปด้วย', 'ผมเก็บขนมปังไว้ให้พี่ครึ่งหนึ่ง เผื่อพี่หิว'] },
    owleen: { name: 'มาดามโอวลีน', title: 'นักดูดาว', map: 'camp', at: [1330, 1740], h: 140, from: 'MQ45',
      lines: ['ดาวคืนนี้เรียงตัวแปลก ๆ', 'ฉันเคยคิดเลขได้เร็วที่สุดในรุ่น...', 'แผนที่ดาวไม่เคยโกหก'] },
    shroom: { name: 'ภูตเห็ด', title: 'ผู้เฝ้าป่าเห็ด', map: 'woods', at: [1640, 1180], h: 90, sprite: 'mushling',
      lines: ['ไม้เดินได้มาอีกแล้ว', 'เจ้าไม่มีกลิ่นแสงเลยนะ', 'ป่านี้ไม่ชอบคนถือตะเกียง'] },
    shaun: { name: 'ปู่ชอว์น', title: 'ผู้เฝ้าวงหิน', map: 'wind', at: [1420, 2390], h: 150,
      lines: ['วงหินนี้จำชื่อทุกหมู่บ้าน', 'ลมวันนี้พัดมาจากทางหลุมดาว', 'แกะของปู่หายไปตัวหนึ่ง...'] },
    witch: { name: 'แม่มดหนอง', title: 'อดีตผู้จุดตะเกียง', map: 'swamp', at: [3346, 864], h: 150,
      lines: ['ความรู้มีราคาเสมอ', 'ตะเกียงดวงนี้ฉันไม่จุดมันอีกแล้ว', 'ฮิ ฮิ หนองนี้ไม่มีใครมาเก็บส่วย'] },
  };
  // (camp.js 2026-10-04: the camp grew; its people move with it, the stargazer up to the star hill)
  if (NC.campPt) for (const [id, D] of Object.entries(DEFS)) if (D.map === 'camp') D.at = id === 'owleen' ? [1580, 1320] : NC.campPt(D.at[0], D.at[1]);
  const LIST = [];
  for (const [id, D] of Object.entries(DEFS)) {
    LIST.push(Object.assign({ id, kind: 'ally', npc: true, storyNpc: true, dead: 0, face: 1, t: Math.random() * 5, wave: 0,
      say: '', sayT: 0, near: false, sprite: 'npc_' + id, x: D.at[0], y: D.at[1], sort: D.at[1], placed: null }, D));
  }
  const byId = (id) => LIST.find((n) => n.id === id);

  // ---------------- who is where, now ----------------
  const Q = () => NC.Quests;
  const idx = (id) => (Q() ? Q().data.findIndex((q) => q.id === id) : -1);
  function present(n) {
    const S = Q() && Q().state;
    if (!S) return !n.from;
    if (n.from && !(S.i > idx(n.from))) return false; // (after that quest is handed in)
    if (n.until && S.i > idx(n.until)) return false;
    return true;
  }
  const here = (game, n) => !!(game && game.mapId === n.map && present(n));
  // the first time on a map: stand on open ground near the spot
  function place(game, n) {
    if (n.placed === game.world) return;
    n.placed = game.world;
    const w = game.world;
    for (let r = 0; r < 400; r += 30) for (let a = 0; a < TAU; a += 0.6) {
      const x = n.at[0] + Math.cos(a) * r, y = n.at[1] + Math.sin(a) * r * 0.6;
      if (!w.fits || w.fits(x, y, 34)) { n.x = Math.round(x); n.y = Math.round(y); n.sort = n.y; return; }
    }
  }

  // ---------------- the quests: who gives the current one ----------------
  const cur = () => (Q() ? Q().cur() : null);
  function giverOf(q) {
    const g = q && q.giver;
    if (!g) return null;
    if (g === 'coco') return NC.Shop ? { name: NC.Shop.npc.name, map: 'camp', npcObj: NC.Shop.npc } : null;
    if (g === 'rabbit') { const m = NC.Life && NC.Life.mentors.find((x) => x.id === 'rabbit'); return m ? { name: m.name, map: 'homefarm', npcObj: m } : null; }
    const n = byId(g);
    return n ? { name: n.name, map: n.map, npcObj: n } : null;
  }
  NC.questTalk = function (game, q) {
    const G = giverOf(q), p = game && game.player;
    if (!G || !p) return !!(game && game.world && game.world.shop); // (no giver: anywhere in the camp, as before)
    const o = G.npcObj;
    if (o.storyNpc) return here(game, o) && NC.dist(p.x, p.y, o.x, o.y) < TALK + 60;
    if (G.map === 'homefarm') return game.mapId === 'homefarm' && NC.dist(p.x, p.y, o.x, o.y) < TALK + 60;
    return !!(game.world && game.world.shop) && NC.dist(p.x, p.y, o.x, o.y) < TALK + 60;
  };
  NC.questWhere = function (q) {
    const G = giverOf(q);
    if (!G) return 'ค่ายกลางป่า';
    return `${G.name} (${(NC.MAPS[G.map] || {}).name || ''})`;
  };
  // the mark over a head: '!' offer / '?' ready / '…' going, gold or grey
  function markOf(game, n) {
    const q = cur();
    if (!q || q.giver !== n.id || !q.ok) return null;
    const S = Q().state, p = game.player;
    if (!S.on) return { ch: '!', gold: p.lv >= Q().lvNeed(q) };
    return { ch: '?', gold: Q().ready(q, p) };
  }

  // ---------------- among the characters ----------------
  function say(n, text) { n.say = text; n.sayT = 3.6; }
  const baseUpdate = P.update;
  P.update = function (game, dt) {
    baseUpdate.call(P, game, dt);
    const p = game.player;
    if (!p) return;
    for (const n of LIST) {
      if (!here(game, n)) continue;
      place(game, n);
      const d = NC.dist(p.x, p.y, n.x, n.y);
      n.t += dt; n.wave = Math.max(0, n.wave - dt); n.sayT = Math.max(0, n.sayT - dt);
      const near = d < TALK && p.dead <= 0;
      if (near && !n.near) { n.wave = 1.2; const m = markOf(game, n); say(n, m ? (m.ch === '!' ? 'มีเรื่องอยากขอให้ช่วย...' : m.gold ? 'กลับมาแล้ว! ได้ของมาครบไหม' : 'เป็นไงบ้าง ยังไหวไหม') : pick(n.lines)); }
      n.near = near;
      if (d < 700 && Math.abs(p.x - n.x) > 24) n.face = p.x < n.x ? -1 : 1;
      if (d < 560 && n.sayT <= 0 && Math.random() < dt / 14) say(n, pick(n.lines));
    }
  };
  const baseCollect = P.collect;
  P.collect = function (list, visible) {
    baseCollect.call(P, list, visible);
    const game = NC.game;
    for (const n of LIST) if (here(game, n) && visible(n.x - 120, n.y - 240, n.x + 120, n.y + 40)) list.push(n);
  };
  const baseDraw = P.draw;
  P.draw = function (ctx, game, a) {
    if (!a.storyNpc) return baseDraw.call(P, ctx, game, a);
    const B = a.sprite + '_b', pose = a.wave > 0 && NC.SPR[B] ? B : a.sprite, b = Math.sin(a.t * 2.4) * 0.018;
    NC.drawShadow(ctx, a.x, a.y, 34, 10, 0.22);
    if (NC.SPR[pose]) NC.drawSpr(ctx, pose, a.x, a.y, { flip: a.face < 0, sx: 1 + b * 0.5, sy: 1 - b });
  };
  function bubble(ctx, text, x, y, alpha) {
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.font = "500 20px 'Mitr', sans-serif";
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = Math.min(400, ctx.measureText(text).width + 30), h = 40;
    ctx.beginPath(); NC.rrect(ctx, x - w / 2, y - h, w, h, 14);
    ctx.fillStyle = '#fffaf0'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = NC.OUTLINE; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 9, y - 2); ctx.lineTo(x, y + 12); ctx.lineTo(x + 9, y - 2); ctx.closePath();
    ctx.fillStyle = '#fffaf0'; ctx.fill(); ctx.stroke();
    ctx.fillRect(x - 7, y - 6, 14, 6);
    ctx.fillStyle = NC.OUTLINE; ctx.fillText(text, x, y - h / 2 + 1, w - 20);
    ctx.restore();
  }
  function mark(ctx, game, m, x, y) { // a chunky ! or ? that bobs
    const bob = Math.sin(game.time * 4) * 5, s = 1 + (m.gold ? Math.sin(game.time * 6) * 0.06 : 0);
    ctx.save();
    ctx.translate(x, y + bob); ctx.scale(s, s);
    if (m.gold && NC.VFX) NC.VFX.glow(ctx, 0, -6, 60, '255,215,90', 0.35, true);
    ctx.font = "900 58px 'Baloo 2', 'Mitr', sans-serif"; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round'; ctx.lineWidth = 11; ctx.strokeStyle = NC.OUTLINE || '#2a2435'; ctx.strokeText(m.ch, 0, 0);
    ctx.fillStyle = m.gold ? '#ffd23a' : '#b9bccb'; ctx.fillText(m.ch, 0, 0);
    ctx.restore();
  }
  const baseTags = P.drawTags;
  P.drawTags = function (ctx, game) {
    baseTags.call(P, ctx, game);
    if (!NC.drawTag || !game.player) return;
    const c = game.cam;
    for (const n of LIST) {
      if (!here(game, n) || n.x < c.x - 300 || n.x > c.x + game.vw + 300 || n.y < c.y - 300 || n.y > c.y + game.vh + 300) continue;
      const top = n.y - n.h - 30;
      NC.drawTag(ctx, n.name, n.x, n.y + 32, 22, '#ffd873');
      NC.drawTag(ctx, n.title, n.x, n.y + 58, 16, '#e8e0d2');
      const m = NC.Lessons && NC.Lessons.of ? NC.Lessons.of(game, n.id) : markOf(game, n); // (js/lessons.js: lessons and painted marks)
      if (m && !(NC.Lessons && NC.Lessons.draw && NC.Lessons.draw(ctx, game, m, n.x, top - 18))) mark(ctx, game, m, n.x, top - 18);
      if (n.sayT > 0) bubble(ctx, n.say, n.x, top - (m ? 62 : 0), NC.clamp(n.sayT / 0.3, 0, 1) * NC.clamp((3.6 - n.sayT) / 0.15, 0, 1));
      else if (n.near) NC.drawTag(ctx, 'กด T หรือคลิก เพื่อคุย', n.x, top - (m ? 70 : 8) + Math.sin(game.time * 4) * 3, 20, '#fff3cf');
    }
  };

  // ---------------- talking: a small window with the quest ----------------
  let win = null, who = null;
  function build() {
    win = document.createElement('div');
    win.id = 'snpc'; win.className = 'kw-panel'; win.hidden = true;
    win.innerHTML = '<div class="sn-wrap"><section class="kw-win sn-win"><header class="kw-title"><span id="sn-name"></span>' +
      '<button class="kw-x" id="sn-close" aria-label="ปิด">✕</button></header><div class="sn-body"><div class="sn-art"><img id="sn-img" alt=""></div>' +
      '<div class="sn-text" id="sn-text"></div></div></section></div>';
    document.body.appendChild(win);
    $('sn-close').addEventListener('click', close);
    win.addEventListener('click', (e) => {
      if (e.target === win) { close(); return; }
      const b = e.target.closest('[data-sn]');
      if (!b || b.disabled) return;
      const game = NC.game;
      if (b.dataset.sn === 'take') { close(); Q().take(game); }
      else if (b.dataset.sn === 'in') { close(); Q().handIn(game); }
      else close();
    });
  }
  function close() { if (win) win.hidden = true; if (NC.game) NC.game.paused = false; }
  function open(game, n) {
    if (NC.Lessons && NC.Lessons.talk && NC.Lessons.talk(game, n.id, true)) return; // (js/lessons.js: the one quest talk window, mockup A)
    if (!win) build();
    who = n;
    const q = cur(), p = game.player, S = Q() && Q().state;
    const src = (NC.SPR[n.sprite] && NC.SPR[n.sprite].img && NC.SPR[n.sprite].img.src) || '';
    $('sn-name').textContent = `${n.name} · ${n.title}`;
    $('sn-img').src = src;
    let h = '';
    if (q && q.giver === n.id && q.ok) {
      const objs = q.obj.filter((o) => o.k !== 'talk' || !S.on).map((o, k) => `<li>${Q().objText(o, q.obj.indexOf(o), p)}</li>`).join('');
      const lvOk = p.lv >= Q().lvNeed(q);
      h += `<div class="sn-ch">${esc(q.ch)}</div><div class="sn-q">${esc(q.title)}</div>`;
      if (!S.on) {
        h += `<p class="sn-say">${esc(pick(n.lines))}</p><ul class="sn-obj">${objs}</ul><div class="sn-rew">รางวัล ${NC.fmtCoins(q.coins)} เหรียญ</div>` +
          `<div class="sn-btns"><button class="kw-btn gold" data-sn="take" ${lvOk ? '' : 'disabled'}>รับเควส</button><button class="kw-btn grey" data-sn="x">ไว้ทีหลัง</button></div>` +
          (lvOk ? '' : `<div class="sn-dim">ต้อง Lv ${Q().lvNeed(q)} ก่อน · ฟาร์มให้ถึงก่อนนะ (เควสไม่ให้ EXP)</div>`);
      } else {
        const rd = Q().ready(q, p);
        h += `<p class="sn-say">${rd ? 'ทำได้ครบแล้ว! ขอบใจมากนะ' : 'ยังไม่ครบนะ ค่อย ๆ ทำไป'}</p><ul class="sn-obj">${objs}</ul>` +
          `<div class="sn-btns"><button class="kw-btn gold" data-sn="in" ${rd ? '' : 'disabled'}>ส่งเควส</button><button class="kw-btn grey" data-sn="x">ปิด</button></div>`;
      }
    } else {
      h += `<p class="sn-say">${esc(pick(n.lines))}</p>`;
      if (q && q.ok) h += `<div class="sn-dim">เควสหลักตอนนี้: <b>${esc(q.title)}</b> · ไปคุยกับ ${esc(NC.questWhere(q))}</div>`;
      h += '<div class="sn-btns"><button class="kw-btn grey" data-sn="x">ลาก่อน</button></div>';
    }
    $('sn-text').innerHTML = h;
    win.hidden = false; game.paused = true;
    n.wave = 1.2;
  }
  function nearest(game) {
    const p = game.player;
    let best = null, bd = TALK;
    for (const n of LIST) { if (!here(game, n)) continue; const d = NC.dist(p.x, p.y, n.x, n.y); if (d < bd) { bd = d; best = n; } }
    return best;
  }
  addEventListener('keydown', (e) => {
    if (e.code !== 'KeyT' || e.repeat || !NC.game || !NC.game.player) return;
    const t = document.activeElement;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    if (win && !win.hidden) { close(); return; }
    const n = nearest(NC.game);
    if (n) open(NC.game, n);
  });
  addEventListener('keydown', (e) => { if (e.code === 'Escape' && win && !win.hidden) { e.stopImmediatePropagation(); close(); } }, true);
  // a click on one opens the talk (instead of swinging at them)
  addEventListener('mousedown', (e) => {
    const game = NC.game;
    if (e.button !== 0 || !game || !game.player || e.target !== $('view') || (win && !win.hidden)) return;
    const wx = game.cam.x + (e.clientX * game.dpr) / game.scale, wy = game.cam.y + (e.clientY * game.dpr) / game.scale;
    const n = LIST.find((k) => here(game, k) && Math.abs(wx - k.x) < 60 && wy > k.y - k.h - 10 && wy < k.y + 16);
    if (!n) return;
    e.stopImmediatePropagation(); e.preventDefault();
    if (NC.dist(game.player.x, game.player.y, n.x, n.y) < TALK + 60) open(game, n);
    else game.toast(`เดินเข้าไปใกล้${n.name}ก่อนนะ`);
  }, true);

  NC.StoryNPC = { list: LIST, byId, present, open: (id) => open(NC.game, byId(id)), giverOf };
})();
