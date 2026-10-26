/* The web online client's side of the dungeons (js/dungeons.js; backend/dungeon_traps.go, dungeon_chests.go,
   dungeon_secret.go). Offline, dungeons.js's frame (run from NC.updateLoot, which never runs online) moves the spike
   traps and the Bat King's hidden way; online the server does, and this draws them:
   - the spike traps (:341-368): each plate's phase is a pure function of the server clock (the snapshots'
     `serverTime`, counted on between them) and the plate's start t, c = (t + s) % 3.4: down before 2.2 s, the
     warning (a red pulse, the spikes peeking out) until 2.75 s, then up; drawn as :353-368 draws them, with no traffic.
     A hit is the server's combat event on the hero (hazard "spikes"): online.js draws its number, this the grey puff
     at the hero (:350);
   - a chest broken open (`chest` event, :205-223 lootChest): the stars and the ring for everyone, and for its opener
     the gold number over it (:208) and a log line per material (online they go straight into the bag; the potions and
     gear lie on the ground as the server's loot);
   - the hidden way (`secretWay` events, :286-314): the 50th bat's warning, the opening (:295-307: the portal where the
     server says, the ring, stars, shake, toast and log line), the portal alone for a hero who comes while it stands,
     and the shutting (:308-314). The portal is one of game.portals, so game.js draws it, labels it and warps through
     it (the server takes the 'nest' warp only while it is open). NC.secretKnown reads the online hero's own secrets.
   Apart from js/online.js so the FX replay sources stay untouched (scripts/export-unity-fx-replay.mjs). */
