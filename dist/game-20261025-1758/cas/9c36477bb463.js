/* guild.js — guilds every player sees the same (the user, 2026-10-01: "ทำระบบ guild"), on NC.Store (js/store.js: the
   Artifact's db online, this browser's stand-in on localhost). The window (O) is layout "B" of the social pages
   (assets/gen/nightcamp_pg_guild_b_raw.png): the guild's own campfire hall on top (assets/kui/guild_hall.jpg, the
   guild's colour and emblem painted on its banner, the members sitting round the fire), the guild card, then the
   tabs สมาชิก / ประกาศ / กองไฟกิลด์ / อันดับกิลด์.
   The documents:
     guilds/{gid}     name, color, emblem (0–11, assets/kui/gem_N.png), leader (uid), officers [uid], notice, created,
                      paid {week: coins} (the upkeep), qdone {week: 1}, bossx {week: exp}, boss {week, type, lv, map, x, y,
                      t0, hp, done}, kept {uid_joined: exp} / keptc {uid_joined: coins} (what members who left gave),
                      score / lv / n (EXP, level, members: for the guild ranking)
     gmembers/{uid}   gid, name, job, lv, map, seen, joined, gx (guild EXP given), dn (coins given), q {week, n} (the
                      week's quest), bd {week, dmg} (the guild boss), eq (the look, for the portraits), kicked
     ginvites/{uid}   an invite: gid, name, color, emblem, from, fromName, t
     gnames/{key}     a claimed name: { owner: gid }
   Each player writes only their own member doc for what grows (the db has no transactions, so no counter has two
   writers): the guild's EXP, coffer and quest are the members' sums plus what the guild doc keeps.
   The rules (kept from social.js, the Game Bible's pillar 6): founding 500,000 coins. Guild Lv 1–10 from
   guild EXP: 0.1% of the EXP its members earn, 4 per material given to the weekly quest (5,000 of one material: +30,000
   when done) and the guild boss (+80,000; on time out half its damage). Per level: EXP +1% for its members while the
   week's upkeep (20,000 x Lv, from the coffer) is paid. Members: 16 + 4 x Lv. The guild boss: once a week the leader
   wakes a night form of a dungeon boss on a field map, 20 minutes; every member on that map fights their own copy and
   the damage is shared (one HP pool: the presence 'gb' live, the member docs behind it).
   The guild's campfire stands in the camp's guild lane (rest, ไออุ่น: NC.guildFires); «name» over the heroes.
   Presence: ud (my store id: to be invited), gu [gid, name, color, emblem, lv], gb [week, damage].
   NC.Guild: gid() · guild() · members() · open(tab). Hooks: NC.gainXp, NC.damageEnemy, NC.skillTicks, NC.buildWorld,
   NC.Party.drawTags, NC.HUD.init / panel, the O key. */
