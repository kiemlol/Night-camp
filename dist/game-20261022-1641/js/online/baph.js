/* online/baph.js — the world boss บาโฟเม็ด online (?online): the server spawns him (16:00 / 21:00, its maps), walks him,
   picks his moves and lands them (backend baphomet*.go, boss_ai.go); the web's own baphomet.js plays him: the painted
   telegraphs, the scythe, the bolts and shards, the quake, the roots, the change to form 2 and the end.
     each move   the monster's boss.c {mv, at (server tick, 20 a second), wu (wind-up), a [areas: x y r | ang len w, t]}:
                 a new cast sets baphomet.js's own state for that move (e.state, e.t, e.wind, the spots / lane / zone)
                 and draws its warnings; baphomet.js's update then plays it (its hits on the hero are the server's)
     the rest    roar = wake, change = the roots take him (the server turns the same id into form 2), boss.rage = enraged;
                 the events baph (up / change / rise / down / gone) and worldBossNotice are said in the log and chat
     the page    NC.WorldBossRows (season.js's world boss tab) lists the server's times: self.season.baph, self.season.wb
   The local schedule, spawn, kids and rewards stay off (NC.Baph.server). Load after online/world.js. */
(function () {
  'use strict';
  const NC = window.NC, O = NC.Online, W = NC.OnlineWorld, B = NC.Baph;
  if (!O || !O.enabled || !W || !B || !B.update) return;
  B.server = true;
  const G = () => NC.game;
  const say = (t, kind) => { if (!t) return; NC.HUD.log(t, kind || 'level'); if (NC.Chat) NC.Chat.add({ ch: 'sys', kind: 'level', text: '🔔 ' + t }); };
  let last = null; // (the last mirror seen: its place for the end and the smoke)

  // every frame: the plain slide to the server's place, then baphomet.js's own frame (its clock stays its own)
  for (const type of Object.keys(B.FORM)) {
    W.mirrorFrames[type] = (g, e, dt, slide) => {
      const t0 = e.t, a0 = e.anim;
      slide(e, dt);
      e.t = t0; e.anim = a0;
      B.update(g, e, dt);
      last = e;
    };
  }
  // the server's state of him, each snapshot
  W.monsterHooks.push((e, m, game) => {
    if (!B.FORM[e.type]) return;
    const b = m.boss || {}, ss = m.state || '';
    if (b.rage != null) e.raged = !!b.rage;
    if (ss === 'roar' && !e._roared) { e._roared = true; e.awake = false; B.wake(game, e); }
    else if (b.awake) e.awake = true;
    if (ss === 'change' && !e.changing) B.beginChange(game, e);
    if (/_windup$/.test(e.state)) e.state = e.state.replace(/_windup$/, '');
    if (ss === 'recover' && e.rec == null) e.rec = 0.6;
    const c = b.c;
    if (c && c.at !== e._castAt) { e._castAt = c.at; cast(game, e, c); }
    else if (c && ss !== e._ss && (ss === c.mv || ss === c.mv + '_windup')) { e.state = c.mv; e.t = Math.max(0, (((W.snap && W.snap.tick) || c.at) - c.at) / 20); } // (world.js restarts e.t on a new server state: the move's clock runs from its cast)
    e._ss = ss;
  });
  function cast(game, e, c) {
    const mv = c.mv, a = c.a || [], tick = (W.snap && W.snap.tick) || c.at;
    e.state = mv; e.done = false; e.n = 0;
    e.wind = typeof c.wu === 'number' ? c.wu : 0.8;
    e.t = Math.max(0, (tick - c.at) / 20);
    const left = (t) => Math.max(0.1, t - e.t + 0.1);
    const a0 = a[0];
    if (mv === 'sweep' && a0) {
      e.ax = a0.x; e.ay = a0.y; e.ang = Math.atan2(a0.y - e.y, a0.x - e.x);
      B.warnAt(e, e.ax, e.ay, a0.r || 330, left(e.wind));
    } else if (mv === 'bolts' || mv === 'shards') {
      e.wind = 0.15;
      e.spots = a.map((s) => ({ x: s.x, y: s.y, at: mv === 'shards' ? Math.max(0, (s.t || 0) - 0.3) : s.t || 0, done: false }));
      for (const s of e.spots) B.warnAt(e, s.x, s.y, 120, left(s.at));
    } else if (mv === 'quake' || mv === 'spin') {
      B.warnAt(e, e.x, e.y, (a0 && a0.r) || (mv === 'quake' ? 380 : 400), left(e.wind));
    } else if ((mv === 'spikes' || mv === 'whip') && a0) {
      e.lx = a0.x; e.ly = a0.y; e.ang = a0.ang || 0; e.len = a0.len || (mv === 'spikes' ? 720 : 640); e.lw = a0.w || (mv === 'spikes' ? 170 : 150);
      B.warnLane(e, e.lx, e.ly, e.ang, e.len, e.lw, left(e.wind));
    }
    if (a0 && mv !== 'quake' && mv !== 'spin') e.face = (a0.x - e.x) >= 0 ? 1 : -1;
  }

  // ---------------- the events ----------------
  W.eventHooks.push((ev) => {
    if (!ev) return;
    const g = G();
    if (ev.type === 'worldBossNotice') say(ev.text || 'บอสโลกกำลังจะตื่น');
    else if (ev.type === 'baph') {
      if (ev.kind === 'up' || ev.kind === 'rise') say(ev.text || 'บอสโลก บาโฟเม็ด ปรากฏแล้ว!');
      else if (ev.kind === 'change') { if (ev.text) NC.HUD.log(ev.text, 'level'); }
      else if (ev.kind === 'down') { if (g && last) B.ending(g, last); say(ev.text || 'ล้มบอสโลก บาโฟเม็ด สำเร็จ!'); }
      else if (ev.kind === 'gone') { if (last) B.smoke(last.x, last.y, 520); say(ev.text || 'บาโฟเม็ดกลับเข้าความมืดไปแล้ว', 'warn'); }
    }
  });

  // ---------------- the world boss page: the server's times ----------------
  const hhmm = (ms) => { const d = new Date(ms); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
  NC.WorldBossRows = (game, esc) => {
    const s = W.snap && W.snap.self, se = (s && s.season) || {}, list = se.baph || [], done = se.wb || {}, now = Date.now();
    if (!list.length) return '';
    return list.map((r) => {
      const on = now >= r.at && now < r.until, got = !!done[r.key];
      const name = NC.areaLabel ? NC.areaLabel(r.mapId) : (NC.MAPS[r.mapId] || {}).name;
      return `<div class="bb-row ${on ? 'on' : got ? 'done' : ''}"><img src="${NC.Hub ? NC.Hub.icon('ic_rank') : ''}" alt=""><div class="t">` +
        `<b>${hhmm(r.at)} · บาโฟเม็ด (สองร่าง)</b><small>${esc(name || r.mapId || '')}${got ? ' · ล้มแล้ว ✔' : on ? ' · ตื่นอยู่!' : r.soon ? ' · ใกล้ตื่นแล้ว' : ''}</small></div>` +
        (on && game.mapId !== r.mapId && NC.Econ ? `<button class="kw-btn gold" data-go="${esc(r.mapId)}">ไปที่นั่น</button>` : '') + '</div>';
    }).join('');
  };
})();
