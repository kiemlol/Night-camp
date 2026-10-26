/* dash.js — Shift dashes, for every job (the user, 2026-10-02: "อยากให้ปุ่ม Shift เป็นแดชทุกอาชีพ จะได้มี mobility ขึ้น").
   A quick hop of 300 units in 0.2 s: toward the way you are walking (WASD / arrows), or toward the mouse when you stand
   still. Cooldown 3 s, 0.01 s less per point of AGI (1.8 s at least), no SP. While dashing the hero can't be hit (0.24 s:
   monsters miss, and in a duel the opponent's hits are dodged: pvp.js reads p.evade). Not while casting, channelling,
   stunned in a duel, or fainted. It uses the hero's own dash movement (p.dash in entities.js), so walls stop it and the
   other players online see it.
   The hotbar gets a Shift slot after the potions (its cooldown shows like a skill's; click / tap it to dash too); on a
   phone it moves next to the potions. NC.DASH holds the numbers. */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX, V = NC.VFX;
  const DASH = (NC.DASH = { dist: 300, dur: 0.2, cd: 3, minCd: 1.8, perAgi: 0.01, evade: 0.24, want: false });
  const agiOf = (p) => ((p.base && p.base.agi) || 0) + ((p.stats && p.stats.agi) || 0);
  DASH.cdOf = (p) => Math.max(DASH.minCd, DASH.cd - agiOf(p) * DASH.perAgi);

  addEventListener('keydown', (e) => {
    const t = e.target && e.target.tagName;
    if (t === 'INPUT' || t === 'TEXTAREA') return;
    if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight') && !e.repeat) DASH.want = true;
  });

  function canDash(g, p) {
    if (!p || p.dead > 0 || p.dash || p.casting || p.channel || g.paused) return false;
    const d = NC.PvP && NC.PvP.duel;
    if (d && d.cc && d.cc.stun > 0) return false;
    return !(p.cd && p.cd.dash > 0);
  }
  function dash(g, p) {
    const I = g.input;
    let ang;
    if (I.mx || I.my) ang = Math.atan2(I.my, I.mx);
    else if (g.mouse && g.mouse.active) ang = Math.atan2(g.mouse.wy - (p.y - 60), g.mouse.wx - p.x);
    else ang = p.face < 0 ? Math.PI : 0;
    const dx = Math.cos(ang), dy = Math.sin(ang) * 0.8, x0 = p.x, y0 = p.y;
    if (Math.abs(dx) > 0.1) p.face = dx > 0 ? 1 : -1;
    p.cd.dash = DASH.cdOf(p);
    p.inv = Math.max(p.inv || 0, DASH.evade);
    p.evade = DASH.evade;
    if (p.atk) p.atk.on = false;
    p.dash = {
      t: 0, dur: DASH.dur, vx: (dx * DASH.dist) / DASH.dur, vy: (dy * DASH.dist) / DASH.dur, ghost: 0, hit: new Set(), move: true,
      tick(game, q, d) {
        if (Math.random() < 0.7) FX.add({ type: 'vstreak', x: q.x + NC.rand(-24, 24), y: q.y - NC.rand(20, 110), vx: -d.vx * 0.1, vy: -d.vy * 0.1, len: NC.rand(30, 70), w: 3, rgb: '200,225,255', life: 0.22 });
      },
      end(game, q) {
        V.smoke(q.x, q.y - 6, 3, '#cfc6b8', '#efe8dc', { size: 0.5, lifeK: 0.5, a: 0.7 });
      },
    };
    V.smoke(x0, y0 - 6, 4, '#cfc6b8', '#efe8dc', { size: 0.6, lifeK: 0.55, a: 0.8 });
    V.ring(x0, y0, 10, 70, 5, '200,225,255', 0.22);
  }

  // ---------------- the Shift slot on the hotbar ----------------
  let slot = null, cdEl = null, cdt = null, shownP = '', shownT = '';
  function makeSlot() {
    const bar = document.querySelector('#hud .hotbar');
    if (!bar || slot) return;
    const src = ((NC.ASSET_MANIFEST || {}).ic_dash || {}).src || 'assets/ic_dash.png';
    slot = document.createElement('div');
    slot.className = 'hslot skill dashslot'; slot.id = 'hs-dash'; slot.title = 'แดช (Shift) · ทุกอาชีพ · คูลดาวน์ 3 วิ (AGI ลดได้)';
    slot.innerHTML = `<span class="key">Shift</span><img src="${src}" alt="" onerror="this.src='assets/sk_shadowstep.png'"><div class="cd" id="cd-dash"></div><span class="cdt" id="cdt-dash"></span>`;
    const st = document.createElement('style');
    st.textContent = '#hs-dash .key{font-size:calc(11*var(--u));letter-spacing:0} #hs-dash{cursor:pointer}';
    document.head.appendChild(st);
    const exp = bar.querySelector('.expbars');
    bar.insertBefore(slot, exp || null);
    cdEl = slot.querySelector('.cd'); cdt = slot.querySelector('.cdt');
    slot.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); DASH.want = true; });
  }
  function drawSlot(p) {
    if (!slot) return;
    // a phone: next to the potions (mobile.js hides the hotbar)
    if (document.documentElement.classList.contains('mob')) { const it = document.getElementById('mb-items'); if (it && slot.parentNode !== it) it.appendChild(slot); }
    else { const bar = document.querySelector('#hud .hotbar'); if (bar && slot.parentNode !== bar) bar.insertBefore(slot, bar.querySelector('.expbars')); }
    const left = (p.cd && p.cd.dash) || 0, full = DASH.cdOf(p);
    const P = left > 0 ? Math.round((100 * left) / full) + '%' : '0%';
    if (P !== shownP) { shownP = P; cdEl.style.setProperty('--p', P); }
    const T = left > 0 ? (left >= 1 ? String(Math.ceil(left)) : left.toFixed(1)) : '';
    if (T !== shownT) { shownT = T; cdt.textContent = T; }
  }

  // ---------------- hooks ----------------
  const baseUpd = NC.updatePlayer;
  NC.updatePlayer = function (g, dt) {
    const p = g.player;
    if (p) {
      if (p.evade > 0) p.evade = Math.max(0, p.evade - dt);
      if (DASH.want) { DASH.want = false; if (canDash(g, p)) dash(g, p); }
    }
    const res = baseUpd.apply(this, arguments);
    if (p) drawSlot(p);
    return res;
  };
  const baseInit = NC.HUD.init.bind(NC.HUD);
  NC.HUD.init = function (game) { baseInit(game); makeSlot(); };
})();
