/* online/quests.js — the story quests, the daily board and the week's chest online (?online). The server keeps them
   (backend quests*.go: self.quests in every record, the action {action:'quest', op, id, choice}, 102 events of type
   'quest'); the web's own quest code (js/quests.js) still draws the J page, the tracker and the story panels, from the
   server's record written into NC.Quests.state:
     main   index / id / state (offer · active · ready · done · waiting) / objectives[k].have / keys
     daily  list of { id 'yyyymmdd:i', kind, target, have, need, claimed } · week { days, claimed, need }
     rep, tokens, flags; the calendar is off online (the server's check-in replaces it)
   Taking and handing in (the J page's buttons, the story NPCs' talk: js/storynpc.js calls NC.Quests.take / handIn) go
   to the server through quests.js's NC.Quests.online hook; the server checks the reach to the NPC and the level, counts
   the kills and finds itself, and answers with the story panels (op taken / done) shown by quests.js's own panel.
   Load after online/world.js. */
(function () {
  'use strict';
  const NC = window.NC, O = NC.Online, W = NC.OnlineWorld;
  if (!O || !O.enabled || !W || !NC.Quests) return;
  const Qs = NC.Quests, Q = Qs.data || [];
  const st = Qs.state;
  let view = null, pendingChoice = null;
  const dayKey = (d) => { d = d || new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };

  // the server's record -> quests.js's state (the J page, the tracker and the NPCs' ! ? read it)
  function apply(v) {
    view = v;
    const m = v.main || {};
    let i = Q.findIndex((q) => q.id === m.id);
    if (i < 0) i = typeof m.index === 'number' ? m.index : st.i;
    if (m.state === 'done' && !m.id) i = Q.length;
    st.i = i;
    st.on = m.state === 'active' || m.state === 'ready';
    st.prog = {};
    (m.objectives || []).forEach((o, k) => { st.prog[k] = o.have || 0; });
    st.keys = Array.isArray(m.keys) ? m.keys.slice() : [];
    st.rep = Object.assign({}, v.rep || {});
    st.tokens = v.tokens || 0;
    st.flags = Object.assign({}, v.flags || {});
    // the dailies: by the server's day; today's local key always exists so quests.js never rolls its own
    st.daily = {};
    for (const d of (v.daily && v.daily.list) || []) {
      const dk = d.day || (v.daily && v.daily.day) || dayKey();
      (st.daily[dk] = st.daily[dk] || []).push({
        kind: d.kind === 'hunt' ? 'hunt' : d.kind === 'sun' ? 'sun' : 'deliver', sp: d.target, id: d.target,
        need: d.need, n: d.have, done: !!d.claimed, sid: d.id, label: d.label,
      });
    }
    if (!st.daily[dayKey()]) st.daily[dayKey()] = [];
    // the week's chest (quests.js counts the days of this week's dailies)
    const wk = Math.floor((Date.now() / 86400000 + 3) / 7), w = (v.daily && v.daily.week) || {};
    st.week = { [wk]: Array.from({ length: w.days || 0 }, (_, k) => 'd' + k) };
    if (w.claimed) st.week['got' + wk] = 1;
    // the calendar moved to the server's check-in: the local one never opens a box
    st.cal = { days: [dayKey()], got: 999 };
    try { if (Qs.tracker) Qs.tracker(); } catch (e) { /* the tracker comes with the HUD */ }
  }
  W.selfHooks.push((s) => { if (s.quests && s.quests !== view) apply(s.quests); });

  // quests.js asks before it does anything itself
  const send = (o) => W.send(Object.assign({ action: 'quest' }, o));
  Qs.online = function (op, game, a, b) {
    if (op === 'calendar') return true; // never pay the offline calendar while connecting to the server
    if (!W.ready) return false;
    const m = (view && view.main) || {};
    if (op === 'take') { send({ op: 'take', id: m.id || '' }); return true; }
    if (op === 'handin') { send({ op: 'handin', id: m.id || '' }); return true; }
    if (op === 'daily') { const d = (st.daily[a] || [])[b]; if (d && d.sid) send({ op: 'daily_claim', id: d.sid }); return true; }
    if (op === 'week') { send({ op: 'week_claim' }); return true; }
    return false;
  };

  // the server's answers: the story panels, the rewards, the progress news
  const fmt = (n) => (NC.fmtCoins ? NC.fmtCoins(n) : String(n));
  const name = (id) => { const q = Q.find((x) => x.id === id); return (q && q.title) || id || ''; };
  W.eventHooks.push((ev) => {
    if (!ev || ev.type !== 'quest') return;
    const log = (t, k) => NC.HUD && NC.HUD.log(t, k || 'level');
    switch (ev.op) {
      case 'taken':
        log(`รับเควส: ${ev.title || name(ev.id)}`);
        if (Array.isArray(ev.panels) && ev.panels.length) Qs.panel(ev.panels, ev.title || name(ev.id));
        break;
      case 'done': {
        const r = ev.reward || {};
        log(`ส่งเควส ${ev.title || name(ev.id)}${r.coins ? ` · ได้ ${fmt(r.coins)} เหรียญ` : ''}`);
        const g = W.game, p = g && g.player;
        if (p && NC.FX) NC.FX.stars(p.x, p.y - 90, 18, '255,220,120', { speed: 280 });
        const ch = ev.choice || null;
        pendingChoice = ch ? { id: ch.id || ev.id, key: ch.key } : null;
        if (Array.isArray(ev.panels) && ev.panels.length) Qs.panel(ev.panels, ev.title || name(ev.id), ch ? { key: ch.key, a: ch.a || (ch.options && ch.options[0] && ch.options[0].text), b: ch.b || (ch.options && ch.options[1] && ch.options[1].text) } : null);
        else if (ch) send({ op: 'choose', id: pendingChoice.id, choice: 'a' });
        break;
      }
      case 'claimed': { const r = ev.reward || {}; log(`รับรางวัล${ev.id === 'week' ? 'หีบประจำสัปดาห์' : 'รายวัน'}${r.coins ? ` · ${fmt(r.coins)} เหรียญ` : ''}${r.tokens ? ` · ตราฤดูกาล +${r.tokens}` : ''}`); break; }
      case 'progress': if (ev.have != null && ev.need) { const g = W.game, p = g && g.player; if (p && NC.FX) NC.FX.num(p.x, p.y - 180, `${ev.have}/${ev.need}`, { fill: '#ffe7a6', size: 26 }); } break;
      case 'ready': log(`เควส ${name(ev.id)} พร้อมส่งแล้ว`); break;
      case 'key': log(`ได้ของเควส: ${(NC.ITEMS[ev.itemId] || NC.MATERIALS && NC.MATERIALS[ev.itemId] || {}).name || ev.itemId}`); break;
      case 'daily_done': log('ภารกิจรายวันเสร็จแล้ว รับรางวัลได้ที่หน้าเควส (J)'); break;
      case 'rank': log(`ชื่อเสียงกับ${ev.name || ev.id} ขึ้นเป็นขั้น ${ev.rank}!`); break;
      default: break;
    }
  });
  // the story's choice (the panel's last two buttons): quests.js keeps the flag; the server hears it too
  document.addEventListener('click', (e) => {
    const b = e.target && e.target.closest && e.target.closest('.sp-pop [data-c="a"], .sp-pop [data-c="b"]');
    if (!b || !pendingChoice) return;
    send({ op: 'choose', id: pendingChoice.id, choice: b.dataset.c });
    pendingChoice = null;
  }, true);
})();
