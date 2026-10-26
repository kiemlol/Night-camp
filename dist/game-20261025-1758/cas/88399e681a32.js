/* wmreal.js — the world map (M) drawn from the real maps instead of the Codex paintings (the user, 2026-10-17: "เอาแมพจริงมา
   ทำ ... แทน codex"; the paintings never showed the maps added after them). Each region's picture is built in the game:
     the layout  every field of a region sits on a grid cell, placed by its warps (a warp at the east edge puts the next map in
                 the cell to the east), walked out from the region's best-joined map; a taken cell pushes it to the side or on
     the tiles   each map seen from above in daylight (its ground, decals, props, walls), pre-rendered to assets/wmreal/<id>.jpg
                 by ?wmrender=<port> + tools/wmreal_sink.py; a map without a file is rendered here when M opens
     the pins    js/mapwin.js's pins go to the tiles' centres. They are set here, before mapwin.js reads them: the B sections'
                 pins (js/fields7.js) only arrived at loadAssets, after mapwin.js had read its list, so they never showed
   It changes NC.WORLD_PINS and each region's `art` (a getter: the composite once it is drawn) and draws the corner overview
   from the region pictures. ?wmreal=0: the paintings and their pins as before. ?pinedit (dragging the painted pins) turns
   it off too. Load after js/worldmap_pins.js and every file that adds maps (fields7.js), before js/mapwin.js. */
