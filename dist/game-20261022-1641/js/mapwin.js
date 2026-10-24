/* mapwin.js — the map window (M) in the K look (css/kui.css + css/mapwin.css). Page 4 of the page-by-page redesign
   (2026-09-29): layout "A" of assets/gen/nightcamp_pg_map_a_raw.png, a painted parchment map of the world
   (assets/kui/worldmap_paper.jpg: Codex, assets/gen/worldmap_paper.prompt.txt over the layout guide
   ref_worldmap_layout.png; the places were painted where the guide put them, PIN below is where they came out):
     แผนที่โลก  the painting with a pin on every field (its main element inside, a name tag with the level coloured by
               how it suits the hero: green right level, red too strong, grey easy), the routes dashed between them,
               คุณอยู่ที่นี่ with the hero's face, a ดันเจี้ยน tag on the fields with floors under them
     แมพนี้     this map, big (hud.js drawMap, as the old window)
     the card  the picked place: a close-up of the painting, its level and what that means for us, what it is like
               (worldmap.js NOTE), its monsters with their pictures and levels, the elements that hit them hard and the
               jobs that have them, the elements to avoid, its drops, its dungeons, and นำทาง: the way there map by map,
               gold on the painting, and in the game a gold arrow by the hero toward the next warp until we arrive
   It takes over NC.HUD.panel('bigmap') (M, the menu's map button); the old dark #bigmap window is gone (2026-10-21).
   Reads worldmap.js: NC.mapInfo, NC.MAP_NOTES, NC.MAP_ELEMENT_JOBS.
   2026-09-30, layout B (the user: region tabs, so maps can keep being added; assets/gen/nightcamp_wm2_b_raw.png): the world
   is split into regions (js/worldmap_pins.js: NC.WORLD_REGIONS, one painting each, assets/kui/wm_<id>.jpg, and NC.WORLD_PINS:
   id -> [region, x %, y %]). A tab per region; a warp into another region shows as a signpost that opens that tab; the
   continent overview in a corner. ?pinedit: drag the pins, place the fields that have none, and save (POST /api/mappins,
   tools/studio_serve.mjs, which writes js/worldmap_pins.js).
   2026-09-30, the job guide (js/jobfit.js; the Game Bible plan's decision 3, advice only): the card says how the place suits
   the hero's job (เหมาะ / พอได้ / ลำบาก and why), the jobs that suit it most and EXP ที่นี่ (the level-gap table); the
   board's แมพที่เหมาะกับเรา lists the best places for the hero's job at their level. */
