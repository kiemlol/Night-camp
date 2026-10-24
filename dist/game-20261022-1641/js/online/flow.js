/* online/flow.js — the online game's flow around the world, the way online games do it (the user, 2026-10-18: "จัด flow
   ที่ควรจะเป็นของเกมออนไลน์ ... ปุ่ม setting ฝั่งผู้เล่นควรเห็นอะไรบ้าง ... อะไรที่ไม่ควรเห็น"):
   - the ESC menu gets เปลี่ยนตัวละคร (back to the character select) and ออกจากระบบ (back to the key window) as side buttons
     (NC.MENU_SIDE, js/menuwin.js). Both ask first; while the hero fights (a swing, a cast or a hit in the last 5 s, as
     online/channels.js) the yes button counts down, so a fight can't be dodged by leaving. Leaving reloads the page: the
     next hero starts from a clean page, and the server already holds everything.
   - ปรับแต่งหน้าตา (js/creator.js in its edit mode): the look goes to the server ({action:'creator'}, backend actions.go,
     the name unchanged: hero_name.go) and the creator closes once the snapshot wears it; a refusal stays in the creator.
   - the online player menu keeps the presentation settings out of the game.
     The character select shows the server name. Styles: css/playerflow.css. */
(function () {
  'use strict';
  const NC = window.NC, O = NC.Online;
  if (!O || !O.enabled) return;
  const $ = (s, r) => (r || document).querySelector(s);
  const icon = (k) => ((NC.ASSET_MANIFEST_KUI || {})[k] || (NC.ASSET_MANIFEST || {})[k] || {}).src || '';
  const FIGHT = 5; // s after the last swing, cast or hit (online/channels.js)
  const words = (e) => (NC.OnlineLobby && NC.OnlineLobby.words ? NC.OnlineLobby.words(e) : (e && e.message) || String(e || ''));
  const game = () => (NC.OnlineWorld && NC.OnlineWorld.game) || NC.game;

  // ---------------- leaving: change hero / log out ----------------
  const KINDS = {
    charsel: { title: 'เปลี่ยนตัวละคร', icon: 'mn_charsel', q: 'กลับไปหน้าเลือกตัวละคร?', yes: 'ไปหน้าเลือกตัว',
      note: 'ตัวละครนี้จะออกจากโลก ของทุกอย่างอยู่บนเซิร์ฟเวอร์แล้ว' },
    logout: { title: 'ออกจากระบบ', icon: 'mn_logout', q: 'ออกจากระบบตอนนี้?', yes: 'ออกจากระบบ',
      note: 'ครั้งหน้าต้องใส่คีย์อีกครั้ง · ของทุกอย่างอยู่บนเซิร์ฟเวอร์แล้ว' },
  };
  (NC.MENU_SIDE = NC.MENU_SIDE || []).push(
    { id: 'charsel', name: 'เปลี่ยนตัวละคร', icon: 'mn_charsel', run: () => ask('charsel') },
    { id: 'logout', name: 'ออกจากระบบ', icon: 'mn_logout', run: () => ask('logout') },
  );
  let box = null, kind = '', until = 0, tick = 0, leaving = false;
  function build() {
    box = document.createElement('div');
    box.className = 'kw-panel pf-modal';
    box.hidden = true;
    box.innerHTML = `
      <div class="kw-win pf-win" role="dialog">
        <div class="kw-title"><span class="pf-title"></span><button class="kw-x pf-x" aria-label="ปิด">✕</button></div>
        <div class="pf-body">
          <img class="pf-ic" alt="">
          <div class="pf-q"></div>
          <div class="pf-note"></div>
          <div class="pf-fight"></div>
          <div class="pf-btns"><button class="kw-btn grey pf-no">ยกเลิก</button><button class="kw-btn gold pf-yes"></button></div>
        </div>
      </div>`;
    document.body.appendChild(box);
    $('.pf-x', box).onclick = $('.pf-no', box).onclick = () => shut();
    $('.pf-yes', box).onclick = () => go();
    box.addEventListener('pointerdown', (e) => { if (e.target === box) shut(); });
    box.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') shut();
      else if (e.key === 'Enter' && !$('.pf-yes', box).disabled) go();
    });
    box.tabIndex = -1;
  }
  function fightLeft() {
    const g = game(), p = g && g.player;
    if (!p || p.lastFight == null || typeof g.time !== 'number') return 0;
    return Math.max(0, FIGHT - (g.time - p.lastFight));
  }
  NC.OnlineFlow = { fightLeft }; // (online/update.js: the update button waits for the same fight)
  function ask(k) {
    if (!box) build();
    const K = KINDS[k];
    kind = k; leaving = false;
    NC.HUD.panel('pause', false); // (the menu closes behind the question)
    $('.pf-title', box).textContent = K.title;
    $('.pf-ic', box).src = icon(K.icon);
    $('.pf-q', box).textContent = K.q;
    $('.pf-note', box).textContent = K.note;
    // a hero in a fight leaves only after the fight's last seconds (wall clock: the world never pauses online)
    until = performance.now() + fightLeft() * 1000;
    box.hidden = false;
    count();
    setTimeout(() => box.focus({ preventScroll: true }), 0);
  }
  function count() {
    clearTimeout(tick);
    if (!box || box.hidden || leaving) return;
    const left = Math.ceil((until - performance.now()) / 1000), yes = $('.pf-yes', box);
    $('.pf-fight', box).textContent = left > 0 ? `กำลังต่อสู้อยู่ · ออกได้ใน ${left} วินาที` : '';
    yes.disabled = left > 0;
    yes.textContent = left > 0 ? `${KINDS[kind].yes} (${left})` : KINDS[kind].yes;
    if (left > 0) tick = setTimeout(count, 200);
  }
  function shut() {
    if (!box || leaving) return;
    box.hidden = true; clearTimeout(tick);
    const g = game();
    if (g) g.paused = false;
  }
  async function go() {
    if (leaving || performance.now() < until) return;
    leaving = true;
    const yes = $('.pf-yes', box);
    yes.disabled = true; $('.pf-no', box).disabled = true;
    yes.textContent = 'กำลังออก…';
    // leave the match first: a closed socket alone left the hero in the world until the server noticed, so the next
    // nc_join was refused ("character already active") and retried 1+2+4+8 s (2026-10-19 Discord: changing hero froze
    // 10-20 s). leaveMatch gives up after 3 s itself (online/nakama.js).
    try { if (O.socket && O.socket.open && O.matchId) await O.socket.leaveMatch(O.matchId); } catch (e) { /* leave anyway */ }
    try { if (kind === 'logout') await O.logout(); } catch (e) { /* the session may be gone already: leave anyway */ }
    O.stop();
    location.reload(); // (online/lobby.js comes back: the select with the saved key, the key window after a log out)
  }

  // ---------------- the dressing room: the look to the server ----------------
  // nothing changed = done at once; else wait for the snapshot that wears it, or the server's refusal, or 6 s
  const LOOK_KEYS = ['g', 'hair', 'hc', 'eyes', 'ec', 'mouth'];
  const lookKey = (a) => (a ? LOOK_KEYS.map((k) => a[k] || '').join('|') : '');
  let waiting = null;
  O.on('snapshot', () => { const s = O.snap && O.snap.self; if (waiting && s && lookKey(s.appearance) === waiting.key) waiting.done(); });
  O.on('event', (ev) => { if (waiting && ev && ev.type === 'error' && /appearance|name|wait before|creator/i.test(ev.message || '')) waiting.done(new Error(words(ev))); });
  function dress({ name, look }) {
    const self = (O.snap && O.snap.self) || null;
    const appearance = {};
    for (const k of LOOK_KEYS) appearance[k] = look[k];
    if (!self || O.status !== 'online') return Promise.reject(new Error('ยังไม่ได้เชื่อมต่อเซิร์ฟเวอร์ ลองใหม่อีกครั้ง'));
    if (lookKey(self.appearance) === lookKey(appearance)) return Promise.resolve();
    if (waiting) return Promise.reject(new Error('กำลังบันทึกอยู่ รอสักครู่'));
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => waiting && waiting.done(new Error('เซิร์ฟเวอร์ไม่ตอบ ลองใหม่อีกครั้ง')), 6000);
      waiting = { key: lookKey(appearance), done: (err) => { clearTimeout(t); waiting = null; if (err) reject(err); else resolve(); } };
      O.action({ action: 'creator', name: self.name || name, appearance });
    });
  }
  if (NC.Creator) NC.Creator.online = Object.assign(NC.Creator.online || {}, { dress });


  // ---------------- after the lobby and the menu are built ----------------
  const baseInit = NC.HUD.init.bind(NC.HUD);
  NC.HUD.init = function (g) {
    baseInit(g);
    // the character select: the server's name, not its address (online/servers.js knows the operator's names)
    const srv = $('.cs-srv span');
    if (srv && NC.PLAYER_VIEW) {
      srv.textContent = 'เซิร์ฟเวอร์';
      const S = NC.OnlineServers;
      // (the operator's list may name this server under another address, e.g. s1 at its old CloudFront host while the page
      //  plays on api.nightcamp.app: its row with the same id gives the name)
      if (S && S.list) S.list().then((list) => {
        const me = list.find((s) => s.current);
        if (!me) return;
        const named = list.find((s) => s !== me && s.id === me.id && s.from === 'list');
        srv.textContent = 'เซิร์ฟเวอร์: ' + (named || me).name;
      }).catch(() => {});
    }
  };
  // ออกจากระบบ only for an account that can log in again (a key or a username; not this browser's own device account)
  const panel2 = NC.HUD.panel.bind(NC.HUD);
  NC.HUD.panel = function (id, show) {
    const r = panel2(id, show);
    if (id === 'pause') { const b = $('#mn-side [data-go="logout"]'); if (b) b.hidden = !O.account || O.account.kind === 'device'; }
    return r;
  };
})();
