/* shop.js — the camp merchant: ลุงโกโก้, a raccoon at his striped market stall in the middle of the camp. He buys the
   materials monsters drop (js/materials.js) for coins and sells potions for coins. Walk up to him and press B, or
   click him. Anywhere else B opens the same window as the material pouch. The window is js/shopwin.js (the old dark
   one built here is gone, 2026-10-21); here: buying (NC.Shop.buy) and the skill reset (NC.resetSkills).
   Hooks: NC.buildWorld (the stall is a prop of the camp, with its footprint and its lantern), NC.Party.update /
   collect / draw / drawTags (the merchant stands, waves and talks among the characters), NC.HUD.init / update (the
   menu button with its dot, the coin on the minimap), the B key and clicks on him. */
(function () {
  'use strict';
  const NC = window.NC, TAU = Math.PI * 2;
  const $ = (id) => document.getElementById(id);
  const MAT = NC.MATERIALS, P = NC.Party;
  const fmt = (n) => NC.fmtCoins(n);

  // where he stands in the camp (world.js coordinates), how near the hero must be to trade, what potions cost
  const CS = NC.CAMP_SPOT; // (camp.js 2026-10-04: the big camp's market)
  const STALL = CS ? CS.stall : { x: 1150, y: 1590 }, SELLER = CS ? CS.seller : { x: 1254, y: 1652 }, TALK = 240;
  // the potions: three sizes of each since 2026-10-04 (js/potions.js holds their numbers)
  const POTIONS = NC.POT ? NC.POT.LIST.map((q) => ({ id: q.id, name: q.name, what: q.what, icon: (NC.ASSET_MANIFEST[q.icon] || {}).src || 'assets/' + q.icon + '.png',
    price: q.price, key: q.key, size: q.size, color: q.color })) : [
    { id: 'red', name: 'ยาแดง', what: 'ฟื้น HP 25% (ปุ่ม 1)', icon: 'assets/ic_potion.png', price: 25, key: 'potions' },
    { id: 'blue', name: 'ยาฟ้า', what: 'ฟื้น SP 25% (ปุ่ม 2)', icon: 'assets/ic_sppotion.png', price: 40, key: 'spPotions' },
  ];
  const GREET = ['ยินดีต้อนรับจ้า~ มีของมาขายไหม?', 'วัสดุจากมอนสเตอร์ ลุงรับซื้อหมดเลย!', 'แวะมาอีกแล้ว ดีใจจัง~', 'ยาแดงยาฟ้า ราคามิตรภาพจ้า'];
  const CHAT = ['เขี้ยวหมูป่าวันนี้ราคาดีนะ~', 'ผลึกแกนโกเลม... อยากได้สักก้อนจัง', 'ได้ยินว่าราชาเห็ดมีมงกุฎทองด้วยล่ะ!', 'ของแพงอยู่ที่ผาหินแดงนะ', 'ขายหมดเลยไหม? ลุงนับให้~'];
  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  const NPC = { kind: 'ally', npc: true, name: 'ลุงโกโก้', x: SELLER.x, y: SELLER.y, sort: SELLER.y, dead: 0, face: 1, t: 0, wave: 0,
    say: '', sayT: 0, near: false };
  NC.Shop = { npc: NPC, stall: STALL, talk: TALK, POTIONS, GREET, CHAT }; // (POTIONS / GREET / CHAT: the K shop window, js/shopwin.js)
  const here = (game) => !!(game && game.world && game.world.shop);
  NC.Shop.canTrade = (game) => !!(here(game) && game.player && game.player.dead <= 0 &&
    NC.dist(game.player.x, game.player.y, NPC.x, NPC.y) <= NC.Shop.talk);
  const nearHim = (game) => NC.Shop.canTrade(game);
  // Both windows call the same operation. Online replaces it with a request whose reply owns the stock and coins.
  NC.Shop.buy = function (game, pid, n) {
    const p = game && game.player, q = NC.Shop.POTIONS.find((item) => item.id === pid);
    if (!q || !nearHim(game) || NC.Shop.buyPending || !Number.isInteger(n) || n < 1 || n > 100) return false;
    const cost = q.price * n;
    if (!Number.isFinite(cost) || cost < 0 || !(p.coins >= cost)) return false;
    p.coins -= cost; p[q.key] = (p[q.key] || 0) + n;
    if (NC.Lessons && NC.Lessons.ev) NC.Lessons.ev('buy');
    NC.HUD.log(`ซื้อ${q.name} ×${n} จ่าย ${fmt(cost)} เหรียญ`, 'item');
    NC.saveGame(game);
    return true;
  };

  // ---------------- the stall: a prop of the camp ----------------
  const baseBuild = NC.buildWorld;
  NC.buildWorld = function () {
    const w = baseBuild.apply(this, arguments), s = NC.SPR.shop_stall;
    if (!s) return w;
    const prop = { kind: 'prop', name: 'shop_stall', x: STALL.x, y: STALL.y, scale: 1, flip: false, sort: STALL.y, shadow: [175, 30] };
    w.props.push(prop);
    const mark = (cx, cy, rx, ry) => {
      for (let gy = Math.floor((cy - ry) / w.CELL); gy <= (cy + ry) / w.CELL; gy++)
        for (let gx = Math.floor((cx - rx) / w.CELL); gx <= (cx + rx) / w.CELL; gx++) {
          if (gx < 0 || gy < 0 || gx >= w.GW || gy >= w.GH) continue;
          const nx = (gx * w.CELL + w.CELL / 2 - cx) / rx, ny = (gy * w.CELL + w.CELL / 2 - cy) / ry;
          if (nx * nx + ny * ny <= 1) w.solid[gy * w.GW + gx] = 1;
        }
    };
    mark(STALL.x, STALL.y - 14, 172, 34); // the counter, the crates and the barrel
    mark(SELLER.x, SELLER.y - 4, 30, 13); // the merchant himself
    // the paper lantern at the left end of the awning
    w.lights.push({ x: STALL.x - s.ax * s.w + s.w * 0.12, y: STALL.y - s.h * 0.6, r: 280, rgb: '255,205,130', flick: 2.3, owner: prop });
    w.shop = NPC;
    return w;
  };

  // ---------------- the merchant: among the characters (drawn like a party member) ----------------
  function say(text) { NPC.say = text; NPC.sayT = 3.6; }
  const baseUpdate = P.update;
  P.update = function (game, dt) {
    baseUpdate.call(P, game, dt);
    if (!here(game)) return;
    const p = game.player, d = NC.dist(p.x, p.y, NPC.x, NPC.y);
    NPC.t += dt; NPC.wave = Math.max(0, NPC.wave - dt); NPC.sayT = Math.max(0, NPC.sayT - dt);
    const near = d < TALK && p.dead <= 0;
    if (near && !NPC.near) { NPC.wave = 1.3; say(pick(GREET)); }
    NPC.near = near;
    if (d < 700 && Math.abs(p.x - NPC.x) > 24) NPC.face = p.x < NPC.x ? -1 : 1; // he looks at the hero
    if (d < 560 && NPC.sayT <= 0 && Math.random() < dt / 10) say(pick(near ? GREET : CHAT));
  };
  const baseCollect = P.collect;
  P.collect = function (list, visible) {
    baseCollect.call(P, list, visible);
    if (here(NC.game) && visible(NPC.x - 110, NPC.y - 200, NPC.x + 110, NPC.y + 40)) list.push(NPC);
  };
  const baseDraw = P.draw;
  P.draw = function (ctx, game, a) {
    if (!a.npc) return baseDraw.call(P, ctx, game, a);
    const pose = a.wave > 0 && NC.SPR.merchant_b ? 'merchant_b' : 'merchant', b = Math.sin(a.t * 2.4) * 0.018;
    NC.drawSpr(ctx, pose, a.x, a.y, { flip: a.face < 0, sx: 1 + b * 0.5, sy: 1 - b });
  };
  function bubble(ctx, text, x, y, alpha) {
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.font = "500 20px 'Mitr', sans-serif";
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = Math.min(360, ctx.measureText(text).width + 30), h = 40;
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
    NC.drawTag(ctx, NPC.name, NPC.x, NPC.y + 32, 22, '#ffd873');
    NC.drawTag(ctx, 'ร้านรับซื้อวัสดุ · ขายยา', NPC.x, NPC.y + 58, 16, '#e8e0d2');
    if (NPC.sayT > 0) bubble(ctx, NPC.say, NPC.x, NPC.y - 188, NC.clamp(NPC.sayT / 0.3, 0, 1) * NC.clamp((3.6 - NPC.sayT) / 0.15, 0, 1));
    else if (NPC.near) {
      const bob = Math.sin(game.time * 4) * 3;
      NC.drawTag(ctx, 'กด B หรือคลิก เพื่อค้าขาย', NPC.x, NPC.y - 196 + bob, 20, '#fff3cf');
    }
  };

  // One extra free reset per character; the early-game free resets do not spend this gift.
  NC.SKILL_RESET_GIFT = 'coco-reskill-20261019';
  NC.skillResetCoinPrice = (p) => (p.lv <= 40 ? 0 : (p.lv - 39) * 100);
  NC.skillResetGiftAvailable = (p) => !!(NC.SKILL_RESET_GIFT && p &&
    (!(NC.OnlineWorld && NC.OnlineWorld.ready) || p.skillResetUsed !== undefined) &&
    !(p.skillResetUsed && p.skillResetUsed[NC.SKILL_RESET_GIFT]));
  NC.skillResetPrice = (p) => {
    const price = NC.skillResetCoinPrice(p);
    return price > 0 && NC.skillResetGiftAvailable(p) ? 0 : price;
  };
  // The legacy shop uses the same server reset notification as shopwin.js.
  NC.resetSkills = function (game) {
    const p = game && game.player;
    if (!p || !nearHim(game)) return false;
    const online = NC.OnlineWorld && NC.OnlineWorld.ready;
    // A reconnecting online hero must wait for the server, never take the offline reset path.
    if (NC.Online && NC.Online.enabled && (!online || NC.Online.status !== 'online')) return false;
    if (NC.OnlineWorld && NC.OnlineWorld.skillResetPending && NC.OnlineWorld.skillResetPending()) return false;
    const price = NC.skillResetPrice(p);
    if (p.coins < price || NC.skillPoints(p) - NC.skillLeft(p) <= 0) return false;
    p.coins -= price;
    p.skills = NC.newSkills(p.job);
    // every socketed rune back to the bag: no skill reaches its slots now (bug report #83; online the server's reset
    // does it, backend patch 014, and js/online/buildloot.js shows its record)
    const runesBack = !online && NC.BL && NC.BL.returnAll ? NC.BL.returnAll(game) : 0;
    p.hotbar = null; NC.hotbarOf(p);
    NC.applyGear(game);
    // Online consumes the gift only in the committed server snapshot.
    if (!online && NC.skillResetCoinPrice(p) > 0 && NC.skillResetGiftAvailable(p))
      p.skillResetUsed = Object.assign({}, p.skillResetUsed, { [NC.SKILL_RESET_GIFT]: true });
    NC.HUD.log(online ? 'กำลังรีเซ็ตสกิล…' : price ? `รีเซ็ตสกิลแล้ว จ่าย ${fmt(price)} เหรียญ · แต้มสกิล ${NC.skillLeft(p)} แต้มพร้อมลงใหม่` : `รีเซ็ตสกิลแล้ว · แต้มสกิล ${NC.skillLeft(p)} แต้มพร้อมลงใหม่ (กด K)`, 'level');
    if (runesBack) NC.HUD.log(`รูนที่จารึกไว้ ${runesBack} อันกลับเข้ากระเป๋าแล้ว`, 'item');
    NPC.wave = 1; say(online ? 'กำลังรีเซ็ตสกิล…' : 'ลองสายใหม่ดูนะ สู้ ๆ!');
    if (NC.OnlineWorld && NC.OnlineWorld.skillReset) NC.OnlineWorld.skillReset(price);
    NC.saveGame(game);
    if (NC.HUD.updateHotbar) NC.HUD.updateHotbar(p);
    if (NC.HUD.renderSkills) NC.HUD.renderSkills();
    return true;
  };
  // ---------------- hooks into the HUD ----------------
  const baseInit = NC.HUD.init.bind(NC.HUD);
  NC.HUD.init = function (game) {
    baseInit(game);
    // the menu button (B), next to the equipment (I)
    const bar = document.querySelector('.menubar'), bag = bar && bar.querySelector('[data-panel="bag"]');
    if (bar) {
      const b = document.createElement('button');
      b.className = 'mbtn'; b.title = 'กระเป๋าวัสดุ / ร้านค้า (B)';
      b.innerHTML = `<img src="${NC.matIcon('ic_pouch')}" alt=""><b>B</b><i class="dot" id="matdot" hidden></i>`;
      b.addEventListener('click', () => { game.paused = NC.HUD.panel('shop'); });
      bar.insertBefore(b, bag ? bag.nextSibling : null);
    }
    // the keys in the pause menu
    const keys = document.querySelector('#pause .keys');
    if (keys) {
      const li = document.createElement('li');
      li.innerHTML = '<kbd>B</kbd> กระเป๋าวัสดุ — มอนสเตอร์แต่ละชนิดดรอปวัสดุของตัวเอง นำไปขายให้<b>ลุงโกโก้</b> (แผงร้านกลางค่าย) ได้เหรียญ ใช้ซื้อยาแดง ยาฟ้า';
      keys.insertBefore(li, keys.lastElementChild);
    }
    if (!game.player.matSeen || !game.player.matSeen.size) NC.HUD.log('มอนดรอปวัสดุแล้ว! กด B ดูกระเป๋าวัสดุ · ขายให้ลุงโกโก้กลางค่าย', 'sys');
    // testing: ?shop opens the window at the start (the shop when ?pos is by the merchant, else the pouch)
  };
  const baseHudUpdate = NC.HUD.update.bind(NC.HUD);
  NC.HUD.update = function (game) {
    baseHudUpdate(game);
    const dot = $('matdot'), p = game.player;
    if (dot && p.matNew) { const on = p.matNew.size > 0; if (dot.hidden === on) dot.hidden = !on; }
    // the stall on the minimap: a coin on the map art (minimap.js builds world.mapArt the first time it draws)
    const w = game.world, art = w && w.shop && w.mapArt, coin = NC.SPR.ic_coin;
    if (art && !art.shopMarked && coin) {
      art.shopMarked = true;
      const c = art.getContext('2d'), k = art.width / w.W, s = Math.max(14, 150 * k);
      c.drawImage(coin.img, STALL.x * k - s / 2, (STALL.y - 60) * k - s / 2, s, s);
    }
  };
  addEventListener('keydown', (e) => {
    if (e.code !== 'KeyB' || e.repeat || !NC.game || !NC.game.player) return;
    const t = document.activeElement;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    const sw = document.getElementById('shopwin');
    if (nearHim(NC.game) && (!sw || sw.hidden) && NC.Lessons && NC.Lessons.talk && NC.Lessons.talk(NC.game, 'coco')) return; // (js/lessons.js: a quest waits with him)
    NC.game.paused = NC.HUD.panel('shop');
  });
  // a click on him opens the shop (instead of swinging at him)
  addEventListener('mousedown', (e) => {
    const game = NC.game;
    const sw = $('shopwin');
    if (e.button !== 0 || !game || !here(game) || e.target !== $('view') || (sw && !sw.hidden)) return;
    const wx = game.cam.x + (e.clientX * game.dpr) / game.scale, wy = game.cam.y + (e.clientY * game.dpr) / game.scale;
    if (Math.abs(wx - NPC.x) > 64 || wy < NPC.y - 175 || wy > NPC.y + 16) return;
    e.stopImmediatePropagation(); e.preventDefault();
    if (nearHim(game)) { if (!(NC.Lessons && NC.Lessons.talk && NC.Lessons.talk(game, 'coco'))) game.paused = NC.HUD.panel('shop', true); } // (js/lessons.js)
    else game.toast('เดินเข้าไปใกล้ลุงโกโก้ก่อนนะ');
  }, true);
})();