(function () {
  'use strict';
  const NC = window.NC;
  // js/dungeons.js:344 the cycle; :359-366 the looks
  const CYCLE = 3.4, WARN_FROM = 2.2, UP_FROM = 2.75, WARN_RGBA = 'rgba(255,80,90,0.9)', PLATE_DROP = 0.42;
  const HIT_PUFF = { lift: 20, count: 5, speed: 120, color: '200,200,210' }; // :350
  const CHEST = { rgb: '255,220,120', stars: 18, starsLift: 50, speed: 300, ringLift: 20, fill: '#ffd873', size: 34, numLift: 150 }; // :208, :219-220
  const NEST = { floor: 'batnest', id: 'nest', ring: '200,150,255', stars: '220,190,255', shake: 10 }; // :300-303
  const WORDS = { // js/dungeons.js:292, :304, :305, :313
    stir: 'ค้างคาวแถวนี้ดูกระวนกระวาย... เหมือนมีบางอย่างอยู่ลึกเข้าไปในถ้ำ',
    toast: 'ได้ยินเสียงปีกนับพันกระพืออยู่ลึกเข้าไปในถ้ำ... ทางลับเปิดแล้ว (3 นาที)',
    open: '★ ทางลับสู่รังราชาค้างคาวเปิดแล้ว! รีบหาให้เจอภายใน 3 นาที',
    shut: 'ทางลับในถ้ำค้างคาวปิดลงแล้ว',
  };
  let clock = null, selfId = '', secrets = new Set(), nest = null, drawer = null;

  // the server time now (ms): the last snapshot's, counted on since it came
  const serverNow = () => clock ? clock.serverTime + (performance.now() - clock.receivedAt) : null;
  // a plate's phase at the server time ms (backend/dungeon_traps.go spikePhase): 0 down, 1 the warning, 2 up
  function phase(start, ms) {
    const c = (ms / 1000 + start) % CYCLE;
    return c < WARN_FROM ? 0 : c < UP_FROM ? 1 : 2;
  }
  // (a plate's start as the floor was built: offline play before going online moves t.t on)
  const baseBuild = NC.buildField;
  NC.buildField = function () {
    const world = baseBuild.apply(this, arguments);
    for (const t of world?.traps || []) if (t.start === undefined) t.start = t.t;
    return world;
  };

  // :353-368 on the ground layer, the phase from the server clock
  function ensureDrawer() {
    const FX = NC.FX;
    if (drawer && FX.list.includes(drawer)) return;
    drawer = FX.add({ type: 'custom', layer: 'low', x: 0, y: 0, life: Infinity, draw(ctx) {
      const g = NC.game, now = serverNow();
      if (!(NC.Online?.active || NC.Online?.enabled) || !g?.world?.traps || now === null) return;
      for (const t of g.world.traps) {
        if (Math.abs(t.x - g.cam.x - g.vw / 2) > g.vw || Math.abs(t.y - g.cam.y - g.vh / 2) > g.vh) continue;
        const ph = phase(t.start ?? t.t, now), up = ph === 2, warn = ph === 1;
        if (warn) {
          ctx.save(); ctx.globalAlpha = 0.35 + 0.25 * Math.sin(g.time * 30);
          ctx.fillStyle = WARN_RGBA; ctx.beginPath(); ctx.ellipse(t.x, t.y, t.w * 0.6, t.h * 0.6, 0, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        }
        NC.drawSpr(ctx, up ? 'd_spikes_up' : 'd_spikes_down', t.x, t.y + t.h * PLATE_DROP);
        if (warn && NC.SPR.d_spikes_up) NC.drawSpr(ctx, 'd_spikes_up', t.x, t.y + t.h * PLATE_DROP, { sy: 0.4, alpha: 0.8 });
      }
    } });
  }

  // the hidden way as one of game.portals (:300), while the hero is on its map
  const nestPortal = () => (NC.game?.portals || []).find((pt) => pt.id === NEST.id && pt.secret);
  function showNest() {
    const game = NC.game;
    if (!nest || !game || game.mapId !== nest.mapId || nestPortal()) return;
    const F = NC.MAPS[NEST.floor] || {};
    game.portals.push({ x: nest.x, y: nest.y, charge: 0, cool: false, id: NEST.id, to: NEST.floor, at: nest.at, name: F.name, lvText: F.lvText, secret: true });
  }
  function dropNest() {
    nest = null;
    const game = NC.game;
    if (game?.portals) game.portals = game.portals.filter((pt) => !(pt.id === NEST.id && pt.secret));
  }
  function onSecret(game, data) {
    if (data.kind === 'stir') { NC.HUD.log(WORDS.stir + ' (50/100)', 'sys'); return; }
    if (data.kind === 'count') { NC.HUD.log(`ค้างคาวในถ้ำ ${data.n | 0}/${data.of | 0 || 100}`, 'sys'); return; } // (every 25th: Discord NC-003)
    if (data.kind === 'shut') { if (nest) NC.HUD.log(WORDS.shut, 'sys'); dropNest(); return; }
    if ((data.kind !== 'open' && data.kind !== 'state') || !Number.isFinite(data.x) || !Number.isFinite(data.y)) return;
    dropNest();
    nest = { x: data.x, y: data.y, at: data.at || 'out', until: Number(data.until) || 0, mapId: data.mapId || game.mapId };
    showNest();
    if (data.kind !== 'open') return; // (a hero who came while it stands: no fanfare)
    const FX = NC.FX;
    FX.ring(data.x, data.y, 30, 420, NEST.ring, 0.9, 12);
    FX.stars(data.x, data.y - 60, 24, NEST.stars, { speed: 320 });
    game.shake = Math.max(game.shake || 0, NEST.shake);
    game.toast(WORDS.toast);
    NC.HUD.log(WORDS.open, 'level');
  }

  function onChest(game, data) {
    const x = Number(data.x), y = Number(data.y), FX = NC.FX;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    FX.stars(x, y - CHEST.starsLift, CHEST.stars, CHEST.rgb, { speed: CHEST.speed });
    FX.ring(x, y - CHEST.ringLift, 20, 190, CHEST.rgb, 0.6, 9);
    if (data.actorId !== selfId) return;
    const coins = Number(data.coins) || 0;
    if (coins > 0) FX.num(x, y - CHEST.numLift, `+${coins.toLocaleString()} เหรียญ`, { fill: CHEST.fill, size: CHEST.size });
    for (const [id, n] of Object.entries(data.mats || {})) if (n > 0) NC.HUD.log(`ได้รับ ${NC.MATERIALS?.[id]?.name || id} ×${n}`, 'item');
  }

  function onSpikes(game, data) {
    const who = data.targetId === selfId ? game.player : NC.Online?.remotes?.get(data.targetId);
    const x = who ? who.x : Number(data.x), y = who ? who.y : Number(data.y);
    if (Number.isFinite(x) && Number.isFinite(y)) NC.FX.puff(x, y - HIT_PUFF.lift, HIT_PUFF.count, { speed: HIT_PUFF.speed, color: HIT_PUFF.color });
  }

  // the online hero's secrets for the world map's floors (mapwin.js / worldmap.js floorsUnder)
  const knownOffline = NC.secretKnown;
  NC.secretKnown = (id) => ((NC.Online?.active || NC.Online?.enabled) ? secrets.has(id) : !!knownOffline?.(id));

  window.addEventListener('nightcamp:online-snapshot', (event) => {
    const snapshot = event.detail?.snapshot, game = NC.game;
    if (!snapshot || !game) return;
    if (Number.isFinite(snapshot.serverTime)) clock = { serverTime: snapshot.serverTime, receivedAt: event.detail.receivedAt ?? performance.now() };
    selfId = snapshot.self?.id || selfId;
    secrets = new Set(Array.isArray(snapshot.self?.secrets) ? snapshot.self.secrets : []);
    if (game.world?.traps?.length) ensureDrawer();
    if (nest && (snapshot.mapId !== nest.mapId || (nest.until && serverNow() > nest.until))) dropNest(); // (left the cave, or its time is up)
    else showNest(); // (a map change rebuilds game.portals)
  });
  window.addEventListener('nightcamp:online-event', (event) => {
    const data = event.detail, game = NC.game;
    if (!data || !game) return;
    if (data.type === 'secretWay') onSecret(game, data);
    else if (data.type === 'chest') onChest(game, data);
    else if (data.type === 'combat' && data.hazard === 'spikes') onSpikes(game, data);
  });
})();
