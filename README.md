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
