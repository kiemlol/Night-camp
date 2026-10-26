/* wcard.js — the gear card in the bag, with the compare (the user, 2026-10-19: "the weapon card looks bad, redesign it,
   and add a compare so players know which one is better"; they picked mockup B, assets/gen/nightcamp_wcard_b_raw.png):
   one cream window beside the bag, the item name in its sky-blue title bar; the big picture in its rarity's colour with the
   worn piece small in its corner; the rarity ribbon with the grade's gems, type, level stars, tags and a verdict box (ดีกว่า / แย่กว่า / พอ ๆ กัน,
   "พลัง +26%": the hero's own numbers, js/wcompare.js); a table สเตตัส | ชิ้นนี้ | ที่ใส่อยู่ | ต่าง; the option rows of
   both pieces side by side (gains green, losses struck red); the ability and the price; the other files' lines (set,
   skill boosts, grade, book...) in a dark box under them; สวมใส่ / ตีบวก / ขัดเกรด always at the bottom.
   The bag's cells get a small green / red arrow: better / worse than the worn piece of their slot.
   Hooks: NC.invItemCard (js/inventory.js renderDetail), NC.invBadge, NC.invActs (the sell button's second press).
   Icons assets/kui/wc_*.png (tools/wcicons_cut.py). ?wcard=0: the old card. */
