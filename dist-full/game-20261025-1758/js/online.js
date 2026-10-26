/* Authoritative Nakama transport. Offline saves and simulation remain separate. */
(function () {
  'use strict';
  const NC = window.NC, params = new URLSearchParams(location.search), FX = NC.FX;
  const requested = params.has('online');
  const listeners = new Set(), remotes = new Map(), mobs = new Map(), presentation = new Set();
  const KEYS = NC.HOTKEYS || ['q', 'e', 'r', 'f', '3', '4', '5', '6'];
  // the jobs the job action takes: the first jobs until nc_status says which 2nd jobs are online (supportedJobs)
  let onlineJobs = new Set(['knight', 'mage', 'archer', 'rogue']);
  const jobOnline = (job) => onlineJobs.has(job);
  // a job's live numbers from the server onto the fields its skill file draws from, and the gauges it draws them with:
  // the per-job tables are js/online-meters.js
  const METERS = NC.OnlineMeters || { sync() {}, dotFill() {} };
  const syncMeters = (p, meters) => METERS.sync(p, meters, NC.game);
  const ONLINE_PASSIVES = new Set(['mastery', 'body', 'mind']);
  let active = requested, ready = false, game, socket, matchId = '', playerId = '';
  let generation = 0, seq = 0, offline, auth = {}, applying = false, retryTimer, watchdog, pingTimer, connectionOptions = {}, presentationContext = null, snapshotCache = null;
  let inputAt = 0, attackAt = 0, pickupAt = 0, lastInput = '', reconnectAttempt = 0, lastSnapshotAt = 0, uiSignature = '';
  let transfer = false, movement = { dx: 0, dy: 0, running: false }, correction = { x: 0, y: 0 }, supportedSkills = null;
  const state = { status: 'offline', playerId: '', matchId: '', mapId: '', channelId: '', rttMs: null, tick: 0, lastSnapshotAt: 0, lastSnapshot: null, lastError: '', sent: [], received: [], rendered: [], bytesReceived: 0 };
  const online = NC.Online = {
    get active() { return active; }, get ready() { return ready; }, remotes,
    connect, disconnect, sendIntent, update, init, collect, drawRemote, drawTags,
    warp: (portalId) => sendIntent(5, { portalId }),
    action: (action, fields = {}) => sendIntent(6, { action, ...fields }),
    gearRev: () => gear.rev, // (the bag or storage changed: a window's signature, js/online-gear.js)
    getState: () => ({ ...state, active, ready, playerId, matchId, pendingInputs: state.sent.filter(s => s.seq > (state.lastSnapshot?.ackSeq || 0)).length }),
    onSnapshot: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    supportsSkill: (id) => !supportedSkills || supportedSkills.has(id),
    chat: async (action, fields = {}) => {
      if (!ready || !socket) throw new Error('ยังไม่ได้เชื่อมต่อแชต กรุณารอเข้าเกม');
      const ws = socket, currentGeneration = generation;
      const reply = await ws.rpc('nc_chat', JSON.stringify({ action, ...fields }));
      if (!active || currentGeneration !== generation || ws !== socket) return null;
      return typeof reply.payload === 'string' ? JSON.parse(reply.payload) : reply.payload;
    },
  };
  const base = {};
  const scalarFields = ['name', 'job', 'lv', 'xp', 'jobLv', 'jobXp', 'hp', 'maxHp', 'sp', 'maxSp', 'dead', 'potions', 'spPotions', 'gold', 'coins', 'base', 'skills', 'equip', 'look', 'appearance', 'hotbar', 'owned', 'mats', 'bag', 'wu'];
  const readOnly = (obj) => new Proxy(obj, { set: () => true, deleteProperty: () => true, defineProperty: () => true });
  // `alsoHas` widens has() only (the free wardrobe: every costume counts as available); iteration/size stay the real collection
  const readOnlySet = (values, alsoHas) => {
    const set = new Set(values);
    return new Proxy(set, { get(target, key) { if (key === 'add' || key === 'delete' || key === 'clear') return () => key === 'delete' ? false : set; if (key === 'has' && alsoHas) return (id) => target.has(id) || alsoHas(id); const value = Reflect.get(target, key, target); return typeof value === 'function' ? value.bind(target) : value; } });
  };
  // ---- free wardrobe (backend/wardrobe.go): record.look draws a costume per slot on top of record.equip; stats stay on equip ----
  const LOOK_SLOTS = ['hat', 'glasses', 'hair', 'top', 'pants', 'robe', 'cape', 'shoes'], LOOK_HIDE = new Set(['hat', 'glasses', 'robe', 'cape']), LOOK_NONE = 'none', OUTFIT_SLOTS = ['top', 'pants', 'shoes'];
  const lookViews = new WeakMap(); // an authoritative equip object -> the equip that is drawn
  let selfOwned = new Set();
  const wearable = (id) => { const it = NC.ITEMS[id]; return !!it && LOOK_SLOTS.includes(it.slot) && NC.itemReady(id); };
  function lookEquip(equip, look, appearance) {
    const view = { ...equip };
    for (const slot of LOOK_SLOTS) {
      const id = look?.[slot];
      if (slot === 'hair' && id === 'created' && appearance) {
        const key = ['g', 'hair', 'hc', 'eyes', 'ec', 'mouth'].map(k => appearance[k]).join('-');
        view[slot] = NC.Look?.register(key) || equip[slot];
      }
      else if (id === LOOK_NONE && LOOK_HIDE.has(slot)) view[slot] = null;
      else if (id && NC.ITEMS[id]?.slot === slot) view[slot] = id;
    }
    return view;
  }
  const shown = (equip) => (active && equip && lookViews.get(equip)) || equip;
  // FX 'hero' after-images copy p.equip: find whose copy it is (same place, same gear) and draw that hero's look
  function shownCopy(effect) {
    for (const actor of [game?.player, ...remotes.values()]) {
      const eq = actor?.equip, view = eq && lookViews.get(eq);
      if (view && Math.abs(actor.x - effect.x) < 1 && Math.abs(actor.y - effect.y) < 1 && Object.keys(eq).every(slot => (eq[slot] || null) === (effect.equip[slot] || null))) return { ...view };
    }
    return effect.equip;
  }
  function wear(itemId) {
    const it = NC.ITEMS[itemId], p = game.player, look = p.look || {};
    if (!it) return false;
    if (!LOOK_SLOTS.includes(it.slot)) return online.action('equip', { itemId, slot: it.slot }); // weapons: owned gear only
    if (selfOwned.has(itemId)) { // real gear (stats): one equip puts it on and shows it (the server drops the slot's look, and a robe for a top/pants/shoes, js/items.js:262)
      const outfit = OUTFIT_SLOTS.includes(it.slot);
      if (LOOK_HIDE.has(it.slot) && p.equip[it.slot] === itemId && !look[it.slot]) return online.action('equip', { slot: it.slot, itemId: '' }); // click the worn one again: off (js/items.js:258)
      if (p.equip[it.slot] !== itemId || (outfit && p.equip.robe)) return online.action('equip', { itemId, slot: it.slot });
      const change = {}; // already worn: only the costume over it comes off (no gear write)
      if (look[it.slot]) change[it.slot] = '';
      if (outfit && look.robe) change.robe = '';
      return Object.keys(change).length ? online.action('wardrobe', { look: change }) : false;
    }
    if (!wearable(itemId)) return false;
    if (look[it.slot] === itemId) return online.action('wardrobe', { slot: it.slot, itemId: '' }); // click the worn costume again: back to the gear
    const change = { [it.slot]: itemId };
    if (OUTFIT_SLOTS.includes(it.slot) && shown(p.equip).robe) change.robe = LOOK_NONE; // a piece of an outfit: the long outfit comes off (js/items.js:262)
    return online.action('wardrobe', { look: change });
  }
  // a set row (class, boss or fashion, js/items.js:238) puts on its whole look; pieces equal to the real gear just clear the override
  function wearSet(setId) {
    const C = NC.CLASSES.find(c => c.id === setId), p = game.player; if (!C) return false;
    const look = {};
    for (const [slot, id] of Object.entries(C.items)) {
      if (!LOOK_SLOTS.includes(slot) || id === undefined) continue;
      if ((id || null) === (p.equip[slot] || null)) look[slot] = '';
      else if (id === null) { if (LOOK_HIDE.has(slot)) look[slot] = LOOK_NONE; }
      else if (wearable(id)) look[slot] = id;
    }
    return Object.keys(look).length ? online.action('wardrobe', { look }) : false;
  }
  // the set row being shown: like NC.classOf (js/items.js:254) but without the weapon, which a look never changes online
  const setOf = (equip) => (NC.CLASSES.find(c => Object.keys(c.items).every(s => s === 'weapon' || (c.items[s] || null) === (equip[s] || null))) || {}).id;
  function decorateWardrobe() {
    const p = game.player, view = shown(p.equip), look = p.look || {}, costumes = Object.keys(look).length;
    for (const cell of document.querySelectorAll('#eq-grid .eq-cell')) {
      const id = cell.dataset.id, it = NC.ITEMS[id]; if (!it) continue;
      cell.classList.toggle('worn', view[it.slot] === id);
      cell.dataset.costume = !selfOwned.has(id) && wearable(id) ? 'free' : '';
    }
    const worn = setOf(view);
    document.querySelectorAll('#eq-classes button, #eq-bosses button, #eq-fashion button').forEach(b => b.classList.toggle('on', b.dataset.cls === worn));
    const count = document.getElementById('eq-count');
    if (count && costumes) count.textContent += ` · แต่งตัว ${costumes} ช่อง`;
    let reset = document.getElementById('online-look-reset');
    if (!reset && count) {
      reset = document.createElement('button'); reset.id = 'online-look-reset'; reset.type = 'button';
      reset.textContent = 'ถอดชุดแต่ง'; reset.title = 'กลับไปแสดงอุปกรณ์ที่สวมจริง';
      reset.addEventListener('click', () => online.action('wardrobe', { kind: 'clear' }));
      count.after(reset);
    }
    if (reset) reset.hidden = !costumes;
  }
  // a free costume panel (EquipUI.renderInfo sees it as owned through the widened has()): no stat bullets, since the look
  // gives none, and the worn state comes from what is drawn, not from the real equip
  function wardrobeNote(info, id) {
    if (!id || selfOwned.has(id) || !wearable(id) || !info) return;
    info.querySelector('ul')?.remove();
    const state = info.querySelector('.eq-state');
    if (state) state.textContent = shown(game.player.equip)[NC.ITEMS[id].slot] === id ? '✔ สวมอยู่ (คลิกอีกครั้งเพื่อถอด)' : 'คลิกเพื่อสวมใส่';
    info.appendChild(availabilityNote('ชุดแต่งตัวฟรี (ออนไลน์): เปลี่ยนแค่รูปลักษณ์ ไม่เพิ่มสเตตัส · คลิกเพื่อใส่ คลิกอีกครั้งเพื่อถอด'));
  }
  function protectPlayer(p) {
    for (const field of scalarFields) Object.defineProperty(p, field, {
      configurable: true, enumerable: true,
      get: () => auth[field],
      set: (value) => {
        if (applying) auth[field] = value;
        else if (field === 'name' && value !== auth.name) online.action('name', { name: String(value) });
      },
    });
  }
  function safeError(error) {
    if (typeof error === 'string') return error.slice(0, 180);
    return String(error?.message || error?.statusText || 'เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ').slice(0, 180);
  }
  let perfWaiting = false, perfReturnPhase = 'active', perfStatus = '';
  function profileStatus(value, waiting = active && !ready) {
    const perf = NC.Perf;
    if (!perf?.enabled) return;
    if (waiting) {
      if (!perfWaiting) perfReturnPhase = perf.phase;
      perfWaiting = true; perf.setPhase('map-loading');
    } else if (perfWaiting) {
      perfWaiting = false;
      perf.setPhase(game?.paused ? 'paused' : perfReturnPhase === 'warmup' ? 'warmup' : 'active');
    }
    if (value !== perfStatus) { perf.mark('online-status', { status: value, mapId: game?.mapId || '' }); perfStatus = value; }
  }
  function status(value, message = '') {
    state.status = value; state.lastError = message;
    profileStatus(value);
    const badge = document.getElementById('online-state');
    const words = { offline: 'OFFLINE · ตัวละครในเครื่อง', connecting: 'กำลังเชื่อมต่อ…', syncing: 'กำลังรับข้อมูลตัวละคร…', online: 'ONLINE · เซิร์ฟเวอร์จริง', reconnecting: 'ขาดการเชื่อมต่อ · กำลังเชื่อมใหม่', error: 'เชื่อมต่อไม่สำเร็จ', transferring: 'กำลังย้ายแผนที่…' };
    if (badge) badge.textContent = words[value] || value;
    const note = document.getElementById('online-detail');
    if (note) note.textContent = message || (ready ? `${game.player.name} · ${NC.MAPS[game.mapId]?.name || game.mapId} · CH ${state.channelId} · ${state.rttMs == null ? 'วัด ping…' : Math.round(state.rttMs) + ' ms'}` : 'ตัวละครออนไลน์สร้างและบันทึกที่เซิร์ฟเวอร์ แยกจากเซฟในเครื่อง');
    const button = document.getElementById('online-connect');
    if (button) { button.textContent = active ? 'กลับออฟไลน์' : 'เข้าเล่นออนไลน์'; button.dataset.connected = String(active); }
    const revive = document.getElementById('online-revive'); if (revive) revive.disabled = !ready || !(game?.player.dead > 0);
    renderMerchant();
    document.body.classList.toggle('authoritative-online', active);
    const net = document.querySelector('.netlist'); if (net && active) net.hidden = true;
  }
  function deviceId() {
    const key = 'nightcamp.online.device.v1';
    let id = localStorage.getItem(key);
    if (!id || !/^[a-f0-9-]{36}$/i.test(id)) { id = crypto.randomUUID(); localStorage.setItem(key, id); }
    return id;
  }
  // (the old dark status / skills / bag / map windows it used to close are gone, 2026-10-21)
  function resetCharacterUi() {
    uiSignature = '';
  }
  function rememberOffline() {
    if (offline) return;
    NC.Chat?.resetOnline();
    NC.saveGame(game);
    offline = {};
    for (const key of ['player', 'world', 'mapId', 'enemies', 'respawns', 'loot', 'portals', 'flies', 'target', 'hover', 'noSave', 'kills']) offline[key] = game[key];
    if (NC.Auto?.on) NC.Auto.stop(game, 'เข้าออนไลน์');
    base.creatorClose?.(false);
    if (NC.Net) { NC.Net.online = false; NC.Net.remotes.clear(); }
    game.noSave = true; game.enemies = []; game.respawns = []; game.loot = [];
    const placeholder = NC.makePlayer(game.world.spawn.x, game.world.spawn.y);
    NC.initHero(placeholder, {});
    placeholder.stats = NC.gearStats(placeholder.equip); placeholder.d = NC.derive(placeholder);
    placeholder.mats = {}; placeholder.matSeen = new Set(); placeholder.matNew = new Set(); placeholder.online = true;
    auth = { ...placeholder, name: 'กำลังเชื่อมต่อ', coins: 0, gold: 0, base: readOnly({ ...placeholder.base }), skills: readOnly({ ...placeholder.skills }), equip: readOnly({ ...placeholder.equip }), owned: readOnlySet([]), hotbar: readOnly({ ...placeholder.hotbar }), mats: readOnly({}) };
    protectPlayer(placeholder); game.player = placeholder;
    resetCharacterUi();
    FX.list.length = 0;
    for (const id of ['pause', 'creator', 'shop', 'vend', 'vbuy', 'party']) { const el = document.getElementById(id); if (el) el.hidden = true; }
    game.paused = false;
  }
  async function connect(options = {}) {
    if (!game) throw new Error('เกมยังโหลดไม่เสร็จ');
    if (socket && ['connecting', 'syncing', 'online', 'transferring'].includes(state.status)) return online.getState();
    connectionOptions = { ...connectionOptions, ...options };
    rememberOffline(); active = true; ready = false; clearTimeout(retryTimer);
    const thisGeneration = ++generation;
    status(reconnectAttempt ? 'reconnecting' : 'connecting');
    try {
      const config = window.NC_ONLINE_CONFIG || {};
      const endpoint = new URL(connectionOptions.endpoint || config.endpoint || `${location.protocol === 'https:' ? 'https:' : 'http:'}//${location.hostname || 'localhost'}:7350`);
      state.endpoint = endpoint.origin;
      if (!['http:', 'https:'].includes(endpoint.protocol)) throw new Error('ที่อยู่เซิร์ฟเวอร์ต้องเป็น HTTP หรือ HTTPS');
      const client = new window.Nakama.Client(config.serverKey || 'nightcamp-local-key', endpoint.hostname, endpoint.port || (endpoint.protocol === 'https:' ? '443' : '80'), endpoint.protocol === 'https:');
      const session = await client.authenticateDevice(deviceId(), true);
      if (thisGeneration !== generation) return;
      playerId = session.user_id; state.playerId = playerId;
      const healthReply = await client.rpc(session, 'nc_status', {});
      if (thisGeneration !== generation || !active) return;
      const health = typeof healthReply.payload === 'string' ? JSON.parse(healthReply.payload) : healthReply.payload;
      state.contentVersion = health.contentVersion;
      if (health.update && health.update.protocolVersion !== 1) {
        status('error', 'ระบบออนไลน์มีเวอร์ชันใหม่ กรุณารีโหลดเกมเพื่ออัปเดต');
        return online.getState();
      }
      if (health.contentVersion !== window.NC_ONLINE_CONTENT_VERSION) {
        status('error', 'ข้อมูลเกมกับเซิร์ฟเวอร์คนละเวอร์ชัน กรุณาอัปเดตหรือรีโหลดเกม');
        return online.getState();
      }
      supportedSkills = new Set(health.supportedSkills || []);
      state.supportedSkills = [...supportedSkills];
      if (Array.isArray(health.supportedJobs)) onlineJobs = new Set(health.supportedJobs);
      const adapter = config.socketFormat !== 'json' && window.Nakama.createProtobufAdapter ? window.Nakama.createProtobufAdapter() : undefined;
      const ws = client.createSocket(endpoint.protocol === 'https:', false, adapter); socket = ws;
      if (!adapter && window.Nakama.makeAdapterCloseIdempotent) window.Nakama.makeAdapterCloseIdempotent(ws.adapter);
      ws.onmatchdata = (message) => { if (thisGeneration === generation) onData(message); };
      ws.onnotification = (notification) => {
        if (thisGeneration !== generation || !active || Number(notification.code) !== 101) return;
        const content = typeof notification.content === 'string' ? JSON.parse(notification.content) : notification.content;
        if (content?.type === 'chat') NC.Chat?.receiveOnline(content.message);
      };
      ws.ondisconnect = () => { if (thisGeneration === generation && active) lost('การเชื่อมต่อขาดหาย ระบบหยุดส่งคำสั่งจนกว่าจะรับข้อมูลใหม่'); };
      ws.onerror = () => { if (thisGeneration === generation && active) lost('เครือข่ายมีปัญหา กำลังเชื่อมต่อใหม่'); };
      await ws.connect(session, true);
      if (thisGeneration !== generation) { ws.disconnect(); return; }
      const requestedChannel = connectionOptions.channelId || null;
      const reply = await client.rpc(session, 'nc_join', { platform: 'web', protocolVersion: 1, contentVersion: window.NC_ONLINE_CONTENT_VERSION, ...(requestedChannel ? { channelId: String(requestedChannel) } : {}) });
      if (thisGeneration !== generation || !active || socket !== ws) return;
      const joined = typeof reply.payload === 'string' ? JSON.parse(reply.payload) : reply.payload;
      if (!joined?.matchId) throw new Error('เซิร์ฟเวอร์ไม่ได้คืนห้องเกม');
      seq = 0; state.sent.length = 0; state.received.length = 0; state.rendered.length = 0; inputAt = 0; lastInput = ''; correction = { x: 0, y: 0 }; snapshotCache = null;
      matchId = joined.matchId; state.matchId = matchId;
      status('syncing'); lastSnapshotAt = performance.now();
      await ws.joinMatch(matchId, undefined, { eventBatch: '1' });
      if (thisGeneration !== generation) return;
      clearInterval(watchdog); watchdog = setInterval(() => {
        if (active && performance.now() - lastSnapshotAt > 7000) lost('ไม่ได้รับสถานะเกมจากเซิร์ฟเวอร์ กำลังเชื่อมต่อใหม่');
      }, 1000);
      clearInterval(pingTimer); pingTimer = setInterval(() => { if (ready) sendIntent(7, { id: crypto.randomUUID(), clientTime: performance.now() }); }, 1500);
      return online.getState();
    } catch (error) {
      if (thisGeneration !== generation) return;
      lost(safeError(error));
      return online.getState();
    }
  }
  function lost(message) {
    if (!active) return;
    ready = false; transfer = false; ++generation;
    const old = socket; socket = null; try { old?.disconnect(); } catch (_) {}
    clearInterval(watchdog); clearInterval(pingTimer); clearTimeout(retryTimer);
    movement = { dx: 0, dy: 0, running: false };
    if (game?.player) { game.player.moving = false; game.player.vx = game.player.vy = 0; }
    status('reconnecting', message);
    const delay = Math.min(10000, 750 * 2 ** Math.min(reconnectAttempt++, 4));
    retryTimer = setTimeout(() => connect(), delay);
  }
  async function disconnect() {
    profileStatus('disconnecting', true);
    active = false; ready = false; const thisGeneration = ++generation; clearTimeout(retryTimer); clearInterval(watchdog); clearInterval(pingTimer);
    const old = socket; socket = null;
    try { if (old && matchId) await old.leaveMatch(matchId); } catch (_) {}
    try { old?.disconnect(); } catch (_) {}
    if (generation !== thisGeneration || active) return;
    NC.Chat?.resetOnline();
    if (NC.Auto?.on) NC.Auto.stop(game, 'กลับออฟไลน์');
    if (offline) { Object.assign(game, offline); offline = null; }
    resetCharacterUi();
    NC.HUD.refreshHead?.(game);
    remotes.clear(); mobs.clear(); presentation.clear(); FX.list.length = 0;
    matchId = ''; playerId = ''; state.lastSnapshot = null; state.lastSnapshotAt = 0; snapshotCache = null; reconnectAttempt = 0;
    game.paused = false;
    if (NC.HUD.mapChanged) NC.HUD.mapChanged(game);
    status('offline');
  }
  function sendIntent(op, fields = {}) {
    if (op === 6 && fields.action === 'gm') return false;
    if (!ready || !socket || !matchId) return false;
    const payload = op === 7 ? fields : { ...fields, seq: ++seq };
    const record = { op, seq: payload.seq || 0, time: performance.now(), payload };
    state.sent.push(record); if (state.sent.length > 240) state.sent.shift();
    const ws = socket, thisGeneration = generation;
    ws.sendMatchState(matchId, op, new TextEncoder().encode(JSON.stringify(payload))).catch(() => { if (active && generation === thisGeneration && socket === ws) lost('ส่งคำสั่งไม่สำเร็จ'); });
    window.dispatchEvent(new CustomEvent('nightcamp:online-intent', { detail: record }));
    return payload.seq || true;
  }
  function onData(message) {
    if (message.match_id && message.match_id !== matchId) return;
    try {
      state.bytesReceived += typeof message.data === 'string' ? new TextEncoder().encode(message.data).byteLength : message.data.byteLength;
      const data = JSON.parse(typeof message.data === 'string' ? message.data : new TextDecoder().decode(message.data));
      const op = Number(message.op_code);
      if (op === 101) { const full = mergeSnapshot(data); if (full) snapshot(full); }
      else if (op === 102) {
        const events = data?.type === 'eventBatch' ? data.events : [data];
        if (!Array.isArray(events) || events.length > 128 || events.some((e) => !e || typeof e !== 'object' || Array.isArray(e) || typeof e.type !== 'string' || e.type === 'eventBatch')) throw new Error('invalid event batch');
        const current = generation;
        for (const e of events) { event(e); if (generation !== current) break; }
      }
      else if (op === 103) { state.rttMs = Math.max(0, performance.now() - data.clientTime); status(state.status); }
      else if (op === 104) moveToMatch(data);
    } catch (error) { console.warn('online: invalid server message', safeError(error)); }
  }
  // the bag and the camp storage arrive on their own, only when they change (backend bag_wire.go, the owner,
  // 2026-10-08: a big bag must not lag): kept here, read-only views built once per change, never by a snapshot
  const freezeCopies = (list) => readOnly((list || []).map(c => readOnly({ ...c, rows: readOnly((c.rows || []).map(r => readOnly({ ...r }))), heat: readOnly({ ...(c.heat || {}) }) })));
  const gear = { bag: freezeCopies([]), store: freezeCopies([]), rev: 0 };
  function takeGear(packet) {
    if (packet.bag !== undefined) { gear.bag = freezeCopies(packet.bag); gear.rev++; delete packet.bag; }
    if (packet.store !== undefined) { gear.store = freezeCopies(packet.store); gear.rev++; delete packet.store; }
  }
  function mergeSnapshot(packet) {
    takeGear(packet);
    if (packet.full !== false) { snapshotCache = packet; return packet; }
    if (!snapshotCache || snapshotCache.mapId !== packet.mapId || snapshotCache.channelId !== packet.channelId) {
      lost('ข้อมูลเกมขาดช่วง กำลังรับสถานะใหม่'); return null;
    }
    const mergeEntities = (previous, changes, removed) => {
      const entities = new Map((previous || []).map(entity => [entity.id, entity]));
      for (const id of removed || []) entities.delete(id);
      for (const change of changes || []) entities.set(change.id, { ...entities.get(change.id), ...change });
      return [...entities.values()];
    };
    snapshotCache = { ...snapshotCache, ...packet,
      self: { ...snapshotCache.self, ...packet.self },
      players: mergeEntities(snapshotCache.players, packet.players, packet.removedPlayers),
      monsters: mergeEntities(snapshotCache.monsters, packet.monsters, packet.removedMonsters),
      loot: packet.loot || snapshotCache.loot || [],
    };
    return snapshotCache;
  }
  async function moveToMatch(data) {
    if (!data.matchId || transfer) return;
    const ws = socket, thisGeneration = generation;
    transfer = true; ready = false; status('transferring');
    try {
      await ws.leaveMatch(matchId);
      if (!active || generation !== thisGeneration || socket !== ws) return;
      matchId = data.matchId; state.matchId = matchId; snapshotCache = null; remotes.clear(); mobs.clear(); presentation.clear();
      await ws.joinMatch(matchId, undefined, { eventBatch: '1' });
      if (!active || generation !== thisGeneration || socket !== ws) return;
      transfer = false;
    } catch (error) { if (active && generation === thisGeneration && socket === ws) lost(safeError(error)); }
  }
  function applyRecord(record, p, isSelf) {
    const hb = Array.isArray(record.hotbar) ? Object.fromEntries(KEYS.map((key, i) => [key, record.hotbar[i] || null])) : { ...(record.hotbar || {}) };
    const data = { ...record, coins: record.gold || 0, base: readOnly({ ...(isSelf ? NC.START_STATS : p.base || NC.START_STATS), ...record.base }), skills: readOnly({ ...(isSelf ? {} : p.skills), ...record.skills }), equip: readOnly({ ...(isSelf ? {} : p.equip), ...record.equip }), hotbar: readOnly(hb), owned: readOnlySet(record.owned || [], isSelf ? wearable : null), mats: readOnly({ ...(record.mats || {}) }) };
    data.appearance = record.appearance ? readOnly({ ...record.appearance }) : null;
    data.look = readOnly({ ...(record.look || {}) }); // replaced whole, never merged: a removed slot must disappear
    // (the hero's own pieces come from the gear holder above; an older server still sends self.bag)
    data.bag = isSelf ? (record.bag ? freezeCopies(record.bag) : gear.bag) : freezeCopies(record.bag);
    if (isSelf) data.store = gear.store;
    data.wu = readOnly({ ...(record.wu || {}) });
    lookViews.set(data.equip, lookEquip(data.equip, data.look, record.appearance));
    if (isSelf) { auth = data; applying = true; selfOwned = new Set(record.owned || []); }
    else Object.assign(p, data);
    try {
      p.buffs = { ...(record.buffs || {}) };
      syncMeters(p, record.meters);
      p.stats = NC.gearStats(p.equip); p.d = NC.derive(p);
      p.cd = { pot: 0, sppot: 0, ...(record.cd || {}) };
      for (const [id, value] of Object.entries(record.cd || {})) p.cd[id.startsWith('@') ? id : '@' + id] = value;
      if (isSelf) {
        const cast = record.casting;
        if (cast?.remaining > 0) {
          const duration = p.casting?.id === cast.skillId ? Math.max(p.casting.T, cast.remaining) : cast.remaining;
          p.casting = { id: cast.skillId, name: NC.SKILLS[cast.skillId]?.name || cast.skillId, t: duration - cast.remaining, T: duration };
        } else p.casting = null;
      }
      p.id = record.id; p.sort = p.y;
      p.fresh ||= new Set(); p.matSeen ||= new Set(); p.matNew ||= new Set(); p.buffLv ||= {};
      if (!isSelf) { p.hp = record.hp; p.maxHp = record.maxHp; p.sp = record.sp; p.maxSp = record.maxSp; }
    } finally { applying = false; }
  }
  function snapshot(data) {
    if (!data.self || !NC.MAPS[data.mapId]) return;
    const at = performance.now(), first = !ready || !game.player.online;
    const mapChanged = game.mapId !== data.mapId;
    lastSnapshotAt = at; state.lastSnapshotAt = at; state.lastSnapshot = data;
    state.tick = data.tick; state.serverTime = data.serverTime; state.mapId = data.mapId; state.channelId = data.channelId;
    if (!game.player.online) {
      const p = NC.makePlayer(data.self.x, data.self.y);
      NC.initHero(p, data.self); p.online = true; game.player = p; auth = { ...data.self }; protectPlayer(p);
    }
    if (mapChanged) {
      const world = NC.Maps.world(data.mapId); game.world = world; game.mapId = data.mapId;
      game.portals = NC.Maps.portals(world); game.flies = []; game.respawns = []; game.zoneName = '';
      mobs.clear(); remotes.clear(); presentation.clear(); FX.list.length = 0;
      NC.HUD.mapChanged?.(game);
    }
    const p = game.player, oldX = p.x, oldY = p.y;
    applyRecord(data.self, p, true);
    // Reconcile the server anchor with only a bounded, unacknowledged movement tail.
    const pending = state.sent.filter(s => s.op === 1 && s.seq > (data.ackSeq || 0));
    let targetX = data.self.x, targetY = data.self.y;
    for (let i = 0; i < pending.length; i++) {
      const command = pending[i], end = pending[i + 1]?.time || at;
      const dt = Math.max(0, Math.min(0.1, (end - command.time) / 1000));
      const speed = data.self.speed ?? 310 * (1 + (p.stats?.spd || 0));
      targetX += command.payload.dx * speed * dt; targetY += command.payload.dy * speed * dt;
    }
    if (first || mapChanged || Math.hypot(oldX - targetX, oldY - targetY) > 180 || p.dead > 0) { p.x = data.self.x; p.y = data.self.y; correction = { x: 0, y: 0 }; }
    else correction = { x: targetX - oldX, y: targetY - oldY };
    if (first || mapChanged) { game.cam.x = NC.clamp(p.x - game.vw / 2, 0, game.world.W - game.vw); game.cam.y = NC.clamp(p.y - game.vh / 2, 0, game.world.H - game.vh); }
    const seenPlayers = new Set();
    for (const record of data.players || []) {
      if (record.id === playerId || record.id === data.self.id) continue;
      seenPlayers.add(record.id); let remote = remotes.get(record.id);
      if (!remote) { remote = NC.makePlayer(record.x, record.y); remote.kind = 'ally'; remote.remote = true; remote.online = true; NC.initHero(remote, record); remotes.set(record.id, remote); }
      const x = remote.x, y = remote.y; applyRecord(record, remote, false);
      remote.tx = record.x; remote.ty = record.y; remote.x = x; remote.y = y; remote.lastInputSeq = record.lastInputSeq;
      remote.receivedAt = at;
    }
    for (const id of remotes.keys()) if (!seenPlayers.has(id)) remotes.delete(id);
    const seenMobs = new Set();
    for (const record of data.monsters || []) {
      if (record.dead || record.hp <= 0 || !NC.MONSTERS[record.type]) continue;
      seenMobs.add(record.id); syncMonster(record);
    }
    for (const id of mobs.keys()) if (!seenMobs.has(id)) mobs.delete(id);
    game.enemies = [...mobs.values()]; game.respawns = [];
    game.loot = (data.loot || []).map(l => ({ ...l, lootId: l.id, id: l.itemId || '', potion: l.itemId === 'potion' ? 'red' : l.itemId === 'sp_potion' ? 'blue' : null, kind: 'loot', online: true, sort: l.y, t: 1, z: 0, vz: 0 }));
    ready = true; transfer = false; reconnectAttempt = 0;
    const record = { tick: data.tick, at, ackSeq: data.ackSeq, players: (data.players || []).map(r => ({ id: r.id, x: r.x, y: r.y, lastInputSeq: r.lastInputSeq })) };
    state.received.push(record); if (state.received.length > 240) state.received.shift();
    status('online');
    if (first) NC.Chat?.syncOnline();
    else NC.Chat?.syncScopeOnline?.(); // map/channel and authoritative party/guild changes invalidate chat cursors
    const signature = JSON.stringify([auth.name, auth.job, auth.lv, auth.jobLv, auth.base, auth.skills, auth.equip, auth.look, auth.appearance, auth.hotbar, data.self.owned, gear.rev, auth.wu]);
    if (signature !== uiSignature) {
      uiSignature = signature; NC.HUD.refreshHead?.(game);
      if (!document.getElementById('status')?.hidden) NC.HUD.renderStatus?.();
      if (!document.getElementById('skills')?.hidden) NC.HUD.renderSkills?.();
      if (!document.getElementById('bag')?.hidden) NC.EquipUI.render?.();
    }
    for (const listener of listeners) { try { listener(data, at); } catch (_) {} }
    window.dispatchEvent(new CustomEvent('nightcamp:online-snapshot', { detail: { snapshot: data, receivedAt: at } }));
  }
  function actor(id) { return id === playerId || id === game.player.id ? game.player : remotes.get(id) || mobs.get(id); }
  function event(data) {
    window.dispatchEvent(new CustomEvent('nightcamp:online-event', { detail: { ...data, receivedAt: performance.now() } }));
    if (data.type === 'error') { state.lastError = data.message || data.code; game.toast(state.lastError); status(state.status, state.lastError); return; }
    if (data.type === 'combat') {
      const target = actor(data.targetId), source = actor(data.sourceId || data.actorId);
      if (target) combatLooks(target, source, data);
      if (source && source.kind !== 'enemy' && !data.dot) { // a poison tick is not the rogue fighting (entities.js:502)
        source.lastFight = game.time;
      }
    } else if (data.type === 'attack') {
      const source = actor(data.sourceId || data.actorId); if (source && source.kind !== 'enemy') { source.aim = data.aim ?? source.aim; basicVisual(source, data); }
    } else if (data.type === 'cast' || data.type === 'skill') {
      const source = actor(data.sourceId || data.actorId);
      if (source && source.kind !== 'enemy' && data.auto) skillVisual(source, data.skillId, data); // an autospell (backend/skills_passives.go)
      else if (source && source.kind !== 'enemy') {
        source.aim = data.aim ?? source.aim; source.lastAcceptedCastSeq = data.seq;
        if (data.duration > 0) {
          const currentGeneration = generation;
          if (NC.Anim.CLIPS.castHold) NC.Anim.play(source.anim, 'castHold');
          source.casting = { id: data.skillId, name: NC.SKILLS[data.skillId]?.name || data.skillId, t: 0, T: data.duration };
          FX.add({ type: 'timer', layer: 'none', life: data.duration, onEnd() {
            source.casting = null;
            if (ready && generation === currentGeneration && source.dead <= 0) skillVisual(source, data.skillId, data);
          } });
        } else skillVisual(source, data.skillId, data);
      }
    }
    else if (data.type === 'server_shutdown') lost('เซิร์ฟเวอร์กำลังเริ่มใหม่ กำลังเชื่อมต่อกลับ');
    else if (data.type === 'travel') {
      NC.HUD.panel('journal', false); game.paused = false;
      NC.HUD.log(`ลูกไฟนำทางพาไป ${NC.MAPS[data.mapId]?.name || data.mapId}${data.gold ? ` (${NC.fmtCoins(data.gold)} เหรียญ)` : ' (ฟรี)'}`, 'item');
    }
    else if (data.type === 'reward') { NC.HUD.log(`ได้รับ EXP ${data.xp || 0} · Job EXP ${data.jobXp || 0}${data.gold ? ' · ' + data.gold + ' เหรียญ' : ''}`, 'item'); }
  }
  // A server monster record onto its local monster. The server's `poisoned` flag becomes the e.poison the offline draw
  // tints green (entities.js drawEnemy); online never ticks it, the damage comes as the server's dot events. A delta
  // sends a dropped flag as null and a full snapshot leaves it out, so anything but true cures it.
  const SERVER_POISON = { t: Infinity, dmg: 0, acc: 0 };
  function syncMonster(record) {
    let mob = mobs.get(record.id);
    if (!mob) { mob = NC.makeEnemy(record.type, record.x, record.y, record.lv); mobs.set(record.id, mob); }
    const x = mob.x, y = mob.y;
    Object.assign(mob, record, { online: true, tx: record.x, ty: record.y, x, y, sort: y, home: { x: record.spawnX, y: record.spawnY },
      poison: record.poisoned === true ? mob.poison || { ...SERVER_POISON } : null });
    return mob;
  }
  function tickMobs(dt) {
    for (const mob of mobs.values()) {
      const k = 1 - Math.exp(-dt * 14); mob.x += (mob.tx - mob.x) * k; mob.y += (mob.ty - mob.y) * k; mob.sort = mob.y;
      mob.t = (mob.t || 0) + dt; mob.hurt = Math.max(0, (mob.hurt || 0) - dt);
      if (mob.poison) NC.poisonMotes(mob, dt);
    }
  }
  // The offline looks of an authoritative combat event: a monster's numbers, sparks, flash and death burst
  // (entities.js enemyHitLooks / enemyDeathLooks), a hero's red number and fall puff (entities.js hurtPlayer).
  const HERO_HIT = { lift: 150, size: 42, fill: '#ff6b6b', heal: '#8dff8a' }, HERO_FALL = { lift: 30, count: 10, speed: 150, color: '120,110,140' };
  const MONSTER_FLASH = 0.14, MONSTER_SHOW = 3, HURT_TIME = 0.25;
  function combatLooks(target, source, data) {
    const damage = Number(data.damage) || 0;
    if (target.kind === 'enemy' && data.dot) { // a dot tick (backend/poison.go, job_reaper.go): no flinch or sparks, as offline
      target.show = MONSTER_SHOW;
      const fill = METERS.dotFill(data.skillId);
      if (damage > 0) NC.enemyDotLooks(target, damage, fill ? { fill } : undefined);
      if (data.dead) { target.flash = MONSTER_FLASH; NC.enemyDeathLooks(game, target, source && source.kind !== 'enemy' ? source : game.player); }
      return;
    }
    target.hurt = HURT_TIME;
    if (target.kind === 'enemy') {
      if (damage > 0) { target.flash = MONSTER_FLASH; target.show = MONSTER_SHOW; NC.enemyHitLooks(target, { dmg: damage, crit: !!data.crit, hits: data.hits }, {}); }
      if (data.dead) NC.enemyDeathLooks(game, target, source && source.kind !== 'enemy' ? source : game.player);
      return;
    }
    FX.num(target.x, target.y - HERO_HIT.lift, damage < 0 ? '+' + -damage : String(damage), { fill: damage < 0 ? HERO_HIT.heal : HERO_HIT.fill, size: HERO_HIT.size });
    if (data.dead) FX.puff(target.x, target.y - HERO_FALL.lift, HERO_FALL.count, { speed: HERO_FALL.speed, color: HERO_FALL.color });
  }
  function basicVisual(p, data) {
    // Go sends clip timing/shape as an object (without a name). Resolve its
    // zero-based combo step from the accepted weapon, just as the content export
    // does; an offline animation-lab override must not change this mapping.
    const accepted = typeof data === 'string' ? data : data?.clip;
    const named = typeof accepted === 'string' ? accepted : typeof accepted?.name === 'string' ? accepted.name : null;
    const known = (name) => typeof name === 'string' && Object.prototype.hasOwnProperty.call(NC.Anim.CLIPS, name);
    const acceptedWeapon = typeof data?.weapon === 'string' ? data.weapon : null;
    const requestedWeapon = acceptedWeapon ? NC.ITEMS[acceptedWeapon] : null;
    if (acceptedWeapon && requestedWeapon?.slot !== 'weapon') return;
    const W = requestedWeapon || NC.weaponDef(p);
    let clip = known(named) ? named : null;
    if (!clip) {
      const step = data?.step ?? 0;
      if (!W || !Number.isInteger(step) || step < 0 || step > 2) return;
      const set = NC.Anim.setOf(NC.Anim.movesFor(null, W));
      clip = set.combo(W.style || 'swing')?.[step];
    }
    if (!known(clip)) return;
    // Fast weapons can legitimately attack within 180 ms. Suppress only an
    // actual duplicate in this match, never the next accepted combo step.
    const attackSeq = Number.isSafeInteger(data?.seq) ? data.seq : null;
    if (attackSeq !== null && p.lastAttackVisualSeq === attackSeq && p.lastAttackVisualGeneration === generation && p.lastAttackVisualMatch === matchId) return;
    p.lastAttackVisualSeq = attackSeq; p.lastAttackVisualGeneration = generation; p.lastAttackVisualMatch = matchId;
    p.lastAttackVisual = performance.now(); p.combat = 1;
    NC.Anim.play(p.anim, clip);
  }
  // Copies of the living monsters around a caster, so a skill's per-target looks (dash hits, impacts, bursts) fire
  // where and when they would offline. The copies live only in the scratch world: damage, knockback and deaths on
  // them change nothing real, and the numbers come from the server's combat events.
  const GHOST_RANGE = 900;
  function ghostMonsters(source) {
    const ghosts = [];
    for (const mob of mobs.values()) {
      if (mob.dead > 0 || mob.dead === true || !(mob.hp > 0) || Math.hypot(mob.x - source.x, mob.y - source.y) > GHOST_RANGE) continue;
      ghosts.push({ ...mob, kbx: 0, kby: 0 });
    }
    return ghosts;
  }
  function skillVisual(source, id, data) {
    const run = NC.SKILL_RUN?.[id]; if (!run) return;
    if (source.lastSkillVisual === id && performance.now() - (source.lastSkillAt || 0) < 150) return;
    source.lastSkillVisual = id; source.lastSkillAt = performance.now();
    // Skill code only sees isolated presentation objects. Its delayed callbacks close over this fake world.
    // An autospell (skills_v21.js:369-376 castAt) aims at its monster at its own level with no pose: the swing goes on.
    const auto = !!data.auto;
    const p = NC.makePlayer(source.x, source.y);
    Object.assign(p, { job: source.job, lv: source.lv, jobLv: source.jobLv, hp: source.hp, maxHp: source.maxHp, sp: source.sp, maxSp: source.maxSp, aim: auto ? data.aim ?? source.aim : source.aim, face: source.face, noPose: auto, equip: { ...shown(source.equip) }, skills: { ...source.skills }, base: { ...source.base }, stats: { ...source.stats }, d: structuredClone(source.d), hotbar: { ...source.hotbar }, buffs: {}, buffLv: {}, owned: new Set(), fresh: new Set(), mats: {}, matSeen: new Set(), matNew: new Set() });
    const world = { W: game.world.W, H: game.world.H, fits: game.world.fits.bind(game.world), isSolid: game.world.isSolid?.bind(game.world), spawn: { ...game.world.spawn }, props: [], lights: [], spawns: [] };
    const fake = { player: p, enemies: ghostMonsters(source), loot: [], respawns: [], portals: [], time: game.time, world, mapId: game.mapId, mouse: { active: true, wx: data.targetX ?? data.x ?? p.x + Math.cos(p.aim) * 250, wy: data.targetY ?? data.y ?? p.y + Math.sin(p.aim) * 250 }, input: { mx: 0, my: 0 }, cam: { ...game.cam }, shake: 0, hitstop: 0, noSave: true, presentationOnly: true, toast() {} };
    const scope = { fake, party: [], pets: [], self: source === game.player };
    const level = Math.max(1, (auto && data.lv) || source.skills[id] || 1);
    try { withPresentation(scope, () => run(fake, p, level, 'q')); if (!auto) source.anim = p.anim; presentation.add({ fake, p, source, scope, expires: game.time + 15 }); } catch (error) { console.warn('online skill presentation', id, safeError(error)); }
  }
  function withPresentation(scope, run) {
    const previous = presentationContext, previousGame = NC.game, party = NC.Party?.members, pets = NC.Pets?.list;
    presentationContext = scope; NC.game = scope.fake;
    if (NC.Party) NC.Party.members = scope.party;
    if (NC.Pets) NC.Pets.list = scope.pets;
    try { return run(); } finally {
      if (NC.Party) NC.Party.members = party;
      if (NC.Pets) NC.Pets.list = pets;
      NC.game = previousGame; presentationContext = previous;
    }
  }
  function animate(p, dt) {
    const W = NC.weaponDef(p); if (!W) return;
    if (p.casting) p.casting.t = Math.min(p.casting.T, p.casting.t + dt);
    const A = NC.Anim, moves = A.movesFor(p.moves, W), set = A.setOf(moves), idle = A.BASE[moves.idle] ? moves.idle : 'idle';
    p.hurt = Math.max(0, (p.hurt || 0) - dt); p.combat = game.time - p.lastFight < 1.8 ? 1 : 0;
    A.setBase(p.anim, p.dead > 0 ? 'death' : p.moving ? (p.running ? 'run' : 'walk') : p.combat ? set.ready : idle, 0.12);
    A.update(p.anim, dt, 1, () => {});
    const angle = Math.atan2(Math.sin(p.face > 0 ? p.aim : Math.PI - p.aim), Math.cos(p.face > 0 ? p.aim : Math.PI - p.aim));
    p.pose = A.evaluate(p.anim, NC.animCtx(p.equip, { al: NC.clamp(angle, -1.2, 1.2), walk: p.walk, moving: p.moving, hurt: p.hurt / 0.3, idleStyle: idle, ready: set.ready }));
    p.pose.face = p.face; p.sort = p.y;
    NC.hatSpring(p.hatS || (p.hatS = {}), p.equip, p.pose, p.vx * p.face, dt);
  }
  function update(g, dt) {
    NC.Chat?.tickBubbles(dt);
    const p = g.player, I = g.input, now = performance.now();
    if (!ready || !p.online) { I.q = I.e = I.r = I.f = I.potion = I.sppotion = false; I[3] = I[4] = I[5] = I[6] = false; return; }
    const automated = !g.paused && NC.Auto?.intent(g, dt);
    if (automated) { I.mx = automated.mx; I.my = automated.my; I.attack ||= automated.attack; if (automated.key) I[automated.key] = true; }
    let dx = g.paused ? 0 : I.mx, dy = g.paused ? 0 : I.my;
    [dx, dy] = NC.walkDirection(g, dx, dy);
    if (p.dead > 0) dx = dy = 0;
    if (automated?.aim) p.aim = Math.atan2(automated.aim[1] - (p.y - 50), automated.aim[0] - p.x);
    else if (g.mouse.active) p.aim = NC.angle(p.x, p.y - 50, g.mouse.wx, g.mouse.wy);
    else if (dx || dy) p.aim = Math.atan2(dy, dx);
    const packet = { dx, dy, aim: p.aim, running: !!(dx || dy) };
    const signature = `${dx.toFixed(2)},${dy.toFixed(2)},${p.aim.toFixed(2)}`;
    // Catch-up simulation can run several steps in one frame; send only the latest wall-clock intent.
    if (p.dead <= 0 && now - inputAt >= 50) { sendIntent(1, packet); inputAt = now; lastInput = signature; }
    movement = packet;
    const speed = auth.speed ?? 310 * (1 + (p.stats?.spd || 0));
    p.vx = dx * speed; p.vy = dy * speed;
    NC.tryMove(g.world, p, p.vx * dt, p.vy * dt);
    const blend = 1 - Math.exp(-dt * 15); p.x += correction.x * blend; p.y += correction.y * blend; correction.x *= 1 - blend; correction.y *= 1 - blend;
    p.moving = !!(dx || dy); p.running = p.moving; if (p.moving) p.walk += dt * speed * 0.0663;
    if (Math.abs(Math.cos(p.aim)) > 0.15) p.face = Math.cos(p.aim) >= 0 ? 1 : -1;
    if (!g.paused && p.dead <= 0) {
      if ((I.attack || g.mouse.down) && !(p.cd.attack > 0) && !p.casting && now - attackAt > 220) { sendIntent(2, { aim: p.aim, targetId: (NC.Auto?.target || g.hover || g.target)?.id }); attackAt = now; }
      for (const key of KEYS) if (I[key]) NC.castSkill(g, p, key);
      if (I.potion) online.action('potion', { kind: 'hp' });
      if (I.sppotion) online.action('potion', { kind: 'sp' });
      // (a full gear bag asks for no gear: the server refuses it anyway, js/gearbag.js room)
      if (now - pickupAt > 250) { const gearFull = !!(NC.GEAR?.room && !NC.GEAR.room(p)); const loot = g.loot.find(l => (!l.ownerId || l.ownerId === playerId) && !(gearFull && l.inst) && Math.hypot(l.x - p.x, l.y - p.y) < 100); if (loot) { sendIntent(4, { lootId: loot.lootId }); pickupAt = now; } }
    }
    I.q = I.e = I.r = I.f = I.potion = I.sppotion = false; I[3] = I[4] = I[5] = I[6] = false;
    for (const key in p.cd) p.cd[key] = Math.max(0, p.cd[key] - dt);
    animate(p, dt);
    for (const remote of remotes.values()) {
      const k = 1 - Math.exp(-dt * 14), x = remote.x, y = remote.y;
      if (Math.hypot(remote.tx - x, remote.ty - y) > 500) { remote.x = remote.tx; remote.y = remote.ty; }
      else { remote.x += (remote.tx - x) * k; remote.y += (remote.ty - y) * k; }
      remote.vx = (remote.x - x) / dt; remote.vy = (remote.y - y) / dt; remote.walk += dt * Math.hypot(remote.vx, remote.vy) * 0.0663; animate(remote, dt);
    }
    tickMobs(dt);
    if (NC.Shop?.npc && g.mapId === 'camp') { const npc = NC.Shop.npc; npc.t += dt; npc.face = p.x < npc.x ? -1 : 1; }
    tickPresentation(g, dt);
  }
  // Presented channels and dashes run on in their scratch worlds. A dash takes the offline step (entities.js
  // stepDash): it moves, leaves afterimages in the caster's current pose and runs through the ghost monsters.
  function tickPresentation(g, dt) {
    for (const effect of presentation) {
      const { p: proxy, fake, source } = effect; fake.time = g.time;
      try { withPresentation(effect.scope, () => {
        if (proxy.channel) { const c = proxy.channel; c.t += dt; c.update?.(fake, proxy, c, dt); if (c.t >= c.dur) { proxy.channel = null; c.end?.(fake, proxy, c); } }
        if (proxy.dash) { proxy.pose = source.pose; NC.stepDash(fake, proxy, dt); }
      }); } catch (_) { presentation.delete(effect); }
      if (g.time > effect.expires || (!proxy.channel && !proxy.dash)) presentation.delete(effect);
    }
  }
  function collect(list, visible) {
    for (const p of remotes.values()) if (visible(p.x - 120, p.y - 220, p.x + 120, p.y + 40)) list.push(p);
    const npc = NC.Shop?.npc;
    if (npc && game.mapId === 'camp' && visible(npc.x - 110, npc.y - 200, npc.x + 110, npc.y + 40)) list.push(npc);
  }
  function drawRemote(ctx, g, p) {
    if (p.npc) { NC.Party.draw(ctx, g, p); return; }
    if (!p.pose) return;
    NC.drawHero(ctx, p.equip, p.pose, p.x, p.y, { hurt: p.hurt, alpha: 1 });
    p.renderedAt = performance.now(); p.renderedX = p.x; p.renderedY = p.y;
    state.rendered.push({ id: p.id, seq: p.lastInputSeq, at: p.renderedAt, x: p.x, y: p.y });
    if (state.rendered.length > 500) state.rendered.shift();
  }
  function drawTags(ctx) {
    ctx.save(); ctx.textAlign = 'center'; ctx.font = '17px sans-serif';
    for (const p of remotes.values()) { ctx.fillStyle = '#97e5ff'; ctx.fillText(`${p.name} · Lv${p.lv}`, p.x, p.y - 160); }
    if (game.mapId === 'camp' && NC.Shop?.npc) { const npc = NC.Shop.npc; ctx.fillStyle = '#ffd873'; ctx.fillText(`${npc.name} · กด B เพื่อค้าขาย`, npc.x, npc.y + 35); }
    ctx.restore();
    NC.Chat?.drawBubbles(ctx);
  }
  function renderMerchant() {
    const select = document.getElementById('online-material'), note = document.getElementById('online-merchant-note');
    if (!select || !note || !game) return;
    const p = game.player, npc = NC.Shop?.npc;
    const near = ready && game.mapId === 'camp' && npc && Math.hypot(p.x - npc.x, p.y - npc.y) <= 240;
    const stock = Object.entries(p.mats || {}).filter(([, count]) => count > 0);
    const signature = JSON.stringify(stock);
    if (select.dataset.stock !== signature) {
      const old = select.value; select.replaceChildren(); select.dataset.stock = signature;
      for (const [id, count] of stock) {
        const option = document.createElement('option'); option.value = id;
        option.textContent = `${NC.MATERIALS[id]?.name || id} ×${count} · ${NC.MATERIALS[id]?.price || 0} เหรียญ/ชิ้น`; select.appendChild(option);
      }
      if (stock.some(([id]) => id === old)) select.value = old;
    }
    note.textContent = near ? `อยู่ในระยะร้านค้า · ${p.gold || 0} เหรียญ` : 'เข้าใกล้ลุงโกโก้กลางค่ายเพื่อซื้อ/ขาย';
    for (const id of ['online-buy-hp', 'online-buy-sp', 'online-sell']) document.getElementById(id).disabled = !near || (id === 'online-sell' && !stock.length);
  }
  function unsupported(feature = 'ระบบนี้') { if (active) game?.toast(`${feature}ยังไม่เปิดในโหมดออนไลน์`); return false; }
  function supportsLearning(id) { return online.supportsSkill(id) || ONLINE_PASSIVES.has(id); }
  function availabilityNote(text) {
    const note = document.createElement('small'); note.textContent = text;
    note.style.cssText = 'display:block;margin:6px 0;color:#e2ba83;line-height:1.5';
    return note;
  }
  function markOnlineSkills() {
    const list = document.getElementById('sk-list'); if (!list || !active) return;
    const second = [...onlineJobs].filter((j) => NC.JOBS[j]?.tier === 2).map((j) => NC.JOBS[j].name);
    const note = availabilityNote(`ออนไลน์: เปลี่ยนจากนักเดินทางเป็น Knight / Mage / Archer / Rogue ได้ · อาชีพขั้น 2 ที่เปิดแล้ว: ${second.length ? second.join(' / ') : 'ยังไม่มี'} · รองรับสกิล ${supportedSkills?.size || 0} สกิล · Priest และอาชีพอื่นยังไม่เปิด`);
    note.id = 'online-skill-scope'; note.setAttribute('role', 'note'); list.prepend(note);
    const candidates = [...new Set([...NC.jobSkills(game.player), ...ONLINE_PASSIVES, ...Object.values(NC.BOSS_ULT || {})])];
    for (const row of list.querySelectorAll('.sk-row')) {
      const name = row.querySelector('.sk-name')?.textContent;
      const id = candidates.find(id => NC.SKILLS[id]?.name === name); if (!id) continue;
      row.dataset.onlineSkill = id;
      if (!supportsLearning(id)) {
        row.dataset.onlineAvailable = 'false';
        row.querySelector('.plus')?.setAttribute('disabled', '');
        const icon = row.querySelector('.sk-ic'); if (icon) { icon.draggable = false; icon.classList.remove('drag'); }
        row.appendChild(availabilityNote('ยังไม่เปิดในโหมดออนไลน์'));
      } else row.dataset.onlineAvailable = 'true';
    }
  }
  function guards() {
    base.creatorClose = NC.Creator?.close;
    const addEffect = FX.add;
    FX.add = function (effect) {
      if (active && effect?.type === 'hero' && effect.equip) effect.equip = shownCopy(effect);
      const scope = presentationContext;
      if (scope && effect) for (const key of ['update', 'onEnd']) if (typeof effect[key] === 'function') {
        const callback = effect[key];
        effect[key] = function (...args) {
          if (key === 'update') args[2] = scope.fake; else args[1] = scope.fake;
          return withPresentation(scope, () => callback.apply(this, args));
        };
      }
      return addEffect.apply(this, arguments);
    };
    const flash = NC.VFX.flash;
    NC.VFX.flash = function (...args) { if (presentationContext && !presentationContext.self) return; return flash.apply(this, args); };
    for (const key of ['gainXp', 'addMat', 'dropLoot', 'updateLoot', 'damageEnemy', 'hurtPlayer', 'saveGame', 'saveTrade', 'resetStats', 'updateSkills']) {
      const original = NC[key]; if (typeof original !== 'function') continue;
      base[key] = original; NC[key] = function (...args) {
        if (presentationContext) return false; // a presented skill only draws; the server owns every outcome
        if (active) return key === 'resetStats' ? unsupported('รีเซ็ตสเตตัส ') : false;
        return original.apply(this, args);
      };
    }
    const gear = NC.applyGear; NC.applyGear = function (g) { if (active && g === game) return; return gear.apply(this, arguments); };
    const cast = NC.castSkill; NC.castSkill = function (g, p, key) {
      if (!active) return cast.apply(this, arguments);
      const skillId = NC.skillForKey(p, key); if (!skillId) return false;
      if (!online.supportsSkill(skillId)) return unsupported(`สกิล ${NC.SKILLS[skillId]?.name || skillId} `);
      return sendIntent(3, { skillId, aim: p.aim, targetX: g.mouse.wx, targetY: g.mouse.wy, targetId: (NC.Auto?.target || g.hover || g.target)?.id });
    };
    const commands = {
      raiseStat: (p, stat, count) => online.action('stat', { stat, count: count || 1 }),
      raiseSkill: (p, skillId) => supportsLearning(skillId) ? online.action('skill', { skillId }) : unsupported(`สกิล ${NC.SKILLS[skillId]?.name || skillId} `),
      changeJob: (p, job) => jobOnline(job) ? online.action('job', { job }) : unsupported(`อาชีพ ${NC.JOBS[job]?.name || job} `),
      swapWeapons: () => online.action('weaponSwap', {}), // G (js/weapons.js NC.swapWeapons): the server keeps both sets
      equip: (g, itemId) => wear(itemId),
      equipClass: (g, setId) => wearSet(setId),
      assignSlot: (p, key, id) => { if (id && !online.supportsSkill(id)) return unsupported(`สกิล ${NC.SKILLS[id]?.name || id} `); const hb = { ...p.hotbar }; for (const k of KEYS) if (hb[k] === id) hb[k] = null; hb[key] = id; return online.action('hotbar', { slots: KEYS.map(k => hb[k] || '') }); },
    };
    for (const [key, action] of Object.entries(commands)) { const original = NC[key]; NC[key] = function (...args) { if (active) { action(...args); return false; } return original?.apply(this, args); }; }
    const usable = NC.skillUsable;
    NC.skillUsable = function (p, id) { if (active && !supportsLearning(id)) return false; return usable.apply(this, arguments); };
    const renderJobs = NC.HUD.renderJobs;
    NC.HUD.renderJobs = function (list, p) {
      const result = renderJobs.apply(this, arguments); if (!active) return result;
      const ids = NC.nextJobs(p), cards = list.querySelectorAll('.jobs .job');
      cards.forEach((card, i) => {
        const id = ids[i]; if (!id) return; card.dataset.onlineJob = id;
        if (!jobOnline(id)) {
          card.dataset.onlineAvailable = 'false'; const button = card.querySelector('.job-go');
          if (button) { button.disabled = true; button.textContent = 'ยังไม่เปิดออนไลน์'; }
          card.appendChild(availabilityNote('อาชีพนี้เล่นได้ในโหมดออฟไลน์'));
        } else card.dataset.onlineAvailable = 'true';
      });
      if (ids.length && ids.every(id => !jobOnline(id))) {
        const heading = list.querySelector('.jobs-h'); if (heading) heading.textContent = 'อาชีพขั้น 2 ยังไม่เปิดในโหมดออนไลน์';
      }
      return result;
    };
    // everything that draws or poses a hero from its equip draws the look (lookViews); stats/derive keep the real equip
    for (const [key, at] of [['drawHero', 1], ['drawAvatar', 1], ['animCtx', 0], ['hatSpring', 1], ['headSpot', 0], ['weaponLine', 0], ['rigAnchors', 0]]) {
      const original = NC[key]; if (typeof original !== 'function') continue;
      NC[key] = function (...args) { if (active) args[at] = shown(args[at]); return original.apply(this, args); };
    }
    const equipUI = NC.EquipUI;
    if (equipUI) {
      const render = equipUI.render, renderInfo = equipUI.renderInfo;
      equipUI.render = function () {
        const result = render.apply(this, arguments);
        if (active) decorateWardrobe(); else { const reset = document.getElementById('online-look-reset'); if (reset) reset.hidden = true; }
        return result;
      };
      equipUI.renderInfo = function () { const result = renderInfo.apply(this, arguments); if (active) wardrobeNote(this.info, this.hover || this.sel); return result; };
    }
    const renderSkills = NC.HUD.renderSkills;
    NC.HUD.renderSkills = function () { const result = renderSkills.apply(this, arguments); if (active) markOnlineSkills(); return result; };
    const askName = NC.HUD.askName; NC.HUD.askName = function () {
      if (!active) return askName.apply(this, arguments);
      const account = document.getElementById('online-account'); if (account) account.open = true;
      return false;
    };
    const panel = NC.HUD.panel; NC.HUD.panel = function (id, show) {
      if (active && id === 'shop') { const shop = document.getElementById('online-merchant'); if (shop) shop.open = show === undefined ? !shop.open : !!show; return false; }
      if (active && show !== false && ['vend', 'vbuy', 'dummy', 'party', 'pets', 'creator'].includes(id)) return unsupported();
      return panel.apply(this, arguments);
    };
    for (const object of [NC.Creator, NC.Rest]) if (object) for (const key of Object.keys(object)) if (typeof object[key] === 'function' && key !== 'init' && key !== 'draw' && key !== 'has') {
      const original = object[key]; object[key] = function (...args) { if (active) return unsupported(); return original.apply(this, args); };
    }
    const mapGo = NC.Maps.go, mapEnter = NC.Maps.enter, mapSave = NC.Maps.save;
    NC.Maps.go = function (g, id, at) { if (active) { const portal = g.portals.find(pt => pt.to === id && pt.at === at); return portal ? online.warp(portal.id) : unsupported(); } return mapGo.apply(this, arguments); };
    NC.Maps.enter = function () { return active ? unsupported() : mapEnter.apply(this, arguments); };
    NC.Maps.save = function () { if (!active) return mapSave.apply(this, arguments); };
    const drawLoot = NC.drawLoot; NC.drawLoot = function (ctx, g, loot) {
      if (!loot.online) return drawLoot.apply(this, arguments);
      if (loot.potion || (loot.id && NC.ITEMS[loot.id])) return drawLoot.apply(this, arguments);
      ctx.save(); ctx.fillStyle = '#ffd274'; ctx.font = '25px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(loot.gold ? '●' : '◆', loot.x, loot.y - 22); ctx.restore();
    };
  }
  function init(g) {
    game = g;
    const box = document.createElement('section'); box.id = 'online-panel'; box.setAttribute('aria-label', 'ออนไลน์');
    box.innerHTML = '<div id="online-state" role="status"></div><small id="online-detail"></small><button id="online-connect" type="button">เข้าเล่นออนไลน์</button><button id="online-revive" type="button">ฟื้นคืนชีพ</button><details id="online-account"><summary>ตัวละครออนไลน์</summary><label>ชื่อ <input id="online-name" maxlength="16" placeholder="2–16 ตัวอักษร"></label><button id="online-rename" type="button">บันทึกชื่อ</button><small>สเตตัส อุปกรณ์ สกิล และการเปลี่ยนอาชีพใช้เมนูเกมเดิม ระบบที่ยังไม่รองรับจะแจ้งก่อนใช้</small></details><details id="online-merchant"><summary>ร้านค้า / วัสดุ (B)</summary><small id="online-merchant-note"></small><button id="online-buy-hp" type="button">ยาแดง 25</button><button id="online-buy-sp" type="button">ยาฟ้า 40</button><label>ขายวัสดุ <select id="online-material"></select></label><input id="online-sell-count" type="number" min="1" max="9999" value="1" aria-label="จำนวนขาย"><button id="online-sell" type="button">ขาย</button></details>';
    document.body.appendChild(box);
    // Keep connection/account controls above chat, including resized/mobile chat.
    const chatWindow = document.getElementById('chatwin');
    const placeAboveChat = () => {
      if (!chatWindow) return;
      const rect = chatWindow.getBoundingClientRect();
      box.style.bottom = `${Math.max(8, window.innerHeight - rect.top + 8)}px`;
      box.style.maxHeight = `${Math.max(60, rect.top - 20)}px`;
      box.style.overflowY = 'auto';
    };
    if (chatWindow) new ResizeObserver(placeAboveChat).observe(chatWindow);
    window.addEventListener('resize', placeAboveChat); placeAboveChat();
    document.getElementById('online-connect').addEventListener('click', () => active ? disconnect() : connect());
    document.getElementById('online-revive').addEventListener('click', () => online.action('revive'));
    document.getElementById('online-rename').addEventListener('click', () => online.action('name', { name: document.getElementById('online-name').value.trim() }));
    document.getElementById('online-buy-hp').addEventListener('click', () => online.action('buy', { kind: 'hp', count: 1 }));
    document.getElementById('online-buy-sp').addEventListener('click', () => online.action('buy', { kind: 'sp', count: 1 }));
    document.getElementById('online-sell').addEventListener('click', () => online.action('sell', { itemId: document.getElementById('online-material').value, count: Number(document.getElementById('online-sell-count').value) }));
    document.addEventListener('drop', event => {
      if (!active) return;
      const target = event.target.closest?.('#sk-list .sk-slot'), data = event.dataTransfer?.getData('text/plain') || '';
      if (!target || !data.startsWith('slot:')) return;
      event.preventDefault(); event.stopImmediatePropagation(); target.classList.remove('over');
      event.dataTransfer.dropEffect = 'move';
      const from = data.slice(5), to = target.querySelector('.key')?.textContent.toLowerCase();
      if (!KEYS.includes(from) || !KEYS.includes(to) || from === to) return;
      const slots = { ...game.player.hotbar }; [slots[from], slots[to]] = [slots[to], slots[from]];
      online.action('hotbar', { slots: KEYS.map(key => slots[key] || '') });
    }, true);
    document.addEventListener('visibilitychange', () => { if (active && ready && document.hidden) sendIntent(1, { dx: 0, dy: 0, aim: game.player.aim, running: false }); });
    status('offline'); if (requested) connect();
  }
  guards();
})();
