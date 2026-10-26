/* brew.js — ต้มยา at Uncle Coco's (the balance round of 2026-10-04; the user: "ให้ไอเทมขยะเป็นของมีค่า"). The shop window
   (js/shopwin.js) gets a fourth tab: the potions of js/potions.js brewed from the junk monsters drop plus a few coins —
   ten at a time, for 40% of their price in coins and 10 / 20 / 30 pieces of junk (small / medium / large).
     which junk   any monster material (mat_*, not rare, not a stone, not locked in the bag), the cheapest first, so the
                  junk that sells for least goes into the pot: a Lv 90 hero's 6-coin slime jelly is worth more as potion
                  stock than at the merchant, and new players' junk finds buyers in player shops
     the sum      each batch shows what goes in (the pieces, their worth at today's price) and what it saves against buying:
                  red when selling the junk and buying would be cheaper (high-level junk, or a full bag of the good stuff)
   NC.Brew: RECIPES, plan(p, id, batches), brew(game, id, batches), html(p) (the tab's content; shopwin.js wires the clicks:
   data-brew="id:batches"). */
(function () {
  'use strict';
  const NC = window.NC, MAT = NC.MATERIALS, POT = NC.POT;
  if (!POT || POT.OLD || !MAT) return;
  const fmt = (n) => NC.fmtCoins(n);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const JUNK = { s: 10, m: 20, l: 30 }, COIN_K = 0.4, BATCH = 10;
  const RECIPES = POT.LIST.map((q) => ({ id: q.id, q, junk: JUNK[q.size], coins: Math.round(q.price * BATCH * COIN_K) }));
  const usable = (id) => /^mat_/.test(id) && MAT[id] && !MAT[id].rare && !MAT[id].keep && MAT[id].base > 0 && id !== 'mat_opt_stone' && id !== 'mat_drill_stone' &&
    !(NC.invLocked && NC.invLocked(id));

  // what a number of batches would take: the cheapest junk first
  function plan(p, id, batches) {
    const R = RECIPES.find((r) => r.id === id);
    if (!R) return null;
    let need = R.junk * batches;
    const coins = R.coins * batches, take = [];
    const pool = Object.keys(p.mats || {}).filter((m) => usable(m) && NC.matCount(p, m) > 0)
      .sort((a, b) => (MAT[a].price - MAT[b].price) || (NC.matCount(p, b) - NC.matCount(p, a)));
    let worth = 0;
    for (const m of pool) {
      if (need <= 0) break;
      const n = Math.min(need, NC.matCount(p, m));
      take.push([m, n]); worth += n * MAT[m].price; need -= n;
    }
    const buy = R.q.price * BATCH * batches;
    return { R, batches, coins, take, worth, short: need, ok: need <= 0 && p.coins >= coins, save: buy - coins - worth, buy };
  }
  function brew(game, id, batches) {
    const p = game.player, P = plan(p, id, batches);
    if (!P || !P.ok) return false;
    p.coins -= P.coins;
    for (const [m, n] of P.take) { p.mats[m] = NC.matCount(p, m) - n; if (p.mats[m] <= 0) delete p.mats[m]; }
    POT.add(p, P.R.q.color, P.R.q.size, BATCH * batches);
    if (NC.Econ) NC.Econ.sink('brew', P.coins);
    NC.HUD.log(`ต้ม${P.R.q.name} ×${BATCH * batches} · ใช้วัสดุ ${P.take.reduce((s, t) => s + t[1], 0)} ชิ้น + ${fmt(P.coins)} เหรียญ`, 'item');
    NC.FX.stars(p.x, p.y - 80, 14, P.R.q.color === 'red' ? '255,120,140' : '120,180,255', { speed: 220 });
    NC.saveGame(game);
    return true;
  }

  // the tab
  const iconSrc = (q) => (NC.ASSET_MANIFEST[q.icon] || {}).src || 'assets/' + q.icon + '.png';
  function html(p) {
    const total = Object.keys(p.mats || {}).filter(usable).reduce((s, m) => s + NC.matCount(p, m), 0);
    return '<div class="sp-buy many sp-brew">' + RECIPES.map((R) => {
      const P1 = plan(p, R.id, 1);
      const parts = P1.take.slice(0, 3).map(([m, n]) => `<img src="${NC.matIcon(m)}" alt="" title="${esc(MAT[m].name)}">${n}`).join(' ') + (P1.take.length > 3 ? ' …' : '');
      const saveTxt = P1.short > 0 ? `<i class="bad">วัสดุไม่พอ (ขาด ${P1.short})</i>` : P1.save >= 0 ? `<i class="good">ถูกกว่าซื้อ ${fmt(P1.save)}</i>` : `<i class="bad">ขายวัสดุแล้วซื้อคุ้มกว่า ${fmt(-P1.save)}</i>`;
      const btn = (n) => { const P = plan(p, R.id, n); return `<button class="kw-btn ${n === 1 ? 'blue' : 'grey'}" data-brew="${R.id}:${n}"${P.ok ? '' : ' disabled'}>ต้ม ${n * BATCH}</button>`; };
      return `<div class="sp-pot"><span class="sp-pimg ${R.q.color === 'red' ? 'red' : ''}"><img src="${iconSrc(R.q)}" alt=""></span>` +
        `<div class="sp-pt"><b>${esc(R.q.name)} ×${BATCH}</b><span>วัสดุมอน ${R.junk} ชิ้น + ${fmt(R.coins)} เหรียญ · ${saveTxt}</span>` +
        `<small class="sp-bparts">${P1.take.length ? 'ใช้: ' + parts + ` (ขายได้ ${fmt(P1.worth)})` : 'ยังไม่มีวัสดุมอน'}</small></div>` +
        `<div class="sp-price"><img src="${NC.matIcon('ic_coin')}" alt="">${fmt(R.coins)}</div>` +
        `<div class="sp-pbtns">${btn(1)}${btn(5)}${btn(10)}</div></div>`;
    }).join('') +
      `<div class="sp-note">ลุงต้มยาให้จากวัสดุมอนที่ราคาขายถูกที่สุดก่อน (ของที่ล็อกในกระเป๋าไม่ถูกใช้) · มีวัสดุมอนอยู่ ${fmt(total)} ชิ้น · ` +
      'วัสดุเลเวลต่ำราคาถูก แต่ต้มยาขวดใหญ่ได้เท่ากัน: เก็บไว้ต้ม หรือซื้อจากร้านผู้เล่นอื่นก็ได้</div></div>';
  }

  NC.Brew = { RECIPES, plan, brew, html, BATCH };
})();
