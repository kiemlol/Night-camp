# Night Camp game systems catalog

Public build: `game-20261022-1641`  
Source: `https://play.nightcamp.app`  
Analysis date: 2026-10-24 UTC

## Evidence and coverage

- Whole-tree REA Evidence:
  `ev_6eb7244a403d791566c24e6cef34de8238f6d687caaebc49d7c51ef9e261a6d9`.
- Focused online REA Evidence:
  `ev_615bf7d12d00163739cfc03b1979d63a69e0ecdb404a1735d01e69ec9487c048`.
- Runtime survey of the original public URL observed 1,698 requests: 1,690
  requests to the public game host and eight Google Font requests. During the
  unauthenticated observation window there were no page errors, failed
  requests or requests to the account API.
- Runtime inspection of the loaded client found 46 jobs, 499 skills, 2,075
  item definitions, 556 materials, 497 monsters, 162 maps and 97 quests.

Static analysis does not establish hidden backend behavior. Runtime inspection
here covers the public unauthenticated boot and the client-side/offline engine.

## Asset reconstruction

The recovered static tree currently contains 10,528 files / approximately
540 MB:

- 8,097 PNG files
- 1,829 WebP files
- 39 JPEG files
- 480 JavaScript files
- 75 CSS files
- four JSON files plus HTML/PWA metadata

The first source-only crawl missed assets generated dynamically by
`assets/webp.js`. Direct observation of the original page exposed 926 additional
runtime paths; all 926 were downloaded successfully. A second manifest/source
audit recovered 48 more public files. Eighty-three referenced
`assets/gen/*_raw.*` design-source files return HTTP 403; they are not requested
by the observed game boot and remain outside the public snapshot.

## Character progression

- Base level cap: 99. Normal job cap: 50; the traveler begins with a job cap of
  10 before changing class.
- Six base stats: STR, AGI, VIT, INT, DEX and LUK; each starts at 5 and caps at
  99.
- Status points start at 48. Each level grants
  `floor((level - 1) / 5) + 3`; raising a stat from `x` costs
  `floor((x - 1) / 10) + 2`.
- Base EXP follows level anchors and a monster reward budget. Job EXP has
  separate exponential curves per job tier.
- Derived combat values include HP/SP, ATK/MATK, DEF/MDEF, HIT/FLEE, ASPD,
  critical chance, regeneration, elemental attack and resistance.

## Jobs and skills

- 46 job definitions span traveler, first jobs and later branches/lines.
- 499 skill definitions include active, passive, ultimate, support, summon,
  movement, area, projectile and transformation skills.
- Skills carry maximum level, hotkey, damage type, element, SP cost, cooldown,
  multiplier, prerequisites and class/job ownership.
- Job lines define elemental or play-style branches such as sword/berserk/
  guard/flame, fire/ice/storm/quick, rapid/aim/rain/wild and blade/venom/shadow.
- The engine supports cooldown modification, cast time, multiple hit ticks,
  weapon restrictions, server-hit declarations, skill runes and set ultimates.

## Elements, damage and statuses

- Ten elements: neutral, water, earth, fire, wind, poison, holy, shadow,
  ghost and undead.
- Physical and magical damage use different offensive and defensive values.
- Accuracy/evasion, critical hits, attack speed, hit caps and level-gap scaling
  are explicit systems.
- Status infrastructure includes poison, burn, freeze/stun, slows, shields,
  damage-over-time, healing, party buffs and elemental reactions.
- PvP applies separate tuning: damage ×0.4, criticals ×0.75, one-hit cap at 35%
  max HP, crowd-control duration ×0.5 with diminishing returns and temporary
  immunity.

## Items and equipment

- 2,075 item definitions cover hair/fashion, armor, hats, accessories,
  shields, many weapon families, consumables and boss/set equipment.
- Instanced gear copies use the record
  `{u, id, rows, ref, sh, ...}`: unique copy ID, item definition, option rows,
  refine level and moonlit marker.
- Worn copies are selected independently by equipment slot through `p.wu`.
- Weapon/gear grades control base option-row count. Boss and legendary pieces
  start with three rows; the system supports at most four rows and at most two
  rows of the same option family.
- Option quality rolls are Common 60%, Good 30%, Godly 10%. Core options include
  ATK, critical, ASPD, life steal, SP on kill, base stats, race damage and
  elemental damage. Additional modules add armor/special/set options.
- Moonlit copies have a 1/200 drop chance and separate visual/collection state.
- Equipment checks job, weapon family, level requirement, set passives,
  fashion overrides and per-copy grade/refine/option bonuses.

## Refinement and crafting

