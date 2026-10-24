/* mapdrops.js — มอน & ดรอป: what a map's monsters drop, the MMO way (the user, 2026-10-17: "ทำระบบดูของดรอปด้วยเหมือนเกม mmo
   อื่นที่กด ดูแมพแล้ว มีตารางมอนแล้วดูว่าแมพนี้ดรอปอะไรบ้าง อย่าลืมว่าปุ่มห้ามบอด"; picked mockup C, the whole map as one
   table, assets/gen/nightcamp_mapdrops_c_raw.png, and "see everything": names, pictures and rates, found or not).
     where     a folder tab "มอน & ดรอป" in the map window (M), and a button on the map card (ดูมอน & ของดรอปทั้งแมพ)
     the strip the region's maps (and the dungeon floors under the picked one) as picture buttons: pick a map
     the table one row per monster of the map (portrait, name, element, its level here, kills), its drops across the row:
               materials (js/materials.js NC.MAT_DROPS: chance and how many), gear (js/loot.js's table: a row drops only
               when the monster's level here reaches the item's Lv − 5, like the real roll), the boss's rows (bosses);
               a slot not found yet carries a small "ยังไม่มี"; the boss row last with a gold rim
     filters   ทั้งหมด · วัสดุ · อาวุธ · ชุด · หมวก · บอส, and a search over the map's drops ("ค้นทุกแมพ" when nothing here)
     a slot    a dark card: name, rarity, kind, Lv, ATK / DEF, the level it starts dropping at; links: ในสมุดสะสม (gear) /
               ถุงวัสดุ (materials), and "ใครดรอปอีกบ้าง" (every other monster and map that drops it, each a link)
     a row     its own buttons: พาไป (walks there: NC.Travel; on this map, to the nearest one), ให้บอทล่า (the auto farm on
               that species only, js/journey.js's farm), สมุดมอน (js/p3_jbook.js's page); the bottom bar does the same for
               the picked row
   Rates per kill, only the hero's own kills drop (js/loot.js); every monster also drops potions (js/potions.js).
   Hooks: NC.HUD.init (the tab, the view), the map card (NC.MapWin in js/mapwin.js). Test: ?mapdrops (opens it). */