(function () {
  'use strict';
  const NC = window.NC;
  if (!NC.WORLD_REGIONS || !NC.WORLD_PINS || !NC.MAPS) return;
  const M = NC.MAPS, REGIONS = NC.WORLD_REGIONS, PAINT = Object.assign({}, NC.WORLD_PINS);
  const AW = 1536, AH = 1024, AR = 1.38; // (the art's size: mapwin.js ART_AR = 1536 / 1024; a tile's shape)
  const TW = 320; // a tile's file width
  const HAVE = NC.WMREAL_FILES || {}; // id -> version (assets/wmreal.manifest.js, written by tools/wmreal_sink.py)
  const V = { W: [-1, 0], E: [1, 0], N: [0, -1], S: [0, 1] }, OPP = { W: 'E', E: 'W', N: 'S', S: 'N' };

  // ---------------- which maps, and in which region ----------------
  const built = new Set((NC.Sections && NC.Sections.built) || []);
  const isField = (id) => M[id] && !M[id].dungeon && !M[id].dungeonFloor && (PAINT[id] || built.has(id));
  const warpsOf = (id) => (M[id].warps || []).concat(M[id].exits || []);
  const dirOf = (id, w) => {
    const m = M[id];
    if (!m.W || !m.H || w.x == null || w.y == null) return null;
    const dx = Math.min(w.x, m.W - w.x) / m.W, dy = Math.min(w.y, m.H - w.y) / m.H;
    if (Math.min(dx, dy) > 0.12) return null; // (a warp inside the map: a cave mouth, a bridge)
    return dx < dy ? (w.x < m.W / 2 ? 'W' : 'E') : w.y < m.H / 2 ? 'N' : 'S';
  };
  // the joins with their edge, both ways (the camp has no size in NC.MAPS: its edges come from its neighbours' warps)
  const edges = {}, joined = {};
  const add = (a, d, b) => { const E = (edges[a] = edges[a] || []); if (!E.some((e) => e[1] === b)) E.push([d, b]); };
  for (const id in M) {
    if (!isField(id)) continue;
    for (const w of warpsOf(id)) {
      if (!isField(w.to)) continue;
      (joined[id] = joined[id] || new Set()).add(w.to); (joined[w.to] = joined[w.to] || new Set()).add(id);
      const d = dirOf(id, w);
      if (d) { add(id, d, w.to); add(w.to, OPP[d], id); }
    }
  }
  const region = {};
  for (const id in M) if (isField(id) && PAINT[id]) region[id] = PAINT[id][0];
  for (let changed = true; changed;) { // a new section takes its neighbour's region
    changed = false;
    for (const id in M) {
      if (!isField(id) || region[id]) continue;
      const n = [...(joined[id] || [])].find((b) => region[b]);
      if (n) { region[id] = region[n]; changed = true; }
    }
  }

  // ---------------- the grid of each region ----------------
  const LAYOUT = {}; // region -> { pos: { id: [gx, gy] }, x0, y0, cols, rows, cw, ch, ox, oy }
  for (const R of REGIONS) {
    const ids = Object.keys(region).filter((id) => region[id] === R.id);
    if (!ids.length) continue;
    const S = new Set(ids), deg = (i) => (edges[i] || []).filter(([, b]) => S.has(b)).length;
    const mid = (i) => (PAINT[i] ? Math.abs(PAINT[i][1] - 50) + Math.abs(PAINT[i][2] - 50) : 999);
    const start = ids.slice().sort((a, b) => deg(b) - deg(a) || mid(a) - mid(b))[0];
    const pos = { [start]: [0, 0] }, occ = { '0,0': start };
    let q = [start];
    for (;;) {
      while (q.length) {
        const a = q.shift(), [ax, ay] = pos[a];
        for (const [d, b] of edges[a] || []) {
          if (!S.has(b) || pos[b]) continue;
          const [dx, dy] = V[d];
          let t = [ax + dx, ay + dy];
          for (let k = 2; occ[t]; k++) { // taken: beside it, else further on
            const side = [[ax + dx + dy, ay + dy + dx], [ax + dx - dy, ay + dy - dx]].find((c) => !occ[c]);
            if (side) { t = side; break; }
            t = [ax + dx * k, ay + dy * k];
          }
          pos[b] = t; occ[t] = b; q.push(b);
        }
      }
      const rest = ids.filter((i) => !pos[i]);
      if (!rest.length) break;
      // (a map joined to none of its region by an edge warp: beside the rest, on the right)
      let t = [Math.max(...Object.values(pos).map((p) => p[0])) + 1, 0];
      while (occ[t]) t = [t[0], t[1] + 1];
      pos[rest[0]] = t; occ[t] = rest[0]; q = [rest[0]];
    }
    const P = Object.values(pos), x0 = Math.min(...P.map((p) => p[0])), y0 = Math.min(...P.map((p) => p[1]));
    const cols = Math.max(...P.map((p) => p[0])) - x0 + 1, rows = Math.max(...P.map((p) => p[1])) - y0 + 1;
    const cw = Math.min((AW * 0.96) / cols, ((AH * 0.94) / rows) * AR), ch = cw / AR;
    const L = (LAYOUT[R.id] = { pos, x0, y0, cols, rows, cw, ch, ox: (AW - cw * cols) / 2, oy: (AH - ch * rows) / 2 });
    for (const [id, [gx, gy]] of Object.entries(pos)) {
      const cx = L.ox + (gx - x0 + 0.5) * cw, cy = L.oy + (gy - y0 + 0.5) * ch;
      NC.WORLD_PINS[id] = [R.id, +((cx / AW) * 100).toFixed(2), +((cy / AH) * 100).toFixed(2)];
    }
  }
  // (a painted pin left without a tile, e.g. a field in a region the layout skipped, stays where it was)

  // ---------------- a map seen from above ----------------
  function renderMap(id, width) {
    const w = NC.Maps.world(id), k = width / w.W, h = Math.round(w.H * k);
    const cv = document.createElement('canvas');
    cv.width = width; cv.height = h;
    const c = cv.getContext('2d');
    c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
    c.drawImage(w.groundDay || w.ground, 0, 0, width, h);
    c.setTransform(k, 0, 0, k, 0, 0);
    for (const d of w.decals || []) NC.drawSpr(c, d.name, d.x, d.y);
    const list = (w.props || []).filter((p) => NC.SPR[p.name]).concat(w.blocks || []);
    list.sort((a, b) => (a.sort != null ? a.sort : a.y != null ? a.y : a.by) - (b.sort != null ? b.sort : b.y != null ? b.y : b.by));
    for (const o of list) {
      if (o.art) { c.drawImage(o.art.cv, o.bx - o.art.pad, o.by - w.blockH - o.art.pad, o.art.w, o.art.h); continue; }
      NC.drawSpr(c, o.name, o.x, o.y, { flip: o.flip, scale: o.scale });
    }
    c.setTransform(1, 0, 0, 1, 0, 0);
    return cv;
  }

  // ---------------- the region pictures ----------------
  const tiles = {}; // id -> image or canvas
  const url = {}, BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  let started = false, overUrl = '';
  function compose(rid) {
    const L = LAYOUT[rid], cv = document.createElement('canvas');
    cv.width = AW; cv.height = AH;
    const c = cv.getContext('2d');
    c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
    const g = c.createRadialGradient(AW / 2, AH / 2, AH * 0.2, AW / 2, AH / 2, AH * 0.85);
    g.addColorStop(0, '#26303a'); g.addColorStop(1, '#141a22');
    c.fillStyle = g; c.fillRect(0, 0, AW, AH);
    const gap = L.cw * 0.07, r = Math.max(4, L.cw * 0.05), ink = '#2a2435';
    for (const [id, [gx, gy]] of Object.entries(L.pos)) {
      const t = tiles[id], tw = t ? t.naturalWidth || t.width : AR, th = t ? t.naturalHeight || t.height : 1;
      const s = Math.min((L.cw - gap) / tw, (L.ch - gap) / th), w = tw * s, h = th * s;
      const x = L.ox + (gx - L.x0) * L.cw + (L.cw - w) / 2, y = L.oy + (gy - L.y0) * L.ch + (L.ch - h) / 2;
      c.save();
      c.shadowColor = 'rgba(0,0,0,0.55)'; c.shadowBlur = L.cw * 0.08; c.shadowOffsetY = L.cw * 0.025;
      c.beginPath(); c.roundRect(x, y, w, h, r); c.fillStyle = t ? ink : '#3a4558'; c.fill();
      c.restore();
      if (t) { c.save(); c.beginPath(); c.roundRect(x, y, w, h, r); c.clip(); c.drawImage(t, x, y, w, h); c.restore(); }
      c.lineWidth = Math.max(2, L.cw * 0.022); c.strokeStyle = ink;
      c.beginPath(); c.roundRect(x, y, w, h, r); c.stroke();
    }
    return cv;
  }
  function overview(canvases) { // the corner's continent: every region's picture at its spot
    const W = 600, H = 400, cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const c = cv.getContext('2d');
    c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
    c.fillStyle = '#141a22'; c.fillRect(0, 0, W, H);
    for (const R of REGIONS) {
      const src = canvases[R.id], L = LAYOUT[R.id], o = R.over || [50, 50];
      if (!src || !L) continue;
      // (just the tiles, without the picture's dark margin)
      const sw = L.cols * L.cw, sh = L.rows * L.ch, k = Math.min((W * 0.42) / sw, (H * 0.44) / sh), w = sw * k, h = sh * k;
      const x = Math.max(0, Math.min(W - w, (o[0] / 100) * W - w / 2)), y = Math.max(0, Math.min(H - h, (o[1] / 100) * H - h / 2));
      c.drawImage(src, L.ox, L.oy, sw, sh, x, y, w, h);
    }
    return cv;
  }
  const toUrl = (cv) => new Promise((ok) => cv.toBlob((b) => ok(b ? URL.createObjectURL(b) : cv.toDataURL('image/jpeg', 0.9)), 'image/jpeg', 0.9));
  function swap(rid, old, neu) { // the window may already show the old picture
    const a = document.getElementById('mw-art');
    if (a && a.src === old) a.src = neu;
    for (const el of document.querySelectorAll('.mw-scene')) if (el.style.backgroundImage.includes(old)) el.style.backgroundImage = `url(${neu})`;
  }
  async function draw(rids) {
    const canvases = {};
    for (const rid of rids || Object.keys(LAYOUT)) {
      const cv = compose(rid), old = url[rid], neu = await toUrl(cv);
      canvases[rid] = cv; url[rid] = neu;
      swap(rid, old, neu);
      if (old && old.startsWith('blob:')) setTimeout(() => URL.revokeObjectURL(old), 4000);
    }
    if (!rids) {
      const o = await toUrl(overview(canvases)), img = document.querySelector('#mw-over > img');
      if (overUrl.startsWith('blob:')) URL.revokeObjectURL(overUrl);
      overUrl = o;
      if (img) { img.src = o; img.style.visibility = ''; }
    }
  }
  function start() {
    if (started) return;
    started = true;
    const ids = Object.keys(region), missing = [];
    let left = ids.length;
    const done = () => {
      if (--left > 0) return;
      draw().then(() => { if (missing.length) later(missing); });
    };
    for (const id of ids) {
      if (!HAVE[id]) { missing.push(id); done(); continue; }
      const im = new Image();
      im.onload = () => { tiles[id] = im; done(); };
      im.onerror = () => { missing.push(id); done(); };
      im.src = `assets/wmreal/${id}.jpg?v=${HAVE[id]}`;
    }
  }
  function later(ids) { // the maps with no file yet: drawn here, one at a time, then their regions again
    const touched = new Set();
    const step = () => {
      const id = ids.shift();
      if (id) {
        // (its props still streaming in, js/assets.js: they come first, then it is drawn)
        const SP = NC.Sprites;
        let want = [];
        try { want = SP && SP.of ? SP.of.map(id) : []; } catch (e) { want = []; }
        if (want.length && SP.missing(want)) { SP.need(want, 1).then(() => { ids.unshift(id); setTimeout(step, 30); }); return undefined; }
        try { tiles[id] = renderMap(id, TW); touched.add(region[id]); } catch (e) { /* a map that cannot be built here */ }
        return setTimeout(step, 30);
      }
      if (touched.size) draw([...touched]).then(() => draw());
    };
    setTimeout(step, 60);
  }
  // ---------------- zoom and pan: wheel, drag, pinch, the + − ⤢ buttons ----------------
  const zoom = { z: 1, tx: 0, ty: 0, rid: null };
  let hooked = false;
  const $w = () => document.getElementById('mw-world');
  function shownRegion() {
    const a = document.getElementById('mw-art');
    if (a) for (const rid in url) if (a.src === url[rid]) return rid;
    return '';
  }
  function apply() {
    const world = $w();
    if (!world || !world.clientWidth) return;
    const rid = shownRegion();
    if (rid !== zoom.rid) { zoom.rid = rid; zoom.z = 1; zoom.tx = zoom.ty = 0; } // (a new region opens whole)
    const W = world.clientWidth, H = world.clientHeight, z = zoom.z;
    zoom.tx = Math.min(0, Math.max(W * (1 - z), zoom.tx)); zoom.ty = Math.min(0, Math.max(H * (1 - z), zoom.ty));
    const tf = `translate(${zoom.tx.toFixed(1)}px, ${zoom.ty.toFixed(1)}px) scale(${z.toFixed(4)})`;
    for (const id of ['mw-art', 'mw-links', 'mw-pins']) { const el = document.getElementById(id); if (el) el.style.transform = tf; }
    world.style.setProperty('--wmz', z.toFixed(4));
    const L = LAYOUT[rid];
    if (L) {
      const gap = L.cw * 0.07, tw = ((L.cw - gap) / AW) * W, th = ((L.ch - gap) / AH) * H;
      world.style.setProperty('--wmr-tw', tw.toFixed(1) + 'px'); world.style.setProperty('--wmr-th', th.toFixed(1) + 'px');
      world.style.setProperty('--wmr-tws', (tw * z).toFixed(1) + 'px');
      world.classList.toggle('wmr-dense', tw * z < W * 0.16); // (tags on every tile only once a tile is wide enough for one)
    }
    world.classList.toggle('wmr-zoomed', z > 1.001);
  }
  function zoomAt(f, cx, cy) { // (cx, cy: the point that stays put, in the world box's own px)
    const z0 = zoom.z, z1 = Math.max(1, Math.min(5, z0 * f));
    zoom.tx = cx - ((cx - zoom.tx) * z1) / z0; zoom.ty = cy - ((cy - zoom.ty) * z1) / z0; zoom.z = z1;
    apply();
  }
  function hook() {
    const world = $w(), art = document.getElementById('mw-art');
    if (hooked || !world || !art) return;
    hooked = true;
    const local = (e) => { const r = world.getBoundingClientRect(), k = r.width / world.clientWidth || 1; return [(e.clientX - r.left) / k, (e.clientY - r.top) / k]; };
    world.insertAdjacentHTML('beforeend', '<div class="wmr-zoom"><button data-z="1.5" title="ซูมเข้า">+</button><button data-z="0.667" title="ซูมออก">−</button><button data-z="0" title="ดูทั้งภูมิภาค">⤢</button></div>');
    world.querySelector('.wmr-zoom').addEventListener('click', (e) => {
      const b = e.target.closest('[data-z]');
      if (!b) return;
      e.stopPropagation();
      if (+b.dataset.z) zoomAt(+b.dataset.z, world.clientWidth / 2, world.clientHeight / 2);
      else { zoom.z = 1; zoom.tx = zoom.ty = 0; apply(); }
    });
    world.addEventListener('wheel', (e) => {
      if (e.target.closest('.mw-over')) return;
      e.preventDefault();
      const [x, y] = local(e);
      zoomAt(Math.exp(-e.deltaY * 0.0015), x, y);
    }, { passive: false });
    const pts = new Map();
    let pan = null, pinch = null, moved = false;
    world.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.mw-over, .wmr-zoom, .mw-legend')) return;
      pts.set(e.pointerId, local(e)); moved = false;
      if (pts.size === 1) pan = { p: pts.get(e.pointerId), tx: zoom.tx, ty: zoom.ty };
      if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, z: zoom.z }; pan = null; }
    });
    world.addEventListener('pointermove', (e) => {
      if (!pts.has(e.pointerId)) return;
      const p = local(e);
      pts.set(e.pointerId, p);
      if (pinch && pts.size === 2) {
        const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        zoomAt((pinch.z * d) / pinch.d / zoom.z, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
        moved = true;
        return;
      }
      if (!pan) return;
      const dx = p[0] - pan.p[0], dy = p[1] - pan.p[1];
      if (!moved && Math.hypot(dx, dy) < 6) return;
      moved = true;
      zoom.tx = pan.tx + dx; zoom.ty = pan.ty + dy;
      apply();
    });
    const up = (e) => { pts.delete(e.pointerId); if (pts.size < 2) pinch = null; if (!pts.size) pan = null; };
    world.addEventListener('pointerup', up);
    world.addEventListener('pointercancel', up);
    world.addEventListener('click', (e) => { if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; } }, true); // (a drag is not a pick)
    new MutationObserver(apply).observe(art, { attributes: true, attributeFilter: ['src'] }); // (another region)
    // the routes from tile edge to tile edge, not over the pictures (mapwin.js joins the pins' centres, redrawn each time)
    const links = document.getElementById('mw-links');
    const trim = () => {
      const L = LAYOUT[shownRegion()];
      if (!L || !links) return;
      const gap = L.cw * 0.07, hx = ((L.cw - gap) / AW) * 75, hy = ((L.ch - gap) / AH) * 50; // (half a tile, viewBox 150 x 100)
      for (const ln of links.querySelectorAll('line')) {
        if (ln.dataset.wmr) continue;
        ln.dataset.wmr = '1';
        const x1 = +ln.getAttribute('x1'), y1 = +ln.getAttribute('y1'), x2 = +ln.getAttribute('x2'), y2 = +ln.getAttribute('y2');
        const dx = x2 - x1, dy = y2 - y1, t = Math.min(dx ? hx / Math.abs(dx) : Infinity, dy ? hy / Math.abs(dy) : Infinity);
        if (2 * t >= 1) { ln.style.display = 'none'; continue; }
        ln.setAttribute('x1', (x1 + dx * t).toFixed(2)); ln.setAttribute('y1', (y1 + dy * t).toFixed(2));
        ln.setAttribute('x2', (x2 - dx * t).toFixed(2)); ln.setAttribute('y2', (y2 - dy * t).toFixed(2));
        // (a join between tiles that are not side by side crosses other maps: a thin dashed line)
        if (Math.hypot(dx, dy) * (1 - 2 * t) > ((gap / AW) * 150) * 2.2) ln.classList.add('far');
      }
    };
    if (links) { new MutationObserver(trim).observe(links, { childList: true }); trim(); }
    addEventListener('resize', () => setTimeout(apply, 0));
    // (Discord #125, 2026-10-20: the browser resized or minimised while the map was shut, the tiles' frames kept the old
    // size and sat off the pictures until a zoom. A resize then finds the box hidden (no size, nothing done) and the same
    // region opens with the same picture, so nothing measured again. Now the box itself is watched: shown again or
    // resized, the frames are sized to it)
    if (window.ResizeObserver) new ResizeObserver(() => apply()).observe(world);
    setTimeout(apply, 0);
  }

  // (the art is read when the window is built, hidden, at the game's start: the tiles load only once M is open)
  const shown = () => { const w = document.getElementById('mapwin'); return w && !w.hidden; };
  for (const R of REGIONS) {
    if (!LAYOUT[R.id]) continue;
    url[R.id] = `${BLANK}#${R.id}`; // (one per region: mapwin.js compares the picture's src with it)
    Object.defineProperty(R, 'art', {
      configurable: true, enumerable: true,
      get() { if (shown()) { start(); setTimeout(() => { hook(); apply(); }, 0); } return url[R.id]; }, // (measured on every open too)
      set() { /* the composite stays */ },
    });
  }
  document.documentElement.classList.add('wmreal');
  document.head.insertAdjacentHTML('beforeend', '<link rel="stylesheet" href="css/wmreal.css">');

  NC.WMReal = { LAYOUT, region, renderMap, draw, tiles, url: () => url, paint: PAINT, zoom, apply, zoomAt };
})();