(function () {
  'use strict';
  const NC = window.NC, S = NC.Store;
  if (!S) return;
  const $ = (id) => document.getElementById(id);
  const G = () => NC.game;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = (n) => (NC.fmtCoins ? NC.fmtCoins(Math.round(n)) : Math.round(n).toLocaleString());
  const icon = (k) => ((NC.ASSET_MANIFEST || {})[k] || {}).src || '';
  const gem = (i) => icon('gem_' + (Math.max(0, Math.min(11, i | 0))));
  const clean = (s, n) => (NC.Net && NC.Net.clean ? NC.Net.clean(s, n) : String(s == null ? '' : s).trim().slice(0, n));
  const weekNo = () => Math.floor((Date.now() / 86400000 + 3) / 7);
  const COST_FULL = 500000, NAME_MAX = 16, NOTICE_MAX = 120, QUEST_N = 5000, BOSS_S = 20 * 60, TAU = Math.PI * 2;
  // founding a guild costs COST_BETA during the beta, not the full COST_FULL (the owner, 2026-10-20: "ลดราคาการทำกิลเป็น
  // 100,000 เฉพาะช่วง เบต้า เขียนกำกับไว้ด้วย"); the window says so (struck-through full price + "ราคาช่วงเบต้า").
  // Online the server's price wins (self.social.foundCost: backend guild_beta.go, the back office's "guildbeta" switch);
  // offline BETA picks it: set it false when the beta ends.
  const BETA = true, COST_BETA = 100000;
  const cost = () => { const s = NC.OnlineStore && NC.OnlineStore.social; return s && s.foundCost > 0 ? s.foundCost : BETA ? COST_BETA : COST_FULL; };
  const beta = () => cost() < COST_FULL;
  const COLORS = ['#ff8a3c', '#6fb6ff', '#8ff08a', '#c792ff', '#ffd873', '#ff6a8a', '#5ee0d0', '#e8e2d4'];
  const GLV = [0, 5000, 20000, 60000, 150000, 350000, 700000, 1300000, 2300000, 4000000];
  const glvOf = (exp) => { let l = 1; GLV.forEach((t, i) => { if (exp >= t) l = i + 1; }); return Math.min(10, l); };
  const capOf = (lv) => 16 + 4 * lv;
  const GB = ['bat_king', 'ant_queen', 'crypt_lord', 'lava_dragon'];
  const SLOTS = ['hat', 'hair', 'top', 'pants', 'shoes', 'weapon', 'robe', 'cape', 'glasses'];
  const okColor = (c) => (/^#[0-9a-f]{6}$/i.test(c) ? c : COLORS[0]);
  const keyOf = (name) => 'n' + [...new TextEncoder().encode(String(name).trim().toLowerCase())].map((b) => b.toString(16).padStart(2, '0')).join('');
  const newGid = () => 'g' + Math.random().toString(36).slice(2, 10);

  // ---------------- the state ----------------
  let uid = null, mine = null, gid = null, guild = null, roster = [], invite = null;
  let unG = null, unM = null;
  const pend = { gx: 0, dn: 0, qn: 0 }; // given since the last write of my member doc
  let myBd = 0, myBdWeek = 0; // my damage to this week's guild boss (exact, here)
  const listeners = [];
  const changed = () => { for (const f of listeners) { try { f(); } catch (e) { console.warn('guild: listener', e); } } };
  const me = () => (G() && G().player && clean(G().player.name, NAME_MAX)) || 'ผู้เล่น';
  const rankOf = (u) => (!guild ? null : guild.leader === u ? 'leader' : (guild.officers || []).includes(u) ? 'officer' : 'member');
  const canManage = () => rankOf(uid) === 'leader' || rankOf(uid) === 'officer';
  const memberDoc = (u) => (roster.find((r) => r.id === u) || {}).data || null;
  const RANK = { leader: ['หัวหน้ากิลด์', 'gold'], officer: ['รองหัวหน้า', 'blue'], member: ['สมาชิก', 'grey'] };
  function note(text, kind) {
    if (NC.Chat && NC.Chat.add) NC.Chat.add({ ch: 'g', note: true, text });
    else NC.HUD.log(text, kind || 'item');
  }

  // the guild's numbers: the members' sums plus what the guild doc keeps
  function totals() {
    const w = weekNo(), g = guild || {};
    let exp = 0, coffer = 0, qn = 0;
    for (const r of roster) {
      const own = r.id === uid, m = own && mine && mine.gid === gid ? mine : r.data; // (mine: my latest, before the store echoes it)
      exp += (+m.gx || 0) + (own ? pend.gx : 0);
      coffer += (+m.dn || 0) + (own ? pend.dn : 0);
      if (m.q && m.q.week === w) qn += +m.q.n || 0;
      if (own) qn += pend.qn;
    }
    for (const k in g.kept || {}) exp += +g.kept[k] || 0;
    for (const k in g.keptc || {}) coffer += +g.keptc[k] || 0;
    exp += 30000 * Object.keys(g.qdone || {}).length;
    for (const k in g.bossx || {}) exp += +g.bossx[k] || 0;
    for (const k in g.paid || {}) coffer -= +g.paid[k] || 0;
    const lv = glvOf(exp);
    return { exp, coffer: Math.max(0, coffer), qn, lv, n: roster.length, cap: capOf(lv), next: GLV[lv] || null, prev: GLV[lv - 1] || 0 };
  }
  const paidNow = () => !!(guild && guild.paid && guild.paid[weekNo()]);
  const upkeep = () => 20000 * totals().lv;
  const gquest = () => {
    const w = weekNo(), mats = Object.keys(NC.MATERIALS || {}).filter((id) => /^mat_/.test(id) && !NC.MATERIALS[id].rare && (NC.MATERIALS[id].base || NC.MATERIALS[id].price) < 120 && (NC.MATERIALS[id].base || NC.MATERIALS[id].price) > 10).sort();
    return { week: w, id: mats.length ? mats[(w * 13) % mats.length] : null, need: QUEST_N };
  };

  // ---------------- watching the store ----------------
  function setGid(g2) {
    if (unG) unG();
    if (unM) unM();
    unG = unM = null; guild = null; roster = [];
    gid = g2;
    if (gid) {
      let seen = false;
      unG = S.watch('guilds/' + gid, (d) => {
        if (!d && seen && gid) { note('กิลด์ถูกยุบแล้ว'); S.update('gmembers/' + uid, { gid: null }); }
        seen = seen || !!d;
        guild = d; placeFires(); changed();
      });
      unM = S.watch('gmembers', (rows) => { roster = rows; changed(); }, { where: [['gid', '==', gid]] });
    }
    placeFires(); changed();
  }
  S.ready.then(() => {
    uid = S.me();
    S.watch('gmembers/' + uid, (d) => {
      const was = gid;
      mine = d;
      const g2 = d && d.gid ? d.gid : null;
      if (was && !g2 && d && d.kicked === was) note('คุณถูกให้ออกจากกิลด์แล้ว', 'warn');
      if (g2 !== gid) setGid(g2);
    });
    S.watch('ginvites/' + uid, (d) => {
      const fresh = d && d.gid && (!invite || invite.gid !== d.gid);
      invite = d && d.gid ? d : null;
      if (fresh && !gid) { NC.HUD.log(`${clean(invite.fromName, NAME_MAX)} ชวนคุณเข้ากิลด์ «${clean(invite.name, NAME_MAX)}» · กด O`, 'level'); dot(true); }
      changed();
    });
    setInterval(tick, 5000);
  });

  // ---------------- my member doc: what I give, who I am (written when it changed, at most every 15 s) ----------------
  let lastWrite = 0, lastSeen = 0, lastSig = '';
  function myLook() { const e = G().player.equip; return SLOTS.map((s) => e[s] || null); }
  function tick(force) {
    const g = G();
    if (!uid || !g || !g.player || !gid || !mine) return;
    writeMine(g, force);
    checks();
  }
  function writeMine(g, force) {
    const p = g.player, now = Date.now(), w = weekNo();
    const has = pend.gx >= 1 || pend.dn > 0 || pend.qn > 0;
    const sig = JSON.stringify([me(), p.job, p.lv, g.mapId, myLook(), myBdWeek === w ? Math.round(myBd) : 0]);
    if (!force && !has && sig === lastSig && now - lastSeen < 300000) return;
    if (!force && now - lastWrite < 15000) return;
    const d = { name: me(), job: p.job, lv: p.lv, map: g.mapId, eq: myLook(), seen: now };
    if (pend.gx >= 1 || pend.dn > 0) { d.gx = Math.round((+mine.gx || 0) + pend.gx); d.dn = Math.round((+mine.dn || 0) + pend.dn); pend.gx -= Math.round(pend.gx); pend.dn = 0; }
    if (pend.qn > 0) { const q0 = mine.q && mine.q.week === w ? +mine.q.n || 0 : 0; d.q = { week: w, n: q0 + pend.qn }; pend.qn = 0; }
    if (myBdWeek === w && myBd > 0) d.bd = { week: w, dmg: Math.round(myBd) };
    mine = Object.assign({}, mine, d);
    lastWrite = now; lastSeen = now; lastSig = sig;
    S.update('gmembers/' + uid, d);
  }
  // the guild's numbers for the ranking, the week's quest done (whoever sees them change; the same values from everyone)
  function checks() {
    const t = totals(), now = Date.now(), w = weekNo();
    if (guild && (Math.round(guild.score || 0) !== Math.round(t.exp) || guild.n !== t.n || guild.lv !== t.lv) && (now - (tick.rankT || 0) > 30000 || guild.n !== t.n || guild.lv !== t.lv)) {
      tick.rankT = now;
      S.update('guilds/' + gid, { score: Math.round(t.exp), lv: t.lv, n: t.n });
    }
    // the week's quest done: a flag anyone may set (the same value from everyone)
    if (guild && t.qn >= QUEST_N && !(guild.qdone || {})[w]) { S.update('guilds/' + gid, { qdone: { [w]: 1 } }); note(`เควสกิลด์สัปดาห์นี้สำเร็จ! กิลด์ได้ EXP 30,000`, 'level'); }
  }

  // ---------------- the actions ----------------
  async function found(name, color, emblem) {
    const g = G(), p = g.player;
    name = clean(name, NAME_MAX);
    if (!name || name.length < 2) return 'name';
    if (gid) return 'have';
    const COST = cost();
    if ((p.coins || 0) < COST) return 'coins';
    const id = newGid();
    if (!(await S.claim('gnames/' + keyOf(name), { owner: id }))) return 'taken';
    p.coins -= COST; if (NC.Econ) NC.Econ.sink('guild', COST); NC.saveGame(g);
    const now = Date.now();
    await S.set('guilds/' + id, { name, color: okColor(color), emblem: emblem | 0, leader: uid, officers: [], notice: 'ยินดีต้อนรับสู่กิลด์! มานั่งรอบกองไฟกัน', created: now, paid: { [weekNo()]: 0 }, score: 0, lv: 1, n: 1 });
    await S.set('gmembers/' + uid, { gid: id, name: me(), job: p.job, lv: p.lv, map: g.mapId, eq: myLook(), seen: now, joined: now, gx: 0, dn: 0, kicked: null });
    note(`ก่อตั้งกิลด์ «${name}» แล้ว! กองไฟของกิลด์จุดขึ้นที่ลานกิลด์ในค่าย`, 'level');
    return 'ok';
  }
  async function sendInvite(r) {
    if (!gid || !guild || !canManage() || !r || !r.ud) return 'no';
    if (totals().n >= totals().cap) return 'full';
    await S.set('ginvites/' + r.ud, { gid, name: guild.name, color: guild.color, emblem: guild.emblem | 0, from: uid, fromName: me(), t: Date.now() });
    note(`ชวน ${r.name} เข้ากิลด์แล้ว`);
    return 'ok';
  }
  async function accept() {
    const v = invite;
    if (!v || gid) return;
    const gdoc = await S.get('guilds/' + v.gid);
    if (!gdoc) { await S.del('ginvites/' + uid); NC.HUD.log('กิลด์นี้ไม่มีแล้ว', 'warn'); return; }
    const n = (await S.query('gmembers', { where: [['gid', '==', v.gid]] })).length;
    if (n >= capOf(glvOf(gdoc.score || 0)) + 1) { NC.HUD.log('กิลด์นี้เต็มแล้ว', 'warn'); return; }
    const g = G(), p = g.player, now = Date.now();
    await S.set('gmembers/' + uid, { gid: v.gid, name: me(), job: p.job, lv: p.lv, map: g.mapId, eq: myLook(), seen: now, joined: now, gx: 0, dn: 0, kicked: null });
    await S.del('ginvites/' + uid);
    pend.gx = 0; pend.dn = 0; pend.qn = 0;
    note(`${me()} เข้าร่วมกิลด์ «${clean(gdoc.name, NAME_MAX)}» แล้ว`, 'level');
  }
  const decline = () => S.del('ginvites/' + uid);
  const keptKey = (u, m) => `${u}_${(m && m.joined) || 0}`;
  async function leave() {
    if (!gid || !guild) return;
    tick(true);
    const g0 = guild, id0 = gid, name = g0.name; // (the watch may clear `guild` while this awaits)
    const m = memberDoc(uid) || mine || {}, others = roster.filter((r) => r.id !== uid);
    const keep = { kept: { [keptKey(uid, m)]: Math.round(+m.gx || 0) }, keptc: { [keptKey(uid, m)]: Math.round(+m.dn || 0) } };
    if (g0.leader === uid) {
      if (!others.length) { await S.del('gnames/' + keyOf(name)); await S.del('guilds/' + id0); }
      else {
        const offs = others.filter((r) => (g0.officers || []).includes(r.id)), pool = (offs.length ? offs : others).slice().sort((a, b) => (a.data.joined || 0) - (b.data.joined || 0));
        const next = pool[0].id;
        await S.update('guilds/' + id0, Object.assign(keep, { leader: next, officers: (g0.officers || []).filter((u) => u !== next && u !== uid) }));
      }
    } else await S.update('guilds/' + id0, Object.assign(keep, { officers: (g0.officers || []).filter((u) => u !== uid) }));
    await S.update('gmembers/' + uid, { gid: null, kicked: null });
    note(`ออกจากกิลด์ «${name}» แล้ว`, 'sys');
  }
  async function kick(u) {
    const r = rankOf(uid), t = rankOf(u);
    if (!gid || u === uid || !(r === 'leader' || (r === 'officer' && t === 'member'))) return;
    const m = memberDoc(u) || {};
    await S.update('guilds/' + gid, { kept: { [keptKey(u, m)]: Math.round(+m.gx || 0) }, keptc: { [keptKey(u, m)]: Math.round(+m.dn || 0) }, officers: (guild.officers || []).filter((x) => x !== u) });
    await S.update('gmembers/' + u, { gid: null, kicked: gid });
    note(`ให้ ${clean(m.name, NAME_MAX)} ออกจากกิลด์`, 'sys');
  }
  function promote(u) {
    if (rankOf(uid) !== 'leader' || u === uid) return;
    const offs = (guild.officers || []).slice(), i = offs.indexOf(u);
    if (i >= 0) offs.splice(i, 1); else offs.push(u);
    S.update('guilds/' + gid, { officers: offs });
    note(`${clean((memberDoc(u) || {}).name, NAME_MAX)} ${i >= 0 ? 'ไม่ได้เป็นรองหัวหน้าแล้ว' : 'เป็นรองหัวหน้ากิลด์'}`, 'sys');
  }
  function makeLeader(u) {
    if (rankOf(uid) !== 'leader' || u === uid || !memberDoc(u)) return;
    S.update('guilds/' + gid, { leader: u, officers: (guild.officers || []).filter((x) => x !== u).concat(uid) });
    note(`${clean(memberDoc(u).name, NAME_MAX)} เป็นหัวหน้ากิลด์คนใหม่`, 'level');
  }
  function setNotice(text) {
    if (!canManage()) return;
    S.update('guilds/' + gid, { notice: clean(text, NOTICE_MAX) });
    note('หัวหน้าเปลี่ยนประกาศกิลด์แล้ว', 'sys');
  }
  function donate(n) {
    const g = G(), p = g.player;
    if (!gid || (p.coins || 0) < n) return false;
    p.coins -= n; pend.dn += n; NC.saveGame(g); tick(true);
    note(`${me()} ใส่คลังกิลด์ ${fmt(n)} เหรียญ`);
    return true;
  }
  function payUpkeep() {
    const t = totals(), cost = 20000 * t.lv;
    if (!canManage() || paidNow() || t.coffer < cost) return;
    S.update('guilds/' + gid, { paid: { [weekNo()]: cost } });
    if (NC.Econ) NC.Econ.sink('guild', cost);
    note(`จ่ายค่าดูแลกิลด์สัปดาห์นี้แล้ว (${fmt(cost)}) · สมาชิกได้ EXP +${t.lv}%`, 'level');
  }
  function giveQuest() {
    const g = G(), p = g.player, q = gquest(), t = totals();
    if (!gid || !q.id) return;
    const n = Math.min(NC.matCount(p, q.id), q.need - t.qn);
    if (n <= 0) return;
    p.mats[q.id] -= n; if (p.mats[q.id] <= 0) delete p.mats[q.id];
    pend.qn += n; pend.gx += n * 4;
    if (NC.saveTrade) NC.saveTrade(g);
    note(`${me()} ส่ง${(NC.MATERIALS[q.id] || {}).name || q.id} ×${n} ให้เควสกิลด์`);
    tick(true);
  }
  (NC.xpFilters || (NC.xpFilters = [])).push((game, n, jn) => {
    if (gid && guild && n > 0) { pend.gx += n * 0.001; if (paidNow()) n = Math.round(n * (1 + totals().lv / 100)); }
    return [n, jn];
  });

  // ---------------- the guild boss: one HP pool, a copy in each member's world ----------------
  function wakeBoss() {
    const g = G(), p = g.player, w = weekNo();
    if (rankOf(uid) !== 'leader' || (guild.boss && guild.boss.week === w) || !(g.world && g.world.field)) return;
    const type = GB[Math.min(GB.length - 1, Math.floor(p.lv / 25))], lv = Math.max(20, p.lv);
    const probe = NC.makeEnemy(type, p.x + 300, p.y, lv);
    if (!probe) return;
    const onMap = NC.Net ? [...NC.Net.remotes.values()].filter((r) => r.gu && r.gu[0] === gid && r.map === g.mapId).length : 0;
    const hp = Math.round(probe.maxHp * 4 * (1 + 0.5 * onMap));
    S.update('guilds/' + gid, { boss: { week: w, type, lv, map: g.mapId, x: Math.round(p.x + 300), y: Math.round(p.y), t0: Date.now(), hp, done: 0 } });
    note(`หัวหน้าปลุกร่างราตรีของ${probe.name}ที่${(NC.MAPS[g.mapId] || {}).name || g.mapId}! มีเวลา 20 นาที`, 'level');
  }
  function bossDmg() {
    const b = guild && guild.boss, w = b ? b.week : 0;
    let sum = myBdWeek === w ? myBd : 0;
    const live = new Map();
    if (NC.Net) for (const r of NC.Net.remotes.values()) if (r.ud && Array.isArray(r.gb) && r.gb[0] === w) live.set(r.ud, r.gb[1]);
    for (const { id, data: m } of roster) {
      if (id === uid) continue;
      sum += Math.max(m.bd && m.bd.week === w ? +m.bd.dmg || 0 : 0, live.get(id) || 0);
    }
    return sum;
  }
  let bossEnd = 0;
  function bossTick(game) {
    const b = guild && guild.boss, w = weekNo();
    const copy = game.enemies.find((e) => e.guildBoss && !e.dead);
    if (!b || b.week !== w || b.done || !gid) { if (copy) { copy.dead = true; copy.hp = 0; } return; }
    if (myBdWeek !== w) { myBdWeek = w; myBd = 0; }
    const total = bossDmg();
    if ((Date.now() - b.t0) / 1000 > BOSS_S) {
      if (copy) { copy.dead = true; copy.hp = 0; }
      if (Date.now() - bossEnd > 10000) { bossEnd = Date.now(); S.update('guilds/' + gid, { boss: { done: 1 }, bossx: { [w]: Math.min(80000, Math.round(total * 0.5)) } }); note(`หมดเวลา · บอสกิลด์หนีไป (กิลด์ได้ EXP จากดาเมจ ${Math.min(80000, Math.round(total * 0.5)).toLocaleString()})`, 'warn'); }
      return;
    }
    if (game.mapId !== b.map) { if (copy) { copy.dead = true; copy.hp = 0; } return; }
    let e = copy;
    if (!e && total < b.hp && !game.enemies.some((x) => x.guildBoss)) {
      e = NC.makeEnemy(b.type, b.x, b.y, b.lv);
      if (!e) return;
      e.maxHp = b.hp; e.guildBoss = { week: w }; e.name = 'ร่างราตรี ' + e.name;
      game.enemies.push(e);
    }
    if (!e) return;
    if (total >= b.hp) {
      if (myBd > 0) { e._heroT = game.time; NC.damageEnemy(game, e, { dmg: e.hp + 1, mod: 1 }, 0, 0); } // (they finished it: my copy falls too, with my drops)
      else { e.dead = true; e.hp = 0; }
      return;
    }
    e.hp = Math.max(1, b.hp - total);
  }
  const baseDmg = NC.damageEnemy;
  NC.damageEnemy = function (game, e, r) {
    if (!e || !e.guildBoss) return baseDmg.apply(this, arguments);
    const was = e.hp, w = weekNo();
    const res = baseDmg.apply(this, arguments);
    if (myBdWeek !== w) { myBdWeek = w; myBd = 0; }
    myBd += Math.max(0, was - Math.max(0, e.hp));
    if (e.hp <= 0) {
      // the guild boss never comes back as a field monster
      for (let i = game.respawns.length - 1; i >= 0; i--) if (game.respawns[i].type === e.type && game.respawns[i].x === e.sx && game.respawns[i].y === e.sy) { game.respawns.splice(i, 1); break; }
      if (guild && guild.boss && !guild.boss.done) { S.update('guilds/' + gid, { boss: { done: 1 }, bossx: { [w]: 80000 } }); note('ล้มบอสกิลด์สำเร็จ! กิลด์ได้ EXP 80,000', 'level'); }
      tick(true);
    }
    return res;
  };
  if (NC.skillTicks) NC.skillTicks.push((game) => { if (guild && guild.boss) bossTick(game); });

  // ---------------- online: who I am, my guild, the boss damage ----------------
  if (NC.Net) {
    NC.Net.fields.push({ key: 'ud', get: () => uid });
    NC.Net.fields.push({ key: 'gu', get: () => (gid && guild ? [gid, clean(guild.name, NAME_MAX), okColor(guild.color), guild.emblem | 0, totals().lv] : null) });
    NC.Net.fields.push({ key: 'gb', get: () => (guild && guild.boss && guild.boss.week === weekNo() && !guild.boss.done && myBd > 0 ? [myBdWeek, Math.round(myBd)] : null) });
    NC.Net.hooks.push((r, pr) => {
      r.ud = typeof pr.ud === 'string' && pr.ud.length <= 64 ? pr.ud : null;
      const g = pr.gu;
      const gu = Array.isArray(g) && typeof g[0] === 'string' ? [g[0].slice(0, 96), clean(String(g[1]), NAME_MAX), okColor(g[2]), Math.max(0, Math.min(11, g[3] | 0)), Math.max(1, Math.min(10, g[4] | 0))] : null;
      if (gu && Number.isFinite(g[5]) && Number.isFinite(g[6])) gu.push(g[5], g[6]); // (online: the server's spot for that guild's fire, online/socialnotify.js)
      const before = r.gu ? r.gu[0] : null;
      r.gu = gu;
      r.gb = Array.isArray(pr.gb) ? [pr.gb[0] | 0, Math.max(0, +pr.gb[1] || 0)] : null;
      if (gu && gu[0] !== before) { seenGuilds.set(gu[0], gu); placeFires(); }
    });
  }

  // ---------------- the guild lane: a fire per guild in the camp ----------------
  // (open grass in camp.js's clearing, off the roads, clear of the stalls, the training ground and the forest's monster
  // clearings: checked on the camp's overview, 2026-10-01)
  const LANE = (NC.CAMP_SPOT && NC.CAMP_SPOT.guild) || [[2330, 1640], [1000, 2090], [2050, 2080]]; // (camp.js: the big camp's guild lane)
  const slotOf = (id) => { let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return LANE[h % LANE.length]; };
  const seenGuilds = new Map(); // gid -> [gid, name, color, emblem, lv] (from the presence)
  let fires = [];
  const hexRgb = (h) => { const n = parseInt(String(h).slice(1), 16) || 0xff8a3c; return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`; };
  function placeFires() {
    const game = G(), w = game && game.world;
    if (!w || !w.camp) { fires = []; return; }
    w.props = w.props.filter((q) => !q.guildFire);
    w.lights = w.lights.filter((l) => !l.guildFire);
    fires = [];
    const all = new Map();
    if (gid && guild) all.set(gid, { name: guild.name, color: okColor(guild.color) }); // (mine first: it keeps its own spot)
    for (const [id, gu] of seenGuilds) if (!all.has(id)) all.set(id, { name: gu[1], color: gu[2], at: gu.length > 6 ? [gu[5], gu[6]] : null });
    const used = new Set();
    for (const [id, f] of all) {
      let [x, y] = f.at || slotOf(id);
      while (used.has(x + ',' + y) && used.size < LANE.length) { const i = (LANE.findIndex((s) => s[0] === x && s[1] === y) + 1) % LANE.length; [x, y] = LANE[i]; }
      if (used.has(x + ',' + y)) continue;
      used.add(x + ',' + y);
      const prop = { kind: 'prop', name: NC.SPR.camp_fire ? 'camp_fire' : 'camp_firebase', x, y, scale: 0.6, flip: false, sort: y, guildFire: id, shadow: [60, 14] }; // (camp.js's burning fire)
      w.props.push(prop);
      w.lights.push({ x, y: y - 60, r: 380, rgb: hexRgb(f.color), flick: 2.2, owner: prop, guildFire: true });
      fires.push({ x, y, id, name: clean(f.name, NAME_MAX), color: f.color });
    }
  }
  NC.guildFires = (game) => (game.world && game.world.camp ? fires.filter((f) => f.id === gid) : []);
  const baseBuild = NC.buildWorld;
  if (baseBuild) NC.buildWorld = function () { const w = baseBuild.apply(this, arguments); setTimeout(() => { if (G() && G().world === w) placeFires(); }, 0); return w; };
  // the names over the fires and the heroes («guild», with its emblem)
  const P = NC.Party;
  if (P && P.drawTags) {
    const baseTags = P.drawTags;
    P.drawTags = function (ctx, game) {
      baseTags.apply(this, arguments);
      ctx.save(); ctx.textAlign = 'center'; ctx.lineJoin = 'round';
      for (const f of fires) {
        ctx.font = '600 22px Mitr, sans-serif'; ctx.lineWidth = 6; ctx.strokeStyle = NC.OUTLINE || '#2a2435';
        ctx.strokeText('กองไฟกิลด์ ' + f.name, f.x, f.y - 130); ctx.fillStyle = f.color; ctx.fillText('กองไฟกิลด์ ' + f.name, f.x, f.y - 130);
      }
      const tag = (x, y, name, color, em) => {
        ctx.font = '600 20px Mitr, sans-serif'; ctx.lineWidth = 5; ctx.strokeStyle = NC.OUTLINE || '#2a2435';
        const t = '«' + name + '»', tw = ctx.measureText(t).width, s = NC.SPR['gem_' + em];
        const tx = s ? x + 13 : x;
        ctx.strokeText(t, tx, y); ctx.fillStyle = color; ctx.fillText(t, tx, y);
        if (s) {
          const r = 13, cx = tx - tw / 2 - r - 3, cy = y - 7;
          ctx.fillStyle = color; ctx.beginPath(); ctx.arc(cx, cy, r * 0.86, 0, TAU); ctx.fill();
          ctx.drawImage(s.img, cx - r, cy - r, r * 2, r * 2);
        }
      };
      const p = game.player;
      // (just over the hat: a hero is ~130 units tall)
      if (gid && guild && p && p.dead <= 0) tag(p.x, p.y - 152, clean(guild.name, NAME_MAX), okColor(guild.color), guild.emblem | 0);
      if (NC.Net && NC.Net.remotes) for (const r of NC.Net.remotes.values()) if (r.gu && r.pose && r.map === game.mapId) tag(r.x, r.y - 152, r.gu[1], r.gu[2], r.gu[3]);
      ctx.restore();
    };
  }

  // ======================================================================================================
  // ---------------- the window (O), layout B ----------------
  const ART = 'assets/kui/guild_hall.jpg';
  const AW = 1280, AH = 640, BAND = [44, 446]; // (the art, and the part of it the stage shows: the banner to the fire)
  const BANNER = { x0: 236, x1: 332, y0: 62, y1: 245 };
  const FIRE = [640, 438];
  // where members sit (logs and the stump) and stand (by the fire), in art pixels: [x, feet y, sit]
  const SEATS = [[425, 300, 1], [852, 302, 1], [512, 452, 0], [770, 452, 0], [298, 384, 1]];
  const TONGUES = [[-30, 40, 86, 1.7], [34, 42, 92, 3.1], [0, 62, 138, 0], [-14, 30, 62, 4.4], [18, 28, 56, 5.2]];
  const art = new Image();
  art.src = ART;
  let win = null, stage = null, raf = 0, tab = 'members', sel = null, form = { name: '', color: COLORS[0], emblem: 0 }, invOpen = false, editing = false;
  let topGuilds = [], topT = 0;
  const sparks = [];
  const TABS = [['members', 'สมาชิก'], ['notice', 'ประกาศ'], ['fire', 'กองไฟกิลด์'], ['rank', 'อันดับกิลด์']];

  function onlineOf(u) {
    if (u === uid) return { map: G().mapId };
    if (NC.Net) for (const r of NC.Net.remotes.values()) if (r.ud === u && r.named) return r;
    // (online, a mate on another map: the server's roster says so, js/online/store.js; Discord #137)
    const m = memberDoc(u);
    return m && m.online ? { map: m.map, ch: m.ch, equip: m.eq && !Array.isArray(m.eq) ? m.eq : null } : null;
  }
  const ago = (t) => { const m = Math.max(0, (Date.now() - (t || 0)) / 60000); return m < 60 ? `${Math.max(1, Math.round(m))} นาที` : m < 1440 ? `${Math.round(m / 60)} ชม.` : `${Math.round(m / 1440)} วัน`; };
  function eqOf(m, u) {
    if (u === uid) return NC.lookEquip ? NC.lookEquip(G().player.equip) : G().player.equip;
    const on = onlineOf(u);
    if (on && on.equip) return on.equip;
    const e = { hat: null, hair: 'hair_brown', top: 'top_traveler', pants: 'pants_traveler', shoes: 'shoes_traveler', weapon: 'sword', robe: null, cape: null, glasses: null };
    if (m && Array.isArray(m.eq)) SLOTS.forEach((s, i) => { const id = m.eq[i]; if (id === null || (typeof id === 'string' && NC.ITEMS[id] && (!NC.ITEMS[id].slot || NC.ITEMS[id].slot === s))) e[s] = id; });
    return e;
  }
  // the members in the window's order: leader, officers, members; online first inside each
  function people() {
    const R = { leader: 0, officer: 1, member: 2 };
    return roster.map((r) => ({ id: r.id, m: r.data, rank: rankOf(r.id), on: !!onlineOf(r.id) }))
      .sort((a, b) => R[a.rank] - R[b.rank] || (b.on ? 1 : 0) - (a.on ? 1 : 0) || (a.m.joined || 0) - (b.m.joined || 0));
  }

  function build() {
    win = document.createElement('div');
    win.id = 'guildwin'; win.className = 'kw-panel'; win.hidden = true;
    win.innerHTML = '<div class="gw-wrap"><section class="kw-win gw-win">' +
      '<header class="kw-title"><span>กิลด์</span><button class="kw-x" id="gw-close" aria-label="ปิด">✕</button></header>' +
      '<div class="gw-scene"><canvas id="gw-stage"></canvas><div class="gw-tags" id="gw-tags"></div><div class="gw-card" id="gw-card"></div></div>' +
      '<nav class="kw-tabs gw-tabs" id="gw-tabs"></nav><div class="gw-body" id="gw-body"></div></section></div>';
    document.body.appendChild(win);
    stage = $('gw-stage');
    $('gw-close').addEventListener('click', close);
    win.addEventListener('click', onClick);
    win.addEventListener('input', (e) => {
      if (e.target.id === 'gw-name') form.name = e.target.value;
    });
    listeners.push(() => { if (win && !win.hidden && !editing) render(); });
  }
  async function onClick(e) {
    const t = e.target.closest('[data-tab]');
    if (t) { tab = t.dataset.tab; invOpen = false; render(); return; }
    const pick = e.target.closest('[data-pick]');
    if (pick && !e.target.closest('button')) { sel = pick.dataset.pick === sel ? null : pick.dataset.pick; render(); return; }
    const c = e.target.closest('[data-color]');
    if (c) { form.color = c.dataset.color; render(); return; }
    const em = e.target.closest('[data-emblem]');
    if (em) { form.emblem = +em.dataset.emblem; render(); return; }
    const b = e.target.closest('[data-g]');
    if (!b || b.disabled) return;
    const a = b.dataset.g, g = G();
    if (a === 'found') {
      const n = $('gw-name'); if (n) form.name = n.value;
      const r = await found(form.name, form.color, form.emblem);
      if (r !== 'ok') g.toast({ name: 'ตั้งชื่อกิลด์อย่างน้อย 2 ตัวอักษร', coins: `ต้องมี ${fmt(cost())} เหรียญ${beta() ? ' (ราคาช่วงเบต้า)' : ''}`, taken: 'ชื่อนี้มีกิลด์ใช้แล้ว', have: 'คุณมีกิลด์อยู่แล้ว' }[r] || 'ตั้งกิลด์ไม่ได้');
    } else if (a === 'accept') accept();
    else if (a === 'decline') decline();
    else if (a === 'invite') invOpen = !invOpen;
    else if (a === 'inv') { const r = NC.Net && [...NC.Net.remotes.values()].find((x) => x.ud === b.dataset.u); const res = await sendInvite(r); if (res === 'full') g.toast('กิลด์เต็มแล้ว'); b.disabled = true; b.textContent = 'ชวนแล้ว'; return; }
    else if (a === 'promote' && sel) promote(sel);
    else if (a === 'kick' && sel) kick(sel);
    else if (a === 'lead' && sel) makeLeader(sel);
    else if (a === 'chat') { close(); setTimeout(() => { const i = $('cw-text'); if (i) { i.focus(); i.value = '/g '; } }, 50); return; }
    else if (a === 'leave') { if (b.dataset.sure) await leave(); else { b.dataset.sure = 1; b.textContent = 'กดอีกครั้งเพื่อออก'; return; } }
    else if (a === 'notice') { editing = true; render(); const ta = $('gw-ntext'); if (ta) ta.focus(); return; }
    else if (a === 'nsave') { const ta = $('gw-ntext'); editing = false; if (ta) setNotice(ta.value); }
    else if (a === 'ncancel') editing = false;
    else if (a === 'd10') donate(10000);
    else if (a === 'd100') donate(100000);
    else if (a === 'pay') payUpkeep();
    else if (a === 'give') giveQuest();
    else if (a === 'boss') { close(); wakeBoss(); return; }
    render();
  }
  function open(t) { if (t) tab = t; dot(false); render(); if (!raf) raf = requestAnimationFrame(loop); refreshTop(); }
  function close() { NC.HUD.panel('guild', false); const g = G(); if (g) g.paused = false; }
  function fit() {
    const wrap = win.querySelector('.gw-wrap');
    wrap.style.transform = 'translate(-50%, -50%)';
    const k = Math.min(1, (innerWidth - 16) / wrap.offsetWidth, (innerHeight - 16) / wrap.offsetHeight);
    if (k < 1) wrap.style.transform = `translate(-50%, -50%) scale(${k.toFixed(4)})`;
  }
  addEventListener('resize', () => setTimeout(() => { if (win && !win.hidden) { fit(); faces(); } }, 0));
  setInterval(() => { if (win && !win.hidden && !editing) render(true); }, 5000);
  async function refreshTop() {
    if (Date.now() - topT < 20000) return;
    topT = Date.now();
    try { topGuilds = await S.query('guilds', { order: ['score', 'desc'], limit: 20 }); } catch (e) { topGuilds = []; }
    if (win && !win.hidden && tab === 'rank') render(true);
  }

  // ---------------- the HTML ----------------
  let lastBody = '';
  function render(soft) {
    if (!win || win.hidden) return;
    const g = G();
    $('gw-tabs').innerHTML = gid && guild ? TABS.map(([k, n]) => `<button class="kw-tab${tab === k ? ' on' : ''}" data-tab="${k}">${n}</button>`).join('')
      : '<button class="kw-tab on">ตั้งกิลด์ · คำชวน</button>';
    renderCard();
    renderTags();
    const h = gid && guild ? (tab === 'notice' ? bodyNotice() : tab === 'fire' ? bodyFire(g) : tab === 'rank' ? bodyRank() : bodyMembers()) : bodyNone(g);
    if (h !== lastBody) { $('gw-body').innerHTML = h; lastBody = h; faces(); }
    if (!soft) fit();
  }
  function renderCard() {
    const el = $('gw-card');
    if (!gid || !guild) {
      el.innerHTML = `<div class="gw-emb"><i style="background:${form.color}"></i><img src="${gem(form.emblem)}" alt=""></div>` +
        '<div class="gw-gname">ยังไม่มีกิลด์</div><div class="gw-glv">ตั้งกิลด์เองหรือรอคำชวน</div>' +
        `<div class="gw-coffer"><img src="${NC.matIcon ? NC.matIcon('ic_coin') : ''}" alt=""><span>ตั้งกิลด์</span>${beta() ? `<s>${fmt(COST_FULL)}</s>` : ''}<b>${fmt(cost())}</b></div>` +
        (beta() ? '<div class="gw-betatag">ราคาช่วงเบต้า</div>' : '');
      return;
    }
    const t = totals(), pct = t.next ? Math.max(0, Math.min(1, (t.exp - t.prev) / (t.next - t.prev))) : 1;
    el.innerHTML = `<div class="gw-emb"><i style="background:${okColor(guild.color)}"></i><img src="${gem(guild.emblem)}" alt=""></div>` +
      `<div class="gw-gname" style="color:${okColor(guild.color)}">${esc(clean(guild.name, NAME_MAX))}</div><div class="gw-glv">กิลด์ Lv ${t.lv}</div>` +
      `<div class="gw-bar"><i style="width:${(pct * 100).toFixed(1)}%"></i><b>${t.next ? Math.floor(pct * 100) + '%' : 'MAX'}</b></div>` +
      `<div class="gw-gmem">สมาชิก <b>${t.n} / ${t.cap}</b></div>` +
      `<div class="gw-coffer"><img src="${NC.matIcon ? NC.matIcon('ic_coin') : ''}" alt=""><span>คลัง</span><b>${fmt(t.coffer)}</b></div>`;
  }
  // the name tags over the seated members (HTML over the stage)
  function stageMap() {
    const r = stage.getBoundingClientRect(), W = r.width || 1, H = r.height || 1;
    const bh = BAND[1] - BAND[0], k = Math.max(W / AW, H / bh), ox = (W - AW * k) / 2, oy = -BAND[0] * k + (H - bh * k) / 2;
    return { k, x: (ax) => ox + ax * k, y: (ay) => oy + ay * k, W, H };
  }
  function seated() {
    if (!gid || !guild) return [{ id: uid, m: { name: me() }, rank: null, on: true }];
    return people().filter((p) => p.on).concat(people().filter((p) => !p.on)).slice(0, SEATS.length);
  }
  function renderTags() {
    const M = stageMap(), list = seated();
    $('gw-tags').innerHTML = list.map((p, i) => {
      const [ax, ay, sit] = SEATS[i], top = M.y(ay - (sit ? 168 : 214)) / M.H;
      return `<span class="gw-tag${p.id === uid ? ' you' : ''}${p.on ? '' : ' off'}" style="left:${((M.x(ax) / M.W) * 100).toFixed(2)}%;top:${(top * 100).toFixed(2)}%">` +
        `${p.rank === 'leader' ? `<img src="${icon('ic_crown')}" alt="">` : ''}${esc(p.id === uid ? 'คุณ' : clean(p.m.name, NAME_MAX))}</span>`;
    }).join('');
  }
  function memberCard(p) {
    const m = p.m, J = NC.JOBS[m.job] || {}, R = RANK[p.rank] || RANK.member, on = onlineOf(p.id);
    const where = on ? `<span class="gw-on"><i></i>${esc(NC.Net && p.id !== uid ? NC.Net.mapName(on.map) : (NC.MAPS[G().mapId] || {}).name || '')}</span>` : `<span class="gw-off"><i></i>ออฟไลน์ ${ago(m.seen)}</span>`;
    return `<div class="gw-mem${sel === p.id ? ' sel' : ''}${p.id === uid ? ' you' : ''}" data-pick="${esc(p.id)}"><canvas data-face="${esc(p.id)}"></canvas>` +
      `<div class="gw-mt"><b>${esc(clean(m.name, NAME_MAX))}${p.id === uid ? ' (คุณ)' : ''}</b><small>${esc(J.name || '')}</small><small>Lv ${m.lv | 0}</small></div>` +
      `<div class="gw-mr"><span class="gw-rank ${R[1]}">${p.rank === 'leader' ? `<img src="${icon('ic_crown')}" alt="">` : ''}${R[0]}</span>${where}</div></div>`;
  }
  function side() {
    const r = rankOf(uid), S2 = sel && sel !== uid ? rankOf(sel) : null, lead = r === 'leader', mgr = lead || r === 'officer';
    const canKick = S2 && (lead || (r === 'officer' && S2 === 'member'));
    let h = `<div class="gw-sign"><div class="gw-sign-t">ประกาศ</div><div class="gw-sign-b">${esc(clean(guild.notice, NOTICE_MAX) || '—')}</div></div>`;
    h += `<div class="gw-btns"><div class="gw-bt">${lead ? 'หัวหน้ากิลด์' : mgr ? 'รองหัวหน้า' : 'หัวหน้า / รอง'}</div>` +
      `<button class="kw-btn blue" data-g="invite"${mgr ? '' : ' disabled'}>ชวน</button>` +
      `<button class="kw-btn gold" data-g="promote"${lead && S2 ? '' : ' disabled'}>${S2 === 'officer' ? 'ปลดรอง' : 'ตั้งเป็นรอง'}</button>` +
      `<button class="kw-btn grey" data-g="kick"${canKick ? '' : ' disabled'}>ให้ออก</button>` +
      (lead ? `<button class="kw-btn gold gw-wide" data-g="lead"${S2 ? '' : ' disabled'}>มอบตำแหน่งหัวหน้า</button>` : '') +
      '<div class="gw-bt">ทุกคน</div><button class="kw-btn blue" data-g="chat">แชทกิลด์</button><button class="kw-btn grey" data-g="leave">ออกจากกิลด์</button>' +
      `<div class="gw-hint">${sel && sel !== uid ? 'เลือก: ' + esc(clean((memberDoc(sel) || {}).name, NAME_MAX)) : 'คลิกสมาชิกเพื่อเลือก'}</div></div>`;
    return h;
  }
  function invList() {
    const rs = NC.Net ? [...NC.Net.remotes.values()].filter((r) => r.named && r.ud && !r.gu) : [];
    return '<div class="gw-inv"><div class="gw-invh">ชวนคนที่ออนไลน์อยู่ (ยังไม่มีกิลด์)</div>' + (rs.length ? rs.map((r) =>
      `<div class="gw-invr"><b>${esc(r.name)}</b><small>Lv ${r.lv} · ${esc((NC.JOBS[r.job] || {}).name || '')}</small><button class="kw-btn blue" data-g="inv" data-u="${esc(r.ud)}">ชวน</button></div>`).join('')
      : `<div class="gw-empty">${NC.Net && NC.Net.room ? 'ตอนนี้ไม่มีคนที่ยังไม่มีกิลด์ออนไลน์อยู่' : 'ยังไม่ได้ออนไลน์ · เปิดเกมจากลิงก์ออนไลน์เพื่อชวนเพื่อน'}</div>`) + '</div>';
  }
  function bodyMembers() {
    const list = people();
    return `<div class="gw-mbody"><div class="gw-list kw-scroll">${invOpen ? invList() : ''}<div class="gw-grid">${list.map(memberCard).join('')}</div></div><aside class="gw-side">${side()}</aside></div>`;
  }
  function bodyNotice() {
    const mgr = canManage();
    return '<div class="gw-pad"><div class="gw-sign big"><div class="gw-sign-t">ประกาศกิลด์</div>' +
      (editing ? `<textarea id="gw-ntext" maxlength="${NOTICE_MAX}">${esc(guild.notice || '')}</textarea><div class="gw-row"><button class="kw-btn gold" data-g="nsave">บันทึก</button><button class="kw-btn grey" data-g="ncancel">ยกเลิก</button></div>`
        : `<div class="gw-sign-b">${esc(clean(guild.notice, NOTICE_MAX) || '—')}</div>${mgr ? '<div class="gw-row"><button class="kw-btn blue" data-g="notice">แก้ประกาศ</button></div>' : ''}`) +
      `</div><div class="gw-note">หัวหน้าและรองหัวหน้าแก้ประกาศได้ (ไม่เกิน ${NOTICE_MAX} ตัวอักษร) · ทุกคนเห็นเมื่อเปิดหน้าต่างกิลด์ · คุยกันในแชทกิลด์: /g ข้อความ</div></div>`;
  }
  function bodyFire(g) {
    const t = totals(), q = gquest(), p = g.player, w = weekNo(), b = guild.boss && guild.boss.week === w ? guild.boss : null, lead = rankOf(uid) === 'leader';
    const qdone = (guild.qdone || {})[w], have = q.id ? NC.matCount(p, q.id) : 0;
    const bossState = !b ? 'ยังไม่ได้ปลุกสัปดาห์นี้' : b.done ? 'ล้มแล้ว / จบแล้วสัปดาห์นี้ ✔' : `ตื่นอยู่ที่ ${esc((NC.MAPS[b.map] || {}).name || b.map)} · ดาเมจกิลด์ ${Math.round(bossDmg()).toLocaleString()} / ${b.hp.toLocaleString()} · เหลือ ${Math.max(0, Math.ceil((BOSS_S - (Date.now() - b.t0) / 1000) / 60))} นาที`;
    return '<div class="gw-pad gw-fire">' +
      '<div class="gw-tiles">' +
      `<div class="gw-tile"><b>+${paidNow() ? t.lv : 0}%</b><span>EXP ของสมาชิก${paidNow() ? '' : ' (ยังไม่จ่ายค่าดูแล)'}</span></div>` +
      `<div class="gw-tile"><b>${Math.floor(t.exp).toLocaleString()}</b><span>EXP กิลด์${t.next ? ' / ' + t.next.toLocaleString() : ' (เต็ม)'}</span></div>` +
      `<div class="gw-tile"><b>${fmt(t.coffer)}</b><span>คลัง · ค่าดูแล ${fmt(20000 * t.lv)}/สัปดาห์</span></div>` +
      `<div class="gw-tile"><b>${t.n} / ${t.cap}</b><span>สมาชิก (Lv ละ +4 คน)</span></div></div>` +
      `<div class="gw-row"><button class="kw-btn gold" data-g="d10"${(p.coins || 0) >= 10000 ? '' : ' disabled'}>ใส่คลัง 10,000</button><button class="kw-btn gold" data-g="d100"${(p.coins || 0) >= 100000 ? '' : ' disabled'}>ใส่คลัง 100,000</button>` +
      `<button class="kw-btn blue" data-g="pay"${canManage() && !paidNow() && t.coffer >= 20000 * t.lv ? '' : ' disabled'}>${paidNow() ? 'จ่ายค่าดูแลสัปดาห์นี้แล้ว ✔' : 'จ่ายค่าดูแล (หัวหน้า/รอง)'}</button></div>` +
      (q.id ? `<div class="gw-h2">เควสกิลด์สัปดาห์นี้</div><div class="gw-qrow${qdone ? ' done' : ''}"><img src="${NC.matIcon ? NC.matIcon(q.id) : ''}" alt=""><div class="gw-qt"><b>ส่ง${esc((NC.MATERIALS[q.id] || {}).name || q.id)} รวมทั้งกิลด์</b>` +
        `<small>${Math.min(q.need, t.qn).toLocaleString()} / ${q.need.toLocaleString()} · ครบได้ EXP กิลด์ 30,000 · ชิ้นละ +4 EXP กิลด์ · คุณมี ${have.toLocaleString()}</small>` +
        `<div class="gw-qbar"><i style="width:${Math.min(100, (t.qn / q.need) * 100).toFixed(1)}%"></i></div></div><button class="kw-btn gold" data-g="give"${have && !qdone ? '' : ' disabled'}>ส่งทั้งหมด</button></div>` : '') +
      `<div class="gw-h2">บอสกิลด์สัปดาห์นี้</div><div class="gw-qrow"><img src="${icon('ic_gshield')}" alt=""><div class="gw-qt"><b>${bossState}</b>` +
      '<small>หัวหน้าปลุกได้สัปดาห์ละครั้งในแมพทุ่ง · 20 นาที · สมาชิกในแมพนั้นตีพร้อมกัน (เลือดบอสรวมกัน) · ล้มได้ EXP กิลด์ 80,000</small></div>' +
      `<button class="kw-btn red" data-g="boss"${lead && !b && g.world && g.world.field ? '' : ' disabled'}>ปลุกบอส</button></div>` +
      `<div class="gw-note"><img src="${icon('ic_pfire')}" alt="">กองไฟของกิลด์อยู่ที่ลานกิลด์ในค่ายกลางป่า · นั่งพักข้างกองไฟกิลด์ได้ไออุ่นเหมือนกองไฟใหญ่</div></div>`;
  }
  // (my own guild: its live numbers; the stored ones are written once a minute)
  function liveTop(list) {
    if (!gid || !guild) return list;
    const t = totals(), mine = { id: gid, data: Object.assign({}, guild, { score: t.exp, lv: t.lv, n: t.n }) };
    return list.filter((r) => r.id !== gid).concat(mine).sort((a, b) => (b.data.score || 0) - (a.data.score || 0));
  }
  function rankRows(list) {
    return liveTop(list).map((r, i) => { const d = r.data || {}; return `<div class="gw-rrow${r.id === gid ? ' me' : ''}"><span class="gw-rno">#${i + 1}</span>` +
      `<span class="gw-remb"><i style="background:${okColor(d.color)}"></i><img src="${gem(d.emblem)}" alt=""></span><b style="color:${okColor(d.color)}">${esc(clean(d.name, NAME_MAX))}</b>` +
      `<span>Lv ${Math.max(1, d.lv | 0)}</span><span>สมาชิก ${Math.max(1, d.n | 0)}</span><span class="gw-rexp">${Math.round(d.score || 0).toLocaleString()} EXP</span></div>`; }).join('');
  }
  function bodyRank() {
    refreshTop();
    return `<div class="gw-pad"><div class="gw-rank-h">อันดับกิลด์ตาม EXP กิลด์ · อัปเดตทุกนาที</div><div class="gw-ranks kw-scroll">${topGuilds.length ? rankRows(topGuilds) : '<div class="gw-empty">ยังไม่มีอันดับ</div>'}</div>` +
      '<div class="gw-note">ดูอันดับผู้เล่นทุกหมวดได้ที่ตารางอันดับ (N)</div></div>';
  }
  function bodyNone(g) {
    const p = g.player, COST = cost(), okCoins = (p.coins || 0) >= COST;
    refreshTop();
    const inv = invite ? `<div class="gw-invite"><span class="gw-remb lg"><i style="background:${okColor(invite.color)}"></i><img src="${gem(invite.emblem)}" alt=""></span>` +
      `<div><b>${esc(clean(invite.fromName, NAME_MAX))}</b> ชวนคุณเข้ากิลด์ <b style="color:${okColor(invite.color)}">«${esc(clean(invite.name, NAME_MAX))}»</b></div>` +
      '<button class="kw-btn gold" data-g="accept">เข้าร่วม</button><button class="kw-btn grey" data-g="decline">ไม่เข้า</button></div>' : '';
    return '<div class="gw-mbody none"><div class="gw-pad">' + inv +
      `<div class="gw-h2">ตั้งกิลด์ใหม่ ${beta() ? `<s>${fmt(COST_FULL)}</s>` : ''}<small>${fmt(COST)} เหรียญ</small>${beta() ? '<span class="gw-betatag">ราคาช่วงเบต้า</span>' : ''}</div>` +
      `<div class="gw-form"><input id="gw-name" maxlength="${NAME_MAX}" placeholder="ชื่อกิลด์ (2–${NAME_MAX} ตัว)" value="${esc(form.name)}" autocomplete="off">` +
      `<div class="gw-colors">${COLORS.map((c) => `<button class="gw-color${form.color === c ? ' on' : ''}" data-color="${c}" style="background:${c}" aria-label="สี"></button>`).join('')}</div>` +
      `<div class="gw-gems">${Array.from({ length: 12 }, (_, i) => `<button class="gw-gem${form.emblem === i ? ' on' : ''}" data-emblem="${i}"><i style="background:${form.color}"></i><img src="${gem(i)}" alt=""></button>`).join('')}</div>` +
      `<button class="kw-btn gold gw-found" data-g="found"${okCoins ? '' : ' disabled'}>ตั้งกิลด์ (${fmt(COST)})</button></div>` +
      (beta() ? `<div class="gw-note gw-betanote">ช่วงเบต้าตั้งกิลด์ได้ในราคา ${fmt(COST)} เหรียญ (ปกติ ${fmt(COST_FULL)}) · จบเบต้าแล้วกลับเป็นราคาเต็ม · กิลด์ที่ตั้งไว้แล้วอยู่ต่อตามเดิม</div>` : '') +
      '<div class="gw-note">กิลด์ได้กองไฟของตัวเองในลานกิลด์ของค่าย · สมาชิกได้ EXP เพิ่มตามเลเวลกิลด์ · ทำเควสกิลด์และตีบอสกิลด์ด้วยกันทุกสัปดาห์</div></div>' +
      `<aside class="gw-side"><div class="gw-sign"><div class="gw-sign-t">กิลด์อันดับต้น</div><div class="gw-mini">${topGuilds.length ? rankRows(topGuilds.slice(0, 6)) : '<div class="gw-empty">ยังไม่มีกิลด์</div>'}</div></div></aside></div>`;
  }
  // faces
  function faces() {
    for (const cv of win.querySelectorAll('canvas[data-face]')) {
      const u = cv.dataset.face, m = memberDoc(u), eq = eqOf(m, u), r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
      const W = Math.max(1, Math.round(r.width * dpr)), H = Math.max(1, Math.round(r.height * dpr));
      cv.width = W; cv.height = H;
      const c = cv.getContext('2d'), hs = NC.headSpot(eq), k = (Math.min(W, H) * 0.8) / hs.w;
      NC.drawAvatar(c, eq, W / 2 - hs.x * k, H * 0.6 - hs.y * k, k, 1, { noWeapon: true, t: 0.3 });
    }
  }

  // ---------------- the stage: the hall, the banner, the fire, the members round it ----------------
  function drawStage(t) {
    const r = stage.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    const W = Math.max(1, Math.round(r.width * dpr)), H = Math.max(1, Math.round(r.height * dpr));
    if (stage.width !== W || stage.height !== H) { stage.width = W; stage.height = H; }
    const c = stage.getContext('2d'), bh = BAND[1] - BAND[0], k = Math.max(W / AW, H / bh), ox = (W - AW * k) / 2, oy = -BAND[0] * k + (H - bh * k) / 2;
    const X = (ax) => ox + ax * k, Y = (ay) => oy + ay * k;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, W, H);
    if (art.complete && art.naturalWidth) c.drawImage(art, ox, oy, AW * k, AH * k);
    const color = gid && guild ? okColor(guild.color) : form.color, em = gid && guild ? guild.emblem | 0 : form.emblem;
    // the banner: the guild's colour over the cloth (multiply keeps its folds), the emblem on it
    c.save();
    c.beginPath();
    const bx0 = X(BANNER.x0), bx1 = X(BANNER.x1), by0 = Y(BANNER.y0), by1 = Y(BANNER.y1);
    c.moveTo(bx0, by0); c.lineTo(bx1, by0); c.lineTo(bx1, by1 - 6 * k);
    for (let i = 1; i <= 6; i++) { const x = bx1 - ((bx1 - bx0) * i) / 6; c.lineTo(x, by1 + Math.sin(i * 1.7 + t * 1.3) * 3 * k - (i % 2 ? 4 : 0) * k); }
    c.closePath();
    c.globalCompositeOperation = 'multiply'; c.fillStyle = color; c.fill();
    c.restore();
    const gs = NC.SPR['gem_' + em], gr = 44 * k, gx = (bx0 + bx1) / 2, gy = by0 + (by1 - by0) * 0.42 + Math.sin(t * 1.3) * 1.5 * k;
    if (gs) {
      c.save(); c.fillStyle = color; c.beginPath(); c.arc(gx, gy, gr * 0.86, 0, TAU); c.fill();
      c.drawImage(gs.img, gx - gr, gy - gr, gr * 2, gr * 2); c.restore();
    }
    // the fire's light
    const fx = X(FIRE[0]), fy = Y(FIRE[1]), fl = 1 + 0.05 * Math.sin(t * 7.3) + 0.03 * Math.sin(t * 13.1);
    let gl = c.createRadialGradient(fx, fy - 40 * k, 10 * k, fx, fy - 40 * k, 470 * k * fl);
    gl.addColorStop(0, 'rgba(255,170,80,0.36)'); gl.addColorStop(1, 'rgba(255,140,60,0)');
    c.fillStyle = gl; c.fillRect(0, 0, W, H);
    c.save(); c.globalCompositeOperation = 'soft-light';
    gl = c.createRadialGradient(fx, fy - 30 * k, 10 * k, fx, fy, 380 * k);
    gl.addColorStop(0, color); gl.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = gl; c.fillRect(0, 0, W, H); c.restore();
    // the members (back to front) and the fire
    const list = seated().map((p, i) => ({ p, s: SEATS[i] })).sort((a, b) => a.s[1] - b.s[1]);
    const b = NC.SPR.camp_firebase, V = NC.VFX;
    const drawFire = () => {
      if (!b) return;
      const s = (200 * k) / b.w, bw = b.w * s, bhh = b.h * s;
      c.drawImage(b.img, fx - bw * b.ax, fy - bhh * (b.ay || 1), bw, bhh);
      if (V && V.flame) {
        const cx = fx - bw * b.ax + bw * 0.5, cy = fy - bhh * (b.ay || 1) + bhh * 0.58;
        for (const [dx, fw, fh, ph] of TONGUES) {
          const flick = 0.84 + 0.16 * Math.sin(t * 5.3 + ph * 2) + 0.06 * Math.sin(t * 13 + ph);
          V.flame(c, cx + dx * s + Math.sin(t * 2.1 + ph) * 3 * s, cy, fw * s, fh * s * flick, t * 7 + ph, V.PAL.fire, 1);
        }
      }
    };
    let fireDone = false;
    list.forEach(({ p, s }, i) => {
      if (!fireDone && s[1] > FIRE[1] - 4) { drawFire(); fireDone = true; }
      const eq = eqOf(p.m, p.id), x = X(s[0]), y = Y(s[1]);
      if (!s[2]) { c.fillStyle = 'rgba(20,14,30,0.3)'; c.beginPath(); c.ellipse(x, y, 62 * k, 15 * k, 0, 0, TAU); c.fill(); }
      const ac = NC.animCtx ? NC.animCtx(eq) : undefined, Pz = NC.Anim.sample(s[2] && NC.Anim.BASE.sit ? 'sit' : 'idle', t + i * 1.1, ac);
      Pz.face = s[0] < FIRE[0] ? 1 : -1;
      c.save();
      if (!p.on) c.filter = 'brightness(0.68) saturate(0.6)'; // (offline: dozing in the dark by the fire)
      if (!(NC.HeroSpine && NC.HeroSpine.preview && NC.HeroSpine.preview(c, eq, x, y, 1.55 * k, { t: t + i * 1.1, clip: s[2] ? 'sit' : 'idle', face: Pz.face, key: 'guild' + i }))) // (the hero rig, js/herospine.js)
        NC.drawHero(c, eq, Pz, x, y, { scale: 1.55 * k });
      c.restore();
    });
    if (!fireDone) drawFire();
    if (Math.random() < 0.35) sparks.push({ x: fx + (Math.random() - 0.5) * 60 * k, y: fy - 70 * k, vx: (Math.random() - 0.5) * 20, vy: -(40 + Math.random() * 50), life: 1.4 + Math.random() });
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.life -= 1 / 60; s.x += (s.vx / 60) * k; s.y += (s.vy / 60) * k; s.vx += Math.sin(t * 3 + i) * 0.6;
      if (s.life <= 0) { sparks.splice(i, 1); continue; }
      c.fillStyle = `rgba(255,${160 + Math.round((60 * s.life) / 2.4)},90,${Math.min(1, s.life)})`;
      c.beginPath(); c.arc(s.x, s.y, 2.4 * k, 0, TAU); c.fill();
    }
    c.restore();
  }
  function loop() {
    raf = 0;
    if (!win || win.hidden) return;
    drawStage(performance.now() / 1000);
    raf = requestAnimationFrame(loop);
  }

  // ---------------- the menu button (O), the dot for an invite, the key ----------------
  let btn = null;
  function dot(on) { const d = btn && btn.querySelector('.dot'); if (d) d.hidden = !on; }
  const baseInit = NC.HUD.init.bind(NC.HUD);
  NC.HUD.init = function (game) {
    baseInit(game);
    build();
    const bar = document.querySelector('.menubar'), gear = bar && bar.querySelector('[data-panel="pause"]');
    if (bar) {
      btn = document.createElement('button');
      btn.className = 'mbtn'; btn.title = 'กิลด์ (O)';
      btn.innerHTML = `<img src="${icon('ic_gshield')}" alt=""><b>O</b><i class="dot" hidden></i>`;
      btn.addEventListener('click', () => { game.paused = NC.HUD.panel('guild'); });
      bar.insertBefore(btn, gear || null);
    }
    const keys = document.querySelector('#pause .keys');
    if (keys && !keys.querySelector('[data-k="O"]')) { const li = document.createElement('li'); li.dataset.k = 'O'; li.innerHTML = '<kbd>O</kbd> กิลด์'; keys.appendChild(li); }
  };
  const basePanel = NC.HUD.panel.bind(NC.HUD);
  NC.HUD.panel = function (id, show) {
    if (win && id === 'guild') {
      const on = show === undefined ? win.hidden : show;
      basePanel('pause', false); // closes every other window
      win.hidden = !on;
      if (on) open(); else { editing = false; invOpen = false; }
      return on;
    }
    if (win) win.hidden = true;
    return basePanel(id, show);
  };
  addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && win && !win.hidden) { e.stopImmediatePropagation(); e.preventDefault(); close(); return; }
    if (e.code !== 'KeyO' || e.repeat || !NC.game || !NC.game.player) return;
    const t = document.activeElement;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    NC.game.paused = NC.HUD.panel('guild');
  }, true);

  NC.Guild = {
    gid: () => (gid && guild ? gid : null), guild: () => guild, members: () => roster, totals, uid: () => uid, rankOf, invite: () => invite,
    open: (t) => { open(t); if (NC.game) NC.game.paused = NC.HUD.panel('guild', true); }, listeners,
    found, accept, leave, kick, promote, makeLeader, setNotice, donate, payUpkeep, giveQuest, wakeBoss, sendInvite, tick,
    drawWindow: (t) => { if (win && !win.hidden) drawStage(t); },
  };
})();
