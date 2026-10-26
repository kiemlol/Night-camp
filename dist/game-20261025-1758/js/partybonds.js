/* partybonds.js — what a party gets for playing together (the user, 2026-10-18: "ระบบเเชร์ปารตี้ยังไม่โอเค อยากให้ตี้ได้อะไร
   มากกว่า มีเสนอไหม เเบบ เพิ่ม exp ไรงี้", then "ทำข้อ 1–4 เลย: EXP ตี้ใหม่ ดรอปตี้ ด้ายเชิด และฉุดเพื่อนขึ้น").
   Measured first on the local Go server (tools/online/farmbot.mjs, knights Lv 25 in graveyard): a party that keeps together
   kills 1.44x (two) / 1.79x (four) what one hero kills alone, so the old even share (+20% a hero, then split) paid each
   member 0.91x / 0.75x of farming alone: a party was a loss. Now:
     ด้ายเชิด      each living party member on my map within R.thread.reach is a red thread between us (3 at most; the
                   hero is a puppet: the party is bound by red strings): a thread is +5% damage on monsters and +25% HP /
                   SP regen
     EXP ตี้        a shared kill's pot +70% for each other sharer of the party within the reach of the one it pays (the
                   kill's threads: online only heroes who fought it count, so a friend parked beside the farmer adds
                   nothing) and +10% when the sharers cover 3 job lines (knight / mage / archer / rogue / priest ... with
                   their later jobs)
     ดรอปตี้        the kill's drop chances x (1 + 70% for each of the finder's kill threads)
   (farmbot, 150 s runs: +55% / +50% a thread gave two 1.18x EXP and 1.10x materials, four 1.34x EXP but 0.91x materials
   of farming alone; +70% / +70% is the number kept: see README for its run)
     ฉุดเพื่อนขึ้น   hold T (or the button) 3 s beside a fallen party member (within 150): they stand with 20% HP; then 3
                   minutes before my next pull. A fallen hero with a living member within 1200 waits 10 s (the support
                   job's wait) so the pull can come.
   NC.PARTY_RULES holds the numbers: tools/online/world_export.mjs sends them to the Go server (world.json partyExp, read
   by tools/online/patches/005_party_bonds.patch party_bonds.go). Online the server decides everything and this file only
   draws: the threads, the chip under the party list, the pull prompt and its bar (party action pull / pullStop, event
   partyPull). Offline (net.js room, ?netmock) the rules run here: partynet.js asks PN.extraK for the EXP, loot.js and
   materials.js NC.dropChanceK for the drop chances, partysupport.js's stand-ins carry the pull (its 'r'), the faint
   waits here.
   Art: assets/partybonds/ (assets/gen/make_partybonds_prompts.py -> tools/partybonds_cut.py). ?nothreads hides the
   threads (the rules stay). README "ปาร์ตี้: ด้ายเชิด EXP ดรอป ฉุดเพื่อน". */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX;
  if (NC.ASSET_MANIFEST_PARTYBONDS && NC.ASSET_MANIFEST) Object.assign(NC.ASSET_MANIFEST, NC.ASSET_MANIFEST_PARTYBONDS);
  const R = (NC.PARTY_RULES = {
    bonus: 0.2, mixBonus: 0.1, mixLines: 3,
    thread: { reach: 600, dmg: 0.05, regen: 0.25, max: 3, exp: 0.7, drop: 0.7 },
    pull: { reach: 150, hold: 3, hp: 0.2, cooldown: 180, near: 1200 },
  });
  const CHEST = 70; // (the hero is ~130 tall: the thread ties at the chest)
  const G = () => NC.game;
  const PN = () => NC.PartyNet;
  const online = () => !!(NC.Online && NC.Online.enabled);
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const inParty = () => { const P = PN(); return !!(P && P.inParty && P.inParty()); };
  // my party's members on my map, as net.js remotes (offline partynet / online social.js answer the same way)
  const mates = () => { const P = PN(); return P && P.inParty && P.inParty() ? P.onMap().filter((r) => r && r.named !== false) : []; };
  const alive = (r) => r && !r.dd;

  // ---------------- the job lines (the job mix) ----------------
  function lineOf(job) {
    for (let i = 0, j = job; i < 4 && j; i++) {
      const J = NC.JOBS[j];
      if (!J || !(J.tier >= 1)) return '';
      if (J.tier === 1 || !J.from) return j;
      j = J.from;
    }
    return '';
  }
  NC.jobRoot = lineOf;

  // ---------------- the threads ----------------
  // who is tied to whom right now: me and my party's living members on this map, pairs within the reach
  function people(game) {
    const p = game.player, out = [];
    if (p && !(p.dead > 0)) out.push({ id: 'me', x: p.x, y: p.y, me: true });
    for (const r of mates()) if (alive(r) && r.map === game.mapId && (r.pose || online())) out.push({ id: r.peer, x: r.x, y: r.y, r });
    return out;
  }
  // my threads: the living members within the reach of me (3 at most)
  let myN = 0, myAt = -1;
  function threadsNow(game) {
    if (!game || !game.player) return 0;
    if (game.time === myAt) return myN;
    myAt = game.time;
    const p = game.player;
    if (p.dead > 0 || !inParty()) return (myN = 0);
    let n = 0;
    for (const r of mates()) if (alive(r) && r.map === game.mapId && NC.dist(r.x, r.y, p.x, p.y) <= R.thread.reach) n++;
    return (myN = Math.min(R.thread.max, n));
  }
  NC.PartyBonds = { R, threads: threadsNow, lineOf };

  // ---------------- offline rules (online: the server's party_bonds.go) ----------------
  // EXP: partynet.js's even share asks PN.extraK(who, mates) for the extra pot of one sharer: who = null (me) or a remote
  function hookExp() {
    const P = PN();
    if (!P || P._bondsExp) return;
    P._bondsExp = true;
    P.extraK = function (who, list) {
      const game = G();
      if (!game || !game.player || online()) return 0;
      const all = [{ x: game.player.x, y: game.player.y, job: game.player.job, me: true }].concat(list.map((r) => ({ x: r.x, y: r.y, job: r.job, r })));
      const self = who ? all.find((a) => a.r === who) : all[0];
      if (!self) return 0;
      let n = 0;
      for (const a of all) if (a !== self && NC.dist(a.x, a.y, self.x, self.y) <= R.thread.reach) n++;
      const lines = new Set(all.map((a) => lineOf(a.job)).filter(Boolean));
      return R.thread.exp * Math.min(R.thread.max, n) + (lines.size >= R.mixLines ? R.mixBonus : 0);
    };
  }
  hookExp();
  // drops: the chances of my kill's gear (loot.js) and materials (materials.js) x (1 + drop a thread)
  NC.dropChanceK = function (game) {
    if (online() || !game || !inParty()) return 1;
    return 1 + R.thread.drop * threadsNow(game);
  };
  // damage on monsters (NC.heroHit for my own derived stats), regen
  const baseHeroHit = NC.heroHit;
  if (baseHeroHit) NC.heroHit = function (d, e, o) {
    const r = baseHeroHit.apply(this, arguments), g = G();
    if (r && r.dmg > 0 && g && g.player && d === g.player.d && !online()) {
      const n = threadsNow(g);
      if (n > 0 && e && !e.duel && !e.remote) r.dmg = Math.max(1, Math.round(r.dmg * (1 + R.thread.dmg * n)));
    }
    return r;
  };
  const baseUpd = NC.updatePlayer;
  NC.updatePlayer = function (game, dt) {
    const r = baseUpd.apply(this, arguments);
    const p = game && game.player;
    if (p && p.d && !(p.dead > 0) && !online()) {
      const n = threadsNow(game);
      if (n > 0) {
        const k = (p.combat > 0.5 ? 0.5 : 1) * R.thread.regen * n * (dt || 0);
        p.hp = Math.min(p.maxHp, p.hp + p.d.hpRegen * k);
        p.sp = Math.min(p.maxSp, p.sp + p.d.spRegen * k);
      }
    }
    pullTick(game, dt || 0);
    return r;
  };

  // ---------------- drawing the threads (FX's 'low' layer: behind the characters; a faint glow after the light) ----------------
  const since = new Map(); // pair key -> game time it was tied (a new thread grows in)
  function bez(ax, ay, cx, cy, bx, by, t) { const u = 1 - t; return [u * u * ax + 2 * u * t * cx + t * t * bx, u * u * ay + 2 * u * t * cy + t * t * by]; }
  function drawThread(ctx, a, b, alpha, grow, t, seed, glow) {
    const S = NC.SPR.pb_thread;
    if (!S || !S.img) return;
    const img = S.img, iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    if (!iw || !ih) return;
    const ax = a.x, ay = a.y - CHEST, bx = b.x, by = b.y - CHEST, L = Math.hypot(bx - ax, by - ay);
    if (L < 40) return;
    // it hangs a little and sways (slack grows as it is first tied)
    const sag = Math.min(80, 16 + L * 0.1) * (1 + 0.18 * Math.sin(t * 1.6 + seed)) * (0.4 + 0.6 * grow);
    const cx = (ax + bx) / 2 + Math.sin(t * 1.1 + seed * 2) * 8, cy = (ay + by) / 2 + sag;
    const N = Math.max(8, Math.min(24, Math.round(L / 34))), TH = glow ? 13 : 8;
    // grows from both ends to the middle while it is tied
    const g0 = 0.5 - grow / 2, g1 = 0.5 + grow / 2;
    ctx.save();
    ctx.globalAlpha = alpha * (glow ? 0.3 : 1);
    if (glow) ctx.globalCompositeOperation = 'lighter';
    let [px, py] = bez(ax, ay, cx, cy, bx, by, 0);
    for (let i = 1; i <= N; i++) {
      const u0 = (i - 1) / N, u1 = i / N;
      const [nx, ny] = bez(ax, ay, cx, cy, bx, by, u1);
      if (!(u1 <= g0 || u0 >= g1) || grow >= 1) {
        const ang = Math.atan2(ny - py, nx - px), len = Math.hypot(nx - px, ny - py) + 0.8;
        ctx.save();
        ctx.translate(px, py); ctx.rotate(ang);
        ctx.drawImage(img, (u0 * iw) | 0, 0, Math.max(1, (iw / N) | 0), ih, 0, -TH / 2, len, TH);
        ctx.restore();
      }
      px = nx; py = ny;
    }
    if (!glow && grow >= 1) {
      const K = NC.SPR.pb_knot;
      if (K && K.img) {
        // (the knot in the middle, along the thread: a quadratic curve's slope at its middle is end minus start)
        const [mx, my] = bez(ax, ay, cx, cy, bx, by, 0.5), s = 30, h = (s * K.h) / K.w;
        let ang = Math.atan2(by - ay, bx - ax);
        if (ang > Math.PI / 2) ang -= Math.PI; else if (ang < -Math.PI / 2) ang += Math.PI;
        ctx.save(); ctx.translate(mx, my); ctx.rotate(ang); ctx.drawImage(K.img, -s / 2, -h / 2, s, h); ctx.restore();
      }
    }
    ctx.restore();
  }
  function drawThreads(ctx, layer) {
    const game = G();
    if (!game || !game.player || !inParty()) return;
    const P = people(game), t = game.time, seen = new Set();
    for (let i = 0; i < P.length; i++)
      for (let j = i + 1; j < P.length; j++) {
        const a = P[i], b = P[j], d = NC.dist(a.x, a.y, b.x, b.y);
        if (d > R.thread.reach) continue;
        const key = a.id < b.id ? a.id + '|' + b.id : b.id + '|' + a.id;
        seen.add(key);
        if (!since.has(key)) since.set(key, t);
        const grow = Math.min(1, (t - since.get(key)) / 0.35);
        const fade = d > R.thread.reach * 0.85 ? 1 - (d - R.thread.reach * 0.85) / (R.thread.reach * 0.15) : 1;
        let seed = 0;
        for (const c of key) seed = (seed * 31 + c.charCodeAt(0)) % 997;
        drawThread(ctx, a, b, Math.max(0, fade) * 0.95, grow, t, seed / 97, layer === 'glow');
      }
    if (layer === 'low') for (const k of [...since.keys()]) if (!seen.has(k)) since.delete(k);
    if (layer === 'glow') drawPullPrompt(ctx, game);
  }
  const baseDraw = FX.draw;
  FX.draw = function (ctx, layer) {
    const r = baseDraw.apply(this, arguments);
    if (layer === 'low' || layer === 'glow') { try { drawThreads(ctx, layer); } catch (e) { console.warn('partybonds: draw', e); } }
    return r;
  };

  // ---------------- the chip under the party list: ด้ายเชิด ×n ----------------
  let chip = null, chipKey = '';
  function chipTick() {
    const game = G();
    if (!chip) {
      const hud = $('hud');
      if (!hud) return;
      chip = document.createElement('div');
      chip.id = 'pbchip'; chip.className = 'pb-chip'; chip.hidden = true;
      hud.appendChild(chip);
    }
    const n = game && inParty() ? (online() ? onlineThreads(game) : threadsNow(game)) : 0;
    const box = [...document.querySelectorAll('.partybox')].find((b) => !b.hidden && b.children.length);
    if (!box || !inParty()) { chip.hidden = true; return; }
    const ic = NC.SPR.pb_ic_threads;
    const key = n + '|' + !!ic;
    if (key !== chipKey) {
      chipKey = key;
      const dmg = Math.round(R.thread.dmg * 100 * n), reg = Math.round(R.thread.regen * 100 * n), xp = Math.round(R.thread.exp * 100 * n);
      chip.innerHTML = (ic ? `<img src="${esc(ic.img.src)}" alt="">` : '') +
        `<b>ด้ายเชิด ×${n}</b><small>${n ? `ดาเมจ +${dmg}% · ฟื้น +${reg}% · EXP/ดรอป +${xp}%` : 'ยืนใกล้เพื่อนในตี้เพื่อผูกด้าย'}</small>`;
      chip.classList.toggle('on', n > 0);
    }
    const hb = box.getBoundingClientRect(), hud = chip.parentNode.getBoundingClientRect();
    chip.style.left = hb.left - hud.left + 'px';
    chip.style.top = hb.bottom - hud.top + 6 + 'px';
    chip.hidden = false;
  }
  // online: the server's count rides my snapshot (meters.ptThread); the local count until it does
  let srvThreads = null;
  function onlineThreads(game) { return srvThreads != null ? srvThreads : threadsNow(game); }

  // ---------------- ฉุดเพื่อนขึ้น ----------------
  let pull = null; // { peer, name, t0, sent } while T (or the button) is held
  let pullCdUntil = 0; // (performance.now() ms)
  let holdKey = false, holdBtn = false;
  // the fallen member of my party nearest me within the reach
  function fallenNear(game) {
    const p = game.player;
    if (!p || p.dead > 0 || !inParty()) return null;
    let best = null, bd = R.pull.reach;
    for (const r of mates()) {
      if (!r.dd || r.map !== game.mapId) continue;
      const d = NC.dist(r.x, r.y, p.x, p.y);
      if (d <= bd) { bd = d; best = r; }
    }
    return best;
  }
  const typing = () => { const t = document.activeElement; return !!(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)); };
  addEventListener('keydown', (e) => {
    if (e.code !== 'KeyT' || typing()) return;
    const game = G();
    if (!game || !game.player || game.paused) return;
    const r = fallenNear(game);
    if (!r) return;
    // (a fallen friend beside me: T is the pull, not a talk with an NPC near)
    e.stopImmediatePropagation(); e.preventDefault();
    if (e.repeat) return;
    holdKey = true;
  }, true);
  addEventListener('keyup', (e) => { if (e.code === 'KeyT') holdKey = false; }, true);
  addEventListener('blur', () => { holdKey = false; holdBtn = false; });
  function startPull(game, r) {
    const left = (pullCdUntil - performance.now()) / 1000;
    if (left > 0) { if (!pull || pull.peer !== r.peer) game.toast(`ฉุดเพื่อนได้อีกครั้งใน ${Math.ceil(left)} วิ`); holdKey = holdBtn = false; return; }
    pull = { peer: r.peer, name: r.name || 'เพื่อน', t0: game.time, sent: false };
    if (online() && NC.Online.action) { NC.Online.action({ action: 'party', kind: 'pull', targetId: r.peer }); pull.sent = true; }
  }
  function stopPull(game, why) {
    if (!pull) return;
    if (pull.sent && online() && NC.Online.action && why !== 'done') NC.Online.action({ action: 'party', kind: 'pullStop' });
    pull = null;
  }
  function pullTick(game, dt) {
    if (!game || !game.player) return;
    const p = game.player, I = game.input || {};
    const r = fallenNear(game);
    const want = (holdKey || holdBtn) && !!r;
    if (pull && (!want || !r || r.peer !== pull.peer || p.dead > 0 || I.mx || I.my || I.attack || game.mouse.down)) { stopPull(game, 'off'); holdKey = holdKey && !!r; }
    else if (want && !pull) startPull(game, r);
    if (pull && !online() && game.time - pull.t0 >= R.pull.hold) {
      // offline: the stand-in of that member (js/partysupport.js) carries the resurrection to their game
      const s = (NC.allies ? NC.allies(game) : []).find((a) => a.proxy && a.peer === pull.peer);
      if (s && NC.Party && NC.Party.lib && NC.Party.lib.revive) { NC.Party.lib.revive(game, s, R.pull.hp); pulled(game, pull.name); }
      pull = null; holdKey = holdBtn = false;
    }
    btnTick(game, r);
  }
  function pulled(game, name) {
    pullCdUntil = performance.now() + R.pull.cooldown * 1000;
    const p = game.player;
    FX.stars(p.x, p.y - 80, 12, '255,150,165', { speed: 220 });
    game.toast(`ฉุด ${name} ขึ้นมาแล้ว!`);
    if (NC.HUD && NC.HUD.log) NC.HUD.log(`คุณฉุด ${name} ขึ้นมา (HP ${Math.round(R.pull.hp * 100)}%) · ฉุดได้อีกครั้งใน ${Math.round(R.pull.cooldown / 60)} นาที`, 'item');
  }
  // the prompt over the fallen friend and the hold's ring (UI: a label and a progress ring, like the NPCs' "กด T")
  function drawPullPrompt(ctx, game) {
    const p = game.player;
    if (!p || p.dead > 0) return;
    const r = fallenNear(game);
    if (!r) return;
    const x = r.x, y = r.y, cd = (pullCdUntil - performance.now()) / 1000;
    const ic = NC.SPR.pb_ic_pull;
    if (pull && pull.peer === r.peer) {
      const u = Math.min(1, (game.time - pull.t0) / R.pull.hold);
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineWidth = 12; ctx.strokeStyle = 'rgba(42,36,53,0.85)';
      ctx.beginPath(); ctx.arc(x, y - 46, 50, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 7; ctx.strokeStyle = '#ff6f84';
      ctx.beginPath(); ctx.arc(x, y - 46, 50, -Math.PI / 2, -Math.PI / 2 + u * Math.PI * 2); ctx.stroke();
      ctx.restore();
      NC.drawTag(ctx, `กำลังฉุด ${r.name || 'เพื่อน'} ขึ้น...`, x, y - 128 + Math.sin(game.time * 6) * 2, 21, '#ffd2d8');
    } else {
      const text = cd > 0 ? `ฉุดได้อีกใน ${Math.ceil(cd)} วิ` : 'กด T ค้าง · ฉุดเพื่อนขึ้น';
      NC.drawTag(ctx, text, x, y - 128 + Math.sin(game.time * 4) * 3, 20, cd > 0 ? '#c9c2d6' : '#ffd2d8');
    }
    if (ic && ic.img) ctx.drawImage(ic.img, x - 26, y - 200, 52, 52);
  }
  // the button (a mouse or a finger can hold it too), bottom middle
  let btn = null, btnKey = '';
  function btnTick(game, r) {
    if (!btn) {
      const hud = $('hud');
      if (!hud) return;
      btn = document.createElement('button');
      btn.id = 'pbpull'; btn.className = 'pb-pull kw-btn'; btn.hidden = true;
      const on = (e) => { e.preventDefault(); holdBtn = true; };
      const off = () => { holdBtn = false; };
      btn.addEventListener('pointerdown', on);
      btn.addEventListener('pointerup', off); btn.addEventListener('pointerleave', off); btn.addEventListener('pointercancel', off);
      hud.appendChild(btn);
    }
    const show = !!r && !(game.player.dead > 0);
    if (!show) { if (!btn.hidden) btn.hidden = true; return; }
    const ic = NC.SPR.pb_ic_pull, holding = !!(pull && pull.peer === r.peer);
    const key = r.peer + '|' + holding + '|' + !!ic;
    if (key !== btnKey) {
      btnKey = key;
      btn.innerHTML = (ic ? `<img src="${esc(ic.img.src)}" alt="">` : '') + `<span>${holding ? 'กำลังฉุด' : 'ฉุด'} <b>${esc(r.name || 'เพื่อน')}</b> ขึ้น</span><small>กดค้าง T</small>`;
      btn.classList.toggle('on', holding);
    }
    btn.hidden = false;
  }

  // ---------------- the faint: a living member near, a pull may come (offline; online the server's revive.pull) ----------------
  const baseHurt = NC.hurtPlayer;
  NC.hurtPlayer = function (game) {
    const p = game.player, was = p.dead > 0;
    const r = baseHurt.apply(this, arguments);
    if (!was && p.dead > 0 && !online() && inParty()) {
      const near = mates().some((m) => alive(m) && m.map === game.mapId && NC.dist(m.x, m.y, p.x, p.y) <= R.pull.near);
      if (near && p.dead < 10) { p.dead = 10; game.toast('หมดแรง... เพื่อนในตี้ฉุดคุณขึ้นได้ภายใน 10 วิ'); }
    }
    return r;
  };

  // ---------------- online: the server's events and my snapshot ----------------
  const ERR = {
    'that hero is not in your party here': 'ฉุดได้เฉพาะเพื่อนในตี้ที่อยู่แมพเดียวกัน', 'that hero is not down': 'เพื่อนยังไม่ได้ล้ม',
    'no pulling in a duel': 'ฉุดเพื่อนระหว่างดวลไม่ได้', 'too far to pull': 'เดินเข้าไปใกล้เพื่อนอีกนิด', 'pulling is off': 'ตอนนี้ปิดการฉุดเพื่อนอยู่',
  };
  function hookOnline() {
    const W = NC.OnlineWorld;
    if (!W || W._bonds) return;
    W._bonds = true;
    W.eventHooks.push((ev) => {
      const game = G();
      if (!ev || !game || !game.player) return;
      if (ev.type === 'partyPull') {
        const meId = PN() && PN().me ? PN().me() : null, P = PN();
        const nameOf = (id) => (P && P.nameOf ? P.nameOf(id) : 'เพื่อน');
        if (ev.sourceId === meId) {
          if (ev.state === 'done') { const n = pull ? pull.name : nameOf(ev.targetId); pull = null; holdKey = holdBtn = false; pulled(game, n); }
          else if (ev.state === 'stop' && pull) pull = null;
        } else if (ev.targetId === meId) {
          if (ev.state === 'start') game.toast(`${nameOf(ev.sourceId)} กำลังฉุดคุณขึ้น...`);
          else if (ev.state === 'done') game.toast(`${nameOf(ev.sourceId)} ฉุดคุณขึ้นมาแล้ว!`);
        }
      } else if (ev.type === 'error' && ev.message) {
        const m = String(ev.message), th = ERR[m] || (/^pull again in (\d+) s$/.test(m) ? `ฉุดเพื่อนได้อีกครั้งใน ${m.match(/\d+/)[0]} วิ` : null);
        if (th) {
          game.toast(th); pull = null; holdKey = holdBtn = false;
          const s = m.match(/^pull again in (\d+) s$/);
          if (s) pullCdUntil = performance.now() + Number(s[1]) * 1000;
        }
      }
    });
    let toldFall = false;
    W.selfHooks.push((s) => {
      srvThreads = s && s.meters && typeof s.meters.ptThread === 'number' ? s.meters.ptThread : s && s.meters ? 0 : null;
      const game = G();
      if (s && s.dead > 0 && s.revive && s.revive.pull && !s.revive.support && !toldFall && game) { toldFall = true; game.toast('หมดแรง... เพื่อนในตี้ฉุดคุณขึ้นได้ภายใน 10 วิ'); }
      if (s && !(s.dead > 0)) toldFall = false;
    });
  }

  setInterval(() => {
    hookExp();
    if (online()) hookOnline();
    try { chipTick(); } catch (e) { console.warn('partybonds: chip', e); }
  }, 250);
})();
