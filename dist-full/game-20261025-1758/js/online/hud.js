/* online/hud.js — FPS, signal/ping, channel, server-wide and per-map online counts.
   Phones and iPads put the strip ABOVE the hero card, inside the safe area; the PC splits it: the machine's line on the
   top edge left of the clock dial, the counts one row under the map's name (place()).
   Counts come only from /nc/load, across every map and channel; never from nearby snapshots or capped social lists. */
(function () {
  'use strict';
  const NC = window.NC, O = NC.Online;
  if (!O || !O.enabled) return;
  const POLL_MS = 10000, FRESH_MS = 25000, DEFAULT_FPS = 60, GOOD_FPS = .9, FAIR_FPS = .6, TOP_EDGE = 6, DIAL_GAP = 12;
  let el, meta, count, mapCount, state, channel, ping, fps, clock, populationButton, mapPanel, mapList;
  let mapCounts = null, mapListKey = "";
  let snapshot = null, entered = false, transferring = false, population = null, sampledAt = 0;
  let nextPoll = 0, request = null, placementKey = '';
  const fmt = (n) => n.toLocaleString('en-US');
  const connected = () => O.status === 'online';
  function cancel() {
    if (request) request.controller.abort();
    request = null; population = null; mapCounts = null; sampledAt = 0; nextPoll = 0;
  }
  const wholeNumber = (n) => Number.isSafeInteger(n) && n >= 0;
  function presenceOf(value) {
    if (!value || !wholeNumber(value.total) || !value.maps || Array.isArray(value.maps) || typeof value.maps !== 'object') return null;
    const rows = Object.entries(value.maps);
    if (rows.some(([id, n]) => !id || !wholeNumber(n)) || rows.reduce((sum, [, n]) => sum + n, 0) !== value.total) return null;
    return { total: value.total, maps: new Map(rows) };
  }
  async function poll() {
    if (!entered || !connected() || request || Date.now() < nextPoll) return;
    const job = { origin: O.origin, controller: new AbortController() };
    request = job; nextPoll = Date.now() + POLL_MS;
    const timeout = setTimeout(() => job.controller.abort(), 4000);
    try {
      const response = await fetch(job.origin.replace(/\/+$/, '') + '/nc/load', {
        signal: job.controller.signal, cache: 'no-store', headers: { Accept: 'application/json' },
      });
      if (!response.ok) throw new Error('population unavailable');
      const result = await response.json();
      if (!Number.isSafeInteger(result.population) || result.population < 0) throw new Error('population invalid');
      if (request !== job || job.origin !== O.origin || !connected()) return;
      const presence = presenceOf(result.presence);
      population = presence ? presence.total : result.population; mapCounts = presence ? presence.maps : null; sampledAt = Date.now();
    } catch (e) {
      if (request === job) { population = null; mapCounts = null; sampledAt = 0; }
    } finally {
      clearTimeout(timeout);
      if (request === job) { request = null; render(); }
    }
  }
  function place() {
    if (!el) return;
    const mobile = document.documentElement.classList.contains('mob');
    const hud = document.getElementById('hud');
    if (mobile) {
      // CSS owns safe-area-local placement; reserve the row's real height, including larger tablet type.
      if (meta.parentNode !== el) el.prepend(meta);
      for (const prop of ['top', 'left', 'right', 'width']) { el.style.removeProperty(prop); meta.style.removeProperty(prop); }
      hud.style.setProperty('--ol-status-height', el.offsetHeight + 'px');
    } else {
      // PC, split in two (the owner's pick of four, 2026-10-18, scored 7.9 against 6.3 for one block under the map): the
      // machine's line (FPS, ping, time) along the screen's top edge left of the clock dial, out of the playing field;
      // the online counts one row under the map's name, with the map they count
      const anchor = document.querySelector('#hud .tr');
      if (!anchor) return;
      const r = anchor.getBoundingClientRect(), banner = document.querySelector('#hud .zonelbl'), dial = document.querySelector('#hud .dial');
      const under = banner && banner.getClientRects().length ? banner.getBoundingClientRect() : r;
      const left = dial && dial.getClientRects().length ? Math.min(r.left, dial.getBoundingClientRect().left) : r.left;
      el.style.top = (under.bottom + 2) + 'px'; el.style.left = 'auto';
      el.style.right = Math.max(8, innerWidth - r.right) + 'px';
      el.style.removeProperty('width');
      if (meta.parentNode !== hud) hud.appendChild(meta);
      meta.style.top = TOP_EDGE + 'px'; meta.style.left = 'auto';
      meta.style.right = Math.max(8, innerWidth - left + DIAL_GAP) + 'px';
      hud.style.removeProperty('--ol-status-height');
    }
    const r = el.getBoundingClientRect(), m = meta.getBoundingClientRect();
    const key = [mobile, r.top, r.left, r.width, r.height, m.top, m.left, innerWidth].join(':');
    if (key === placementKey) return;
    placementKey = key;
    window.dispatchEvent(new Event('nightcamp:online-hud-layout'));
  }
  function render() {
    if (!el) return;
    el.hidden = meta.hidden = !entered; // (on PC the machine's line is apart from the row: place())
    const on = connected(), fresh = on && population !== null && Date.now() - sampledAt < FRESH_MS;
    count.textContent = fresh ? fmt(population) + ' คน' : '— คน';
    count.title = fresh ? 'รวมผู้เล่นทุกแมพและทุกช่องในเซิร์ฟเวอร์นี้ · อัปเดตทุก 10 วินาที' : 'กำลังรอยอดออนไลน์จากเซิร์ฟเวอร์';
    const mapReady = fresh && mapCounts && snapshot && snapshot.mapId && !transferring;
    mapCount.textContent = mapReady ? fmt(mapCounts.get(snapshot.mapId) || 0) + ' คน' : '— คน';
    mapCount.title = 'รวมทุกช่องของแมพที่คุณอยู่ · รวมตัวคุณด้วย';
    populationButton.title = 'ดูจำนวนออนไลน์แยกแต่ละแมพ · รวมทุกช่อง';
    renderMaps(fresh && !!mapCounts);
    const message = O.status === 'channel' ? 'กำลังเปลี่ยนช่อง…' : transferring ? 'กำลังย้ายแมพ…' : on ? 'ออนไลน์รวม' : O.status === 'error' ? 'หลุดการเชื่อมต่อ' : O.status === 'offline' ? 'ออฟไลน์' : 'กำลังต่อใหม่…';
    state.textContent = message;
    el.classList.toggle('disconnected', !on);
    const rtt = on && Number.isFinite(O.rtt) && O.rtt >= 0 ? Math.round(O.rtt) : null;
    ping.textContent = rtt === null ? '— ms' : fmt(rtt) + ' ms';
    ping.parentElement.dataset.quality = rtt === null ? 'unknown' : rtt < 120 ? 'good' : rtt < 250 ? 'fair' : 'poor';
    channel.textContent = on && snapshot ? 'CH ' + snapshot.channelId : 'CH —';
    channel.hidden = !!NC.ChannelWin; // the current client already has its channel chip under the minimap
    channel.disabled = !on || !snapshot || !!(NC.OnlineChannels && NC.OnlineChannels.busy);
    channel.setAttribute('aria-label', 'เปลี่ยนช่อง · ' + channel.textContent);
    const sample = NC.game && NC.game.frameRate;
    const measured = !document.hidden && sample && Number.isFinite(sample.fps) && sample.fps > 0 &&
      Number.isFinite(sample.at) && performance.now() - sample.at >= 0 && performance.now() - sample.at <= 2500;
    fps.textContent = measured ? fmt(Math.round(sample.fps)) + ' FPS' : '— FPS';
    // Unity's colours against the rate the player picked (GameHud.MobileTopRight.cs StatusStrip: 90% / 60%)
    const cap = NC.Gfx ? NC.Gfx.frameCap : NC.Graphics && NC.Graphics.settings && NC.Graphics.settings.targetFps;
    const target = Number.isFinite(cap) && cap > 0 ? cap : DEFAULT_FPS;
    fps.dataset.quality = !measured ? 'unknown' : sample.fps >= target * GOOD_FPS ? 'good' : sample.fps >= target * FAIR_FPS ? 'fair' : 'poor';
    const now = new Date();
    clock.textContent = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    place();
  }
  const mapName = (id) => (NC.MAPS && NC.MAPS[id] && NC.MAPS[id].name) || 'พื้นที่พิเศษ';
  function renderMaps(ready) {
    const current = snapshot && snapshot.mapId;
    const entries = ready ? [...mapCounts.entries()] : [];
    if (ready && current && !mapCounts.has(current)) entries.push([current, 0]);
    entries.sort((a, b) => (b[0] === current) - (a[0] === current) || b[1] - a[1] || mapName(a[0]).localeCompare(mapName(b[0]), 'th'));
    const key = JSON.stringify([ready, current, entries]);
    if (key === mapListKey) return;
    mapListKey = key; mapList.replaceChildren();
    if (!ready) { mapList.textContent = 'กำลังรอจำนวนผู้เล่นจากเซิร์ฟเวอร์'; return; }
    for (const [id, n] of entries) {
      const row = document.createElement('div'); row.className = 'ol-map-row' + (id === current ? ' here' : '');
      const label = document.createElement('span'), value = document.createElement('strong');
      label.textContent = mapName(id) + (id === current ? ' · คุณอยู่ที่นี่' : ''); value.textContent = fmt(n) + ' คน';
      row.append(label, value); mapList.appendChild(row);
    }
    if (!entries.length) mapList.textContent = 'ยังไม่มีผู้เล่นออนไลน์';
  }
  function closeMaps() {
    if (!mapPanel) return;
    mapPanel.hidden = true; populationButton.setAttribute('aria-expanded', 'false');
  }
  function build() {
    if (el) return;
    el = document.createElement('section'); el.className = 'ol-hud'; el.hidden = true;
    el.setAttribute('aria-label', 'สถานะเซิร์ฟเวอร์');
    // Server strings are assigned with textContent; no player names are exposed in the counters.
    el.innerHTML = `<div class="ol-meta"><span class="ol-fps" title="เฟรมที่เกมวาดจริงต่อวินาที"></span>
        <span class="ol-latency"><i class="ol-signal" aria-hidden="true"><i></i><i></i><i></i></i><span class="ol-ping"></span></span><span class="ol-clock" title="เวลาในเครื่อง"></span><button type="button" class="ol-channel" aria-haspopup="dialog" aria-controls="ol-channel-picker" aria-expanded="false" title="เปลี่ยนช่อง"></button></div>
      <button type="button" class="ol-population" aria-expanded="false" aria-controls="ol-map-population">
        <span class="ol-server"><i class="ol-dot" aria-hidden="true"></i><span class="ol-state"></span><strong class="ol-total"></strong></span>
        <span class="ol-current-map"><span class="ol-map-label">แมพนี้</span><strong class="ol-map-total"></strong><i class="ol-caret" aria-hidden="true"></i></span>
      </button>
      <section id="ol-map-population" class="ol-pop-panel" aria-label="ออนไลน์แยกแต่ละแมพ" hidden>
        <header><b>ออนไลน์แต่ละแมพ</b><button type="button" class="ol-pop-close" aria-label="ปิดยอดออนไลน์">✕</button></header>
        <div class="ol-map-list"></div><small>รวมทุกช่องในเซิร์ฟเวอร์นี้ · อัปเดตทุก 10 วินาที</small>
      </section>`;
    const $ = (s) => el.querySelector(s);
    meta = $('.ol-meta'); count = $('.ol-total'); state = $('.ol-state'); channel = $('.ol-channel'); ping = $('.ol-ping');
    fps = $('.ol-fps'); clock = $('.ol-clock'); mapCount = $('.ol-map-total'); populationButton = $('.ol-population'); mapPanel = $('.ol-pop-panel'); mapList = $('.ol-map-list');
    populationButton.addEventListener('pointerdown', (e) => e.stopPropagation());
    populationButton.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape') closeMaps(); });
    populationButton.addEventListener('click', (e) => {
      e.stopPropagation(); mapPanel.hidden = !mapPanel.hidden;
      populationButton.setAttribute('aria-expanded', String(!mapPanel.hidden));
      if (!mapPanel.hidden) { render(); poll(); }
    });
    $('.ol-pop-close').addEventListener('click', (e) => { e.stopPropagation(); closeMaps(); populationButton.focus(); });
    mapPanel.addEventListener('pointerdown', (e) => e.stopPropagation());
    mapPanel.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape') { closeMaps(); populationButton.focus(); } });
    document.addEventListener('pointerdown', (e) => { if (!el.contains(e.target)) closeMaps(); });
    el.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !mapPanel.hidden) { e.stopPropagation(); closeMaps(); populationButton.focus(); } });
    channel.addEventListener('pointerdown', (e) => e.stopPropagation());
    channel.addEventListener('keydown', (e) => e.stopPropagation());
    channel.addEventListener('click', (e) => { e.stopPropagation(); if (NC.OnlineChannelPicker) NC.OnlineChannelPicker.open(channel); });
    document.getElementById('hud').appendChild(el);
  }
  O.on('snapshot', (s) => {
    const first = !entered, changedMap = snapshot && snapshot.mapId !== s.mapId;
    snapshot = s; entered = true; transferring = false;
    if (first) { build(); render(); poll(); }
    else if (changedMap) { nextPoll = 0; render(); poll(); }
  });
  O.on('transferring', () => { transferring = true; render(); });
  O.on('status', (s) => {
    if (s !== 'online') cancel();
    render();
    if (s === 'online') poll();
  });
  O.on('server', () => { cancel(); closeMaps(); snapshot = null; entered = false; transferring = false; render(); });
  O.on('channel', render); // channels.js clears busy after status=online; refresh the button before restoring its focus
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) { nextPoll = 0; render(); poll(); }
    else render();
  });
  window.addEventListener('resize', place);
  setInterval(() => { render(); if (!document.hidden) poll(); }, 1000);
})();
