/* p3_jgacha.js — the journal's Gacha page (mockup p3_jgacha B) and Endgame page (p3_jendgame A), built from the picked
   mockups (UI audit round 3, 2026-10-17: assets/gen/nightcamp_p3_jgacha_b_raw.png, nightcamp_p3_jendgame_a_raw.png).
   Both pages keep their logic in their own files (js/gacha.js, js/season.js): this file only redraws them. It wraps
   NC.Hub.tab('gacha') / NC.Hub.tab('endgame'): the old render() draws into a detached box, its numbers, rows and
   buttons are read from there (so the rates, rules and texts stay the ones gacha.js / season.js write) and laid out
   again; every click goes on to the old click() with the same data-* buttons (data-gt, data-pull, data-spark,
   data-sparkgo, data-passget, data-tok / data-et, data-star, data-reset, data-tower, data-go).
     ตู้กาชา   folder tabs + the balance; a painted banner (assets/p3/jgacha/banner.jpg, the night forest) with the
               season's name, three heroes drawn LIVE (NC.drawHero) in the season's featured costumes (real items of
               the pool, so they always match the prizes), the capsule machine (machine.png) and the two pull buttons;
               four number tiles; the prize table; the note. What a pull gave shows under the tiles.
     ท้ายเกม   folder tabs; the rule line, four tiles, a night-sky panel with the five constellations as painted star
               icons (star_<key>.png) joined by thin lines, the picked star's card, the five again as small cards with
               +1, the reset button. The tower / world boss / ranking tabs: the old parts restyled.
   A button that can't act (no gems, no points, Lv too low ...) explains why in a small note instead of doing nothing.
   Art: assets/gen/p3art_jgacha_{banner,machine,stars}.prompt.txt -> Codex -> assets/p3/jgacha/. */
