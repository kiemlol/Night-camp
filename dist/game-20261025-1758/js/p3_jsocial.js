/* p3_jsocial.js — the journal's ลูกไฟนำทาง (warp) and เพื่อน (friends) pages, built from the picked mockups (UI audit round 3,
   2026-10-17; assets/gen/nightcamp_p3_jwarp_a_raw.png, nightcamp_p3_jfriends_a_raw.png).
     ลูกไฟนำทาง (J → ลูกไฟนำทาง, js/economy.js)  a painted night strip (assets/p3/jsocial/strip.jpg, Codex: p3art_jsocial_strip)
                with the game's painted campfire (assets/kui/ic_pfire.png) on its six clearings: the camp, the pumpkin farm,
                the moonlit meadow, the glowing mushroom woods, the burnt forest and the red canyon (lit = been there, dim with a
                padlock = not yet; a click picks that place's row). Under it the fires as big rows: the map I am on pinned on top,
                the camp next, then every region (the maps' `area`, a dungeon by its parent chain) sorted by level: the lit
                fires with their level, price and วาร์ป; a region not reached yet is one grey row with a padlock (a click opens
                its places); the places not lit in a reached region fold under "ยังไม่ได้จุดไฟอีก N แห่ง". A grey place that a
                road reaches gets เดินไป (NC.Travel, like the monster book). The price is economy.js's own sum (200 + 30 a level,
                a set's discount / free warps) and วาร์ป goes through economy.js's own click (NC.Econ.warp), so nothing differs.
     เพื่อน (J → เพื่อน, js/social.js)   the party flag (social.js's own click: its save), then three columns of people as cards with
                a round portrait drawn live from their look (net.js's presence: r.equip, like the party window): กำลังหาปาร์ตี้
                (ชวน = NC.PartyNet.invite, the party window's answers), เพื่อน (ไปหาเพื่อน = the guiding flame / ลบ; an offline
                friend greyed, with the look and level last seen: kept here in nightcamp.p3social.v1) and ออนไลน์ตอนนี้
                (เพิ่มเพื่อน); each column has its own empty state (an offline game says how to play online). The whisper strip
                opens the chat with /w, or the party window (P). The page redraws itself while open when someone comes, goes or
                moves (a 1 s check of what it shows).
   Art: assets/p3/jsocial/. Wraps NC.Hub.tab('warp') / ('friends') render + click. css/p3_jsocial.css */
