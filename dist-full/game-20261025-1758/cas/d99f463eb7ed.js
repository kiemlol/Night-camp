/* stream.js — what the game needs NOW from the sprites that stream in behind it (js/assets.js, 2026-10-18).
   - The start: NC.loadAssets also waits for the art the start map names (its definition, biome, dungeon theme and
     NC.ROSTER: the map is not built here, game.js builds it as before) and the saved gear; the loading bar says
     "กำลังโหลดแผนที่…". Then the background stream starts: the maps next to this one and the hero's bag first, then
     everything else (js/assets.js: release()).
   - A warp (NC.Maps.go): the art the next map names comes first behind a veil with the map's name and a progress
     line, then the warp goes on as before; once the map is built, whatever else it shows is checked the same way
     (NC.Maps.enter: the server's map online, a respawn; maps.js's own warp is watched for). The first map: after HUD.init.
   - Heroes (NC.drawHero, the HeroSpine previews of the lobby) ask for their gear's art when they are drawn; item icons
     (NC.itemIcon) not ready yet come back as an empty canvas that gets the icon drawn in once its art arrives (no blank
     icon is kept). Monsters ask through NC.drawSpr (js/assets.js).
   Which sprites a thing uses: every string in it that names a sprite, an item (its sprite, icon, head and rig parts)
   or a monster species (it and its _b pose). Load right before game.js (the outermost wrappers). */
