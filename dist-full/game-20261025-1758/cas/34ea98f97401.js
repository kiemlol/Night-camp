/* The web online client's side of the bishop (js/class2_skills_c.js:84-110 and 130, js/skills_v21.js:622-625,
   js/priest_skills.js:104, backend/job_bishop.go): the server runs the barrier and sends what it still
   soaks as the hero's biKyrie meter. Offline RUN.bi_barrier starts the golden dome (FX vkyrie) on a bishop for the
   buff's length; online a presented cast no longer starts one (game.presentationOnly), so this draws it from the
   meter, for the local hero only (never round a presentation cast's hero). Each hit the barrier soaks comes as a
   `bishop` event (kind 'soak'): its sparks, the dome's pulse and, when it broke, the ring and the words (:103-107).
   The offline skill ticks draw two more lasting looks the online client never runs, here from the hero's buffs: the
   battle hymn's notes at Lv10 (hymnAura) and the motes of the miracle's blessing (the server's bi_miracle buff, the
   web's p.buffs.bless).
   Apart from js/online.js so the FX replay sources stay untouched (scripts/export-unity-fx-replay.mjs). */
(function () {
  const NC = window.NC;
  const GOLD = '255,210,90', WORDS_FILL = '#ffe28a'; // js/class2_skills_c.js:18 GOLD, :107
  const DOME_LIFE = 20; // :91 the buff's length, when the record has no time left for it
  const HYMN_LV = 10, HYMN_CHANCE = 0.08, NOTE_FILL = '#ffe28a'; // js/skills_v21.js:622-625 (a chance each frame)
  const SKY = '160,215,255', BLESS_RATE = 6; // js/priest_skills.js:11, 104 (dt x 6 a frame)
  let dome = null, kyrie = 0, hymn = false, blessed = false, aura = null;

  function selfId(game) { return game.player?.id || NC.Online?.getState?.().playerId; }
  function actorOf(game, id) {
    if (id === selfId(game)) return game.player;
    return NC.Online?.remotes?.get(id) || null;
  }
  function endDome() { if (dome) dome.dead = true; dome = null; }

  // the dome lasts while the meter does; a new cast (the meter grows) starts it again for the buff's time left
  function syncDome(p, self) {
    const next = Number(self.meters?.biKyrie) || 0;
    if (!next) { endDome(); kyrie = 0; return; }
    const lost = !dome || dome.dead || !NC.FX.list.includes(dome); // (a new map empties the FX list)
    if (next > kyrie || lost) {
      endDome();
      const life = Number(self.buffs?.bi_barrier) || DOME_LIFE;
      dome = NC.FX.add({ type: 'vkyrie', follow: p, x: p.x, y: p.y, life });
    }
    kyrie = next;
  }

  function auraTick(q, dt) {
    const game = NC.game, p = game && game.player, rand = NC.rand;
    if (!p || game.presentationOnly) return;
    if (hymn && Math.random() < HYMN_CHANCE) NC.FX.add({ type: 'text', x: p.x + rand(-60, 60), y: p.y - rand(60, 150), vx: 0, vy: -50, life: 1.2, text: Math.random() < 0.5 ? '♪' : '♫', fill: NOTE_FILL, size: 30 });
    if (blessed && Math.random() < dt * BLESS_RATE) NC.VFX.motes(p.x + rand(-24, 24), p.y - rand(20, 110), 1, SKY, { rise: 60, spread: 4, size: 0.8 });
  }
  function syncAura(self) {
    hymn = Number(self.buffs?.bi_battlehymn) > 0 && Number(self.skills?.bi_battlehymn) >= HYMN_LV;
    blessed = Number(self.buffs?.bi_miracle) > 0;
    if ((!hymn && !blessed) || (aura && NC.FX.list.includes(aura))) return;
    aura = NC.FX.add({ type: 'timer', layer: 'none', life: 1e9, x: 0, y: 0, update: auraTick });
  }

  function onSnapshot(event) {
    const self = event.detail?.snapshot?.self, game = NC.game, p = game?.player;
    if (!self || !p || game.presentationOnly || !(NC.Online?.active || NC.Online?.enabled)) return;
    syncDome(p, self);
    syncAura(self);
  }

  function onEvent(event) {
    const data = event.detail, game = NC.game, V = NC.VFX;
    if (!data || data.type !== 'bishop' || data.kind !== 'soak' || !game) return;
    const who = actorOf(game, data.actorId), self = who === game.player;
    const x = who ? who.x : data.x, y = who ? who.y : data.y;
    if (self && dome) dome.hitT = dome.t;
    V.sparks(x, y - 80, 6, GOLD, { size: 0.7 });
    if (!data.broke) return;
    if (self) endDome();
    V.ring(x, y - 20, 40, 170, 8, GOLD, 0.4);
    NC.FX.num(x, y - 190, 'บาเรียแตก', { fill: WORDS_FILL, size: 28 });
  }

  window.addEventListener('nightcamp:online-snapshot', onSnapshot);
  window.addEventListener('nightcamp:online-event', onEvent);
})();
