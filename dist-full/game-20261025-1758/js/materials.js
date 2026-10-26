/* materials.js — what monsters leave behind: every species drops a material of its own (the leaf slime its jelly, the
   boar a tusk, the golem its crystal core, the Mushroom King his spores and, rarely, his crown). They fall to the ground
   like potions, fly to the hero when he walks by and go into the material pouch; the merchant in the camp (js/shop.js)
   buys them for coins, and sells potions for coins.
   Data: NC.MATERIALS (name, price, text), NC.MAT_DROPS (species -> [material, chance, min, max]); the pouch lives on
   the hero (p.mats: id -> count, p.coins, p.matSeen: ever found, p.matNew: found since the pouch was last opened) and
   is saved under its own key.
   It plugs in from the outside like boss.js / monsters.js: wraps NC.damageEnemy (the drop), NC.updateLoot /
   NC.drawLoot (materials on the ground), NC.saveGame / NC.loadGear (saving), NC.HUD.init / update (the coin counter).
   Art: assets/shop/ + assets/shop.manifest.js (tools/shop_art.py). Load after party.js (its bots' kills drop nothing).
   Testing: ?mats (10 of every material) and ?coins=5000 (both never saved). */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX;
  const $ = (id) => document.getElementById(id);

  // ---------------- the materials (price: coins each, what the merchant pays) ----------------
  const MAT = (NC.MATERIALS = {
    mat_leaf_jelly: { name: 'เจลใบไม้', price: 6, desc: 'เจลนุ่มหนึบสีเขียวสด มีต้นอ่อนสองใบงอกอยู่ด้านบน' },
    mat_bat_wing: { name: 'ปีกค้างคาว', price: 12, desc: 'ปีกหนังบาง ๆ ของค้างคาวรัตติกาล' },
    mat_boar_tusk: { name: 'เขี้ยวหมูป่า', price: 14, desc: 'เขี้ยวงาโค้งแข็งแรง ยังมีขนแข็ง ๆ ติดอยู่ที่โคน' },
    mat_water_jelly: { name: 'หยดเจลน้ำใส', price: 18, desc: 'เจลใสเย็นฉ่ำ มีฟองอากาศกับใบบัวจิ๋วลอยอยู่' },
    mat_bee_stinger: { name: 'เหล็กในผึ้งยักษ์', price: 24, desc: 'แหลมคมมาก หยิบระวังนิ้วด้วยนะ' },
    mat_cursed_straw: { name: 'ฟางต้องสาป', price: 28, desc: 'ฟางมัดด้วยผ้าปะ ยังเรืองแสงสีส้มจาง ๆ อยู่เลย' },
    mat_moss_shell: { name: 'เปลือกหินตะไคร่', price: 36, desc: 'เปลือกหินแตก ๆ ที่สไลม์หินใส่เป็นหมวก' },
    mat_mush_cap: { name: 'หมวกเห็ดพราย', price: 40, desc: 'หมวกเห็ดสีม่วงของลูกเห็ดพราย ลูกน้องราชาเห็ด' },
    mat_glow_jelly: { name: 'เจลเรืองแสง', price: 44, desc: 'เจลสีฟ้าอมเขียวในขวดโหล เรืองแสงได้ทั้งคืน' },
    mat_old_bone: { name: 'กระดูกเก่า', price: 50, desc: 'มีผ้าพันคอสีแดงของทหารโครงกระดูกผูกติดอยู่' },
    mat_moth_scale: { name: 'เกล็ดปีกเรืองแสง', price: 56, desc: 'ชิ้นปีกผีเสื้อราตรี ลายวงตาเรืองแสงสีฟ้า' },
    mat_wolf_fur: { name: 'ขนหมาป่าเงาจันทร์', price: 60, desc: 'ขนนุ่มสีเทาอมฟ้า เป็นประกายเหมือนแสงจันทร์' },
    mat_ghost_bark: { name: 'เปลือกไม้ผี', price: 62, desc: 'เปลือกไม้คลุมมอส มีปุ่มไม้เรืองแสงเหมือนตากำลังง่วง' },
    mat_honeycomb: { name: 'รวงผึ้งน้ำผึ้ง', price: 70, desc: 'รวงผึ้งสีทอง น้ำผึ้งเยิ้มหวานหอม' },
    mat_lava_rock: { name: 'หินลาวาคุกรุ่น', price: 95, desc: 'หินภูเขาไฟที่ข้างในยังร้อนระอุ' },
    mat_scorpion_sting: { name: 'เหล็กในแมงป่อง', price: 120, desc: 'ปลายหางแมงป่องแดง เหล็กในเป็นผลึกเรืองแสง' },
    mat_golem_core: { name: 'ผลึกแกนโกเลม', price: 150, desc: 'ผลึกสีส้มอุ่น ๆ หัวใจของโกเลมหินแดง' },
    mat_king_spore: { name: 'สปอร์ราชาเห็ด', price: 400, desc: 'สปอร์เรืองแสงสีฟ้าจากตัวราชาเห็ดเรืองแสง' },
    mat_king_crown: { name: 'มงกุฎราชาเห็ด', price: 3000, rare: true, desc: 'มงกุฎทองของราชาเห็ดเรืองแสง หายากมาก!' },
  });
  // who drops what: [material, chance, min, max] (one roll each; a single piece now and then comes as two)
  const DROPS = (NC.MAT_DROPS = {
    slime_green: [['mat_leaf_jelly', 0.65]], slime_blue: [['mat_water_jelly', 0.65]], slime_stone: [['mat_moss_shell', 0.6]],
    slime_honey: [['mat_honeycomb', 0.6]], slime_glow: [['mat_glow_jelly', 0.6]], slime_lava: [['mat_lava_rock', 0.6]],
    bat: [['mat_bat_wing', 0.6]], bee: [['mat_bee_stinger', 0.6]], moth: [['mat_moth_scale', 0.55]],
    boar: [['mat_boar_tusk', 0.6]], wolf: [['mat_wolf_fur', 0.55]], scorpion: [['mat_scorpion_sting', 0.55]],
    skeleton: [['mat_old_bone', 0.6]], scarecrow: [['mat_cursed_straw', 0.6]], stump: [['mat_ghost_bark', 0.55]],
    golem: [['mat_golem_core', 0.5]],
    mushling: [['mat_mush_cap', 0.4]],
    mushking: [['mat_king_spore', 1, 3, 5], ['mat_king_crown', 0.25]],
    slime: [['mat_leaf_jelly', 0.65]], hollow: [['mat_old_bone', 0.6]], // the old kinds, if a map still makes them
  });
  const TWICE = 0.15; // a single-piece drop that comes as two
  // which monster drops a material (the pouch tells where to hunt): the first species that has it
  NC.matSource = function (id) {
    for (const sp in DROPS) if (sp !== 'slime' && sp !== 'hollow' && DROPS[sp].some((d) => d[0] === id)) return (NC.MONSTERS[sp] || {}).name || sp;
    return '';
  };
  NC.matIcon = (id) => ((NC.ASSET_MANIFEST_SHOP || {})[id] || {}).src || '';
  NC.fmtCoins = (n) => Math.floor(n).toLocaleString('en-US');

  // ---------------- the pouch ----------------
  const KEY = 'nightcamp.trade.v1', MAX = 9999;
  function blank(p) { p.coins = 0; p.mats = {}; p.matSeen = new Set(); p.matNew = new Set(); }
  NC.matCount = (p, id) => (p.mats && p.mats[id]) || 0;
  NC.addMat = function (game, id, n) {
    const p = game.player;
    if (!MAT[id] || !p.mats) return;
    p.mats[id] = Math.min(MAX, NC.matCount(p, id) + n);
    if (!p.matSeen.has(id)) { p.matSeen.add(id); p.matNew.add(id); }
  };
  NC.saveTrade = function (game) {
    const p = game.player;
    if (game.noSave || !p || !p.mats) return;
    try { localStorage.setItem(KEY, JSON.stringify({ coins: p.coins, mats: p.mats, seen: [...p.matSeen], fresh: [...p.matNew] })); }
    catch (e) { /* storage blocked */ }
  };
  const baseSave = NC.saveGame;
  NC.saveGame = function (game) { baseSave(game); NC.saveTrade(game); };
  const baseLoad = NC.loadGear;
  NC.loadGear = function (game, params) {
    baseLoad(game, params);
    const p = game.player;
    blank(p);
    let s = null;
    if (!NC.ONLINE) { try { s = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { s = null; } }
    if (s) {
      if (Number.isFinite(s.coins)) p.coins = Math.max(0, Math.floor(s.coins));
      for (const id in s.mats || {}) if (MAT[id] && s.mats[id] > 0) p.mats[id] = Math.min(MAX, Math.floor(s.mats[id]));
      for (const id of s.seen || []) if (MAT[id]) p.matSeen.add(id);
      for (const id of s.fresh || []) if (MAT[id]) p.matNew.add(id);
    }
  };

  // ---------------- dropping ----------------
  function drop(game, e) {
    const list = DROPS[e.type];
    if (!list || e.lootless) return; // (monkinds.js's split pieces / called helpers)
    const pk = NC.dropChanceK ? NC.dropChanceK(game, e) : 1; // (a party's threads: js/partybonds.js)
    for (const [id, chance, lo, hi] of list) {
      if (!MAT[id] || Math.random() >= chance * pk) continue;
      let n0 = lo ? Math.round(NC.rand(lo, hi)) : Math.random() < TWICE ? 2 : 1;
      if (chance * pk > 1) { const x = n0 * chance * pk; n0 = Math.floor(x) + (Math.random() < x % 1 ? 1 : 0); } // (past a sure drop: more pieces)
      const n = NC.matQty ? NC.matQty(e, n0, id) : n0; // (more pieces from a species seen above its junk's level: js/balance_round.js)
      for (let i = 0; i < n; i++) {
        const spread = lo ? 90 : 36;
        game.loot.push({ kind: 'loot', mat: id, x: e.x + NC.rand(-spread, spread), y: e.y + NC.rand(-spread * 0.35, spread * 0.35), sort: e.y, t: 0,
          z: e.z || 0, vz: NC.rand(380, 520), spin: NC.rand(0, 6) });
      }
      if (MAT[id].rare) { FX.stars(e.x, e.y - 60, 16, '255,220,120', { speed: 280 }); FX.ring(e.x, e.y, 20, 180, '255,220,120', 0.6, 9); }
    }
  }
  const baseDamage = NC.damageEnemy;
  NC.damageEnemy = function (game, e, r, kx, ky, o) {
    const was = e.hp;
    baseDamage(game, e, r, kx, ky, o);
    if (was > 0 && e.hp <= 0) drop(game, e);
  };

  // ---------------- on the ground: bounce, then fly to the hero ----------------
  function pick(game, l) {
    const p = game.player, M = MAT[l.mat];
    NC.addMat(game, l.mat, 1);
    if (NC.Lessons) NC.Lessons.ev('loot');
    FX.stars(p.x, p.y - 70, M.rare ? 16 : 6, M.rare ? '255,220,120' : '255,236,170', { speed: M.rare ? 260 : 170, size: 0.7 });
    if (M.rare) { FX.ring(p.x, p.y, 20, 160, '255,220,120', 0.55, 8); game.toast(`ได้รับ ${M.name}!!`); }
    NC.HUD.log(`ได้รับ ${M.name} ×1`, 'item');
    NC.saveTrade(game);
  }
  const baseUpdateLoot = NC.updateLoot;
  NC.updateLoot = function (game, dt) {
    const mats = game.loot.filter((l) => l.mat);
    if (!mats.length) return baseUpdateLoot(game, dt);
    game.loot = game.loot.filter((l) => !l.mat);
    baseUpdateLoot(game, dt);
    const p = game.player;
    for (const l of mats) {
      l.t += dt;
      if (l.vz || l.z > 0) {
        l.vz -= 1600 * dt;
        l.z += l.vz * dt;
        if (l.z <= 0) { l.z = 0; l.vz = l.vz < -200 ? -l.vz * 0.35 : 0; }
      }
      if (p.dead > 0 || l.t < 0.7) continue;
      const d = NC.dist(l.x, l.y, p.x, p.y);
      if (d < 150) { const k = Math.min(1, dt * 8); l.x += (p.x - l.x) * k; l.y += (p.y - l.y) * k; l.sort = l.y; }
      if (d < 44) { l.done = true; pick(game, l); }
    }
    game.loot = game.loot.concat(mats.filter((l) => !l.done));
  };
  const baseDrawLoot = NC.drawLoot;
  NC.drawLoot = function (ctx, game, l) {
    if (!l.mat) return baseDrawLoot(ctx, game, l);
    const s = NC.SPR[l.mat], M = MAT[l.mat];
    if (!s) return;
    const t = game.time, bob = l.z > 0 ? 0 : Math.sin(t * 3.4 + l.x * 0.02) * 4, S = M.rare ? 62 : 52;
    if (M.rare || M.price >= 100) { // valuable ones glow a little
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(l.x, l.y - 30 - l.z, 4, l.x, l.y - 30 - l.z, S);
      g.addColorStop(0, `rgba(255,220,130,${M.rare ? 0.55 : 0.28})`); g.addColorStop(1, 'rgba(255,220,130,0)');
      ctx.fillStyle = g; ctx.fillRect(l.x - S, l.y - 30 - l.z - S, S * 2, S * 2);
      ctx.restore();
    }
    ctx.drawImage(s.img, l.x - S / 2, l.y - S - 6 - l.z + bob, S, S);
  };

  // ---------------- the coin counter (above the menu buttons) ----------------
  let shown = null;
  const baseInit = NC.HUD.init.bind(NC.HUD);
  NC.HUD.init = function (game) {
    baseInit(game);
    const box = document.createElement('div');
    box.className = 'coins'; box.id = 'coins'; box.title = 'เหรียญ: ขายวัสดุให้ลุงโกโก้ในค่ายกลางป่า';
    box.innerHTML = `<img src="${NC.matIcon('ic_coin')}" alt=""><b id="coinsn">0</b>`;
    $('hud').appendChild(box);
  };
  const baseUpdate = NC.HUD.update.bind(NC.HUD);
  NC.HUD.update = function (game) {
    baseUpdate(game);
    const p = game.player, el = $('coinsn');
    if (!el || !p || p.coins === undefined) return;
    if (shown !== p.coins) {
      const gain = shown !== null && p.coins > shown ? p.coins - shown : 0;
      shown = p.coins; el.textContent = NC.fmtCoins(p.coins);
      if (gain) {
        const box = $('coins'), pop = document.createElement('span');
        pop.className = 'coins-pop'; pop.textContent = '+' + NC.fmtCoins(gain);
        box.appendChild(pop); setTimeout(() => pop.remove(), 1300);
        box.classList.remove('bump'); void box.offsetWidth; box.classList.add('bump');
      }
    }
  };
})();