(function () {
  'use strict';
  const NC = window.NC;
  const $ = (id) => document.getElementById(id);
  const G = () => NC.game;
  const icon = (k) => ((NC.ASSET_MANIFEST || {})[k] || {}).src || '';
  const spr = (k) => { const S = NC.SPR && NC.SPR[k]; return (S && S.img && S.img.src) || icon(k); }; // (monsters: loaded from their own manifests)
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const ART_AR = 1536 / 1024, OVER = 'assets/kui/wm_overview.jpg';
  const TAB_KEY = 'nightcamp.maptab.v1';
  const EDIT = false;
  // the regions and where each field is on its region's painting: the pin's tip, % of its width and height
  const REGIONS = NC.WORLD_REGIONS && NC.WORLD_REGIONS.length ? NC.WORLD_REGIONS : [{ id: 'old', name: 'แผนที่โลก', art: 'assets/kui/worldmap_paper.jpg', over: [50, 50] }];
  NC.WORLD_PINS = NC.WORLD_PINS || {};
  const PIN = {}, REG = {};
  function loadPins() {
    for (const k in PIN) { delete PIN[k]; delete REG[k]; }
    for (const [id, v] of Object.entries(NC.WORLD_PINS)) { PIN[id] = [v[1], v[2]]; REG[id] = v[0]; }
  }
  loadPins();
  const regionOf = (r) => REGIONS.find((x) => x.id === r) || REGIONS[0];
  const artOf = (r) => regionOf(r).art;
  const EL_COL = { fire: '#ff8a5c', water: '#74b8ff', wind: '#6fdc92', earth: '#e0a867', poison: '#c79af5', holy: '#ffd65a', shadow: '#b3a4ff', neutral: '#e6dcc8' };
  const FIT_T = { fit: 'เลเวลเหมาะกับเราตอนนี้', hard: 'มอนยังเก่งกว่าเราไป', easy: 'ง่ายไปแล้ว EXP น้อย' };
  const shortLv = (t) => String(t || '').split(' · ')[0];

  let win = null, tab = 'world', region = REGIONS[0].id, sel = null, raf = 0, route = null, arrived = '', drag = null, bestOpen = false;
  try { if (localStorage.getItem(TAB_KEY) === 'here') tab = 'here'; } catch (e) { /* storage blocked */ }

  // ---------------- the world's joins ----------------
  let linkCache = null;
  function links() { // every pair of maps joined by a warp or a camp exit (dungeon floors too)
    if (linkCache) return linkCache;
    const out = [], seen = new Set();
    for (const id in NC.MAPS) for (const w of (NC.MAPS[id].warps || []).concat(NC.MAPS[id].exits || [])) {
      const k = [id, w.to].sort().join('|');
      if (!seen.has(k) && NC.MAPS[w.to]) { seen.add(k); out.push([id, w.to]); }
    }
    return (linkCache = out);
  }
  function pathTo(from, to) { // the maps on the shortest way, both ends included
    if (!NC.MAPS[from] || !NC.MAPS[to]) return null;
    const next = {};
    for (const [a, b] of links()) { (next[a] = next[a] || []).push(b); (next[b] = next[b] || []).push(a); }
    const back = { [from]: null }, q = [from];
    while (q.length) {
      const m = q.shift();
      if (m === to) break;
      for (const n of next[m] || []) if (!(n in back)) { back[n] = m; q.push(n); }
    }
    if (!(to in back)) return null;
    const path = [];
    for (let m = to; m; m = back[m]) path.unshift(m);
    return path;
  }
  const rootOf = (id) => { for (let k = 0; id && !PIN[id] && k < 8; k++) id = (NC.MAPS[id] || {}).parent; return id; };
  const floorsUnder = (id) => Object.keys(NC.MAPS).filter((k) => NC.MAPS[k].parent === id && (!NC.MAPS[k].secret || (NC.secretKnown && NC.secretKnown(k))));
  const lvOf = (M) => { const m = /(\d+)\D+(\d+)/.exec((M && M.lvText) || ''); return m ? [+m[1], +m[2]] : null; };
  // by the EXP bands (js/levelgap.js): 'fit' = a monster there within 3 levels (full EXP), 'hard' = all stronger,
  // 'easy' = all weaker (less EXP)
  function fit(lv, p) {
    if (!lv || !p || !NC.levelGapRange) return '';
    const b = NC.levelGapRange(lv, p.lv);
    return b.band === 0 ? 'fit' : b.stronger ? 'hard' : 'easy';
  }

  // ---------------- building the window ----------------
  function build() {
    win = document.createElement('div');
    win.id = 'mapwin'; win.className = 'kw-panel'; win.hidden = true;
    win.innerHTML = '<div class="mw-wrap"><section class="kw-win mw-win">' +
      '<header class="kw-title"><span>แผนที่</span><button class="kw-x" id="mw-close" aria-label="ปิด">✕</button></header>' +
      '<nav class="kw-tabs mw-tabs" id="mw-tabs"><button class="kw-tab" data-t="here">แมพนี้</button>' +
        REGIONS.map((r) => `<button class="kw-tab mw-rtab" data-r="${r.id}">${esc(r.name)}</button>`).join('') +
        '<span class="mw-where" id="mw-where"></span></nav>' +
      '<div class="mw-body">' +
        '<div class="mw-board">' +
          '<canvas class="mw-here" id="mw-here"></canvas>' +
          `<div class="mw-world" id="mw-world"><img class="mw-art" id="mw-art" src="${REGIONS[0].art}" alt="" draggable="false">` +
            '<svg class="mw-links" id="mw-links" viewBox="0 0 150 100" preserveAspectRatio="none"></svg><div class="mw-pins" id="mw-pins"></div>' +
            `<div class="mw-over" id="mw-over"><img src="${OVER}" alt="" draggable="false" onerror="this.style.visibility='hidden'">` +
              REGIONS.map((r) => `<button class="mw-odot" data-r="${r.id}" style="left:${(r.over || [50, 50])[0]}%;top:${(r.over || [50, 50])[1]}%" title="${esc(r.name)}"><i></i><span>${esc(r.name)}</span></button>`).join('') +
            '</div>' + (EDIT ? '<div class="mw-edit" id="mw-edit"></div>' : '') +
            '<div class="mw-legend"><i class="fit"></i>เหมาะกับเลเวลเรา<i class="hard"></i>ยังยากไป<i class="easy"></i>ง่ายไป</div>' +
            '<div class="mw-best" id="mw-best"></div></div>' +
        '</div>' +
        '<div class="mw-card kw-card" id="mw-card"></div>' +
      '</div></section></div>';
    document.body.appendChild(win);
    $('mw-close').addEventListener('click', close);
    const toRegion = (e) => { const b = e.target.closest('[data-r]'); if (b) { region = b.dataset.r; show('world'); return true; } return false; };
    $('mw-tabs').addEventListener('click', (e) => { if (toRegion(e)) return; const b = e.target.closest('[data-t]'); if (b) show(b.dataset.t); });
    $('mw-over').addEventListener('click', toRegion);
    $('mw-pins').addEventListener('click', (e) => {
      if (toRegion(e)) return;
      const b = e.target.closest('[data-map]');
      if (b && !(drag && drag.moved)) { sel = b.dataset.map; render(); }
    });
    if (EDIT) editor();
    $('mw-best').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.map) { sel = b.dataset.map; region = REG[rootOf(sel)] || region; }
      else bestOpen = !bestOpen;
      render();
    });
    $('mw-card').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.map) { sel = b.dataset.map; render(); }
      else if (b.dataset.route) setRoute(b.dataset.route === '-' ? null : b.dataset.route);
    });
  }
  function show(t) {
    tab = t;
    try { localStorage.setItem(TAB_KEY, t); } catch (e) { /* storage blocked */ }
    if (t === 'here') sel = G().mapId;
    else if (PIN[rootOf(sel)] && REG[rootOf(sel)] !== region) sel = null; // (another region's place: pick one here)
    render();
  }
  function setRoute(to) {
    const g = G();
    route = to && to !== g.mapId ? { to } : null;
    arrived = '';
    if (route) NC.HUD.log(`นำทางไป ${NC.MAPS[to].name}: เดินตามลูกศรสีทองไปที่ทางวาร์ป`, 'sys');
    render();
  }
  NC.MapRoute = { get: () => route, set: setRoute, pathTo };
  // (js/mapdrops.js, 2026-10-17: its "มอน & ดรอป" view reads and sets the picked map and the region)
  NC.MapWin = { sel: () => sel, select: (id) => { if (NC.MAPS[id]) { sel = id; region = REG[rootOf(id)] || region; render(); } }, region: () => region,
    regOf: (id) => REG[rootOf(id)] || null, rootOf: (id) => rootOf(id), pins: () => PIN, open: () => { const g = G(); if (g) g.paused = NC.HUD.panel('bigmap', true); }, render: () => render() };

  // ---------------- open / close ----------------
  function open() {
    const g = G();
    sel = g.mapId;
    region = REG[rootOf(g.mapId)] || region;
    render();
    if (!raf) raf = requestAnimationFrame(loop);
    // (a phone held upright: the painting is wider than the screen and pans; start with our pin in the middle)
    const board = win.querySelector('.mw-board'), at = PIN[rootOf(g.mapId)];
    if (board && at && board.scrollWidth > board.clientWidth) board.scrollLeft = (at[0] / 100) * board.scrollWidth - board.clientWidth / 2;
  }
  function close() {
    NC.HUD.panel('bigmap', false);
    const g = G();
    if (g) g.paused = false;
  }
  function fit2() {
    const wrap = win.querySelector('.mw-wrap');
    wrap.style.transform = 'translate(-50%, -50%)';
    const k = Math.min(1, (innerWidth - 16) / wrap.offsetWidth, (innerHeight - 16) / wrap.offsetHeight);
    if (k < 1) wrap.style.transform = `translate(-50%, -50%) scale(${k.toFixed(4)})`;
  }
  addEventListener('resize', () => setTimeout(() => { if (win && !win.hidden) { fit2(); drawFaces(); } }, 0));

  // ---------------- drawing ----------------
  function render() {
    if (!win || win.hidden) return;
    const g = G(), p = g.player, inside = g.mapId;
    if (!NC.MAPS[sel]) sel = REG[rootOf(inside)] === region || tab === 'here' ? inside : Object.keys(PIN).find((k) => REG[k] === region) || inside;
    for (const b of $('mw-tabs').querySelectorAll('[data-t]')) b.classList.toggle('on', b.dataset.t === tab);
    for (const b of $('mw-tabs').querySelectorAll('[data-r]')) b.classList.toggle('on', tab === 'world' && b.dataset.r === region);
    for (const b of $('mw-over').querySelectorAll('[data-r]')) b.classList.toggle('on', b.dataset.r === region);
    const art = $('mw-art');
    if (!art.src.endsWith(artOf(region))) art.src = artOf(region);
    $('mw-where').innerHTML = `ตอนนี้อยู่ที่ <b>${esc((NC.MAPS[inside] || {}).name || '')}</b>`;
    $('mw-here').hidden = tab !== 'here';
    $('mw-world').hidden = tab !== 'world';
    if (tab === 'world') { renderWorld(p, inside); renderEdit(); renderBest(p); }
    renderCard(p, inside);
    fit2();
    drawFaces();
  }

  function renderWorld(p, inside) {
    const here = rootOf(inside), selRoot = rootOf(sel);
    const path = route ? pathTo(inside, route.to) : null;
    const onPath = new Set(), pathRoots = new Set();
    if (path) {
      for (const id of path) pathRoots.add(rootOf(id));
      for (let i = 0; i + 1 < path.length; i++) onPath.add([rootOf(path[i]), rootOf(path[i + 1])].sort().join('|'));
    }
    let svg = '', signs = '';
    const signed = new Set();
    for (const [a0, b0] of links()) {
      const a = rootOf(a0), b = rootOf(b0);
      if (!PIN[a] || !PIN[b] || a === b) continue;
      if (REG[a] !== region && REG[b] !== region) continue;
      if (REG[a] !== REG[b]) { // a warp into another region: a signpost beside the place, toward that region
        const [mine, other] = REG[a] === region ? [a, b] : [b, a], R2 = regionOf(REG[other]), key = mine + '>' + R2.id;
        if (signed.has(key)) continue;
        signed.add(key);
        const o1 = regionOf(region).over || [50, 50], o2 = R2.over || [50, 50], ang = Math.atan2(o2[1] - o1[1], o2[0] - o1[0]);
        // (beside the pin's head, clear of its name tag below it)
        const right = Math.cos(ang) >= 0, x = Math.max(right ? 4 : 16, Math.min(right ? 84 : 96, PIN[mine][0] + (right ? 4 : -4))), y = Math.max(5, Math.min(94, PIN[mine][1] - 7 + Math.sin(ang) * 3));
        const on = onPath.has([mine, other].sort().join('|'));
        signs += `<button class="mw-sign${on ? ' route' : ''}${Math.cos(ang) < 0 ? ' left' : ''}" data-r="${R2.id}" style="left:${x}%;top:${y}%">ไป${esc(R2.name)}</button>`;
        continue;
      }
      const on = onPath.has([a, b].sort().join('|'));
      const xy = `x1="${PIN[a][0] * 1.5}" y1="${PIN[a][1]}" x2="${PIN[b][0] * 1.5}" y2="${PIN[b][1]}"`;
      svg += `<line class="u${on ? ' on' : ''}" ${xy}/><line class="t${on ? ' on' : ''}" ${xy}/>`;
    }
    $('mw-links').innerHTML = svg;
    let html = '';
    for (const id in PIN) {
      const M = NC.MAPS[id];
      if (!M || REG[id] !== region) continue;
      const I = NC.mapInfo(id), f = fit(I.lv || lvOf(M), p), el0 = I.els[0];
      const cls = 'mw-pin' + (f ? ' ' + f : ' safe') + (id === selRoot ? ' sel' : '') + (id === here ? ' here' : '') + (pathRoots.has(id) ? ' route' : '') + (route && route.to && rootOf(route.to) === id ? ' goal' : '');
      const head = id === here ? '<span class="mw-you"><canvas class="mw-face" width="128" height="128"></canvas></span>'
        : `<span class="mw-head"><span>${el0 ? `<img src="${icon('el_' + el0)}" alt="">` : '<i>★</i>'}</span></span>`;
      html += `<button class="${cls}" data-map="${id}" style="left:${PIN[id][0]}%;top:${PIN[id][1]}%" title="${esc(M.name)}">${head}` +
        `<span class="mw-tags"><span class="mw-tag"><b>${esc(M.name)}</b><i class="mw-lv">${esc(shortLv(M.lvText))}</i></span>` +
        (id === here ? `<i class="mw-ribbon">${inside === here ? 'คุณอยู่ที่นี่' : 'อยู่ใต้ดินที่นี่'}</i>` : floorsUnder(id).length ? '<em class="mw-dtag">ดันเจี้ยน</em>' : '') +
        '</span></button>';
    }
    $('mw-pins').innerHTML = html + signs;
  }

  // ---------------- ?pinedit: drag the pins, place new fields, save js/worldmap_pins.js ----------------
  function editor() {
    const pins = $('mw-pins');
    pins.addEventListener('pointerdown', (e) => {
      const b = e.target.closest('.mw-pin');
      if (!b) return;
      drag = { id: b.dataset.map, b, moved: false };
      b.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    pins.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const r = pins.getBoundingClientRect();
      const x = Math.round(Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100)) * 10) / 10;
      const y = Math.round(Math.max(0, Math.min(100, ((e.clientY - r.top) / r.height) * 100)) * 10) / 10;
      drag.moved = true;
      NC.WORLD_PINS[drag.id] = [region, x, y]; PIN[drag.id] = [x, y];
      drag.b.style.left = x + '%'; drag.b.style.top = y + '%';
    });
    pins.addEventListener('pointerup', () => { if (drag && drag.moved) { sel = drag.id; render(); } setTimeout(() => { drag = null; }, 0); });
    $('mw-edit').addEventListener('click', async (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.place) { NC.WORLD_PINS[b.dataset.place] = [region, 50, 50]; loadPins(); sel = b.dataset.place; render(); return; }
      if (b.dataset.drop) { delete NC.WORLD_PINS[b.dataset.drop]; loadPins(); render(); return; }
      if (b.dataset.save !== undefined) {
        const body = JSON.stringify({ regions: NC.WORLD_REGIONS, pins: NC.WORLD_PINS });
        try {
          const r = await fetch('api/mappins', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
          const j = await r.json();
          NC.HUD.log(j.ok ? `บันทึกหมุดแล้ว ${j.n} แมพ (js/worldmap_pins.js)` : 'บันทึกไม่สำเร็จ: ' + j.error, 'sys');
        } catch (err) {
          try { await navigator.clipboard.writeText(body); } catch (e2) { /* no clipboard */ }
          NC.HUD.log('เซิร์ฟเวอร์นี้บันทึกไฟล์ไม่ได้ (เปิดผ่าน tools/studio_serve.mjs) · คัดลอกข้อมูลหมุดไว้ในคลิปบอร์ดแล้ว', 'warn');
        }
      }
    });
  }
  function renderEdit() {
    const el = $('mw-edit');
    if (!el) return;
    const loose = Object.keys(NC.MAPS).filter((id) => { const M = NC.MAPS[id]; return M.lvText && !M.dungeonFloor && !M.secret && !M.tower && !PIN[id]; });
    el.innerHTML = '<b>แก้หมุด</b> ลากหมุดไปวางได้เลย · ' +
      (loose.length ? 'ยังไม่มีหมุด: ' + loose.map((id) => `<button data-place="${id}">+ ${esc(NC.MAPS[id].name)}</button>`).join('') : 'ทุกแมพมีหมุดแล้ว') +
      (sel && PIN[sel] ? ` <button data-drop="${sel}">เอาหมุด ${esc((NC.MAPS[sel] || {}).name || sel)} ออก</button>` : '') +
      ' <button class="save" data-save>บันทึก</button>';
  }

  // the hero's face in the คุณอยู่ที่นี่ marker (as hud.js refreshHead draws the portrait)
  function drawFaces() {
    if (!win || win.hidden) return;
    const g = G(), p = g && g.player;
    if (!p) return;
    const eq = NC.lookEquip ? NC.lookEquip(p.equip) : p.equip;
    for (const cv of win.querySelectorAll('.mw-face')) {
      const c = cv.getContext('2d'), S = cv.width;
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.clearRect(0, 0, S, S);
      c.save();
      c.beginPath(); c.arc(S / 2, S / 2, S * 0.46, 0, Math.PI * 2); c.clip();
      c.fillStyle = '#f3e7cf'; c.fillRect(0, 0, S, S);
      const hs = NC.headSpot(eq), k = (S * 0.77) / hs.w;
      NC.drawAvatar(c, eq, S / 2 - hs.x * k, S * 0.58 - hs.y * k, k, 1, { noWeapon: true });
      c.restore();
    }
  }

  // the life skills on a map (life*.js): trees named in the woodcutting guide, veins in a dungeon or a field, the farm, ponds
  function lifeHere(id) {
    const L = NC.Life, M = NC.MAPS[id];
    if (!L || !M) return [];
    const named = (list) => (list || []).some((g) => String(g.where || '').split(' · ').some((seg) => {
      seg = seg.replace(/\(.*?\)/g, '').trim();
      return seg.length > 2 && (M.name.includes(seg) || seg.includes(M.name));
    }));
    const out = [];
    if (!M.dungeonFloor && named(L.GUIDE.wood)) out.push('wood');
    if (M.dungeonFloor || (L.fieldVeins || []).some((v) => v[0] === id)) out.push('mine');
    if (id === 'homefarm') out.push('farm');
    if (M.ponds && M.ponds.length && L.SKILLS.fish) out.push('fish');
    return out.filter((k) => L.SKILLS[k]).map((k) => L.SKILLS[k].name);
  }

  // ---------------- the job guide (js/jobfit.js) ----------------
  const JF = () => NC.JobFit && NC.JobFit.web();
  const pct = (x) => `${Math.round(x * 100)}%`;
  const expTier = (x) => (x >= 0.95 ? 'full' : x >= 0.6 ? 'good' : x >= 0.3 ? 'low' : 'poor');
  const jobName = (id) => ((NC.JOBS || {})[id] || {}).name || id;
  // EXP ที่นี่: the share of full EXP the hero gets from this place's monsters (the level-gap table)
  function expHtml(p, id) {
    const src = JF(), x = src && p ? NC.JobFit.mapExp(src, id, p.lv) : null;
    return x === null ? '' : `<span class="mw-exp ${expTier(x)}" title="EXP ลดลงตามช่องว่างเลเวลระหว่างมอนกับเรา">EXP ที่นี่ <b>${pct(x)}</b></span>`;
  }
  // เหมาะกับอาชีพคุณ: the verdict for the hero's job and why, then the jobs that suit the place most
  function jobFitHtml(p, id) {
    const src = JF(), f = src && p ? NC.JobFit.fit(src, p.job, id) : null;
    if (!f) return '';
    const V = NC.JobFit.VERDICT, tops = NC.JobFit.top(src, id);
    const reasons = f.reasons.map((r) => `<li class="${r.v > 0 ? 'up' : r.v < 0 ? 'down' : ''}">${esc(r.text)}</li>`).join('');
    return `<div class="mw-sec mw-jf ${f.verdict}"><div class="mw-jfh"><span class="k">เหมาะกับอาชีพคุณ:</span><b>${esc(jobName(p.job))}</b>` +
      `<em class="mw-jfv ${f.verdict}">${V[f.verdict]}</em></div><ul class="mw-jfr">${reasons}</ul>` +
      (tops.length ? `<div class="mw-jft"><span class="k">อาชีพที่เหมาะที่สุดที่นี่:</span> ${tops.map((t) => esc(jobName(t.job))).join(' · ')}</div>` : '') + '</div>';
  }
  // แมพที่เหมาะกับเรา (the world board): the best places for the hero's job at their level
  function renderBest(p) {
    const box = $('mw-best'), src = JF();
    if (!box) return;
    box.hidden = !src || !p;
    if (box.hidden) return;
    const head = `<button class="mw-bhead${bestOpen ? ' on' : ''}" aria-expanded="${bestOpen}">แมพที่เหมาะกับเรา <span>${esc(jobName(p.job))} Lv ${p.lv}</span></button>`;
    if (!bestOpen) { box.innerHTML = head; return; }
    const V = NC.JobFit.VERDICT, rows = NC.JobFit.best(src, p.job, p.lv).map((b) => {
      const M = NC.MAPS[b.map], root = rootOf(b.map), where = PIN[root] && REG[root] !== region ? regionOf(REG[root]).name : '';
      return `<button class="mw-brow${b.map === sel ? ' sel' : ''}" data-map="${b.map}"><b>${esc(M.name)}</b>` +
        `<small>${esc(shortLv(M.lvText))}${where ? ' · ' + esc(where) : ''}</small><span class="mw-exp ${expTier(b.exp)}">EXP ${pct(b.exp)}</span>` +
        `<em class="mw-jfv ${b.verdict}">${V[b.verdict]}</em></button>`;
    }).join('');
    box.innerHTML = head + `<div class="mw-blist">${rows || '<p class="mw-dim">ยังไม่มีแมพที่ได้ EXP เกิน 40% สำหรับเลเวลนี้</p>'}</div>`;
  }

  function renderCard(p, inside) {
    const id = sel, M = NC.MAPS[id], c = $('mw-card');
    if (!M) { c.innerHTML = ''; return; }
    const I = NC.mapInfo(id), f = fit(I.lv || lvOf(M), p), root = rootOf(id), at = PIN[root];
    // the picture: the painting around the place
    let scene = 'background:linear-gradient(#3a4170,#262b4a)';
    if (at) {
      const Z = 4.2, h = 0.44, iw = Z, ih = Z / ART_AR;
      const px = Math.max(0, Math.min(1, ((at[0] / 100) * iw - 0.5) / (iw - 1))), py = Math.max(0, Math.min(1, ((at[1] / 100) * ih - h / 2) / (ih - h)));
      scene = `background-image:url(${artOf(REG[root])});background-size:${Z * 100}% auto;background-position:${(px * 100).toFixed(1)}% ${(py * 100).toFixed(1)}%`;
    }
    const mons = [...I.mons].sort((a, b) => (!!a[1].boss - !!b[1].boss) || b[1].w - a[1].w).map(([sp, m]) => {
      const S = NC.MONSTERS[sp] || {}, lv = m.lv ? (m.lv[0] === m.lv[1] ? `Lv ${m.lv[0]}` : `Lv ${m.lv[0]}–${m.lv[1]}`) : '';
      const E = NC.ELEMENT_INFO[S.element || 'neutral'] || {};
      return `<div class="mw-mon${m.boss ? ' boss' : ''}" title="${esc(S.name || sp)} · ธาตุ${esc(E.th || '')} · ${lv}${S.passive ? ' · ไม่ตีก่อน' : ''}">` +
        `<span class="mw-mimg"><img src="${spr(sp)}" alt="" onerror="this.style.visibility='hidden'"><img class="el" src="${icon('el_' + (S.element || 'neutral'))}" alt="">` +
        (m.boss ? '<em>บอส</em>' : '') + `</span><b>${esc(S.name || sp)}</b><small>${lv}</small></div>`;
    }).join('');
    const JOBS = NC.MAP_ELEMENT_JOBS || {};
    const good = I.good.map((a) => `<span class="mw-el good" style="color:${EL_COL[a] || '#fff'}" title="${esc(JOBS[a] || '')}"><img src="${icon('el_' + a)}" alt="">${esc(NC.ELEMENT_INFO[a].th)} ×${I.mod[a].toFixed(1)}</span>`).join('');
    const bad = I.bad.map((a) => `<span class="mw-el bad"><img src="${icon('el_' + a)}" alt="">${esc(NC.ELEMENT_INFO[a].th)} ×${I.mod[a].toFixed(1)}</span>`).join('');
    const drops = I.drops.map((d) => `<span class="mw-drop" title="${esc(((NC.MATERIALS || {})[d] || {}).name || d)}"><img src="${NC.matIcon ? NC.matIcon(d) : ''}" alt=""></span>`).join('');
    const floors = floorsUnder(id).map((k) => {
      const F = NC.MAPS[k], boss = (F.bosses || [])[0];
      return `<button class="mw-dun" data-map="${k}"><b>${esc(F.name)}</b><small>${esc(F.lvText || '')}</small>` +
        (boss ? `<em>บอส: ${esc((NC.MONSTERS[boss[0]] || {}).name || '')}</em>` : '') + (F.secret ? '<em class="calm">ดันลับ</em>' : '') + '</button>';
    }).join('');
    const up = M.parent && NC.MAPS[M.parent] ? `<button class="mw-dun up" data-map="${M.parent}">↑ กลับขึ้นไป: ${esc(NC.MAPS[M.parent].name)}</button>` : '';
    const life = lifeHere(id);
    // the way there
    let go = '';
    if (id === inside) go = '<div class="mw-route here">คุณอยู่ที่นี่</div>';
    else {
      const path = pathTo(inside, id);
      if (path) {
        const on = route && route.to === id;
        go = `<div class="mw-route"><b>ทางไป ${path.length - 1} วาร์ป:</b> ${path.slice(1).map((m) => esc(NC.MAPS[m].name)).join(' › ')}</div>` +
          `<button class="kw-btn ${on ? 'grey' : 'blue'} mw-go" data-route="${on ? '-' : id}">${on ? 'ยกเลิกนำทาง' : 'นำทางไปที่นี่'}</button>`;
      }
    }
    c.innerHTML = '<div class="mw-cbody kw-scroll">' +
      `<div class="mw-scene" style="${scene}">${M.parent ? `<span>ใต้${esc(NC.MAPS[root] ? NC.MAPS[root].name : '')}</span>` : ''}</div>` +
      `<div class="mw-name">${esc(M.name)}</div>` +
      `<div class="mw-lvrow"><span class="mw-lvb ${f || 'safe'}">${esc(M.lvText || '')}</span>${FIT_T[f] ? `<span class="mw-verdict ${f}">${FIT_T[f]}</span>` : ''}${expHtml(p, id)}</div>` +
      ((NC.MAP_NOTES || {})[id] ? `<p class="mw-note">${esc(NC.MAP_NOTES[id])}</p>` : '') + jobFitHtml(p, id) +
      (mons ? `<div class="mw-sec"><div class="mw-sub">มอนสเตอร์:</div><div class="mw-mons">${mons}</div>` +
        (good ? `<div class="mw-line"><span class="k">ได้เปรียบ:</span>${good}</div>` : I.total ? '<div class="mw-line"><span class="k">ได้เปรียบ:</span><span class="mw-dim">ทุกธาตุพอ ๆ กัน</span></div>' : '') +
        (bad ? `<div class="mw-line"><span class="k bad">ไม่ควรใช้:</span>${bad}</div>` : '') + '</div>' : '') +
      (drops ? `<div class="mw-sec"><div class="mw-sub">ของดรอป:</div><div class="mw-drops">${drops}</div></div>` : '') +
      (life.length ? `<div class="mw-sec mw-life"><b>อาชีพเสริมที่นี่:</b> ${life.join(' · ')}</div>` : '') +
      (floors || up ? `<div class="mw-sec"><div class="mw-sub">${M.dungeonFloor ? 'ชั้นถัดไป:' : 'ดันเจี้ยนที่นี่:'}</div><div class="mw-duns">${floors}${up}</div></div>` : '') +
      '</div>' + `<div class="mw-foot">${go}</div>`;
  }

  // this map, big (the old window's drawing), while the window is open
  function loop() {
    raf = 0;
    if (!win || win.hidden) return;
    if (tab === 'here') {
      const cv = $('mw-here'), r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
      const W = Math.max(1, Math.round(r.width * dpr)), H = Math.max(1, Math.round(r.height * dpr));
      if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
      const g = G();
      if (g && g.world && NC.HUD.drawMap) NC.HUD.drawMap(cv.getContext('2d'), W, H, g, 3300);
    }
    raf = requestAnimationFrame(loop);
  }

  // ---------------- นำทาง in the game: a gold arrow by the hero toward the next warp ----------------
  const baseLabels = NC.Maps.drawLabels;
  NC.Maps.drawLabels = function (ctx, game) {
    baseLabels.apply(this, arguments);
    if (!route) return;
    if (game.mapId === route.to) { // arrived
      if (arrived !== route.to) { arrived = route.to; NC.HUD.log(`ถึง ${NC.MAPS[route.to].name} แล้ว (เลิกนำทาง)`, 'sys'); }
      route = null;
      return;
    }
    const path = pathTo(game.mapId, route.to), next = path && path[1];
    const pt = next && game.portals.find((w) => w.to === next);
    if (!pt) return;
    const p = game.player, cx = p.x, cy = p.y - 70, a = Math.atan2(pt.y - cy, pt.x - cx), d = Math.hypot(pt.x - cx, pt.y - cy);
    const t = game.time || 0, R = 118 + Math.sin(t * 5) * 8;
    ctx.save();
    // the warp: a gold ring on the ground
    ctx.globalAlpha = 0.55 + Math.sin(t * 4) * 0.25;
    ctx.strokeStyle = '#ffd35c'; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.ellipse(pt.x, pt.y, 120 + Math.sin(t * 4) * 10, 46, 0, 0, Math.PI * 2); ctx.stroke();
    // the arrow by the hero (it fades out right next to the warp)
    ctx.globalAlpha = NC.clamp((d - 140) / 160, 0, 1);
    ctx.translate(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
    ctx.rotate(a);
    ctx.beginPath(); ctx.moveTo(30, 0); ctx.lineTo(-14, -24); ctx.lineTo(-6, 0); ctx.lineTo(-14, 24); ctx.closePath();
    ctx.lineJoin = 'round'; ctx.lineWidth = 9; ctx.strokeStyle = NC.OUTLINE || '#2a2435'; ctx.stroke();
    ctx.fillStyle = '#ffd35c'; ctx.fill();
    ctx.restore();
  };

  // ---------------- hooks: M and the menu's map button open this window ----------------
  const baseInit = NC.HUD.init.bind(NC.HUD);
  NC.HUD.init = function (game) { baseInit(game); build(); };
  const basePanel = NC.HUD.panel.bind(NC.HUD);
  NC.HUD.panel = function (id, show) {
    if (win && id === 'bigmap') {
      const on = show === undefined ? win.hidden : show;
      basePanel('pause', false); // closes every other window
      win.hidden = !on;
      if (on) open();
      return on;
    }
    if (win) win.hidden = true;
    return basePanel(id, show);
  };
  addEventListener('keydown', (e) => {
    if (e.code !== 'Escape' || !win || win.hidden) return;
    e.stopImmediatePropagation(); e.preventDefault();
    close();
  }, true);
})();
