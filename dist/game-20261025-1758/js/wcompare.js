/* wcompare.js — how a gear piece compares with the one worn in its slot (the user, 2026-10-19: "add a compare system so
   players know which weapon is better"). The numbers are the hero's own: the piece is put on for a moment (equip, the
   worn-copy map, the bag) and the hero's values are derived again (NC.gearStats + NC.derive with every file's wrappers:
   refine, option rows, grades, sets, job passives), then everything is put back. Nothing is saved or drawn meanwhile.
   NC.WCmp:
     rivalKey(p, it)        the worn slot a piece goes into (an accessory: the empty one, else acc1)
     piece(p, c|id)         one piece's own numbers: ATK range, refine and what it adds, colour grade, element, rows, ability,
                            stats (the item's) / rowSt (what its option rows add: STR..LUK, HIT, FLEE) / all (both)
     hero(p, key, id, c)    the hero's values with that piece in that slot (null id = the slot empty)
     compare(p, c|id)       { A, B (the worn one or null), dA / dB (the hero's values with each), gains / losses (option
                            rows), off / def (% change of the hero's hit power and toughness), power (off + def) }
     verdict(p, c)          'up' | 'down' | 'same' | '' (worn, can't be worn, not gear): the bag's arrows, cached per gear state
     listed(p, k, id, mine) a stall listing (vend.js kinds 'item' / 'gear') as a piece to compare (a copy decoded)
     arrow(v) / badge(p, x) the bag cells' arrow html; line(p, x) the short verdict line (ดีกว่าที่ใส่อยู่ · พลัง +12%)
   Used by js/wcard.js (the card) and the bag cells' arrows (NC.invBadge, here), Uncle Coco's gear tab (js/shopwin.js)
   and the players' stalls (js/vend.js, js/p3_vend.js). Test: NC.WCmp.compare(__nc.game.player, c). */
