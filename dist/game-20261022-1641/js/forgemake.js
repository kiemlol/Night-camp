/* forgemake.js — the weapon crafting page made tidy (the user, 2026-10-17, on the old forge tab: "หน้านี้รกมากเลย เเก้ใหม่เลย";
   picked mockup A, assets/gen/nightcamp_forgemake_a_raw.png). The "ตีอาวุธ" station of the crafting window (js/craftgo.js);
   talking to ป๋าหมูหริ่ง opens that window too (js/forge.js sends its window there).
     top      the weapon types the hero's job holds, as icon tabs (each tab's icon = that type's grade-1 weapon), then
              "ทุกชนิด" (every type, the row scrolls sideways)
     left     the type's recipes (one per grade): icon, name, grade · Lv, a chip พร้อม / ขาด N
     right    the picked one: the weapon big on a spotlight, its name, grade, ATK, the level it needs, the jobs, the line
              about option rows; the material slots with have / need (a short one links to where it drops); one select for
              the option lock (was 22 chips); one big gold button (two clicks); after it, what came out with links to the
              bag and to refining that copy
   The data and the making are js/forge.js's (NC.Forge.craft / canMake / srcOf / recipes / makeTypes, js/forgecraft.js). */
(function () {
  'use strict';
  const NC = window.NC, ITEMS = NC.ITEMS, MAT = NC.MATERIALS;
  const F = NC.Forge, W = NC.GEAR;
  if (!F || !F.craft || !W) return;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = (n) => NC.fmtCoins(n);
  let type = null, pickId = null, all = false, lock = '', armed = { id: '', t: 0 }, made = null;

  const iconCache = new Map();
  // (a weapon shown big: its sharp HD copy, js/wpnhd.js; the key changes once the copy has loaded)
  const icon = (id, px) => { const H = px >= 256 && NC.WpnHD, k = id + ':' + px + (H ? H.tag(id, px) : ''); if (!iconCache.has(k)) { try { iconCache.set(k, (H ? H.big(id, px) : NC.itemIcon(id, px)).toDataURL()); } catch (e) { iconCache.set(k, ''); } } return iconCache.get(k); };
  const tname = (t) => (NC.WTYPES && NC.WTYPES[t] ? NC.WTYPES[t].name : t);
  const winfo = (it) => (it && (it.gs || it.sw || it.wc)) || {};
  const has = (p, id) => NC.matCount(p, id);
  // what a recipe still lacks: [material id or 'coins', have, need] for each short one
  function short(p, id) {
    const s = F.srcOf(id) || {}, out = [];
    if (s.shop) { if ((p.coins || 0) < s.shop) out.push(['coins', p.coins || 0, s.shop]); return out; }
    for (const m in s.craft || {}) if (has(p, m) < s.craft[m]) out.push([m, has(p, m), s.craft[m]]);
    if ((p.coins || 0) < (s.coins || 0)) out.push(['coins', p.coins || 0, s.coins]);
    return out;
  }

  function html(g, p, st) {
    const types = F.makeTypes(p, all), held = p.equip.weapon && NC.wtypeOf ? NC.wtypeOf(ITEMS[p.equip.weapon]) : null;
    if (!types.includes(type)) type = types.includes(held) ? held : types[0];
    const list = F.recipes(type) || [];
    if (!list.includes(pickId)) pickId = list[0] || null;
    let h = '<div class="fm">';
    // the types
    h += '<nav class="fm-types">' + types.map((t) => { const first = (F.recipes(t) || [])[0];
      return `<button class="fm-type${t === type ? ' on' : ''}" data-fmtype="${t}" title="${esc(tname(t))}">${first ? `<img src="${icon(first, 96)}" alt="">` : ''}<span>${esc(tname(t))}</span></button>`; }).join('') +
      `<button class="fm-type all${all ? ' on' : ''}" data-fmall="1"><img src="assets/craftgo/cg_weapon.png" alt=""><span>${all ? 'เฉพาะอาชีพ' : 'ทุกชนิด'}</span></button></nav>`;
    // the recipes
    h += '<div class="fm-list">' + (list.length ? list.map((id) => {
      const it = ITEMS[id], wi = winfo(it), miss = short(p, id), s = F.srcOf(id) || {};
      return `<button class="fm-row${id === pickId ? ' on' : ''}" data-fmpick="${id}"><img src="${icon(id, 128)}" alt=""><span><b>${esc(it.name)}</b>` +
        `<small>Lv ${it.lvReq || 1}</small></span>` + // (no tier "เกรด N" since 2026-10-20: เกรด is the polish grade, js/gradetier.js)
        `<em class="${miss.length ? 'no' : 'ok'}">${miss.length ? 'ขาด ' + miss.length : 'พร้อม'}</em></button>`;
    }).join('') : '<div class="fm-empty">ชนิดนี้ยังไม่มีสูตรให้ตี</div>') + '</div>';
    // the picked one
    if (!pickId) return h + '<div class="fm-detail"></div></div>';
    const it = ITEMS[pickId], wi = winfo(it), s = F.srcOf(pickId) || {}, R = NC.RARITY[it.rarity] || {}, miss = short(p, pickId);
    const jobs = Object.keys(NC.JOB_WEAPONS || {}).filter((j) => NC.JOB_WEAPONS[j].includes(type) && NC.JOBS[j]).map((j) => NC.JOBS[j].name);
    const lowLv = (p.lv || 1) < (it.lvReq || 1), kinds = F.kindsFor(it), stones = has(p, F.STONE.stone);
    if (lock && !kinds.includes(lock)) lock = '';
    h += '<div class="fm-detail"><div class="fm-head">' +
      `<div class="fm-spot" style="--rc:${R.color || '#ffd873'}"><img src="${icon(pickId, 256)}" alt=""></div><div class="fm-info">` +
        `<b class="fm-name">${esc(it.name)}</b><span class="fm-grade">${esc(wi.kind && NC.GS && NC.GS.KIND && NC.GS.KIND[wi.kind] ? NC.GS.KIND[wi.kind].th : (NC.RARITY[it.rarity] || NC.RARITY.common).name)}</span>` +
        `<span class="fm-atk">ATK ${wi.atk || (it.dmg ? Math.round((it.dmg[0] + it.dmg[1]) / 2) : '-')}</span>` +
        `<span class="fm-lv${lowLv ? ' no' : ''}">ต้อง Lv ${it.lvReq || 1}${lowLv ? ' (ตอนนี้ Lv ' + (p.lv || 1) + ')' : ''}</span>` +
        `<span class="fm-jobs">${jobs.length ? 'อาชีพ: ' + esc(jobs.join(', ')) : 'ทุกอาชีพ'}</span>` +
        `<small>${s.forge ? 'ดาบในตำนาน: ใช้ถ้วยรางวัลบอสครบ 5 อย่าง' : 'ตีเสร็จได้แถวออฟและเกรดขัดสุ่ม เหมือนของดรอป'}${it.gs && it.gs.text && it.gs.text !== '—' ? ' · ' + esc(it.gs.text) : ''}</small>` +
      '</div></div>';
    // the materials
    const mats = s.shop ? [] : Object.keys(s.craft || {});
    h += '<div class="fm-mats">' + mats.map((m) => {
      const hv = has(p, m), nd = s.craft[m], ok = hv >= nd, M = MAT[m] || { name: m };
      return `<div class="fm-mat ${ok ? 'ok' : 'no'}" data-cgtip="${m}"><span class="fm-slot"><img src="${NC.matIcon(m)}" alt=""></span><b>${esc(M.name)}</b>` +
        `<em>${fmt(hv)} / ${fmt(nd)}</em>${ok ? '' : '<a class="fm-where">หาที่ไหน?</a>'}</div>`;
    }).join('') +
      `<div class="fm-mat coin ${(p.coins || 0) >= (s.shop || s.coins || 0) ? 'ok' : 'no'}"><span class="fm-slot"><img src="${NC.matIcon('ic_coin')}" alt=""></span>` +
      `<b>${fmt(s.shop || s.coins || 0)}</b><em>${(p.coins || 0) >= (s.shop || s.coins || 0) ? 'เหรียญพอ' : 'เหรียญไม่พอ'}</em></div></div>`;
    // the lock, the button, what came out
    const isArmed = armed.id === pickId && performance.now() - armed.t < 3000;
    const why = !st.ok ? (st.why + (st.left ? ` · รออีก ${st.left} วิ` : '')) : miss.length ? `ยังขาด ${miss.length} อย่าง (กดช่องสีแดงเพื่อดูที่หา)` : lock && stones < 1 ? 'ล็อกออฟต้องใช้หินออฟ 1 ก้อน' : '';
    h += '<div class="fm-foot"><label class="fm-lock"><span>ล็อกออฟแถวแรก</span><select data-fmlock="1">' +
      `<option value="">ไม่ล็อก (สุ่ม)</option>` + kinds.map((k) => `<option value="${k}"${k === lock ? ' selected' : ''}>${esc(W.OPT[k].th)}</option>`).join('') +
      `</select><small>${lock ? `ใช้หินออฟเพิ่ม 1 ก้อน (มี ${stones})` : `ล็อกได้ด้วยหินออฟ 1 ก้อน (มี ${stones})`}</small></label>` +
      `<div class="fm-go"><button class="kw-btn gold fm-btn${isArmed ? ' armed' : ''}" data-fmgo="${pickId}"${why ? ' disabled' : ''}><img src="assets/refine/rf_hammer.png" alt="">` +
      `${isArmed ? 'กดอีกครั้งเพื่อตี!' : s.shop ? 'ซื้อ' : 'ตีอาวุธ'}</button><small class="${why ? 'bad' : ''}">${esc(why || 'กด 2 ครั้งเพื่อยืนยัน')}</small></div></div>`;
    if (made) {
      const c = W.bag(p).find((x) => x.u === made.u);
      if (c) h += `<div class="fm-made"><img src="${icon(c.id, 96)}" alt=""><span><b>ได้ ${esc(ITEMS[c.id].name)}!</b><small>ออฟ: ${esc(c.rows.map(NC.rowText).join(' · ') || 'ไม่มี')}</small></span>` +
        `<button class="kw-btn blue" data-fmbag="1">ดูในกระเป๋า</button><button class="kw-btn grey" data-act="cg:refine:${c.u}">ตีบวกเล่มนี้</button></div>`;
    }
    return h + '</div></div>';
  }

  // the clicks (craftgo.js draws the page again when this returns true)
  function click(b, g) {
    const D = b.dataset;
    if (D.fmtype) { type = D.fmtype; pickId = null; made = null; return true; }
    if (D.fmall) { all = !all; made = null; return true; }
    if (D.fmpick) { pickId = D.fmpick; made = null; armed.id = ''; return true; }
    if (D.fmbag) { NC.CraftGo.close(); g.paused = NC.HUD.panel('bag', true); return false; }
    if (D.fmgo) {
      if (!(NC.CraftGo && NC.CraftGo.ok(g)) && !F.near(g)) return true;
      if (armed.id !== D.fmgo || performance.now() - armed.t > 3000) { armed = { id: D.fmgo, t: performance.now() }; setTimeout(() => { if (armed.id === D.fmgo && performance.now() - armed.t >= 3000) { armed.id = ''; if (NC.CraftGo.isOpen()) NC.CraftGo.open('make'); } }, 3100); return true; }
      armed.id = '';
      const c = F.craft(g, D.fmgo, lock || null);
      if (c) made = { u: c.u };
      return true;
    }
    return false;
  }
  function change(t) { if (t && t.dataset && t.dataset.fmlock !== undefined) { lock = t.value; return true; } return false; }
  NC.ForgeMake = { html, click, change };
})();
