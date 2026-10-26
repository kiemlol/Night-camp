/* online/support.js — ?online: what a priest (or any support job) does for the party shows on everyone's screen
   (2026-10-19, the user: "สกิลพระ หรือสกิลซัพพอทไม่มีผลกับ เพื่อนร่วมทีมนะ"). The server always healed, buffed and raised the
   party (backend heals.go healPlayer, team.go blessFriend / guardFriend / reviveFriend, job_priest.go hasteFriend) and
   sent `heal` / `teamBuff` / `revive` events, but no file of the web client read them: the friend saw no +HP, no buff
   icon and no line, so to the players nothing happened. Here:
     heal      '+N' over whoever it healed (me 44 px, a friend 36 px), the green ring and motes; my own skill's heal on
               me is left to its look (the server marks it quiet)
     teamBuff  the buff's look on the friend; on me a line "X ให้ <skill>" and the icon in the buff row:
                 whole   a support job's party buff given whole by the server (patch 008: Blessing's STR INT DEX ...,
                         event field lv / seconds): K.startBuff, as if I had cast it (the sheet and the icon follow)
                 part    the other jobs' (and an older server's) share: bless = my hits x k, haste = my swings x k,
                         teamGuard = what hits me x k; an icon of the skill that gave it, its time from self.buffs
     revive    back on my feet: the toast and the line, the light on whoever got up
   The real players' stand-ins (js/partysupport.js) get their max HP / SP again (presence mh), so NC.allies knows the
   party's HP online: the AUTO support mode (js/autosupport.js) and the support auto farm follow and heal them, a
   resurrection sees who is down, and my own skill's look draws its heal number and rings on them at once — so on my
   screen the server's copy of what I did to a friend is not drawn twice (the friend and the others draw the server's).
   Test: two heroes in one party on the local server (tools/online/duelbot.mjs style), NC.OnlineSupport.log. */
