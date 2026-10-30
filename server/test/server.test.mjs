import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { once } from "node:events";
import WebSocket from "ws";

test("HTTP + two WebSocket players, command replay, invalid frames, restart and authentication", async (t) => {
  const data = await mkdtemp(path.join(os.tmpdir(), "nightcamp-test-"));
  let child, base;
  async function start() {
    child = spawn(process.execPath, ["src/server.mjs"], {
      cwd: new URL("../", import.meta.url),
      env: {
        ...process.env,
        PORT: "0",
        HOST: "127.0.0.1",
        DATA_DIR: data,
        SERVER_KEY: "integration-key",
        PUBLIC_ORIGIN: "",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let log = "";
    base = await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("server start timeout: " + log)),
        5000,
      );
      child.stdout.on("data", (b) => {
        log += b;
        const m = log.match(/http:\/\/127.0.0.1:(\d+)/);
        if (m) {
          clearTimeout(timer);
          resolve(m[0]);
        }
      });
      child.stderr.on("data", (b) => {
        log += b;
      });
      child.on("exit", () => {
        clearTimeout(timer);
        reject(new Error(log));
      });
    });
  }
  async function stop() {
    if (child && child.exitCode === null) {
      const exited = once(child, "exit");
      child.kill("SIGTERM");
      await exited;
    }
  }
  t.after(stop);
  await start();
  const authHeader =
    "Basic " + Buffer.from("integration-key:").toString("base64");
  async function post(route, body, auth) {
    const r = await fetch(base + route, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(auth ? { authorization: auth } : {}),
      },
      body: JSON.stringify(body),
    });
    return { status: r.status, data: await r.json() };
  }
  async function auth(id) {
    const r = await post(
      "/v2/account/authenticate/custom?create=true",
      { id },
      authHeader,
    );
    assert.equal(r.status, 200);
    return r.data;
  }
  async function rpc(s, id, p = {}) {
    const r = await post(
      "/v2/rpc/" + id,
      JSON.stringify(p),
      "Bearer " + s.token,
    );
    assert.equal(r.status, 200, JSON.stringify(r.data));
    return JSON.parse(r.data.payload);
  }
  const a = await auth("first-player"),
    b = await auth("second-player");
  const ca = await rpc(a, "nc_character_create", { slot: 0, name: "Alpha" }),
    cb = await rpc(b, "nc_character_create", { slot: 0, name: "Bravo" });
  assert.equal(ca.slots.length, 3);
  const aid = ca.slots[0].id,
    bid = cb.slots[0].id;
  const match = (await rpc(a, "nc_join")).matchId;
  assert.equal(match, (await rpc(b, "nc_join")).matchId);
  async function connect(s) {
    const ws = new WebSocket(
      base.replace("http", "ws") + "/ws?token=" + encodeURIComponent(s.token),
    );
    const messages = [],
      waiters = [];
    ws.on("message", (raw) => {
      const m = JSON.parse(raw);
      if (m.match_data)
        m.decoded = JSON.parse(Buffer.from(m.match_data.data, "base64"));
      messages.push(m);
      for (const w of [...waiters])
        if (w.p(m)) {
          waiters.splice(waiters.indexOf(w), 1);
          w.resolve(m);
        }
    });
    await once(ws, "open");
    return {
      ws,
      messages,
      wait(p) {
        const old = messages.find(p);
        if (old) return Promise.resolve(old);
        return new Promise((resolve, reject) => {
          const timer = setTimeout(
            () => reject(new Error("message timeout")),
            5000,
          );
          waiters.push({
            p,
            resolve: (m) => {
              clearTimeout(timer);
              resolve(m);
            },
          });
        });
      },
    };
  }
  const ac = await connect(a),
    bc = await connect(b);
  t.after(() => {
    ac.ws.terminate();
    bc.ws.terminate();
  });
  ac.ws.send(JSON.stringify({ cid: "1", match_join: { match_id: match } }));
  await ac.wait((m) => m.decoded?.self?.id === aid);
  bc.ws.send(JSON.stringify({ cid: "2", match_join: { match_id: match } }));
  await ac.wait((m) => m.decoded?.players?.some((p) => p.id === bid));
  function command(seq, a) {
    ac.ws.send(
      JSON.stringify({
        match_data_send: {
          match_id: match,
          op_code: "6",
          data: Buffer.from(JSON.stringify({ ...a, seq })).toString("base64"),
        },
      }),
    );
  }
  command(1, { action: "buy", kind: "red", count: 1 });
  const bought = await ac.wait(
    (m) => m.decoded?.ackSeq === 1 && m.decoded?.self?.coins === 235,
  );
  assert.equal(bought.decoded.self.potions, 4);
  command(1, { action: "buy", kind: "red", count: 1 });
  command(2, { action: "buy", kind: "red", count: -1 });
  await ac.wait((m) => m.decoded?.type === "error" && m.decoded?.seq === 2);
  const state = await ac.wait((m) => m.decoded?.ackSeq === 2);
  assert.equal(state.decoded.self.coins, 235);
  ac.ws.send("{bad");
  await ac.wait((m) => m.error);
  assert.equal((await fetch(base + "/healthz")).status, 200);
  const check = await rpc(a, "nc_checkin_claim");
  assert.equal(check.claimed, true);
  const duplicate = await post(
    "/v2/rpc/nc_checkin_claim",
    "{}",
    "Bearer " + a.token,
  );
  assert.equal(duplicate.status, 400);
  const html = await (
    await fetch(base + "/game-20261025-1758/index.html")
  ).text();
  assert.ok(html.includes("/backend-ui.js"));
  assert.ok(html.includes('nc-online-servers" content="' + base));
  const studio = await fetch(base + "/studio");
  assert.equal(studio.status, 200);
  assert.ok(studio.url.endsWith("/studio/"));
  const studioHtml = await studio.text();
  assert.ok(studioHtml.includes("CUTOUT STUDIO"));
  assert.ok(!studioHtml.includes("/backend-ui.js"));
  const studioModule = await fetch(base + "/studio/model.mjs");
  assert.equal(studioModule.status, 200);
  assert.match(studioModule.headers.get("content-type"), /javascript/);
  const demo = await fetch(base + "/cutout-demo");
  assert.equal(demo.status, 200);
  assert.ok(demo.url.endsWith("/cutout-demo/"));
  const demoHtml = await demo.text();
  assert.ok(demoHtml.includes("CUTOUT PLAYGROUND"));
  assert.ok(!demoHtml.includes("/backend-ui.js"));
  const email = await post(
    "/v2/account/authenticate/email?create=true",
    { email: "test@example.invalid", password: "correct-password" },
    authHeader,
  );
  assert.equal(email.status, 200);
  const wrong = await post(
    "/v2/account/authenticate/email?create=false",
    { email: "test@example.invalid", password: "incorrect-password" },
    authHeader,
  );
  assert.equal(wrong.status, 401);
  await stop();
  await start();
  const restored = await rpc(a, "nc_characters");
  assert.equal(restored.slots[0].id, aid);
  assert.equal(restored.slots[0].coins, 260);
  const forged = await post(
    "/v2/rpc/nc_characters",
    "{}",
    "Bearer " + a.token.slice(0, -4) + "AAAA",
  );
  assert.equal(forged.status, 401);
});