(function () {
  'use strict';
  const NC = window.NC, ITEMS = NC.ITEMS, W = NC.GEAR;
  if (!W) return;
  const avg = (a) => (a ? (a[0] + a[1]) / 2 : 0);
  const elOf = (it) => (it && it.element) || 'neutral';

  const rivalKey = (p, it) => (it.slot === 'acc' ? (!p.equip.acc1 ? 'acc1' : !p.equip.acc2 ? 'acc2' : 'acc1') : it.slot);
  const copyOf = (x) => (x && typeof x === 'object' && x.rows ? x : null); // (a gear copy; a plain item is its id or { id })
  const idOf = (x) => (x && typeof x === 'object' ? x.id : x);

  // ---------------- one piece ----------------
  // the flat numbers a piece's option rows add, by the gear's own keys (Discord #154, 2026-10-20: an "INT +3" row showed as
  // INT 0 in the table): a stat row adds its STR..LUK, the HIT / FLEE rows their own key, as the hero's mods do
  // (js/gearopts.js rowMods + js/wabil.js rowEffects, then js/skilltree.js PRE_FLAT puts them with the gear's stats)
  const FLAT = new Set(['str', 'agi', 'vit', 'int', 'dex', 'luk', 'hit', 'flee']);
  function rowStats(rows) {
    const m = {};
    for (const r of rows || []) {
      const O = (NC.WOPTS || {})[r.k], k = r.k === 'stat' ? r.sub : O && O.key;
      if (k && FLAT.has(k) && r.v) m[k] = (m[k] || 0) + r.v;
    }
    return m;
  }
  function piece(p, x) {
    const c = copyOf(x), id = idOf(x), it = ITEMS[id];
    if (!it) return null;
    const ref = (c && c.ref) || 0, wpn = it.slot === 'weapon';
    const g = c && NC.Grade ? NC.Grade.of(c) : null;
    const st = it.stats || {};
    const o = {
      id, c, it, wpn, slot: it.slot, ref,
      atk: wpn && it.dmg ? it.dmg.slice() : null, magic: !!it.magic,
      refAtk: wpn ? 4 * ref : 0, // % ATK (js/refine.js)
      refHp: wpn ? 0 : 0.5 * ref, refDef: wpn ? 0 : Math.floor(ref / 2), // % HP, DEF or MDEF (by the outfit's line)
      grade: g, el: elOf(it), range: wpn ? it.reach || it.range || 0 : 0,
      def: st.def || 0, mdef: st.mdef || 0, hp: st.hp || 0, stats: st,
      rows: c ? c.rows.slice() : [],
      rowSt: rowStats(c && c.rows), // (the rows' share; all = the piece's own stats with it)
      abil: it.abilText || (it.gs && it.gs.text !== '—' && it.gs.text) || '',
      lvReq: it.lvReq || 0, sh: !!(c && c.sh),
    };
    o.all = Object.assign({}, st);
    for (const k in o.rowSt) o.all[k] = (o.all[k] || 0) + o.rowSt[k];
    return o;
  }

  // ---------------- the hero with a piece in a slot ----------------
  function hero(p, key, id, c) {
    const eq0 = p.equip, wu0 = p.wu, bag0 = p.bag;
    try {
      p.equip = Object.assign({}, eq0, { [key]: id || null });
      p.wu = Object.assign({}, wu0 || {});
      if (c) { p.wu[key] = c.u; if (!(bag0 || []).includes(c)) p.bag = (bag0 || []).concat([c]); } // (a stored piece: as if in the bag)
      else delete p.wu[key];
      const stats0 = p.stats;
      p.stats = NC.gearStats(p.equip);
      try { return NC.derive(p); } finally { p.stats = stats0; }
    } catch (e) {
      return null;
    } finally { p.equip = eq0; p.wu = wu0; p.bag = bag0; }
  }
  // what one hit is worth (physical: status ATK + the weapon's, times the % gear; magic: MATK), times the speed and crits
  function offence(d, it) {
    if (!d) return 0;
    const magic = !!(it && it.magic);
    const hit = magic ? avg(d.matk) * (d.skillMul || 1) : ((d.batk || 0) + avg(d.watk)) * (d.atkMul || 1);
    const crit = Math.min(1, (d.crit || 0) / 100) * (0.4 + (d.critDmg || 0) / 100);
    const spd = (d.aspdMul || 1) * ((it && it.aspd) || 1);
    return hit * (1 + crit) * spd * (d.powK || 1);
  }
  // how much it takes to bring the hero down (HP through the hard DEF / MDEF, the softer one weighs half)
  function toughness(d) {
    if (!d) return 0;
    const hp = d.maxHp || 1, k = (v) => 1 / Math.max(0.1, 1 - Math.min(90, v || 0) / 100);
    return hp * (0.65 * k(d.def) + 0.35 * k(d.mdef)) * (1 / Math.max(0.2, 1 - (d.taken || 0) / 100));
  }
  const pctOf = (a, b) => (b > 0 ? ((a - b) / b) * 100 : a > 0 ? 100 : 0);

  // ---------------- a piece against the worn one ----------------
  const rowKey = (r) => r.k + (r.sub ? ':' + r.sub : '');
  function rowsDiff(A, B) {
    const gains = [], losses = [], used = new Set();
    for (const r of A) {
      const j = B.findIndex((x, i) => !used.has(i) && rowKey(x) === rowKey(r));
      if (j < 0) { gains.push({ r, d: 1 }); continue; }
      used.add(j);
      const d = r.v - B[j].v;
      if (d > 0) gains.push({ r, d: 1, was: B[j] }); else if (d < 0) losses.push({ r: B[j], d: -1, now: r });
    }
    B.forEach((r, i) => { if (!used.has(i)) losses.push({ r, d: -1 }); });
    return { gains, losses };
  }
  function compare(p, x) {
    const A = piece(p, x);
    if (!A) return null;
    const key = rivalKey(p, A.it), wid = p.equip[key] || null;
    const wc = wid && W.isInst(wid) ? W.wornIn(p, key) : null;
    const B = wid ? piece(p, wc || wid) : null;
    const same = !!(B && (A.c ? A.c === B.c : A.id === B.id && !A.c));
    fresh(p);
    if (!wornD.has(key)) wornD.set(key, hero(p, key, wid, wc)); // (the worn piece's numbers: once per gear state)
    const dA = hero(p, key, A.id, A.c), dB = wornD.get(key);
    const out = { A, B, key, worn: same, dA, dB, gains: [], losses: [] };
    if (!dA || !dB) return out;
    out.off = pctOf(offence(dA, A.wpn ? A.it : ITEMS[p.equip.weapon]), offence(dB, A.wpn ? (B && B.it) || null : ITEMS[p.equip.weapon]));
    out.def = pctOf(toughness(dA), toughness(dB));
    out.power = out.off + out.def;
    const r = rowsDiff(A.rows, B ? B.rows : []);
    out.gains = r.gains; out.losses = r.losses;
    return out;
  }

  // ---------------- the bag's arrows ----------------
  // the verdict of each piece, kept until the hero's gear, level, job or stats change
  let memo = new Map(), wornD = new Map(), lines = new Map(), sig = '';
  const sigOf = (p) => [JSON.stringify(p.equip), JSON.stringify(p.wu || {}), p.lv, p.job, p.jobLv, JSON.stringify(p.base || {}), JSON.stringify(p.skills || {}), (p.bag || []).length,
    JSON.stringify(Object.keys(p.buffs || {}).filter((k) => p.buffs[k] > 0))].join('|');
  function fresh(p) { const s = sigOf(p); if (s !== sig) { sig = s; memo = new Map(); wornD = new Map(); lines = new Map(); } }
  const LIM = 1.5; // % (less is "about the same")
  function verdict(p, c) {
    if (typeof c === 'string') c = { id: c };
    if (!c || !c.id || !ITEMS[c.id]) return '';
    const it = ITEMS[c.id];
    if (it.rarity === 'fashion' || it.slot === 'hair') return '';
    fresh(p);
    const k = c.u || c.id;
    if (memo.has(k)) return memo.get(k);
    let v = '';
    const key = rivalKey(p, it);
    const worn = Object.keys(p.equip).some((x) => p.equip[x] === c.id && (!c.u || W.wornIn(p, x) === c));
    if (!worn && !(it.slot === 'weapon' && NC.canWield && !NC.canWield(p, c.id))) {
      const C = compare(p, c);
      if (C && C.power != null) v = C.power > LIM ? 'up' : C.power < -LIM ? 'down' : 'same';
      else if (C && !p.equip[key]) v = 'up';
    }
    memo.set(k, v);
    return v;
  }

  // ---------------- the other gear views: Uncle Coco's gear tab (js/shopwin.js), the players' stalls (js/vend.js +
  // js/p3_vend.js): the bag cells' arrow and a short verdict line, cached with the verdicts ----------------
  // a stall's listing as a piece: a plain item by its id; a copy sold whole (js/gearopts.js VEND_KINDS.gear) decoded into
  // a copy of its own with a made-up u under 0 (never one of ours in the caches or the worn-copy map); mine = my own
  // set-up window, where the listing is the copy itself in my bag
  const listedCopies = new Map();
  let fakeU = 0;
  function listed(p, k, id, mine) {
    if (k === 'item') return ITEMS[id] ? id : null;
    if (k !== 'gear' || !NC.gearDec) return null;
    if (!mine && listedCopies.has(id)) return listedCopies.get(id);
    const d = NC.gearDec(id);
    if (!d) return null;
    if (mine) return W.bag(p).find((c) => c.u === d.u && c.id === d.id) || null;
    if (listedCopies.size > 300) listedCopies.clear();
    d.u = -(++fakeU);
    listedCopies.set(id, d);
    return d;
  }
  const wcIcon = (k) => ((NC.ASSET_MANIFEST_WCARD || {})[k] || (NC.ASSET_MANIFEST || {})[k] || {}).src || '';
  const escA = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const sg = (v) => { const n = Math.round(v); return (n > 0 ? '+' : n < 0 ? '−' : '±') + Math.abs(n); };
  // the bag cells' arrow badge (css/wcard.css .wc-arw) for a verdict: 'up' / 'down', else nothing
  const arrow = (v) => (v === 'up' || v === 'down' ? `<i class="wc-arw ${v}" title="${v === 'up' ? 'ดีกว่าที่ใส่อยู่' : 'แย่กว่าที่ใส่อยู่'}"><img src="${wcIcon(v === 'up' ? 'wc_bup' : 'wc_bdown')}" alt=""></i>` : '');
  const badge = (p, x) => (x == null ? '' : arrow(verdict(p, x)));
  // why my job can't hold it ('' when it can; a level too low is told apart, after the power)
  function jobWhy(p, it) {
    if (it.slot === 'weapon' && NC.jobWeaponTypes && NC.wtypeOf) {
      const s = NC.jobWeaponTypes(p.job), t = NC.wtypeOf(it);
      if (s.size && !s.has(t)) return `อาชีพเราใช้${((NC.WTYPES || {})[t] || { name: 'อาวุธนี้' }).name}ไม่ได้`;
    }
    if (it.slot === 'shield' && NC.jobShield && !NC.jobShield(p.job)) return 'อาชีพเราถือโล่ไม่ได้';
    return '';
  }
  const GEAR_SLOTS = ['weapon', 'shield', 'hat', 'glasses', 'top', 'robe', 'pants', 'cape', 'acc'];
  // the verdict line (css/wcard.css .wc-vline): ดีกว่าที่ใส่อยู่ · พลัง +12% / แย่กว่า... / พอ ๆ กับ... / ช่องนี้ยังว่าง / ใส่ไม่ได้
  function line(p, x) {
    if (x == null) return '';
    const c = typeof x === 'object' ? x : { id: x }, it = ITEMS[c.id];
    if (!it || it.rarity === 'fashion' || !GEAR_SLOTS.includes(it.slot)) return '';
    fresh(p);
    const k = c.u || c.id;
    if (lines.has(k)) return lines.get(k);
    const row = (cls, ic, text, tip) => `<div class="wc-vline ${cls}"${tip ? ` title="${escA(tip)}"` : ''}><img src="${wcIcon(ic)}" alt=""><span>${escA(text)}</span></div>`;
    const why = jobWhy(p, it), lv = NC.itemLvOk && !NC.itemLvOk(p, c.id) ? ` · ต้อง Lv ${it.lvReq}` : '';
    let h = '';
    if (why) h = row('cant', 'wc_warn', `ใส่ไม่ได้ · ${why}`);
    else {
      const X = compare(p, x);
      if (X && X.worn) h = row('same', 'wc_same', 'ชิ้นเดียวกับที่ใส่อยู่');
      else if (X && X.power != null) {
        const pw = `พลัง ${sg(X.power)}%`, tip = `ประมาณจากค่าของตัวละครเรา: โจมตี ${sg(X.off)}% · ทนทาน ${sg(X.def)}% (ไม่นับธาตุของมอนและสกิล)`;
        h = !X.B ? (X.power > LIM ? row('up', 'wc_up', `ช่องนี้ยังว่าง · ใส่แล้ว ${pw}${lv}`, tip) : row('same', 'wc_same', `ช่องนี้ยังว่าง · ใส่แล้วพลังแทบเท่าเดิม${lv}`, tip))
          : Math.abs(X.power) <= LIM ? row('same', 'wc_same', `พอ ๆ กับที่ใส่อยู่ · ${pw}${lv}`, tip)
          : X.power > 0 ? row('up', 'wc_up', `ดีกว่าที่ใส่อยู่ · ${pw}${lv}`, tip) : row('down', 'wc_down', `แย่กว่าที่ใส่อยู่ · ${pw}${lv}`, tip);
      }
    }
    lines.set(k, h);
    return h;
  }

  NC.WCmp = { rivalKey, piece, hero, compare, verdict, offence, toughness, listed, arrow, badge, line };
})();
