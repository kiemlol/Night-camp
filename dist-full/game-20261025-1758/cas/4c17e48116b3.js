/* refinewin.js — the refine page made easy, the MMORPG way (the user, 2026-10-17: "ระบบตีบวก ของอาวุธต้องเข้าใจง่ายสิ
   มันงง นะ ให้มันใช้งานง่ายเเบบ รูปเเบบเกม mmo rpg สิ"; picked mockup A, assets/gen/nightcamp_refine_a_raw.png).
   The "ตีบวก" station of the crafting window (js/craftgo.js) draws this page; the bag's ตีบวก button opens it on that copy.
     left     the bag's weapons / the rest (ชุด · หมวก) as rows with their +N
     middle   "+7 → +8", the item floating over the smith's anvil (assets/refine/anvil.jpg), the chance in a ring, the forge
              heat, and under both the level track +1..+10 with its zones (ปลอดภัย / เสี่ยง / อาจแตก)
     right    ก่อน → หลัง (ATK % or DEF / HP, the glow), what a failure does (the row of the next step lit), the cost
              slots (ore, coins, the safety stone with its switch) and one big button; away from the forge the walk button
   The rules and the action stay js/refine.js's (NC.Refine.info, the bag's rf:go / rf:safe actions through NC.invActs);
   this page only shows them and reads what happened (a result banner over the anvil). */
