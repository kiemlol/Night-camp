/* discord.js — Discord · แจ้งบัค / เสนอแนะ (2026-10-20, the user: "ทำปุ่มแนบ discord เราด้วย แล้วแนบช่องแก้ปัญหาให้มันลิ้งไปที่
   discord ได้ เขาจะได้แจ้งรีพอทได้ หรือปรับปรุง"). README "ปุ่ม Discord + แจ้งบัค".
   The in-game report window (js/bugreport.js) stays parked (its server patch 004 is paused), so players report on our
   Discord, in the forum room #แจ้งบั๊ก that the team's report puller reads. Bugs and ideas both go there (the user picked
   one room): an idea's form starts with "[Suggestion]", the tag that puller sorts ideas by. The room link is its own
   discord.com/channels link (the user's pick), which opens for members only; เข้าเซิร์ฟเวอร์ is the server's never-expiring
   invite (2026-10-22, "บางคนกดเข้าดิสไม่ได้": a channels link shows nothing to someone not in the server yet), and the card
   tells newcomers to join there first.
   The card (K look, css/discord.css): three ways (แจ้งบัค · เสนอแนะ · เข้าเซิร์ฟเวอร์) and what the game copies for the post
   (version, server, hero, map, browser, graphics level, frames). แจ้งบัค and เสนอแนะ copy a short form + that info, then
   open the room in a new tab (the desktop app hands window.open to the browser).
   Opens from: the Discord pill left of the coins (desktop; a cell in the phone's menu grid instead), the ESC menu's side
   button แจ้งบัค / เสนอแนะ, เช็คเครื่อง's footer (js/gfx.js hook), a pill on the server and character select screens, the
   chat (/discord /ดิสคอร์ด /บัค /bug /เสนอแนะ /idea), NC.Discord.open(). Test: ?discord opens it. */
