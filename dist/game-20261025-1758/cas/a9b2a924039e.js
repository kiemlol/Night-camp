/* refine.js — ตีบวก +1..+10 at ป๋าหมูหริ่ง (the Game Bible, pillar 3: the main coin sink; the rules the user approved
   2026-09-28: safe up to +7 / +6 / +5 / +4 by grade, table A above it, a failure never breaks the piece, from +8 a failure
   drops it one level, the เตาร้อน meter: each failure makes that step x1.5 more likely until it lands).
     cost     coins = the grade's price x (level)^1.6 (+1 of a grade-4 piece 30,000, +10 of it 1,194,322; the grade prices
              x6 / x6 / x4 / x3 in the 2026-10-02 balance pass, js/rebalance.js: the bot earns ~6x what the Game Bible
              counted, so +10 of a grade-4 piece averages ~24M coins, ~100 farming hours at Lv 90) and ores from the
              mines by grade (แร่เหล็ก · แร่เงิน · สายเงินจันทร์ · แร่ดาวตก), 1 + level/3 of them
     what     a weapon: ATK +4% a level (+10: +40%); armour, hats, accessories: DEF +1 every two levels and HP +0.5% a level
     looks    the weapon in hand shines: +5 a glint, +7 blue, +8 violet, +9 orange-gold, +10 a rainbow and a ring of light
              (the mock the user liked); a moonlit copy ✦ has a silver-moon sheen
   2026-10-12 (the user chose "2"): from +9 a failure may also BREAK the piece (+9: 25%, +10: 40% of the failures; the
   rest drop it one level), unless a หินกันแตก is on (js/gradetier.js: it is used only when it saves the piece, and then
   nothing is lost but the stone). A worn piece is not refined at that risk without the stone (take it off first).
   Where: the bag's item card (I) near the forge; the forge's own window lists nothing new. Each copy keeps its level
   (js/gearbag.js `ref`) and its meter (`heat`). Hooks: NC.invCardExtras / invActs, NC.skillModSources, NC.gearStats,
   NC.drawPlayer. NC.Refine.sim(4) gives the average cost to +10. */
