import test from "node:test";
import assert from "node:assert/strict";
import { Game, createHero, catalog } from "../src/game.mjs";
function fixture() {
  let time = 100000;
  const h = createHero("First hero"),
    b = createHero("Second hero");
  const db = { characters: { [h.id]: h, [b.id]: b } };
  const g = new Game(db, { clock: () => time, random: () => 0.5 });
  const w = g.join(h);
  g.join(b);
  return { g, h, b, w, db, advance: (n) => (time += n) };
}
test("players share map and channel but not other channels", () => {
  const { g, h, b, w } = fixture();
  assert.equal(g.join(b), w);
  assert.equal(g.snapshot(w, h).players[0].id, b.id);
  g.join(b, "2");
  assert.equal(g.snapshot(w, h).players.length, 0);
});
test("movement rejects non-finite input and clamps diagonal speed", () => {
  const { g, h, w, advance } = fixture();
  assert.throws(() => g.command(h, w, 1, { dx: Infinity, dy: 0 }));
  const x = h.x,
    y = h.y;
  g.command(h, w, 1, { dx: 9999, dy: 9999 });
  assert.ok(Math.hypot(h.x - x, h.y - y) <= 24.01);
  advance(100);
});
test("combat rejects distant and cooldown attacks; dead mobs pay once", () => {
  const { g, h, w, advance } = fixture();
  const m = w.monsters[0];
  assert.throws(() => g.command(h, w, 2, { targetId: m.id }), /range/);
  h.x = m.x;
  h.y = m.y;
  g.command(h, w, 2, { targetId: m.id });
  assert.throws(() => g.command(h, w, 2, { targetId: m.id }), /cooldown/);
  while (m.hp > 0) {
    advance(600);
    g.command(h, w, 2, { targetId: m.id });
  }
  const gold = h.coins;
  advance(600);
  assert.throws(() => g.command(h, w, 2, { targetId: m.id }), /target_missing/);
  assert.equal(h.coins, gold);
});
test("failed inventory and forge transactions roll back all costs", () => {
  const { g, h, w } = fixture();
  h.mats = { mat_leaf_jelly: 3, mat_boar_tusk: 2 };
  while (h.bag.length < 40) g.addGear(h, "sword");
  const before = structuredClone(h);
  assert.throws(
    () =>
      g.command(h, w, 6, { action: "forge", kind: "craft", itemId: "sword" }),
    /bag_full/,
  );
  assert.equal(h.coins, before.coins);
  assert.deepEqual(h.mats, before.mats);
  assert.equal(h.bag.length, 40);
  assert.throws(
    () =>
      g.command(h, w, 6, { action: "equip", slot: "weapon", itemId: "axe" }),
    /not_owned/,
  );
});
test("quest rewards cannot be replayed and choice unlocks next objective", () => {
  const { g, h, w } = fixture();
  g.progress(h, "kill", 3);
  g.command(h, w, 6, { action: "quest", op: "handin", id: "first-night" });
  const coins = h.coins;
  assert.throws(
    () =>
      g.command(h, w, 6, { action: "quest", op: "handin", id: "first-night" }),
    /incomplete/,
  );
  assert.equal(h.coins, coins);
  g.command(h, w, 6, {
    action: "quest",
    op: "choose",
    id: "first-night",
    choice: "a",
  });
  assert.equal(h.quests.main.id, "forest-supplies");
  assert.equal(h.quests.flags["first-night"], "a");
});
test("gathering and check-in enforce server time and claim once", () => {
  const { g, h, w, advance } = fixture();
  g.command(h, w, 6, {
    action: "gather",
    kind: "start",
    itemId: "mat_leaf_jelly",
  });
  assert.throws(
    () => g.command(h, w, 6, { action: "gather", kind: "claim" }),
    /not_ready/,
  );
  advance(3100);
  g.command(h, w, 6, { action: "gather", kind: "claim" });
  assert.equal(h.mats.mat_leaf_jelly, 1);
  g.checkin(h, true);
  assert.throws(() => g.checkin(h, true), /already_claimed/);
});
test("party invitations expire and membership is server controlled", () => {
  const { g, h, b, w, advance } = fixture();
  g.command(h, w, 6, { action: "party", kind: "create" });
  g.command(h, w, 6, { action: "party", kind: "invite", targetId: b.id });
  advance(31000);
  assert.throws(
    () =>
      g.command(b, w, 6, { action: "party", kind: "accept", targetId: h.id }),
    /expired/,
  );
  g.command(h, w, 6, { action: "party", kind: "invite", targetId: b.id });
  g.command(b, w, 6, { action: "party", kind: "accept", targetId: h.id });
  assert.equal(h.partyId, b.partyId);
  assert.throws(
    () => g.command(b, w, 6, { action: "party", kind: "kick", targetId: h.id }),
    /leader_only/,
  );
});
test("market transfers one owned copy and cannot be purchased twice", () => {
  const { g, h, b, w, db } = fixture();
  const c = g.addGear(h, "axe");
  g.command(h, w, 6, {
    action: "broker",
    kind: "list",
    copyId: c.u,
    price: 100,
  });
  const id = Object.keys(db.market)[0];
  g.command(b, w, 6, { action: "broker", kind: "buy", id });
  assert.equal(b.coins, 150);
  assert.ok(b.bag.some((c) => c.id === "axe"));
  assert.throws(
    () => g.command(b, w, 6, { action: "broker", kind: "buy", id }),
    /missing/,
  );
});
test("dungeon entry, boss clear and reward form a bounded run", () => {
  const { g, h, w, advance } = fixture();
  h.lv = 5;
  h.atk = 1000;
  let result = g.command(h, w, 6, { action: "root", kind: "start" });
  assert.notEqual(result.world, w);
  let dw = result.world;
  h.x = 2450;
  h.y = 1600;
  const m = dw.monsters[0];
  while (m.hp) {
    advance(600);
    g.command(h, dw, 2, { targetId: m.id });
    h.hp = h.hpMax;
  }
  result = g.command(h, dw, 6, { action: "root", kind: "claim" });
  assert.equal(result.world.mapId, "camp");
  assert.equal(h.flags.dungeonClears, 1);
  assert.throws(
    () => g.command(h, result.world, 6, { action: "root", kind: "claim" }),
    /not_cleared/,
  );
});
test("catalog provides existing renderable IDs and experience curves", () => {
  assert.ok(Object.keys(catalog.ITEMS).length > 100);
  assert.ok(catalog.JOBS.knight);
  assert.ok(catalog.experience.base[10] > catalog.experience.base[1]);
});
test("panel gathering survives an unrelated legacy stop command", () => {
  const { g, h, w, advance } = fixture();
  g.command(h, w, 6, {
    action: "gather",
    kind: "start",
    itemId: "mat_leaf_jelly",
    source: "panel",
  });
  g.command(h, w, 6, { action: "gather", kind: "stop" });
  assert.ok(h.panelGathering);
  advance(3100);
  g.command(h, w, 6, { action: "gather", kind: "claim", source: "panel" });
  assert.equal(h.mats.mat_leaf_jelly, 1);
});
test("farming consumes coins, waits for growth and cannot harvest twice", () => {
  const { g, h, w, advance } = fixture();
  g.command(h, w, 6, { action: "life", kind: "plant", count: 0 });
  assert.equal(h.coins, 240);
  assert.throws(
    () => g.command(h, w, 6, { action: "life", kind: "harvest", count: 0 }),
    /not_ready/,
  );
  advance(60001);
  g.command(h, w, 6, { action: "life", kind: "harvest", count: 0 });
  assert.equal(h.mats.mat_leaf_jelly, 3);
  assert.throws(
    () => g.command(h, w, 6, { action: "life", kind: "harvest", count: 0 }),
    /not_ready/,
  );
});
test("rare resources and high-tier crafting cannot bypass progression", () => {
  const { g, h, w } = fixture();
  assert.throws(
    () =>
      g.command(h, w, 6, {
        action: "gather",
        kind: "start",
        itemId: "mat_king_crown",
      }),
    /unavailable/,
  );
  const high = Object.keys(catalog.ITEMS).find(
    (id) =>
      catalog.ITEMS[id].slot === "weapon" &&
      catalog.ITEMS[id].rarity === "legend",
  );
  assert.ok(high);
  assert.throws(
    () => g.command(h, w, 6, { action: "forge", kind: "craft", itemId: high }),
    /level_required/,
  );
});
test("duels require consent, expire, and never kill the loser", () => {
  const { g, h, b, w, advance } = fixture();
  assert.throws(() => g.command(h, w, 2, { targetId: b.id }), /duel_required/);
  g.command(h, w, 6, { action: "pvp", kind: "invite", targetId: b.id });
  g.command(b, w, 6, { action: "pvp", kind: "accept", targetId: h.id });
  b.hp = 2;
  g.command(h, w, 2, { targetId: b.id });
  assert.equal(b.hp, 1);
  assert.equal(h.flags.duelWins, 1);
  assert.equal(h.duel, undefined);
  advance(600);
  assert.throws(() => g.command(h, w, 2, { targetId: b.id }), /duel_required/);
});
test("guild membership appears in snapshots and only leader edits notices", () => {
  const { g, h, b, w } = fixture();
  h.coins = 2000;
  g.command(h, w, 6, { action: "guild", kind: "found", name: "Camp guild" });
  g.command(h, w, 6, { action: "guild", kind: "invite", targetId: b.id });
  g.command(b, w, 6, { action: "guild", kind: "accept", targetId: h.id });
  assert.equal(g.snapshot(w, b).self.social.roster.length, 2);
  assert.throws(
    () =>
      g.command(b, w, 6, { action: "guild", kind: "notice", text: "hacked" }),
    /leader_only/,
  );
  g.command(h, w, 6, { action: "guild", kind: "coffer", count: 100 });
  assert.equal(g.snapshot(w, h).self.social.guild.coffer, 100);
});
test("AI advances without client commands and a shield absorbs damage", () => {
  const { g, h, w, advance } = fixture();
  const m = w.monsters[0];
  m.contributors[h.id] = 1;
  m.x = h.x;
  m.y = h.y;
  h.statuses = [{ id: "shield", until: 200000, shield: 30 }];
  const hp = h.hp;
  advance(100);
  g.tick();
  assert.equal(h.hp, hp);
  assert.ok(h.statuses[0].shield < 30);
});
