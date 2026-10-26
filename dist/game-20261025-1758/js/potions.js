/* potions.js — red and blue potions in three sizes (the balance round of 2026-10-04; the user: "อยากให้เพิ่ม ยาแดงยาฟ้า
   ขนาดกลางและใหญ่ ราคาก็สูงตาม", "ยาแดงยาฟ้าต้องเป็นของจำเป็น").
     sizes     เล็ก / กลาง / ใหญ่ heal a fixed amount — HP 60 / 220 / 600, SP 30 / 100 / 260 — and 1% more for each point of
               VIT (red) or INT (blue), like classic MMOs' potions. One drink every 0.8 s a colour whatever the size, so a small
               potion (75 HP a second at most) can't keep a Lv 90 hero standing: the bigger ones are what a level needs
     prices    red 25 / 80 / 190, blue 15 / 45 / 110 coins: at the level each size is for, about 20–30% of what the junk of
               a level-fitting map sells for (the calculation, tools/balance_round: farm runs of 90 builds x maps)
     keys 1/2  the size that fits: HP under 30%, the smallest that heals half of what is missing (else the biggest);
               otherwise the biggest that wastes at most a fifth of itself, else the smallest. The ESC menu's settings can
               pin a size instead (อัตโนมัติ / เล็ก / กลาง / ใหญ่: another size when that one runs out)
     drops     no longer a potion every 5th kill: a monster 3% red, 1.5% blue, sized by its level (small under Lv 35, medium
               to 69, large from 70); a boss and a chest their level's size
   The small ones stay p.potions / p.spPotions (the old saves, quests, bots); the bigger ones are p.potionsM, potionsL,
   spPotionsM, spPotionsL, kept under their own key (nightcamp.pots.v1) with the size picks. NC.POT: DEF, LIST, heal(p, D),
   pick(p, color), count(p, color), add(p, color, size, n), sizeFor(lv), drink(game, p, color, size?).
   Hooks: NC.drinkPotion (entities.js keys 1 / 2), NC.saveGame / loadGear, NC.HUD.update (the hotbar's flask and count),
   NC.MENU_SETTINGS. Shops, the bag, the auto farm, drops and rewards read NC.POT. Load right after items.js. */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX;
  const KEY = 'nightcamp.pots.v1';

  const MAN = { ic_potion_m: 'assets/ic_potion_m.png', ic_potion_l: 'assets/ic_potion_l.png', ic_sppotion_m: 'assets/ic_sppotion_m.png', ic_sppotion_l: 'assets/ic_sppotion_l.png' };
  if (NC.ASSET_MANIFEST) for (const k in MAN) NC.ASSET_MANIFEST[k] = { src: MAN[k], w: 96, h: 96, ax: 0.5, ay: 0.5 };

  // ---------------- the six potions (ids: the small ones keep the old 'red' / 'blue', saved shop lists stay good) ----------------
  const SIZE_TH = { s: 'เล็ก', m: 'กลาง', l: 'ใหญ่' };
  const D = (id, color, size, key, amt, price, icon) => ({ id, color, size, key, amt, price, icon, stat: color === 'red' ? 'hp' : 'sp',
    name: (color === 'red' ? 'ยาแดง' : 'ยาฟ้า') + SIZE_TH[size] });
  const DEF = { red: D('red', 'red', 's', 'potions', 60, 25, 'ic_potion'), red_m: D('red_m', 'red', 'm', 'potionsM', 220, 80, 'ic_potion_m'),
      red_l: D('red_l', 'red', 'l', 'potionsL', 600, 190, 'ic_potion_l'), blue: D('blue', 'blue', 's', 'spPotions', 30, 15, 'ic_sppotion'),
      blue_m: D('blue_m', 'blue', 'm', 'spPotionsM', 100, 45, 'ic_sppotion_m'), blue_l: D('blue_l', 'blue', 'l', 'spPotionsL', 260, 110, 'ic_sppotion_l') };
  const LIST = Object.values(DEF);
  const SIZES = { red: LIST.filter((q) => q.color === 'red'), blue: LIST.filter((q) => q.color === 'blue') };
  for (const q of LIST) q.what = `ฟื้น ${q.stat.toUpperCase()} ${q.amt} (+1% ต่อ ${q.color === 'red' ? 'VIT' : 'INT'}) · ปุ่ม ${q.color === 'red' ? 1 : 2}`;

  // how much one drink gives this hero
  const statOf = (p, k) => (p.d && p.d[k]) || (p.base && p.base[k]) || 0;
  function heal(p, q) {
    return Math.round(q.amt * (1 + statOf(p, q.stat === 'hp' ? 'vit' : 'int') / 100));
  }
  const count = (p, color) => SIZES[color].reduce((s, q) => s + (p[q.key] || 0), 0);
  // the size a level needs (drops, rewards): small under Lv 35, medium to 69, large from 70
  const sizeFor = (lv) => ((lv || 1) < 35 ? 's' : (lv || 1) < 70 ? 'm' : 'l');
  const defOf = (color, size) => SIZES[color].find((q) => q.size === size) || SIZES[color][0];
  function add(p, color, size, n) {
    const q = defOf(color, size);
    p[q.key] = (p[q.key] || 0) + (n === undefined ? 1 : n);
    return q;
  }

  // ---------------- the picks (ESC → ตั้งค่า) and the saved bigger sizes ----------------
  const st = { pref: { red: 'auto', blue: 'auto' } };
  function pick(p, color, force) {
    const have = SIZES[color].filter((q) => (p[q.key] || 0) > 0);
    if (!have.length) return null;
    const want = force || st.pref[color];
    if (want && want !== 'auto') { const q = have.find((x) => x.size === want); if (q) return q; }
    // HP in danger (under 30%): the smallest that heals at least half of what is missing, else the biggest there is;
    // otherwise (and SP always) the biggest that wastes at most a fifth of itself, else the smallest
    const miss = q0(p, color);
    if (color === 'red' && p.hp < p.maxHp * 0.3) return have.find((q) => heal(p, q) >= miss * 0.5) || have[have.length - 1];
    let best = null;
    for (const q of have) if (heal(p, q) <= miss * 1.25 && (!best || q.amt > best.amt)) best = q;
    return best || have[0];
  }
  const q0 = (p, color) => (color === 'red' ? p.maxHp - p.hp : p.maxSp - p.sp);

  // a drink (keys 1 / 2, the bag, the auto farm): false when nothing happens
  function drink(game, p, color, size) {
    const cd = color === 'red' ? 'pot' : 'sppot', stat = color === 'red' ? 'hp' : 'sp', max = color === 'red' ? p.maxHp : p.maxSp;
    if (!p || p.dead > 0 || (p.cd && p.cd[cd] > 0) || p[stat] >= max) return false;
    const q = pick(p, color, size);
    if (!q) return false;
    const got = Math.round(Math.min(heal(p, q), max - p[stat]));
    p[stat] += got; p[q.key]--;
    if (p.cd) p.cd[cd] = 0.8;
    FX.num(p.x, p.y - 150, '+' + got, { fill: stat === 'hp' ? '#8dff8a' : '#8fc8ff', size: q.size === 'l' ? 48 : q.size === 'm' ? 45 : 42 });
    FX.stars(p.x, p.y - 60, q.size === 'l' ? 14 : 8, stat === 'hp' ? '255,120,140' : '120,180,255', { speed: 140, size: 0.7 });
    return q;
  }
  NC.drinkPotion = (game, p, color) => !!drink(game, p, color);

  NC.POT = { OLD: false, DEF, LIST, SIZES, SIZE_TH, heal, count, sizeFor, defOf, add, pick, drink, st };

  // ---------------- saving: the bigger sizes and the picks ----------------
  const baseSave = NC.saveGame;
  NC.saveGame = function (game) {
    baseSave.apply(this, arguments);
    if (!game || game.noSave) return;
    const p = game.player;
    try { localStorage.setItem(KEY, JSON.stringify({ n: [p.potionsM | 0, p.potionsL | 0, p.spPotionsM | 0, p.spPotionsL | 0], pref: st.pref })); } catch (e) { /* storage blocked */ }
  };
  const baseLoad = NC.loadGear;
  NC.loadGear = function (game, prm) {
    const r = baseLoad.apply(this, arguments);
    const p = game.player;
    p.potionsM = p.potionsL = p.spPotionsM = p.spPotionsL = 0;
    let s = null;
    try { s = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { s = null; }
    if (s && !NC.ONLINE) {
      const n = Array.isArray(s.n) ? s.n : [];
      [p.potionsM, p.potionsL, p.spPotionsM, p.spPotionsL] = [0, 1, 2, 3].map((i) => Math.max(0, Math.floor(Number(n[i]) || 0)));
      if (s.pref) for (const c of ['red', 'blue']) if (['auto', 's', 'm', 'l'].includes(s.pref[c])) st.pref[c] = s.pref[c];
    }
    return r;
  };

  // ---------------- the hotbar's two flasks: the size the key would drink now, and how many of it ----------------
  const $ = (id) => document.getElementById(id);
  const iconSrc = (q) => (NC.ASSET_MANIFEST[q.icon] || {}).src || 'assets/' + q.icon + '.png';
  const shown = { red: '', blue: '' };
  function hudSlot(p, color, id) {
    const el = $(id);
    if (!el) return;
    const q = pick(p, color) || defOf(color, st.pref[color] !== 'auto' ? st.pref[color] : 's');
    const n = p[q.key] || 0, slot = el.parentNode, img = slot && slot.querySelector('img');
    const sig = q.id + ':' + n + ':' + count(p, color);
    if (shown[color] === sig) return;
    shown[color] = sig;
    el.textContent = String(n);
    if (img && img.getAttribute('src') !== iconSrc(q)) img.setAttribute('src', iconSrc(q));
    if (slot) {
      slot.title = SIZES[color].map((x) => `${x.name} ${p[x.key] || 0}`).join(' · ');
      slot.classList.toggle('pot-m', q.size === 'm'); slot.classList.toggle('pot-l', q.size === 'l');
    }
  }
  const baseHud = NC.HUD.update;
  NC.HUD.update = function (game) {
    const r = baseHud.apply(this, arguments);
    const p = game && game.player;
    if (p) { hudSlot(p, 'red', 'potions'); hudSlot(p, 'blue', 'sppotions'); }
    return r;
  };

  // ---------------- the settings: which size keys 1 / 2 drink ----------------
  const rows = (NC.MENU_SETTINGS = NC.MENU_SETTINGS || []);
  const opts = [['auto', 'อัตโนมัติ'], ['s', 'เล็ก'], ['m', 'กลาง'], ['l', 'ใหญ่']];
  for (const c of ['red', 'blue']) rows.push({
    name: c === 'red' ? 'ยาแดง (ปุ่ม 1)' : 'ยาฟ้า (ปุ่ม 2)',
    note: 'อัตโนมัติ = ขวดที่พอดีกับที่ขาด (หมดแล้วใช้ขนาดอื่น)',
    opts, get: () => st.pref[c], set: (v) => { st.pref[c] = v; shown[c] = ''; if (NC.game) NC.saveGame(NC.game); },
  });
})();
