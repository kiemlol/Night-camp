/* statdetail.js — the status window's second tab "ค่าละเอียด" (2026-10-11; the user picked mockup A,
   assets/gen/nightcamp_sd_a_raw.png): every number the option rows, skills and base stats add up to, each with its
   ceiling. Four cards: โจมตี (pierce, crit damage, bosses, elements, lifesteal, SP steal, statuses the hits put on) ·
   สกิล (cast, after-cast delay, cooldown, SP cost, named skills) · ป้องกัน (damage taken, near / far, bosses, races) ·
   ต้านทาน (8 element rings, 9 status rings). A bar fills toward each cap, gold with "MAX" at it; a status made
   impossible by a "ไม่ติด X" row shows "กันได้". Pointing at a line tells where it comes from (gear rows / the rest).
   The numbers: js/gearopts.js (NC.GEAROPT.rowMods, the caps), js/hstatus.js (NC.HS.resOf), p.d.mods, the weapon's
   js/wabil.js specs. The tabs are put into js/statuswin.js's window from here (NC.HUD.init / NC.HUD.panel wrappers);
   the Stats tab is that file's page unchanged. Icons: assets/kui/sd_*.png (tools/sdicons_cut.py). Test: ?status, then
   the ค่าละเอียด tab, or ?status=detail. */
