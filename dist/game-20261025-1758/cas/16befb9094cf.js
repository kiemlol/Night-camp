/* p3_fallen.js — หมดแรง: the knocked-out screen (new; the picked mockup assets/gen/nightcamp_p3_fallen_b_raw.png, UI audit
   round 3, 2026-10-17). Before, a fall only toasted "หมดแรง... กำลังกลับไปที่ค่าย" and entities.js stood the hero up
   at the map's spawn 2.6 s later (10 s with a support job of the party on the map: js/partysupport.js).
   Now the world fades to deep night blue with a vignette (the game itself still draws the hero lying where he fell:
   the 'death' clip, js/anim.js), ประกาย the ember spirit (assets/journey/sp_*.png) floats over him with a bubble, the
   word หมดแรง big at the top, a ribbon "ล้มโดย <monster> Lv <n> ที่ <map>", a tip card (a different one each fall),
   and a strip: ฟื้นที่ค่าย <countdown> (click = now) and รอเพื่อนช่วย (only in a real party with someone up nearby:
   it holds the countdown, at most 30 s, until a friend raises the hero).
   Under the ribbon an EXP card says what the fall cost (2026-10-19, the user: "ทำแจ้งตอนตายด้วย"): เสีย EXP −n with the
   bar's % before → after, or ขนนกไออุ่นปกป้อง EXP ไว้ (feathers left), or ไม่เสีย EXP below Lv 20. Offline from
   progression.js's numbers; online the server's note (self.faint) through js/online/faint.js -> NC.P3Fallen.exp.
   Hooks (entities.js is not edited):
     NC.monsterAttack   remembers the monster whose blow is landing (it calls NC.hurtPlayer inside)
     NC.hurtPlayer      the outermost wrapper: the toasts that start with หมดแรง are held back while the blow lands; if
                        the hero fell, the screen opens (else the toast goes out as before). The blow's source: the
                        monster above, or the one standing at the fromX every monster path passes (bosses, skills).
     NC.updatePlayer    "wait for a friend" adds the frame's dt back to p.dead, so entities.js's countdown stands still
   Offline, "now" sets p.dead to a hair above 0 for entities.js (and partysupport). Online it asks the server to revive;
   the screen stays until the server confirms the hero is up. Not shown in the guild war (#gwr-dead) or a PvP duel.
   The auto farm stops by itself on a fall (js/autofarm.js) and nothing else happens there, so the screen shows then too.
   Test: NC.P3Fallen.show() (a sample) · or NC.hurtPlayer(g, 1e9, monster.x). */
