/* hudshop.js — the PC shop row (css/hudshop.css; the user's pick D of four, 2026-10-19: "อยากได้แบบนี้อ่ะๆ แต่ปรับ icon
   ด้านบนใหม่หน่อยๆ ให้ codex ทำใหม่เลยๆ ให้ขนาดพอดีๆ"): five round painted buttons at the top right, left of the clock
   window, apart from the menu tray so the ones that sell stand out. The tray stays bottom right without its moon gem.
     บอส      J → ท้ายเกม → บอสโลก (NC.Season.openWorldBoss); badge: the next world boss's time, a red "ตื่น!" while one
              is up (offline: season.js's and baphomet.js's own times; online: the server's list, self.season.baph)
     กิจกรรม  the check-in calendar: J → เควส → ปฏิทิน (online the server's month, js/online/extras.js)
     ตลาด     J → ตลาด
     กาชา     J → ตู้กาชา
     เติม     the top-up window (NC.HUD.panel('topup')), bigger, light running round it; a pink "x2": what is bought in the
              beta comes back x2 at launch (js/topup.js)
   A button whose page isn't loaded stays hidden. Art: assets/hudshop/hs_*.png, painted by Codex from our own icons
   (tools/hudshop_icons.py; hs_pass, the season pass, is painted too, for when the pass opens).
   Phones and iPads: no row (css/hudshop.css), their menu grid keeps the moon gem.
   Hooks: NC.HUD.init. Load after topupwin.js, season.js, baphomet.js, quests.js and the journal's pages. */
(function () {
  'use strict';
  const NC = window.NC;
  if (!NC || !NC.HUD) return;
  const TICK_MS = 1000, DAY_MS = 86400000;
  const ART = (name) => `assets/hudshop/${name}.png`;
  const G = () => NC.game;
  const hub = (id) => !!(NC.Hub && NC.Hub.tab(id));
  const two = (n) => String(n).padStart(2, '0');
  const hhmm = (ms) => { const d = new Date(ms); return `${two(d.getHours())}:${two(d.getMinutes())}`; };
  const online = () => !!(NC.Online && NC.Online.enabled);

  // ---------------- the badges ----------------
  // the world bosses' start times still ahead (ms), and whether one is up now
  function bossTimes(now) {
    if (online()) {
      const s = NC.OnlineWorld && NC.OnlineWorld.snap && NC.OnlineWorld.snap.self;
      const list = (s && s.season && s.season.baph) || [];
      return { up: list.some((r) => now >= r.at && now < r.until), next: list.map((r) => r.at).filter((at) => at > now) };
    }
    const daily = [].concat((NC.Season && NC.Season.times) || [], (NC.Baph && NC.Baph.times) || []);
    const midnight = new Date(now).setHours(0, 0, 0, 0), next = [];
    for (const day of [0, 1]) for (const [h, m] of daily) next.push(midnight + day * DAY_MS + (h * 60 + m) * 60000);
    const wb = NC.Season && NC.Season.wbNow && NC.Season.wbNow(), bp = NC.Baph && NC.Baph.slot && NC.Baph.slot();
    return { up: !!((wb && !wb.soon) || (bp && !bp.soon)), next: next.filter((at) => at > now) };
  }
  function bossBadge() {
    const t = bossTimes(Date.now());
    if (t.up) return { text: 'ตื่น!', kind: 'live' };
    return t.next.length ? { text: hhmm(Math.min(...t.next)), kind: 'time' } : null;
  }

  // ---------------- the buttons ----------------
  const BUTTONS = [
    { id: 'boss', name: 'บอส', art: 'hs_boss', badge: bossBadge, ok: () => hub('endgame'),
      go: () => (NC.Season && NC.Season.openWorldBoss ? NC.Season.openWorldBoss() : NC.Hub.open('endgame')) },
    { id: 'event', name: 'กิจกรรม', art: 'hs_event', ok: () => hub('quest') && !!(NC.Quests && NC.Quests.openCalendar),
      go: () => NC.Quests.openCalendar() },
    { id: 'market', name: 'ตลาด', art: 'hs_market', ok: () => hub('market'), go: () => NC.Hub.open('market') },
    { id: 'gacha', name: 'กาชา', art: 'hs_gacha', ok: () => hub('gacha'), go: () => NC.Hub.open('gacha') },
    { id: 'topup', name: 'เติม', art: 'hs_topup', hero: true, badge: () => ({ text: 'x2', kind: 'promo' }),
      ok: () => !!NC.TopUp, go: () => NC.HUD.panel('topup') },
  ];
  const byId = new Map(BUTTONS.map((b) => [b.id, b]));
  let row = null;

  function build(hud) {
    row = document.createElement('nav');
    row.className = 'hudshop';
    row.setAttribute('aria-label', 'บอส กิจกรรม ตลาด กาชา เติมเพชร');
    row.innerHTML = BUTTONS.map((b) => `<button type="button" class="hs-b${b.hero ? ' hero' : ''}" data-hs="${b.id}" title="${b.name}">` +
      `<span class="hs-disc"><img src="${ART(b.art)}" alt=""><span class="hs-badge" hidden></span></span>` +
      `<span class="hs-name">${b.name}</span></button>`).join('');
    row.addEventListener('click', (e) => {
      const el = e.target.closest('[data-hs]'), b = el && byId.get(el.dataset.hs);
      if (!b || !G()) return;
      b.go();
    });
    hud.appendChild(row);
  }

  function refresh() {
    if (!row) return;
    for (const el of row.querySelectorAll('[data-hs]')) {
      const b = byId.get(el.dataset.hs);
      el.hidden = !b.ok();
      const badge = el.querySelector('.hs-badge'), v = b.badge ? b.badge() : null;
      badge.hidden = !v;
      if (!v) continue;
      badge.className = 'hs-badge ' + v.kind;
      if (badge.textContent !== v.text) badge.textContent = v.text;
    }
  }

  const baseInit = NC.HUD.init.bind(NC.HUD);
  NC.HUD.init = function (game) {
    baseInit(game);
    const hud = document.getElementById('hud');
    if (!hud || row) return;
    build(hud);
    refresh();
    setInterval(refresh, TICK_MS);
  };
})();