(function () {
  'use strict';
  const NC = window.NC, SP = NC.Sprites;
  if (!SP) return;
  const man = SP.manifest;
  const now = () => performance.now();

  // ---------------- which sprites a thing uses ----------------
  let sorted = null;
  function withPrefix(pre, out) {
    const a = sorted || (sorted = Object.keys(man).sort());
    let lo = 0, hi = a.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (a[m] < pre) lo = m + 1; else hi = m; }
    for (let i = lo; i < a.length && a[i].startsWith(pre); i++) out.add(a[i]);
    return out;
  }
  const itemSets = new Map(), speciesSets = new Map();
  function itemNames(id, out) {
    let set = itemSets.get(id);
    if (!set) {
      set = new Set();
      itemSets.set(id, set);
      const it = NC.ITEMS && NC.ITEMS[id];
      if (it) {
        scan(it, set, 3, false);
        if (it.rig) for (const p of ['rig_', 'pants_', 'shoes_', 'legs_']) withPrefix(p + it.rig + '_', set);
        if (NC.itemSprite) { const s = NC.itemSprite(it); if (man[s]) set.add(s); }
      }
    }
    for (const n of set) out.add(n);
    return out;
  }
  function speciesNames(type, out) {
    let set = speciesSets.get(type);
    if (!set) {
      set = new Set();
      speciesSets.set(type, set);
      if (man[type]) set.add(type);
      if (man[type + '_b']) set.add(type + '_b');
      const S = NC.SPECIES && NC.SPECIES[type];
      if (S) {
        scan(S, set, 3, false);
        if (S.eliteOf && S.eliteOf !== type) speciesNames(S.eliteOf, set);
      }
    }
    for (const n of set) out.add(n);
    return out;
  }
  // every string in o (depth-limited) that names a sprite; deep: also the items and species it names (a map's bots'
  // gear, its spawns). An item's or a species' own scan is flat (a monster's drop list is not its picture).
  function scan(o, out, depth, deep, seen) {
    if (o == null) return out;
    if (typeof o === 'string') {
      if (man[o]) out.add(o);
      if (deep && NC.ITEMS && NC.ITEMS[o]) itemNames(o, out);
      if (deep && NC.SPECIES && NC.SPECIES[o]) speciesNames(o, out);
      return out;
    }
    if (typeof o !== 'object' || depth <= 0) return out;
    if (o instanceof HTMLCanvasElement || o instanceof HTMLImageElement || ArrayBuffer.isView(o) || o instanceof ArrayBuffer || (typeof Node !== 'undefined' && o instanceof Node)) return out;
    seen = seen || new Set();
    if (seen.has(o)) return out;
    seen.add(o);
    if (Array.isArray(o)) { for (let i = 0; i < o.length; i++) scan(o[i], out, depth - 1, deep, seen); }
    else for (const k in o) { const v = o[k]; if (typeof v !== 'function') scan(v, out, depth - 1, deep, seen); }
    return out;
  }
  // a built map: its props, landmarks, spawns (+ their species), the camp's own monsters
  function worldNames(w, out) {
    scan(w, out, 5, true);
    for (const s of w.spawns || []) if (s) speciesNames(s[0], out);
    // (who really fills the spawn slots there: monsters.js ROSTER, by zone)
    const R = w.mapId && NC.ROSTER && NC.ROSTER[w.mapId];
    if (R) scan(R, out, 5, true);
    if (w.camp) for (const s of NC.ENEMY_SPAWNS || []) speciesNames(s[0], out);
    return out;
  }
  // a map by its id: built (NC.Maps.world keeps the last few built maps, so entering it after this is instant)
  function mapNames(id, out) {
    out = out || new Set();
    try { worldNames(NC.Maps.world(id), out); } catch (err) { console.warn('stream: map', id, err); }
    return out;
  }
  // a map not built: what its definition and its biome name (for the background order; nothing is built)
  function mapGuess(id, out) {
    const def = NC.MAPS && NC.MAPS[id];
    if (!def) return out;
    scan(def, out, 5, true);
    if (def.biome && NC.BIOMES && NC.BIOMES[def.biome]) scan(NC.BIOMES[def.biome], out, 5, false);
    const th = def.dungeon && def.dungeon.theme && NC.DUNGEON_THEMES && NC.DUNGEON_THEMES[def.dungeon.theme];
    if (th) scan(th, out, 5, false); // (a dungeon floor: its theme's walls, glows and props)
    if (def.dungeon) withPrefix('d_', out); // (+ every floor's stairs, spike traps, chests and torches)
    for (const s of def.spawns || []) if (s) speciesNames(s[0], out);
    for (const t in def.lv || {}) speciesNames(t, out);
    if (NC.ROSTER && NC.ROSTER[id]) scan(NC.ROSTER[id], out, 5, true);
    return out;
  }
  NC.Sprites.of = { item: (id) => [...itemNames(id, new Set())], species: (t) => [...speciesNames(t, new Set())], map: (id) => [...mapNames(id)], guess: (id) => [...mapGuess(id, new Set())], world: (w) => [...worldNames(w, new Set())], scan: (o) => [...scan(o, new Set(), 6, true)] };

  // resolves when names are in, or after ms (a slow line never locks the game)
  const waitFor = (names, ms) => new Promise((ok) => { SP.need(names, 0).then(ok); setTimeout(ok, ms); });

  // ---------------- the veil while a map's art loads ----------------
  let veil = null, veilT = null, veilN = 0;
  function showVeil(id, names) {
    veilN++;
    const def = NC.MAPS[id] || {};
    if (!veil) {
      veil = document.createElement('div');
      veil.className = 'nc-mapload';
      veil.style.cssText = 'position:fixed;inset:0;z-index:51;display:flex;flex-direction:column;align-items:center;justify-content:center;' +
        'background:#120f1c;opacity:0;pointer-events:none;transition:opacity .28s ease;color:#f3e7cf;font-family:Mitr,sans-serif;';
      veil.innerHTML = '<div style="font-size:clamp(22px,3.2vw,44px);font-weight:600;letter-spacing:.02em"></div>' +
        '<div style="font-size:clamp(14px,1.6vw,22px);opacity:.7;margin-top:.4em"></div>' +
        // (the name and levels sit exactly where maps.js's own curtain puts them: the two cross-fade without a jump)
        '<div style="position:absolute;left:50%;top:calc(50% + clamp(48px,6vw,84px));transform:translateX(-50%);width:min(320px,60vw);height:6px;border-radius:3px;background:rgba(255,255,255,.12);overflow:hidden"><div style="height:100%;width:0;background:linear-gradient(90deg,#ff9a3c,#ffd27a);transition:width .2s"></div></div>' +
        '<div style="position:absolute;left:0;right:0;text-align:center;top:calc(50% + clamp(62px,7.4vw,104px));font-size:clamp(12px,1.3vw,16px);opacity:.55"></div>';
      document.body.appendChild(veil);
    }
    veil.children[0].textContent = def.name || '';
    veil.children[1].textContent = def.lvText || '';
    const total = Math.max(1, SP.missing(names));
    const tick = () => {
      const left = SP.missing(names), f = 1 - left / total;
      veil.children[2].firstChild.style.width = (f * 100).toFixed(1) + '%';
      veil.children[3].textContent = left ? `กำลังโหลดแผนที่… ${Math.round(f * 100)}%` : '';
    };
    tick();
    clearInterval(veilT);
    veilT = setInterval(tick, 120);
    void veil.offsetWidth;
    veil.style.opacity = 1;
  }
  function hideVeil(after) {
    setTimeout(() => { if (--veilN > 0) return; veilN = 0; clearInterval(veilT); if (veil) veil.style.opacity = 0; }, after || 0);
  }

  // ---------------- the start ----------------
  // the map game.js will start on (the same choice as NC.Maps.first)
  function startMap() {
    if (!NC.ONLINE) {
      try { const s = JSON.parse(localStorage.getItem('nightcamp.map.v1') || 'null'); if (s && NC.MAPS[s.map]) return s.map; } catch (e) { /* no save */ }
    }
    return 'camp';
  }
  // the saved hero's gear (offline; online heroes come from the server and ask when drawn)
  function savedGear(out) {
    for (const id of ['hair_spiky', 'top_traveler', 'pants_traveler', 'sword']) itemNames(id, out); // (a new hero's, js/items.js START)
    if (NC.ONLINE) return out;
    try {
      const s = JSON.parse(localStorage.getItem('nightcamp.save.v1') || 'null');
      for (const k in (s && s.equip) || {}) if (typeof s.equip[k] === 'string') itemNames(s.equip[k], out);
    } catch (e) { /* no save */ }
    return out;
  }
  // (a promise handed back: the loading waits for it, js/assets.js)
  (NC.assetsLoaded || (NC.assetsLoaded = [])).push(() => {
    sorted = null;
    // (the map is not built here: game.js builds it as before, some builders look at game.world as they finish)
    const want = mapGuess(startMap(), new Set());
    savedGear(want);
    const list = [...want];
    SP.boot = { names: list, total: SP.missing(list) };
    const t0 = now();
    return waitFor(list, 30000).then(() => {
      SP.boot = null;
      SP.startedAt = now();
      try { performance.mark('nc-firstmap'); } catch (e) { /* old browser */ }
      if (SP.missing(list)) console.warn('stream: started with', SP.missing(list), 'of the first map\'s pictures still loading');
      setTimeout(background, 1200);
    });
  });

  // ---------------- the background order: next to here, the hero's things, then the rest ----------------
  function background() {
    const g = NC.game, near = new Set();
    if (g && g.player) {
      for (const k in g.player.equip || {}) if (typeof g.player.equip[k] === 'string') itemNames(g.player.equip[k], near);
      for (const id of g.player.owned || []) itemNames(id, near);
      for (const c of g.player.bag || []) if (c && c.id) itemNames(c.id, near);
    }
    nextTo(near);
    SP.need([...near], 1);
    SP.release();
  }
  // the maps the warps of the hero's map lead to
  function nextTo(out) {
    const g = NC.game, w = g && g.world;
    if (!w) return out;
    for (const wp of w.warps || []) if (wp && wp.to) mapGuess(wp.to, out);
    for (const pt of g.portals || []) if (pt && pt.to) mapGuess(pt.to, out);
    return out;
  }

  // ---------------- maps: the art first, then the warp ----------------
  const hookMaps = () => {
    if (!NC.Maps || NC.Maps.streamed) return;
    NC.Maps.streamed = true;
    const baseGo = NC.Maps.go, baseEnter = NC.Maps.enter;
    let going = false;
    NC.Maps.go = function (game, id, at) {
      if (going) return undefined;
      if (!NC.MAPS[id]) return baseGo.apply(this, arguments);
      const want = [...mapGuess(id, new Set())]; // (what its definition and biome name; the rest after it is built, below)
      if (!SP.missing(want)) { const r = baseGo.apply(this, arguments); watchEnter(game, id); return r; }
      going = true;
      const self = this, args = arguments, was = game.paused;
      game.paused = true; game.warping = true;
      showVeil(id, want);
      waitFor(want, 25000).then(() => {
        game.paused = was; game.warping = false; going = false;
        try { baseGo.apply(self, args); watchEnter(game, id); } finally { hideVeil(600); }
      });
      return undefined;
    };
    // a map entered without a warp (the server's map online, a respawn): the veil until its art is in
    NC.Maps.enter = function (game, id) {
      const r = baseEnter.apply(this, arguments);
      afterEnter(game, id);
      return r;
    };
    // (maps.js's own warp enters through its inner function: watched for here)
    function watchEnter(game, id) {
      if (NC.ONLINE) return; // (online the server's map comes through NC.Maps.enter)
      const t0 = now(), iv = setInterval(() => {
        if (game.mapId === id && game.world && game.world.mapId === id) { clearInterval(iv); afterEnter(game, id); }
        else if (now() - t0 > 4000) clearInterval(iv);
      }, 40);
    }
    NC.Maps.watchEnter = watchEnter;
    function afterEnter(game, id) {
      try {
        const want = worldNames(game.world, new Set());
        for (const e of game.enemies || []) if (e && e.type) speciesNames(e.type, want);
        const list = [...want];
        if (SP.missing(list)) {
          showVeil(id, list);
          // (offline the world waits under the veil: held once the warp has handed the game back, then let go)
          const online = NC.ONLINE;
          let held = false;
          if (!online) Promise.resolve().then(() => { if (SP.missing(list) && !game.paused) { game.paused = held = true; } });
          waitFor(list, 25000).then(() => { if (held && game.paused) game.paused = false; hideVeil(150); });
        }
        const near = nextTo(new Set());
        SP.need([...near], 1);
        // (what the map's own features put on it a moment later: the life-skill spots, the guild fires...)
        setTimeout(() => { if (game.world) SP.need([...worldNames(game.world, new Set())], 0); }, 400);
      } catch (err) { console.warn('stream: enter', err); }
    }
  };
  hookMaps();

  // the first map: game.js builds it after NC.loadAssets (the art its definition named is in by then); anything else
  // it shows still on its way: the veil (offline; online the lobby stands over the camp)
  if (NC.HUD && NC.HUD.init && !NC.ONLINE) {
    const baseInit = NC.HUD.init;
    NC.HUD.init = function (game) {
      const r = baseInit.apply(this, arguments);
      try {
        const want = worldNames(game.world, new Set());
        for (const e of game.enemies || []) if (e && e.type) speciesNames(e.type, want);
        const list = [...want];
        if (SP.missing(list)) {
          showVeil(game.mapId, list);
          waitFor(list, 25000).then(() => hideVeil(150));
        }
      } catch (err) { console.warn('stream: first map', err); }
      return r;
    };
  }

  // ---------------- heroes and item icons ask for their art ----------------
  const eqSeen = new WeakMap();
  function wantEquip(eq) {
    if (!eq || typeof eq !== 'object') return;
    const t = now(), last = eqSeen.get(eq);
    if (last && t - last.t < 500) return;
    let key = '';
    for (const k in eq) if (typeof eq[k] === 'string') key += eq[k] + '|';
    if (last && last.key === key) { last.t = t; return; }
    eqSeen.set(eq, { t, key });
    const out = new Set();
    for (const k in eq) if (typeof eq[k] === 'string' && NC.ITEMS[eq[k]]) itemNames(eq[k], out);
    if (out.size && SP.missing(out)) SP.need([...out], 0);
  }
  NC.Sprites.wantEquip = wantEquip;
  // how many of a hero's gear pictures are still on their way (and asks for them): for the caches that keep a drawn hero
  const eqMiss = new WeakMap();
  NC.Sprites.equipMissing = function (eq) {
    if (!eq || typeof eq !== 'object') return 0;
    let key = '';
    for (const k in eq) if (typeof eq[k] === 'string') key += eq[k] + '|';
    let m = eqMiss.get(eq);
    if (!m || m.key !== key) {
      const out = new Set();
      for (const k in eq) if (typeof eq[k] === 'string' && NC.ITEMS[eq[k]]) itemNames(eq[k], out);
      eqMiss.set(eq, (m = { key, names: [...out], asked: false }));
    }
    if (!m.names.length) return 0;
    const n = SP.missing(m.names);
    if (!n) { m.names = []; return 0; }
    if (!m.asked) { m.asked = true; SP.need(m.names, 0); }
    return n;
  };
  const hookHeroes = () => {
    // the HUD's portrait and minimap marker are drawn once per gear change (hud.js refreshHead): drawn again when the
    // gear's art has arrived (an online hero's gear comes with the server's first snapshot, after the start)
    const H = NC.HUD;
    if (H && H.refreshHead && !H.refreshHead.streamed) {
      const base = H.refreshHead;
      H.refreshHead = function (game) {
        const r = base.apply(this, arguments);
        const eq = game && game.player && game.player.equip;
        if (eq && NC.Sprites.equipMissing(eq)) {
          const names = [];
          for (const k in eq) if (typeof eq[k] === 'string' && NC.ITEMS[eq[k]]) itemNames(eq[k], { add: (n) => names.push(n) });
          SP.need(names, 0).then(() => { if (game.player && game.player.equip === eq) base.call(H, game); });
        }
        return r;
      };
      H.refreshHead.streamed = true;
    }
    if (NC.drawHero && !NC.drawHero.streamed) {
      const base = NC.drawHero;
      NC.drawHero = function (ctx, equip) { wantEquip(equip); return base.apply(this, arguments); };
      NC.drawHero.streamed = true;
    }
    const HS = NC.HeroSpine;
    if (HS && HS.preview && !HS.preview.streamed) {
      const base = HS.preview;
      HS.preview = function (ctx, equip) { wantEquip(equip); return base.apply(this, arguments); };
      HS.preview.streamed = true;
    }
    if (NC.itemIcon && !NC.itemIcon.streamed) {
      const base = NC.itemIcon, inIds = new Set(); // (items whose art is all in: straight through)
      NC.itemIcon = function (id, px, locked) {
        if (inIds.has(id)) return base.apply(this, arguments);
        const want = [...itemNames(id, new Set())];
        if (!SP.missing(want)) { inIds.add(id); return base.apply(this, arguments); }
        return pendingIcon(() => base.call(NC, id, px, locked), px, want);
      };
      NC.itemIcon.streamed = true;
    }
  };
  hookHeroes();

  // ---------------- an icon whose art is not in yet ----------------
  // An empty canvas now (the windows' own caches then keep nothing wrong), and once the art has arrived the real icon
  // goes everywhere the empty one went: into the canvas itself, into every canvas it was drawn on (the windows copy
  // icons into their cells once: inventory, book, market, lobby...) and into every <img> showing its toDataURL (the
  // windows that cache icons as data URLs: forge, refine, result, map drops...: the URL they keep is a marker that is
  // swapped for the real picture whenever it shows up in the page).
  const ctxP = CanvasRenderingContext2D.prototype, nativeDraw = ctxP.drawImage, nativeURL = HTMLCanvasElement.prototype.toDataURL;
  const waitingIcons = new Set(), swaps = new Map(); // swaps: marker URL -> the real icon's data URL
  let markN = 0, observer = null;
  const view = document.getElementById('view');
  function drawWatch(on) {
    if (on && ctxP.drawImage === nativeDraw) {
      ctxP.drawImage = function (src) {
        if (src && src.ncIcon && src.ncIcon.pending && this.canvas !== view) { // (not the game view: it is redrawn every frame)
          src.ncIcon.copies.push({ ctx: this, args: Array.prototype.slice.call(arguments, 1), tf: this.getTransform(), alpha: this.globalAlpha, op: this.globalCompositeOperation, filter: this.filter });
        }
        return nativeDraw.apply(this, arguments);
      };
    } else if (!on && !waitingIcons.size) ctxP.drawImage = nativeDraw;
  }
  function swapImgs(root) {
    if (!swaps.size || !root || !root.querySelectorAll) return;
    const list = root.tagName === 'IMG' ? [root] : root.querySelectorAll('img[src^="data:image/svg+xml;charset=utf-8,%3Csvg%20data-nc"]');
    for (const im of list) { const real = swaps.get(im.getAttribute('src')); if (real) im.setAttribute('src', real); }
  }
  function pendingIcon(make, px, want) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = px;
    const P = (cv.ncIcon = { pending: true, copies: [], marker: null });
    cv.toDataURL = function () {
      if (!P.pending) return nativeURL.apply(this, arguments);
      return P.marker || (P.marker = `data:image/svg+xml;charset=utf-8,%3Csvg%20data-nc%3D%22i${++markN}%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%221%22%20height%3D%221%22%2F%3E`);
    };
    waitingIcons.add(cv);
    drawWatch(true);
    SP.need(want, 1).then(() => {
      try {
        const real = make();
        nativeDraw.call(cv.getContext('2d'), real, 0, 0);
        for (const c of P.copies) {
          const x = c.ctx;
          x.save(); x.setTransform(c.tf); x.globalAlpha = c.alpha; x.globalCompositeOperation = c.op; x.filter = c.filter;
          nativeDraw.apply(x, [real].concat(c.args));
          x.restore();
        }
        if (P.marker) {
          swaps.set(P.marker, nativeURL.call(cv));
          swapImgs(document.body);
          if (!observer && typeof MutationObserver !== 'undefined') {
            observer = new MutationObserver((recs) => {
              for (const r of recs) { if (r.type === 'attributes') swapImgs(r.target); else for (const n of r.addedNodes) if (n.nodeType === 1) swapImgs(n); }
            });
            observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
          }
        }
      } catch (err) { console.warn('stream: icon', err); }
      P.pending = false; P.copies.length = 0;
      waitingIcons.delete(cv);
      drawWatch(false);
    });
    return cv;
  }
  NC.Sprites.pendingIcon = pendingIcon;
})();
