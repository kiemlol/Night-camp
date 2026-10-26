/* wpnhd.js — sharp weapon pictures where a weapon is shown BIG (the user, 2026-10-17: "ทำรูปอาวุธ ชัดๆด้วยนะ").
   The weapon sprites are stored at 2 px per world unit: right in the hero's hand, soft when a page shows one big (the
   refine page's anvil, the weapon crafting spotlight, the bag's item card, the result popup). tools/wpn_hd.py cut an HD
   copy of each weapon from its raw Codex sheet at 4 px per unit: assets/wpn_hd/<set>/<name>.webp, the list in
   assets/wpnhd.manifest.js (NC.WPN_HD). Here:
     NC.itemIcon(id, px >= 192) of a weapon with a copy draws the copy, in the same place and size as js/items.js does;
       the copy is loaded the first time it is asked for, and until it is there (or when it fails) the old picture stays
     NC.WpnHD.big(id, px)   the same at twice the pixels (a page that shows its 256 icon as an <img> sized by css)
     NC.WpnHD.tag(id, px)   '' until the item's copy is in, then '+hd': the pages' own icon caches key on it
     NC.WpnHD.img(key)      the loaded copy of a sprite (or null, and it starts loading): js/resultfx.js's crispIcon
   When a copy arrives, the big pictures already on screen are drawn again. The hand sprites (NC.SPR) are not touched.
   ?wpnhd=0: off (the old pictures everywhere). */
(function () {
  'use strict';
  const NC = window.NC, L = NC.WPN_HD;
  if (!L || !L.sets || !NC.itemIcon) return;
  const BIG = 192;
  const where = new Map(); // sprite key -> its HD file
  for (const set in L.sets) for (const n of String(L.sets[set]).split(',')) if (n) where.set(n, 'assets/wpn_hd/' + set + '/' + n + '.webp');
  const keyOf = (id) => { const it = NC.ITEMS[id]; return it && it.slot === 'weapon' ? it.icon || it.sprite : null; };

  // ---------------- the copies, loaded when first asked for ----------------
  const pics = new Map(); // key -> { img, ok, fail }
  const waiting = new Map(); // key -> Set of 'id|px|locked' drawn with the old picture while it loads
  function load(key) {
    let e = pics.get(key);
    if (!e && where.has(key)) {
      e = { img: new Image(), ok: false, fail: false };
      pics.set(key, e);
      e.img.decoding = 'async';
      e.img.onload = () => { e.ok = true; arrived(key); };
      e.img.onerror = () => { e.fail = true; waiting.delete(key); };
      e.img.src = where.get(key);
    }
    return e;
  }
  const img = (key) => { const e = load(key); return e && e.ok ? e.img : null; };

  // ---------------- drawn as js/items.js draws a weapon icon ----------------
  // (on the diagonal: its drawn pixels, turned, inside 92% of the icon, centred; the turned box measured on the game
  // sprite, so the sharp picture stands exactly where the old one did)
  const turnBox = new Map();
  function turned(s) {
    let r = turnBox.get(s);
    if (r) return r;
    const S = 256 / Math.max(s.w, s.h), D = Math.ceil((s.w + s.h) * S * Math.SQRT1_2) + 4, cv = document.createElement('canvas');
    cv.width = cv.height = D;
    const g = cv.getContext('2d');
    g.translate(D / 2, D / 2); g.rotate(Math.PI / 4);
    g.drawImage(s.img, (-s.w * S) / 2, (-s.h * S) / 2, s.w * S, s.h * S);
    const d = g.getImageData(0, 0, D, D).data;
    let x0 = D, y0 = D, x1 = -1, y1 = -1;
    for (let y = 0; y < D; y++) for (let x = 0; x < D; x++) if (d[(y * D + x) * 4 + 3] > 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    r = x1 < 0 ? { w: s.w, h: s.h, cx: 0, cy: 0 }
      : { w: (x1 - x0 + 1) / S, h: (y1 - y0 + 1) / S, cx: ((x0 + x1 + 1) / 2 - D / 2) / S, cy: ((y0 + y1 + 1) / 2 - D / 2) / S };
    turnBox.set(s, r);
    return r;
  }
  function draw(key, pic, px, locked) {
    const s = NC.SPR[key], tb = turned(s), k = Math.min((px * 1.22) / s.h, (px * 0.92) / Math.max(tb.w, tb.h));
    const cv = document.createElement('canvas');
    cv.width = cv.height = px;
    const c = cv.getContext('2d');
    c.imageSmoothingQuality = 'high';
    c.translate(px / 2 - tb.cx * k, px / 2 - tb.cy * k); c.rotate(Math.PI / 4);
    c.drawImage(pic, -(s.w * k) / 2, -(s.h * k) / 2, s.w * k, s.h * k);
    if (locked) {
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.globalCompositeOperation = 'source-in';
      c.fillStyle = 'rgba(24,20,34,0.92)';
      c.fillRect(0, 0, px, px);
    }
    return cv;
  }

  const orig = NC.itemIcon, cache = new Map();
  function sharp(id, px, locked, size) {
    const key = keyOf(id), s = key && NC.SPR[key];
    if (!s || !s.img || !where.has(key)) return null;
    if (s.ready === false) { if (NC.Sprites) NC.Sprites.need([key], 1); return null; } // (the game sprite measures the box: still streaming in, js/assets.js)
    const pic = img(key);
    if (!pic) {
      const e = pics.get(key);
      if (e && !e.fail) (waiting.get(key) || waiting.set(key, new Set()).get(key)).add(id + '|' + px + '|' + (locked ? 1 : 0));
      return null;
    }
    const ck = id + '@' + size + (locked ? '#' : '');
    let cv = cache.get(ck);
    if (!cv) { cv = draw(key, pic, size, locked); cache.set(ck, cv); }
    return cv;
  }
  NC.itemIcon = function (id, px, locked) {
    return (px >= BIG && sharp(id, px, locked, px)) || orig.call(this, id, px, locked);
  };

  // ---------------- a copy came in: the big pictures on screen again ----------------
  function arrived(key) {
    const W = waiting.get(key);
    waiting.delete(key);
    if (!W) return;
    for (const w of W) {
      const [id, ps, lk] = w.split('|'), px = +ps, locked = lk === '1';
      let old = '';
      try { old = orig(id, px, locked).toDataURL(); } catch (e) { continue; }
      // an <img> showing the old picture (the refine and crafting pages, the result popup): css sizes it, so the
      // twice-as-big copy
      for (const im of document.images) {
        if (im.src !== old) continue;
        try { im.src = (locked ? NC.itemIcon(id, px, true) : NC.WpnHD.big(id, px)).toDataURL(); } catch (e) { /* keep it */ }
      }
      // the bag's item card draws its 256 icon into a canvas of its own
      for (const cv of document.querySelectorAll('canvas[data-big]')) {
        if (cv.dataset.big !== id || cv.width !== px) continue;
        const c = cv.getContext('2d');
        c.clearRect(0, 0, cv.width, cv.height);
        c.drawImage(NC.itemIcon(id, px, locked), 0, 0);
      }
    }
  }

  NC.WpnHD = {
    img: (key) => (where.has(key) ? img(key) : null),
    has: (id) => where.has(keyOf(id)),
    tag: (id, px) => (px >= BIG && pics.get(keyOf(id)) && pics.get(keyOf(id)).ok ? '+hd' : ''),
    // twice the pixels for an <img> the page sizes by css (falls back to the plain icon at px)
    big: (id, px) => sharp(id, px, false, Math.min(1024, px * 2)) || NC.itemIcon(id, px),
  };
})();