(function () {
  'use strict';
  const NC = window.NC, ITEMS = NC.ITEMS, W = NC.GEAR, C = NC.WCmp;
  if (!W || !C) return;
  if (NC.ASSET_MANIFEST_WCARD && NC.ASSET_MANIFEST) Object.assign(NC.ASSET_MANIFEST, NC.ASSET_MANIFEST_WCARD);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const fmt = (n) => NC.fmtCoins(n);
  const icon = (k) => ((NC.ASSET_MANIFEST || {})[k] || {}).src || (NC.matIcon ? NC.matIcon(k) : ''); // (the coin: the shop's icons)
  const img = (k, cls) => (icon(k) ? `<img class="${cls || ''}" src="${icon(k)}" alt="">` : '');
  const sgn = (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v);
  const r1 = (v) => Math.round(v * 10) / 10;
  const avg = (a) => (a ? (a[0] + a[1]) / 2 : 0);
  const GR = () => (NC.Grade ? NC.Grade.GRADES : []);
  const elTh = (el) => ((NC.ELEMENT_INFO || {})[el || 'neutral'] || { th: el }).th;
  // the card's colours are the item's rarity (2026-10-20, as the forge's lists name a piece); the copy's grade shows as gems
  const TIER_RARITY = { common: 0, rare: 2, epic: 3, legend: 4 }; // (the grade palette's keys of the same colours)
  const gOf = (P) => (!P ? 0 : TIER_RARITY[P.it.rarity] || 0);
  const gHas = (P) => !!(P && P.grade != null && GR()[P.grade]); // (a plain item has no grade)
  const gName = (P) => (gHas(P) ? GR()[P.grade].name : '–');
  const gGems = (P, cls, all) => (gHas(P) && NC.gradeGems ? NC.gradeGems(P.grade, cls, all) : ''); // (all: the five places with the empty ones)

  // ---------------- the parts ----------------
  function typeText(it, H) {
    if (it.slot === 'weapon') { const T = (NC.WTYPES || {})[NC.wtypeOf ? NC.wtypeOf(it) : '']; return T ? `${T.name} · ${T.pair ? 'ถือคู่' : T.h === 1 ? 'มือเดียว' : 'สองมือ'}` : 'อาวุธ'; }
    return H && H.typeText ? H.typeText(it) : NC.SLOT_NAME[it.slot] || it.slot;
  }
  function jobsText(it) {
    if (it.slot !== 'weapon') return it.of && NC.OUTFITS ? 'สาย' + ((NC.OUTFITS.LINE[it.of.line] || {}).th || '') : '';
    const t = NC.wtypeOf ? NC.wtypeOf(it) : '';
    const js = Object.keys(NC.JOB_WEAPONS || {}).filter((j) => NC.JOB_WEAPONS[j].includes(t) && NC.JOBS[j]).map((j) => NC.JOBS[j].name);
    return js.length > 2 ? js.slice(0, 2).join(' · ') + ' …' : js.join(' · ');
  }
  // the verdict box: [class, icon, big word, small line]
  function verdict(p, en, X, why) {
    if (en.worn || X.worn) return ['worn', 'wc_worn', 'ใส่อยู่', 'ชิ้นที่สวมตอนนี้'];
    const pw = X.power, n = pw == null ? null : Math.round(pw);
    const line = n == null ? '' : `พลัง ${n > 0 ? '+' : n < 0 ? '−' : '±'}${Math.abs(n)}%`;
    if (why) return ['cant', 'wc_warn', 'ใส่ไม่ได้', why];
    if (!X.B) return ['up', 'wc_up', 'ช่องว่าง', line ? 'ใส่แล้ว ' + line : 'ใส่ได้เลย'];
    if (n == null || Math.abs(pw) <= 1.5) return ['same', 'wc_same', 'พอ ๆ กัน', line || 'ค่าพลังใกล้กัน'];
    return pw > 0 ? ['up', 'wc_up', 'ดีกว่า', line] : ['down', 'wc_down', 'แย่กว่า', line];
  }
  // one table row: label, this, worn, change ([dir, text]: up / down / same / diff)
  const tr = (label, a, b, d, solo) => `<tr><td>${label}</td><td class="a">${a}</td>${solo ? '' : `<td class="b">${b}</td><td class="d ${d[0]}">${chg(d)}</td>`}</tr>`;
  function chg(d) {
    const ic = { up: 'wc_up', down: 'wc_down', same: 'wc_same', diff: 'wc_swap' }[d[0]];
    return `${img(ic, 'ic')}${d[1] ? `<span>${esc(d[1])}</span>` : ''}`;
  }
  const num = (a, b, f) => { const v = Math.round((a - b) * 10) / 10; return v > 0 ? ['up', '+' + (f ? f(v) : v)] : v < 0 ? ['down', '−' + (f ? f(-v) : -v)] : ['same', '']; };
  function table(p, X, solo) {
    const A = X.A, B = X.B, dA = X.dA || {}, dB = X.dB || {}, rows = [];
    const gc = (P) => `wc-t${gOf(P)}`;
    if (A.wpn) {
      const at = (P) => (P && P.atk ? `${P.atk[0]}–${P.atk[1]}` : '–');
      const rf = (P) => (P ? `+${P.ref}${P.ref ? ` <small>(+${P.refAtk}%)</small>` : ''}` : '–');
      rows.push(tr(A.magic ? 'ATK <small>(เวท)</small>' : 'ATK', `<b class="${gc(A)}">${at(A)}</b>`, at(B), num(avg(A.atk), B && B.atk ? avg(B.atk) : 0, Math.round), solo));
      rows.push(tr('ตีบวก', `<b class="${gc(A)}">${rf(A)}</b>`, rf(B), num(A.ref, B ? B.ref : 0), solo));
    } else {
      const pctT = (v) => `${r1(v)}%`;
      rows.push(tr('DEF', `<b>${r1(dA.def || 0)}%</b>`, pctT(dB.def || 0), num(dA.def || 0, dB.def || 0), solo));
      rows.push(tr('MDEF', `<b>${r1(dA.mdef || 0)}%</b>`, pctT(dB.mdef || 0), num(dA.mdef || 0, dB.mdef || 0), solo));
      rows.push(tr('HP สูงสุด', `<b>${fmt(dA.maxHp || 0)}</b>`, fmt(dB.maxHp || 0), num(dA.maxHp || 0, dB.maxHp || 0, fmt), solo));
      rows.push(tr('ตีบวก', `<b class="${gc(A)}">+${A.ref}</b>`, B ? '+' + B.ref : '–', num(A.ref, B ? B.ref : 0), solo));
    }
    if (A.wpn || A.el !== 'neutral' || (B && B.el !== 'neutral')) {
      const el = (P) => (P ? `<span class="wc-el" style="--ec:${((NC.ELEMENT_INFO || {})[P.el] || {}).color || '#888'}">${esc(elTh(P.el))}</span>` : '–');
      const same = A.el === (B ? B.el : 'neutral');
      rows.push(tr(A.wpn ? 'ธาตุ' : 'ธาตุเกราะ', `<b>${el(A)}</b>`, el(B), same ? ['same', ''] : ['diff', 'ต่างธาตุ'], solo));
    }
    if (A.wpn) {
      rows.push(tr('ความเร็วตี', `<b>ASPD ${dA.aspd || 0}</b>`, `ASPD ${dB.aspd || 0}`, num(dA.aspd || 0, dB.aspd || 0), solo));
      rows.push(tr('ระยะ', `<b>${A.range || '–'}</b>`, B && B.range ? B.range : '–', num(A.range || 0, B ? B.range || 0 : 0), solo));
    }
    // the stats: the item's own with its option rows' (Discord #154: an "INT +3" row showed as INT 0), on both sides; a
    // weapon shows only the ones its rows or stats have
    const all = (P) => (P && (P.all || P.stats)) || {};
    const ks = Object.keys(all(A)).concat(Object.keys(all(B))).filter((k, i, a) => a.indexOf(k) === i && !['def', 'mdef', 'hp'].includes(k) && (all(A)[k] || all(B)[k]));
    for (const k of ks.slice(0, A.wpn ? 3 : 5)) {
      const a = all(A)[k] || 0, b = all(B)[k] || 0, frac = Math.abs(a) < 1 && Math.abs(b) < 1 && (a || b);
      const f = (v) => (frac ? Math.round(v * 100) + '%' : String(v));
      const ro = (P) => (P && P.rowSt && P.rowSt[k] ? ` <small>(ออป +${P.rowSt[k]})</small>` : '');
      rows.push(tr(esc(k.toUpperCase()), `<b>${f(a)}</b>${ro(A)}`, B ? f(b) + ro(B) : '–', num(frac ? a * 100 : a, frac ? b * 100 : b), solo));
    }
    return `<table class="wc-tab${solo ? ' solo' : ''}"><tr><th>สเตตัส</th><th>ชิ้นนี้</th>${solo ? '' : '<th>ที่ใส่อยู่</th><th>ต่าง</th>'}</tr>${rows.join('')}</table>`;
  }
  // an option row: the kind's own text (the ceiling as a tag), its tier's diamond
  const OPT = () => NC.WOPTS || {};
  function rowHtml(r, mark) {
    const O = OPT()[r.k], sp = !!(O && O.special), t = O ? O.text(r) : NC.rowText(r);
    const full = NC.optIsFull && NC.optIsFull(r);
    return `<div class="r t${sp ? 's' : r.tier}${mark === 'lost' ? ' lost' : ''}"><i></i><span>${esc(t)}</span>${full ? '<em>ตัน</em>' : ''}` +
      (mark === 'up' ? img('wc_up', 'ar') : mark === 'down' || mark === 'lost' ? img('wc_down', 'ar') : '') + '</div>';
  }
  function options(X, solo) {
    const A = X.A, B = X.B;
    if (!A.rows.length && !(B && B.rows.length) && !A.c) return '';
    const up = new Set(X.gains.map((g) => g.r)), downA = new Set(X.losses.filter((l) => l.now).map((l) => l.now)), lost = new Set(X.losses.filter((l) => !l.now).map((l) => l.r));
    let a = A.rows.map((r) => rowHtml(r, solo ? '' : up.has(r) ? 'up' : downA.has(r) ? 'down' : '')).join('');
    if (A.c && A.rows.length < (W.MAX_ROWS || 4)) a += '<div class="r empty"><i></i><span>— ช่องว่าง (เจาะเพิ่มได้) —</span></div>';
    const b = !B ? '<div class="r empty"><span>— ช่องนี้ว่าง —</span></div>' : B.rows.length ? B.rows.map((r) => rowHtml(r, lost.has(r) ? 'lost' : '')).join('') : '<div class="r empty"><span>— ไม่มีออปชัน —</span></div>';
    return '<div class="wc-h">ออปชัน</div>' + `<div class="wc-opts${solo ? ' solo' : ''}"><div class="wc-ob this"><div class="hd">ชิ้นนี้</div>${a || '<div class="r empty"><span>— ไม่มีออปชัน —</span></div>'}</div>` +
      (solo ? '' : `<div class="wc-ob worn"><div class="hd">ที่ใส่อยู่</div>${b}</div>`) + '</div>';
  }
  const nearShop = (game) => { const S = NC.Shop; return !!(S && game && game.world && game.world.shop && game.player.dead <= 0 && NC.dist(game.player.x, game.player.y, S.npc.x, S.npc.y) < S.talk + 40); };
  let sellArmed = { u: 0, t: 0 };
  function strip(p, en, X) {
    const A = X.A, c = A.c, ab = A.abil;
    const abil = `<div class="wc-abil${ab ? '' : ' none'}">${ab ? img(A.el !== 'neutral' ? 'el_' + A.el : 'sd_inflict', 'ic') : ''}<span>${esc(ab || 'ไม่มีความสามารถพิเศษ')}</span></div>`;
    if (!c || en.kind === 'store') return `<div class="wc-strip">${abil}</div>`;
    const price = W.noSale && W.noSale(c) ? 0 : NC.GEAR.sellPrice ? NC.GEAR.sellPrice(c) : W.priceOf(c);
    const shop = nearShop(NC.game) && !en.worn;
    let sell;
    if (!price) sell = '<div class="wc-sell none">ขายไม่ได้</div>';
    else if (shop) {
      const armed = sellArmed.u === c.u && performance.now() - sellArmed.t < 3000;
      sell = `<button class="iv-btn gold wc-sellb" data-act="gb:sell:${c.u}">${img('ic_coin', 'ic')}${armed ? 'กดอีกครั้ง' : 'ขาย ' + fmt(price)}</button>`;
    } else sell = `<div class="wc-sell" title="ขายได้ที่ร้านลุงโกโก้">${img('ic_coin', 'ic')}<span>ขาย ${fmt(price)}</span></div>`;
    // ฝากคลัง: at Coco the button, away from him one that walks there (2026-10-20 Discord #133: "ส่งของเข้าคลังไม่ได้", the
    // card had no word of where; an unsellable piece had no deposit button at all)
    if (!en.worn) sell += shop ? `<button class="iv-btn dark wc-sellb" data-act="gb:put:${c.u}" ${W.store(p).length >= W.STORE_MAX ? 'disabled' : ''}>ฝากคลัง</button>`
      : '<button class="iv-btn dark wc-sellb" data-act="wc:coco:put" title="ฝากคลังได้ที่ร้านลุงโกโก้ กลางค่าย">ไปฝากคลัง</button>';
    return `<div class="wc-strip">${abil}${sell}</div>`;
  }
  // the other files' lines on the card (set passives, skill boosts, the grade's rule, the book, bound...): the ability
  // and the refine box are on the card already
  function more(p, en, H) {
    const id = en.id, it = en.it, one = en.copy || undefined;
    let h = H && H.setHtml ? H.setHtml(p, it) : '';
    for (const f of NC.invCardExtras || []) {
      let x = '';
      try { x = f(p, id, one) || ''; } catch (e) { x = ''; }
      if (!x || /gb-abil|rf-box/.test(x)) continue;
      h += x;
    }
    const desc = it.of ? String(it.desc || '').split(' · ')[0] : it.desc;
    if (desc) h += `<div class="iv-desc">${esc(desc)}</div>`;
    return h ? `<div class="wc-more">${h}</div>` : '';
  }
  function buttons(p, en, why, H) {
    const it = en.it, c = en.copy, b = [];
    if (en.kind === 'store') { // (2026-10-20, the owner: "ของอยู่ในคลังจะเอาออกมายังไง": away from Coco the button was grey with no word why)
      const full = W.room && !W.room(p);
      if (!nearShop(NC.game)) return '<button class="iv-btn blue" data-act="wc:coco">เดินไปเบิกที่ลุงโกโก้</button>'; // (walks there, the bag opens again)
      return `<button class="iv-btn blue" data-act="gb:take:${c.u}" ${full ? 'disabled' : ''}>${full ? 'กระเป๋าเต็ม · เบิกไม่ได้' : 'เบิกใส่กระเป๋า'}</button>`;
    }
    const off = H && H.OFFABLE ? H.OFFABLE.has(it.slot) : ['hat', 'glasses', 'robe', 'cape', 'acc', 'shield'].includes(it.slot);
    b.push(en.worn ? (off ? '<button class="iv-btn blue" data-act="main">ถอดออก</button>' : '<button class="iv-btn blue" disabled>สวมอยู่</button>')
      : `<button class="iv-btn blue" data-act="main" ${why ? 'disabled' : ''}>สวมใส่</button>`);
    if (c && W.isInst(c.id)) {
      b.push(`<button class="iv-btn gold" data-act="${NC.RefineWin ? 'cg:refine:' + c.u : 'gt:refine'}">ตีบวก</button>`);
      if (NC.Grade) b.push('<button class="iv-btn grey" data-act="gt:grade">ขัดเกรด</button>');
    }
    return b.join('');
  }

  // ---------------- what the card's marks mean (2026-10-20, players: "what is the star, why do two swords of one colour
  // have different stars"): the stars are gone, every mark has its word, and a ? box tells them all; it is open until the
  // player closes it once ----------------
  const HELPKEY = 'nightcamp.wchelp.v1';
  let help = true;
  try { help = localStorage.getItem(HELPKEY) !== '0'; } catch (e) { /* storage blocked: open */ }
  const KIND_TH = { B: 'ออปพิเศษ', C: 'ปลุกเวท', D: 'บอส' }; // (why a weapon has its rarity: js/greatswords.js KIND; A plain, L the world's legends)
  const kindText = (it) => KIND_TH[NC.gearKind ? NC.gearKind(it) : ''] || '';
  function helpHtml() {
    const sw = (k) => `<em><i class="wc-sw" style="--c:${(NC.RARITY[k] || {}).color}"></i>${esc((NC.RARITY[k] || {}).name || k)}</em>`;
    const names = NC.Grade ? NC.Grade.GRADES.map((G) => G.name).join(' · ') : '';
    return '<div class="wc-help"><div class="hd">ป้ายบนการ์ด<button data-act="wc:help" title="ปิด">ปิด</button></div>' +
      `<div><b>สีกรอบ</b><span>ความหายาก: ${['common', 'rare', 'epic', 'legend'].map(sw).join(' ')}</span></div>` +
      `<div><b>${NC.gradeGems ? NC.gradeGems(3, 'help', true) : '◆'}</b><span>เกรดขัด 0–5 เม็ด ยิ่งมากแถวออฟยิ่งดี (${esc(names)}) ขัดได้ที่ป๋าหมูหริ่ง</span></div>` +
      '<div><b>+N</b><span>ตีบวก เพิ่มพลังโจมตี / ป้องกันของชิ้นนี้</span></div>' +
      '<div><b>Lv</b><span>เลเวลที่ต้องมีถึงจะใส่ได้</span></div>' +
      `<div><b>${img('wc_bup', 'ic')}${img('wc_bdown', 'ic')}</b><span>เขียว = ดีกว่าของที่ใส่อยู่ · แดง = แย่กว่า</span></div></div>`;
  }
  if (NC.invActs) NC.invActs.unshift((game, a) => {
    if (a !== 'wc:help') return false;
    help = !help;
    try { localStorage.setItem(HELPKEY, help ? '1' : '0'); } catch (e) { /* storage blocked */ }
    return true; // (the bag draws the card again)
  });

  // ---------------- the card ----------------
  NC.invItemCard = function (p, en, H) {
    const it = en.it;
    if (!it || it.rarity === 'fashion' || it.slot === 'hair' || !['weapon', 'shield', 'hat', 'glasses', 'top', 'robe', 'pants', 'cape', 'acc'].includes(it.slot)) return '';
    if (en.kind === 'store' && !en.copy) return '';
    const X = C.compare(p, en.copy || en.id);
    if (!X) return '';
    const A = X.A, B = X.B, solo = !!(en.worn || X.worn);
    const why = en.kind === 'store' ? '' : H && H.whyNot ? H.whyNot(p, en.id) : '';
    const V = en.kind === 'store' ? ['store', 'wc_worn', 'ในคลัง', !nearShop(NC.game) ? 'เบิกได้ที่ร้านลุงโกโก้ กลางค่าย · กดปุ่มด้านล่าง ตัวละครจะเดินไปให้'
      : W.room && !W.room(p) ? `กระเป๋าอุปกรณ์เต็ม (${W.bagCap ? W.bagCap(p) : ''} ชิ้น) · ขายหรือฝากของก่อนเบิก` : 'กด "เบิกใส่กระเป๋า" แล้วค่อยสวมใส่'] : verdict(p, en, X, why);
    const g = gOf(A), R = NC.RARITY[it.rarity] || NC.RARITY.common, kind = kindText(it);
    const name = en.copy && NC.copyName ? NC.copyName(en.copy) : it.name;
    const tags = [];
    if (it.lvReq) tags.push(`<span class="wc-lv${NC.itemLvOk && !NC.itemLvOk(p, en.id) ? ' bad' : ''}" title="ต้องมีเลเวล ${it.lvReq} ขึ้นไปถึงจะใส่ได้">ใส่ได้ Lv ${it.lvReq}</span>`);
    const jt = jobsText(it);
    if (jt) tags.push(`<span class="wc-job" title="${esc(jt)}">${esc(jt)}</span>`);
    if (A.wpn || A.el !== 'neutral') tags.push(`<span class="wc-elt">${img('el_' + A.el, 'ic')}${esc(elTh(A.el))}</span>`);
    const tip = X.power == null ? '' : ` title="${esc(`ประมาณจากค่าของตัวละครเรา: โจมตี ${sgn(Math.round(X.off))}% · ทนทาน ${sgn(Math.round(X.def))}% (ไม่นับธาตุของมอนและสกิล)`)}"`;
    const html =
      `<header class="wc-title wc-g${g}"><span>${esc(name)}</span></header><div class="wc-body">` +
      '<div class="wc-top">' +
        `<div class="wc-pic wc-g${g}"><canvas data-big="${esc(en.id)}" width="256" height="256"></canvas>` +
          (B && !solo ? `<div class="wc-inset wc-g${gOf(B)}" title="ที่ใส่อยู่: ${esc(B.c && NC.copyName ? NC.copyName(B.c) : B.it.name)}"><canvas data-big="${esc(B.id)}" width="256" height="256"></canvas></div>` : '') + '</div>' +
        '<div class="wc-side">' +
          `<div class="wc-ribrow"><div class="wc-rib wc-g${g}" title="ความหายาก (สีกรอบ): ${esc(R.name)}${kind ? ' · ' + esc(kind) : ''}">${esc(R.name)}${kind ? ' · ' + esc(kind) : ''}</div>` +
            `<button class="wc-q${help ? ' on' : ''}" data-act="wc:help" title="ป้ายบนการ์ดคืออะไร">?</button></div>` +
          `<div class="wc-type">${esc(typeText(it, H))}</div>` +
          (gHas(A) ? `<div class="wc-polish" title="เกรดขัด ${esc(gName(A))}: ${esc((NC.Grade && NC.Grade.WHAT[A.grade]) || '')} · ขัดเพิ่มได้ที่ป๋าหมูหริ่ง">` +
            `<span>เกรดขัด</span>${gGems(A, 'pol', true)}<b>${esc(gName(A))}</b></div>` : '') +
          (tags.length ? `<div class="wc-tags">${tags.join('')}</div>` : '') +
          `<div class="wc-verdict ${V[0]}"${tip}>${img(V[1], 'vi')}<div><b>${esc(V[2])}</b><span>${esc(V[3])}</span></div></div>` +
        '</div></div>' +
      (help ? helpHtml() : '') + table(p, X, solo) + options(X, solo) + strip(p, en, X) + more(p, en, H) +
      `</div><footer class="wc-acts">${buttons(p, en, why, H)}</footer>`;
    queueMicrotask(paint); // (after the bag has put the html in)
    return html;
  };
  function paint() {
    for (const cv of document.querySelectorAll('.wc-card canvas[data-big]')) {
      const c = cv.getContext('2d');
      c.clearRect(0, 0, cv.width, cv.height);
      try { c.drawImage(NC.itemIcon(cv.dataset.big, 256), 0, 0); } catch (e) { /* not loaded yet */ }
    }
  }
  // the stored piece's "เดินไปเบิกที่ลุงโกโก้" / a bag piece's "ไปฝากคลัง" / the empty storage tab's button: walk to his
  // shop, then the bag again (its tab and the piece are kept)
  const COCO_SAY = { 'wc:coco': 'กด "เบิกใส่กระเป๋า" ได้เลย', 'wc:coco:put': 'กด "ฝากคลัง" ได้เลย', 'wc:coco:go': 'ฝาก / เบิกของได้เลย' };
  if (NC.invActs) NC.invActs.unshift((game, a) => {
    if (!COCO_SAY[a]) return false;
    const S = NC.Shop, go = NC.CraftGo && NC.CraftGo.walkTo;
    if (!S || !S.npc || !go) { if (game.toast) game.toast('ฝาก / เบิกของได้ที่ร้านลุงโกโก้ กลางค่าย'); return true; }
    if (nearShop(game)) { if (game.toast) game.toast('อยู่ที่ลุงโกโก้แล้ว · ' + COCO_SAY[a]); return true; }
    NC.HUD.panel('bag', false); game.paused = false;
    go(game, { x: S.npc.x, y: S.npc.y + 90, name: 'ลุงโกโก้', near: () => nearShop(NC.game),
      then: () => { const g = NC.game; g.paused = NC.HUD.panel('bag', true); if (g.toast) g.toast('ถึงลุงโกโก้แล้ว · ' + COCO_SAY[a]); } });
    return true;
  });
  // the storage tab with nothing picked: where to put things in and take them out (Discord #133)
  NC.invStoreHint = function () {
    const far = !nearShop(NC.game);
    return '<div class="iv-empty"><b>คลังของลุงโกโก้</b><span>ฝาก: แท็บอุปกรณ์ → เลือกชิ้น → กด "ฝากคลัง"<br>เบิก: เลือกชิ้นในคลัง → กด "เบิกใส่กระเป๋า"<br>' +
      (far ? 'ทำได้เมื่อยืนใกล้ร้านลุงโกโก้ กลางค่าย' : 'ตอนนี้อยู่ที่ลุงโกโก้แล้ว ฝาก / เบิกได้เลย') + '</span>' +
      (far ? '<div class="iv-acts"><button class="iv-btn blue" data-act="wc:coco:go">เดินไปลุงโกโก้</button></div>' : '') + '</div>';
  };
  // the sell button says "กดอีกครั้ง" between its two presses (js/gearbag.js does the sale on the second)
  if (NC.invActs) NC.invActs.unshift((game, a) => {
    const m = /^gb:sell:(\d+)$/.exec(a || '');
    if (m) { const u = Number(m[1]); sellArmed = sellArmed.u === u && performance.now() - sellArmed.t < 3000 ? { u: 0, t: 0 } : { u, t: performance.now() }; }
    return false;
  });

  // ---------------- the bag's cells: better / worse than the worn piece ----------------
  const baseBadge = NC.invBadge;
  NC.invBadge = function (p, en) {
    const h = baseBadge ? baseBadge.apply(this, arguments) : '';
    if (!en || (en.kind !== 'item' && en.kind !== 'store') || en.worn || en.nojob || (en.kind === 'store' && !en.copy)) return h;
    const v = C.verdict(p, en.copy || en.id);
    if (v !== 'up' && v !== 'down') return h;
    return h + `<i class="wc-arw ${v}" title="${v === 'up' ? 'ดีกว่าที่ใส่อยู่' : 'แย่กว่าที่ใส่อยู่'}">${img(v === 'up' ? 'wc_bup' : 'wc_bdown')}</i>`;
  };
})();
