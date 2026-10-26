/* telemetry.js — numbers from real play for the balance pass (the Game Bible, pillar 10: "อย่า Balance ด้วยความรู้สึก").
   Counted on this device (until the game has a server to send them to), per day:
     kills     per map and species: how many, the time from the first hit to the fall (TTK), per job
     faints    per map, and what hit last          levels   when each base / job level came (real minutes played)
     drops     gear by kind, moonlit ones           coins    NC.Econ's ledger (economy.js)
     play      minutes played by hand and with the auto farm; skills cast (per skill)
   J → ข้อมูล shows a summary and copies the whole record as JSON (to paste to the team). Saved: nightcamp.telemetry.v1
   (14 days). Hooks: NC.damageEnemy (first hits), NC.skillKills, NC.hurtPlayer, NC.gainXp, NC.lootHeard, NC.castSkill. */
(function () {
  'use strict';
  const NC = window.NC, H = NC.Hub;
  if (!H) return;
  const esc = H.esc, KEY = 'nightcamp.telemetry.v1';
  const G = () => NC.game;
  const day = () => { const d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };
  let T = {};
  try { if (!NC.ONLINE) T = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { T = {}; }
  const D = () => { const k = day(); if (!T[k]) { T[k] = { kills: {}, faints: {}, levels: [], drops: {}, play: { hand: 0, auto: 0 }, skills: {} }; const ks = Object.keys(T).sort(); while (ks.length > 14) delete T[ks.shift()]; } return T[k]; };
  let dirty = false;
  setInterval(() => { if (dirty && !(G() && G().noSave)) { dirty = false; try { localStorage.setItem(KEY, JSON.stringify(T)); } catch (e) { /* blocked */ } } }, 10000);

  const baseDmg = NC.damageEnemy;
  NC.damageEnemy = function (game, e) { if (e && e.hp > 0 && e._firstHit === undefined) e._firstHit = game.time; return baseDmg.apply(this, arguments); };
  NC.skillKills.push((game, e) => {
    if (!e.type || e._heroT == null) return;
    const p = game.player, k = `${game.mapId}|${e.type}|${p.job}`, R = (D().kills[k] = D().kills[k] || [0, 0]);
    R[0]++; R[1] += Math.max(0, game.time - (e._firstHit === undefined ? game.time : e._firstHit)); dirty = true;
  });
  const baseHurt = NC.hurtPlayer;
  NC.hurtPlayer = function (game, dmg, fromX) {
    const p = game.player, was = p.dead > 0;
    const r = baseHurt.apply(this, arguments);
    if (!was && p.dead > 0) { const k = game.mapId; D().faints[k] = (D().faints[k] || 0) + 1; dirty = true; }
    return r;
  };
  const baseGain = NC.gainXp;
  NC.gainXp = function (game) {
    const p = game.player, lv = p.lv, jl = p.jobLv;
    const r = baseGain.apply(this, arguments);
    if (p.lv > lv || p.jobLv > jl) { D().levels.push([p.lv, p.jobLv, p.job, Math.round(performance.now() / 60000)]); dirty = true; }
    return r;
  };
  if (NC.lootHeard) NC.lootHeard.push((game, e, id, c) => { const k = (NC.gearKind ? NC.gearKind(NC.ITEMS[id]) : 'A') + (c && c.sh ? '✦' : ''); D().drops[k] = (D().drops[k] || 0) + 1; dirty = true; });
  const baseCast = NC.castSkill;
  if (baseCast) NC.castSkill = function (game, id) { const r = baseCast.apply(this, arguments); if (r !== false && id) { D().skills[id] = (D().skills[id] || 0) + 1; dirty = true; } return r; };
  setInterval(() => { const g = G(); if (!g || !g.player || g.paused || document.hidden && !(NC.Auto && NC.Auto.on)) return; D().play[NC.Auto && NC.Auto.on ? 'auto' : 'hand'] += 1 / 6; dirty = true; }, 10000);

  function render(el, game) {
    const d = D(), rows = Object.entries(d.kills).sort((a, b) => b[1][0] - a[1][0]).slice(0, 12);
    const L = NC.Econ ? NC.Econ.state.ledger[day()] || { in: {}, out: {} } : { in: {}, out: {} };
    const sum = (o) => Object.values(o).reduce((s, v) => s + v, 0);
    el.innerHTML = `<div class="bb-h">ข้อมูลการเล่น <small>วันนี้ · เก็บในเครื่องนี้</small></div>` +
      `<div class="bb-tiles"><div class="bb-tile"><b>${Math.round(d.play.hand)}</b><span>นาทีที่เล่นเอง</span></div><div class="bb-tile"><b>${Math.round(d.play.auto)}</b><span>นาทีที่บอทเล่น</span></div>` +
      `<div class="bb-tile"><b>${NC.fmtCoins(sum(L.in))}</b><span>เงินเข้าวันนี้</span></div><div class="bb-tile"><b>${NC.fmtCoins(sum(L.out))}</b><span>เงินออกวันนี้</span></div></div>` +
      '<div class="bb-h2">การล่า (แมพ · มอน · อาชีพ)</div><table class="bb-table"><tr><th>แมพ</th><th>มอน</th><th>อาชีพ</th><th class="num">ตัว</th><th class="num">วิ/ตัว</th></tr>' +
      rows.map(([k, [n, t]]) => { const [m, s, j] = k.split('|'); return `<tr><td>${esc((NC.MAPS[m] || {}).name || m)}</td><td>${esc((NC.MONSTERS[s] || {}).name || s)}</td><td>${esc((NC.JOBS[j] || {}).name || j)}</td><td class="num">${n}</td><td class="num">${(t / Math.max(1, n)).toFixed(1)}</td></tr>`; }).join('') + '</table>' +
      `<div class="bb-sub">เงินเข้า: ${Object.entries(L.in).map(([k, v]) => `${esc(k)} ${NC.fmtCoins(v)}`).join(' · ') || '—'}<br>เงินออก: ${Object.entries(L.out).map(([k, v]) => `${esc(k)} ${NC.fmtCoins(v)}`).join(' · ') || '—'}<br>` +
      `หมดแรง: ${Object.entries(d.faints).map(([k, v]) => `${esc((NC.MAPS[k] || {}).name || k)} ${v}`).join(' · ') || '—'} · ของดรอป: ${Object.entries(d.drops).map(([k, v]) => `${esc(k)} ${v}`).join(' · ') || '—'}</div>` +
      '<div class="bb-form"><button class="kw-btn blue" data-copy="1">คัดลอกข้อมูลทั้งหมด (JSON)</button><span id="tm-ok" class="bb-sub"></span></div>';
  }
  H.add({ id: 'data', name: 'ข้อมูล', icon: 'ic_report', order: 95, render,
    click(e) {
      if (!e.target.closest('[data-copy]')) return false;
      const text = JSON.stringify({ telemetry: T, econ: NC.Econ ? NC.Econ.state.ledger : null, game: 'nightcamp', at: new Date().toISOString() });
      const ok = document.getElementById('tm-ok');
      (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(() => { if (ok) ok.textContent = 'คัดลอกแล้ว'; }, () => { if (ok) ok.textContent = 'คัดลอกไม่ได้ในเบราว์เซอร์นี้'; });
      return false;
    } });
  NC.Telemetry = { data: T, today: D };
})();