(function () {
  'use strict';
  const NC = window.NC, ITEMS = NC.ITEMS, MAT = NC.MATERIALS || {}, D = NC.LOOT_DATA || { species: {}, bosses: {}, top: {} };
  const $ = (id) => document.getElementById(id);
  const G = () => NC.game;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const icon = (k) => ((NC.ASSET_MANIFEST || {})[k] || {}).src || '';
  const spr = (k) => { const S = NC.SPR && NC.SPR[k]; return (S && S.img && S.img.src) || icon(k); };
  const MW = () => NC.MapWin;
  const IC = { go: 'assets/mapdrops/md_go.png', bot: 'assets/mapdrops/md_bot.png', book: 'assets/mapdrops/md_book.png', find: 'assets/mapdrops/md_find.png', info: 'assets/mapdrops/md_info.png' };

  let on = false, mapId = null, filt = 'all', q = '', pick = null, tip = null, view = null; // tip: { id, sp }
  const PER = 8, open = new Set(); // (a row shows 8 slots; "+N" opens the rest)
  const iconCache = new Map();
  const itemIcon = (id) => { if (!iconCache.has(id)) { try { iconCache.set(id, NC.itemIcon(id, 96).toDataURL()); } catch (e) { iconCache.set(id, ''); } } return iconCache.get(id); };
  const pct = (x) => (x >= 10 ? Math.round(x) + '%' : x >= 1 ? (Math.round(x * 10) / 10) + '%' : (+x.toFixed(3)) + '%');

  // ---------------- what a monster drops on a map ----------------
  const kindOf = (id) => {
    if (MAT[id] && !ITEMS[id]) return 'mat';
    const it = ITEMS[id] || {};
    return it.slot === 'weapon' || it.slot === 'shield' ? 'weapon' : it.slot === 'hat' || it.slot === 'glasses' ? 'hat' : 'outfit';
  };
  const ready = (id) => ITEMS[id] && (!NC.itemReady || NC.itemReady(id));
  function dropsOf(sp, m) {
    const out = [], hi = (m.lv && m.lv[1]) || 1, top = D.top[sp] || 99;
    for (const d of (NC.MAT_DROPS || {})[sp] || []) {
      if (!MAT[d[0]]) continue;
      out.push({ id: d[0], kind: 'mat', pct: d[1] * 100, n: d[2] ? (d[3] && d[3] !== d[2] ? `×${d[2]}–${d[3]}` : `×${d[2]}`) : '' });
    }
    for (const [id, p] of D.species[sp] || []) {
      if (!ready(id)) continue;
      const from = Math.min((ITEMS[id].lvReq || 1) - 5, top);
      if (hi >= from) out.push({ id, kind: kindOf(id), pct: p, from });
    }
    if (m.boss) for (const [id, p] of D.bosses[sp] || []) if (ready(id)) out.push({ id, kind: kindOf(id), pct: p, boss: true });
    return out.sort((a, b) => ((a.kind === 'mat') === (b.kind === 'mat') ? b.pct - a.pct : a.kind === 'mat' ? -1 : 1));
  }
  const found = (id) => { const p = G() && G().player; if (ITEMS[id]) return !!(NC.Book && NC.Book.found && NC.Book.found(id)) || !!(p && p.owned && p.owned.has(id)); return !!(p && p.matSeen && p.matSeen.has(id)); };
  const kills = (sp) => (NC.Book && NC.Book.book && NC.Book.book.kills && NC.Book.book.kills[sp]) || 0;
  const nameOf = (id) => (ITEMS[id] ? ITEMS[id].name : (MAT[id] || {}).name || id);
  const imgOf = (id) => (ITEMS[id] ? itemIcon(id) : (NC.matIcon && NC.matIcon(id)) || '');
  const rarOf = (id) => (ITEMS[id] ? ITEMS[id].rarity : MAT[id] && MAT[id].rare ? 'rare' : 'common');
  // every monster (and map) in the world that drops an item: for "ใครดรอปอีกบ้าง"
  function whoDrops(id) {
    const out = [];
    for (const mid in NC.MAPS) {
      const M = NC.MAPS[mid];
      if (!M || !NC.mapInfo) continue;
      let I; try { I = NC.mapInfo(mid); } catch (e) { continue; }
      for (const [sp, m] of I.mons) if (dropsOf(sp, m).some((d) => d.id === id)) out.push({ sp, map: mid });
    }
    return out;
  }

  // ---------------- the maps in the strip ----------------
  function stripMaps() {
    const W = MW(), reg = W.regOf(mapId), PIN = W.pins(), root = W.rootOf(mapId);
    const list = Object.keys(PIN).filter((id) => NC.MAPS[id] && W.regOf(id) === reg);
    const floors = Object.keys(NC.MAPS).filter((k) => NC.MAPS[k].parent === root);
    const all = list.concat(floors.filter((f) => !list.includes(f)));
    if (!all.includes(mapId)) all.unshift(mapId);
    return all;
  }
  const thumb = (id) => ((NC.WMREAL_FILES || {})[id] ? `assets/wmreal/${id}.jpg?v=${NC.WMREAL_FILES[id]}` : '');

  // ---------------- building ----------------
  function build() {
    const body = document.querySelector('#mapwin .mw-body'), tabs = $('mw-tabs');
    if (!body || !tabs) return false;
    const where = $('mw-where'), btn = document.createElement('button');
    btn.className = 'kw-tab md-tab'; btn.dataset.md = '1'; btn.textContent = 'มอน & ดรอป';
    tabs.insertBefore(btn, where || null);
    view = document.createElement('div');
    view.className = 'md-view'; view.id = 'md-view'; view.hidden = true;
    body.appendChild(view);
    tabs.addEventListener('click', (e) => {
      if (e.target.closest('[data-md]')) { e.stopPropagation(); show(true); return; }
      if (e.target.closest('[data-t], [data-r]')) show(false);
    }, true);
    view.addEventListener('click', onClick);
    view.addEventListener('input', (e) => { if (e.target.id === 'md-q') { q = e.target.value.trim(); tip = null; drawTable(); } });
    // the map card: a way here
    const card = $('mw-card');
    if (card) new MutationObserver(() => cardButton()).observe(card, { childList: true });
    return true;
  }
  function cardButton() {
    const card = $('mw-card'), W = MW();
    if (!card || card.querySelector('.md-cardbtn') || !W) return;
    const id = W.sel();
    if (!id || !NC.mapInfo || !NC.mapInfo(id).mons.size) return;
    const at = card.querySelector('.mw-route, .mw-go') || card.querySelector('.mw-cbody');
    const b = document.createElement('button');
    b.className = 'kw-btn gold md-cardbtn'; b.textContent = 'ดูมอน & ของดรอปทั้งแมพ';
    b.addEventListener('click', () => { mapId = id; show(true); });
    if (at && at.classList.contains('mw-cbody')) at.appendChild(b); else if (at) at.parentNode.insertBefore(b, at); else card.appendChild(b);
  }
  function show(v) {
    on = v;
    const win = $('mapwin');
    if (!win || !view) return;
    win.classList.toggle('md-on', on);
    view.hidden = !on;
    win.querySelector('.md-tab').classList.toggle('on', on);
    if (on) {
      win.querySelectorAll('#mw-tabs [data-t], #mw-tabs [data-r]').forEach((b) => b.classList.remove('on'));
      mapId = mapId && NC.MAPS[mapId] ? mapId : (MW().sel() || G().mapId);
      tip = null; render();
    } else { tip = null; }
  }

  // ---------------- drawing ----------------
  const FILTERS = [['all', 'ทั้งหมด'], ['mat', 'วัสดุ'], ['weapon', 'อาวุธ'], ['outfit', 'ชุด'], ['hat', 'หมวก'], ['boss', 'บอส']];
  function rowsOf() {
    const I = NC.mapInfo(mapId);
    return [...I.mons].sort((a, b) => (!!a[1].boss - !!b[1].boss) || b[1].w - a[1].w).map(([sp, m]) => ({ sp, m, drops: dropsOf(sp, m) }));
  }
  function render() {
    if (!on || !view) return;
    const g = G(), p = g.player, M = NC.MAPS[mapId] || {}, I = NC.mapInfo(mapId);
    const fitOf = (id) => { const L = (NC.mapInfo(id) || {}).lv; return L ? (p.lv < L[0] - 3 ? 'hard' : p.lv > L[1] + 8 ? 'easy' : 'fit') : 'fit'; };
    const FIT = { fit: 'เหมาะกับเรา', hard: 'ยังยากไป', easy: 'ง่ายไป' };
    const strip = stripMaps().map((id) => {
      const N = NC.MAPS[id], t = thumb(id), lv = String(N.lvText || '').split(' · ')[0], here = id === g.mapId ? '<em>อยู่ที่นี่</em>' : '';
      const pic = `<span class="md-mpic"${t ? ` style="background-image:url(${t})"` : ''}>${here}</span>`;
      if (id !== mapId) return `<button class="md-map" data-mdmap="${id}" title="${esc(N.name)} · ${esc(lv)}">${pic}</button>`;
      const f = fitOf(id);
      return `<button class="md-map on" data-mdmap="${id}">${pic}<span class="md-minfo"><b>${esc(N.name)}</b><small>${esc(lv)}</small><i class="md-fit ${f}">${FIT[f]}</i></span></button>`;
    }).join('<span class="md-dots"><i></i><i></i><i></i></span>');
    view.innerHTML = `<div class="md-strip">${strip}</div>` +
      `<div class="md-bar"><div class="md-chips">${FILTERS.map(([k, t]) => `<button class="md-chip${filt === k ? ' on' : ''}" data-mdf="${k}">${t}</button>`).join('')}</div>` +
      `<label class="md-search"><img src="${IC.find}" alt=""><input id="md-q" type="search" placeholder="ค้นของในแมพนี้" value="${esc(q)}"></label></div>` +
      '<div class="md-table kw-scroll" id="md-table"></div>' +
      '<div class="md-foot"><span class="md-note" id="md-note"></span><div class="md-acts" id="md-acts"></div></div>';
    const cur = view.querySelector('.md-map.on'), st = view.querySelector('.md-strip'); // (the picked map in view)
    if (cur && st) st.scrollLeft = Math.max(0, cur.offsetLeft - (st.clientWidth - cur.offsetWidth) / 2);
    if (st) st.onwheel = (e) => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { st.scrollLeft += e.deltaY; e.preventDefault(); } }; // (the wheel rolls the strip sideways)
    drawTable();
  }
  function drawTable() {
    const box = $('md-table');
    if (!box) return;
    const g = G(), rows = rowsOf(), ql = q.toLowerCase();
    if (!rows.some((r) => r.sp === pick)) pick = (rows.find((r) => !r.m.boss) || rows[0] || {}).sp || null;
    let h = '', shown = 0, firstShown = null, pickShown = false;
    for (const r of rows) {
      if (filt === 'boss' && !r.m.boss) continue;
      const list = r.drops.filter((d) => (filt === 'all' || filt === 'boss' || d.kind === filt) && (!ql || nameOf(d.id).toLowerCase().includes(ql)));
      if ((filt !== 'all' && filt !== 'boss' || ql) && !list.length) continue;
      shown++;
      if (!firstShown) firstShown = r.sp;
      if (r.sp === pick) pickShown = true;
      const S = NC.MONSTERS[r.sp] || {}, E = (NC.ELEMENT_INFO || {})[S.element || 'neutral'] || {}, lv = r.m.lv ? (r.m.lv[0] === r.m.lv[1] ? `Lv ${r.m.lv[0]}` : `Lv ${r.m.lv[0]}–${r.m.lv[1]}`) : '';
      h += `<div class="md-row${r.m.boss ? ' boss' : ''}${r.sp === pick ? ' on' : ''}" data-mdrow="${r.sp}">` +
        `<div class="md-mon"><span class="md-pic"><img src="${spr(r.sp)}" alt="" onerror="this.style.visibility='hidden'"></span><span class="md-mt"><b>${esc(S.name || r.sp)}</b>` +
        `<small>${r.m.boss ? '<em class="md-boss"><img src="assets/kui/ic_crown.png" alt="">บอส</em>' : `<img class="md-el" src="${icon('el_' + (S.element || 'neutral'))}" alt="" title="ธาตุ${esc(E.th || '')}">`}${esc(lv)}</small><small class="md-k">ฆ่าแล้ว ${kills(r.sp).toLocaleString('en-US')}</small></span></div>` +
        '<div class="md-drops' + (open.has(r.sp) ? ' open' : '') + '">' + (list.length ? (open.has(r.sp) || list.length <= PER ? list : list.slice(0, PER - 1)).map((d) => {
          const f = found(d.id);
          return `<button class="md-slot r-${esc(rarOf(d.id))}${tip && tip.id === d.id && tip.sp === r.sp ? ' sel' : ''}" data-mdtip="${d.id}" data-mdsp="${r.sp}">` +
            `<img src="${imgOf(d.id)}" alt="">${f ? '<i class="md-got" title="เคยได้แล้ว">✓</i>' : ''}<b>${esc(nameOf(d.id))}</b><em>${pct(d.pct)}${d.n ? ' ' + d.n : ''}</em></button>`;
        }).join('') + (!open.has(r.sp) && list.length > PER ? `<button class="md-slot md-more" data-mdmore="${r.sp}"><b>+${list.length - PER + 1}</b><em>ดูทั้งหมด</em></button>`
          : open.has(r.sp) && list.length > PER ? `<button class="md-slot md-more" data-mdless="${r.sp}"><b>ย่อ</b><em>แถวเดียว</em></button>` : '') : '<span class="md-none">ไม่มีของดรอป</span>') + '</div>' +
        `<div class="md-rowacts"><button class="md-ib go" data-mdgo="${r.sp}" title="พาไปหา${esc(S.name || '')}"><img src="${IC.go}" alt=""></button>` +
        `<button class="md-ib bot" data-mdbot="${r.sp}" title="ให้บอทล่าตัวนี้"><img src="${IC.bot}" alt=""></button>` +
        `<button class="md-ib book" data-mdbook="${r.sp}" title="สมุดมอน"><img src="${IC.book}" alt=""></button></div></div>`;
    }
    const FT = { mat: 'วัสดุ', weapon: 'อาวุธ', outfit: 'ชุด', hat: 'หมวก' };
    if (!shown) h = `<div class="md-empty"><b>${q ? `ไม่มี "${esc(q)}" ในแมพนี้` : filt === 'boss' ? 'แมพนี้ไม่มีบอส' : `แมพนี้ไม่ดรอป${FT[filt] || 'ของแบบนี้'}`}</b>` +
      (filt === 'boss' && !q ? '<button class="kw-btn gold" data-mdbossmaps="1">ดูแมพที่มีบอส</button>' : '') +
      (q ? '<button class="kw-btn gold" data-mdall="1">ค้นทุกแมพ</button>' : '') + '<button class="kw-btn grey" data-mdclear="1">ดูทั้งหมด</button></div>';
    box.innerHTML = h;
    if (!pickShown && firstShown) { pick = firstShown; const r0 = box.querySelector(`[data-mdrow="${pick}"]`); if (r0) r0.classList.add('on'); } // (the bottom bar follows what the filter shows)
    drawFoot(); drawTip();
    if (!shown) $('md-acts').innerHTML = ''; // (nothing listed: the empty card's own buttons lead on)
  }
  function drawFoot() {
    const I = NC.mapInfo(mapId), S = NC.MONSTERS[pick] || {};
    $('md-note').innerHTML = `<img src="${IC.info}" alt=""><span>อัตราต่อการฆ่า 1 ตัว · ของดรอปเฉพาะตัวที่เราฆ่าเอง<small>ทุกตัวดรอปยาแดง 3% ยาฟ้า 1.5%${I.lv && I.lv[1] >= 90 ? ' · มอน Lv 90+ มีโอกาส 0.002% ได้ของในตำนาน' : ''}</small></span>`;
    $('md-acts').innerHTML = pick ? `<button class="kw-btn gold" data-mdgo="${pick}" title="พาไปหา${esc(S.name || '')}"><img src="${IC.go}" alt="">พาไปที่นั่น</button>` +
      `<button class="kw-btn blue" data-mdbot="${pick}"><img src="${IC.bot}" alt="">ให้บอทล่าตัวนี้</button>` +
      `<button class="kw-btn grey" data-mdbook="${pick}"><img src="${IC.book}" alt="">สมุดมอน</button>` : '';
  }
  // the slot's card
  function drawTip() {
    const old = view && view.querySelector('.md-tipc');
    if (old) old.remove();
    if (!tip) return;
    const at = view.querySelector(`[data-mdtip="${tip.id}"][data-mdsp="${tip.sp}"]`);
    if (!at) { tip = null; return; }
    const id = tip.id, it = ITEMS[id], R = NC.RARITY[rarOf(id)] || NC.RARITY.common, f = found(id);
    const row = rowsOf().find((r) => r.sp === tip.sp), d = row && row.drops.find((x) => x.id === id);
    let stats = '';
    if (it) {
      const w = it.gs || it.sw || it.wc || {}, atk = w.atk || (it.dmg ? Math.round((it.dmg[0] + it.dmg[1]) / 2) : 0);
      stats = [atk ? `ATK ${atk}` : '', it.def ? `DEF ${it.def}` : '', it.mdef ? `MDEF ${it.mdef}` : ''].filter(Boolean).join(' · ');
    }
    const kind = it ? (it.slot === 'weapon' ? (((NC.WTYPES || {})[NC.wtypeOf ? NC.wtypeOf(it) : ''] || {}).name || 'อาวุธ') : (NC.SLOT_NAME || {})[it.slot] || 'เครื่องประดับ') : ((MAT[id] || {}).kindTh || 'วัสดุ');
    const who = tip.who ? tip.who.filter((w) => !(w.sp === tip.sp && w.map === mapId)) : null;
    const el = document.createElement('div');
    el.className = 'md-tipc kw-card';
    el.innerHTML = `<div class="md-th"><img src="${imgOf(id)}" alt=""><span><b style="color:${R.color}">${esc(nameOf(id))}</b><small>${esc(R.name)} · ${esc(kind)}${it && it.lvReq ? ` · Lv ${it.lvReq}` : ''}</small></span></div>` +
      (stats ? `<div class="md-tl">${esc(stats)}</div>` : '') +
      (d ? `<div class="md-tl dim">โอกาส <b>${pct(d.pct)}</b> ต่อตัว${d.n ? ' · ' + d.n : ''}${d.boss ? ' · ของบอส' : ''}</div>` : '') +
      (d && d.from ? `<div class="md-tl dim">ดรอปจากมอน Lv ${Math.max(1, d.from)} ขึ้นไป</div>` : '') +
      (!it && MAT[id] && MAT[id].desc ? `<div class="md-tl dim">${esc(MAT[id].desc)}</div>` : '') +
      `<div class="md-tl ${f ? 'ok' : 'dim'}">${f ? '✓ เคยได้แล้ว' : 'ยังไม่เคยได้'}</div>` +
      '<div class="md-links">' + (it ? `<button data-mdcol="${id}"><img src="${IC.book}" alt="">ในสมุดสะสม</button>` : `<button data-mdpouch="1"><img src="${IC.book}" alt="">ถุงวัสดุ</button>`) +
      `<button data-mdwho="${id}"><img src="${IC.find}" alt="">${who ? 'ซ่อนรายชื่อ' : 'ใครดรอปอีกบ้าง'}</button></div>` +
      (who ? '<div class="md-who kw-scroll">' + (who.length ? who.map((w) => `<button data-mdmap="${w.map}" data-mdpick="${w.sp}"><img src="${spr(w.sp)}" alt=""><span>${esc((NC.MONSTERS[w.sp] || {}).name || w.sp)}</span><small>${esc(NC.MAPS[w.map].name)}</small></button>`).join('') : '<span class="dim">ดรอปที่นี่ที่เดียว</span>') + '</div>' : '');
    view.appendChild(el);
    // above the slot, its tail pointing down at it (the mockup); under it when there is no room above
    const r = at.getBoundingClientRect(), v = view.getBoundingClientRect(), k = v.width / view.offsetWidth || 1;
    const cx = (r.left + r.width / 2 - v.left) / k, top = (r.top - v.top) / k, bot = (r.bottom - v.top) / k;
    let x = cx - el.offsetWidth * 0.3;
    x = Math.max(4, Math.min(view.offsetWidth - el.offsetWidth - 4, x));
    let y = top - el.offsetHeight - 14, below = false;
    if (y < 4) { y = bot + 14; below = true; }
    el.classList.toggle('below', below);
    el.style.left = x + 'px'; el.style.top = Math.min(view.offsetHeight - el.offsetHeight - 4, y) + 'px';
    el.style.setProperty('--tx', Math.max(20, Math.min(el.offsetWidth - 20, cx - x)) + 'px');
  }

  // ---------------- the clicks ----------------
  function onClick(e) {
    const b = e.target.closest('button, [data-mdrow]');
    if (!b) { if (tip && !e.target.closest('.md-tipc')) { tip = null; drawTable(); } return; }
    const D0 = b.dataset, g = G();
    if (D0.mdmap) { mapId = D0.mdmap; pick = D0.mdpick || null; tip = null; if (MW()) MW().select(mapId); show(true); return; }
    if (D0.mdf) { filt = D0.mdf; tip = null; render(); return; }
    if (D0.mdmore) { open.add(D0.mdmore); pick = D0.mdmore; drawTable(); return; }
    if (D0.mdless) { open.delete(D0.mdless); drawTable(); return; }
    if (D0.mdclear) { filt = 'all'; q = ''; tip = null; render(); return; }
    if (D0.mdall) { allSearch(); return; }
    if (D0.mdbossmaps) { bossMaps(); return; }
    if (D0.mdtip) { pick = D0.mdsp; tip = tip && tip.id === D0.mdtip && tip.sp === D0.mdsp ? null : { id: D0.mdtip, sp: D0.mdsp }; drawTable(); return; }
    if (D0.mdwho && tip) { tip.who = tip.who ? null : whoDrops(D0.mdwho); drawTip(); return; }
    if (D0.mdcol) { leave(); if (NC.P3JBook) NC.P3JBook.openBook(D0.mdcol); else if (NC.Hub) NC.Hub.open('book'); return; }
    if (D0.mdpouch) { leave(); g.paused = NC.HUD.panel('shop', true); return; }
    if (D0.mdgo) { goTo(g, D0.mdgo); return; }
    if (D0.mdbot) { bot(g, D0.mdbot); return; }
    if (D0.mdbook) { leave(); if (NC.P3JBook) NC.P3JBook.openMon(D0.mdbook); else if (NC.Hub) NC.Hub.open('mon'); return; }
    if (D0.mdrow) { pick = D0.mdrow; tip = null; drawTable(); }
  }
  // the search found nothing here: the maps that have it, as a list of links
  function allSearch() {
    const ql = q.toLowerCase(), hits = new Map();
    for (const mid in NC.MAPS) {
      let I; try { I = NC.mapInfo(mid); } catch (e2) { continue; }
      for (const [sp, m] of I.mons) for (const d of dropsOf(sp, m)) if (nameOf(d.id).toLowerCase().includes(ql)) { const k = mid + '|' + sp; if (!hits.has(k)) hits.set(k, { map: mid, sp, id: d.id }); }
    }
    const box = $('md-table');
    box.innerHTML = `<div class="md-empty"><b>"${esc(q)}" ดรอปที่ ${hits.size} แห่ง</b><div class="md-who wide">` + ([...hits.values()].slice(0, 60).map((h) =>
      `<button data-mdmap="${h.map}" data-mdpick="${h.sp}"><img src="${spr(h.sp)}" alt=""><span>${esc((NC.MONSTERS[h.sp] || {}).name || h.sp)} · ${esc(nameOf(h.id))}</span><small>${esc(NC.MAPS[h.map].name)}</small></button>`).join('') || '<span class="dim">ไม่มีมอนตัวไหนดรอป</span>') +
      '</div><button class="kw-btn grey" data-mdclear="1">กลับ</button></div>';
    tip = null;
  }
  // the maps with a boss (the boss filter found none here)
  function bossMaps() {
    const out = [];
    for (const mid in NC.MAPS) { let I; try { I = NC.mapInfo(mid); } catch (e2) { continue; } for (const [sp, m] of I.mons) if (m.boss) out.push({ map: mid, sp }); }
    $('md-table').innerHTML = `<div class="md-empty"><b>บอสประจำแมพ ${out.length} ตัว</b><div class="md-who wide">` + out.map((h) =>
      `<button data-mdmap="${h.map}" data-mdpick="${h.sp}"><img src="${spr(h.sp)}" alt=""><span>${esc((NC.MONSTERS[h.sp] || {}).name || h.sp)}</span><small>${esc(NC.MAPS[h.map].name)}</small></button>`).join('') +
      '</div><button class="kw-btn grey" data-mdclear="1">กลับ</button></div>';
  }
  function leave() { NC.HUD.panel('bigmap', false); const g = G(); if (g) g.paused = false; }
  // walk there: across maps to the map, on this map to the nearest of that monster
  function goTo(g, sp) {
    leave();
    if (!NC.Travel || !NC.Travel.go) { if (NC.MapRoute) NC.MapRoute.set(mapId); return; }
    if (g.mapId === mapId) {
      const p = g.player, near = g.enemies.filter((e) => e.type === sp && !e.dead && e.hp > 0).sort((a, b) => NC.dist(a.x, a.y, p.x, p.y) - NC.dist(b.x, b.y, p.x, p.y))[0];
      if (near) { NC.Travel.go(g, { map: mapId, x: near.x, y: near.y, r: 200, name: (NC.MONSTERS[sp] || {}).name || '' }); return; }
      g.toast(`${(NC.MONSTERS[sp] || {}).name || ''} ยังไม่เกิดใกล้ ๆ · ลองให้บอทล่าตัวนี้`); return;
    }
    NC.Travel.go(g, { map: mapId, x: 0, y: 0, r: 1e9, name: NC.MAPS[mapId].name });
    g.toast(`กำลังเดินไป ${NC.MAPS[mapId].name} · เดินเองเพื่อหยุด`);
  }
  // the auto farm on that species only, on this map (js/journey.js's farm: walks there first)
  function bot(g, sp) {
    leave();
    if (NC.Journey && NC.Journey.farm) { NC.Journey.farm(g, sp, mapId); return; }
    const A = NC.Auto;
    if (!A) return;
    A.set.off = Object.keys(NC.MONSTERS).filter((x) => x !== sp);
    if (!A.on) A.toggle(g);
  }

  // ---------------- hooks ----------------
  const baseInit = NC.HUD.init.bind(NC.HUD);
  NC.HUD.init = function (game) {
    baseInit(game);
    if (!build()) return;
  };
  const basePanel = NC.HUD.panel.bind(NC.HUD);
  NC.HUD.panel = function (id, showIt) {
    const r = basePanel(id, showIt);
    if (id === 'bigmap' && !r && on) { on = false; const w = $('mapwin'); if (w) w.classList.remove('md-on'); if (view) view.hidden = true; } // (closed: next time the map opens as before)
    return r;
  };
  addEventListener('resize', () => { if (on && tip) drawTip(); });
  NC.MapDrops = { open: (id) => { if (!MW()) return; mapId = id || null; MW().open(); setTimeout(() => show(true), 50); }, dropsOf };
})();