(function () {
  'use strict';
  const NC = window.NC;
  if (!NC || !NC.hurtPlayer) return;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const WAIT_MAX = 30;
  let el = null, open = false, info = null, raf = 0, hold = false, holdUntil = 0, closing = 0;
  let attacker = null, tipAt = -1;
  try { tipAt = Number(localStorage.getItem('nightcamp.p3fallen.tip')) || -1; } catch (e) { /* storage blocked */ }

  // ---------------- where am I, who did it ----------------
  const skipHere = (game) => !!((NC.GW && NC.GW.on && NC.GW.on()) || (NC.PvP && NC.PvP.duel));
  const mapName = (game) => { const M = NC.MAPS && NC.MAPS[game.mapId]; return (M && M.name) || (game.world && game.world.name) || game.mapId || ''; };
  const mapLv = (game) => { const M = NC.MAPS && NC.MAPS[game.mapId], m = M && M.lvText && String(M.lvText).match(/(\d+)\D+(\d+)/); return m ? [Number(m[1]), Number(m[2])] : null; };
  function killerOf(game, fromX) {
    if (attacker) return attacker;
    if (typeof fromX !== 'number') return null;
    const p = game.player;
    let best = null, bd = Infinity;
    for (const e of game.enemies || []) if (e && e.x === fromX) { const d = NC.dist(e.x, e.y, p.x, p.y); if (d < bd) { bd = d; best = e; } }
    return best;
  }
  const PN = () => NC.PartyNet;
  function friendNear(game) {
    const N = PN(), p = game && game.player;
    if (!N || !N.pid || !N.pid() || !p) return false;
    try { return N.onMap().some((r) => r && !r.dd && typeof r.x === 'number' && NC.dist(r.x, r.y, p.x, p.y) < 1400); } catch (e) { return false; }
  }
  const potN = (p, c) => (NC.POT ? NC.POT.count(p, c) : c === 'red' ? p.potions || 0 : p.spPotions || 0);

  // ---------------- the tips (a different useful one each fall) ----------------
  // (HTML: the words that must not break across lines are in <span>s; nothing from players goes in)
  const W = (t) => `<span>${t}</span>`;
  const TIPS = [
    (g, p) => (potN(p, 'red') > 0 ? `ดื่ม${W('ยาแดง (ปุ่ม 1)')} ให้เร็วขึ้น และ${W('ยาฟ้า (ปุ่ม 2)')} ก่อน ${W('SP หมด')}` : `ยาแดงหมดแล้ว · ซื้อ${W('ยาแดง')} ${W('ยาฟ้า')} ได้ที่${W('ลุงโกโก้')}ในค่าย (ดื่มด้วย${W('ปุ่ม 1 / 2')})`),
    () => `${W('นั่งพัก (X)')} ให้ HP เต็มก่อนเข้าสู้ศึกต่อไป · ข้าง${W('กองไฟ')}ในค่ายฟื้นเร็วกว่า`,
    () => `ตั้ง${W('ออโต้ฟาร์ม (Z)')} ให้ดื่ม${W('ยาแดง')}เองเมื่อ HP ต่ำกว่าครึ่ง บอทจะล้มน้อยลง`,
    () => `${W('ตีบวก')}อาวุธและชุดที่เตาของ${W('ป๋าหมูหริ่ง')}ในค่าย ยิ่งบวกสูงยิ่งทนและตีแรง`,
    (g, p) => { const L = mapLv(g); return L && p.lv < L[0] ? `แมพนี้เหมาะกับ ${W(`Lv ${L[0]}–${L[1]}`)} · ตอนนี้ ${W(`Lv ${p.lv}`)} ลองเก็บเลเวลแมพที่ง่ายกว่านี้ก่อน` : `เลือกแมพที่เลเวลพอดีตัว ดูช่วงเลเวลของแต่ละแมพได้ที่${W('แผนที่โลก (M)')}`; },
  ];
  function tipFor(game, p, lost) {
    if (info && info.support) return `${W('พระในปาร์ตี้')}ชุบชีวิตให้ได้ · รอสักครู่ หรือกด${W('ฟื้นที่ค่าย')}เองก็ได้`;
    if (lost > 0 && !(p.feathers > 0) && Math.random() < 0.5) return `หมดแรงเสีย ${W(`EXP ${lost.toLocaleString()}`)} · ${W('ขนนกไออุ่น')}จาก${W('ลุงโกโก้')}กันการเสีย EXP ได้`;
    // (the level tip first when the map is above the hero; otherwise the next one round)
    const L = mapLv(game);
    if (L && p.lv < L[0] - 2 && tipAt !== 4) tipAt = 4;
    else tipAt = (tipAt + 1) % TIPS.length;
    try { localStorage.setItem('nightcamp.p3fallen.tip', String(tipAt)); } catch (e) { /* storage blocked */ }
    return TIPS[tipAt](game, p);
  }

  // ---------------- the screen ----------------
  function build() {
    el = document.createElement('div');
    el.id = 'p3fall'; el.hidden = true;
    el.innerHTML = '<div class="p3f-veil"></div><canvas class="p3f-hero" id="p3f-hero"></canvas><div class="p3f-warm" id="p3f-warm"></div>' +
      '<div class="p3f-top"><h1 class="p3f-title" data-t="หมดแรง">หมดแรง</h1>' +
      '<div class="p3f-ribbon"><i></i><span id="p3f-by"></span><i></i></div><div class="p3f-exp" id="p3f-exp" hidden></div></div>' +
      '<div class="p3f-spark" id="p3f-spark"><div class="p3f-glow"></div><img src="assets/journey/sp_talk.png" alt="ประกาย">' +
      '<div class="p3f-bubble" id="p3f-say"></div></div>' +
      '<div class="p3f-bot"><div class="p3f-tip"><img src="assets/p3/fallen/tip_bulb.png" alt=""><p id="p3f-tip"></p></div>' +
      '<div class="p3f-btns"><button class="p3f-go" id="p3f-go"><span id="p3f-golbl">ฟื้นที่ค่าย</span><b id="p3f-n">3</b></button>' +
      '<button class="p3f-wait" id="p3f-wait" hidden>รอเพื่อนช่วย</button></div></div>';
    document.body.appendChild(el);
    el.querySelector('#p3f-go').addEventListener('click', () => {
      const g = NC.game, p = g && g.player;
      if (!p || !(p.dead > 0)) return;
      if (NC.Online && NC.Online.enabled) {
        if (!NC.OnlineWorld || !NC.OnlineWorld.ready) return;
        NC.Online.action({ action: 'revive' });
      } else p.dead = Math.min(p.dead, 0.001); // entities.js stands him up on its next update offline
      hold = false;
      el.querySelector('#p3f-go').classList.add('now');
    });
    el.querySelector('#p3f-wait').addEventListener('click', () => {
      const g = NC.game;
      if (!g) return;
      if (hold) { hold = false; }
      else if (friendNear(g)) { hold = true; holdUntil = g.time + WAIT_MAX; if (NC.HUD && NC.HUD.log) NC.HUD.log('รอเพื่อนมาชุบชีวิต (สูงสุด 30 วิ)', 'sys'); }
      tick();
    });
  }
  // ---------------- the EXP card under the ribbon: what the fall cost ----------------
  // cost = { lost, feather, left } (offline from progression.js's numbers; online the server's note, self.faint, through
  // js/online/faint.js -> NC.P3Fallen.exp) or null while it is not known yet (online, before the note)
  const FAINT = () => (NC.EXPERIENCE && NC.EXPERIENCE.faint) || { fromLevel: 20, share: 0.01 };
  const lvPct = (xp, lv) => { const need = NC.xpNext ? NC.xpNext(lv) : 0; return need > 0 ? Math.max(0, Math.min(100, (xp / need) * 100)) : 0; };
  const pct1 = (v) => `${(Math.floor(v * 10) / 10).toFixed(1)}%`;
  let pending = null; // a note that came before the screen opened (online the selfHooks run before world.js shows it)
  function expCard(p, cost) {
    const ex = el.querySelector('#p3f-exp'), F = FAINT();
    let kind = '', html = '';
    if (cost && cost.feather) {
      kind = 'saved';
      html = `<img src="assets/progress/ic_feather.png" alt=""><span><b>ขนนกไออุ่นปกป้อง EXP ไว้</b><small>เหลือขนนก ${cost.left | 0} อัน</small></span>`;
    } else if (cost && cost.lost > 0) {
      kind = 'lost';
      html = `<span><b>เสีย EXP <em>−${cost.lost.toLocaleString()}</em> <small>(${Math.round(F.share * 100)}% ของเลเวล)</small></b>` +
        `<small>EXP ${pct1(lvPct(p.xp + cost.lost, p.lv))} → ${pct1(lvPct(p.xp, p.lv))} · ขนนกไออุ่นจากลุงโกโก้กันได้</small></span>`;
    } else if (p.lv >= (NC.LV_MAX || 99)) { /* the top level loses nothing and says nothing */ }
    else if (p.lv < F.fromLevel) {
      kind = 'free';
      html = `<span><b>ไม่เสีย EXP</b><small>หมดแรงจะเริ่มเสีย EXP ตั้งแต่ Lv ${F.fromLevel}</small></span>`;
    } else if (cost || !(p.xp > 0)) {
      kind = 'free';
      html = '<span><b>ไม่เสีย EXP</b><small>หลอด EXP ว่างอยู่</small></span>';
    }
    ex.className = `p3f-exp ${kind}`;
    ex.innerHTML = html;
    ex.hidden = !html;
  }
  function show(game, who, cost) {
    if (!el) build();
    const p = game.player, root = NC.Root && NC.Root.run && NC.Root.run();
    const atRoot = !!(root && root.out !== 'dead');
    info = { support: p.dead > 4, atRoot };
    const map = mapName(game);
    el.querySelector('#p3f-by').innerHTML = who
      ? `ล้มโดย <b>${esc(who.name || who.type)}</b>${who.lv ? ` Lv ${who.lv}` : ''} ที่ <b>${esc(map)}</b>`
      : `ล้มลงที่ <b>${esc(map)}</b>`;
    if (!cost && pending && performance.now() - pending.t < 4000) cost = pending.cost;
    pending = null;
    expCard(p, cost);
    const lost = (cost && cost.lost) || 0;
    el.querySelector('#p3f-say').innerHTML = atRoot ? 'เดี๋ยวพากลับไป<span>ทางเข้าชั้นนะ!</span>' : 'เดี๋ยวพาไป<span>ที่กองไฟนะ!</span>';
    el.querySelector('#p3f-golbl').textContent = atRoot ? 'ฟื้นที่ทางเข้าชั้น' : 'ฟื้นที่ค่าย';
    el.querySelector('#p3f-tip').innerHTML = `<b>เคล็ดลับ:</b> ${tipFor(game, p, lost)}`;
    el.querySelector('#p3f-go').classList.remove('now');
    hold = false; closing = 0;
    el.classList.remove('out');
    el.hidden = false; open = true;
    tick();
  }
  function close(now) {
    if (!el || !open) return;
    open = false; hold = false;
    cancelAnimationFrame(raf);
    if (now) { el.hidden = true; return; }
    el.classList.add('out');
    closing = setTimeout(() => { if (!open) el.hidden = true; }, 380);
  }
  // the hero's place on the screen (CSS px), from the game's camera
  function heroAt(game) {
    const cv = document.querySelector('canvas'), p = game.player;
    if (!cv || !p) return null;
    const r = cv.getBoundingClientRect(), k = (game.scale || 1) * (r.width / (cv.width || 1));
    return { x: r.left + (p.x - game.cam.x) * k, y: r.top + (p.y - game.cam.y) * k, k };
  }
  // the fallen hero once more over the night veil (the game draws him in the same place, its 'death' pose, but its own
  // darkening and the veil hide him): the same equip and pose, lit by the ember, fading out as the game's body does
  function drawHero(g, p, at) {
    const cv = el.querySelector('#p3f-hero');
    if (!cv || !p.pose || !NC.drawHero) return;
    const dpr = window.devicePixelRatio || 1, W = Math.ceil(380 * at.k), H = Math.ceil(260 * at.k), fx = W / 2, fy = H * 0.72;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.width = W + 'px'; cv.style.height = H + 'px'; }
    cv.style.left = Math.round(at.x - fx) + 'px'; cv.style.top = Math.round(at.y - fy) + 'px';
    const ctx = cv.getContext('2d'), s = at.k * dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.setTransform(s, 0, 0, s, 0, 0);
    try { NC.drawHero(ctx, p.equip, p.pose, fx / at.k, fy / at.k, { alpha: Math.max(0, Math.min(1, p.dead / 0.4)) }); } catch (e) { /* the game's own body stays */ }
  }
  function tick() {
    if (!open) return;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(tick);
    const g = NC.game, p = g && g.player;
    if (!p || !(p.dead > 0)) { close(); return; }
    if (skipHere(g)) { close(true); return; }
    // the countdown and the wait button
    el.querySelector('#p3f-n').textContent = String(Math.max(1, Math.ceil(p.dead)));
    const wb = el.querySelector('#p3f-wait'), near = friendNear(g);
    if (hold && (!near || g.time > holdUntil)) hold = false;
    wb.hidden = !near && !hold;
    wb.classList.toggle('on', hold);
    wb.textContent = hold ? `เลิกรอ (${Math.max(0, Math.ceil(holdUntil - g.time))})` : 'รอเพื่อนช่วย';
    // Spark over the hero (the camera eases, so every frame); kept between the title and the tip card
    // a close-up like the mockup: the fallen hero drawn big in the middle, between the title and the tip card (at world
    // size he was a few dozen pixels under the dark veil); the game's own small body stays where he fell, dimmed
    const w0 = heroAt(g);
    const topY = el.querySelector('.p3f-top').getBoundingClientRect().bottom, botY = el.querySelector('.p3f-bot').getBoundingClientRect().top;
    const big = Math.max(w0 ? w0.k : 0, Math.min(innerWidth * (innerWidth < 600 ? 0.62 : 0.3), (botY - topY) * 1.05) / 230);
    const at = w0 && { x: innerWidth / 2, y: botY - Math.max(18, (botY - topY) * 0.12), k: big };
    if (at) {
      const sp = el.querySelector('#p3f-spark'), top = topY;
      const bot = botY, h = sp.offsetHeight || 150;
      const y = Math.max(top + h + 8, Math.min(bot - 8, at.y - 64 * at.k));
      sp.style.left = Math.round(at.x - 34 * at.k) + 'px'; sp.style.top = Math.round(y) + 'px'; // (its bottom centre: css/p3_fallen.css)
      // the bubble on the side with room (a phone held upright has little), never off the screen
      const say = el.querySelector('#p3f-say'), sr = sp.getBoundingClientRect(), gap = 16;
      const right = innerWidth - sr.right - gap - 8, left = sr.left - gap - 8, flip = right < 170 && left > right;
      say.classList.toggle('l', flip);
      say.style.maxWidth = flip || right < 440 ? Math.max(120, Math.round(flip ? left : right)) + 'px' : '';
      const wm = el.querySelector('#p3f-warm');
      wm.style.left = Math.round(at.x) + 'px'; wm.style.top = Math.round(at.y - 30 * at.k) + 'px';
      el.style.setProperty('--hx', Math.round(at.x) + 'px'); el.style.setProperty('--hy', Math.round(at.y - 40 * at.k) + 'px'); // (the vignette's clear middle on him)
      drawHero(g, p, at);
    }
  }

  // ---------------- the hooks ----------------
  const baseMA = NC.monsterAttack;
  if (baseMA) NC.monsterAttack = function (game, e) {
    const was = attacker;
    attacker = e;
    try { return baseMA.apply(this, arguments); } finally { attacker = was; }
  };
  const baseHurt = NC.hurtPlayer;
  NC.hurtPlayer = function (game, dmg, fromX) {
    const p = game && game.player;
    if (!p || p.dead > 0 || skipHere(game)) return baseHurt.apply(this, arguments);
    const xp = p.xp, lv = p.lv, fe = p.feathers || 0, toast0 = game.toast, held = [];
    game.toast = function (t) { if (typeof t === 'string' && /^หมดแรง/.test(t)) { held.push(t); return undefined; } return toast0.apply(this, arguments); };
    let r;
    try { r = baseHurt.apply(this, arguments); } finally { game.toast = toast0; }
    if (p.dead > 0 && !skipHere(game)) {
      const who = killerOf(game, fromX), lost = p.lv === lv ? Math.max(0, xp - p.xp) : 0, left = p.feathers || 0;
      try { show(game, who, left < fe ? { feather: true, left } : { lost }); } catch (e) { console.warn('p3_fallen', e); for (const t of held) toast0.call(game, t); }
    } else for (const t of held) toast0.call(game, t);
    return r;
  };
  const baseUpd = NC.updatePlayer;
  NC.updatePlayer = function (game, dt) {
    const p = game && game.player;
    if (hold && open && p && p.dead > 0 && !game.hold) p.dead += dt; // (entities.js takes it off again: the count stands)
    return baseUpd.apply(this, arguments);
  };

  NC.P3Fallen = {
    // (online world.js opens it this way: the cost comes as the server's note; a test passes cost = { lost } / { feather, left })
    show(who, cost) { const g = NC.game; if (g && g.player) { if (!(g.player.dead > 0)) g.player.dead = 2.6; show(g, who || (g.enemies || [])[0] || null, cost || null); } },
    // the server's note of what the fall cost (js/online/faint.js): onto the open screen, or kept for the one about to open
    exp(cost) {
      const p = NC.game && NC.game.player;
      if (open && el && p) expCard(p, cost); else pending = { cost, t: performance.now() };
    },
    close, isOpen: () => open,
  };
})();
