/* stuckhelp.js — ways out for a hero who is stuck (2026-10-21: a player stood in the wall on รากต้นไม้มืด floor 30; relog
   and the warp could not help, travel is refused inside a root and the server's unstuck was only asked by AUTO).
     ออกจากราก   a button on the Dark Root floor HUD (#rt-hud, js/darkroot.js, through NC.Root.hudExtra), a short confirm card:
                 offline the run ends as at the exit door (NC.Root.endRun + NC.Maps.go camp; darkroot.js's tick puts the hero
                 by the camp's root gate); online NC.Root.exitRun (js/online/root.js) = {action:'root', kind:'exit'}
                 (backend darkroot_runtime.go rootExit: pays the cleared floors, the camp's root gate, allowed even when down)
     ติดอยู่?    an ESC menu side button on every map (NC.MENU_SIDE, js/menuwin.js): online {action:'unstuck'} (backend
                 unstuck.go: moves the hero only when he really is wedged or shut in a small pocket; else moved:false), once
                 every 10 s; offline the same test here and AUTO's own hop (NC.Auto.unstick.hopOut, js/autofarm.js).
                 Not moved: a tip card; inside a root it offers ออกจากราก
     chat        /ติด (/stuck /unstuck) and /ออกราก (/leaveroot)
   Styles: css/stuckhelp.css; the confirm card is the player flow's window (css/playerflow.css pf-*). */
