# Night Camp online mechanism ledger

This is a static reconstruction of the public web client, not an observation of
the private backend. Original source snapshot: `game-20261022-1641`; current
clone client: `game-20261025-1758` (`v0.5.16`). REA focused
Evidence: `ev_615bf7d12d00163739cfc03b1979d63a69e0ecdb404a1735d01e69ec9487c048`.
Earlier whole-tree Evidence:
`ev_6eb7244a403d791566c24e6cef34de8238f6d687caaebc49d7c51ef9e261a6d9`.

## What the client proves

The browser is a thin client. `js/online/conn.js` creates a Nakama HTTP/WebSocket
client, while `js/online/world.js` projects server records into the existing
offline renderer. The server owns combat truth, monsters, loot, EXP, hero
progression, bag/storage, maps, channels and social state.

### Entry, identity and session

Observed in `core.js`, `online/conn.js`, `online/nakama.js`, `online/lobby.js`:

- `?online=<https origin>` enables online mode; the public build accepts only
  the baked origin from `meta[name=nc-online-servers]`.
- The client persists one server origin/key and one account record per origin in
  `localStorage`.
- Authentication modes are device, email-like username and custom beta key.
  Tokens have access/refresh expiry; refresh is attempted before requests.
- The release gate is `GET /nc/update`, followed by `nc_status`; the client
  checks `contentVersion`, `protocolVersion`, platform and build minimums.
- Lobby RPCs are `nc_account`, `nc_characters`, `nc_character_slot` and
  `nc_character_create`. A selected hero enters through `nc_join`.

### Transport and state machine

Observed in `online/nakama.js`, `online/conn.js`, `online/posbin.js`:

| Direction | Contract | Meaning |
|---|---|---|
| HTTP | `/v2/account/*`, `/v2/rpc/*`, `/v2/match`, `/nc/update`, `/nc/servers`, `/nc/load` | auth, RPC, release, server/channel discovery |
| WebSocket | `/ws?lang=th&status=true&token=…` | authenticated match transport |
| client → match | op 1..9 | move, attack, skill, pickup, warp, action, ping, device answer, view/lag-compensation |
| match → client | op 101..105 | full/delta snapshot, event/eventBatch, pong, transfer, device check |

Snapshot 101 is full on first join and delta afterwards. Deltas merge nullable
fields, remove player/monster IDs, and update only changed arrays. The client
tracks `seq` on commands and server `ackSeq`; reconnect always requires a fresh
full snapshot. Match metadata can advertise `eventBatch`, `zlib1`, `bin1` and a
view radius/crowd cap.

### Feature contracts found in the online modules

| Subsystem | Client/server contract | Current local clone gap |
|---|---|---|
| World/combat | server snapshots + events; local renderer/prediction only | no server-authoritative localnet, no delta/ack/reconnect simulation |
| Quests | `action:quest`, ops `take`, `handin`, `daily_claim`, `week_claim`, `choose`; server returns panels/rewards/progress/rank events | local quest path does not reproduce server timing, choice persistence and reward refusal semantics |
| Gear/storage | snapshot `bag`, `store`, `self.wu`; actions `equip`, `sellgear`, `store put/take`, `bagexpand` | local gear exists, but no transaction queue, refusal rollback, copy-ID authority or server inventory snapshots |
| Forge/craft | actions `forge` (refine/drill/stone/craft/polish), `cook`, `eat`, `brew`, `buildloot` | local formulas/UI exist; no authoritative result/event ledger, safety/seal costs or refusal/rollback parity |
| Life skills | `life`/`gather`, fish/chop/mine/farm actions; server owns resources and timers | local gathering is deterministic/local; lacks server timer, exhaustion and anti-duplicate rules |
| Check-in/offline farm | `nc_checkin_status`, `nc_checkin_claim`; `auto start/stop`, `seen offline`, farm crows | local check-in/AUTO behavior differs from account/server day and offline reward record |
| Social/party/guild | actions `party`, `guild`, `friend`; notifications for invite/request/accept/decline; server owns rosters and expiry | UI exists, but local clone has no multi-client notification/expiry/permission model |
| Market | `broker list/unlist`, player `vend open/close/buy`, `gacha`, `topup` | local shop/crafting is not a shared market and must remain offline-only unless a new local economy is defined |
| Channels/servers | `/nc/servers`, `/nc/load`, `/v2/match`, `nc_join`; channel switch leaves old match before joining new | local maps teleport directly; no channel capacity, transfer, reconnect or population state |
| Dungeons/root/PvP/guild war | `root`, `pvp`, `gwar`, boss events; server validates entry, floors, players, rewards and match state | local encounter scripts may render, but authoritative floor/roster/reward/season state is incomplete |
| Update/telemetry | `/nc/update`, version/news gate and client diagnostics | local clone intentionally omits live release gate and server telemetry |

## Important negative findings

- No browser-window, Electron IPC, preload or native binding surface was found
  by focused REA; this is a browser JavaScript client.
- Static analysis did not execute code or prove server behavior. The Go backend
  is referenced by comments and wire shapes but was not supplied in the public
  static tree, so formulas, validation and hidden server rules remain unknown.
- The original public client includes online adapters, but the deployed clone
  intentionally starts with `offline=1`; it does not send account credentials
  or connect to the original API.

## Implementation order for a faithful local clone

1. Add a local deterministic state service with the same records (`self`,
   `bag`, `store`, `quests`, `players`, `monsters`, `loot`, `mapId`,
   `channelId`) and versioned save data.
2. Add command sequencing, acknowledgements, refusal events and rollback for
   gear/quest/craft actions.
3. Implement quest choice graphs and durable flags before adding more dialogue.
4. Add dungeon/root/PvP encounter state machines with explicit entry,
   checkpoint, wipe, reward and exit transitions.
5. Add party/guild/friend local simulation and channel transfer only after the
   single-player authority layer is stable.

That order preserves the observed client contracts while keeping the clone
offline and avoiding any account/backend access to Night Camp.
