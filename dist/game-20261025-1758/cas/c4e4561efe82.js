/* game.js — main loop: input, camera, update, depth-sorted rendering, night lighting */
(function () {
  'use strict';
  const NC = window.NC;
  const FX = NC.FX;
  const TAU = Math.PI * 2;
  const cv = document.getElementById('view');
  const ctx = cv.getContext('2d');
  const lightCv = NC.GL2D && NC.GL2D.on ? NC.GL2D.canvas(1, 1) : document.createElement('canvas'); // (the WebGL2 screen, js/gl2d.js: the light map drawn on the GPU too)
  const lctx = lightCv.getContext('2d');
  const Graphics = NC.Graphics;
  const fallbackProfile = { name: 'high', lightScale: 0.75, bloom: true, vignette: true, shadows: 'all', decorationDensity: 1, sway: true, particleDensity: 1, smoothing: 'high' };
  const graphicsProfile = () => NC.Gfx?.profile || (Graphics ? Graphics.profile : fallbackProfile);
  let vignette = null;
  let sceneQueryMs = 0, sceneSortMs = 0, staticCandidates = 0, renderCameraX = 0, renderCameraY = 0;
  // the night's lights as pictures (2026-10-18, the user: "แสงแบบภาพสำเร็จรูป"): every glow was a new radial gradient each
  // frame (9.7% of the game's time in a 30-hero fight); now one soft disc per colour drawn scaled at globalAlpha (the same
  // light: the colour is constant, only its alpha falls off to the rim), and the light map at half the screen's size (all
  // of it soft; scaled back up when it is multiplied in). NC.LightSprites.on = false: the gradients, full size
  const LS = (NC.LightSprites = { on: true });
  const DISC = new Map();
  function disc(rgb) {
    const k = String(rgb);
    let c = DISC.get(k);
    if (c) return c;
    if (DISC.size > 96) DISC.clear();
    c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d'), gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    gr.addColorStop(0, `rgba(${k},1)`); gr.addColorStop(1, `rgba(${k},0)`);
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    DISC.set(k, c);
    return c;
  }
  // a soft light at (x, y) of radius r: the colour rgb at alpha a in the middle, nothing at the rim
  function softLight(c2, x, y, r, rgb, a) {
    if (!(a > 0) || !(r > 0)) return;
    const ga = c2.globalAlpha;
    c2.globalAlpha = ga * Math.min(1, a);
    c2.drawImage(disc(rgb), x - r, y - r, 2 * r, 2 * r);
    c2.globalAlpha = ga;
  }

  const game = (NC.game = {
    world: null, player: null, enemies: [], respawns: [], loot: [], kills: 0, saveT: 0,
    time: 0, minutes: 23 * 60 + 40, paused: false, hitstop: 0, shake: 0,
    cam: { x: 0, y: 0 }, scale: 1, vw: 1920, vh: 1080, dpr: 1,
    input: { mx: 0, my: 0, attack: false, q: false, e: false, r: false, potion: false, sppotion: false },
    target: null, targetT: -9, hover: null, // the monster last hit, the one under the mouse
    mouse: { sx: 0, sy: 0, cssX: 0, cssY: 0, wx: 0, wy: 0, down: false, active: false },
    zoneName: '', portals: [], flies: [],
    frameRate: { fps: null, at: 0 }, // drawn frames on the wall clock, independent of simulation time
    toast: (t) => NC.HUD.toast(t),
  });

  const SHADOW = {
    tree: [100, 28], tree2: [92, 26], tent: [140, 30], roundtent: [158, 34], wagon: [135, 26], rack: [82, 14],
    barrel: [38, 12], crates: [74, 18], stone: [58, 16], torch: [18, 6], lamp: [20, 7], grass: [24, 7],
  };

  // ---------------- sizing ----------------
  const deviceDpr = () => window.devicePixelRatio || 1;
  let sizedForDpr = 0; // the devicePixelRatio the canvas was last sized for
  function resize() {
    const dpr = (game.dpr = deviceDpr() * (NC.Gfx ? NC.Gfx.res() : 1)); // (js/gfx.js: คุณภาพภาพ draws fewer pixels on a weak machine)
    sizedForDpr = deviceDpr();
    const width = Math.max(1, Math.round(innerWidth * dpr)), height = Math.max(1, Math.round(innerHeight * dpr));
    if (cv.width !== width || cv.height !== height) {
      cv.width = width; cv.height = height;
      vignette = null;
    }
    cv.style.width = innerWidth + 'px'; cv.style.height = innerHeight + 'px';
    const LK0 = LS.on ? (NC.Gfx ? NC.Gfx.lightK() : 0.5) : 1;
    lightCv.width = Math.max(1, Math.round(cv.width * LK0)); lightCv.height = Math.max(1, Math.round(cv.height * LK0));   // (lighting() keeps it so)
    game.scale = cv.height / 1080;
    game.vw = cv.width / game.scale; game.vh = 1080;
    // Keep the same aim when quality changes while the mouse is stationary.
    game.mouse.sx = game.mouse.cssX * cv.width / innerWidth;
    game.mouse.sy = game.mouse.cssY * cv.height / innerHeight;
    // HUD scale: 1 at 1080p; narrow windows (like a side panel) keep it readable
    document.documentElement.style.setProperty('--u', Math.min(innerWidth / 1300, innerHeight / 1080) + 'px');
    if (NC.viewFit) NC.viewFit(game, cv); // (a phone: its own zoom and HUD scale, js/mobile.js)
    if (NC.HUD && game.world) NC.HUD.resize();
  }
  // Moving the window to a screen with another pixel density changes devicePixelRatio
  // without a 'resize' event, so every drawn frame compares it (a single number check).
  function followDpr() {
    if (deviceDpr() !== sizedForDpr) resize();
  }

  // ---------------- input ----------------
  const held = new Set();
  const MOVE = { KeyW: [0, -1], ArrowUp: [0, -1], KeyS: [0, 1], ArrowDown: [0, 1], KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0] };
  const editing = (el) => el && (['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName) || el.isContentEditable);
  addEventListener('keydown', (e) => {
    if (editing(e.target) && e.code !== 'Escape') return;
    if (e.target?.matches?.('.hud-open') && (e.code === 'Space' || e.code === 'Enter')) return;
    if (MOVE[e.code] || e.code === 'Space') e.preventDefault();
    held.add(e.code);
    if (e.repeat) return;
    const I = game.input;
    if (e.code === 'KeyQ') I.q = true;
    if (e.code === 'KeyE') I.e = true;
    if (e.code === 'KeyR') I.r = true;
    if (e.code === 'KeyF') I.f = true;
    if (e.code === 'Digit1') I.potion = true;
    if (e.code === 'Digit2') I.sppotion = true;
    if (/^Digit[3-6]$/.test(e.code)) I[e.code[5]] = true; // skill slots 3-6 (skilltree.js)
    if (e.code === 'KeyJ' || e.code === 'Space') I.attackTap = true;
    if (e.code === 'KeyM') game.paused = NC.HUD.panel('bigmap');
    if (e.code === 'KeyI') game.paused = NC.HUD.panel('bag');
    if (e.code === 'KeyC') game.paused = NC.HUD.panel('status');
    if (e.code === 'KeyK') game.paused = NC.HUD.panel('skills');
    if (e.code === 'Escape') game.paused = NC.HUD.panel('pause');
  });
  addEventListener('keyup', (e) => held.delete(e.code));
  addEventListener('blur', () => { held.clear(); game.mouse.down = false; });
  addEventListener('focusin', (e) => { if (editing(e.target)) { held.clear(); game.mouse.down = false; } });
  cv.addEventListener('mousemove', (e) => {
    game.mouse.cssX = e.clientX; game.mouse.cssY = e.clientY;
    game.mouse.sx = e.clientX * cv.width / innerWidth; game.mouse.sy = e.clientY * cv.height / innerHeight; game.mouse.active = true;
  });
  cv.addEventListener('mousedown', (e) => { if (e.button === 0) game.mouse.down = true; });
  addEventListener('mouseup', (e) => { if (e.button === 0) game.mouse.down = false; });
  cv.addEventListener('contextmenu', (e) => e.preventDefault());
  document.querySelectorAll('[data-panel]').forEach((b) =>
    b.addEventListener('click', () => { game.paused = NC.HUD.panel(b.dataset.panel); })
  );
  document.querySelectorAll('[data-close]').forEach((b) =>
    b.addEventListener('click', () => { NC.HUD.panel(b.dataset.close, false); game.paused = false; })
  );

  function readInput() {
    const I = game.input;
    let mx = 0, my = 0;
    for (const k of held) if (MOVE[k]) { mx += MOVE[k][0]; my += MOVE[k][1]; }
    I.mx = Math.sign(mx); I.my = Math.sign(my);
    I.attack = held.has('KeyJ') || held.has('Space') || I.attackTap;
    I.attackTap = false;
  }

  // ---------------- update ----------------
  function update(dt) {
    const I = game.input, world = game.world, p = game.player;
    readInput();
    game.time += dt;
    game.minutes += dt * 0.5 * (NC.clockRate ? NC.clockRate(game) : 1); // one game minute every two seconds (daytime runs faster: js/daynight.js)
    game.mouse.wx = game.cam.x + game.mouse.sx / game.scale;
    game.mouse.wy = game.cam.y + game.mouse.sy / game.scale;

    const online = NC.Online && NC.Online.active;
    if (online) {
      NC.Online.update(game, dt);
    } else {
    NC.updatePlayer(game, dt);
    NC.updateHeroAnim(game, dt);
    if (NC.Party) NC.Party.update(game, dt); // the party's AI friends (party.js)
    I.q = I.e = I.r = I.f = I.potion = I.sppotion = false;
    I[3] = I[4] = I[5] = I[6] = false;

    updateEnemies(dt);
    game.enemies = game.enemies.filter((e) => !e.dead);
    // enemies keep a little distance from each other
    const E = game.enemies;
    if (NC.Perf && NC.Perf.mobs) spaceOut(E);
    else for (let i = 0; i < E.length; i++)
      for (let j = i + 1; j < E.length; j++) {
        const a = E[i], b = E[j], d = NC.dist(a.x, a.y, b.x, b.y), m = a.r + b.r + 6;
        if (d > 0 && d < m) {
          const push = (m - d) / 2, ux = (b.x - a.x) / d, uy = (b.y - a.y) / d;
          NC.tryMove(world, a, -ux * push, -uy * push); NC.tryMove(world, b, ux * push, uy * push);
        }
      }
    for (const r of game.respawns) {
      r.t -= dt;
      if (r.t <= 0 && NC.dist(r.x, r.y, p.x, p.y) > 700) {
        r.done = true;
        const e = NC.makeEnemy(r.type, r.x, r.y, NC.spawnLevel(world, r.type, r.x, r.y));
        game.enemies.push(e);
        FX.puff(r.x, r.y - 20, 5, { speed: 60, color: '90,80,120' });
      }
    }
    game.respawns = game.respawns.filter((r) => !r.done);
    }
    // the monster under the mouse (its name, level and HP show; the target frame follows it)
    game.hover = null;
    if (game.mouse.active) {
      let best = 1e9;
      for (const e of game.enemies) {
        const dx = game.mouse.wx - e.x, dy = game.mouse.wy - (e.y - 60);
        if (Math.abs(dx) < 60 && dy > -110 && dy < 80 && Math.abs(dx) + Math.abs(dy) < best) { best = Math.abs(dx) + Math.abs(dy); game.hover = e; }
      }
    }
    if (game.target && (game.target.dead || game.time - game.targetT > 8)) game.target = null;
    if (!online) NC.updateLoot(game, dt);
    if (!online && (game.saveT += dt) > 10) { game.saveT = 0; NC.saveGame(game); }

    // portals: stand in one for a moment to jump to the other
    for (const [i, pt] of game.portals.entries()) {
      const inside = p.dead <= 0 && ((p.x - pt.x) / 70) ** 2 + ((p.y - pt.y) / 42) ** 2 < 1;
      pt.charge = inside && !pt.cool ? pt.charge + dt : 0;
      if (!inside) pt.cool = false;
      if (pt.charge > 0.55) {
        if (online) { pt.charge = 0; pt.cool = true; NC.Online.warp(pt.id || `local-${i}`); continue; }
        // a warp at the map edge: load the next map (maps.js)
        if (pt.to) { pt.charge = 0; FX.ring(p.x, p.y, 20, 180, '140,230,255', 0.5); NC.Maps.go(game, pt.to, pt.at); break; }
        const to = game.portals[pt.link !== undefined ? pt.link : (i + 1) % game.portals.length];
        to.cool = true; pt.charge = 0;
        FX.ring(p.x, p.y, 20, 180, '140,230,255', 0.5);
        p.x = to.x; p.y = to.y; p.vx = p.vy = 0;
        game.cam.x = p.x - game.vw / 2; game.cam.y = p.y - 60 - game.vh / 2;
        FX.ring(p.x, p.y, 20, 200, '255,220,120', 0.6);
        FX.stars(p.x, p.y - 50, 12, '255,230,140', { speed: 260 });
      }
      if (Math.random() < dt * 10) FX.add({ type: 'ember', x: pt.x + NC.rand(-60, 60), y: pt.y + NC.rand(-20, 20), vx: 0, vy: NC.rand(-90, -50), life: NC.rand(0.6, 1.1) });
    }

    // ambient: falling leaves, torch embers, fireflies
    if (Math.random() < dt * 2.2)
      FX.add({ type: 'leaf', x: game.cam.x + Math.random() * game.vw, y: game.cam.y - 20, vx: NC.rand(10, 50), vy: NC.rand(50, 90), life: 12,
        rot: NC.rand(0, TAU), spin: NC.rand(-2, 2), ph: NC.rand(0, 6), color: NC.pick(['#d6ebc0', '#b6d99a', '#eef6de', '#9fca86']),
        update(l, d) { l.x += Math.sin(l.t * 1.7 + l.ph) * 30 * d; } });
    for (const L of world.lights)
      if (L.owner.name === 'torch' && Math.random() < dt * 7 && Math.abs(L.x - p.x) < game.vw && Math.abs(L.y - p.y) < game.vh)
        FX.add({ type: 'ember', x: L.x + NC.rand(-8, 8), y: L.y + 10, vx: NC.rand(-12, 12), vy: NC.rand(-80, -40), life: NC.rand(0.5, 0.9) });
    while (game.flies.length < 26)
      game.flies.push({ x: p.x + NC.rand(-1100, 1100), y: p.y + NC.rand(-650, 650), ph: NC.rand(0, 9), s: NC.rand(0.5, 1.2) });
    for (const f of game.flies) {
      f.x += Math.sin(game.time * 0.7 * f.s + f.ph) * 22 * dt; f.y += Math.cos(game.time * 0.5 * f.s + f.ph * 2) * 16 * dt;
      if (Math.abs(f.x - p.x) > 1300) f.x = p.x + NC.rand(-1100, 1100);
      if (Math.abs(f.y - p.y) > 800) f.y = p.y + NC.rand(-650, 650);
    }

    FX.update(dt, game);

    // zone names
    const z = world.zones.find((zn) => zn.test(p.x, p.y)).name;
    if (z !== game.zoneName) { game.zoneName = z; NC.HUD.zone(z); }

    // camera
    // (a map may lift the camera: the village looks up at its world tree near it, world.camLift in village.js)
    const lift = (world.camLift ? world.camLift(p.x, p.y) : 0) + (NC.camShift ? NC.camShift(game) : 0); // (a phone: the hero clear of the touch controls, js/mobile.js)
    let tx = NC.clamp(p.x - game.vw / 2, 0, world.W - game.vw), ty = NC.clamp(p.y - 60 - game.vh / 2 + lift, 0, world.H - game.vh);
    const ct = NC.camTarget && NC.camTarget(game); // (a video's camera: [x, y] of the view's top-left, or nothing)
    if (ct) { tx = ct[0]; ty = ct[1]; }
    const k = 1 - Math.exp(-dt * 9);
    game.cam.x += (tx - game.cam.x) * k; game.cam.y += (ty - game.cam.y) * k;
    game.shake = Math.max(0, game.shake - dt * 30);
  }

  // ---------------- render ----------------
  function visible(x0, y0, x1, y1) {
    const c = game.cam;
    return x1 > c.x - 50 && x0 < c.x + game.vw + 50 && y1 > c.y - 50 && y0 < c.y + game.vh + 50;
  }

  function drawPortal(pt) {
    const t = game.time;
    ctx.save();
    ctx.translate(pt.x, pt.y);
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 110);
    g.addColorStop(0, 'rgba(255,240,180,0.55)'); g.addColorStop(0.6, 'rgba(120,200,255,0.18)'); g.addColorStop(1, 'rgba(120,200,255,0)');
    ctx.fillStyle = g; ctx.scale(1, 0.55); ctx.beginPath(); ctx.arc(0, 0, 110, 0, TAU); ctx.fill();
    for (let i = 0; i < 3; i++) {
      const r = 38 + i * 26, a0 = t * (1.4 - i * 0.35) * (i % 2 ? -1 : 1);
      ctx.strokeStyle = i === 1 ? 'rgba(150,225,255,0.85)' : 'rgba(255,225,140,0.9)';
      ctx.lineWidth = 7 - i * 1.5;
      ctx.beginPath(); ctx.arc(0, 0, r, a0, a0 + Math.PI * 1.3); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, r, a0 + Math.PI * 1.5, a0 + Math.PI * 1.8); ctx.stroke();
    }
    ctx.restore();
  }

  function drawProp(p, dt) {
    if (p.canopy) {
      const pl = game.player;
      const behind = pl.y < p.y - 8 && pl.x > p.canopy.x0 && pl.x < p.canopy.x1 && pl.y - 60 < p.canopy.y1 + 40 && pl.y > p.canopy.y0;
      p.fade = NC.lerp(p.fade || 0, behind ? 1 : 0, 1 - Math.exp(-dt * 10));
    }
    const rot = graphicsProfile().sway && p.sway !== undefined ? Math.sin(game.time * 1.8 + p.sway) * 0.05 : 0; // grass and flowers sway
    NC.drawSpr(ctx, p.name, p.x, p.y, { flip: p.flip, scale: p.scale, rot, alpha: p.fade ? 1 - 0.55 * p.fade : 1 });
  }

  function nightness() {
    const hr = (((game.minutes / 60) % 24) + 24) % 24;
    const n = hr < 5 || hr >= 19.5 ? 1 : hr < 7 ? (7 - hr) / 2 : hr >= 17.5 ? (hr - 17.5) / 2 : 0;
    // (a map may stay dusky all day: the village under the world tree, world.dusk in village.js)
    return game.world && game.world.dusk ? Math.max(n, game.world.dusk) : n;
  }

  function lighting(cx, cy, s) {
    const n = nightness();
    if (n <= 0.01) return;
    const profile = graphicsProfile();
    // the night's blue, warmed at dawn and dusk (minimap.js NC.skyAmbient)
    const amb = game.world.ambient ? game.world.ambient(game.minutes, n) // (a map's own light: village.js)
      : NC.skyAmbient ? NC.skyAmbient(game.minutes, n) : [NC.lerp(255, 172, n), NC.lerp(255, 186, n), NC.lerp(255, 232, n)].map(Math.round);
    const LK = LS.on ? (NC.Gfx ? NC.Gfx.lightK() : 0.5) : 1, LW = Math.max(1, Math.round(cv.width * LK)), LH = Math.max(1, Math.round(cv.height * LK));
    if (lightCv.width !== LW || lightCv.height !== LH) { lightCv.width = LW; lightCv.height = LH; }
    lctx.globalCompositeOperation = 'source-over';
    lctx.fillStyle = `rgb(${amb})`;
    lctx.fillRect(0, 0, lightCv.width, lightCv.height);
    lctx.globalCompositeOperation = 'lighter';
    const glow = (x, y, r, rgb, a) => {
      const X = (x - cx) * s * LK, Y = (y - cy) * s * LK, R = r * s * LK;
      if (X < -R || Y < -R || X > lightCv.width + R || Y > lightCv.height + R) return;
      if (LS.on) { softLight(lctx, X, Y, R, rgb, a); return; }
      const g = lctx.createRadialGradient(X, Y, 0, X, Y, R);
      g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`);
      lctx.fillStyle = g; lctx.fillRect(X - R, Y - R, 2 * R, 2 * R);
    };
    for (const L of game.world.lights) {
      const f = 1 + Math.sin(game.time * 11 + L.flick) * 0.04 + Math.sin(game.time * 23 + L.flick * 2) * 0.03;
      glow(L.x, L.y + 120, L.r * f, L.rgb, 0.75 * n);
    }
    for (const pt of game.portals) glow(pt.x, pt.y - 30, 260, '140,210,255', 0.6 * n);
    const p = game.player;
    glow(p.x, p.y - 60, 330, '130,130,170', 0.5 * n);
    for (const L of FX.lights) glow(L.x, L.y, L.r, L.rgb, FX.lightA(L) * n); // skills light up the night around them
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(lightCv, 0, 0, cv.width, cv.height);
    ctx.restore();
    // warm bloom around every flame
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    if (profile.bloom) for (const L of game.world.lights) {
      if (!visible(L.x - 90, L.y - 90, L.x + 90, L.y + 90)) continue;
      const f = 1 + Math.sin(game.time * 13 + L.flick) * 0.08;
      if (LS.on) { softLight(ctx, L.x, L.y, 70 * f, L.rgb, 0.55 * n); continue; }
      const g = ctx.createRadialGradient(L.x, L.y, 0, L.x, L.y, 70 * f);
      g.addColorStop(0, `rgba(${L.rgb},${0.55 * n})`); g.addColorStop(1, `rgba(${L.rgb},0)`);
      ctx.fillStyle = g; ctx.fillRect(L.x - 80, L.y - 80, 160, 160);
    }
    // fireflies
    for (let i = 0; i < Math.ceil(game.flies.length * profile.particleDensity); i++) {
      const f = game.flies[i];
      if (!visible(f.x - 14, f.y - 14, f.x + 14, f.y + 14)) continue;
      const a = (0.5 + 0.5 * Math.sin(game.time * 3 * f.s + f.ph)) * n;
      if (a < 0.05) continue;
      if (LS.on) { softLight(ctx, f.x, f.y, 14, '220,255,150', a); continue; }
      const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, 14);
      g.addColorStop(0, `rgba(220,255,150,${a})`); g.addColorStop(1, 'rgba(220,255,150,0)');
      ctx.fillStyle = g; ctx.fillRect(f.x - 14, f.y - 14, 28, 28);
    }
    ctx.restore();
  }

  // ---------------- far monsters (2026-10-18, phase 1 "มอนไกลอัปเดตช้าลง"; NC.Perf.mobs) ----------------
  // A field keeps ~150 monsters, ~20 of them on screen. One well off screen that is only standing, resting or walking home
  // is updated every 4th frame with the time it missed (at most 0.1 s), each on its own beat; a monster that is fighting,
  // a boss (it carries a light / rootBoss) and everything near the screen every frame
  const CALM = { idle: 1, rest: 1, return: 1, wander: 1 };
  let mobBeat = 0;
  function farCalm(e) {
    if (!CALM[e.state] || e.light || e.rootBoss || e.boss || (e.r || 0) >= 48) return false;
    const cx = game.cam.x + game.vw / 2, cy = game.cam.y + game.vh / 2;
    return Math.abs(e.x - cx) > game.vw / 2 + 500 || Math.abs(e.y - cy) > game.vh / 2 + 450;
  }
  function updateEnemies(dt) {
    const on = NC.Perf && NC.Perf.mobs;
    mobBeat++;
    for (const e of game.enemies) {
      if (on && farCalm(e)) {
        e._farDt = (e._farDt || 0) + dt;
        if (e._farK === undefined) e._farK = (Math.random() * 4) | 0;
        if ((mobBeat + e._farK) % 4 !== 0) continue;
      }
      const d = e._farDt ? Math.min(0.1, e._farDt) : dt;
      e._farDt = 0;
      NC.updateEnemy(game, e, d);
    }
  }
  // the spacing between monsters through a grid of cells as big as the widest pair's reach (the same pushes as the
  // all-pairs loop: pairs further apart than a.r + b.r + 6 never pushed; 150 monsters were 11,000 pairs a frame)
  const GRID = new Map();
  function spaceOut(E) {
    let C = 120;
    for (const e of E) if (2 * (e.r || 0) + 6 > C) C = 2 * e.r + 6;
    GRID.clear();
    for (let i = 0; i < E.length; i++) {
      const k = Math.floor(E[i].x / C) * 100003 + Math.floor(E[i].y / C);
      let a = GRID.get(k);
      if (!a) GRID.set(k, (a = []));
      a.push(i);
    }
    const world = game.world;
    for (let i = 0; i < E.length; i++) {
      const a = E[i], gx = Math.floor(a.x / C), gy = Math.floor(a.y / C);
      for (let ox = -1; ox <= 1; ox++)
        for (let oy = -1; oy <= 1; oy++) {
          const L = GRID.get((gx + ox) * 100003 + gy + oy);
          if (!L) continue;
          for (const j of L) {
            if (j <= i) continue;
            const b = E[j], d = NC.dist(a.x, a.y, b.x, b.y), m = a.r + b.r + 6;
            if (d > 0 && d < m) {
              const push = (m - d) / 2, ux = (b.x - a.x) / d, uy = (b.y - a.y) / d;
              NC.tryMove(world, a, -ux * push, -uy * push); NC.tryMove(world, b, ux * push, uy * push);
            }
          }
        }
    }
  }

  const list = [];
  // Only these nonblocking ground plants may disappear with graphics quality.
  // Trees, rocks, buildings, lights and all interactive/combat entities stay visible.
  const decorativeNames = new Set([
    'grass', 'camp_grass1', 'camp_grass2', 'camp_flowers', 'camp_fern', 'camp_shrooms', 'camp_pebbles',
    'm_grass1', 'm_grass2', 'm_flowers1', 'm_flowers2', 'w_fern', 'w_grass', 'w_shrooms_small', 'c_grass',
  ]);
  const decorationSamples = new WeakMap();
  function drawDecoration(p, density) {
    if (density >= 1 || !decorativeNames.has(p.name) || p.canopy || p.interactive || p.solid) return true;
    if (!decorationSamples.has(p)) decorationSamples.set(p, NC.hash(p.x, p.y, 73));
    return decorationSamples.get(p) < density;
  }
  function render(dt) {
    followDpr(); // before reading game.scale, which resize() recomputes
    const world = game.world, s = game.scale;
    const profile = graphicsProfile();
    const measuring = !!NC.Perf?.recording;
    const sh = game.shake;
    // Presentation frequency must not consume combat RNG during screen shake.
    const shakeTick = Math.floor(game.time * 60);
    const cx = game.cam.x + (sh ? (NC.hash(shakeTick, 0, 19) * 2 - 1) * sh : 0);
    const cy = game.cam.y + (sh ? (NC.hash(shakeTick, 0, 31) * 2 - 1) * sh : 0);
    renderCameraX = cx; renderCameraY = cy;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#1b2230'; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.setTransform(s, 0, 0, s, -cx * s, -cy * s);
    ctx.imageSmoothingEnabled = true;
    // High-quality resampling on every moving/downscaled sprite can saturate the
    // browser rasterizer even when JS takes only 2 ms. Keep bilinear smoothing
    // for the lighter presets; it stays smooth without the expensive filter.
    ctx.imageSmoothingQuality = profile.smoothing === 'high' ? 'high' : 'low';

    // ground, rugs, portals
    const GS = world.GS;
    const day = 1 - nightness();
    if (day < 1) ctx.drawImage(world.ground, cx * GS, cy * GS, game.vw * GS, game.vh * GS, cx, cy, game.vw, game.vh);
    if (day > 0.01) {
      ctx.globalAlpha = day;
      ctx.drawImage(world.groundDay, cx * GS, cy * GS, game.vw * GS, game.vh * GS, cx, cy, game.vw, game.vh);
      ctx.globalAlpha = 1;
    }
    if (NC.drawWater) NC.drawWater(ctx, game, cx, cy); // (js/water.js: the ponds move)
    const queryStarted = measuring ? performance.now() : 0;
    const candidates = NC.RenderIndex
      ? NC.RenderIndex.query(world, { x: game.cam.x, y: game.cam.y, width: game.vw, height: game.vh, margin: Math.max(50, Math.abs(sh)) }, profile)
      : world;
    if (measuring) {
      sceneQueryMs = performance.now() - queryStarted;
      staticCandidates = candidates.props.length + candidates.blocks.length + candidates.decals.length;
    }
    for (const d of candidates.decals) NC.drawSpr(ctx, d.name, d.x, d.y);
    for (const pt of game.portals) if (visible(pt.x - 150, pt.y - 100, pt.x + 150, pt.y + 100)) drawPortal(pt);

    // what is on screen
    list.length = 0;
    const cullStarted = measuring ? performance.now() : 0;
    for (const p of candidates.props) {
      if (!drawDecoration(p, profile.decorationDensity)) continue;
      const sp = NC.SPR[p.name];
      if (!sp) continue;
      const w = sp.w * p.scale, h = sp.h * p.scale, x0 = p.x - sp.ax * w, y0 = p.y - sp.ay * h;
      if (visible(x0, y0, x0 + w, y0 + h)) list.push(p);
    }
    for (const b of candidates.blocks) if (visible(b.bx, b.by - world.blockH, b.bx + 150, b.by + 120)) list.push(b);
    // Includes the precise static-object scan in both A/B variants, so the
    // indexed lookup is compared with the full scan it replaces.
    if (measuring) sceneQueryMs += performance.now() - cullStarted;
    for (const e of game.enemies) if (visible(e.x - 120, e.y - 200, e.x + 120, e.y + 40)) list.push(e);
    for (const l of game.loot) if (visible(l.x - 60, l.y - 200, l.x + 60, l.y + 30)) list.push(l);
    list.push(game.player);
    if (NC.Online && NC.Online.active) NC.Online.collect(list, visible);
    else if (NC.Party) NC.Party.collect(list, visible); // party members
    // effects standing on the ground among the characters (spikes, pillars): sorted with them by their foot
    for (const f of FX.list) if (f.layer === 'sorted') { f.kind = 'fx'; if (f.sort === undefined) f.sort = f.y; list.push(f); }
    const sortStarted = measuring ? performance.now() : 0;
    list.sort((a, b) => a.sort - b.sort);
    if (measuring) sceneSortMs = performance.now() - sortStarted;

    // contact shadows
    if (profile.shadows !== 'none') for (const o of list) {
      if (o.kind === 'prop') { const sd = SHADOW[o.name] || o.shadow; if (profile.shadows === 'all' && sd) NC.drawShadow(ctx, o.x, o.y - 2, sd[0] * o.scale, sd[1] * o.scale, 0.32); }
      else if (o.kind === 'enemy') NC.drawShadow(ctx, o.x, o.y, o.type === 'slime' ? 34 - o.z * 0.2 : 42, o.type === 'slime' ? 11 : 13, 0.38);
      else if ((o.kind === 'player' || o.kind === 'ally') && o.dead <= 0) NC.drawShadow(ctx, o.x, o.y, 34, 11, 0.4);
      else if (o.kind === 'loot') NC.drawShadow(ctx, o.x, o.y, 24, 8, 0.3);
    }
    FX.draw(ctx, 'low');
    for (const o of list) {
      if (o.kind === 'prop') drawProp(o, dt);
      else if (o.kind === 'block') ctx.drawImage(o.art.cv, o.bx - o.art.pad, o.by - world.blockH - o.art.pad, o.art.w, o.art.h);
      else if (o.kind === 'enemy') NC.drawEnemy(ctx, game, o);
      else if (o.kind === 'loot') NC.drawLoot(ctx, game, o);
      else if (o.kind === 'fx') FX.drawOne(ctx, o);
      else if (o.kind === 'ally' && NC.Online && NC.Online.active) NC.Online.drawRemote(ctx, game, o);
      else if (o.kind === 'ally') NC.Party.draw(ctx, game, o);
      else NC.drawPlayer(ctx, game);
    }
    FX.draw(ctx, 'high');
    lighting(cx, cy, s);
    ctx.setTransform(s, 0, 0, s, -cx * s, -cy * s);
    for (const e of game.enemies) if (visible(e.x - 180, e.y - 240, e.x + 180, e.y + 40)) NC.drawEnemyBar(ctx, e, game);
    NC.drawPlayerTag(ctx, game);
    if (NC.Online && NC.Online.active) NC.Online.drawTags(ctx, game);
    else if (NC.Party) NC.Party.drawTags(ctx, game);
    NC.drawTrail(ctx, game);
    FX.draw(ctx, 'glow');
    NC.Maps.drawLabels(ctx, game); // the next map's name over each edge warp

    // vignette
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (profile.vignette) {
      if (!vignette) {
        vignette = ctx.createRadialGradient(cv.width / 2, cv.height / 2, cv.height * 0.45, cv.width / 2, cv.height / 2, cv.height * 1.05);
        vignette.addColorStop(0, 'rgba(8,10,28,0)'); vignette.addColorStop(1, 'rgba(8,10,28,0.5)');
      }
      ctx.fillStyle = vignette; ctx.fillRect(0, 0, cv.width, cv.height);
    }
    // screen flashes (a bright burst, a darkening for an ultimate)
    for (const f of FX.flashes) {
      const u = f.t / f.life, a = f.a * (u < 0.12 ? u / 0.12 : 1 - (u - 0.12) / 0.88);
      ctx.globalCompositeOperation = f.mode;
      ctx.fillStyle = `rgba(${f.rgb},${NC.clamp(a, 0, 1)})`;
      ctx.fillRect(0, 0, cv.width, cv.height);
    }
    ctx.globalCompositeOperation = 'source-over';
    if (game.player.dead > 0) {
      ctx.fillStyle = `rgba(10,8,20,${NC.clamp(1.3 - game.player.dead / 2, 0, 0.7)})`;
      ctx.fillRect(0, 0, cv.width, cv.height);
    }
  }

  // ---------------- loop ----------------
  let last = 0;
  let fpsStarted = null, fpsFrames = 0;
  const windowHidden = () => !!(window.NCDesktop && window.NCDesktop.isWindowHidden && window.NCDesktop.isWindowHidden());
  const backgrounded = () => document.hidden || windowHidden();
  let wasBackground = false;
  function resetFrameRate() {
    fpsStarted = null; fpsFrames = 0;
    game.frameRate.fps = null; game.frameRate.at = 0;
  }
  function recordFrameRate(now) {
    if (backgrounded()) { resetFrameRate(); return; }
    if (fpsStarted === null) { fpsStarted = now; return; }
    fpsFrames++;
    const elapsed = now - fpsStarted;
    if (elapsed < 1000) return;
    game.frameRate.fps = fpsFrames * 1000 / elapsed;
    game.frameRate.at = now;
    fpsStarted = now; fpsFrames = 0;
  }
  function frame(now) {
    requestAnimationFrame(frame);
    // Electron can keep RAF and document.visibilityState active while minimized.
    // Leave simulation to keeprun's worker and avoid wasting GPU power on a hidden window.
    if (backgrounded()) {
      if (!wasBackground) { last = 0; resetFrameRate(); wasBackground = true; }
      return;
    }
    if (wasBackground) { last = 0; resetFrameRate(); wasBackground = false; }
    if (NC.Gfx && NC.Gfx.skip(now)) return; // (js/gfx.js: the frame cap; it also times the frames for the auto quality)
    const t = now / 1000;
    const dt = Math.min(0.05, last ? t - last : 0.016);
    last = t;
    step(dt, false, now);
  }
  // (bg: a hidden tab stepped by js/keeprun.js, the update without the drawing)
  function hitstopFrame(dt) {
    game.hitstop -= dt;
    FX.update(dt * 0.4, game);
    if (NC.Net && NC.Net.updateRemotes) NC.Net.updateRemotes(dt);
  }
  function step(dt, bg, frameAt) {
    if (NC.timeScale) dt *= NC.timeScale(dt);   // (js/hitfeel.js: clears the hit freeze while ความมันตอนตีโดน is on)
    // a window open (game.paused) no longer stops the world; only the few screens of NC.worldHeld do (js/keeprun.js)
    game.hold = !!game.paused && (NC.worldHeld ? NC.worldHeld(game) : true);
    if (!game.hold) {
      // hitstop freezes the characters; the effects go on slowly, so an impact's flash still pops open
      if (game.hitstop > 0) hitstopFrame(dt);
      else update(dt);
    }
    if (!bg) {
      render(dt);
      // Only an accepted RAF counts: background updates and manually stepped captures do not present game frames.
      if (frameAt !== undefined) recordFrameRate(frameAt);
    }
    NC.HUD.update(game);
  }
  document.addEventListener('visibilitychange', () => {
    held.clear(); game.mouse.down = false;
    last = 0;
    resetFrameRate();
  });
  if (window.NCDesktop && window.NCDesktop.onWindowStateChanged) {
    window.NCDesktop.onWindowStateChanged(() => {
      held.clear(); game.mouse.down = false;
      last = 0;
      resetFrameRate();
    });
  }

  function start() {
    resize();
    NC.loadAssets().then(() => {
      const world = (game.world = NC.Maps.first(game)); // the saved map, else the camp
      const p0 = NC.Maps.startAt(world);
      game.player = NC.makePlayer(p0[0], p0[1]);
      NC.loadGear(game);
      NC.updateHeroAnim(game, 0); // first pose
      game.portals = NC.Maps.portals(world); // the camp's portal pair + warps to the other maps
      game.enemies = NC.Maps.monsters(world); // the camp's NC.ENEMY_SPAWNS, or the field's own
      game.cam.x = NC.clamp(game.player.x - game.vw / 2, 0, world.W - game.vw);
      game.cam.y = NC.clamp(game.player.y - 60 - game.vh / 2, 0, world.H - game.vh);
      NC.HUD.init(game);
      // a hero without a name (a new game, or a save from before names): ask for one (online: the server's name comes in)
      if (NC.ONLINE) game.player.name = '…';
      else if (!game.player.name) NC.HUD.askName();
      addEventListener('resize', resize);
      document.getElementById('loading').remove();
      // (sim: one frame of the game without drawing it, for test runs and the balance harness)
      window.__nc = { game, step, sim: (dt) => { game.hold = !!game.paused && (NC.worldHeld ? NC.worldHeld(game) : true); if (game.hold) return; if (game.hitstop > 0) hitstopFrame(dt); else update(dt); } };
      addEventListener('beforeunload', () => NC.saveGame(game));
      requestAnimationFrame(frame);
    });
  }

  NC.ENEMY_SPAWNS = [
    ['hollow', 900, 1660], ['hollow', 2060, 1330], ['slime', 2000, 1870], ['slime', 950, 1960],
    ['slime', 2380, 1660], ['slime', 2520, 1930], ['hollow', 2330, 1180],
    ['hollow', 3250, 1480], ['hollow', 3900, 1500], ['hollow', 3570, 1820], ['slime', 3120, 1700], ['slime', 4010, 1760],
    ['slime', 3420, 1180], ['hollow', 3650, 900],
  ];

  start();
})();