- Refinement ranges from +0 to +10.
- Safe levels by grade are +7/+6/+5/+4. Above the safe level, success rates use
  a grade/target-level table.
- Coin cost is `gradeBase × targetLevel^1.6`; ore type depends on grade and ore
  count is `1 + floor(targetLevel / 3)`.
- Weapon refine grants ATK +4% per level. Non-weapons grant HP +0.5% per level
  and DEF or MDEF +1 every two levels.
- At +9/+10, a failed attempt can break the item with 25%/40% of failed rolls;
  a safety stone prevents that loss. Failure heat multiplies the next chance by
  1.5 for that step until success.
- Forge systems include weapon crafting, polish/grade work, drilling option
  slots, option stones, cleansing/taint, runes, ammunition/oils, cooking and
  brewing.
- Client data exposes eight cooking dishes, six brewing recipes and nine shop
  potion entries, plus generated forge recipes by equipment family.

## Monsters, loot and collection

- 497 monster definitions carry element, attack element, radius, HP/ATK/DEF/
  MDEF/AGI/DEX/EXP multipliers, movement speed and aggro range.
- Bosses use separate AI/state scripts, warnings, phases, summons, enrage and
  bespoke drops/set pieces.
- Loot supports materials, consumables, instanced gear, option stones, refine
  resources, boss sets, collection-book discovery and moonlit variants.
- The monster/item book tracks discovered species/items, kills and submitted
  spare equipment copies.

## Maps, encounters and dungeons

- 162 map definitions include safe hubs, fields, caves, farms, PvP areas,
  dungeon spaces and late-game regions.
- Map data carries dimensions, procedural seed, biome, level tables, spawn
  populations, warps, roads, ponds, landmarks, fences, safe zones and subzones.
- The navigation layer supports route planning, click movement, map transfer,
  minimap/world-map pins and map-specific drop tables.
- Dungeon data separates themes, floors, bosses and chests. The Dark Root adds
  ten zones, seven wind patterns, floor goals, revives, seed validation,
  checkpoints, timed scoring, party flow and seasonal rankings.
- World bosses and guild bosses use scheduled/weekly state and their own
  encounter scripts.

## Quests, story and guided progression

- 97 quest definitions are loaded into the client.
- Quest state supports offer, active, ready, done and waiting, multiple
  objectives, quest keys, reputation, tokens, flags and dialogue panels.
- Actions cover take, hand-in, daily claim, weekly claim and two-way choices.
  Online mode keeps choices and consequences in server state.
- The journey/lesson layer drives the opening tutorial, NPC prompts, tracker,
  auto-navigation, farming/travel steps and reward chests.
- Exact consequences that exist only in the private backend remain unknown;
  visible client choices, panels and state fields have been recovered.

## Life skills and economy

- Life systems cover woodcutting, mining, fishing and farming, each with level,
  XP curve, rank, tools, upgrades, mentors, work ticks and material rolls.
- Farming includes gardens, crop care and crow interactions. Fishing includes
  locations, poses, fish tables and a dedicated panel/minigame.
- Economy modules cover NPC shops, storage, bag expansion, selling, broker
  listings, player vending, gacha, check-in, AUTO/offline rewards and travel
  costs.
- The original online market/payment authority is server-side and is not
  reproduced by static client data alone.

## Party, guild and PvP

- Offline party supports up to three AI allies selected from five roles:
  knight/tank, mage, archer, rogue and priest/healer. Allies follow across maps,
  fight, provoke, heal/revive and can be targeted by monster AI.
- Online party contracts include leader, invites, requests, loot rules,
  membership, support effects and red-thread pull mechanics.
- Guild rules include founding cost, levels 1–10, weekly upkeep, member cap
  `16 + 4 × guildLevel`, weekly material quest and guild boss.
- PvP supports friendly field duels and best-of-three arena rounds. Arena rounds
  last 100 seconds, shrink after 60 seconds and burn players outside the ring.

## Online authority boundary

The client defines authentication, release gate, lobby, character slots,
WebSocket envelopes, commands and rendering bridges. The original server owns
combat truth, inventory transactions, rewards, quest validation, shared market,
channels, social permissions and competitive state. The self-hosted clone
server implements a compatible development subset; hidden server formulas and
production anti-cheat cannot be recovered from the public client.

## Remaining unknowns

- The 83 HTTP-403 design-source/raw mockup files are referenced by comments or
  tooling paths but are not publicly downloadable.
- Server-only validation, exact market/payment behavior, production anti-cheat
  and hidden live-ops switches are not present in the public artifact.
- A full gameplay parity claim requires scripted playthroughs across every
  class, quest branch, dungeon and item transaction; current evidence proves
  definitions and visible client behavior, not every reachable runtime branch.