(function () {
  'use strict';
  const NC = window.NC;
  const GUILD = '1553652694894383217', ROOM = '1561360530332061817'; // (the server, its forum room #แจ้งบั๊ก)
  // (the invite: Expire After Never, no use limit; anyone can join through it)
  const LINK = { server: 'https://discord.gg/Qdq85Zz384', report: `https://discord.com/channels/${GUILD}/${ROOM}` };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // the painted report icons (made for bugreport.js); the ESC menu takes its icon by manifest key
  const IC = { bug: 'assets/bugreport/rp_bug.png', idea: 'assets/bugreport/rp_idea.png' };
  if (NC.ASSET_MANIFEST && !NC.ASSET_MANIFEST.rp_bug) NC.ASSET_MANIFEST.rp_bug = { src: IC.bug, w: 64, h: 62, ax: 0.5, ay: 0.5 };
  // Discord's own mark (their brand asset, shown as is)
  const MARK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M20.3 4.4A19.8 19.8 0 0 0 15.4 3l-.6 1.2a18.3 18.3 0 0 0-5.5 0L8.6 3a19.7 19.7 0 0 0-4.9 1.5C.5 9.2-.3 13.6.1 18a19.9 19.9 0 0 0 6 3l1.2-2a12.3 12.3 0 0 1-1.9-.9l.4-.3a14.2 14.2 0 0 0 12.3 0l.4.3a12.3 12.3 0 0 1-1.9.9l1.2 2a19.8 19.8 0 0 0 6-3c.5-5.2-.8-9.6-3.5-13.6zM8 15.3c-1.2 0-2.2-1.1-2.2-2.4S6.8 10.5 8 10.5s2.2 1.1 2.2 2.4-1 2.4-2.2 2.4zm8 0c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4z"/></svg>';
  const mob = () => document.documentElement.classList.contains('mob');

  // ---------------- what goes with a post ----------------
  const O = () => NC.Online;
  const inWorld = () => { const o = O(); return o && o.enabled ? !!(window.__ncOnline && window.__ncOnline.ready) : !!(NC.game && NC.game.player); };
  function browser() {
    const ua = navigator.userAgent, v = (re) => ((ua.match(re) || [])[1] || '').split('.')[0];
    const b = /Edg\//.test(ua) ? 'Edge ' + v(/Edg\/([\d.]+)/) : /OPR\//.test(ua) ? 'Opera ' + v(/OPR\/([\d.]+)/)
      : /Firefox\//.test(ua) ? 'Firefox ' + v(/Firefox\/([\d.]+)/) : /Chrome\//.test(ua) ? 'Chrome ' + v(/Chrome\/([\d.]+)/)
        : /Safari\//.test(ua) ? 'Safari ' + v(/Version\/([\d.]+)/) : 'เบราว์เซอร์อื่น';
    const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad|iPod/.test(ua) ? 'iOS' : /Mac OS X/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : '';
    return [b.trim(), os].filter(Boolean).join(' · ');
  }
  function info() {
    const g = NC.game, p = g && g.player, o = O(), rows = [];
    const badge = document.querySelector('.up-verbadge'); // (js/online/update.js: "v0.5.6 · 20 ต.ค. 69")
    rows.push(['เวอร์ชัน', (badge && badge.textContent.trim()) || (o && o.release && o.release.contentVersion ? 'v' + o.release.contentVersion : 'ทดสอบในเครื่อง')]);
    if (o && o.enabled) {
      const s = ((NC.ServerSelect && NC.ServerSelect.list) || []).find((x) => x.url === o.origin);
      rows.push(['เซิร์ฟเวอร์', (s && s.name) || String(o.origin || 'ออนไลน์').replace(/^https?:\/\//, '')]);
    } else rows.push(['เซิร์ฟเวอร์', 'ออฟไลน์']);
    if (p && inWorld()) {
      const J = NC.JOBS && NC.JOBS[p.job], M = NC.MAPS && NC.MAPS[g.mapId];
      rows.push(['ตัวละคร', `${p.name || '-'} · ${(J && J.name) || p.job || '-'} · Base ${p.lv | 0} / Job ${p.jobLv | 0}`]);
      rows.push(['แมพ', `${(M && M.name) || g.mapId || '-'} (${g.mapId || '?'} ${Math.round(p.x)}, ${Math.round(p.y)})`]);
    }
    let gfx = '';
    try { const G = NC.Gfx; if (G) gfx = 'ภาพ' + G.LEVELS[G.level()].name + (G.M && G.M.fps ? ' · ' + Math.round(G.M.fps) + ' FPS' : ''); } catch (e) { /* not up yet */ }
    const sw = screen.width || innerWidth, sh = screen.height || innerHeight; // (a background tab may say 0)
    rows.push(['เครื่อง', [browser(), `จอ ${sw}×${sh}`, gfx].filter(Boolean).join(' · ')]);
    return rows;
  }
  const infoText = () => '— ข้อมูลจากเกม —\n' + info().map(([k, v]) => `${k}: ${v}`).join('\n');
  const FORM = {
    bug: ['หัวข้อ: ', 'เกิดอะไรขึ้น: ', 'ก่อนเกิดทำอะไรอยู่: ', 'เกิดบ่อยไหม (ครั้งเดียว / บางครั้ง / ทุกครั้ง): '],
    idea: ['[Suggestion] หัวข้อ: ', 'อยากให้ปรับหรือเพิ่มอะไร: ', 'เพราะอะไร: '],
  };
  // copy inside the click itself (a copy after window.open loses the page's focus): the old way first, it answers at once
  function copy(text) {
    const t = document.createElement('textarea');
    t.value = text; t.setAttribute('readonly', ''); t.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
    document.body.appendChild(t); t.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { /* not allowed */ }
    t.remove();
    if (!ok && navigator.clipboard && window.isSecureContext) { navigator.clipboard.writeText(text).catch(() => {}); ok = true; }
    return ok;
  }
  const go = (url) => window.open(url, '_blank', 'noopener');

  // ---------------- the card ----------------
  let over = null, wasPaused = null;
  const way = (k, pic, t, s) => `<button type="button" class="dc-way ${k}" data-dc="${k}"><span class="dc-pic">${pic}</span>` +
    `<span class="dc-wt"><b>${t}</b><small>${s}</small></span><span class="dc-go">›</span></button>`;
  function build() {
    over = document.createElement('div');
    over.className = 'kw-panel dc-over'; over.hidden = true;
    over.innerHTML = '<section class="kw-win dc-win" role="dialog" aria-label="แจ้งบัค / เสนอแนะ ทาง Discord">' +
      '<header class="kw-title"><span>แจ้งบัค / เสนอแนะ</span><button type="button" class="kw-x" data-dc="close" aria-label="ปิด">✕</button></header>' +
      '<div class="dc-body">' +
        `<div class="dc-top"><span class="dc-badge">${MARK}</span><div><h3>Discord ของ Night Camp</h3>` +
          '<p>เจอบัค ติดปัญหา หรืออยากให้ปรับอะไร บอกทีมงานได้ที่ห้อง <b>#แจ้งบั๊ก</b> ทีมงานอ่านทุกโพสต์</p></div></div>' +
        '<div class="dc-ways">' +
          way('bug', `<img src="${IC.bug}" alt="">`, 'แจ้งบัค / ติดปัญหา', 'คัดลอกฟอร์มกับข้อมูลเกมให้ แล้วเปิดห้อง #แจ้งบั๊ก') +
          way('idea', `<img src="${IC.idea}" alt="">`, 'เสนอแนะ / อยากให้ปรับปรุง', 'ห้องเดียวกัน ฟอร์มขึ้นต้นด้วย [Suggestion] ให้แล้ว') +
          way('server', `<span class="dc-badge">${MARK}</span>`, 'เข้าเซิร์ฟเวอร์ Discord', 'ยังไม่ได้เข้า กดอันนี้ก่อน · ข่าวแพตช์ คุยกับผู้เล่นคนอื่น') +
        '</div>' +
        '<div class="kw-info dc-info"><span class="i">i</span><div class="dc-rows"></div><button type="button" class="kw-btn blue dc-copy" data-dc="copy">คัดลอก</button></div>' +
        '<p class="dc-how"></p><p class="dc-said" aria-live="polite"></p>' +
      '</div></section>';
    over.addEventListener('click', (e) => {
      const b = e.target.closest('[data-dc]');
      if (!b) { if (e.target === over) close(); return; }
      const k = b.dataset.dc;
      if (k === 'close') return close();
      if (k === 'copy') return say(copy(infoText()) ? 'คัดลอกข้อมูลแล้ว วางในโพสต์ได้เลย' : 'คัดลอกไม่ได้ ลากเลือกข้อความด้านบนแล้วคัดลอกเองได้', 'ok');
      if (k === 'server') { go(LINK.server); return say('เปิด Discord ในแท็บใหม่แล้ว', 'ok'); }
      const ok = copy(FORM[k].join('\n') + '\n\n' + infoText());
      go(LINK.report);
      say((ok ? `คัดลอกฟอร์ม${k === 'idea' ? 'เสนอแนะ' : 'แจ้งบัค'}แล้ว · ในห้องกด "โพสต์ใหม่" แล้ววางได้เลย` : 'เปิดห้องแล้ว แต่คัดลอกให้ไม่ได้ ลากเลือกข้อมูลด้านบนแล้วคัดลอกเองได้') +
        ' · ห้องไม่ขึ้น = ยังไม่ได้เข้าเซิร์ฟ กด "เข้าเซิร์ฟเวอร์ Discord" ก่อน', ok ? 'ok' : 'bad');
    });
    document.body.appendChild(over);
  }
  function say(t, kind) {
    const el = over && over.querySelector('.dc-said');
    if (!el) return;
    el.textContent = t; el.className = 'dc-said ' + (kind || '');
    el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
  }
  function fill() {
    over.querySelector('.dc-rows').innerHTML = info().map(([k, v]) => `<span class="k">${esc(k)}</span><span class="v">${esc(v)}</span>`).join('');
    over.querySelector('.dc-how').innerHTML = 'ในห้อง กด <b>โพสต์ใหม่</b> เลือกแท็กให้ตรงเรื่อง แล้ว' +
      (mob() ? 'กดค้างเพื่อวาง' : 'วาง (<b>Ctrl+V</b>)') + ' <span>สิ่งที่คัดลอกไว้</span><br><span>แนบภาพหน้าจอด้วยยิ่งดี</span>' +
      '<br>ยังไม่ได้เข้าเซิร์ฟ: กด <b>เข้าเซิร์ฟเวอร์ Discord</b> ก่อน ห้อง #แจ้งบั๊ก ถึงจะเปิดได้';
    say('', '');
  }
  function open() {
    if (!over) build();
    fill();
    if (over.hidden) {
      over.hidden = false;
      const g = NC.game;
      if (g) { wasPaused = !!g.paused; g.paused = true; } // (the hero's keys stay off behind the card)
    }
  }
  function close() {
    if (!over || over.hidden) return;
    over.hidden = true;
    const g = NC.game;
    if (g && wasPaused !== null) g.paused = wasPaused;
    wasPaused = null;
  }
  // ESC closes the card only (not the menu under it)
  addEventListener('keydown', (e) => {
    if (!over || over.hidden || e.key !== 'Escape') return;
    e.preventDefault(); e.stopImmediatePropagation(); close();
  }, true);

  // ---------------- the ways in ----------------
  // the ESC menu: a side button before เปลี่ยนตัวละคร / ออกจากระบบ (js/online/flow.js)
  const side = (NC.MENU_SIDE = NC.MENU_SIDE || []);
  const at = side.findIndex((b) => b.id === 'charsel');
  side.splice(at < 0 ? side.length : at, 0, { id: 'discord', name: 'แจ้งบัค / ไอเดีย', icon: 'rp_bug', run: open });
  // the chat
  const C = (NC.chatCmds = NC.chatCmds || {});
  for (const c of ['/discord', '/ดิสคอร์ด', '/บัค', '/แจ้งบัค', '/bug', '/report', '/เสนอแนะ', '/idea']) if (!C[c]) C[c] = open;
  // the main screen: a pill left of the coins (desktop), a cell in the phone's menu grid (hidden on desktop: the tray is full)
  let pill = null, lastTop = null, tick = 0;
  function place() {
    if (!pill) return;
    const coins = document.querySelector('#hud .hud-br > .coins'), show = !!coins && !mob();
    pill.hidden = !show;
    if (!show) { lastTop = null; return; }
    const t = Math.round(coins.offsetTop + (coins.offsetHeight - pill.offsetHeight) / 2);
    if (t !== lastTop) { pill.style.top = t + 'px'; lastTop = t; }
  }
  const baseInit = NC.HUD.init.bind(NC.HUD);
  NC.HUD.init = function (game) {
    baseInit(game);
    const col = document.querySelector('#hud .hud-br');
    if (col && !col.querySelector('.dc-hud')) {
      pill = document.createElement('button');
      pill.type = 'button'; pill.className = 'dc-hud'; pill.title = 'Discord · แจ้งบัค / เสนอแนะ';
      pill.innerHTML = `<span class="dc-mk">${MARK}</span><b>Discord</b>`;
      pill.addEventListener('click', open);
      col.appendChild(pill);
    }
    const bar = document.querySelector('.menubar');
    if (bar && !bar.querySelector('.dc-mbtn')) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'mbtn dc-mbtn'; b.title = 'Discord · แจ้งบัค / เสนอแนะ';
      b.innerHTML = `<span class="dc-cell">${MARK}</span><span class="mb-lbl">Discord</span>`; // (the phone grid's name: mobile.js names only the cells it saw)
      b.addEventListener('click', open);
      bar.insertBefore(b, bar.querySelector('[data-panel="pause"]'));
    }
    place();
  };
  const baseUpdate = NC.HUD.update.bind(NC.HUD);
  NC.HUD.update = function (game) {
    baseUpdate(game);
    if (++tick % 30 === 0) place(); // (the coins' row moves when AUTO or my shop's pill come and go)
  };
  addEventListener('resize', () => setTimeout(place, 0));
  // the server and character select screens (css shows it only while one of them is up)
  const door = document.createElement('button');
  door.type = 'button'; door.className = 'dc-door';
  door.innerHTML = `<span class="dc-mk">${MARK}</span><span>แจ้งปัญหา · Discord</span>`;
  door.addEventListener('click', open);
  document.body.appendChild(door);

  NC.Discord = { open, close, info, LINK, get isOpen() { return !!over && !over.hidden; } };
})();