(function () {
  'use strict';
  const NC = window.NC, O = NC.Online, W = NC.OnlineWorld;
  if (!O || !O.enabled || !W) return;
  const FX = NC.FX, V = NC.VFX, K = NC.SkillKit, SK = NC.SKILLS;
  const S = (NC.OnlineSupport = { log: [] });
  const note = (s) => { S.log.push(s); if (S.log.length > 40) S.log.shift(); };
  const GREEN = '150,255,170';
  const num = (v, lo, hi, d) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d);

  // ---------------- the stand-ins: max HP / SP ----------------
  W.presenceHooks.push((pl, pr) => { if (pl.maxHp > 0) pr.mh = [Math.round(pl.maxHp), Math.round(pl.maxSp || pl.maxHp)]; });
  // a friend my own skill's look already drew on (a live stand-in in my friends list)
  const drawnByMe = (ev) => ev.sourceId === me() && ev.targetId !== me() && (NC.allies ? NC.allies(W.game) : []).some((a) => a.proxy && a.peer === ev.targetId);

  // ---------------- who is who ----------------
  const me = () => W.me;
  const heroOf = (id) => {
    const g = W.game;
    if (!g) return null;
    if (id === me()) return g.player;
    return (O.remotes && O.remotes.get(id)) || null;
  };
  const nameOf = (id) => {
    const r = heroOf(id);
    if (r && r.name) return r.name;
    const pl = W.snap && (W.snap.players || []).find((x) => x.id === id);
    return (pl && pl.name) || 'เพื่อน';
  };
  // what isn't mine goes through the others' share (js/otherfx.js), like their skills' looks
  const show = (mine, f) => { if (mine || !NC.OtherFX) f(); else NC.OtherFX.run(f); };

  // ---------------- heal ----------------
  function onHeal(ev) {
    const who = heroOf(ev.targetId), amount = Math.round(num(ev.amount, 0, 1e7, 0));
    if (!who || amount < 1) return;
    const onMe = ev.targetId === me(), byMe = ev.sourceId === me();
    if ((onMe && byMe) || drawnByMe(ev)) { if (byMe && !onMe) note(`→ ${nameOf(ev.targetId)} heal ${amount}`); return; } // (my own skill's look drew it)
    show(onMe || byMe, () => {
      FX.num(who.x, who.y - 150, '+' + amount, { fill: '#8dff8a', size: onMe ? 44 : 36 });
      FX.add({ type: 'vplus', x: who.x, y: who.y, life: 0.9 });
      if (!ev.quiet) { V.ring(who.x, who.y - 6, 20, 120, 8, GREEN, 0.45); V.motes(who.x, who.y - 40, 8, GREEN, { spread: 60, rise: 150 }); }
    });
    if (onMe) note(`← ${nameOf(ev.sourceId)} heal ${amount}`);
    else if (byMe) note(`→ ${nameOf(ev.targetId)} heal ${amount}`);
  }

  // ---------------- team buffs ----------------
  // the share a friend's buff gives me (server buff ids): its icon is the giving skill's
  const PART = { bless: 'ตีแรงขึ้น', haste: 'ตีเร็วขึ้น', teamGuard: 'โดนเบาลง' };
  const parts = {}; // kind -> { skillId, from, k }
  const skillName = (id) => (SK[id] && SK[id].name) || id || 'บัฟ';
  function onTeamBuff(ev) {
    const g = W.game, who = heroOf(ev.targetId);
    if (!g || !who) return;
    const onMe = ev.targetId === me(), byMe = ev.sourceId === me();
    const rgb = typeof ev.rgb === 'string' && ev.rgb ? ev.rgb : '255,240,190';
    if (!drawnByMe(ev)) show(onMe || byMe, () => { if (K && K.buffFx) K.buffFx(g, who, rgb, { r: onMe ? 140 : 110 }); });
    const id = typeof ev.skillId === 'string' ? ev.skillId : '', from = nameOf(ev.sourceId);
    if (byMe && !onMe) note(`→ ${nameOf(ev.targetId)} ${ev.kind || id}`);
    if (!onMe) return;
    const p = g.player;
    if (ev.whole && SK[id] && SK[id].buff) {
      const lv = Math.round(num(ev.lv, 1, 30, 1)), dur = num(ev.seconds, 1, 900, 30);
      K.startBuff(g, p, id, lv, dur);
      NC.HUD.log(`${from} ให้ ${skillName(id)} Lv ${lv} (${Math.round(dur)} วิ)`, 'item');
      note(`← ${from} buff ${id} ${lv}`);
      return;
    }
    if (PART[ev.kind]) {
      parts[ev.kind] = { skillId: id, from, said: false }; // (its line waits for the snapshot with its new time)
      note(`← ${from} ${ev.kind} (${id})`);
    } else if (id) NC.HUD.log(`${from} ให้ ${skillName(id)}`, 'item');
  }
  // the shares' time: the server's (self.buffs), counted down between snapshots
  const left = {}; // kind -> seconds
  W.selfHooks.push((s) => {
    const B = (s && s.buffs) || {};
    for (const k in PART) {
      left[k] = num(B[k], 0, 3600, 0);
      const P = parts[k];
      if (P && !P.said) { P.said = true; NC.HUD.log(`${P.from} ให้ ${skillName(P.skillId)} · ${PART[k]}${left[k] > 1 ? ` (${Math.round(left[k])} วิ)` : ''}`, 'item'); }
      if (!(left[k] > 0)) delete parts[k];
    }
  });
  const baseUpdate = NC.updateSkills;
  NC.updateSkills = function (game, dt) {
    const r = baseUpdate.apply(this, arguments);
    if (game === W.game) for (const k in left) if (left[k] > 0) left[k] = Math.max(0, left[k] - dt);
    return r;
  };
  const iconSrc = (icon) => (NC.ASSET_MANIFEST[icon] || {}).src || '';
  const baseBuffs = NC.HUD.renderBuffs;
  NC.HUD.renderBuffs = function (p) {
    baseBuffs.apply(this, arguments);
    const box = document.getElementById('buffs');
    if (!box || !W.game || p !== W.game.player) return;
    for (const k in PART) {
      const t = left[k] || 0, P = parts[k], key = 'team_' + k;
      let d = box.querySelector(`[data-k="${key}"]`);
      if (!(t > 0) || !P) { if (d) d.remove(); continue; }
      const icon = (SK[P.skillId] && SK[P.skillId].icon) || 'sk_blessing';
      if (!d || d.dataset.icon !== icon) {
        if (d) d.remove();
        d = document.createElement('div');
        d.className = 'buff'; d.dataset.k = key; d.dataset.icon = icon;
        d.title = `${skillName(P.skillId)} จาก ${P.from} · ${PART[k]}`;
        d.innerHTML = `<img src="${iconSrc(icon)}" alt=""><b></b>`;
        box.appendChild(d);
      }
      d.querySelector('b').textContent = t >= 1 ? Math.ceil(t) : t.toFixed(1);
      d.classList.toggle('ending', t < 1.5);
    }
  };

  // ---------------- revive ----------------
  function onRevive(ev) {
    const g = W.game, who = heroOf(ev.targetId);
    if (!g || !who) return;
    const onMe = ev.targetId === me(), byMe = ev.sourceId === me();
    if (!byMe || onMe) show(onMe, () => { // (my own resurrection's look drew it)
      FX.ring(who.x, who.y - 10, 20, 170, '255,230,150', 0.7, 10);
      FX.stars(who.x, who.y - 70, 14, '255,236,160', { speed: 220 });
    });
    if (onMe) {
      const from = nameOf(ev.sourceId);
      g.toast(`${from} ชุบชีวิตให้แล้ว!`);
      NC.HUD.log(`${from} ชุบชีวิตคุณ`, 'item');
      note(`← ${from} revive`);
    } else if (byMe) note(`→ ${nameOf(ev.targetId)} revive`);
  }

  O.on('event', (ev) => {
    if (!ev || !W.game || !W.ready) return;
    try {
      if (ev.type === 'heal') onHeal(ev);
      else if (ev.type === 'teamBuff') onTeamBuff(ev);
      else if (ev.type === 'revive') onRevive(ev);
    } catch (e) { console.warn('online support', ev.type, e); }
  });
})();
