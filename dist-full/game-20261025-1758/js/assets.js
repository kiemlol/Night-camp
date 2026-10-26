/* assets.js — loads the sprites listed in assets/manifest.js and draws them by their ground anchor */
(function () {
  'use strict';
  const NC = window.NC;
  const S = (NC.SPR = {});
  const tintCache = new Map();

  // ---------------- loading: the start set first, the rest streamed behind the game (2026-10-18) ----------------
  // The live site sent all ~7,600 pictures (437 MB) before the character select. Now every manifest sprite has its
  // NC.SPR entry from the start (so "is there art for X" answers as before: NC.itemReady, the theme filters), but until
  // its file arrives the entry's img is a 1x1 see-through canvas (ready: false; .src = the file, for <img> tags), then
  // the same entry gets the picture. NC.loadAssets resolves once the START set is in: everything outside LATER (the UI,
  // the hero rig, the camp, the creator's parts, the story NPCs (they stand on many maps, the camp too), the PvP lake
  // (pvparena.js paints its ground from it as the map is built)...). LATER waits until NC.Sprites.release() (js/stream.js, once the
  // game runs), then streams a few at a time; whatever is asked for (NC.Sprites.need: a map being entered, the hero's
  // gear, an item shown; NC.drawSpr asks for what it is told to draw) jumps the queue. ?stream=0 = load all first, as before.
  const LATER = /^assets\/(maps|monsters|wcat|wcat_area|wpn_hd|class2|class3|jobs3|gwar|village|root|life|dunfx|baph|baphspine|petspine|lost|samurai|outfits|lower|hats2|fashion|glasses|greatswords|swords|moonblade|studio_chars)\/|^assets\/shop\/mat_/;
  const FIRST_TOO = /^assets\/life\/(npc_|moon_tree|ore_|stump_)/; // (the life-skill teachers stand in the camp; the woodcutting and mining spots appear on many fields)
  const local = location.protocol === 'file:' || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  const streamOn = true;
  // A few dozen at a time, not all at once: the live CDN (play.nightcamp.app, 2026-10-18) answered a 7,000-picture burst
  // with ~100 random 503s, so outfit pieces went missing. On a public host a failed picture is asked again a little
  // later (the CDN keeps an error ~10 s); on this PC a missing file is reported at once, as before.
  const RETRY = local ? [] : [1500, 4000, 11000];
  const FAILED_RETRY_MS = 30000; // an on-screen/explicit request may retry later; never on every draw frame
  // a web build with WebP copies (tools/online/webp_build.py: lossless, the same pixels in ~70% of the bytes) fetches
  // those; the entries keep their .png src (and a copy that fails falls back to its PNG)
  const WB = NC.WEBP_BUILD && NC.WEBP_BUILD.dirs, wbHave = WB ? new Set() : null;
  if (WB) for (const d in WB) for (const f of WB[d].split(',')) wbHave.add(d + f + '.png');
  const fileOf = (src) => (wbHave && wbHave.has(src) ? src.slice(0, -4) + '.webp' : src);
  // how many may load at once: [needed now, soon (the hero's things), the background stream]
  const LIMIT = local ? [256, 96, 48] : [48, 16, 12];
  const man = {}; // every sprite this loader knows (name -> its manifest entry)
  const st = new Map(); // name -> { pri: 0 now / 1 soon / 2 background, state: 'queued' | 'loading', tries, waits: [] }
  const Q = [[], [], []]; Q.forEach((q) => { q.i = 0; });
  let active = 0, held = streamOn, total = 0, loaded = 0;
  const got = new Set(); // (in: never asked again)
  const failed = new Map(); // name -> earliest retry time; metadata stays in SPR so map generation never changes
  const listeners = [], aliases = new Map();
  const first = []; // the start set (js/loading.js counts it)
  // (a picture still on its way: drawn, it is nothing; asked, it says so like an <img> still loading: complete false,
  // naturalWidth 0, so the effects' "loaded yet?" checks wait for it)
  const holder = (src) => { const c = document.createElement('canvas'); c.width = c.height = 1; c.naturalWidth = c.naturalHeight = 0; c.complete = false; c.placeholder = true; c.src = src; return c; };

  function finish(name, ok, img) {
    const s = st.get(name);
    st.delete(name); active--;
    if (ok) {
      const e = S[name] || (S[name] = Object.assign({ name }, man[name]));
      e.img = img; delete e.ready; delete e.failed;
      failed.delete(name);
      got.add(name); loaded++; NC.Sprites.ver++;
      for (const f of listeners) { try { f(name); } catch (err) { console.warn('sprite listener', err); } }
    } else {
      console.warn('missing sprite', name);
      // The map builders use dimensions, existence and seeded random draws from
      // these entries. Deleting one changes collision/placement relative to the server.
      if (S[name] && S[name].ready === false) S[name].failed = true;
      failed.set(name, Date.now() + FAILED_RETRY_MS);
    }
    if (s) for (const w of s.waits) w();
    pump();
  }
  function start(name, s) {
    s.state = 'loading'; active++;
    if (s.held) { // an effect's own picture, held during the start (below): now it is fetched
      const img = s.held, url = img.__ncHeld;
      const end = () => { img.removeEventListener('load', end); img.removeEventListener('error', end); st.delete(name); active--; pump(); };
      if (!url) { end(); return; }
      img.addEventListener('load', end); img.addEventListener('error', end);
      img.__ncHeld = null; srcD.set.call(img, url);
      return;
    }
    const go = () => {
      const img = new Image();
      if (s.pri === 0 && 'fetchPriority' in img) img.fetchPriority = 'high';
      const src = s.png ? man[name].src : fileOf(man[name].src);
      img.onload = () => finish(name, true, img);
      img.onerror = () => {
        if (src !== man[name].src && !s.png) { s.png = true; go(); return; } // (no WebP copy there: the PNG)
        if (s.tries < RETRY.length) setTimeout(go, RETRY[s.tries++]); else finish(name, false);
      };
      if (srcD && srcD.set) srcD.set.call(img, src); else img.src = src; // (never held, below)
    };
    go();
  }
  function pump() {
    for (let p = 0; p < 3; p++) {
      if (p === 2 && held) break;
      const q = Q[p];
      while (active < LIMIT[p] && q.i < q.length) {
        const n = q[q.i++], s = st.get(n);
        if (s && s.state === 'queued' && s.pri === p) start(n, s);
      }
      if (q.i > 4096 && q.i === q.length) { q.length = 0; q.i = 0; }
    }
  }
  // ask for sprites: pri 0 = now (a map being entered, what is on screen), 1 = soon, 2 = some time; resolves when all
  // of them have arrived (or failed). Names that are not streamed sprites, or are in already, count as done.
  function retryFailed(name, pri) {
    const at = failed.get(name);
    if (at === undefined || Date.now() < at || st.has(name)) return;
    failed.delete(name);
    st.set(name, { pri, state: 'queued', tries: 0, waits: [] });
    Q[pri].push(name);
  }
  function need(names, pri) {
    pri = pri === undefined ? 0 : pri;
    const waits = [];
    const seen = new Set();
    for (let n of names || []) {
      n = aliases.get(n) || n;
      if (seen.has(n)) continue;
      seen.add(n);
      retryFailed(n, pri);
      const s = st.get(n);
      if (!s) continue;
      if (pri < s.pri) { s.pri = pri; if (s.state === 'queued') Q[pri].push(n); }
      waits.push(new Promise((ok) => s.waits.push(ok)));
    }
    pump();
    return waits.length ? Promise.all(waits) : Promise.resolve();
  }
  const ready = (name) => { const e = S[name]; return !!e && e.ready !== false; };

  NC.Sprites = {
    ver: 0, LATER,
    ready, need,
    // how many of names are still on their way
    missing: (names) => { let n = 0; for (const k of names || []) if (st.has(k)) n++; return n; },
    want: (name) => {
      name = aliases.get(name) || name;
      retryFailed(name, 0);
      const s = st.get(name);
      if (s && s.pri > 0) { NC.Sprites.late.add(name); need([name], 0); }
      else if (s && s.state === 'queued') pump();
    }, // (NC.drawSpr: on screen now)
    late: new Set(), // (what was drawn before anything had asked for it: pop-in to look at, ?streamlog)
    // a sprite made from another one (an elite's hue-shifted copy, js/monsters6.js): drawing it asks for that one
    alias: (name, base) => { aliases.set(name, base); },
    release() {
      if (holdingImgs) { // the effects' held pictures go first in the background stream
        holdingImgs = false;
        const q = heldImgs.map((img, i) => { const n = '@img' + i; st.set(n, { pri: 2, state: 'queued', tries: 0, waits: [], held: img }); return n; });
        Q[2] = q.concat(Q[2].slice(Q[2].i)); Q[2].i = 0;
        heldImgs.length = 0;
      }
      held = false; pump();
    },
    hold() { held = true; },
    on(fn) { listeners.push(fn); },
    stats: () => ({ total, loaded, failed: failed.size, waiting: st.size, active, held }),
    known: (name) => !!man[name],
    startSet: () => first,
    manifest: man,
  };
  NC.sprReady = ready;

  // ---------------- the effects' own pictures wait for the start too ----------------
  // Many effect files fetch their pictures themselves as they load (new Image, .src = ...: assets/vfx3d, vfx2d, maplefx,
  // maplebow, ...: ~40 MB), right while the start set loads. Until NC.Sprites.release() such a picture is held: it
  // looks like one still loading (complete false, no size, the same .src), then it streams first in the background.
  const HOLD_SRC = /(^|\/)assets\/(vfx3d\/|vfx2d\/|maplefx\/|maplebow\/|rootbound\/|voidcomet\/|samurai\/|prologue\/|resultfx\/|hitfeel\/|root\/ui_|kui\/(guild_hall|rank_stage))/; // (+ the Dark Root, guild hall and ranks windows' big pictures)
  const imgProto = HTMLImageElement.prototype;
  const srcD = Object.getOwnPropertyDescriptor(imgProto, 'src'), doneD = Object.getOwnPropertyDescriptor(imgProto, 'complete');
  const heldImgs = [];
  let holdingImgs = streamOn && !!(srcD && srcD.set && doneD && doneD.get);
  if (holdingImgs) {
    Object.defineProperty(imgProto, 'src', {
      configurable: true, enumerable: srcD.enumerable,
      get() { return this.__ncHeld ? new URL(this.__ncHeld, document.baseURI).href : srcD.get.call(this); },
      set(v) {
        if (holdingImgs && typeof v === 'string' && HOLD_SRC.test(v)) { if (!this.__ncHeld) heldImgs.push(this); this.__ncHeld = v; return; }
        this.__ncHeld = null;
        srcD.set.call(this, v);
      },
    });
    Object.defineProperty(imgProto, 'complete', { configurable: true, enumerable: doneD.enumerable, get() { return this.__ncHeld ? false : doneD.get.call(this); } });
  }
  NC.needSprites = need;

  NC.loadAssets = function () {
    // + the field-map props (assets/maps/), the fashion costumes (assets/fashion/), the monsters (assets/monsters/) and
    // the trade art (assets/shop/: materials, coin, the merchant and his stall), the camp (assets/camp/: js/camp.js)
    Object.assign(man, NC.ASSET_MANIFEST, NC.ASSET_MANIFEST_MAPS, NC.ASSET_MANIFEST_FASHION, NC.ASSET_MANIFEST_MONSTERS, NC.ASSET_MANIFEST_SHOP,
      NC.ASSET_MANIFEST_CAMP);
    for (const name in man) {
      if (st.has(name) || got.has(name) || failed.has(name) || !man[name] || !man[name].src) continue;
      const later = streamOn && LATER.test(man[name].src) && !FIRST_TOO.test(man[name].src);
      S[name] = Object.assign({ img: holder(man[name].src), name, ready: false }, man[name]);
      st.set(name, { pri: later ? 2 : 0, state: 'queued', tries: 0, waits: [] });
      Q[later ? 2 : 0].push(name);
      if (!later) first.push(name);
      total++;
    }
    return need(first, 0).then(() => { try { performance.mark('nc-startset'); } catch (e) { /* old browser */ } });
  };

  // silhouette of a sprite filled with one colour (hit flash, dash afterimages)
  NC.tinted = function (name, colour) {
    const key = name + colour;
    if (tintCache.has(key)) return tintCache.get(key);
    const s = S[name];
    if (!s || s.ready === false) return (s && s.img) || holder(''); // (not in yet: nothing, and nothing kept)
    const cv = document.createElement('canvas');
    cv.width = s.img.width; cv.height = s.img.height;
    const c = cv.getContext('2d');
    c.drawImage(s.img, 0, 0);
    c.globalCompositeOperation = 'source-in';
    c.fillStyle = colour;
    c.fillRect(0, 0, cv.width, cv.height);
    tintCache.set(key, cv);
    return cv;
  };

  /* draw a sprite with its anchor (feet) at x,y in world units.
     o: { flip, scale, sx, sy (squash), rot (around the anchor), alpha, tint: [colour, amount], img } */
  NC.drawSpr = function (ctx, name, x, y, o) {
    const s = S[name];
    if (!s) return;
    if (s.ready === false && !(o && o.img)) {
      NC.Sprites.want(name);
      // A small loading cue at a failed solid prop's feet, not its collision
      // footprint. Passable plants/decor stay clear and no large bitmap is made.
      const D = (NC.FIELD_PROPS || {})[name] || (NC.CAMP_PROPS || {})[name], sc = (o && o.scale) || 1;
      if (!s.failed || !D || D.kind === 'low' || (D.legs && !D.legs.length) || (NC.propIsWalkThrough && NC.propIsWalkThrough(name, D.kind, sc))) return;
      ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
      if (o && o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
      ctx.fillStyle = 'rgba(38,36,43,.8)'; ctx.strokeStyle = '#bcb29a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, -8, 20, 12, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#e8d9b5';
      for (const dx of [-8, 0, 8]) { ctx.beginPath(); ctx.arc(dx, -8, 2, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
      return;
    } // (still on its way: it jumps the queue)
    o = o || {};
    const sc = o.scale || 1;
    const w = s.w * sc * (o.sx || 1), h = s.h * sc * (o.sy || 1);
    ctx.save();
    ctx.translate(x, y);
    if (o.rot) ctx.rotate(o.rot);
    if (o.flip) ctx.scale(-1, 1);
    if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
    const dx = -s.ax * w, dy = -s.ay * h;
    ctx.drawImage(o.img || s.img, dx, dy, w, h);
    if (o.tint && o.tint[1] > 0) {
      ctx.globalAlpha *= o.tint[1];
      ctx.drawImage(NC.tinted(name, o.tint[0]), dx, dy, w, h);
    }
    ctx.restore();
  };
})();