(function () {
  'use strict';
  const NC = window.NC, ITEMS = NC.ITEMS, MAT = NC.MATERIALS;
  const R = NC.Refine, W = NC.GEAR;
  if (!R || !R.info || !W) return;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = (n) => NC.fmtCoins(n);
  const IC = (n) => `assets/refine/${n}.png`;
  // the weapon's shine by level (refine.js GLOW): its name and a swatch colour
  const GLOW = [['ไม่มี', ''], ['ไม่มี', ''], ['ไม่มี', ''], ['ไม่มี', ''], ['ไม่มี', ''], ['ประกาย', '#fff6dc'], ['ประกาย', '#fff6dc'],
    ['ฟ้า', '#78beff'], ['ม่วง', '#be8cff'], ['ทอง', '#ffbe5a'], ['รุ้ง', 'rainbow']];
  let sel = 0, tab = 'w', flash = null, picked = 0; // flash: the last try's banner { u, kind, text }

  const isW = (c) => ITEMS[c.id] && ITEMS[c.id].slot === 'weapon';
  const worn = (p, c) => Object.keys(p.equip).some((k) => W.wornIn(p, k) === c);
  const iconCache = new Map();
  // (a weapon shown big: its sharp HD copy, js/wpnhd.js; the key changes once the copy has loaded)
  const icon = (id, px) => { const H = px >= 256 && NC.WpnHD, k = id + ':' + px + (H ? H.tag(id, px) : ''); if (!iconCache.has(k)) { try { iconCache.set(k, (H ? H.big(id, px) : NC.itemIcon(id, px)).toDataURL()); } catch (e) { iconCache.set(k, ''); } } return iconCache.get(k); };
  function list(p) {
    return W.bag(p).filter((c) => ITEMS[c.id] && (tab === 'w' ? isW(c) : !isW(c)))
      .sort((a, b) => (worn(p, b) - worn(p, a)) || ((b.ref || 0) - (a.ref || 0)) || (ITEMS[a.id].name > ITEMS[b.id].name ? 1 : -1));
  }
  function pick(p) {
    let L = list(p);
    if (!L.length && W.bag(p).some((c) => ITEMS[c.id])) { tab = tab === 'w' ? 'a' : 'w'; L = list(p); }
    let c = L.find((x) => x.u === sel);
    if (!c) { c = L[0] || null; sel = c ? c.u : 0; }
    if (c && c.u !== picked) { R.pick(c.u); picked = c.u; } // (only on a new pick: R.pick clears the button's second-click wait)
    return { L, c };
  }
  const glowSw = (lv) => { const [name, col] = GLOW[Math.min(10, lv)]; return `<i class="rw-sw${col === 'rainbow' ? ' rb' : col ? '' : ' none'}"${col && col !== 'rainbow' ? ` style="--g:${col}"` : ''}></i>${name}`; };
  const pctTxt = (x) => (Math.round(x * 10) / 10).toString();

  // ---------------- the page ----------------
  function html(g, p, near) {
    const { L, c } = pick(p);
    let h = '<div class="rw">';
    // the left column: what to refine
    h += '<div class="rw-left"><nav class="rw-tabs">' +
      `<button class="${tab === 'w' ? 'on' : ''}" data-rwtab="w">อาวุธ</button><button class="${tab === 'a' ? 'on' : ''}" data-rwtab="a">ชุด · หมวก</button></nav>` +
      '<div class="rw-list">' + (L.length ? L.map((x) => `<button class="rw-row${x.u === sel ? ' on' : ''}" data-rwpick="${x.u}" style="--rc:${(NC.RARITY[ITEMS[x.id].rarity] || {}).color || '#cfc6b8'}">` +
        `<img src="${icon(x.id, 96)}" alt=""><span><b>${x.sh ? '✦ ' : ''}${esc(ITEMS[x.id].name)}</b>${worn(p, x) ? '<small>สวมอยู่</small>' : ''}</span>` +
        `<em class="${(x.ref || 0) >= 10 ? 'max' : (x.ref || 0) ? '' : 'zero'}">+${x.ref || 0}</em></button>`).join('')
        : `<div class="rw-empty">ยังไม่มี${tab === 'w' ? 'อาวุธ' : 'ชุดหรือหมวก'}ที่ตีบวกได้</div>`) + '</div></div>';
    if (!c) return h + '<div class="rw-none"><img src="assets/refine/rf_hammer.png" alt=""><b>ยังไม่มีของที่ตีบวกได้</b>' + // (2026-10-17: never a blank page)
      '<p>ตีบวกได้กับอาวุธ ชุด หมวก ที่ดรอปจากมอนหรือตีจากป๋าหมูหริ่ง (ของเริ่มต้นตีบวกไม่ได้)</p>' +
      '<button class="kw-btn gold" data-cgpage="make">ไปตีอาวุธ</button></div></div>';
    const it = ITEMS[c.id], I = R.info(p, c), cur = c.ref || 0, nx = Math.min(10, cur + 1), weapon = isW(c);
    // the middle: the step, the item over the anvil, the chance
    const fl = flash && (flash.u === c.u || flash.kind === 'broke') ? flash : null;
    const zone = I.max ? 'max' : I.n <= I.safeTo ? 'safe' : I.n >= 9 ? 'break' : 'risk';
    const fails = I.heat > 1 ? Math.round(Math.log(I.heat) / Math.log(1.5)) : 0;
    h += '<div class="rw-mid">' +
      `<div class="rw-step">${I.max ? '<b class="max">+10</b><small>สูงสุดแล้ว</small>' : `<b>+${cur}</b><i>→</i><b class="nx ${zone}">+${I.n}</b>`}</div>` +
      `<div class="rw-stage"><img class="rw-item" src="${icon(c.id, 256)}" alt=""><i class="rw-aura" style="--g:${(GLOW[nx][1] && GLOW[nx][1] !== 'rainbow') ? GLOW[nx][1] : '#bfe3ff'}"></i>` +
        (fl ? `<div class="rw-flash ${fl.kind}">${esc(fl.text)}</div>` : '') + '</div>' +
      (I.max ? '<div class="rw-ring max"><b>MAX</b></div>'
        : `<div class="rw-ring ${zone}" style="--p:${I.chance}"><b>${I.chance}%</b><small>โอกาสสำเร็จ</small></div>` +
          `<div class="rw-heat">${fails ? `<img src="${IC('rf_heat')}" alt="">เตาร้อน ×${pctTxt(I.heat)} <small>(พลาดขั้นนี้มา ${fails} ครั้ง โอกาสขึ้นทุกครั้งที่พลาด)</small>` : '<small>พลาดแล้วเตาร้อนขึ้น ครั้งต่อไปโอกาสสูงขึ้น ×1.5</small>'}</div>`) +
      '</div>';
    // the right column: before -> after, a failure, the cost, the button
    const atk = (lv) => `+${4 * lv}%`, def = (lv) => `+${Math.floor(lv / 2)}`, hp = (lv) => `+${pctTxt(0.5 * lv)}%`;
    const arrow = (a, b) => `<span class="rw-a">${a}</span><i class="rw-ar">➜</i><span class="rw-b">${b}</span>`;
    h += '<div class="rw-right"><div class="rw-card kw-card"><div class="rw-ch">ก่อน → หลัง</div>' +
      (weapon ? `<div class="rw-li"><span>ATK จากตีบวก</span>${arrow(atk(cur), atk(nx))}</div><div class="rw-li"><span>แสงอาวุธ</span>${arrow(glowSw(cur), glowSw(nx))}</div>`
        : `<div class="rw-li"><span>${it.of && it.of.line === 'mg' ? 'MDEF' : 'DEF'}</span>${arrow(def(cur), def(nx))}</div><div class="rw-li"><span>HP</span>${arrow(hp(cur), hp(nx))}</div>`) +
      '<div class="rw-fails">' +
        `<div class="rw-f${zone === 'safe' ? ' on' : ''}"><img src="${IC('rf_safe')}" alt=""><span>+1 ถึง +${I.safeTo} ปลอดภัย · ไม่มีวันพลาด</span></div>` +
        (I.safeTo < 8 ? `<div class="rw-f${zone === 'risk' ? ' on' : ''}"><img src="${IC('rf_down')}" alt=""><span>+${I.safeTo + 1}${I.safeTo + 1 < 8 ? ' ถึง +8' : ''} พลาด: อยู่ขั้นเดิม ของไม่พัง</span></div>` : '') +
        `<div class="rw-f bad${zone === 'break' ? ' on' : ''}"><img src="${IC('rf_break')}" alt=""><span>+9, +10 พลาด: ลด 1 ขั้น หรือ<b>ของแตก</b> (${R.BREAK[9]}% / ${R.BREAK[10]}% ของครั้งที่พลาด)</span></div>` +
      '</div></div>';
    if (!I.max) {
      const M = MAT[I.ore] || { name: I.ore }, okOre = I.have >= I.need, okCoin = (p.coins || 0) >= I.coins;
      h += '<div class="rw-cost">' +
        `<div class="rw-slot ${okOre ? 'ok' : 'no'}" data-cgtip="${I.ore}"><img src="${NC.matIcon(I.ore)}" alt=""><span><b>${esc(M.name)}</b><em>${I.have} / ${I.need}</em></span></div>` +
        `<div class="rw-slot ${okCoin ? 'ok' : 'no'}"><img src="${NC.matIcon('ic_coin')}" alt=""><span><b>${fmt(I.coins)}</b><em>${okCoin ? 'เหรียญพอ' : 'เหรียญไม่พอ'}</em></span></div>` +
        `<div class="rw-slot stone${I.guard ? '' : ' idle'}"><img src="${IC('rf_stone')}" alt=""><span><b>หินกันแตก ×${I.stones}</b>` +
          `<em>${I.guard ? 'ไม่แตก ไม่ลดขั้น' : 'ใช้ตอน +9 / +10'}</em></span>` +
          `<button class="rw-sw2${NC.refineSafe && NC.refineSafe.get() ? ' on' : ''}" data-act="rf:safe:0"><i></i><b>${NC.refineSafe && NC.refineSafe.get() ? 'เปิด' : 'ปิด'}</b></button></div>` +
        '</div>';
      if (!near) h += `<div class="cg-go rw-go"><button class="kw-btn gold cg-walk rw-btn" data-cgwalk="refine"><img src="${IC('rf_hammer')}" alt="">พาเดินไปเตาป๋าหมูหริ่ง</button>` +
        '<small>ตีบวกได้ที่เตาของป๋าหมูหริ่งกลางค่าย · เดินไปเองอัตโนมัติ ถึงแล้วหน้านี้เปิดให้เอง</small></div>';
      else {
        const why = I.wornBlock ? 'ของที่สวมอยู่อาจแตก: ถอดก่อน หรือเปิดหินกันแตก' : !okOre ? `${M.name}ไม่พอ (กดที่แร่เพื่อดูที่หา)` : !okCoin ? 'เหรียญไม่พอ' : '';
        h += `<button class="kw-btn gold rw-btn${I.armed ? ' armed' : ''}" data-act="rf:go:${c.u}"${I.ok && !I.wornBlock ? '' : ' disabled'}>` +
          `<img src="${IC('rf_hammer')}" alt="">${I.armed ? 'กดอีกครั้งเพื่อตี!' : 'ตีบวก +' + I.n}</button>` +
          `<div class="rw-note${why ? ' bad' : ''}">${esc(why || (I.n > I.safeTo ? 'ขั้นนี้มีโอกาสพลาด · กด 2 ครั้งเพื่อยืนยัน' : 'ขั้นนี้ปลอดภัย · กดครั้งเดียว'))}</div>`;
      }
    }
    h += '</div>';
    // the track under the item and the chance
    {
      const S = I.safeTo;
      h += '<div class="rw-track"><div class="rw-segs">' + Array.from({ length: 10 }, (_, i) => {
        const lv = i + 1, z = lv <= S ? 'safe' : lv >= 9 ? 'break' : 'risk';
        return `<span class="rw-seg ${z}${lv <= cur ? ' done' : ''}${lv === cur + 1 ? ' next' : ''}">+${lv}</span>`;
      }).join('') + '</div><div class="rw-zones" style="--s:' + S + '">' +
        `<span class="safe" style="grid-column:1 / ${S + 1}">ปลอดภัย</span>` + (S < 8 ? `<span class="risk" style="grid-column:${S + 1} / 9">เสี่ยง</span>` : '') +
        '<span class="break" style="grid-column:9 / 11">อาจแตก</span></div></div>';
    }
    return h + '</div>';
  }

  // ---------------- the clicks (craftgo.js draws the page again when this returns true) ----------------
  function click(b, g) {
    const D = b.dataset, p = g.player;
    if (D.rwtab) { tab = D.rwtab; sel = 0; flash = null; return true; }
    if (flash && flash.kind === 'broke') flash = null;
    if (D.rwpick) { sel = Number(D.rwpick); flash = null; R.pick(sel); return true; }
    if (!D.act || !/^rf:/.test(D.act)) return false;
    const go = /^rf:go:(\d+)$/.exec(D.act), c = go ? W.bag(p).find((x) => x.u === Number(go[1])) : null;
    const was = c ? c.ref || 0 : 0, lastWas = R.last(), stones = NC.matCount(p, 'mat_safety');
    for (const f of NC.invActs || []) if (f(g, D.act, null)) break;
    if (c && R.last() !== lastWas) { // a try happened: what came of it
      const still = W.bag(p).includes(c), now = c.ref || 0;
      flash = !still ? { u: c.u, kind: 'broke', text: 'ของแตก!' }
        : now > was ? { u: c.u, kind: 'ok', text: `สำเร็จ! +${now}` }
        : NC.matCount(p, 'mat_safety') < stones ? { u: c.u, kind: 'saved', text: 'หินกันแตกช่วยไว้!' }
        : now < was ? { u: c.u, kind: 'drop', text: `ไม่สำเร็จ · ลดเหลือ +${now}` } : { u: c.u, kind: 'fail', text: `ไม่สำเร็จ · ยังเป็น +${now}` };
      if (!still) { flash.u = 0; sel = 0; }
    }
    return true;
  }
  // the bag card's line: the step, the chance, and the way to this page
  function mini(p, c) {
    const I = R.info(p, c);
    return `<div class="rf-box rf-mini"><span>${I.max ? '+10 สูงสุดแล้ว' : `+${c.ref || 0} → <b>+${I.n}</b> · โอกาส <b>${I.chance}%</b>`}</span>` +
      `<button class="iv-btn gold" data-act="cg:refine:${c.u}">เปิดหน้าตีบวก</button></div>`;
  }
  NC.RefineWin = { html, click, mini, select: (u) => { sel = u; flash = null; const c = W.bag(NC.game.player).find((x) => x.u === u); if (c) tab = isW(c) ? 'w' : 'a'; } };
})();