(function () {
  'use strict';
  const NC = window.NC, ITEMS = NC.ITEMS, FX = NC.FX, V = NC.VFX;
  const fmt = (n) => NC.fmtCoins(n);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const G = NC.GEAR;
  if (!G) return;

  const SAFE = { 1: 7, 2: 6, 3: 5, 4: 4 };
  const TAB = { 1: { 8: 70, 9: 50, 10: 30 }, 2: { 7: 70, 8: 55, 9: 40, 10: 25 }, 3: { 6: 75, 7: 60, 8: 45, 9: 30, 10: 20 },
    4: { 5: 75, 6: 65, 7: 50, 8: 35, 9: 25, 10: 15 } };
  const BASE = { 1: 1800, 2: 7200, 3: 16000, 4: 30000 }; // (was 300 / 1200 / 4000 / 10000 before the 2026-10-02 pass)
  const ORE = { 1: 'lf_iron', 2: 'lf_silver', 3: 'lf_moonsilver', 4: 'lf_starore' };
  const cost = (g, n) => Math.round(BASE[g] * Math.pow(n, 1.6) * (NC.refineDiscount ? NC.refineDiscount() : 1));
  const oreN = (n) => 1 + Math.floor(n / 3);
  const rateOf = (g, n) => (n <= SAFE[g] ? 100 : TAB[g][n]);
  const chanceOf = (c, g, n) => Math.min(100, rateOf(g, n) * ((c.heat && c.heat[n]) || 1));

  // ---------------- what a level gives ----------------
  const worn = (p) => {
    const out = [];
    for (const k in p.equip) { const c = G.wornIn(p, k); if (c && c.ref) out.push([k, c]); }
    return out;
  };
  NC.skillModSources.push((p) => {
    if (!p || p.kind !== 'player') return null;
    let m = null;
    for (const [k, c] of worn(p)) {
      m = m || {};
      if (k === 'weapon') m.atk = (m.atk || 0) + 4 * c.ref;
      else m.hpPct = (m.hpPct || 0) + 0.5 * c.ref;
    }
    return m;
  });
  const baseGear = NC.gearStats;
  NC.gearStats = function (equip) {
    const st = baseGear.apply(this, arguments), p = NC.game && NC.game.player;
    if (!p || equip !== p.equip) return st;
    for (const [k, c] of worn(p)) if (k !== 'weapon') {
      const it = ITEMS[c.id], mg = it.of && it.of.line === 'mg';
      st[mg ? 'mdef' : 'def'] = (st[mg ? 'mdef' : 'def'] || 0) + Math.floor(c.ref / 2);
    }
    return st;
  };

  // ---------------- the forge is near ----------------
  const nearForge = (game) => { const f = game.world && game.world.forge, p = game.player; return !!(f && p.dead <= 0 && NC.dist(p.x, p.y, f.x, f.y) < 320); };
  let pickU = 0, armed = 0, last = null, safe = true;
  NC.refineSafe = { get: () => safe, set: (v) => { safe = !!v; } }; // (the safety stone's switch: also in the forge's ขัดเกรด tab, js/gradetier.js)
  const BREAK = { 9: 25, 10: 40 }; // (% of the failures that break the piece; the safety stone stops it)
  const wornKey = (p, c) => Object.keys(p.equip).find((k) => G.wornIn(p, k) === c) || null;

  NC.invCardExtras.push((p, id, one) => { // (one: the bag cell's own piece)
    if (!G.isInst(id)) return '';
    const list = one ? [one] : G.copies(p, id);
    if (!list.length) return '';
    const c = list.find((x) => x.u === pickU) || list.find((x) => Object.values(p.equip).includes(x.id) && G.wornIn(p, Object.keys(p.equip).find((k) => p.equip[k] === x.id)) === x) || list[0];
    pickU = c.u;
    if (NC.RefineWin) return NC.RefineWin.mini(p, c); // (2026-10-17: the refine page of js/refinewin.js does the work; the card leads there)
    const it = ITEMS[c.id], g = G.gradeOf(it), n = (c.ref || 0) + 1;
    let h = `<div class="rf-box"><div class="h">ตีบวก <b>${esc(NC.copyName(c))}</b></div>`;
    if (list.length > 1) h += `<div class="rf-pick">${list.map((x) => `<button data-act="rf:pick:${x.u}" class="${x.u === c.u ? 'on' : ''}">${x.sh ? '✦' : ''}+${x.ref || 0}</button>`).join('')}</div>`;
    if (c.ref >= 10) return h + '<div class="rf-line max">+10 แล้ว สูงสุด</div></div>';
    const ch = chanceOf(c, g, n), ore = ORE[g], M = NC.MATERIALS[ore] || { name: ore }, have = NC.matCount(p, ore), coins = cost(g, n);
    const ok = (p.coins || 0) >= coins && have >= oreN(n);
    const risk = n <= SAFE[g] ? 'ปลอดภัย ไม่มีทางพลาด' : n >= 9 ? `พลาดแล้วลดลง 1 ขั้น หรือของแตก (${BREAK[n]}% ของครั้งที่พลาด)` : 'พลาดแล้วอยู่ขั้นเดิม (ของไม่พัง)';
    const stones = NC.matCount(p, 'mat_safety'), guard = n >= 9 && n > SAFE[g], useSafe = guard && safe && stones > 0, wornBlock = guard && !useSafe && !!wornKey(p, c);
    h += `<div class="rf-line">+${c.ref || 0} → <b>+${n}</b> · โอกาส <b class="${ch >= 100 ? 'ok' : ''}">${Math.round(ch)}%</b>${c.heat && c.heat[n] > 1 ? ' <span class="heat">เตาร้อน ×' + c.heat[n].toFixed(2) + '</span>' : ''}</div>` +
      `<div class="rf-line dim">${risk}</div>` +
      `<div class="rf-line ${(p.coins || 0) >= coins ? 'ok' : 'bad'}">${fmt(coins)} เหรียญ</div>` +
      `<div class="rf-line ${have >= oreN(n) ? 'ok' : 'bad'}">${esc(M.name)} ×${oreN(n)} <small>(มี ${have})</small></div>` +
      (guard ? `<button class="iv-btn ${useSafe ? 'blue' : 'grey'} rf-safe" data-act="rf:safe:0"><img src="${NC.matIcon('mat_safety')}" alt="">หินกันแตก ×${stones} · ${useSafe ? 'ใช้' : stones ? 'ไม่ใช้' : 'ไม่มี'}</button>` : '') +
      (wornBlock ? '<div class="rf-line bad">ของที่สวมอยู่อาจแตก ถอดหรือเปลี่ยนไปใส่ชิ้นอื่นก่อน หรือใช้หินกันแตก</div>' : '') +
      (nearForge(NC.game) ? `<button class="iv-btn gold rf-go" data-act="rf:go:${c.u}" ${ok && !wornBlock ? '' : 'disabled'}>${armed === c.u && n > SAFE[g] ? 'กดอีกครั้งเพื่อตี' : 'ตีบวก +' + n}</button>`
        : '<div class="rf-line dim">ตีบวกได้ที่เตาของป๋าหมูหริ่ง ข้างร้านลุงโกโก้</div>') +
      (last && last.u === c.u ? `<div class="rf-res ${last.ok ? 'ok' : 'bad'}">${esc(last.text)}</div>` : '') + '</div>';
    return h;
  });

  NC.invActs.push((game, a) => {
    const m = /^rf:(pick|go|safe):(\d+)$/.exec(a || '');
    if (!m) return false;
    if (m[1] === 'safe') { safe = !safe; return true; }
    const p = game.player, c = G.bag(p).find((x) => x.u === Number(m[2]));
    if (!c) return true;
    if (m[1] === 'pick') { pickU = c.u; armed = 0; return true; }
    if (!nearForge(game)) { game.toast('ตีบวกได้ที่เตาของป๋าหมูหริ่ง'); return true; }
    const it = ITEMS[c.id], g = G.gradeOf(it), n = (c.ref || 0) + 1;
    if (n > 10) return true;
    const guard = n >= 9 && n > SAFE[g], useSafe = guard && safe && NC.matCount(p, 'mat_safety') > 0;
    if (guard && !useSafe && wornKey(p, c)) { game.toast('ของที่สวมอยู่อาจแตก ถอดหรือเปลี่ยนชิ้นก่อน'); return true; }
    if (n > SAFE[g] && armed !== c.u) { armed = c.u; setTimeout(() => { if (armed === c.u) armed = 0; }, 3000); return true; }
    armed = 0;
    const coins = cost(g, n), ore = ORE[g];
    if ((p.coins || 0) < coins || NC.matCount(p, ore) < oreN(n)) return true;
    p.coins -= coins;
    p.mats[ore] -= oreN(n); if (p.mats[ore] <= 0) delete p.mats[ore];
    if (NC.Econ) NC.Econ.sink('refine', coins);
    const ch = chanceOf(c, g, n), win = Math.random() * 100 < ch;
    c.heat = c.heat || {};
    if (win) {
      c.ref = n; delete c.heat[n];
      last = { u: c.u, ok: true, text: `สำเร็จ! ${NC.copyName(c)}` };
      NC.HUD.log(`ตีบวกสำเร็จ! ${NC.copyName(c)}`, 'level');
      burst(game, n, true);
      if (n >= 9 && NC.Loot) NC.Loot.news(game, `${p.name || 'นักเดินทาง'} ตีบวก ${it.name} ได้ +${n}!`);
    } else {
      c.heat[n] = Math.min(20, ((c.heat[n]) || 1) * 1.5);
      if (useSafe) { // (the safety stone takes the blow: nothing lost but the stone)
        p.mats.mat_safety -= 1; if (p.mats.mat_safety <= 0) delete p.mats.mat_safety;
        last = { u: c.u, ok: false, text: `ไม่สำเร็จ · หินกันแตกช่วยไว้ ยังเป็น +${c.ref || 0}` };
        NC.HUD.log(`ตีบวกไม่สำเร็จ ${NC.copyName(c)} · หินกันแตกช่วยไว้`, 'warn');
        burst(game, n, false); G.changed(game, c); if (NC.saveTrade) NC.saveTrade(game);
        return true;
      }
      if (guard && Math.random() * 100 < BREAK[n]) { // (it breaks)
        const name = NC.copyName(c);
        G.remove(game, c);
        last = { u: c.u, ok: false, text: `ของแตก! ${name} หายไปแล้ว` };
        NC.HUD.log(`ตีบวกพลาด ${name} แตกหายไป`, 'warn');
        game.toast(`${name} แตก!`);
        burst(game, n, false); pickU = 0;
        return true;
      }
      const drop = n >= 9;
      if (drop) c.ref = Math.max(0, (c.ref || 0) - 1);
      last = { u: c.u, ok: false, text: `ไม่สำเร็จ${drop ? ' ลดลงเหลือ +' + c.ref : ''} · เตาร้อนขึ้น (+${n} โอกาส ${Math.round(chanceOf(c, g, n))}%)` };
      NC.HUD.log(`ตีบวกไม่สำเร็จ ${NC.copyName(c)}${drop ? ' (ลดลง 1 ขั้น)' : ''} · เตาร้อนขึ้น`, 'warn');
      burst(game, n, false);
    }
    G.changed(game, c);
    return true;
  });
  function burst(game, n, ok) {
    const f = game.world && game.world.forge, x = f ? f.x : game.player.x, y = f ? f.y - 60 : game.player.y - 60;
    if (ok) { FX.stars(x, y, 10 + n * 2, n >= 10 ? '255,240,200' : '255,215,120', { speed: 300 }); FX.ring(x, y + 40, 20, 160 + n * 10, '255,200,110', 0.6, 10); }
    else V.smoke(x, y, 6, '#5a5060', '#9a90a0', { size: 0.9, lifeK: 0.7 });
  }

  // ---------------- the shine of the weapon in hand ----------------
  const GLOW = [null, null, null, null, null, '255,250,230', '255,250,230', '120,190,255', '190,140,255', '255,190,90', 'rainbow'];
  let sparkT = 0;
  const baseDraw = NC.drawPlayer;
  NC.drawPlayer = function (ctx, game) {
    baseDraw.apply(this, arguments);
    const p = game.player;
    if (!p || p.dead > 0 || !p.pose) return;
    const c = G.wornIn(p, 'weapon');
    if (!c || (!c.sh && (c.ref || 0) < 5)) return;
    const L = NC.weaponLine && NC.weaponLine(p.equip, p.pose, p.x, p.y);
    if (!L) return;
    const t = game.time, mx = (L.base[0] + L.tip[0]) / 2, my = (L.base[1] + L.tip[1]) / 2, len = Math.hypot(L.tip[0] - L.base[0], L.tip[1] - L.base[1]);
    let rgb = GLOW[c.ref || 0];
    if (rgb === 'rainbow') { const h = (t * 90) % 360; rgb = hsl(h); }
    ctx.save();
    if (c.sh) V.glow(ctx, mx, my, Math.max(30, len * 0.6), '200,225,255', 0.22 + 0.08 * Math.sin(t * 2), true);
    if (rgb) V.glow(ctx, mx, my, Math.max(30, len * 0.55), rgb, (c.ref >= 8 ? 0.3 : 0.18) * (0.8 + 0.2 * Math.sin(t * 4)), true);
    ctx.restore();
    if (c.ref >= 10) { // a ring of light at the feet
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(${rgb},${0.35 + 0.15 * Math.sin(t * 3)})`; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.ellipse(p.x, p.y, 70, 20, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
    if ((rgb || c.sh) && t > sparkT) {
      sparkT = t + (c.ref >= 9 ? 0.12 : 0.3);
      const u = Math.random();
      V.sparks(NC.lerp(L.base[0], L.tip[0], u), NC.lerp(L.base[1], L.tip[1], u), 1, rgb || '200,225,255', { size: 0.5, max: 80 });
    }
  };
  function hsl(h) {
    const l = 0.65, a = 0.9 * Math.min(l, 1 - l); // (hsl(h, 90%, 65%) to rgb)
    const f = (n) => { const k = (n + h / 30) % 12; return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); };
    return `${f(0)},${f(8)},${f(4)}`;
  }

  // the average cost to +10 (the design page's table)
  function sim(g, runs) {
    let tries = 0, coins = 0;
    for (let r = 0; r < (runs || 5000); r++) {
      const c = { ref: 0, heat: {} };
      while (c.ref < 10) {
        const n = c.ref + 1; tries++; coins += cost(g, n);
        if (Math.random() * 100 < chanceOf(c, g, n)) { c.ref = n; delete c.heat[n]; }
        else { c.heat[n] = (c.heat[n] || 1) * 1.5; if (n >= 9) c.ref--; }
      }
    }
    return { tries: tries / (runs || 5000), coins: Math.round(coins / (runs || 5000)) };
  }
  NC.Refine = { cost, chanceOf, SAFE, TAB, ORE, sim };
  // (2026-10-17) everything the refine page shows (js/refinewin.js), read from the same rules as the button above;
  // NC.Refine.pick(u) picks the copy the bag box and the button work on
  function info(p, c) {
    const it = ITEMS[c.id], g = G.gradeOf(it), n = (c.ref || 0) + 1;
    if ((c.ref || 0) >= 10) return { g, n: 11, max: true, safeTo: SAFE[g] };
    const ore = ORE[g], coins = cost(g, n), need = oreN(n), have = NC.matCount(p, ore), stones = NC.matCount(p, 'mat_safety');
    const guard = n >= 9 && n > SAFE[g], useSafe = guard && safe && stones > 0, worn = !!wornKey(p, c);
    return { g, n, safeTo: SAFE[g], rate: rateOf(g, n), chance: Math.round(chanceOf(c, g, n)), heat: (c.heat && c.heat[n]) || 1,
      coins, ore, need, have, stones, guard, useSafe, breakPct: guard ? BREAK[n] || 0 : 0, drops: n >= 9 && n > SAFE[g], worn,
      wornBlock: guard && !useSafe && worn, ok: (p.coins || 0) >= coins && have >= need, armed: armed === c.u };
  }
  Object.assign(NC.Refine, { info, rateOf, oreN, BREAK, last: () => last, pick: (u) => { pickU = u; armed = 0; } });

  const css = document.createElement('style');
  css.textContent = `
    .rf-box{margin-top:calc(10*var(--u));padding:calc(8*var(--u)) calc(10*var(--u));border-radius:calc(12*var(--u));background:rgba(255,200,110,.07);border:calc(2*var(--u)) solid rgba(255,200,110,.25);font:400 calc(15*var(--u))/1.5 'Mitr',sans-serif;color:#c9c2e0}
    .rf-box .h{color:#ffe7a6;font-weight:600}.rf-box .h b{color:#fff}
    .rf-line.ok,.rf-line .ok{color:#8ff08a}.rf-line.bad{color:#ff9a9a}.rf-line.dim{opacity:.7}.rf-line.max{color:#ffd873}
    .rf-line .heat{color:#ffb070}
    .rf-pick{display:flex;flex-wrap:wrap;gap:calc(4*var(--u));margin:calc(4*var(--u)) 0}
    .rf-pick button{font:600 calc(13*var(--u)) 'Mitr',sans-serif;padding:calc(1*var(--u)) calc(8*var(--u));border-radius:calc(8*var(--u));border:calc(2*var(--u)) solid rgba(255,255,255,.2);background:rgba(255,255,255,.06);color:#e9ecff;cursor:pointer}
    .rf-pick button.on{border-color:#ffd873;color:#ffd873}
    .rf-go{margin-top:calc(6*var(--u));width:100%}
    .rf-res{margin-top:calc(6*var(--u));font-weight:600}.rf-res.ok{color:#8ff08a}.rf-res.bad{color:#ffb070}`;
  document.head.appendChild(css);
})();
