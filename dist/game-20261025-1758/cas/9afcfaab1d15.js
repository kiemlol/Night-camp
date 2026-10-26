/* The web online client's side of the class-3 core (js/class3_core.js, backend/tier3.go, tier3_fx.go). The server
   runs the power-ups, the moon ring and the awakening; the client draws them from what it sends:
   - the meters of every hero's record: c3Ring (the moon ring, 0-100) and c3Awake (while awake, the awakening's length
     in seconds, a clock counted from the first snapshot that shows it) go onto p.c3, which class3_core.js's own
     NC.drawPlayer wrapper draws for the local hero (the ring, the back-piece, the giant); the other heroes are drawn
     with the same C3.drawHero round NC.Online.drawRemote;
   - `class3` events: cast (the back-piece's flash and the glow over the hero), awaken and awakenEnd (their burst and
     closing ring, and the clock exactly), fx (an effect of the library, drawn with C3.looks at the server's spots:
     the chain's hops, the drops, the shards' angles; its numbers are the usual combat and heal events).
   The families' own meters and events are theirs (js/online-class3-<family>.js, after this file). Apart from
   js/online.js so the FX replay sources stay untouched (scripts/export-unity-fx-replay.mjs). */
(function () {
  const NC = window.NC, C3 = NC.C3;
  if (!C3 || !NC.Online) return;
  const CAST_GLOW = [40, 160, 0.55, 0.35], CAST_LIFT = 80; // (js/class3_core.js:188 the glow over a powered-up cast)
  const AWAKE_BASE = 8, AWAKE_PER_LV = 2; // (C3:244 awake 8 + 2 lv s: the level back from the event's seconds)
  const num = (meters, key) => Number(meters?.[key]) || 0;
  const heroOf = (game, id) => (game.player && game.player.id === id ? game.player : NC.Online?.remotes?.get(id));
  const monsterOf = (game, id) => (id ? (game.enemies || []).find((m) => (m.sid || m.id) === id) : null);
  const now = () => (NC.game ? NC.game.time : 0);

  // the power-up's job and def (J.enh[i]) from its id
  function powerUp(id) {
    for (const J of Object.values(C3.jobs)) {
      const D = J.enh.find((x) => x.id === id);
      if (D) return { J, D };
    }
    return null;
  }

  // a hero's p.c3 from its record's meters: the ring, and the awakening's clock on its first sight
  function sync(p, meters) {
    if (!p || !C3.jobOf(p)) return;
    const st = C3.state(p), t = now(), seconds = num(meters, 'c3Awake');
    st.awk = num(meters, 'c3Ring');
    if (!seconds) { st.seen = false; if (st.until > t) st.until = 0; return; }
    if (st.seen) return;
    st.seen = true;
    if (!(st.until > t)) { st.start = t; st.until = t + seconds; }
  }
  function onSnapshot(event) {
    const game = NC.game, data = event.detail?.snapshot;
    if (!game || !data?.self || !C3) return;
    sync(game.player, data.self.meters);
    for (const remote of NC.Online?.remotes?.values() || []) sync(remote, remote.meters);
  }

  function onEvent(event) {
    const data = event.detail, game = NC.game;
    if (!data || data.type !== 'class3' || !game || !C3) return;
    const p = heroOf(game, data.actorId), J = p && C3.jobOf(p);
    if (data.kind === 'fx') return drawFx(game, data);
    if (!J) return; // (out of this client's sight, or no longer class 3)
    const st = C3.state(p), mine = p === game.player;
    if (data.kind === 'cast') {
      const E = powerUp(data.id);
      st.flash = game.time;
      NC.VFX.glowAt(p.x, p.y - CAST_LIFT, CAST_GLOW[0], CAST_GLOW[1], (E && E.D.rgb) || J.rgb, CAST_GLOW[2], CAST_GLOW[3], { hot: true });
    } else if (data.kind === 'awaken') {
      const seconds = Number(data.seconds) || 0;
      st.awk = 0; st.start = game.time; st.until = game.time + seconds; st.seen = true;
      C3.awakenLooks(game, p, J, (seconds - AWAKE_BASE) / AWAKE_PER_LV, mine);
    } else if (data.kind === 'awakenEnd') {
      st.until = 0;
      C3.awakenEndLook(game, p, J);
    }
  }

  // an effect of the library where the server set it off
  function drawFx(game, data) {
    const E = powerUp(data.id), look = C3.looks[data.fx];
    if (!E || !look) return;
    const o = Object.assign(C3.lookOf(E.J, E.D, 0, null), { big: !!data.big });
    const who = (data.heal || []).map((id) => heroOf(game, id)).filter(Boolean);
    look(game, data.x, data.y, { target: monsterOf(game, data.targetId), hops: data.hops, drops: data.drops, angles: data.angles, ang: data.ang, who }, o);
  }

  // the other heroes: the ring, the back-piece and the giant round the drawing of them (game.js draws the current
  // client's other heroes, net.js's, with NC.Party.draw; the old client's NC.Online.drawRemote is gone with it)
  function wrapRemote() {
    const P = NC.Party;
    if (!P || typeof P.draw !== 'function' || P.draw.class3) return;
    const base = P.draw;
    P.draw = function (ctx, g, p) {
      const J = p && !p.npc && NC.Online && NC.Online.enabled ? C3.jobOf(p) : null;
      if (!J || !p.pose || p.dead > 0) return base.call(this, ctx, g, p);
      C3.drawHero(ctx, g, p, J, () => base.call(this, ctx, g, p));
    };
    P.draw.class3 = true;
  }

  wrapRemote();
  window.addEventListener('nightcamp:online-snapshot', onSnapshot);
  window.addEventListener('nightcamp:online-event', onEvent);
})();