(function () {
  'use strict';
  const NC = window.NC, H = NC.Hub;
  if (!H || !H.tab) return;
  const esc = H.esc, G = () => NC.game;
  const ART = 'assets/p3/jsocial/';
  const FIRE = 'assets/kui/ic_pfire.png', LOCK = 'assets/inv/inv_lock.png';
  const coin = () => (NC.matIcon ? NC.matIcon('ic_coin') : '');
  const num = (n) => Math.round(n || 0).toLocaleString('en-US');
  const isPort = () => document.documentElement.classList.contains('mob-port');
  const toast = (g, t) => { if (g && g.toast) g.toast(t); };
  const MAPS = () => NC.MAPS || {};
  const mapName = (id) => (MAPS()[id] && MAPS()[id].name) || id || '';

  // =====================================================================================================================
  // ลูกไฟนำทาง
  // =====================================================================================================================
  const TW = H.tab('warp');
  if (TW && NC.Econ) {
    const baseClick = TW.click;
    const dayNo = () => { const d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };
    // (economy.js's own numbers: the map's first level, 200 + 30 a level, a set's discount and free warps)
    const mapLv = (id) => { const m = /Lv\s*(\d+)/.exec((MAPS()[id] || {}).lvText || ''); return m ? Number(m[1]) : 1; };
    const mapHi = (id) => { const m = /Lv\s*(\d+)(?:\s*[–-]\s*(\d+))?/.exec((MAPS()[id] || {}).lvText || ''); return m ? Number(m[2] || m[1]) : 1; };
    const freeLeft = (p) => {
      const st = NC.Econ.state, free = NC.setWarpFree ? NC.setWarpFree(p) : 0;
      return Math.max(0, free - (st.warpDay === dayNo() ? st.warpsUsed || 0 : 0));
    };
    const cost = (p, id) => {
      if (freeLeft(p) > 0) return 0;
      const off = (NC.setWarpOff ? NC.setWarpOff(p) : 0) + (NC.Card && NC.Card.active && NC.Card.active() ? 30 : 0);
      return Math.round((200 + 30 * mapLv(id)) * (1 - Math.min(80, off) / 100));
    };
    const hasLv = (id) => /Lv\s*\d/.test((MAPS()[id] || {}).lvText || '');
    const lit = (id) => !!(NC.Econ.state.visited || {})[id];
    const isSafe = (id) => id === 'camp' || !!(MAPS()[id] && MAPS()[id].lifeSafe && !MAPS()[id].pvp && !MAPS()[id].gwar);
    const regionOf = (id) => {
      let m = MAPS()[id], n = 0;
      while (m && !m.area && m.parent && n++ < 16) m = MAPS()[m.parent];
      return m && m.area && MAPS()[m.area] ? m.area : '';
    };
    // the six clearings of the painted strip, left to right (x, y in % of the picture)
    const SPOTS = [['camp', 9.1], ['farm', 25.7], ['meadow', 42.6], ['woods', 58.6], ['burnt', 75.2], ['canyon', 90.8]];
    const SPOT_Y = 87.5;
    const ws = { sel: null, more: {}, scroll: false, flash: 0 };

    function model() {
      const groups = new Map(), other = [];
      for (const id of Object.keys(MAPS())) {
        if (id === 'camp') continue;
        const a = regionOf(id);
        if (!a) { if (lit(id)) other.push(id); continue; }
        if (!groups.has(a)) groups.set(a, []);
        groups.get(a).push(id);
      }
      const byLv = (x, y) => mapLv(x) - mapLv(y) || mapHi(x) - mapHi(y) || mapName(x).localeCompare(mapName(y), 'th');
      const regions = [...groups.entries()].map(([a, ids]) => {
        ids.sort((x, y) => (x === a ? -1 : y === a ? 1 : byLv(x, y)));
        const lo = Math.min(...ids.map(mapLv)), hi = Math.max(...ids.map(mapHi));
        return { id: a, name: mapName(a), ids, lo, hi, lit: ids.filter(lit) };
      }).sort((x, y) => x.lo - y.lo || x.hi - y.hi);
      return { regions, other: other.sort(byLv) };
    }

    // one fire as a row: lit (level, price, วาร์ป), here (the pinned one), or not lit yet (grey, padlock, เดินไป)
    function litRow(id, game, here) {
      const p = game.player, c = cost(p, id), M = MAPS()[id] || {}, poor = (p.coins || 0) < c;
      const extra = /·\s*(.+)$/.exec(M.lvText || '');
      return `<div class="p3w-row${here ? ' here' : ''}${ws.sel === id ? ' sel' : ''}${ws.sel === id && ws.flash ? ' flash' : ''}" data-wsel="${esc(id)}">` +
        `<img class="p3w-f" src="${FIRE}" alt="">` +
        `<div class="p3w-nm"><b>${esc(M.name || id)}</b>${isSafe(id) ? ' <span>(ปลอดภัย)</span>' : ''}${!here && extra ? ` <em>· ${esc(extra[1])}</em>` : ''}</div>` +
        (here ? '<div class="p3w-meta"></div>' : `<div class="p3w-meta"><span class="p3w-lv" title="เลเวลของที่นี่">${hasLv(id) ? mapLv(id) : '–'}</span><i class="p3w-sep"></i>` +
          `<span class="p3w-pr${poor ? ' poor' : ''}">${c ? `<img src="${coin()}" alt="">${num(c)}` : '<b class="free">ฟรี</b>'}</span></div>`) +
        (here ? '<span class="p3w-here">อยู่ที่นี่</span>' : `<button class="kw-btn gold p3w-go${poor ? ' poor' : ''}" data-warp="${esc(id)}" data-cost="${c}">วาร์ป</button>`) + '</div>';
    }
    function lockRow(id, game) {
      const M = MAPS()[id] || {};
      let walk = false;
      try { walk = !!(NC.Travel && NC.Travel.go && NC.MapRoute && (NC.MapRoute.pathTo(game.mapId, id) || []).length); } catch (e) { walk = false; }
      return `<div class="p3w-row off${ws.sel === id ? ' sel' : ''}${ws.sel === id && ws.flash ? ' flash' : ''}" data-wsel="${esc(id)}" data-wlock="${esc(id)}">` +
        `<img class="p3w-f" src="${FIRE}" alt="">` +
        `<div class="p3w-nm"><b>${esc(M.name || id)}</b> <span>(ยังไม่ได้จุดไฟ)</span></div>` +
        `<div class="p3w-meta"><span class="p3w-lv">${hasLv(id) ? mapLv(id) : '–'}</span><i class="p3w-sep"></i><span class="p3w-pr"></span></div>` +
        (walk ? `<button class="kw-btn blue p3w-go p3w-walk" data-wwalk="${esc(id)}" title="เดินไปจุดไฟที่${esc(M.name || id)}">เดินไป</button>` : `<span class="p3w-lock"><img src="${LOCK}" alt=""></span>`) + '</div>';
    }
    function regionLockRow(R) {
      const open = !!ws.more[R.id];
      return `<button class="p3w-row off reg${open ? ' open' : ''}${ws.sel === R.id ? ' sel' : ''}${ws.sel === R.id && ws.flash ? ' flash' : ''}" data-wreg="${esc(R.id)}" data-wsel="${esc(R.id)}">` +
        `<img class="p3w-f" src="${FIRE}" alt="">` +
        `<div class="p3w-nm"><b>${esc(R.name)}</b> <span>(ยังไม่ได้จุดไฟ · ${R.ids.length} แห่ง)</span></div>` +
        `<div class="p3w-meta"><span class="p3w-lv">${R.lo}</span><i class="p3w-sep"></i><span class="p3w-pr"><small>${open ? 'ซ่อน ▴' : 'ดูที่ในย่านนี้ ▾'}</small></span></div>` +
        `<span class="p3w-lock"><img src="${LOCK}" alt=""></span></button>`;
    }

    function renderWarp(el, game) {
      const p = game.player, old = el.querySelector('.p3w-list'), top = old ? old.scrollTop : 0;
      const W = model(), here = game.mapId, fl = freeLeft(p);
      let h = '<div class="p3w">' +
        `<div class="p3w-head"><div class="p3w-ht"><h2>ลูกไฟนำทาง</h2><p>วาร์ปไปกองไฟที่เคยจุดไว้ได้ทุกที่ · 200 + 30 เหรียญต่อเลเวลของที่นั้น${fl ? ` · <b>วาร์ปฟรีวันนี้เหลือ ${fl} ครั้ง</b> (เซ็ต)` : ''}</p></div>` +
        `<div class="p3w-coins" title="เหรียญที่มี"><img src="${coin()}" alt=""><b>${num(p.coins)}</b></div></div>`;
      // the strip
      h += '<div class="p3w-rim"><div class="p3w-strip-sc"><div class="p3w-strip">' + `<img class="p3w-bg" src="${ART}strip.jpg" alt="" draggable="false">` +
        SPOTS.map(([id, x]) => {
          if (!MAPS()[id]) return '';
          const on = id === 'camp' || lit(id), sel = ws.sel === id || ws.sel === regionOf(id), me = here === id;
          return `<button class="p3w-mk${on ? '' : ' off'}${sel ? ' sel' : ''}${me ? ' me' : ''}" data-wmk="${id}" style="left:${x}%;top:${SPOT_Y}%" ` +
            `title="${esc(mapName(id))}${me ? ' · อยู่ที่นี่' : on ? '' : ' · ยังไม่ได้จุดไฟ'}" aria-label="${esc(mapName(id))}">` +
            `<img class="f" src="${FIRE}" alt="" draggable="false">${on ? '' : `<img class="l" src="${LOCK}" alt="" draggable="false">`}${me ? '<i class="pin"></i>' : ''}</button>`;
        }).join('') + '</div></div></div>';
      // the list
      h += '<div class="p3w-list kw-scroll">';
      h += litRow(here, game, true);
      if (here !== 'camp' && MAPS().camp) h += litRow('camp', game, false);
      let shownLock = 0;
      for (const R of W.regions) {
        const rest = R.ids.filter((id) => !lit(id) && id !== here), mine = R.lit.filter((id) => id !== here);
        if (!R.lit.length && R.id !== regionOf(here)) {
          h += regionLockRow(R); shownLock++;
          if (ws.more[R.id]) h += '<div class="p3w-sub">' + R.ids.map((id) => lockRow(id, game)).join('') + '</div>';
          continue;
        }
        h += `<div class="p3w-gh"><b>${esc(R.name)}</b><span>Lv ${R.lo}–${R.hi} · จุดไฟแล้ว ${R.lit.length}/${R.ids.length}</span></div>`;
        h += mine.map((id) => litRow(id, game, false)).join('');
        if (rest.length) {
          const open = !!ws.more[R.id];
          h += `<button class="p3w-more${open ? ' open' : ''}" data-wmore="${esc(R.id)}"><img src="${LOCK}" alt="">ยังไม่ได้จุดไฟอีก ${rest.length} แห่งในย่านนี้ <span>${open ? 'ซ่อน ▴' : 'ดู ▾'}</span></button>`;
          if (open) h += '<div class="p3w-sub">' + rest.map((id) => lockRow(id, game)).join('') + '</div>';
        }
      }
      const others = W.other.filter((id) => id !== here);
      if (others.length) h += '<div class="p3w-gh"><b>ที่อื่น ๆ</b><span>ฟาร์ม ลานประลอง หอคอย และที่พิเศษที่เคยไป</span></div>' + others.map((id) => litRow(id, game, false)).join('');
      h += `<div class="p3w-note">เดินไปถึงที่ไหนสักครั้ง กองไฟที่นั่นจะติดเอง แล้ววาร์ปกลับมาได้จากหน้านี้${shownLock ? ' · กดแถวสีเทาเพื่อดูที่ในย่านนั้น' : ''}</div>`;
      h += '</div></div>';
      el.innerHTML = h;
      const list = el.querySelector('.p3w-list');
      if (list) {
        list.scrollTop = top;
        if (ws.scroll) {
          ws.scroll = false;
          const row = list.querySelector(`[data-wsel="${CSS.escape(ws.sel || '')}"]`);
          if (row) {
            if (isPort()) row.scrollIntoView({ block: 'center' });
            else list.scrollTop = Math.max(0, row.offsetTop - list.offsetTop - (list.clientHeight - row.offsetHeight) / 2);
          }
        }
      }
      if (ws.flash) { clearTimeout(ws.flash); ws.flash = setTimeout(() => { ws.flash = 0; const r = document.querySelector('#hb-page .p3w-row.flash'); if (r) r.classList.remove('flash'); }, 1300); }
    }

    function walkTo(game, id) {
      if (!game || !NC.Travel || !NC.Travel.go) return;
      NC.HUD.panel('journal', false); game.paused = false;
      NC.Travel.go(game, { map: id, x: 0, y: 0, r: 1e9, name: mapName(id), done: (g) => toast(g || G(), `ถึง${mapName(id)}แล้ว · กองไฟที่นี่ติดแล้ว`) });
      toast(game, `กำลังเดินไป${mapName(id)} · เดินเองเพื่อหยุด`);
    }

    TW.render = renderWarp;
    TW.click = function (e, game) {
      const g = game || G();
      if (!g || !g.player) return false;
      const go = e.target.closest('[data-warp]');
      if (go) {
        const id = go.dataset.warp, c = Number(go.dataset.cost) || 0;
        if (g.player.dead > 0) { toast(g, 'ฟื้นก่อน แล้วค่อยใช้ลูกไฟนำทาง'); return false; }
        if ((g.player.coins || 0) < c) { toast(g, `เหรียญไม่พอ · ต้องใช้ ${num(c)} มี ${num(g.player.coins)}`); return false; }
        return baseClick ? baseClick.call(this, e, g) : false; // (economy.js: pays, closes the journal, NC.Maps.go)
      }
      const wk = e.target.closest('[data-wwalk]');
      if (wk) { walkTo(g, wk.dataset.wwalk); return false; }
      const mk = e.target.closest('[data-wmk]');
      if (mk) {
        const id = mk.dataset.wmk, R = regionOf(id), reached = id === 'camp' || g.mapId === id || lit(id);
        if (reached) ws.sel = id;
        else if (R && !model().regions.find((x) => x.id === R).lit.length) { ws.sel = R; ws.more[R] = true; toast(g, `ยังไม่ได้จุดไฟที่${mapName(id)} · เดินไปถึงสักครั้ง กองไฟจะติดเอง`); }
        else { ws.sel = id; if (R) ws.more[R] = true; toast(g, `ยังไม่ได้จุดไฟที่${mapName(id)} · เดินไปถึงสักครั้ง กองไฟจะติดเอง`); }
        ws.scroll = true; ws.flash = 1;
        return true;
      }
      const rg = e.target.closest('[data-wreg]');
      if (rg) { const id = rg.dataset.wreg; ws.more[id] = !ws.more[id]; ws.sel = id; return true; }
      const mo = e.target.closest('[data-wmore]');
      if (mo) { const id = mo.dataset.wmore; ws.more[id] = !ws.more[id]; return true; }
      const lk = e.target.closest('[data-wlock]');
      if (lk) { ws.sel = lk.dataset.wlock; toast(g, `ยังไม่ได้จุดไฟที่${mapName(lk.dataset.wlock)} · เดินไปถึงสักครั้ง กองไฟจะติดเอง`); return true; }
      const s = e.target.closest('[data-wsel]');
      if (s) { ws.sel = s.dataset.wsel === ws.sel ? null : s.dataset.wsel; return true; }
      return false;
    };
    TW.p3 = { model, cost, regionOf, state: ws }; // (tests)
  }

  // =====================================================================================================================
  // เพื่อน
  // =====================================================================================================================
  const TF = H.tab('friends');
  if (TF && NC.Social) {
    const baseClick = TF.click;
    const S = () => NC.Social.state;
    const net = () => NC.Net;
    const online = () => !!(net() && net().room);
    const people = () => (net() && net().remotes ? [...net().remotes.values()].filter((r) => r.named) : []);
    const jobName = (j) => ((NC.JOBS || {})[j] || {}).name || '';

    // what I last saw of my friends (their look, level, job, place), for their card while they are away
    const SKEY = 'nightcamp.p3social.v1';
    let seen = {};
    try { if (!NC.ONLINE) { const o = JSON.parse(localStorage.getItem(SKEY) || 'null'); if (o && o.seen) seen = o.seen; } } catch (e) { /* blocked */ }
    const canSave = () => !NC.ONLINE && !(G() && G().noSave);
    function remember() {
      const fr = S().friends || [];
      if (!fr.length) return;
      let ch = false;
      for (const r of people()) {
        if (!fr.includes(r.name)) continue;
        const o = seen[r.name], eq = r.equip ? Object.assign({}, r.equip) : null;
        const v = { lv: r.lv, job: r.job, map: r.map, eq, t: o && o.lv === r.lv && o.map === r.map && JSON.stringify(o.eq) === JSON.stringify(eq) ? o.t : Date.now() };
        if (!o || o.t !== v.t) { seen[r.name] = v; ch = true; }
      }
      for (const n of Object.keys(seen)) if (!fr.includes(n)) { delete seen[n]; ch = true; }
      if (ch && canSave()) try { localStorage.setItem(SKEY, JSON.stringify({ seen })); } catch (e) { /* blocked */ }
    }
    const ago = (t) => {
      const m = Math.floor((Date.now() - t) / 60000);
      return m < 1 ? 'เมื่อสักครู่' : m < 60 ? `${m} นาทีก่อน` : m < 1440 ? `${Math.floor(m / 60)} ชั่วโมงก่อน` : `${Math.floor(m / 1440)} วันก่อน`;
    };

    // a round portrait: the head drawn live from the look (like partywin.js), or a plain "?" token
    const pt = (key, eq, cls) => (eq ? `<span class="p3f-pt${cls ? ' ' + cls : ''}"><canvas data-pt="${esc(key)}" width="128" height="128"></canvas></span>` : `<span class="p3f-pt q${cls ? ' ' + cls : ''}"><i>?</i></span>`);
    function drawFaces(el, looks) {
      for (const cv of el.querySelectorAll('canvas[data-pt]')) {
        const eq = looks[cv.dataset.pt];
        if (!eq || !NC.headSpot || !NC.drawAvatar) continue;
        const r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1, S2 = Math.max(48, Math.round(Math.max(r.width, r.height) * dpr)) || 128;
        cv.width = S2; cv.height = S2;
        const c = cv.getContext('2d');
        try {
          const hs = NC.headSpot(eq), k = (S2 * 0.78) / hs.w;
          NC.drawAvatar(c, eq, S2 / 2 - hs.x * k, S2 * 0.6 - hs.y * k, k, 1, { noWeapon: true, t: 0.3 });
        } catch (e) { console.warn('p3_jsocial: face', e); }
      }
    }
    const placeOf = (r, game) => (r.map === game.mapId ? 'แมพเดียวกับคุณ' : mapName(r.map));

    function inviteBtn(r) {
      const PN = NC.PartyNet;
      if (!PN) return '';
      if (PN.actionFor) {
        const a = PN.actionFor(r);
        return `<button class="kw-btn ${a.disabled ? 'grey' : 'blue'} p3f-b" data-inv="${esc(r.peer)}"${a.disabled ? ' disabled' : ''}${a.tip ? ` title="${esc(a.tip)}"` : ''}>${esc(a.label)}</button>`;
      }
      const R = PN.roster(), mine = R && R.mem.includes(r.peer), other = !mine && r.pt && r.pt[1] > 1, sent = PN.invited(r.peer);
      if (mine) return '<span class="p3f-tag in">ในปาร์ตี้คุณ</span>';
      if (other) return '<span class="p3f-tag">อยู่ปาร์ตี้อื่น</span>';
      if (sent) return '<span class="p3f-tag">รอเขาตอบ…</span>';
      return `<button class="kw-btn blue p3f-b" data-inv="${esc(r.peer)}">ชวนเข้าปาร์ตี้</button>`;
    }
    const empty = (icon, h, t) => `<div class="p3f-empty"><span class="p3f-eic"><img src="${icon}" alt=""></span><b>${h}</b><p>${t}</p></div>`;

    function renderFriends(el, game) {
      remember();
      const st = S(), on = people(), fr = st.friends || [], olds = {};
      for (const c of el.querySelectorAll('.p3f-cards')) olds[c.dataset.col] = c.scrollTop;
      const looks = {}, isOn = online();
      const pf = on.filter((r) => r.pf), others = on.filter((r) => !fr.includes(r.name));
      // the flag
      let h = '<div class="p3f">' +
        `<div class="p3f-h">เพื่อน · หาปาร์ตี้ · <span>${isOn ? `ออนไลน์ ${on.length} คน` : 'ยังไม่ได้ออนไลน์'}</span></div>` +
        `<div class="p3f-flag"><button class="kw-btn ${st.pf ? 'gold on' : 'blue'} p3f-pf" data-pf="1">${st.pf ? '✔ กำลังหาปาร์ตี้ (กดเพื่อยกเลิก)' : 'ขึ้นป้ายหาปาร์ตี้'}</button>` +
        `<span>${st.pf ? (isOn ? 'คนอื่นเห็นคุณในช่อง “กำลังหาปาร์ตี้” แล้ว รอเขาชวนได้เลย' : 'ป้ายขึ้นแล้ว · คนอื่นจะเห็นเมื่อคุณเล่นออนไลน์') : 'ขึ้นป้ายให้คนที่ออนไลน์รู้ว่าคุณอยากเข้าปาร์ตี้'}</span></div>` +
        '<div class="p3f-sub">คนที่หาปาร์ตี้ · เพื่อน · คนที่ออนไลน์อยู่ตอนนี้</div><div class="p3f-cols">';
      // column 1: looking for a party
      h += `<section class="p3f-col"><h3>กำลังหาปาร์ตี้ <small>${pf.length || ''}</small></h3><div class="p3f-cards kw-scroll" data-col="pf">`;
      h += pf.length ? pf.map((r) => {
        looks['p:' + r.peer] = r.equip;
        return `<div class="p3f-card">${pt('p:' + r.peer, r.equip)}<div class="p3f-in"><b>${esc(r.name)}</b><small>Lv ${r.lv} · ${esc(jobName(r.job))}</small><small class="pl">${esc(placeOf(r, game))}</small>${inviteBtn(r)}</div></div>`;
      }).join('') : isOn ? empty(FIRE, 'ยังไม่มีใครขึ้นป้าย', 'ขึ้นป้ายของคุณเองด้านบน คนที่ออนไลน์จะเห็นและชวนคุณได้')
        : empty(FIRE, 'เกมนี้ยังไม่ได้ออนไลน์', 'เปิดเกมจากลิงก์ออนไลน์ของเกม แล้วคนที่ขึ้นป้ายหาปาร์ตี้จะขึ้นที่นี่');
      h += '</div></section>';
      // column 2: friends
      const frOn = fr.filter((n) => on.some((x) => x.name === n)).length;
      h += `<section class="p3f-col"><h3>เพื่อน <small>${fr.length ? `ออนไลน์ ${frOn}/${fr.length}` : ''}</small></h3><div class="p3f-cards kw-scroll" data-col="fr">`;
      const order = fr.slice().sort((a, b) => (on.some((x) => x.name === b) ? 1 : 0) - (on.some((x) => x.name === a) ? 1 : 0));
      h += fr.length ? order.map((n) => {
        const r = on.find((x) => x.name === n);
        if (r) {
          looks['f:' + n] = r.equip;
          const go = r.map && r.map !== game.mapId && NC.Econ;
          return `<div class="p3f-card">${pt('f:' + n, r.equip)}<div class="p3f-in"><b title="ออนไลน์อยู่">${esc(n)} <i class="dot"></i></b><small>Lv ${r.lv} · ${esc(jobName(r.job))}</small><small class="pl">${esc(placeOf(r, game))}</small>` +
            `<div class="p3f-bs">${go ? `<button class="kw-btn gold p3f-b" data-go="${esc(r.map)}" title="วาร์ปไป${esc(mapName(r.map))} ด้วยลูกไฟนำทาง">ไปหาเพื่อน</button>` : '<span class="p3f-tag in">แมพเดียวกัน</span>'}` +
            `<button class="kw-btn grey p3f-b rm" data-unf="${esc(n)}">ลบ</button></div></div></div>`;
        }
        const o = seen[n];
        if (o && o.eq) looks['f:' + n] = o.eq;
        return `<div class="p3f-card off">${pt('f:' + n, o && o.eq, 'grey')}<div class="p3f-in"><b>${esc(n)}</b><small>ออฟไลน์${o ? ` · Lv ${o.lv} · ${esc(jobName(o.job))}` : ''}</small><small class="pl">${o ? `เห็นล่าสุด ${ago(o.t)} · ${esc(mapName(o.map))}` : 'ยังไม่เคยเห็นออนไลน์'}</small>` +
          `<div class="p3f-bs"><button class="kw-btn grey p3f-b rm" data-unf="${esc(n)}">ลบ</button></div></div></div>`;
      }).join('') : empty(H.icon('ic_friends'), 'ยังไม่มีเพื่อน', others.length ? 'กด “เพิ่มเพื่อน” ที่คนในช่อง ออนไลน์ตอนนี้ แล้วเขาจะอยู่ที่นี่' : 'เจอใครที่ออนไลน์อยู่ เพิ่มเขาเป็นเพื่อนได้จากช่อง ออนไลน์ตอนนี้');
      h += '</div></section>';
      // column 3: online now
      h += `<section class="p3f-col"><h3>ออนไลน์ตอนนี้ <small>${others.length || ''}</small></h3><div class="p3f-cards kw-scroll" data-col="on">`;
      h += others.length ? others.map((r) => {
        looks['o:' + r.peer] = r.equip;
        return `<div class="p3f-card">${pt('o:' + r.peer, r.equip)}<div class="p3f-in"><b>${esc(r.name)}</b><small>Lv ${r.lv} · ${esc(jobName(r.job))}${r.gu ? ` · «${esc(r.gu[1])}»` : ''}</small><small class="pl">${esc(placeOf(r, game))}</small>` +
          `<button class="kw-btn blue p3f-b" data-add="${esc(r.name)}">เพิ่มเพื่อน</button></div></div>`;
      }).join('') : isOn ? empty(H.icon('ic_journal'), on.length ? 'ทุกคนที่ออนไลน์เป็นเพื่อนคุณแล้ว' : 'ตอนนี้ไม่มีใครออนไลน์', on.length ? 'เพื่อนที่ออนไลน์อยู่ในช่อง เพื่อน' : 'ชวนเพื่อนเปิดเกมจากลิงก์เดียวกัน แล้วจะเห็นกันที่นี่')
        : empty(H.icon('ic_journal'), 'ยังไม่ได้เล่นออนไลน์', 'เล่นผ่านลิงก์ออนไลน์ของเกม (claude.ai) เพื่อเจอคนอื่น แล้วเพิ่มเป็นเพื่อนได้ที่นี่');
      h += '</div></section></div>';
      // the whisper strip
      h += '<div class="p3f-tip"><span>กระซิบ: พิมพ์ <b>/w ชื่อ ข้อความ</b> ในแชท · ชวนปาร์ตี้ได้ที่หน้าต่างปาร์ตี้ (P)</span>' +
        '<button class="kw-btn blue p3f-tb" data-fchat="1">พิมพ์กระซิบ</button><button class="kw-btn blue p3f-tb" data-fparty="1">หน้าต่างปาร์ตี้</button></div></div>';
      el.innerHTML = h;
      for (const c of el.querySelectorAll('.p3f-cards')) if (olds[c.dataset.col]) c.scrollTop = olds[c.dataset.col];
      drawFaces(el, looks);
      lastSig = sig(game);
    }

    // redraw while open when what the page shows changes (someone comes, goes, moves, raises the flag, answers)
    let lastSig = '';
    function sig(game) {
      const PN = NC.PartyNet, R = PN && PN.roster();
      return JSON.stringify([online(), S().pf, S().friends, game && game.mapId, R, people().map((r) => [r.peer, r.name, r.lv, r.job, r.map, !!r.pf, r.pt, PN ? PN.invited(r.peer) : 0, PN && PN.actionFor && PN.actionFor(r), r.gu ? r.gu[1] : 0, JSON.stringify(r.equip)])]);
    }
    setInterval(() => {
      const g = G();
      if (!g || !H.isOpen || !H.isOpen()) { remember(); return; }
      if (H.page !== 'friends') return;
      if (sig(g) !== lastSig) H.refresh();
    }, 1000);

    function whisper(g) {
      NC.HUD.panel('journal', false); g.paused = false;
      setTimeout(() => {
        const i = document.getElementById('cw-text');
        if (!i) { toast(g, 'พิมพ์ /w ชื่อ ข้อความ ในแชท'); return; }
        i.value = '/w '; i.focus();
        try { i.setSelectionRange(3, 3); } catch (e) { /* (some inputs) */ }
      }, 60);
    }

    TF.render = renderFriends;
    TF.click = function (e, game) {
      const g = game || G();
      if (!g || !g.player) return false;
      const iv = e.target.closest('[data-inv]');
      if (iv) {
        if (iv.disabled) return true;
        const PN = NC.PartyNet;
        if (!PN) { toast(g, 'ชวนปาร์ตี้ได้เมื่อเล่นออนไลน์'); return false; }
        const r = PN.invite(iv.dataset.inv);
        if (r !== 'ok') toast(g, PN.actionError ? PN.actionError(r) : { full: 'ปาร์ตี้เต็มแล้ว', busy: 'คนนี้อยู่ในปาร์ตี้อื่น', lead: 'หัวตี้เท่านั้นที่ชวนได้', dup: 'ชวนไปแล้ว', off: 'คนนี้ไม่ได้ออนไลน์แล้ว' }[r] || 'ชวนไม่ได้');
        return true;
      }
      const go = e.target.closest('[data-go]');
      if (go && g.player.dead > 0) { toast(g, 'ฟื้นก่อน แล้วค่อยใช้ลูกไฟนำทาง'); return false; }
      if (e.target.closest('[data-fchat]')) { whisper(g); return false; }
      if (e.target.closest('[data-fparty]')) { NC.HUD.panel('journal', false); g.paused = NC.HUD.panel('party', true); return false; }
      return baseClick ? baseClick.call(this, e, g) : false; // (social.js: the flag, add, remove, ไปหาเพื่อน)
    };
    TF.p3 = { sig, seen: () => seen, mark: (g) => { lastSig = sig(g); } }; // (tests; mark: js/p3_frienddetail.js drew the page itself)
  }
})();
