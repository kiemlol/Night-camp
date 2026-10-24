# Night Camp clone — self-hosted online server

This repository contains a public-client reconstruction plus a new,
self-hosted clone server. The server is an independent implementation of the
client contracts discovered during static REA analysis; it does not connect to
Night Camp's original API and does not contain account or private player data.

## Run locally

```bash
cd server
cp .env.example .env
npm install
npm start
curl http://127.0.0.1:7350/healthz
```

For a VPS:

```bash
cd server
cp .env.example .env
# Set SERVER_KEY and PUBLIC_ORIGIN to your HTTPS origin.
docker compose up -d --build
```

Put Nginx/Caddy in front of port 7350 and proxy both HTTP and WebSocket
`/ws`. The browser client must be opened with:

`/game-20261022-1641/index.html?online=https://YOUR-DOMAIN&serverkey=YOUR_SERVER_KEY`

The client build's baked `meta[name=nc-online-servers]` must contain the same
HTTPS origin. Use a deployment-specific replacement before publishing; do not
commit a production key.

For the current smoke-test server, the key form accepts any 20-character
beta-key-shaped value (for example `12345678901234567890`). This is a
development convenience, not production authentication; replace it with a
real account/key service before opening the server publicly.

## Current server scope

Implemented: device/custom/email-shaped authentication, refresh sessions,
release/status/server-load endpoints, character slots, WebSocket match join,
full/delta snapshots, sequence acknowledgement, movement, attacks, skills,
pickup/warp/action handling, quest choices/progress, potions, stats, gear,
travel/rest/AUTO events, and persistent JSON state.

Still intentionally prototype-level: authoritative formulas, anti-cheat,
multi-process coordination, production database migrations, payment, and
complete dungeon/PvP/guild-war rules. Replace the JSON store with PostgreSQL
and add rate limits/auth hardening before exposing it to the public internet.

## Reverse-engineering notes and asset recovery

- `docs/game-systems-catalog.md` records the recovered progression, combat,
  jobs, skills, items, gear, refine, crafting, quest, map, dungeon, life-skill,
  social and online contracts.
- `docs/online-feature-ledger.md` records the HTTP/WebSocket and authoritative
  state boundary.
- `tools/survey-original.mjs`, `tools/audit-assets.mjs` and
  `tools/download-runtime-assets.mjs` reproduce the public resource audit.

The complete local research snapshot is about 540 MB. The GitHub `dist/`
folder remains the smaller boot bundle so the repository is practical to
clone; use the recovery tools against the public build to rebuild the full
runtime asset tree.
