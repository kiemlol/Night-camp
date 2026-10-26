/* hub.js — สมุดนักเดินทาง (J): one window, in the K look (css/kui.css + css/bible.css), for the Game Bible's new pages so
   the menu bar keeps one button instead of ten. Tabs down the left, the page on the right; each page is its own file:
     NC.Hub.add({ id, name, icon, order, render(el, game), click(e, game) -> true when handled, dot(game) -> bool })
     NC.Hub.open(id)   opens the window on that page      NC.Hub.refresh()   draws the open page again
   The pages so far: สรุปบอท (report.js), สมุดสะสม / สมุดมอน (book.js), เควส (quests.js), ตลาด (market.js), กิลด์ /
   เพื่อน (social.js), อันดับ (season.js), ตู้กาชา (gacha.js). Icons: assets/bible/ (tools/bible_icons.py).
   Hooks: NC.HUD.init (the window, the menu bar button), NC.HUD.panel('journal'), the J key, ?journal=<page>. */
(function () {
  'use strict';
  const NC = window.NC;
  const $ = (id) => document.getElementById(id);
  const G = () => NC.game;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const tabs = [];
  let win = null, cur = null;
  const icon = (name) => `assets/bible/${name}.png`;

  const Hub = (NC.Hub = {
    esc, icon,
    add(t) { tabs.push(t); tabs.sort((a, b) => (a.order || 50) - (b.order || 50)); if (win) renderTabs(); },
    open(id) { if (id) cur = id; const g = G(); if (g) g.paused = NC.HUD.panel('journal', true); },
    refresh() { if (win && !win.hidden) render(); },
    get page() { return cur; },
    tab: (id) => tabs.find((t) => t.id === id) || null, // (a page's own record: js/p3_*.js wrap render / click to redraw a page)
    isOpen: () => !!(win && !win.hidden),
  });

  function build() {
    win = document.createElement('div');
    win.id = 'journal'; win.className = 'kw-panel'; win.hidden = true;
    win.innerHTML = '<section class="kw-win hb-win"><header class="kw-title"><span id="hb-title">สมุดนักเดินทาง</span>' +
      '<button class="kw-x" id="hb-close" aria-label="ปิด">✕</button></header>' +
      '<div class="hb-body"><nav class="hb-tabs" id="hb-tabs"></nav><div class="hb-page kw-scroll" id="hb-page"></div></div></section>';
    document.body.appendChild(win);
    $('hb-close').addEventListener('click', close);
    win.addEventListener('mousedown', (e) => { if (e.target === win) close(); });
    $('hb-tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) { cur = b.dataset.tab; render(); } });
    $('hb-page').addEventListener('click', (e) => { const t = tabs.find((x) => x.id === cur); if (t && t.click && t.click(e, G())) render(); });
    $('hb-page').addEventListener('input', (e) => { const t = tabs.find((x) => x.id === cur); if (t && t.input) t.input(e, G()); });
  }
  function renderTabs() {
    const g = G();
    $('hb-tabs').innerHTML = tabs.map((t) => `<button data-tab="${t.id}" class="${t.id === cur ? 'on' : ''}">` +
      `<img src="${icon(t.icon)}" alt="" onerror="this.style.visibility='hidden'"><span>${esc(t.name)}</span>` +
      `${t.dot && g && t.dot(g) ? '<i class="dot"></i>' : ''}</button>`).join('');
  }
  function render() {
    if (!win || win.hidden) return;
    if (!tabs.some((t) => t.id === cur)) cur = tabs[0] && tabs[0].id;
    renderTabs();
    const t = tabs.find((x) => x.id === cur), el = $('hb-page'), top = el.scrollTop, same = el.dataset.tab === cur;
    $('hb-title').textContent = 'สมุดนักเดินทาง'; // (one title like the mockups: every page shows its own name in its header)
    el.dataset.tab = cur || '';
    if (t) t.render(el, G());
    if (same) el.scrollTop = top;
  }
  function close() { NC.HUD.panel('journal', false); const g = G(); if (g) g.paused = false; }

  const baseInit = NC.HUD.init.bind(NC.HUD);
  NC.HUD.init = function (game) {
    baseInit(game);
    build();
    const bar = document.querySelector('.menubar');
    if (bar) {
      const b = document.createElement('button');
      b.className = 'mbtn'; b.title = 'สมุดนักเดินทาง: สรุปบอท สมุดสะสม เควส ตลาด กิลด์ อันดับ (J)';
      b.innerHTML = `<img src="${icon('ic_journal')}" alt=""><b>J</b><i class="dot" id="hbdot" hidden></i>`;
      b.addEventListener('click', () => { game.paused = NC.HUD.panel('journal'); });
      const esc2 = bar.querySelector('[data-panel="pause"]');
      bar.insertBefore(b, esc2 || null);
    }
    const keys = document.querySelector('#pause .keys');
    if (keys) { const li = document.createElement('li'); li.innerHTML = '<kbd>J</kbd> สมุดนักเดินทาง — สรุปบอท สมุดสะสม สมุดมอน เควส ตลาด กิลด์ อันดับ'; keys.insertBefore(li, keys.lastElementChild); }
    setInterval(() => { const d = $('hbdot'), g = G(); if (d && g) d.hidden = !tabs.some((t) => t.dot && t.dot(g)); }, 1500);
  };
  const basePanel = NC.HUD.panel.bind(NC.HUD);
  NC.HUD.panel = function (id, show) {
    if (win && id === 'journal') {
      const on = show === undefined ? win.hidden : show;
      basePanel('pause', false);
      win.hidden = !on;
      if (on) render();
      return on;
    }
    if (win) win.hidden = true;
    return basePanel(id, show);
  };
  addEventListener('keydown', (e) => {
    if (!win) return;
    if (e.code === 'Escape' && !win.hidden) { e.stopImmediatePropagation(); e.preventDefault(); close(); return; }
    const t = e.target;
    if (e.code !== 'KeyJ' || e.ctrlKey || e.altKey || e.metaKey || (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable))) return;
    const g = G();
    if (!g || !g.player) return;
    e.preventDefault();
    g.paused = NC.HUD.panel('journal');
  }, true);
})();
