/* hud.js — DOM HUD, like an MMO: the hero's frame (portrait, name, job, levels, HP / SP, points to spend), the
   target frame, skills + items with SP costs, base / job EXP bars, a message log, menu buttons, the minimap with fog
   and the day/night dial; and the windows: status (C), skills (K), naming the hero */
(function () {
  'use strict';
  const NC = window.NC;
  const $ = (id) => document.getElementById(id);
  const TAU = Math.PI * 2;
  let mm, mmc, dial, dialc, port, head, fog, fogW, fogH;
  const FOG_CELL = 100;
  const lastTxt = {};
  const cadenceEnabled = true;
  let visualFrames = new WeakMap();
  const nodeValues = new WeakMap();
  let visualEpoch = 0, revealX = NaN, revealY = NaN;
  const changed = (node, key, value) => {
    if (!node) return false;
    if (!cadenceEnabled) return true;
    let values = nodeValues.get(node);
    if (!values) { values = new Map(); nodeValues.set(node, values); }
    if (values.has(key) && values.get(key) === value) return false;
    values.set(key, value);
    return true;
  };

  const setText = (id, t) => { if (lastTxt[id] !== t) { lastTxt[id] = t; $(id).textContent = t; } };
  const setWidth = (id, f) => { const v = (100 * NC.clamp(f, 0, 1)).toFixed(1) + '%'; if (lastTxt['w' + id] !== v) { lastTxt['w' + id] = v; $(id).style.width = v; } };
  const setHidden = (id, h) => { if (lastTxt['h' + id] !== h) { lastTxt['h' + id] = h; $(id).hidden = h; } };
  const pct2 = (f) => (Math.floor(NC.clamp(f, 0, 1) * 10000) / 100).toFixed(2) + '%';
  const iconSrc = (name) => (NC.ASSET_MANIFEST[name] ? NC.ASSET_MANIFEST[name].src : '');
  const elTh = (el) => NC.ELEMENT_INFO[el || 'neutral'].th;

  NC.HUD = {
    cadenceEnabled,
    invalidateVisuals() {
      visualEpoch++;
      // Hidden canvases may not draw again for many map transitions. Release
      // their previous world references when Maps evicts those worlds.
      visualFrames = new WeakMap();
    },
    shouldDrawVisual(canvas, game, variant = 0) {
      if (!cadenceEnabled) return true;
      const now = performance.now(), previous = visualFrames.get(canvas);
      const invalid = !previous || previous.epoch !== visualEpoch || previous.world !== game.world || previous.mapId !== game.mapId ||
        previous.width !== canvas.width || previous.height !== canvas.height || previous.variant !== variant || now < previous.time;
      if (!invalid && now + 0.001 < previous.next) { previous.time = now; return false; }
      const next = invalid || now - previous.next >= 100 ? now + 100 : previous.next + 100;
      visualFrames.set(canvas, { epoch: visualEpoch, world: game.world, mapId: game.mapId, width: canvas.width, height: canvas.height, variant, time: now, next });
      return true;
    },
    setCachedStyle(node, key, value) { if (changed(node, 'style:' + key, value)) node.style.setProperty(key, value); },
    setCachedClass(node, key, value) { if (changed(node, 'class:' + key, value)) node.classList.toggle(key, value); },
    setCachedText(node, value) { if (changed(node, 'text', value)) node.textContent = value; },
    init(game) {
      this.game = game;
      mm = $('minimap'); mmc = mm.getContext('2d');
      dial = $('dial'); dialc = dial.getContext('2d');
      port = $('cport');
      fogW = Math.ceil(game.world.W / FOG_CELL); fogH = Math.ceil(game.world.H / FOG_CELL);
      fog = new Uint8Array(fogW * fogH);
      revealX = revealY = NaN;
      this.invalidateVisuals();
      this.resize();
      this.refreshHead(game);
      this.log('กด C สเตตัส · K สกิล · I อุปกรณ์ · M แผนที่ · ESC เมนู', 'sys');
    },

    // the hero went to another map (maps.js): its own minimap fog; what was explored on the map he left is kept
    mapChanged(game, prev) {
      if (prev) prev.fog = fog;
      fogW = Math.ceil(game.world.W / FOG_CELL); fogH = Math.ceil(game.world.H / FOG_CELL);
      fog = game.world.fog || new Uint8Array(fogW * fogH);
      revealX = revealY = NaN;
      this.invalidateVisuals();
    },

    // the hero's own head: the minimap marker and the portrait, drawn from the current outfit and hat
    refreshHead(game) {
      this.invalidateVisuals();
      if (!head) { head = document.createElement('canvas'); head.width = head.height = 96; }
      const draw = (cv, S) => {
        const c = cv.getContext('2d');
        c.setTransform(1, 0, 0, 1, 0, 0);
        c.clearRect(0, 0, cv.width, cv.height);
        c.save();
        c.scale(cv.width / S, cv.height / S);
        c.beginPath(); c.arc(S / 2, S / 2, S * 0.46, 0, TAU); c.clip();
        if (cv === head) { c.fillStyle = '#f3e7cf'; c.fillRect(0, 0, S, S); }
        const hs = NC.headSpot(game.player.equip), k = (S * 0.77) / hs.w;
        NC.drawAvatar(c, game.player.equip, S / 2 - hs.x * k, S * 0.58 - hs.y * k, k, 1, { noWeapon: true });
        c.restore();
      };
      draw(head, 96);
      if (port) draw(port, 116);
    },

    resize() {
      this.invalidateVisuals();
      const dpr = window.devicePixelRatio || 1;
      for (const c of [mm, dial, port]) {
        if (!c) continue;
        const r = c.getBoundingClientRect();
        c.width = Math.max(1, Math.round(r.width * dpr)); c.height = Math.max(1, Math.round(r.height * dpr));
      }
      if (this.game && this.game.player) this.refreshHead(this.game);
    },

    reveal(x, y) {
      const R = 5;
      const cx = Math.floor(x / FOG_CELL), cy = Math.floor(y / FOG_CELL);
      if (cadenceEnabled && cx === revealX && cy === revealY) return;
      revealX = cx; revealY = cy;
      for (let j = -R; j <= R; j++)
        for (let i = -R; i <= R; i++) {
          if (i * i + j * j > R * R) continue;
          const gx = cx + i, gy = cy + j;
          if (gx >= 0 && gy >= 0 && gx < fogW && gy < fogH) fog[gy * fogW + gx] = 1;
        }
    },

    drawMap(ctx, w, h, game, span) {
      if (!this.shouldDrawVisual(ctx.canvas, game, span)) return;
      const p = game.player, world = game.world;
      const k = w / span;
      const x0 = NC.clamp(p.x - span / 2, 0, world.W - span), y0 = NC.clamp(p.y - span / 2, 0, world.H - span * (h / w));
      ctx.fillStyle = '#16131d'; ctx.fillRect(0, 0, w, h);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(world.minimap, x0 / 10, y0 / 10, span / 10, (span * h) / w / 10, 0, 0, w, h);
      ctx.fillStyle = '#16131d';
      for (let gy = Math.floor(y0 / FOG_CELL); gy <= (y0 + (span * h) / w) / FOG_CELL; gy++)
        for (let gx = Math.floor(x0 / FOG_CELL); gx <= (x0 + span) / FOG_CELL; gx++)
          if (gx >= 0 && gy >= 0 && gx < fogW && gy < fogH && !fog[gy * fogW + gx])
            ctx.fillRect(Math.floor((gx * FOG_CELL - x0) * k), Math.floor((gy * FOG_CELL - y0) * k), Math.ceil(FOG_CELL * k) + 1, Math.ceil(FOG_CELL * k) + 1);
      // enemies that are revealed and near
      for (const e of game.enemies) {
        const ex = (e.x - x0) * k, ey = (e.y - y0) * k;
        if (ex < 0 || ey < 0 || ex > w || ey > h) continue;
        ctx.fillStyle = '#e0525c';
        ctx.beginPath(); ctx.arc(ex, ey, Math.max(2.5, w * 0.014), 0, TAU); ctx.fill();
      }
      const px = (p.x - x0) * k, py = (p.y - y0) * k, hs = Math.max(18, w * 0.17);
      ctx.drawImage(head, px - hs / 2, py - hs / 2 - hs * 0.15, hs, hs);
      ctx.strokeStyle = '#2a2435'; ctx.lineWidth = Math.max(2, hs * 0.07);
      ctx.beginPath(); ctx.arc(px, py - hs * 0.15, hs * 0.46, 0, TAU); ctx.stroke();
    },

    drawDial(game) {
      if (!this.shouldDrawVisual(dial, game)) return;
      const c = dialc, w = dial.width, h = dial.height;
      const hr = (((game.minutes / 60) % 24) + 24) % 24;
      const night = hr < 5.5 || hr >= 19 ? 1 : hr < 7 ? (7 - hr) / 1.5 : hr >= 17.5 ? (hr - 17.5) / 1.5 : 0;
      c.clearRect(0, 0, w, h);
      c.save();
      c.beginPath(); c.arc(w / 2, 0, w / 2 - 2, 0, Math.PI); c.closePath(); c.clip();
      const g = c.createLinearGradient(0, 0, 0, h);
      const top = night > 0.5 ? '#1f2f9a' : '#6fc3ff', bot = night > 0.5 ? '#3d64e6' : '#c3ecff';
      g.addColorStop(0, top); g.addColorStop(1, bot);
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      // moon by night, sun by day, travelling along the arc
      const u = night > 0.5 ? ((hr + 5) % 24) / 12 : (hr - 6) / 12;
      const ang = Math.PI * (1 - NC.clamp(u, 0, 1));
      const bx = w / 2 + Math.cos(ang) * w * 0.3, by = h * 0.1 + Math.sin(ang) * h * 0.5;
      c.fillStyle = night > 0.5 ? '#eaf2ff' : '#ffd24a';
      c.beginPath(); c.arc(bx, by, w * 0.075, 0, TAU); c.fill();
      if (night > 0.5) { c.fillStyle = top; c.beginPath(); c.arc(bx + w * 0.035, by - w * 0.02, w * 0.065, 0, TAU); c.fill(); }
      c.fillStyle = 'rgba(255,255,255,0.92)';
      for (const [cx, cy, r] of [[0.2, 0.78, 0.09], [0.32, 0.86, 0.11], [0.72, 0.8, 0.1], [0.84, 0.72, 0.08], [0.5, 0.95, 0.12]]) {
        c.beginPath(); c.arc(w * cx, h * cy, w * r, 0, TAU); c.fill();
      }
      c.restore();
      c.strokeStyle = '#2a2435'; c.lineWidth = Math.max(2, w * 0.022);
      c.beginPath(); c.arc(w / 2, 0, w / 2 - 2, 0, Math.PI); c.stroke();
    },

    update(game) {
      const p = game.player;
      // (2026-10-18, phase 1 "HUD 10 ครั้ง/วิ"; NC.Perf.hud) the page's parts - the texts, the bars, the target frame, the
      // minimap and the clock dial - 10 times a second; the hotbar's and the potions' cooldowns every frame (they sweep).
      // The files that wrap NC.HUD.update still run every frame (some of them count frames)
      const now = performance.now(), PF = NC.Perf;
      if (PF && PF.hud && this._hudAt !== undefined && now >= this._hudAt && now - this._hudAt < 100) {
        if (this.updateHotbar) this.updateHotbar(p);
        this.potionCd(p);
        return;
      }
      this._hudAt = now;
      // the hero's frame
      setText('clv', String(p.lv));
      setText('cname', p.name || '');
      setText('cjob', (NC.JOBS[p.job] || NC.JOBS.traveler).name);
      setText('cjlv', String(p.jobLv));
      setWidth('hpfill', p.hp / p.maxHp); setWidth('hplag', p.hp / p.maxHp);
      setText('hptext', Math.ceil(p.hp) + ' / ' + p.maxHp);
      setWidth('spfill', p.sp / p.maxSp);
      setText('sptext', Math.floor(p.sp) + ' / ' + p.maxSp);
      const st = NC.statusLeft(p), sk = NC.skillLeft(p);
      setHidden('stpts', st <= 0); setText('stptsn', String(st)); setHidden('stdot', st <= 0);
      setHidden('skpts', sk <= 0); setText('skptsn', String(sk)); setHidden('skdot', sk <= 0);
      // skills: the 8 hotbar slots (Q E R F 3 4 5 6, the player's pick; F: the boss set's ultimate while the whole set
      // is worn): icon, cooldown, level, SP cost (red when there is not enough SP) — skillui.js
      if (this.updateHotbar) this.updateHotbar(p);
      this.renderBuffs(p);
      this.potionCd(p);
      setText('potions', String(p.potions));
      setText('sppotions', String(p.spPotions));
      // base / job EXP
      const bx = p.lv >= NC.LV_MAX ? 1 : p.xp / NC.xpNext(p.lv), jx = p.jobLv >= NC.jobMax(p) ? 1 : p.jobXp / NC.jobNext(p.jobLv, p);
      setWidth('bxpfill', bx); setText('bxptext', p.lv >= NC.LV_MAX ? 'MAX' : pct2(bx));
      setWidth('jxpfill', jx); setText('jxptext', p.jobLv >= NC.jobMax(p) ? 'MAX' : pct2(jx));
      // the monster under the mouse, else the one last hit
      const t = game.hover || game.target;
      setHidden('tframe', !t);
      if (t) {
        setText('tname', t.name);
        setText('tlv', 'Lv ' + t.lv);
        const src = iconSrc('el_' + t.element);
        if (lastTxt.tel !== src) { lastTxt.tel = src; $('tel').src = src; $('tel').title = 'ธาตุ' + elTh(t.element); }
        setWidth('thpfill', t.hp / t.maxHp);
        setText('thptext', Math.max(0, Math.ceil((100 * t.hp) / t.maxHp)) + '%');
        // how well the hero's weapon element does against it
        const we = p.d.atkElement, mod = NC.elementMod(we, t.element);
        const eff = `อาวุธ${we === 'neutral' ? 'ไม่มีธาตุ' : 'ธาตุ' + elTh(we)} ${Math.round(mod * 100)}%`;
        if (lastTxt.teff !== eff) {
          lastTxt.teff = eff;
          const el = $('teff');
          el.textContent = eff;
          el.style.color = mod >= 1.25 ? '#ffae5c' : mod < 1 ? '#aab4c8' : '#e9e2d6';
        }
      }
      setText('zonelbl', game.zoneName || '');
      const dot = p.fresh.size > 0;
      if (dot !== lastTxt.dot) { lastTxt.dot = dot; $('bagdot').hidden = !dot; }
      const m = Math.floor(game.minutes) % 1440, hh = Math.floor(m / 60), mm2 = m % 60;
      setText('time', ((hh + 11) % 12) + 1 + ':' + String(mm2).padStart(2, '0') + (hh < 12 ? ' AM' : ' PM'));
      this.reveal(p.x, p.y);
      this.drawMap(mmc, mm.width, mm.height, game, 1500);
      this.drawDial(game);
    },

    // the potion buttons' cooldown sweeps (written only when they change)
    potionCd(p) {
      const a = p.cd.pot > 0 ? (100 * p.cd.pot) / 0.8 + '%' : '0%', b = p.cd.sppot > 0 ? (100 * p.cd.sppot) / 0.8 + '%' : '0%';
      if (a !== lastTxt.cdpot) { lastTxt.cdpot = a; $('cd-pot').style.setProperty('--p', a); }
      if (b !== lastTxt.cdsppot) { lastTxt.cdsppot = b; $('cd-sppot').style.setProperty('--p', b); }
    },

    // buffs on the hero (the knight's dome, the burning blade, shadow step's sure critical): icon + seconds left
    renderBuffs(p) {
      const B = p.buffs || {}, list = [['guard', 'sk_guard', 'โล่แสงศักดิ์สิทธิ์'], ['fireblade', 'sk_magnum', 'อาวุธติดไฟ'], ['shadow', 'sk_shadowstep', 'คริติคอลแน่นอน']]
        .filter(([k]) => B[k] > 0);
      const key = list.map((l) => l[0]).join(',');
      const box = $('buffs');
      if (!box) return;
      if (lastTxt.buffs !== key) {
        lastTxt.buffs = key;
        box.textContent = '';
        for (const [k, icon, name] of list) {
          const d = document.createElement('div');
          d.className = 'buff'; d.dataset.k = k; d.title = name;
          d.innerHTML = `<img src="${iconSrc(icon)}" alt=""><b></b>`;
          box.appendChild(d);
        }
      }
      for (const d of box.children) { const t = B[d.dataset.k]; this.setCachedText(d.querySelector('b'), t >= 1 ? Math.ceil(t) : t.toFixed(1)); this.setCachedClass(d, 'ending', t < 1.5); }
    },

    // a line in the message log (kinds: exp, item, level, job, warn, sys); the oldest go
    log(text, kind) {
      const box = $('log');
      if (!box) return;
      const ln = document.createElement('div');
      ln.className = 'ln ' + (kind || 'sys');
      ln.textContent = text;
      box.appendChild(ln);
      while (box.children.length > 7) box.firstChild.remove();
    },

    // the bottom of every window's NC.HUD.panel wrapper (the K windows, js/*win.js, take their names over first);
    // panel('pause', false) is how they close every other window. No window of that name: false
    panel(id, show) {
      const el = $(id);
      if (!el) return false;
      const on = show === undefined ? el.hidden : show;
      $('pause').hidden = true;
      el.hidden = !on;
      if (on) this.invalidateVisuals();
      return on;
    },

    // the skills changed: the skill window (js/skillwin.js) redraws itself while it is open (the job cards and the job
    // change: js/skillui.js)
    renderSkills() {},

    // naming the hero (a new game, or the menu's ปรับแต่งตัวละคร): js/creator.js opens the character creator, online
    // the account panel (js/online.js); the old name box is gone (2026-10-21)
    askName() {},

    toast(text) {
      const el = $('toast');
      el.textContent = text;
      el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    },

    zone(text) {
      const el = $('zone');
      el.textContent = text;
      el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    },
  };
})();