(function () {
  'use strict';
  const NC = window.NC, H = NC.Hub;
  if (!H || !H.tab) return;
  const ART = 'assets/p3/jgacha/';
  const esc = H.esc;
  const G = () => NC.game;
  const num = (s) => Number(String(s || '').replace(/[^\d.-]/g, '')) || 0;
  const txt = (el) => (el ? el.textContent.trim() : '');
  const msgBox = (m) => (m ? `<div class="p3k-msg"><i>i</i><span>${m}</span></div>` : '');

  // the old page drawn into a box of its own, to read from
  function drawBase(base, game) {
    const box = document.createElement('div');
    try { base(box, game); } catch (e) { console.warn('p3_jgacha: old page', e); }
    return box;
  }
  // the old parts restyled (other tabs): buttons that are switched off get a reason instead
  function restyle(box, why) {
    for (const b of box.querySelectorAll('button[disabled]')) {
      const w = why(b);
      if (w) { b.disabled = false; b.classList.add('p3k-off'); b.dataset.why = w; }
    }
    return box;
  }
  const tabsHtml = (list, key, cur, right) =>
    `<div class="p3k-tabs">${list.map(([k, n]) => `<button class="kw-tab ${cur === k ? 'on' : ''}" data-${key}="${k}">${esc(n)}</button>`).join('')}` +
    `<span class="p3k-right">${right || ''}</span></div>`;
  const tilesHtml = (tiles, cls) => `<div class="p3k-tiles ${cls || ''}">${tiles.map(([b, s, extra, tag]) =>
    `<div class="p3k-tile ${extra || ''}"><b>${esc(String(b).replace(/\s*\/\s*/, ' / '))}${tag ? `<i>${esc(tag)}</i>` : ''}</b><span>${esc(s)}</span></div>`).join('')}</div>`;
  // (a label's "(...)" moved up next to the number as a small tag: the endgame's tiles stay one line like the mockup)
  const tagged = (T) => T.map(([b, s]) => { const m = /^(.*?)\s*\(([^)]*)\)\s*$/.exec(s); return m ? [b, m[1], '', m[2]] : [b, s]; });
  const readTiles = (box) => [...box.querySelectorAll('.bb-tile')].map((t) => [txt(t.querySelector('b')), txt(t.querySelector('span'))]);

  // ============================================================ ตู้กาชา ============================================================
  const TG = H.tab('gacha');
  if (TG) {
    const baseRender = TG.render, baseClick = TG.click;
    // seasons: a name for the banner and three featured costumes (robe ids; a missing one is filled from the pool)
    const SEASONS = [
      { name: ['คืน', 'หิ่งห้อย'], feat: ['robe_whitecat', 'robe_kitsune', 'robe_frog'] },
      { name: ['จันทร์', 'เสี้ยวเงิน'], feat: ['robe_blackcat', 'robe_pinkdino', 'robe_bunny'] },
      { name: ['ป่า', 'หมอกเงา'], feat: ['robe_calico', 'robe_blackdino', 'robe_mushroom'] },
      { name: ['ลมหนาว', 'ใต้ราก'], feat: ['robe_leopard', 'robe_panda', 'robe_duck'] },
    ];
    const seasonNo = () => (NC.Season && NC.Season.seasonNo ? NC.Season.seasonNo() : 1);
    function season() {
      const n = seasonNo(), S = SEASONS[(n - 1) % SEASONS.length];
      const P = NC.Gacha && NC.Gacha.pool ? NC.Gacha.pool() : { top: [], hats: [] };
      const feat = S.feat.filter((id) => P.top.includes(id) && NC.ITEMS[id].slot === 'robe');
      const robes = P.top.filter((id) => NC.ITEMS[id].slot === 'robe'); // (the pool's tops hold glasses too: a costume is a robe)
      for (let i = 0; feat.length < 3 && i < robes.length * 2; i++) { const id = robes[(n * 5 + i * 7) % robes.length]; if (!feat.includes(id)) feat.push(id); }
      return { n, name: n <= SEASONS.length ? S.name : ['ฤดูกาล', 'ที่ ' + n], feat, P };
    }
    const hatOf = (robe) => { const h = robe.replace(/^robe_/, 'hat_'); return NC.ITEMS[h] && NC.itemReady(h) ? h : null; };

    let gtab = 'gacha', last = null, msg = null, raf = 0;
    const ICON = { coins: () => NC.matIcon('ic_coin'), tokens: () => H.icon('ic_seasontoken'), feather: () => H.icon('ic_feather'), gems: () => H.icon('ic_moongem') };
    const kindOfRow = (name, i) => (/ชุด/.test(name) ? 'top' : /หมวก/.test(name) ? 'hat' : /เหรียญ/.test(name) ? 'coins' : /ตรา/.test(name) ? 'tokens' : /ขนนก/.test(name) ? 'feather' : ['top', 'hat', 'coins', 'tokens', 'feather'][i]);
    // an icon cell: a canvas for an item (filled after the html is in), an image for the rest
    const iconCell = (kind, id) => (id ? `<canvas width="72" height="72" data-p3icon="${id}"></canvas>` : ICON[kind] ? `<img src="${ICON[kind]()}" alt="">` : '<span class="q">?</span>');

    TG.render = function (el, game) {
      const box = drawBase(baseRender.bind(this), game), p = game.player, st = NC.Gacha.state, S = season();
      const tabs = [...box.querySelectorAll('[data-gt]')].map((b) => [b.dataset.gt, txt(b)]);
      const bal = txt(box.querySelector('.bb-h small'));
      let h = tabsHtml(tabs, 'gt', gtab, esc(bal)) + msgBox(msg);
      msg = null;
      if (gtab === 'gacha') {
        const pulls = [...box.querySelectorAll('[data-pull]')].map((b) => [Number(b.dataset.pull), txt(b)]);
        const cost = (n) => (n === 10 ? 1350 : 150 * n);
        h += `<div class="p3g-banner" style="background-image:url(${ART}banner.jpg)">` +
          `<canvas class="p3g-heroes" title="${esc(S.feat.map((id) => NC.ITEMS[id].name).join(' · '))}"></canvas>` +
          `<div class="p3g-title"><small>ฤดูกาลที่ ${S.n} · ชุดเด่น</small><b>${esc(S.name[0])}<br>${esc(S.name[1])}</b></div>` +
          `<img class="p3g-machine" src="${ART}machine.png" alt="">` +
          `<div class="p3g-pulls">${pulls.map(([n, t]) => st.gems >= cost(n) ? `<button class="kw-btn gold" data-pull="${n}">${esc(t)}</button>` :
            `<button class="kw-btn gold p3k-soft" data-why="${esc(`เพชรจันทร์ไม่พอ: มี ${st.gems.toLocaleString()} ต้องใช้ ${cost(n).toLocaleString()} · หาเพิ่มได้จากแท็บ <b>เพชรจันทร์</b> (แลกตราฤดูกาล) และพาสฤดูกาล`)}" data-whygo="shop">${esc(t)}</button>`).join('')}</div></div>`;
        const tickets = box.querySelector('.bb-ticket');
        if (tickets) h += `<div class="p3g-tickets kw-card">${tickets.innerHTML}</div>`;
        const T = readTiles(box);
        h += tilesHtml(T.map((t, i) => i === 1 && st.stars >= 120 ? [t[0], t[1], 'ready'] : t));
        if (last && last.length) h += `<div class="p3g-got kw-card"><b>ได้จากตู้</b><div class="p3g-gotlist">${last.map((r) =>
          `<span class="p3g-chip ${r.kind === 'top' ? 'top' : r.kind === 'hat' ? 'hat' : ''}">${iconCell(r.kind, r.id)}<em>${esc(r.text)}</em></span>`).join('')}</div></div>`;
        const rows = [...box.querySelectorAll('.bb-table tr')].filter((tr) => tr.querySelector('td')).map((tr) => [...tr.querySelectorAll('td')].map(txt));
        h += `<div class="p3k-table"><div class="p3k-th">ตารางรางวัล</div>${rows.map(([name, rate], i) => {
          const k = kindOfRow(name, i), id = k === 'top' ? S.feat[1] || S.feat[0] : k === 'hat' ? hatOf(S.feat[2] || S.feat[0]) || hatOf(S.feat[0]) : null;
          return `<div class="p3k-tr"><span class="ic">${iconCell(k, id)}</span><span class="n">${esc(name)}</span><span class="r">${esc(rate)}</span></div>`; }).join('')}</div>`;
        const note = txt(box.querySelector('.bb-note'));
        if (note) h += `<div class="p3k-note">${esc(note)}</div>`;
        el.innerHTML = `<div class="p3k p3g">${h}<div class="p3g-spark"></div></div>`;
        // the gacha stars' exchange (120 stars): the old grid and its button, moved over as they are (their icons drawn)
        const sp = [...box.querySelectorAll('.bb-h2')].find((x) => /แลก/.test(x.textContent));
        if (sp) { const into = el.querySelector('.p3g-spark'); let n = sp; while (n) { const nx = n.nextElementSibling; into.appendChild(n); n = nx; } }
        heroes(el, S);
      } else {
        const why = (b) => {
          if (b.dataset.passget) return 'ยังไม่มีรางวัลรอรับ · เลเวลพาสมาจากตราฤดูกาลที่ได้ (เควสรายวัน หีบประจำสัปดาห์ บอสโลก)';
          if (b.dataset.tok) return `ตราฤดูกาลไม่พอ: มี ${NC.Quests ? NC.Quests.tokens() : 0} ต้องใช้ 100 · ได้จากเควสรายวัน หีบประจำสัปดาห์ และบอสโลก`;
          return 'ยังไม่เปิด: การเติมเงินต้องมีระบบชำระเงินของเกมก่อน · ตอนนี้เพชรจันทร์ได้จากการเล่น (แลกตราฤดูกาล · พาสฤดูกาล)';
        };
        restyle(box, why);
        for (const x of box.querySelectorAll('.bb-h, .bb-chips')) x.remove();
        // the pass's table: its rows' ticks as tags; the headers of the shop as navy bars
        const tiles = box.querySelector('.bb-tiles');
        if (tiles) tiles.outerHTML = tilesHtml(readTiles(box));
        el.innerHTML = `<div class="p3k p3g p3k-base">${h}</div>`;
        const root = el.firstElementChild;
        while (box.firstChild) root.appendChild(box.firstChild);
      }
      for (const cv of el.querySelectorAll('canvas[data-p3icon]')) { const id = cv.dataset.p3icon; if (NC.ITEMS[id]) cv.getContext('2d').drawImage(NC.itemIcon(id, 72), 0, 0); }
    };

    TG.click = function (e, game) {
      const w = e.target.closest('[data-why]');
      if (w) { msg = w.dataset.why; if (w.dataset.whygo) msg += ` <button class="kw-btn blue p3k-go" data-gt="${w.dataset.whygo}">ไปหน้าเพชรจันทร์</button>`; return true; }
      const t = e.target.closest('[data-gt]');
      if (t) { gtab = t.dataset.gt; last = null; }
      const st = NC.Gacha.state, before = st.pulls;
      const r = baseClick.call(this, e, game);
      if (st.pulls > before) last = st.log.slice(0, st.pulls - before);
      return r || !!t;
    };

    // the three heroes on the banner, breathing: drawn while the page is on screen
    function heroes(el, S) {
      if (raf) cancelAnimationFrame(raf);
      const cv = el.querySelector('.p3g-heroes'), t0 = performance.now();
      if (!cv) return;
      const looks = S.feat.slice(0, 3).map((robe) => {
        const p = G().player, base = NC.lookEquip ? NC.lookEquip(p.equip) : p.equip;
        return Object.assign({}, base, { robe, hat: hatOf(robe) || null, cape: null, glasses: null });
      });
      const frame = () => {
        raf = 0;
        if (!cv.isConnected || !H.isOpen()) return;
        const r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
        if (r.width < 2) { raf = requestAnimationFrame(frame); return; }
        const W = Math.round(r.width * dpr), Hh = Math.round(r.height * dpr);
        if (cv.width !== W || cv.height !== Hh) { cv.width = W; cv.height = Hh; }
        const c = cv.getContext('2d'), mob = document.documentElement.classList.contains('mob-port');
        c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, W, Hh);
        // (sizes from the banner's height: the mockup's heroes stand ~82% of it; on a phone the banner is taller)
        const k = (Hh * (mob ? 0.0041 : 0.0062)), gy = Hh * (mob ? 0.8 : 0.93), t = (performance.now() - t0) / 1000;
        const xs = mob ? [0.21, 0.43, 0.645] : [0.35, 0.505, 0.66];
        looks.forEach((eq, i) => {
          const x = W * xs[i], ac = NC.animCtx ? NC.animCtx(eq) : undefined;
          c.fillStyle = 'rgba(10,12,30,0.35)';
          c.beginPath(); c.ellipse(x, gy, 34 * k, 8 * k, 0, 0, Math.PI * 2); c.fill();
          try {
            // (the hero rig's idle, js/herospine.js; one spring state per hero)
            if (NC.HeroSpine && NC.HeroSpine.preview && NC.HeroSpine.preview(c, eq, x, gy, k, { t: t + i * 0.8, face: i === 2 ? -1 : 1, noWeapon: true, key: 'gacha' + i })) return;
            const P = NC.Anim.sample('idle', t + i * 0.8, ac);
            P.face = i === 2 ? -1 : 1;
            NC.drawHero(c, eq, P, x, gy, { scale: k, noWeapon: true });
          } catch (err) { /* an item still loading */ }
        });
        raf = requestAnimationFrame(frame);
      };
      frame();
    }
  }

  // ============================================================ ท้ายเกม ============================================================
  const TE = H.tab('endgame');
  if (TE) {
    const baseRender = TE.render, baseClick = TE.click;
    // where each constellation sits in the sky (% of the sky's star field), and the thin lines between them
    const POS = { atk: [31, 19], guard: [72, 20], swift: [17, 64], arcane: [52, 68], wander: [85, 64] };
    const MIDS = { m1: [53, 33], m2: [53.5, 51], m3: [36, 69], m4: [68.5, 71] };
    const LINES = [['atk', 'swift'], ['atk', 'm1'], ['m1', 'guard'], ['guard', 'wander'], ['wander', 'm4'], ['m4', 'arcane'], ['arcane', 'm3'], ['m3', 'swift'], ['m1', 'm2'], ['m2', 'arcane']];
    const NAME_GOLD = { atk: 1, wander: 1 };
    let etab = 'stars', pick = 'atk', msg = null, sure = false;

    TE.render = function (el, game) {
      const box = drawBase(baseRender.bind(this), game), p = game.player, S = NC.Season.state;
      const tabs = [...box.querySelectorAll('[data-et]')].map((b) => [b.dataset.et, txt(b)]);
      const right = txt(box.querySelector('.bb-h small'));
      let h = tabsHtml(tabs, 'et', etab, esc(right)) + msgBox(msg);
      msg = null;
      if (etab === 'stars') {
        const T = readTiles(box), free = num(T[0] && T[0][0]), pts = num(T[1] && T[1][0]), cap = num(T[1] && T[1][1]);
        const stars = [...box.querySelectorAll('[data-star]')].map((b) => {
          const row = b.closest('.bb-row'), name = txt(row.querySelector('.t b')).split('·')[0].trim(), what = txt(row.querySelector('.t small'));
          return { k: b.dataset.star, name, what, rank: S.stars[b.dataset.star] || 0 };
        });
        if (!stars.some((s) => s.k === pick) && stars[0]) pick = stars[0].k;
        const lv99 = p.lv >= NC.LV_MAX;
        const noPts = !lv99 ? `ยังไม่มีแต้มดาว: แต้มดาวได้จาก EXP เมื่อถึง Lv ${NC.LV_MAX} (ตอนนี้ Lv ${p.lv})` :
          pts >= cap ? `ลงครบ ${cap} แต้มของฤดูกาลนี้แล้ว · ฤดูกาลหน้าลงได้มากขึ้น` : 'ยังไม่มีแต้มดาวว่าง · เก็บ EXP ต่อจนได้แต้มถัดไป (ดูช่อง "ไปแต้มถัดไป")';
        const plus = (k, cls) => (free > 0 ? `<button class="kw-btn blue ${cls}" data-star="${k}">+1</button>` : `<button class="kw-btn blue p3k-soft ${cls}" data-why="${esc(noPts)}">+1</button>`);
        const rule = txt(box.querySelector('.bb-sub'));
        const icon = (k) => `${ART}star_${k}.png`;
        const now = (s) => { const m = /([+−-])\s*(\d+(?:\.\d+)?)\s*%/.exec(s.what); return m ? `${m[1]}${+(m[2] * s.rank).toFixed(1)}%` : ''; };
        const P = stars.find((s) => s.k === pick);
        const at = (id) => POS[id] || MIDS[id];
        h += `<div class="p3e-rule">${esc(rule)}</div>` + tilesHtml(tagged(T)) +
          `<div class="p3e-sky"><div class="p3e-field"><svg class="p3e-lines" viewBox="0 0 100 100" preserveAspectRatio="none">` +
          LINES.filter(([a, b]) => at(a) && at(b)).map(([a, b]) => `<line x1="${at(a)[0]}" y1="${at(a)[1]}" x2="${at(b)[0]}" y2="${at(b)[1]}"/>`).join('') + '</svg>' +
          Object.entries(MIDS).map(([, [x, y]]) => `<i class="p3e-dot" style="left:${x}%;top:${y}%"></i>`).join('') +
          stars.map((s) => `<button class="p3e-star ${s.k === pick ? 'on' : ''}" data-pick="${s.k}" style="left:${(POS[s.k] || [50, 50])[0]}%;top:${(POS[s.k] || [50, 50])[1]}%">` +
            `<img src="${icon(s.k)}" alt=""><b class="${NAME_GOLD[s.k] && s.k === pick ? 'gold' : ''}">${esc(s.name)}</b><small>ระดับ ${s.rank}</small></button>`).join('') + '</div>' +
          (P ? `<div class="p3e-card"><img src="${icon(P.k)}" alt=""><b>${esc(P.name)}</b><span class="rk">ระดับ ${P.rank}</span><hr>` +
            `<span class="wh">${esc(P.what)}</span><span class="nw">ตอนนี้ ${esc(now(P) || '—')}</span>${plus(P.k, 'big')}</div>` : '') + '</div>' +
          `<div class="p3e-cards">${stars.map((s) => `<div class="p3e-mini ${s.k === pick ? 'on' : ''}" data-pick="${s.k}"><img src="${icon(s.k)}" alt="">` +
            `<div class="t"><b>${esc(s.name)}</b><small>${esc(s.what)}</small></div>${plus(s.k, '')}</div>`).join('')}</div>`;
        const rb = box.querySelector('[data-reset]');
        if (rb) {
          const label = txt(rb), can = S.spent > 0;
          h += `<div class="p3e-foot">${!can ? `<button class="kw-btn grey p3k-soft" data-why="ยังไม่ได้ลงแต้มดาว ไม่มีอะไรให้คืน">${esc(label)}</button>` :
            sure ? `<button class="kw-btn red" data-reset="1">ยืนยันคืนแต้มทั้งหมด · ${esc(label.replace(/^[^(]*\(|\)$/g, ''))}</button><button class="kw-btn grey" data-nosure="1">ยกเลิก</button>` :
              `<button class="kw-btn grey" data-sure="1">${esc(label)}</button>`}</div>`;
        }
        el.innerHTML = `<div class="p3k p3e">${h}</div>`;
      } else {
        const why = (b) => (b.dataset.tower ? `หอดาวร่วงเปิดให้ Lv 90 ขึ้นไป (ตอนนี้ Lv ${p.lv}) · เก็บเลเวลต่อในแมพสนามแล้วกลับมาใหม่` : 'ยังกดไม่ได้ตอนนี้');
        restyle(box, why);
        for (const x of box.querySelectorAll('.bb-h, .bb-chips')) x.remove();
        const sub = box.querySelector('.bb-sub');
        if (sub) sub.className = 'p3e-rule';
        const tiles = box.querySelector('.bb-tiles');
        if (tiles) tiles.outerHTML = tilesHtml(tagged(readTiles(box)));
        // the tower's start buttons in a night-sky panel like the stars' (the page's look)
        const form = box.querySelector('.bb-form');
        if (etab === 'tower' && form) {
          const panel = document.createElement('div');
          panel.className = 'p3e-sky p3e-tbox';
          panel.innerHTML = '<b>เลือกชั้นที่จะเริ่ม</b><small>ผ่านทุก 10 ชั้นแล้วเริ่มจากชั้นถัดไปได้ · ผ่านชั้นครั้งแรกของสัปดาห์ได้เหรียญ</small>';
          form.replaceWith(panel); panel.appendChild(form);
          const note = box.querySelector('.bb-note'); if (note) panel.appendChild(note);
        }
        el.innerHTML = `<div class="p3k p3e p3k-base p3e-${etab}">${h}</div>`;
        const root = el.firstElementChild;
        while (box.firstChild) root.appendChild(box.firstChild);
      }
    };

    TE.click = function (e, game) {
      const w = e.target.closest('[data-why]');
      if (w) { msg = w.dataset.why; return true; }
      const pk = e.target.closest('[data-pick]');
      if (pk && !e.target.closest('button[data-star], [data-why]')) { pick = pk.dataset.pick; return true; }
      if (e.target.closest('[data-sure]')) { sure = true; return true; }
      if (e.target.closest('[data-nosure]')) { sure = false; return true; }
      const t = e.target.closest('[data-et]');
      if (t) { etab = t.dataset.et; sure = false; }
      const S = NC.Season.state, spent = S.spent, rs = e.target.closest('[data-reset]');
      const st = e.target.closest('[data-star]');
      if (st) pick = st.dataset.star;
      const r = baseClick.call(this, e, game);
      if (rs) { sure = false; if (S.spent === spent && spent > 0) msg = `เหรียญไม่พอ: คืนแต้มดาวใช้ 100,000 เหรียญ (มี ${NC.fmtCoins(game.player.coins || 0)})`; return true; }
      return r || !!t || !!st;
    };
  }
})();
