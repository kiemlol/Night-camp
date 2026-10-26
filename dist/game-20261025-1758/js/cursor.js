/* The game's own mouse cursors (README "เคอร์เซอร์เมาส์"; art: assets/cursor/, cut by tools/cursor_cut.py, hotspots in
   assets/cursor.manifest.js = NC.CURSOR_ART).
   - On the game canvas: the arrow; a weapon over a monster; the arrow with a speech bubble over an NPC (story NPCs, the
     merchant, the smith, the cook, the teachers: everything NC.Party.collect lists with .npc); a grabbing hand over
     loot on the ground. Talk wins over attack (an NPC's click handler takes the click first).
   - Over the windows: every stylesheet rule that says cursor: pointer gets the pointing hand (default / crosshair the
     arrow, grab / grabbing the grabbing hand), and inline pointer cursors set by scripts are swapped when hovered.
   Every value ends with the old keyword, so a missing picture shows the old cursor. Off on touch screens (no fine
   pointer) and with ?cursor=0. Works the same offline and with ?online (both fill game.enemies / game.loot). */
(function () {
  'use strict';
  const ART = NC.CURSOR_ART;
  if (!ART || !(window.matchMedia && matchMedia('(pointer: fine)').matches)) return;

  const STATES = ['normal', 'attack', 'talk', 'pickup', 'ui'];
  const abs = (f) => new URL(`${ART.dir}/${f}`, document.baseURI).href;
  const set1 = (s) => `url("${abs(s + '.png')}")`;
  const set2 = (fn, s) => `${fn}(url("${abs(s + '.png')}") 1x, url("${abs(s + '@2x.png')}") 2x)`;
  // the best form this browser takes: image-set (a sharp 2x picture on HiDPI screens), else the 1x picture
  const ok = (v) => window.CSS && CSS.supports && CSS.supports('cursor', v);
  const form = ok(`${set2('image-set', 'x')} 1 1, auto`) ? (s) => set2('image-set', s)
    : ok(`${set2('-webkit-image-set', 'x')} 1 1, auto`) ? (s) => set2('-webkit-image-set', s) : set1;
  const value = (s, old) => { const h = ART.hot[s] || [1, 1]; return `${form(s)} ${h[0]} ${h[1]}, ${old}`; };
  const V = {
    normal: value('normal', 'default'), attack: value('attack', 'crosshair'), talk: value('talk', 'pointer'),
    pickup: value('pickup', 'grab'), ui: value('ui', 'pointer'),
  };
  const root = document.documentElement;
  for (const s of STATES) root.style.setProperty(`--ncc-${s}`, V[s]);
  root.classList.add('ncc');
  root.style.setProperty('--ncc-view', value('normal', 'crosshair')); // the canvas's arrow falls back to its old crosshair
  for (const s of STATES) for (const f of [s + '.png', s + '@2x.png']) { const im = new Image(); im.src = abs(f); } // no blank first hover

  // ---------------- the windows: rewrite cursor keywords in the stylesheets ----------------
  const MAP = {
    pointer: V.ui, default: V.normal, crosshair: value('normal', 'crosshair'),
    grab: V.pickup, grabbing: value('pickup', 'grabbing'),
  };
  function rewriteRules(rules) {
    for (const r of rules) {
      if (r.style && r.style.cursor) {
        const to = MAP[r.style.cursor.trim()];
        if (to) r.style.setProperty('cursor', to, r.style.getPropertyPriority('cursor'));
      }
      if (r.cssRules && r.cssRules.length) rewriteRules(r.cssRules); // @media, @supports, nesting
    }
  }
  // (each sheet once: the sweeps at the start, on load and 4 s later went over every rule again, ~65 ms a sweep; a <style>
  // given new text has a new sheet, swept then. 2026-10-19, a start's CPU profile)
  const swept = new WeakSet();
  function rewrite(sheet) {
    if (!sheet || swept.has(sheet)) return;
    let rules = null;
    try { rules = sheet.cssRules; } catch (e) { return; } // another site's sheet (the fonts): nothing of ours in it
    swept.add(sheet);
    if (rules) rewriteRules(rules);
  }
  function rewriteAll() { for (const sh of document.styleSheets) rewrite(sh); }
  // (the first sweep once the page is parsed: no window opens before that, and the start's scripts run sooner)
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(rewriteAll, 0), { once: true });
  else rewriteAll();
  // sheets added later (features that inject a <style> when a window first opens, a <link> still loading)
  new MutationObserver((muts) => {
    if (document.readyState === 'loading') return; // (the <style>s the start's scripts add: the first sweep takes them all)
    for (const m of muts) for (const n of m.addedNodes) {
      if (n.nodeName === 'STYLE' && n.sheet) rewrite(n.sheet);
      else if (n.nodeName === 'LINK' && /stylesheet/i.test(n.rel)) n.addEventListener('load', () => rewrite(n.sheet), { once: true });
    }
  }).observe(document.documentElement, { childList: true, subtree: true });
  addEventListener('load', rewriteAll, { once: true });
  // a <style> whose text a script replaces keeps its node: one more sweep after the start settles
  setTimeout(rewriteAll, 4000);
  // inline cursors set by scripts (el.style.cursor = 'pointer'): swapped when the mouse comes over them
  addEventListener('pointerover', (e) => {
    for (let el = e.target, i = 0; el && el.style && i < 6; el = el.parentElement, i++) {
      const c = el.style.cursor;
      if (c && MAP[c]) { el.style.cursor = MAP[c]; break; }
      if (c) break;
    }
  }, { capture: true, passive: true });

  // ---------------- the canvas: what the mouse is over ----------------
  const cv = document.getElementById('view');
  if (!cv) return;
  let mx = -1, my = -1, cur = '';
  cv.addEventListener('mousemove', (e) => { mx = e.clientX; my = e.clientY; }, { passive: true });
  cv.addEventListener('mouseleave', () => { mx = my = -1; }, { passive: true });
  let npcs = [];
  // NPCs: every frame the features push the NPCs on screen into the draw list (NC.Party.collect); keep the ones with .npc
  if (NC.Party && NC.Party.collect) {
    const baseCollect = NC.Party.collect;
    NC.Party.collect = function (list, visible) {
      const res = baseCollect.apply(this, arguments);
      try {
        const found = [];
        for (const o of list) if (o && o.npc && !o.dead) found.push(o);
        npcs = found;
        pick(NC.game);
      } catch (err) { /* the cursor never breaks the frame */ }
      return res;
    };
  }
  function state(game) {
    if (mx < 0 || !game || !game.player || !game.cam || !game.scale) return 'normal';
    const wx = game.cam.x + (mx * (game.dpr || 1)) / game.scale, wy = game.cam.y + (my * (game.dpr || 1)) / game.scale;
    // an NPC (the same boxes their click handlers use: ~60 wide each side, from the head to the feet)
    for (const n of npcs) if (Math.abs(wx - n.x) < 62 && wy > n.y - 180 && wy < n.y + 16) return 'talk';
    // a monster (game.js's own hover box)
    for (const e of game.enemies || []) {
      if (e.dead || e.hidden) continue;
      const dx = wx - e.x, dy = wy - (e.y - 60);
      if (Math.abs(dx) < 60 && dy > -110 && dy < 80) return 'attack';
    }
    // loot on the ground (the icon over its ring: js/items.js NC.drawLoot)
    for (const l of game.loot || []) {
      const z = l.z || 0;
      if (Math.abs(wx - l.x) < 46 && wy > l.y - 112 - z && wy < l.y + 20) return 'pickup';
    }
    return 'normal';
  }
  function pick(game) {
    const s = state(game);
    if (s === cur) return;
    if (cur && cur !== 'normal') cv.classList.remove('ncc-' + cur);
    if (s !== 'normal') cv.classList.add('ncc-' + s);
    cur = s;
  }
  NC.Cursor = { state: () => cur || 'normal', values: V, art: ART, pick: () => pick(NC.game) };
})();