(function () {
  'use strict';
  const NC = window.NC;
  const $ = (s, r) => (r || document).querySelector(s);
  const G = () => (NC.OnlineWorld && NC.OnlineWorld.game) || NC.game;
  const O = () => (NC.Online && NC.Online.enabled ? NC.Online : null);
  // the two icons (assets/kui/mn_unstuck.png, mn_rootout.png: assets/stuckhelp.manifest.js), where js/menuwin.js looks
  if (NC.ASSET_MANIFEST_STUCKHELP) Object.assign(NC.ASSET_MANIFEST, NC.ASSET_MANIFEST_STUCKHELP);
  const icon = (k) => ((NC.ASSET_MANIFEST || {})[k] || {}).src || '';
  const closeMenu = () => { const m = document.getElementById('menuwin'); if (m && !m.hidden) NC.HUD.panel('pause', false); }; // (only the ESC menu: HUD.panel closes the bag, map, ... too)
  const inRoot = (g) => !!(g && NC.Root && NC.Root.parseFloor && NC.Root.parseFloor(g.mapId));
  const WAIT = 10; // s between two asks (the server is asked, so not on every click)

  // ---------------- a tip card under the top of the screen (with a button when it offers ออกจากราก) ----------------
  let tipEl = null, tipT = 0;
  function tip(text, offerLeave) {
    if (!tipEl) {
      tipEl = document.createElement('div');
      tipEl.id = 'sh-tip'; tipEl.hidden = true;
      (document.getElementById('hud') || document.body).appendChild(tipEl);
      tipEl.addEventListener('click', (e) => { if (e.target.closest('[data-sh-leave]')) { hideTip(); askLeave(); } else if (e.target.closest('.sh-x')) hideTip(); });
    }
    const leave = offerLeave && inRoot(G());
    tipEl.innerHTML = `<span class="sh-t">${text}</span>` +
      (leave ? `<button type="button" class="kw-btn gold sh-go" data-sh-leave><img src="${icon('mn_rootout')}" alt="">ออกจากราก</button>` : '') +
      '<button type="button" class="sh-x" aria-label="ปิด">✕</button>';
    tipEl.hidden = false;
    tipEl.classList.remove('show'); void tipEl.offsetWidth; tipEl.classList.add('show');
    clearTimeout(tipT);
    tipT = setTimeout(hideTip, leave ? 9000 : 4500);
  }
  function hideTip() { clearTimeout(tipT); if (tipEl) tipEl.hidden = true; }

  // ---------------- ออกจากราก ----------------
  function leaveRoot() {
    const g = G(), R = NC.Root, p = g && g.player;
    if (!p || !inRoot(g)) { tip('ตอนนี้ไม่ได้อยู่ในรากต้นไม้มืด'); return false; }
    if (R.exitRun) { // online (js/online/root.js): the server ends the run and moves the hero; the map change ends it here
      if (R.exitRun(g) === false) { tip('ยังต่อเซิร์ฟเวอร์ไม่ได้ · ลองอีกครั้งนะ'); return false; }
      NC.HUD.log('ขอออกจากรากต้นไม้มืด…', 'sys');
      return true;
    }
    // offline: as the exit door; a fallen hero stands up first, as the server does
    if (p.dead > 0) { p.dead = 0; p.hp = p.maxHp; p.sp = p.maxSp; p.inv = 2; }
    R.endRun(g, 'out');
    NC.Maps.go(g, 'camp');
    return true;
  }
  // the confirm card (the player flow's window: css/playerflow.css)
  let box = null, boxWasPaused = null;
  function build() {
    box = document.createElement('div');
    box.className = 'kw-panel pf-modal sh-modal';
    box.hidden = true; box.tabIndex = -1;
    box.innerHTML = `
      <div class="kw-win pf-win" role="dialog">
        <div class="kw-title"><span>ออกจากรากต้นไม้มืด</span><button class="kw-x sh-no" aria-label="ปิด">✕</button></div>
        <div class="pf-body">
          <img class="pf-ic" alt="">
          <div class="pf-q">ออกจากรากตอนนี้?</div>
          <div class="pf-note"></div>
          <div class="pf-btns"><button class="kw-btn grey sh-no">ยกเลิก</button><button class="kw-btn gold sh-yes">ออกจากราก</button></div>
        </div>
      </div>`;
    document.body.appendChild(box);
    for (const b of box.querySelectorAll('.sh-no')) b.onclick = () => shut();
    $('.sh-yes', box).onclick = () => { shut(); leaveRoot(); };
    box.addEventListener('pointerdown', (e) => { if (e.target === box) shut(); });
    box.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') shut();
      else if (e.key === 'Enter') { shut(); leaveRoot(); }
    });
  }
  function askLeave() {
    const g = G();
    if (!inRoot(g)) { tip('ตอนนี้ไม่ได้อยู่ในรากต้นไม้มืด'); return; }
    if (!box) build();
    closeMenu(); // (from the ESC menu: it closes behind the question)
    const R = NC.Root, sv = R.server && R.server.run, run = R.run && R.run();
    const party = sv ? sv.mode === 'party' : !!(run && run.mode === 'party');
    $('.pf-ic', box).src = icon('mn_rootout');
    $('.pf-note', box).textContent = ['รอบนี้จะจบ ชั้นที่ผ่านแล้วยังได้รางวัลตามปกติ', 'กลับไปที่ประตูรากในค่าย' + (party ? ' · เพื่อนในปาร์ตี้เล่นต่อได้' : '')].join('\n'); // (css pre-line)
    box.hidden = false;
    // (offline the world waits while the card is up; online it never pauses)
    if (g && !O()) { boxWasPaused = g.paused; g.paused = true; }
    setTimeout(() => box.focus({ preventScroll: true }), 0);
  }
  function shut() {
    if (!box || box.hidden) return;
    box.hidden = true;
    const g = G();
    if (g && boxWasPaused !== null) g.paused = boxWasPaused;
    boxWasPaused = null;
  }

  // ---------------- ติดอยู่? ช่วยพาออก ----------------
  // the server's test (backend unstuck.go), for the offline game: wedged = doesn't fit where he stands; shut in = a flood
  // on a 40-unit lattice from the hero ends before 30 points; the way out is never inside that pocket
  const STEP = 40, POCKET = 30, HERO_R = 20;
  function passable(w, ax, ay, bx, by) {
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 10));
    for (let s = 1; s <= n; s++) if (!w.fits(ax + ((bx - ax) * s) / n, ay + ((by - ay) * s) / n, HERO_R)) return false;
    return true;
  }
  function pocketOf(w, x, y) {
    const seen = new Set(['0,0']), q = [[0, 0]];
    for (let i = 0; i < q.length; i++) {
      if (q.length >= POCKET) return null;
      const [ci, cj] = q[i], ax = x + ci * STEP, ay = y + cj * STEP;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ni = ci + di, nj = cj + dj, k = ni + ',' + nj;
        if (seen.has(k) || !passable(w, ax, ay, ax + di * STEP, ay + dj * STEP)) continue;
        seen.add(k); q.push([ni, nj]);
      }
    }
    return q.map(([i, j]) => [x + i * STEP, y + j * STEP]);
  }
  function hopOffline(g) {
    const U = NC.Auto && NC.Auto.unstick, p = g.player, w = g.world;
    if (!U || !U.hopOut || !w || !w.fits) return false;
    if (U.wedged(g, p)) return U.hopOut(g, 600);
    const pk = pocketOf(w, p.x, p.y);
    if (!pk) return false;
    return U.hopOut(g, 420, (x, y) => !pk.some(([px, py]) => Math.hypot(px - x, py - y) <= STEP * 1.5 && passable(w, px, py, x, y)));
  }
  const NOT_STUCK = 'ตรงนี้ไม่ได้ติดอยู่ · ลองเดินออกทางอื่นดูนะ';
  const NOT_STUCK_ROOT = 'ไม่พบว่าติดอยู่ · ถ้ายังเดินไม่ได้ ออกจากรากได้เลย';
  let askedAt = -1e9, waitSeq = 0, waitT = 0, hooked = false;
  function unstuck() {
    const g = G(), p = g && g.player;
    if (!p) return;
    const now = performance.now() / 1000; // (wall clock: the world never pauses online)
    if (now - askedAt < WAIT) { tip(`ลองได้อีกครั้งใน ${Math.ceil(WAIT - (now - askedAt))} วินาที`, true); return; }
    if (p.dead > 0) { tip(inRoot(g) ? 'หมดแรงอยู่ · ออกจากรากได้เลย หรือรอฟื้นแล้วลองใหม่' : 'หมดแรงอยู่ · รอฟื้นแล้วลองใหม่นะ', true); return; }
    const on = O();
    if (!on) {
      askedAt = now;
      if (hopOffline(g)) { NC.HUD.log('พาออกจากจุดติดแล้ว', 'sys'); tip('พาออกจากจุดติดแล้ว'); }
      else tip(inRoot(g) ? NOT_STUCK_ROOT : NOT_STUCK, true);
      return;
    }
    if (!on.action || on.status !== 'online') { tip('ยังต่อเซิร์ฟเวอร์ไม่ได้ · ลองอีกครั้งนะ'); return; }
    hook(on);
    if (on.action({ action: 'unstuck' }) === false) { tip('ยังต่อเซิร์ฟเวอร์ไม่ได้ · ลองอีกครั้งนะ'); return; }
    askedAt = now; waitSeq = on.seq;
    clearTimeout(waitT);
    const seq = waitSeq;
    waitT = setTimeout(() => { if (waitSeq === seq) { waitSeq = 0; tip('เซิร์ฟเวอร์ยังไม่ตอบ · ลองใหม่อีกครั้งนะ', true); } }, 6000);
    tip('กำลังหาทางออกให้…');
  }
  // the server's answer: {type:'character', action:'unstuck', seq, moved, x, y} (an error answers with the same seq)
  function hook(on) {
    if (hooked || !on.on) return;
    hooked = true;
    on.on('event', (ev) => {
      if (!ev || !waitSeq || (ev.seq != null && ev.seq !== waitSeq)) return;
      if (ev.type === 'error') { waitSeq = 0; clearTimeout(waitT); return; } // (online/world.js logs its words)
      if (ev.type !== 'character' || ev.action !== 'unstuck') return;
      waitSeq = 0; clearTimeout(waitT);
      const g = G(), p = g && g.player;
      if (ev.moved && p && Number.isFinite(ev.x) && Number.isFinite(ev.y)) {
        if (NC.FX && NC.FX.puff) { NC.FX.puff(p.x, p.y - 30, 8, { speed: 90, size: 0.7 }); NC.FX.puff(ev.x, ev.y - 30, 8, { speed: 90, size: 0.7 }); }
        p.x = ev.x; p.y = ev.y; p.vx = p.vy = 0;
        NC.HUD.log('พาออกจากจุดติดแล้ว', 'sys'); tip('พาออกจากจุดติดแล้ว');
      } else tip(inRoot(g) ? NOT_STUCK_ROOT : 'เซิร์ฟเวอร์ไม่พบว่าติดอยู่ · ลองเดินออกทางอื่นดูนะ', true);
    });
  }

  // ---------------- the ways in ----------------
  // the floor HUD: one more line after the blessings (js/rootloot.js), redrawn with the HUD
  if (NC.Root) {
    const baseExtra = NC.Root.hudExtra;
    NC.Root.hudExtra = function (fl) {
      const s = baseExtra ? baseExtra.apply(this, arguments) : '';
      return fl ? s + `<button type="button" class="rt-leave" data-sh-hud><img src="${icon('mn_rootout')}" alt=""><span>ออกจากราก</span></button>` : s;
    };
    document.addEventListener('click', (e) => { if (e.target.closest && e.target.closest('[data-sh-hud]')) askLeave(); });
  }
  // the ESC menu: a side button (online before เปลี่ยนตัวละคร / ออกจากระบบ, js/online/flow.js)
  const side = (NC.MENU_SIDE = NC.MENU_SIDE || []);
  const at = side.findIndex((b) => b.id === 'charsel');
  side.splice(at < 0 ? side.length : at, 0, { id: 'unstuck', name: 'ติดอยู่? ช่วยพาออก', icon: 'mn_unstuck', cls: 'sh-side', run: () => {
    closeMenu();
    const g = G();
    if (g) g.paused = false;
    unstuck();
  } });
  // the chat
  const C = (NC.chatCmds = NC.chatCmds || {});
  for (const c of ['/ติด', '/stuck', '/unstuck']) if (!C[c]) C[c] = () => unstuck();
  for (const c of ['/ออกราก', '/leaveroot']) if (!C[c]) C[c] = () => askLeave();

  NC.StuckHelp = { unstuck, askLeave, leaveRoot, tip }; // (tests)
})();