(function () {
  'use strict';
  const NC = window.NC;
  if (NC.ASSET_MANIFEST_SDICONS) Object.assign(NC.ASSET_MANIFEST, NC.ASSET_MANIFEST_SDICONS);
  const G = () => NC.game;
  const $ = (id) => document.getElementById(id);
  const icon = (k) => ((NC.ASSET_MANIFEST || {})[k] || {}).src || '';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const r1 = (v) => Math.round(v * 10) / 10;
  const n = (v) => (Number.isInteger(r1(v)) ? String(Math.round(v)) : r1(v).toFixed(1));
  const elTh = (el) => (NC.ELEMENT_INFO && NC.ELEMENT_INFO[el] ? NC.ELEMENT_INFO[el].th : el);
  const stTh = (s) => (NC.HS && NC.HS.ST[s] ? NC.HS.ST[s].th : s);
  const RES_ELS = ['water', 'earth', 'fire', 'wind', 'poison', 'shadow', 'ghost', 'undead'];
  const ST_IDS = ['stun', 'freeze', 'sleep', 'poison', 'bleed', 'burn', 'silence', 'blind', 'slow'];
  const INFLICT = { burn: 'เผา', chill: 'เย็นเฉียบ', shock: 'ช็อต', crack: 'ร้าว', curse: 'คำสาป', poison: 'พิษ', bleed: 'เลือดไหล' };
  const INFLICT_IC = { burn: 'hs_burn', chill: 'hs_freeze', shock: 'hs_stun', crack: 'hs_slow', curse: 'hs_silence', poison: 'hs_poison', bleed: 'hs_bleed' };
  const DEFAULT_INFO = 'หลอดวิ่งไปหาเพดานของแต่ละค่า · นับรวมออฟจากของ สกิล และสเตตัสพื้นฐาน · ชี้ที่แถวเพื่อดูว่ามาจากไหน';

  // ---------------- the numbers ----------------
  function numbers(p) {
    const d = p.d || {}, m = d.mods || {}, gear = NC.GEAROPT ? NC.GEAROPT.rowMods(p) : {};
    const fx = NC.weaponEffects ? NC.weaponEffects(p) : [];
    const sum = (f) => fx.filter(f).reduce((s, a) => s + (a.pct || a.chance || 0), 0);
    const best = (prefix) => Object.keys(m).filter((k) => k.startsWith(prefix) && m[k] > 0).map((k) => [k.slice(prefix.length), m[k]]).sort((a, b) => b[1] - a[1]);
    return { d, m, gear, fx, sum, best };
  }
  const src = (N, key, unit) => {
    const all = N.m[key] || 0, g = N.gear[key] || 0, o = all - g;
    if (!all) return 'ยังไม่มี · ได้จากออฟของ สกิลติดตัว หรือบัฟ';
    return [g ? `ออฟจากของ ${n(g)}${unit || '%'}` : '', o ? `สกิล เซ็ต และบัฟ ${n(o)}${unit || '%'}` : ''].filter(Boolean).join(' · ');
  };

  // a line: [key, icon, label, value text, cap (0: no bar), fill value, where it comes from]
  function attackLines(N) {
    const { m, d, fx } = N;
    const els = Object.entries(d.elDmg || {}).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    const leech = Math.min(100, N.sum((a) => a.t === 'leech'));
    const st = fx.filter((a) => a.t === 'status');
    return [
      ['pen', 'sd_pen', 'เจาะเกราะ', `${n(m.pen || 0)}%`, 50, m.pen || 0, 'ไม่นับ DEF ของมอนบางส่วน (ทั้ง % และที่หักตรง) · ' + src(N, 'pen')],
      ['mpen', 'sd_mpen', 'เจาะเวท', `${n(m.mpen || 0)}%`, 50, m.mpen || 0, 'ไม่นับ MDEF ของมอนบางส่วน · ' + src(N, 'mpen')],
      ['critDmg', 'sd_crit', 'ดาเมจคริติคอล', `+${n(m.critDmg || 0)}%`, 100, m.critDmg || 0, 'คริติคอลแรงขึ้น · ' + src(N, 'critDmg')],
      ['bossDmg', 'sd_boss', 'แรงกับบอส', `+${n(m.bossDmg || 0)}%`, 0, 0, 'ตีบอสแรงขึ้น · ' + src(N, 'bossDmg')],
      ['elDmg', els.length ? 'el_' + els[0][0] : 'st_bonus', 'ตีธาตุแรงขึ้น', els.length ? els.slice(0, 2).map(([e, v]) => `${elTh(e)} +${n(v)}%`).join(' · ') : '—', 0, 0,
        els.length ? 'ตีด้วยธาตุนั้นแรงขึ้น: ' + els.map(([e, v]) => `${elTh(e)} +${n(v)}%`).join(' · ') : 'ยังไม่มี · ได้จากออฟ "ธาตุแรงขึ้น" และสกิลธาตุ'],
      ['leech', 'sd_leech', 'ดูดเลือด', `${n(leech)}%`, 10, leech, 'ตีธรรมดาแล้วได้ HP คืนตามดาเมจ · จากออฟและความสามารถของอาวุธ'],
      ['spLeech', 'sd_spleech', 'ดูด SP', `${n(m.spLeech || 0)}%`, 10, m.spLeech || 0, 'ตีธรรมดาแล้วได้ SP คืนตามดาเมจ · ' + src(N, 'spLeech')],
      ['inflict', st.length ? INFLICT_IC[st[0].st] || 'sd_inflict' : 'sd_inflict', 'ตีติดสถานะ', st.length ? st.slice(0, 2).map((a) => `${INFLICT[a.st] || a.st} ${n(a.chance)}%`).join(' · ') : '—', 0, 0,
        st.length ? 'ตีธรรมดามีโอกาสทำให้มอนติดสถานะ: ' + st.map((a) => `${INFLICT[a.st] || a.st} ${n(a.chance)}%`).join(' · ') : 'ยังไม่มี · ได้จากออฟ "ตีติดสถานะ" และความสามารถของอาวุธ'],
    ];
  }
  function skillLines(N) {
    const { m, d } = N;
    const cdr = Math.round((d.cdr || 0) * 100), sp = Math.round((1 - (d.spCostK || 1)) * 100);
    const sk = N.best('sk_');
    return [
      ['cast', 'sd_cast', 'ร่ายเร็วขึ้น', `−${n(Math.min(70, m.cast || 0))}%`, 70, m.cast || 0, 'เวลาร่ายสั้นลง (นอกจาก DEX) · ' + src(N, 'cast')],
      ['acd', 'sd_acd', 'ดีเลย์หลังร่าย', `−${n(Math.min(50, m.acd || 0))}%`, 50, m.acd || 0, 'ใช้สกิลถัดไปได้เร็วขึ้น · ' + src(N, 'acd')],
      ['cdr', 'sd_cdr', 'คูลดาวน์', `−${cdr}%`, 60, cdr, 'คูลดาวน์สกิลสั้นลง · ' + src(N, 'cdr')],
      ['spCost', 'sd_spcost', 'ใช้ SP น้อยลง', `−${sp}%`, 70, sp, 'สกิลกิน SP น้อยลง · ' + src(N, 'spCost')],
      ['skill', 'sd_skill', 'สกิลแรงขึ้น', sk.length ? sk.slice(0, 2).map(([id, v]) => `${NC.SKILLS[id] ? NC.SKILLS[id].name : id} +${n(v)}%`).join(' · ') : '—', 0, 0,
        sk.length ? 'สกิลที่ระบุชื่อแรงขึ้น: ' + sk.map(([id, v]) => `${NC.SKILLS[id] ? NC.SKILLS[id].name : id} +${n(v)}%`).join(' · ') : 'ยังไม่มี · ได้จากออฟ "สกิล" บนอาวุธ (สกิลของอาชีพที่ใช้อาวุธชนิดนั้น)'],
    ];
  }
  function defenseLines(N) {
    const { m, d } = N, races = N.best('rrace_'), R = NC.RACES || {};
    return [
      ['taken', 'sd_taken', 'รับดาเมจ', `−${n(d.taken || 0)}%`, 80, d.taken || 0, 'ดาเมจที่รับลดลงทุกชนิด · จากสกิลติดตัวและบัฟ'],
      ['rmelee', 'sd_melee', 'ดาเมจประชิด', `−${n(Math.min(40, m.rmelee || 0))}%`, 40, m.rmelee || 0, 'มอนตีระยะใกล้ · ' + src(N, 'rmelee')],
      ['rrange', 'sd_range', 'ดาเมจระยะไกล', `−${n(Math.min(40, m.rrange || 0))}%`, 40, m.rrange || 0, 'มอนยิงหรือร่ายจากไกล · ' + src(N, 'rrange')],
      ['rboss', 'sd_rboss', 'ดาเมจจากบอส', `−${n(Math.min(30, m.rboss || 0))}%`, 30, m.rboss || 0, 'ทุกท่าของบอส · ' + src(N, 'rboss')],
      ['rrace', 'sd_rrace', races.length ? `ดาเมจจากเผ่า${R[races[0][0]] || ''}` : 'ดาเมจจากเผ่า', `−${n(Math.min(40, races.length ? races[0][1] : 0))}%`, 40, races.length ? races[0][1] : 0,
        races.length ? 'รับดาเมจจากเผ่านั้นลดลง: ' + races.map(([r, v]) => `${R[r] || r} −${n(Math.min(40, v))}%`).join(' · ') : 'ยังไม่มี · ได้จากออฟ "ต้านเผ่า" บนชุดและเครื่องประดับ'],
    ];
  }

  // ---------------- drawing ----------------
  function bar(v, cap) {
    if (!cap) return '<span class="sd-bar none"></span>';
    const f = Math.max(0, Math.min(1, v / cap)), full = v >= cap;
    return `<span class="sd-bar${full ? ' max' : ''}"><i style="width:${(f * 100).toFixed(1)}%"></i></span>${full ? '<b class="sd-max">MAX</b>' : ''}`;
  }
  function line([key, ic, label, val, cap, v, why], tall) {
    const [main, rest] = cap ? [val, ` / ${cap}%`] : [val, ''];
    return `<div class="sd-row${tall ? ' tall' : ''}" data-sd="${key}" data-why="${esc(label + ' — ' + why)}"><img src="${icon(ic)}" alt="">` +
      `<span class="sd-l"><span>${esc(label)}</span><i></i></span><span class="sd-v">${esc(main)}<small>${rest}</small></span>${bar(v, cap)}</div>`;
  }
  function card(cls, ic, title, lines, tall) {
    return `<section class="sd-card ${cls}"><header class="sd-head"><img src="${icon(ic)}" alt=""><span>${title}</span></header>` +
      `<div class="sd-rows">${lines.map((L) => line(L, tall)).join('')}</div></section>`;
  }
  function ring(ic, label, v, cap, tag, why) {
    const f = Math.max(0, Math.min(1, v / cap)), full = v >= cap || tag;
    return `<div class="sd-res" data-why="${esc(why)}"><span class="sd-ring${full ? ' max' : ''}" style="--f:${(f * 100).toFixed(1)}%"><img src="${icon(ic)}" alt="">` +
      `${tag ? `<b class="sd-tag imm">${tag}</b>` : full ? '<b class="sd-tag">MAX</b>' : ''}</span>` +
      `<span class="sd-rl">${esc(label)}</span><span class="sd-rv">${Math.round(v)}%<small> / ${cap}%</small></span></div>`;
  }
  function render() {
    const page = $('sd-page'), p = G() && G().player;
    if (!page || page.hidden || !p || !p.d) return;
    const N = numbers(p);
    const elRes = RES_ELS.map((el) => {
      const row = Math.min(50, N.m['rel_' + el] || 0), spec = N.sum((a) => a.t === 'resist' && a.el === el);
      const why = `ต้านธาตุ${elTh(el)} — รับดาเมจจากมอนธาตุ${elTh(el)}ลดลง (ทุกท่า รวมท่าบอส)` + (row ? ` · ออฟ ${n(row)}%` : '') + (spec ? ` · ความสามารถของอาวุธ/เซ็ต ${n(spec)}%` : '') + (!row && !spec ? ' · ได้จากออฟ "ต้านธาตุ" บนชุด หมวก เครื่องประดับ' : '');
      return ring('el_' + el, elTh(el), Math.min(50, row + spec), 50, '', why);
    }).join('');
    const stRes = ST_IDS.map((id) => {
      const imm = !!N.m['imm_' + id], v = NC.HS ? NC.HS.resOf(p, id) : 0, gear = N.gear['res_' + id] || 0, D = NC.HS && NC.HS.ST[id];
      const by = D ? { vit: 'VIT', int: 'INT', agi: 'AGI', mdef: 'MDEF และ INT' }[D.by] : '';
      const why = `ต้าน${stTh(id)} — ${D ? D.what : ''}` + (imm ? ' · มีออฟ "ไม่ติด" กันได้ทุกครั้ง' : ` · จาก ${by} และ LUK${gear ? ` · ออฟจากของ ${n(gear)}%` : ''} · สูงสุด 80%`);
      return ring('hs_' + id, stTh(id), imm ? 80 : v, 80, imm ? 'กันได้' : '', why);
    }).join('');
    page.innerHTML = '<div class="sd-grid">' +
      card('atk', 'sd_hdr_atk', 'โจมตี', attackLines(N), true) +
      '<div class="sd-col">' + card('skl', 'sd_hdr_skill', 'สกิล', skillLines(N)) + card('def', 'sd_hdr_def', 'ป้องกัน', defenseLines(N)) + '</div>' +
      '<section class="sd-card res"><header class="sd-head"><img src="' + icon('sd_hdr_def') + '" alt=""><span>ต้านทาน</span></header>' +
        `<div class="sd-rrow"><b class="sd-rh">ต้านธาตุ</b><div class="sd-rings">${elRes}</div></div>` +
        `<div class="sd-rrow"><b class="sd-rh">ต้านสถานะ</b><div class="sd-rings">${stRes}</div></div></section>` +
      '</div>' + `<div class="kw-info sd-info"><span class="i">i</span><span id="sd-info">${esc(hint || DEFAULT_INFO)}</span></div>`;
  }
  let hint = '';

  // ---------------- the tabs inside js/statuswin.js's window ----------------
  let tab = 'stats', timer = 0;
  function setTab(t) {
    tab = t;
    const win = $('statwin');
    if (!win) return;
    win.querySelectorAll('[data-swt]').forEach((b) => b.classList.toggle('on', b.dataset.swt === tab));
    const det = tab === 'detail';
    for (const sel of ['.sw-top', '.sw-cards', '.sw-info']) { const el = win.querySelector(sel); if (el) el.hidden = det; }
    $('sd-page').hidden = !det;
    hint = '';
    if (det) render();
    fit();
    clearInterval(timer);
    if (det) timer = setInterval(() => { if (win.hidden || tab !== 'detail') { clearInterval(timer); return; } render(); }, 1000);
  }
  function fit() { // (as statuswin.js: the window scaled down to fit the screen, never up)
    const wrap = document.querySelector('#statwin .sw-wrap');
    if (!wrap) return;
    wrap.style.transform = 'translate(-50%, -50%)';
    const k = Math.min(1, (innerWidth - 16) / wrap.offsetWidth, (innerHeight - 16) / wrap.offsetHeight);
    if (k < 1) wrap.style.transform = `translate(-50%, -50%) scale(${k.toFixed(4)})`;
  }
  const baseInit = NC.HUD.init.bind(NC.HUD);
  NC.HUD.init = function (game) {
    baseInit(game);
    const win = $('statwin'), head = win && win.querySelector('.sw-win > .kw-title');
    if (!head) return;
    const nav = document.createElement('nav');
    nav.className = 'kw-tabs sw-tabs';
    nav.innerHTML = '<button class="kw-tab on" data-swt="stats">สเตตัส</button><button class="kw-tab" data-swt="detail">ค่าละเอียด</button>';
    head.after(nav);
    const page = document.createElement('div');
    page.id = 'sd-page'; page.hidden = true;
    win.querySelector('.sw-win').appendChild(page);
    nav.addEventListener('click', (e) => { const b = e.target.closest('[data-swt]'); if (b && b.dataset.swt !== tab) setTab(b.dataset.swt); });
    page.addEventListener('mouseover', (e) => {
      const r = e.target.closest('[data-why]');
      const t = r ? r.dataset.why : '';
      if (t === hint) return;
      hint = t;
      const el = $('sd-info');
      if (el) el.textContent = t || DEFAULT_INFO;
    });
    page.addEventListener('mouseleave', () => { hint = ''; const el = $('sd-info'); if (el) el.textContent = DEFAULT_INFO; });
    addEventListener('resize', () => setTimeout(() => { if (!win.hidden && tab === 'detail') fit(); }, 30));
  };
  const basePanel = NC.HUD.panel.bind(NC.HUD);
  NC.HUD.panel = function (id, show) {
    const on = basePanel(id, show);
    if (id === 'status' && on) setTab(tab);
    return on;
  };
  NC.StatDetail = { render, setTab };
})();
