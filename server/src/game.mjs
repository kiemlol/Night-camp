import crypto from "node:crypto";
import fs from "node:fs";

export const catalog = JSON.parse(
  fs.readFileSync(new URL("../data-catalog/catalog.json", import.meta.url)),
);
const copy = (v) => structuredClone(v);
const fail = (condition, message) => {
  if (!condition) throw new Error(message);
};
const count = (v, max = 999) => {
  const n = Number(v ?? 1);
  fail(Number.isSafeInteger(n) && n > 0 && n <= max, "invalid_count");
  return n;
};
const uuid = (p) => p + "_" + crypto.randomBytes(8).toString("hex");
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const gearLevel = (item) =>
  ({ common: 1, rare: 10, epic: 25, legend: 50, legendary: 50 })[
    item?.rarity
  ] || 1;
export const QUESTS = [
  { id: "first-night", kind: "kill", need: 3, coins: 100, xp: 90 },
  { id: "forest-supplies", kind: "gather", need: 3, coins: 180, xp: 150 },
  { id: "a-new-path", kind: "job", need: 1, coins: 250, xp: 200 },
  { id: "the-dark-root", kind: "dungeon", need: 1, coins: 500, xp: 500 },
];
export const RESOURCES = {
  camp: ["mat_leaf_jelly"],
  meadow: ["mat_leaf_jelly", "mat_boar_tusk"],
  woods: ["mat_ghost_bark", "mat_mush_cap"],
  canyon: ["mat_lava_rock"],
};
const quest = (i) => ({
  index: i,
  id: QUESTS[i]?.id || "journey-complete",
  state: QUESTS[i] ? "active" : "done",
  objectives: QUESTS[i]
    ? [{ kind: QUESTS[i].kind, have: 0, need: QUESTS[i].need }]
    : [],
  keys: [],
});
export function createHero(name, appearance = {}) {
  fail(
    typeof name === "string" &&
      name.trim().length >= 2 &&
      name.trim().length <= 24,
    "invalid_name",
  );
  const h = {
    id: uuid("hero"),
    name: name.trim(),
    appearance,
    mapId: "camp",
    channelId: "1",
    x: 2200,
    y: 1600,
    lv: 1,
    xp: 0,
    job: "traveler",
    jobLv: 1,
    jobXp: 0,
    statPts: 0,
    skillPts: 0,
    coins: 250,
    gems: 0,
    base: { str: 1, agi: 1, vit: 1, int: 1, dex: 1, luk: 1 },
    bag: [],
    store: [],
    equip: {
      weapon: "sword",
      hair: "hair_spiky",
      top: "top_traveler",
      pants: "pants_traveler",
    },
    wu: {},
    mats: {},
    red: 3,
    blue: 3,
    skills: {},
    hotbar: ["q", "e", "r", null, null, null, null, null],
    flags: {},
    quests: {
      main: quest(0),
      daily: { day: 0, list: [], week: { days: 0, claimed: false } },
      rep: {},
      tokens: 0,
      flags: {},
    },
    statuses: [],
    cooldowns: {},
    nextCopy: 1,
    bagExtra: 0,
  };
  for (const id of ["sword", "top_traveler", "pants_traveler"])
    if (catalog.ITEMS[id]) {
      const c = { u: h.nextCopy++, id, ref: 0, g: 0, opts: [] };
      h.bag.push(c);
      h.wu[catalog.ITEMS[id].slot] = c.u;
    }
  normalize(h);
  h.hp = h.hpMax;
  h.sp = h.spMax;
  return h;
}
export function normalize(h) {
  h.base ||= { str: 1, agi: 1, vit: 1, int: 1, dex: 1, luk: 1 };
  h.mats ||= h.materials || {};
  h.bag ||= [];
  h.store ||= [];
  h.wu ||= {};
  h.equip ||= {};
  h.flags ||= {};
  h.cooldowns ||= {};
  h.skills ||= {};
  h.statuses ||= [];
  h.nextCopy ||=
    Math.max(
      0,
      ...h.bag.map((c) => Number(c.u) || 0),
      ...h.store.map((c) => Number(c.u) || 0),
    ) + 1;
  if (h.red == null) h.red = h.potions?.hp ?? 3;
  if (h.blue == null) h.blue = h.potions?.sp ?? 3;
  h.quests ||= { main: quest(0), daily: {}, flags: {}, rep: {}, tokens: 0 };
  const gear = Object.values(h.wu)
    .map((u) => h.bag.find((c) => c.u === u))
    .filter(Boolean);
  const bonus = { hp: 0, atk: 0, def: 0, skill: 0 };
  for (const c of gear) {
    const s = catalog.ITEMS[c.id]?.stats || {};
    for (const k of Object.keys(bonus)) bonus[k] += Number(s[k] || 0);
    bonus.atk += (c.ref || 0) * 0.02;
    for (const opt of c.opts || [])
      if (Object.hasOwn(bonus, opt.kind))
        bonus[opt.kind] +=
          Number(opt.value || 0) * (opt.kind === "atk" ? 0.01 : 1);
    bonus.hp += (c.g || 0) * 5;
  }
  h.hpMax = Math.round(100 + h.lv * 20 + h.base.vit * 6 + bonus.hp);
  h.spMax = Math.round(10 + h.lv * 3 + h.base.int * 3);
  h.atk = Math.round((12 + h.lv * 3 + h.base.str * 2) * (1 + bonus.atk));
  h.def = Math.round(h.lv + h.base.vit + bonus.def);
  h.hp = Math.max(0, Math.min(h.hp ?? h.hpMax, h.hpMax));
  h.sp = Math.max(0, Math.min(h.sp ?? h.spMax, h.spMax));
  h.potions = h.red;
  h.spPotions = h.blue;
  h.xpNext = catalog.experience.base[Math.min(99, h.lv)] || 1000;
  h.jobXpNext = catalog.experience.jobs[h.job]?.[Math.min(100, h.jobLv)] || 100;
  return h;
}
export class Game {
  constructor(db, { clock = Date.now, random = Math.random } = {}) {
    this.db = db;
    this.clock = clock;
    this.random = random;
    this.worlds = new Map();
    this.events = [];
    db.parties ||= {};
    db.guilds ||= {};
    db.market ||= {};
    db.friends ||= {};
    db.version = 2;
    for (const h of Object.values(db.characters)) normalize(h);
  }
  emit(world, event, to = null) {
    this.events.push({ world: world?.id, event, to });
  }
  drain() {
    return this.events.splice(0);
  }
  world(mapId = "camp", channel = "1", instance = "") {
    fail(Object.hasOwn(catalog.MAPS, mapId), "unknown_map");
    fail(/^[1-3]$/.test(String(channel)), "invalid_channel");
    const id = `world:${mapId}:${channel}${instance ? ":" + instance : ""}`;
    if (this.worlds.has(id)) return this.worlds.get(id);
    const map = catalog.MAPS[mapId];
    const w = {
      id,
      mapId,
      channelId: String(channel),
      players: new Set(),
      monsters: [],
      loot: [],
      instance,
      lastTick: this.clock(),
    };
    const spawns =
      mapId === "camp"
        ? [
            ["slime_green", 5],
            ["boar", 2],
          ]
        : map.spawns || [["slime", 6]];
    for (const [type, n] of spawns)
      for (let i = 0; i < Math.min(n, 12); i++) {
        const lv = mapId === "camp" ? 1 + (i % 3) : map.lv?.[type]?.[0] || 8;
        w.monsters.push(
          this.monster(
            type,
            lv,
            2350 + (i % 4) * 180,
            1500 + Math.floor(i / 4) * 180,
          ),
        );
      }
    for (const [type, x, y] of map.bosses || [])
      w.monsters.push({
        ...this.monster(
          catalog.MONSTERS[type] ? type : "golem",
          map.lv?.[type]?.[0] || 20,
          x,
          y,
        ),
        boss: true,
      });
    if (instance) {
      const owner = Object.values(this.db.characters).find(
        (h) => h.dungeon?.id === instance,
      );
      if (owner) {
        w.monsters = owner.dungeon.cleared
          ? []
          : [this.monster("golem", owner.lv + 2, 2450, 1600)];
        if (w.monsters[0] && owner.dungeon.bossHp > 0)
          w.monsters[0].hp = owner.dungeon.bossHp;
      }
    }
    this.worlds.set(id, w);
    return w;
  }
  monster(type, lv, x, y) {
    const def = catalog.MONSTERS[type] || {};
    const hp = Math.round((40 + lv * 18) * (def.hpK || 1));
    return {
      id: uuid("mob"),
      type,
      lv,
      x,
      y,
      homeX: x,
      homeY: y,
      hp,
      hpMax: hp,
      dead: 0,
      state: "idle",
      statuses: [],
      attackAt: 0,
      contributors: {},
    };
  }
  join(h, channel = h.channelId) {
    const w = this.world(h.mapId, channel, h.dungeon?.id || "");
    fail(w.players.size < 50 || w.players.has(h.id), "channel_full");
    for (const other of this.worlds.values()) other.players.delete(h.id);
    h.channelId = String(channel);
    w.players.add(h.id);
    return w;
  }
  snapshot(w, h, ackSeq = 0) {
    normalize(h);
    const self = copy(h),
      party = this.db.parties[h.partyId],
      guild = this.db.guilds[h.guildId];
    const member = (id) => {
      const p = this.db.characters[id];
      return {
        id,
        name: p.name,
        job: p.job,
        lv: p.lv,
        hp: p.hp,
        maxHp: p.hpMax,
        mapId: p.mapId,
        channelId: p.channelId,
        online: [...this.worlds.values()].some((w) => w.players.has(id)),
        dead: !p.hp,
      };
    };
    self.party = party
      ? {
          id: party.id,
          leader: party.leader,
          loot: "shared",
          members: party.members.map(member),
          requests: [],
        }
      : null;
    self.social = {
      guild: guild
        ? {
            id: guild.id,
            name: guild.name,
            leader: guild.leader,
            coffer: guild.coffer || 0,
            notice: guild.notice || "",
          }
        : null,
      roster: guild ? guild.members.map(member) : [],
      capacity: 30,
      level: 1,
    };
    self.friends = (this.db.friends[h.id] || [])
      .filter((id) => this.db.characters[id])
      .map(member);
    return {
      full: true,
      mapId: w.mapId,
      channelId: w.channelId,
      tick: Math.floor(this.clock() / 100),
      ackSeq,
      self,
      players: [...w.players]
        .filter((id) => id !== h.id)
        .map((id) => this.db.characters[id])
        .filter(Boolean)
        .map((p) => {
          const { id, name, x, y, hp, hpMax, lv, job, equip, appearance } = p;
          return { id, name, x, y, hp, hpMax, lv, job, equip, appearance };
        }),
      monsters: copy(w.monsters),
      loot: copy(w.loot),
      bag: copy(h.bag),
      store: copy(h.store),
    };
  }
  xp(h, n) {
    h.xp += n;
    h.jobXp += Math.ceil(n * 0.75);
    while (h.lv < 99 && h.xp >= h.xpNext) {
      h.xp -= h.xpNext;
      h.lv++;
      h.statPts += 3;
      normalize(h);
      h.hp = h.hpMax;
      h.sp = h.spMax;
    }
    const max = catalog.JOBS[h.job]?.maxJob || 50;
    while (h.jobLv < max && h.jobXp >= h.jobXpNext) {
      h.jobXp -= h.jobXpNext;
      h.jobLv++;
      h.skillPts++;
      normalize(h);
    }
  }
  progress(h, kind, n = 1) {
    const q = h.quests.main,
      o = q.objectives?.[0];
    if (q.state === "active" && o?.kind === kind) {
      o.have = Math.min(o.need, o.have + n);
      if (o.have >= o.need) q.state = "ready";
    }
  }
  charge(h, coins = 0, mats = {}) {
    fail(h.coins >= coins, "insufficient_coins");
    for (const [id, n] of Object.entries(mats))
      fail((h.mats[id] || 0) >= n, "insufficient_materials");
    h.coins -= coins;
    for (const [id, n] of Object.entries(mats)) h.mats[id] -= n;
  }
  addGear(h, id) {
    fail(catalog.ITEMS[id], "unknown_item");
    fail(h.bag.length < 40 + (h.bagExtra || 0), "bag_full");
    const c = { id, u: h.nextCopy++, ref: 0, g: 0, opts: [] };
    h.bag.push(c);
    return c;
  }
  transaction(h, fn) {
    const before = copy(this.db);
    const events = this.events.length;
    try {
      return fn();
    } catch (e) {
      for (const key of Object.keys(this.db)) delete this.db[key];
      Object.assign(this.db, before); // Preserve all active hero references after a rejected action.
      for (const [id, restored] of Object.entries(before.characters)) {
        const live = id === h.id ? h : null;
        if (live) {
          for (const key of Object.keys(live)) delete live[key];
          Object.assign(live, restored);
          this.db.characters[id] = live;
        }
      }
      this.events.length = events;
      throw e;
    }
  }
  command(h, w, op, a) {
    fail(a && typeof a === "object", "invalid_command");
    normalize(h);
    if (op === 7) return;
    if (op === 1) {
      fail(h.hp > 0, "dead");
      const dx = Number(a.dx),
        dy = Number(a.dy);
      fail(Number.isFinite(dx) && Number.isFinite(dy), "invalid_move");
      const t = this.clock(),
        dt = Math.min(0.25, Math.max(0, (t - (h.moveAt ?? t - 100)) / 1000));
      h.moveAt = t;
      const len = Math.hypot(dx, dy) || 1,
        step = 240 * dt;
      const map = catalog.MAPS[h.mapId];
      h.x = Math.max(
        40,
        Math.min(
          (map.W ||
            Math.max(4700, ...(map.exits || []).map((p) => p.x + 150))) - 40,
          h.x + (dx / Math.max(1, len)) * step,
        ),
      );
      h.y = Math.max(
        40,
        Math.min(
          (map.H ||
            Math.max(3300, ...(map.exits || []).map((p) => p.y + 150))) - 40,
          h.y + (dy / Math.max(1, len)) * step,
        ),
      );
      return;
    }
    if (op === 2 || op === 3) {
      const peer = this.db.characters[a.targetId];
      if (peer && w.players.has(peer.id)) return this.duelHit(h, peer, w);
      return this.attack(h, w, a, op === 3);
    }
    if (op === 4) {
      const i = w.loot.findIndex((d) => d.id === a.lootId);
      fail(i >= 0, "loot_missing");
      const d = w.loot[i];
      fail(
        !d.owner || d.owner === h.id || this.clock() > d.publicAt,
        "loot_reserved",
      );
      fail(distance(h, d) < 180, "out_of_range");
      if (d.gear) this.addGear(h, d.itemId);
      else h.mats[d.itemId] = (h.mats[d.itemId] || 0) + d.count;
      w.loot.splice(i, 1);
      return;
    }
    if (op === 5) {
      const map = catalog.MAPS[h.mapId];
      const p = [...(map.warps || []), ...(map.exits || [])].find(
        (p) => p.id === a.portalId,
      );
      fail(p, "unknown_portal");
      fail(distance(h, p) < 240, "out_of_range");
      return this.travel(h, w, p.to);
    }
    fail(op === 6, "unknown_opcode");
    return this.transaction(h, () => this.action(h, w, a));
  }
  attack(h, w, a, skill) {
    fail(h.hp > 0, "dead");
    const t = this.clock();
    fail(t >= (h.cooldowns.attack || 0), "cooldown");
    let mul = 1,
      range = 180,
      cost = 0,
      s;
    if (skill) {
      s = catalog.SKILLS[a.skillId];
      fail(s?.active, "unknown_skill");
      const allowed = this.jobSkills(h);
      fail(allowed.includes(a.skillId), "skill_locked");
      fail(s.free !== 0 || (h.skills[a.skillId] || 0) > 0, "skill_not_learned");
      const lv = Math.max(1, h.skills[a.skillId] || 0);
      cost = s.costs?.[lv] || 0;
      fail(h.sp >= cost, "insufficient_sp");
      fail(t >= (h.cooldowns[a.skillId] || 0), "cooldown");
      mul = s.multipliers?.[lv] || 1.5;
      range = s.type === "magic" ? 650 : 360;
    }
    if (skill && (s.type === "buff" || s.type === "heal")) {
      h.sp -= cost;
      h.cooldowns[a.skillId] = t + Math.max(1, s.cd || 5) * 1000;
      if (s.type === "heal")
        h.hp = Math.min(h.hpMax, h.hp + Math.round(20 + h.base.int * 3));
      else h.statuses.push({ id: a.skillId, until: t + 10000, shield: 30 });
      this.emit(w, { type: "skill", actorId: h.id, skillId: a.skillId });
      return;
    }
    const target =
      w.monsters.find((m) => m.id === a.targetId && m.hp > 0) ||
      (!a.targetId
        ? w.monsters
            .filter((m) => m.hp > 0 && distance(h, m) < range)
            .sort((a, b) => distance(h, a) - distance(h, b))[0]
        : null);
    fail(target, "target_missing");
    fail(distance(h, target) <= range, "out_of_range");
    h.cooldowns.attack = t + 500;
    if (skill) {
      h.sp -= cost;
      h.cooldowns[a.skillId] = t + (s.cd || 3) * 1000;
    }
    const crit = this.random() < 0.05 + h.base.luk * 0.002;
    const dmg = Math.max(
      1,
      Math.round(h.atk * mul * (crit ? 1.5 : 1) - target.lv * 0.7),
    );
    target.hp = Math.max(0, target.hp - dmg);
    target.contributors[h.id] = (target.contributors[h.id] || 0) + dmg;
    if (skill && /poison|burn|ice|frost/i.test(a.skillId))
      target.statuses.push({
        id: /ice|frost/i.test(a.skillId) ? "freeze" : "poison",
        until: t + 4000,
        source: h.id,
        next: t + 1000,
      });
    this.emit(w, {
      type: "hit",
      sourceId: h.id,
      targetId: target.id,
      damage: dmg,
      crit,
      skillId: skill ? a.skillId : null,
      hp: target.hp,
      dead: target.hp <= 0,
    });
    if (!target.hp) this.kill(h, w, target);
  }
  kill(h, w, m) {
    if (m.dead) return;
    m.dead = 1;
    m.respawnAt = this.clock() + 15000;
    const winner = Object.entries(m.contributors).sort(
      (a, b) => b[1] - a[1],
    )[0]?.[0];
    const owner = this.db.characters[winner] || h;
    const party = this.db.parties[owner.partyId];
    const recipients = party
      ? party.members
          .map((id) => this.db.characters[id])
          .filter(
            (p) =>
              p && p.hp > 0 && w.players.has(p.id) && distance(p, m) < 1000,
          )
      : [owner];
    const xp = Math.round(
      ((90 + m.lv * 14) / 16) * (catalog.MONSTERS[m.type]?.expK || 1),
    );
    for (const p of recipients) {
      const day = Math.floor(this.clock() / 86400000);
      if (p.flags.dailyDay !== day) {
        p.flags.dailyDay = day;
        p.flags.dailyStartKills = p.flags.kills || 0;
        p.flags.dailyClaimed = false;
      }
      p.flags.kills = (p.flags.kills || 0) + 1;
      const amount = Math.max(1, Math.ceil(xp / recipients.length));
      this.xp(p, amount);
      p.coins += m.lv * 3;
      this.progress(p, "kill");
      this.emit(
        w,
        {
          type: "reward",
          monsterId: m.id,
          monsterType: m.type,
          xp: amount,
          jobXp: Math.ceil(amount * 0.75),
          gold: m.lv * 3,
        },
        p.id,
      );
    }
    for (const [itemId, chance, min = 1, max = min] of catalog.MAT_DROPS[
      m.type
    ] || [["mat_leaf_jelly", 0.65]])
      if (this.random() < chance)
        w.loot.push({
          id: uuid("loot"),
          kind: "mat",
          itemId,
          count: min + Math.floor(this.random() * (max - min + 1)),
          x: m.x,
          y: m.y,
          owner: owner.id,
          publicAt: this.clock() + 10000,
          expires: this.clock() + 60000,
        });
    if (this.random() < 0.12) {
      const pool = Object.keys(catalog.ITEMS).filter(
        (id) =>
          catalog.ITEMS[id].slot === "weapon" &&
          gearLevel(catalog.ITEMS[id]) <= m.lv,
      );
      w.loot.push({
        id: uuid("loot"),
        kind: "gear",
        gear: true,
        itemId: pool[Math.floor(this.random() * pool.length)],
        count: 1,
        x: m.x + 20,
        y: m.y,
        owner: owner.id,
        publicAt: this.clock() + 10000,
        expires: this.clock() + 60000,
      });
    }
    if (h.dungeon && !w.monsters.some((m) => m.hp > 0)) {
      h.dungeon.cleared = true;
      this.emit(
        w,
        {
          type: "rootClear",
          floor: h.dungeon.floor,
          seconds: Math.round((this.clock() - h.dungeon.started) / 1000),
        },
        h.id,
      );
    }
  }
  jobSkills(h) {
    let j = h.job,
      out = [];
    while (j) {
      const def = catalog.JOBS[j];
      if (!def) break;
      out.push(...(def.skills || []));
      j = def.from;
    }
    return out;
  }
  travel(h, w, mapId) {
    fail(Object.hasOwn(catalog.MAPS, mapId), "unknown_map");
    const target = this.world(mapId, h.channelId, h.dungeon?.id || "");
    fail(target.players.size < 50 || target.players.has(h.id), "channel_full");
    if (h.duel) {
      const peer = this.db.characters[h.duel.peer];
      if (peer) delete peer.duel;
      delete h.duel;
    }
    delete h.gathering;
    delete h.panelGathering;
    h.mapId = mapId;
    h.x = 2200;
    h.y = 1600;
    const next = this.join(h);
    return { world: next };
  }
  action(h, w, a) {
    const t = this.clock(),
      kind = a.kind,
      n = () => count(a.count);
    if (a.action === "potion") {
      const k = kind === "sp" ? "blue" : "red";
      fail(h[k] > 0, "no_potion");
      fail(t >= (h.cooldowns.potion || 0), "cooldown");
      h[k]--;
      h.cooldowns.potion = t + 1000;
      const stat = k === "red" ? "hp" : "sp";
      h[stat] = Math.min(
        h[stat + "Max"],
        h[stat] + Math.ceil(h[stat + "Max"] * 0.5),
      );
    } else if (a.action === "buy") {
      const k = String(kind);
      fail(["red", "blue", "hp", "sp"].includes(k), "unknown_product");
      const qty = n();
      this.charge(h, qty * 15);
      const field = ["red", "hp"].includes(k) ? "red" : "blue";
      h[field] = (h[field] || 0) + qty;
    } else if (a.action === "sell") {
      const qty = n();
      fail(catalog.MATERIALS[a.itemId], "unknown_material");
      this.charge(h, 0, { [a.itemId]: qty });
      h.coins += qty * catalog.MATERIALS[a.itemId].price;
    } else if (a.action === "equip") {
      const slot = String(a.slot);
      if (!a.itemId) {
        delete h.equip[slot];
        delete h.wu[slot];
        return;
      }
      const c = h.bag.find(
        (c) => c.id === a.itemId && (!a.copyId || c.u === a.copyId),
      );
      const item = catalog.ITEMS[a.itemId];
      fail(c && item?.slot === slot, "item_not_owned");
      const job = catalog.JOBS[h.job];
      if (slot === "weapon" && job?.tier) {
        const types = [];
        let j = h.job;
        while (j) {
          types.push(...(catalog.JOB_WEAPONS[j] || []));
          j = catalog.JOBS[j]?.from;
        }
        fail(types.includes(item.wtype || "sword"), "wrong_weapon");
      }
      h.equip[slot] = c.id;
      h.wu[slot] = c.u;
      normalize(h);
    } else if (a.action === "sellgear") {
      fail(
        Array.isArray(a.copyIds) &&
          a.copyIds.length > 0 &&
          new Set(a.copyIds).size === a.copyIds.length,
        "invalid_copies",
      );
      for (const u of a.copyIds) {
        const i = h.bag.findIndex((c) => c.u === u);
        fail(i >= 0 && !Object.values(h.wu).includes(u), "equipped_or_missing");
        h.bag.splice(i, 1);
        h.coins += 25;
      }
    } else if (a.action === "store") {
      const from = kind === "put" ? h.bag : h.store,
        to = kind === "put" ? h.store : h.bag;
      fail(["put", "take"].includes(kind), "invalid_store");
      const i = from.findIndex((c) => c.u === a.copyId);
      fail(
        i >= 0 && !Object.values(h.wu).includes(a.copyId),
        "equipped_or_missing",
      );
      fail(
        to.length < (kind === "put" ? 200 : 40 + (h.bagExtra || 0)),
        "storage_full",
      );
      to.push(from.splice(i, 1)[0]);
    } else if (a.action === "bagexpand") {
      fail((h.bagExtra || 0) < 160, "bag_limit");
      this.charge(h, 500);
      h.bagExtra = (h.bagExtra || 0) + 10;
    } else if (a.action === "stat") {
      const key = a.stat || a.key,
        qty = n();
      fail(Object.hasOwn(h.base, key) && h.statPts >= qty, "invalid_stat");
      h.statPts -= qty;
      h.base[key] += qty;
      normalize(h);
    } else if (a.action === "skill") {
      const s = catalog.SKILLS[a.skillId];
      fail(
        !s?.req ||
          (Array.isArray(s.req) &&
            s.req.every(([id, lv]) => (h.skills[id] || 0) >= lv)),
        "skill_prerequisite",
      );
      fail(
        s &&
          this.jobSkills(h).includes(a.skillId) &&
          h.skillPts > 0 &&
          (h.skills[a.skillId] || 0) < (s.max || 10),
        "skill_locked",
      );
      h.skillPts--;
      h.skills[a.skillId] = (h.skills[a.skillId] || 0) + 1;
    } else if (a.action === "hotbar") {
      fail(
        Array.isArray(a.slots) &&
          a.slots.length <= 8 &&
          a.slots.every((id) => !id || this.jobSkills(h).includes(id)),
        "invalid_hotbar",
      );
      h.hotbar = a.slots;
    } else if (a.action === "job") {
      const next = catalog.JOBS[a.job],
        current = catalog.JOBS[h.job];
      fail(
        next &&
          next.tier === (current?.tier || 0) + 1 &&
          (!next.from || next.from === h.job) &&
          h.jobLv >= (current?.maxJob || 10),
        "job_locked",
      );
      h.job = a.job;
      h.jobLv = 1;
      h.jobXp = 0;
      h.hotbar = (next.skills || [])
        .filter((id) => catalog.SKILLS[id]?.active)
        .slice(0, 8);
      normalize(h);
      this.progress(h, "job");
    } else if (a.action === "reset") {
      this.charge(h, 200);
      if (kind === "stats") {
        h.statPts += Object.values(h.base).reduce((n, x) => n + x - 1, 0);
        h.base = { str: 1, agi: 1, vit: 1, int: 1, dex: 1, luk: 1 };
      } else {
        fail(kind === "skills", "invalid_reset");
        h.skillPts += Object.values(h.skills).reduce((n, x) => n + x, 0);
        h.skills = {};
      }
      normalize(h);
    } else if (a.action === "quest") {
      const q = h.quests.main;
      fail(!a.id || a.id === q.id, "wrong_quest");
      if (a.op === "choose") {
        fail(q.pendingChoice && !q.choice, "no_choice_pending");
        fail(["a", "b"].includes(a.choice), "invalid_choice");
        q.choice = a.choice;
        h.quests.flags[q.id] = a.choice;
        h.quests.rep.camp =
          (h.quests.rep.camp || 0) + (a.choice === "a" ? 5 : 2);
        q.pendingChoice = false;
        h.quests.main = quest(q.index + 1);
      } else if (a.op === "handin") {
        fail(q.state === "ready", "quest_incomplete");
        const def = QUESTS[q.index];
        fail(def, "quest_missing");
        q.state = "done";
        q.pendingChoice = true;
        h.coins += def.coins;
        this.xp(h, def.xp);
        this.emit(
          w,
          {
            type: "quest",
            op: "done",
            id: q.id,
            reward: { coins: def.coins },
            choice: { id: q.id, a: "Help the camp", b: "Follow your own path" },
            panels: [],
          },
          h.id,
        );
      } else if (a.op === "take") {
        fail(q.state === "active", "quest_unavailable");
      } else throw new Error("unsupported_quest_operation");
    } else if (a.action === "forge") {
      if (kind === "craft") {
        fail(catalog.ITEMS[a.itemId]?.slot === "weapon", "unknown_recipe");
        const level = gearLevel(catalog.ITEMS[a.itemId]);
        fail(h.lv >= level, "recipe_level_required");
        this.charge(h, 150 * level, {
          mat_leaf_jelly: 3,
          mat_boar_tusk: 2,
          ...(level >= 25 ? { mat_golem_core: 2 } : {}),
          ...(level >= 50 ? { mat_king_spore: 3 } : {}),
        });
        this.addGear(h, a.itemId);
      } else {
        const c = h.bag.find((c) => c.u === a.copyId);
        fail(c, "copy_missing");
        if (kind === "refine") {
          fail((c.ref || 0) < 10, "refine_max");
          this.charge(
            h,
            100 * ((c.ref || 0) + 1),
            a.useSafety ? { mat_king_spore: 1 } : {},
          );
          if ((c.ref || 0) < 3 || this.random() < 0.7) c.ref = (c.ref || 0) + 1;
          else if (!a.useSafety) c.ref = Math.max(0, c.ref - 1);
        } else if (kind === "polish") {
          fail((c.g || 0) < 3, "grade_max");
          this.charge(h, 500, { mat_golem_core: 1 });
          c.g = (c.g || 0) + 1;
        } else if (kind === "drill") {
          fail((c.opts || []).length < 3, "socket_max");
          this.charge(h, 200);
          (c.opts ||= []).push({ kind: "atk", value: 1 });
        } else if (kind === "stone") {
          fail(
            ["atk", "hp", "def", "crit"].includes(a.optionKind),
            "unknown_option",
          );
          fail(
            Number.isInteger(a.row) &&
              a.row >= 0 &&
              a.row < (c.opts || []).length,
            "invalid_socket",
          );
          this.charge(h, 100, { mat_golem_core: 1 });
          c.opts[a.row] = {
            kind: a.optionKind,
            value: 2 + Math.floor(this.random() * 4),
          };
        } else throw new Error("unknown_forge_operation");
      }
      normalize(h);
    } else if (a.action === "gather" || a.action === "fish") {
      const field = a.source === "panel" ? "panelGathering" : "gathering";
      if (kind === "stop") {
        delete h[field];
        return;
      }
      if (kind === "start") {
        fail(!h.gathering && !h.panelGathering, "busy");
        const itemId = a.action === "fish" ? "mat_water_jelly" : a.itemId;
        fail(
          a.action === "fish"
            ? ["meadow", "woods"].includes(h.mapId)
            : (RESOURCES[h.mapId] || []).includes(itemId),
          "resource_unavailable",
        );
        h[field] = {
          nodeId: itemId,
          phase: "work",
          started: t,
          readyAt: t + 3000,
        };
      } else if (kind === "strike" || kind === "press" || kind === "release") {
        fail(h[field], "not_gathering");
      } else if (kind === "claim") {
        const g = h[field];
        fail(g && t >= g.readyAt, "not_ready");
        h.mats[g.nodeId] = (h.mats[g.nodeId] || 0) + 1;
        delete h[field];
        this.progress(h, "gather");
      } else throw new Error("unknown_gather_operation");
    } else if (a.action === "brew") {
      const qty = n();
      fail(["red", "blue", "hp", "sp"].includes(a.itemId), "unknown_recipe");
      this.charge(h, qty * 5, { mat_leaf_jelly: qty });
      h[["red", "hp"].includes(a.itemId) ? "red" : "blue"] += qty;
    } else if (a.action === "rest") {
      fail(h.mapId === "camp" && h.hp > 0, "unsafe_rest");
      h.hp = h.hpMax;
      h.sp = h.spMax;
    } else if (a.action === "revive") {
      fail(h.hp === 0, "not_dead");
      h.hp = Math.ceil(h.hpMax * 0.5);
      h.sp = Math.ceil(h.spMax * 0.5);
      h.dead = 0;
      delete h.dungeon;
      return this.travel(h, w, "camp");
    } else if (a.action === "travel") {
      fail(h.mapId === "camp" || a.mapId === "camp", "travel_requires_camp");
      this.charge(h, 10);
      delete h.dungeon;
      return this.travel(h, w, a.mapId);
    } else if (a.action === "root") {
      if (kind === "start") {
        fail(!h.dungeon && h.lv >= 5, "dungeon_locked");
        h.dungeon = {
          id: uuid("run"),
          floor: 1,
          started: t,
          cleared: false,
          claimed: false,
        };
        const result = this.travel(h, w, "woods");
        const dw = result.world;
        dw.monsters = [this.monster("golem", h.lv + 2, 2450, 1600)];
        return result;
      }
      if (kind === "claim") {
        fail(h.dungeon?.cleared && !h.dungeon.claimed, "not_cleared");
        h.dungeon.claimed = true;
        h.coins += 500;
        this.xp(h, 250);
        this.progress(h, "dungeon");
        h.flags.dungeonClears = (h.flags.dungeonClears || 0) + 1;
        delete h.dungeon;
        return this.travel(h, w, "camp");
      }
      if (kind === "leave") {
        delete h.dungeon;
        return this.travel(h, w, "camp");
      }
      throw new Error("unsupported_dungeon_operation");
    } else if (a.action === "life") {
      h.farm ||= { plots: Array.from({ length: 6 }, () => null) };
      const i = Number(a.count ?? 0);
      fail(
        Number.isInteger(i) && i >= 0 && i < h.farm.plots.length,
        "invalid_plot",
      );
      if (kind === "plant") {
        fail(!h.farm.plots[i], "plot_occupied");
        this.charge(h, 10);
        h.farm.plots[i] = { seed: "herb", readyAt: t + 60000 };
      } else if (kind === "harvest") {
        fail(h.farm.plots[i] && h.farm.plots[i].readyAt <= t, "not_ready");
        h.mats.mat_leaf_jelly = (h.mats.mat_leaf_jelly || 0) + 3;
        h.farm.plots[i] = null;
        this.progress(h, "gather");
      } else if (kind === "expand") {
        fail(h.farm.plots.length < 12, "farm_max");
        this.charge(h, 250);
        h.farm.plots.push(null);
      } else throw new Error("unsupported_farm_operation");
    } else if (a.action === "cook") {
      const qty = n();
      fail(a.itemId === "camp_soup", "unknown_recipe");
      this.charge(h, qty * 5, { mat_leaf_jelly: qty, mat_boar_tusk: qty });
      h.food ||= {};
      h.food.camp_soup = (h.food.camp_soup || 0) + qty;
    } else if (a.action === "eat") {
      fail(
        a.itemId === "camp_soup" && (h.food?.camp_soup || 0) > 0,
        "food_missing",
      );
      h.food.camp_soup--;
      h.hp = Math.min(h.hpMax, h.hp + 50);
      h.sp = Math.min(h.spMax, h.sp + 10);
    } else if (a.action === "daily") {
      const day = Math.floor(t / 86400000);
      if (h.flags.dailyDay !== day) {
        h.flags.dailyDay = day;
        h.flags.dailyStartKills = h.flags.kills || 0;
        h.flags.dailyClaimed = false;
      }
      fail(
        !h.flags.dailyClaimed &&
          (h.flags.kills || 0) - (h.flags.dailyStartKills || 0) >= 5,
        "daily_incomplete",
      );
      h.flags.dailyClaimed = true;
      h.coins += 100;
      this.xp(h, 100);
    } else if (a.action === "pvp") {
      const peer = this.db.characters[a.targetId];
      fail(
        peer &&
          w.players.has(peer.id) &&
          peer.id !== h.id &&
          h.hp > 0 &&
          peer.hp > 0,
        "target_unavailable",
      );
      if (kind === "invite") {
        fail(!h.duel && !peer.duel, "busy");
        peer.duelInvite = { from: h.id, until: t + 30000 };
        this.emit(w, { type: "pvpInvite", from: h.id, name: h.name }, peer.id);
      } else if (kind === "accept") {
        fail(
          h.duelInvite?.from === peer.id &&
            h.duelInvite.until > t &&
            !h.duel &&
            !peer.duel,
          "invite_expired",
        );
        h.duel = { peer: peer.id, until: t + 120000 };
        peer.duel = { peer: h.id, until: t + 120000 };
        delete h.duelInvite;
      } else throw new Error("unsupported_pvp_operation");
    } else if (
      a.action === "party" ||
      a.action === "guild" ||
      a.action === "friend"
    )
      this.social(h, w, a);
    else if (a.action === "broker") this.market(h, a);
    else if (a.action === "send") {
      fail(
        typeof a.text === "string" && a.text.trim() && a.text.length <= 200,
        "invalid_chat",
      );
      fail(t >= (h.cooldowns.chat || 0), "rate_limit");
      h.cooldowns.chat = t + 800;
      this.emit(w, {
        type: "chat",
        id: uuid("chat"),
        from: h.id,
        name: h.name,
        ch: a.ch || "map",
        text: a.text.trim(),
      });
    } else if (a.action === "auto") {
      h.auto = kind === "start";
    } else if (a.action === "seen") {
      return;
    } else throw new Error("unsupported_action:" + a.action);
    return { ok: true };
  }
  duelHit(h, peer, w) {
    const t = this.clock();
    fail(
      h.duel?.peer === peer.id &&
        peer.duel?.peer === h.id &&
        h.duel.until > t &&
        h.hp > 0 &&
        peer.hp > 0,
      "duel_required",
    );
    fail(distance(h, peer) <= 180, "out_of_range");
    fail(t >= (h.cooldowns.attack || 0), "cooldown");
    h.cooldowns.attack = t + 500;
    const damage = Math.max(1, h.atk - peer.def);
    peer.hp = Math.max(1, peer.hp - damage);
    this.emit(w, {
      type: "hit",
      pvp: true,
      sourceId: h.id,
      targetId: peer.id,
      damage,
      hp: peer.hp,
    });
    if (peer.hp === 1) {
      delete h.duel;
      delete peer.duel;
      h.flags.duelWins = (h.flags.duelWins || 0) + 1;
      this.emit(w, { type: "pvpEnd", winner: h.id, loser: peer.id });
    }
  }
  social(h, w, a) {
    const db = this.db,
      t = this.clock();
    const target = db.characters[a.targetId];
    if (a.action === "friend") {
      fail(target && target.id !== h.id, "target_missing");
      db.friends[h.id] ||= [];
      if (a.kind === "add") {
        db.friendRequests ||= {};
        db.friendRequests[target.id] ||= {};
        db.friendRequests[target.id][h.id] = t + 30000;
      } else if (a.kind === "accept") {
        fail(db.friendRequests?.[h.id]?.[target.id] > t, "invite_expired");
        delete db.friendRequests[h.id][target.id];
        db.friends[target.id] ||= [];
        if (!db.friends[h.id].includes(target.id))
          db.friends[h.id].push(target.id);
        if (!db.friends[target.id].includes(h.id))
          db.friends[target.id].push(h.id);
      } else if (a.kind === "remove") {
        db.friends[h.id] = db.friends[h.id].filter((id) => id !== target.id);
        db.friends[target.id] = (db.friends[target.id] || []).filter(
          (id) => id !== h.id,
        );
      } else throw new Error("unsupported_friend_operation");
      return;
    }
    const field = a.action + "Id",
      table = a.action === "party" ? db.parties : db.guilds;
    let group = table[h[field]];
    if (a.kind === "create" || a.kind === "found") {
      fail(!group, "already_member");
      if (a.action === "guild") this.charge(h, 1000);
      const id = uuid(a.action);
      group = {
        id,
        name: String(a.name || h.name).slice(0, 24),
        leader: h.id,
        members: [h.id],
        invites: {},
      };
      table[id] = group;
      h[field] = id;
    } else if (a.kind === "invite") {
      fail(group?.leader === h.id, "leader_only");
      fail(
        target && !target[field] && target.id !== h.id,
        "target_unavailable",
      );
      group.invites[target.id] = t + 30000;
      this.emit(
        w,
        {
          type: a.action === "party" ? "partyInvite" : "social",
          action: a.action,
          from: h.id,
          name: h.name,
          partyId: group.id,
          guildId: group.id,
        },
        target.id,
      );
    } else if (a.kind === "accept") {
      group = Object.values(table).find(
        (g) => g.invites[h.id] > t && (!a.targetId || g.leader === a.targetId),
      );
      fail(
        group &&
          !h[field] &&
          group.members.length < (a.action === "party" ? 5 : 30),
        "invite_expired",
      );
      group.members.push(h.id);
      delete group.invites[h.id];
      h[field] = group.id;
    } else if (a.kind === "leave" || a.kind === "kick") {
      fail(group, "not_member");
      const id = a.kind === "kick" ? a.targetId : h.id;
      fail(
        a.kind !== "kick" || (group.leader === h.id && id !== h.id),
        "leader_only",
      );
      fail(group.members.includes(id), "not_member");
      group.members = group.members.filter((x) => x !== id);
      delete db.characters[id][field];
      if (!group.members.length) delete table[group.id];
      else if (group.leader === id) group.leader = group.members[0];
    } else if (a.action === "guild" && a.kind === "coffer") {
      fail(group, "not_member");
      const amount = count(a.count, 1000000);
      this.charge(h, amount);
      group.coffer = (group.coffer || 0) + amount;
    } else if (a.action === "guild" && a.kind === "notice") {
      fail(
        group?.leader === h.id &&
          typeof a.text === "string" &&
          a.text.length <= 200,
        "leader_only",
      );
      group.notice = a.text;
    } else throw new Error("unsupported_social_operation");
    this.emit(w, { type: a.action, action: a.action, kind: a.kind });
  }
  market(h, a) {
    const db = this.db;
    if (a.kind === "list") {
      const i = h.bag.findIndex((c) => c.u === a.copyId);
      fail(
        i >= 0 && !Object.values(h.wu).includes(a.copyId),
        "equipped_or_missing",
      );
      const price = count(a.price, 1000000);
      const c = h.bag.splice(i, 1)[0];
      const id = uuid("listing");
      db.market[id] = { id, seller: h.id, copy: c, price };
    } else if (a.kind === "unlist") {
      const row = db.market[a.id];
      fail(row?.seller === h.id, "not_owner");
      fail(h.bag.length < 40 + (h.bagExtra || 0), "bag_full");
      h.bag.push(row.copy);
      delete db.market[a.id];
    } else if (a.kind === "buy") {
      const row = db.market[a.id];
      fail(row && row.seller !== h.id, "listing_missing");
      fail(h.bag.length < 40 + (h.bagExtra || 0), "bag_full");
      this.charge(h, row.price);
      this.db.characters[row.seller].coins += Math.floor(row.price * 0.95);
      h.bag.push({ ...row.copy, u: h.nextCopy++ });
      delete db.market[a.id];
    } else throw new Error("unsupported_market_operation");
  }
  checkin(h, claim = false) {
    const day = Math.floor(this.clock() / 86400000);
    const claimed = h.flags.checkinDay === day;
    if (claim) {
      fail(!claimed, "already_claimed");
      h.flags.checkinDay = day;
      h.coins += 25;
      h.flags.checkinCount = (h.flags.checkinCount || 0) + 1;
    }
    return {
      ok: true,
      day,
      claimed: claimed || claim,
      reward: claim ? { coins: 25 } : undefined,
      first7: [],
      month: [],
    };
  }
  tick() {
    const t = this.clock();
    for (const w of this.worlds.values()) {
      const dt = Math.min(0.25, Math.max(0, (t - w.lastTick) / 1000));
      w.lastTick = t;
      w.loot = w.loot.filter((d) => d.expires > t);
      if (!w.players.size) {
        if (t - (w.idleAt || t) > 300000) this.worlds.delete(w.id);
        else w.idleAt ||= t;
        continue;
      }
      delete w.idleAt;
      for (const id of w.players) {
        const h = this.db.characters[id];
        if (!h) continue;
        if (h.gathering && t >= h.gathering.readyAt)
          h.gathering.phase = "claim";
        if (h.panelGathering && t >= h.panelGathering.readyAt)
          h.panelGathering.phase = "claim";
        if (h.hp > 0 && t >= (h.regenAt || 0)) {
          h.sp = Math.min(h.spMax, h.sp + 1);
          h.regenAt = t + 3000;
        }
        h.statuses = h.statuses.filter((s) => s.until > t);
        if (h.duel && h.duel.until <= t) delete h.duel;
        if (h.dungeon && w.instance) h.dungeon.bossHp = w.monsters[0]?.hp || 0;
        if (h.auto && h.hp > 0) {
          const target = w.monsters
            .filter((m) => m.hp > 0)
            .sort((a, b) => distance(h, a) - distance(h, b))[0];
          if (target) {
            const d = distance(h, target);
            if (d > 150) {
              h.x += ((target.x - h.x) / d) * 160 * dt;
              h.y += ((target.y - h.y) / d) * 160 * dt;
            } else if (t >= (h.cooldowns.attack || 0))
              this.attack(h, w, { targetId: target.id }, false);
          }
        }
      }
      for (const m of w.monsters) {
        if (m.dead) {
          if (!w.instance && t >= m.respawnAt)
            Object.assign(m, {
              hp: m.hpMax,
              dead: 0,
              x: m.homeX,
              y: m.homeY,
              contributors: {},
              statuses: [],
            });
          continue;
        }
        for (const s of m.statuses)
          if (s.id === "poison" && t >= s.next && s.until > t) {
            s.next = t + 1000;
            m.hp = Math.max(0, m.hp - 3);
            if (!m.hp) {
              const h = this.db.characters[s.source];
              if (h) this.kill(h, w, m);
            }
          }
        m.statuses = m.statuses.filter((s) => s.until > t);
        if (m.dead || m.statuses.some((s) => s.id === "freeze")) continue;
        if (w.mapId === "camp" && !Object.keys(m.contributors).length) continue;
        const players = [...w.players]
          .map((id) => this.db.characters[id])
          .filter((h) => h && h.hp > 0 && distance(h, m) < 500);
        const h = players.sort((a, b) => distance(a, m) - distance(b, m))[0];
        if (!h) {
          m.state = "idle";
          continue;
        }
        m.tgt = h.id;
        if (distance(h, m) > 100) {
          m.state = "chase";
          const d = distance(h, m);
          m.x += ((h.x - m.x) / d) * 100 * dt;
          m.y += ((h.y - m.y) / d) * 100 * dt;
        } else if (t >= m.attackAt) {
          m.state = "attack";
          m.attackAt = t + 1500;
          let damage = Math.max(1, Math.round(m.lv * 3 + 5 - h.def * 0.5));
          for (const shield of h.statuses.filter((s) => s.shield > 0)) {
            const absorbed = Math.min(shield.shield, damage);
            shield.shield -= absorbed;
            damage -= absorbed;
          }
          h.hp = Math.max(0, h.hp - damage);
          if (!h.hp) {
            h.dead = 1;
            h.auto = false;
          }
          this.emit(w, {
            type: "hit",
            sourceId: m.id,
            targetId: h.id,
            damage,
            hp: h.hp,
            dead: !h.hp,
          });
        }
      }
    }
  }
}
