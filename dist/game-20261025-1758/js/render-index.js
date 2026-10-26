/* render-index.js — conservative, ordered candidates for static scene drawing.
   query(world, {x, y, width, height, margin: 50}, profile?) returns borrowed
   {props, blocks, decals} arrays. Consume them before querying that world again.
   Keep the renderer's quality filters and final visible() predicate unchanged.
   Static geometry edits need invalidate(world); canopy fade does not. */
(function () {
  'use strict';
  const NC = window.NC;
  const CELL = 256, MAX_ENTRY_CELLS = 256;
  const SIN_SWAY = Math.sin(0.05), COS_LOSS = 1 - Math.cos(0.05);
  const EMPTY = Object.freeze([]);
  const EMPTY_RESULT = Object.freeze({ props: EMPTY, blocks: EMPTY, decals: EMPTY });
  // Same contact-shadow radii as game.js; other props carry their own shadow.
  const SHADOW = {
    tree: [100, 28], tree2: [92, 26], tent: [140, 30], roundtent: [158, 34], wagon: [135, 26], rack: [82, 14],
    barrel: [38, 12], crates: [74, 18], stone: [58, 16], torch: [18, 6], lamp: [20, 7], grass: [24, 7],
  };
  // No strong list of worlds: eviction from Maps' three-world cache can release
  // its index, buckets and borrowed results together with the world itself.
  const cache = new WeakMap();

  function spriteBounds(p, prop) {
    const s = NC.SPR[p.name];
    if (!s) return null; // drawSpr also ignores unavailable sprites.
    const scale = prop ? p.scale || 1 : 1;
    const w = s.w * scale, h = s.h * scale;
    const ax = -s.ax * w, bx = (1 - s.ax) * w;
    const ay = -s.ay * h, by = (1 - s.ay) * h;
    const flip = prop && p.flip ? -1 : 1;
    let x0 = Math.min(ax * flip, bx * flip), x1 = Math.max(ax * flip, bx * flip);
    let y0 = Math.min(ay, by), y1 = Math.max(ay, by);
    if (prop && p.sway !== undefined) {
      // Bound every angle in [-.05,.05], not just the endpoints: rotation is
      // around the sprite anchor, after the optional horizontal reflection.
      const maxX = Math.max(Math.abs(x0), Math.abs(x1));
      const maxY = Math.max(Math.abs(y0), Math.abs(y1));
      const padX = maxX * COS_LOSS + maxY * SIN_SWAY;
      const padY = maxX * SIN_SWAY + maxY * COS_LOSS;
      x0 -= padX; x1 += padX; y0 -= padY; y1 += padY;
    }
    if (prop) {
      // Preserve all candidates admitted by the old unflipped culling box.
      // The index must not silently fix that renderer's edge behavior.
      x0 = Math.min(x0, ax, bx); x1 = Math.max(x1, ax, bx);
      const sd = SHADOW[p.name] || p.shadow;
      if (sd) {
        const rx = Math.abs(sd[0] * scale), ry = Math.abs(sd[1] * scale);
        x0 = Math.min(x0, -rx); x1 = Math.max(x1, rx);
        y0 = Math.min(y0, -2 - ry); y1 = Math.max(y1, -2 + ry);
      }
    }
    return [p.x + x0, p.y + y0, p.x + x1, p.y + y1];
  }

  function blockBounds(b, world) {
    const h = world.blockH || 0, a = b.art;
    // Include the legacy box, plus the actual drawImage destination/padding.
    const x0 = a ? b.bx - a.pad : b.bx, y0 = a ? b.by - h - a.pad : b.by - h;
    return [Math.min(b.bx, x0), Math.min(b.by - h, y0),
      Math.max(b.bx + 150, a ? x0 + a.w : b.bx + 150),
      Math.max(b.by + 120, a ? y0 + a.h : b.by + 120)];
  }

  function buildGroup(source, kind, world) {
    const g = {
      source, count: source.length, bounds: new Float64Array(source.length * 4),
      columns: new Map(), large: [], cellCount: 0,
      seen: new Uint32Array(source.length), stamp: 0,
      words: new Uint32Array(Math.ceil(source.length / 32)), dirty: [], result: [],
      minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity,
    };
    g.bounds.fill(NaN);
    for (let id = 0; id < source.length; id++) {
      const b = kind === 'blocks' ? blockBounds(source[id], world) : spriteBounds(source[id], kind === 'props');
      if (!b) continue;
      g.bounds.set(b, id * 4);
      if (!b.every(Number.isFinite)) { g.large.push(id); continue; }
      const x0 = Math.floor(b[0] / CELL), y0 = Math.floor(b[1] / CELL);
      const x1 = Math.floor(b[2] / CELL), y1 = Math.floor(b[3] / CELL);
      // Huge artwork belongs in a short overflow list instead of thousands of
      // duplicated bucket entries. Sparse/extreme coordinates cannot grow it.
      if (!Number.isSafeInteger(x0) || !Number.isSafeInteger(y0) || !Number.isSafeInteger(x1) || !Number.isSafeInteger(y1) ||
          (x1 - x0 + 1) * (y1 - y0 + 1) > MAX_ENTRY_CELLS) {
        g.large.push(id); continue;
      }
      g.minX = Math.min(g.minX, x0); g.minY = Math.min(g.minY, y0);
      g.maxX = Math.max(g.maxX, x1); g.maxY = Math.max(g.maxY, y1);
      for (let x = x0; x <= x1; x++) {
        let column = g.columns.get(x);
        if (!column) { column = new Map(); g.columns.set(x, column); }
        for (let y = y0; y <= y1; y++) {
          let bucket = column.get(y);
          if (!bucket) { bucket = []; column.set(y, bucket); g.cellCount++; }
          bucket.push(id);
        }
      }
    }
    return g;
  }

  function mark(g, id, x0, y0, x1, y1) {
    if (g.seen[id] === g.stamp) return;
    g.seen[id] = g.stamp;
    const k = id * 4, b = g.bounds;
    // Inclusive edges are conservative; the renderer keeps its strict test.
    if (b[k + 2] < x0 || b[k] > x1 || b[k + 3] < y0 || b[k + 1] > y1) return;
    const word = id >>> 5;
    if (!g.words[word]) g.dirty.push(word);
    g.words[word] |= 1 << (id & 31);
  }
  const ascending = (a, b) => a - b;
  function queryGroup(g, x0, y0, x1, y1) {
    g.result.length = 0;
    g.stamp = (g.stamp + 1) >>> 0;
    if (!g.stamp) { g.seen.fill(0); g.stamp = 1; }
    const cx0 = Math.max(g.minX, Math.floor(x0 / CELL)), cy0 = Math.max(g.minY, Math.floor(y0 / CELL));
    const cx1 = Math.min(g.maxX, Math.floor(x1 / CELL)), cy1 = Math.min(g.maxY, Math.floor(y1 / CELL));
    if (cx1 >= cx0 && cy1 >= cy0 && (cx1 - cx0 + 1) * (cy1 - cy0 + 1) > Math.max(256, g.cellCount * 2)) {
      // Wide zoom/sparse maps: a bounded scan is cheaper than empty-cell walks.
      for (let id = 0; id < g.count; id++) if (!Number.isNaN(g.bounds[id * 4])) mark(g, id, x0, y0, x1, y1);
    } else if (cx1 >= cx0 && cy1 >= cy0) {
      for (let x = cx0; x <= cx1; x++) {
        const column = g.columns.get(x);
        if (!column) continue;
        for (let y = cy0; y <= cy1; y++) {
          const bucket = column.get(y);
          if (bucket) for (let i = 0; i < bucket.length; i++) mark(g, bucket[i], x0, y0, x1, y1);
        }
      }
    }
    for (let i = 0; i < g.large.length; i++) mark(g, g.large[i], x0, y0, x1, y1);
    // Sort only touched 32-entry words; bit iteration restores exact source
    // order without a per-frame Set, candidate-object allocation or full scan.
    g.dirty.sort(ascending);
    for (let i = 0; i < g.dirty.length; i++) {
      const word = g.dirty[i];
      let bits = g.words[word];
      while (bits) {
        const bit = 31 - Math.clz32(bits & -bits);
        g.result.push(g.source[word * 32 + bit]);
        bits = (bits & (bits - 1)) >>> 0;
      }
      g.words[word] = 0;
    }
    g.dirty.length = 0;
  }

  function query(world, viewport, _profile) {
    if (!world || !viewport) return EMPTY_RESULT;
    const margin = Math.max(0, viewport.margin === undefined ? 50 : viewport.margin);
    const x0 = viewport.x - margin, y0 = viewport.y - margin;
    const x1 = viewport.x + viewport.width + margin, y1 = viewport.y + viewport.height + margin;
    if (!Number.isFinite(x0) || !Number.isFinite(y0) || !Number.isFinite(x1) || !Number.isFinite(y1) || viewport.width < 0 || viewport.height < 0) return EMPTY_RESULT;
    const props = world.props || EMPTY, blocks = world.blocks || EMPTY, decals = world.decals || EMPTY;
    let index = cache.get(world);
    if (!index || index.sprites !== NC.SPR || index.blockH !== world.blockH ||
        index.props.source !== props || index.props.count !== props.length ||
        index.blocks.source !== blocks || index.blocks.count !== blocks.length ||
        index.decals.source !== decals || index.decals.count !== decals.length) {
      index = { props: buildGroup(props, 'props', world), blocks: buildGroup(blocks, 'blocks', world), decals: buildGroup(decals, 'decals', world), sprites: NC.SPR, blockH: world.blockH };
      index.result = { props: index.props.result, blocks: index.blocks.result, decals: index.decals.result };
      cache.set(world, index);
    }
    // Always reserve maximum sway/contact-shadow extents, independent of the
    // quality profile. Switching presets needs no index rebuild or mutation.
    queryGroup(index.props, x0, y0, x1, y1);
    queryGroup(index.blocks, x0, y0, x1, y1);
    queryGroup(index.decals, x0, y0, x1, y1);
    return index.result;
  }
  NC.RenderIndex = { query, invalidate: (world) => cache.delete(world), cellSize: CELL };
})();
