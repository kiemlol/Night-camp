/* otherfx.js — the others' effects at a share (the user, 2026-10-18: "ทำระบบ เช่นเวลาเห็นคนอื่น จะเห็นเอฟเฟคคนอื่นแค่ 30%
   ด้วยนะกันแลคขึ้น"). Another player's skill plays on my screen from the same skill code as mine (js/net.js replays it
   inside its looks(), for the Go server's heroes as for the Artifact room), and online their hits put numbers and sparks
   on the monsters (js/online/world.js runs those through OF.run). Here every piece those make is let through at a share:
   - the same kind of piece again (sparks, puffs, flames, ghosts, numbers, the particles of a glfx burst, lights): only
     that share of them, spread evenly (an error-diffusion count per kind: 30% = 3 of every 10);
   - the first piece of each kind after a quiet half second always shows, so a skill keeps its shape (the beam, the
     ring, the painted flipbook) and only its spray thins; in a crowd the same kinds come again and again and thin too;
   - a cap on how many of the others' pieces live at once (more of the share, more cap), so a big crowd can't pile up;
   - a piece that carries the skill's logic (update / onEnd: a projectile that bursts on landing, a timer) is never
     dropped, only hidden, so what it starts still happens (at the share); a piece living a minute or more (a shared
     drawer the skill files keep alive with FX.list.includes) is always let through.
   My own skills, my hits and everything of the world stay whole.
   ESC → ตั้งค่า → "เอฟเฟกต์ผู้เล่นอื่น" (ทั้งหมด / 60% / 30% / ปิด), remembered (localStorage nightcamp.otherfx.v1);
   ?otherfx=100|60|30|0 for one page (100 = as before). NC.OtherFX.stats() for tests.
   Hooks (loaded after every other FX.add wrapper): NC.FX.add, NC.FX.update, NC.VFX.light. */
(function () {
  'use strict';
  const NC = window.NC, FX = NC.FX, V = NC.VFX;
  const KEY = 'nightcamp.otherfx.v1', LEVELS = [100, 60, 30, 0], QUIET = 500, LONG = 60;
  const OF = (NC.OtherFX = { pct: 30 });
  const pick = (v) => (v !== null && v !== '' && LEVELS.includes(+v) ? +v : null); // (+null would be 0 = off)
  let chosen = false; // (the player picked a share, or a quality level that sets one: Auto's relief leaves it alone)
  try { const s = pick(localStorage.getItem(KEY)); if (s !== null) { OF.pct = s; chosen = true; } } catch (e) { /* storage blocked: 30% */ }
  // Auto's relief (js/gfx.js: the CPU holding the frames back): none of the others' effects from step 2, this session
  OF.relieve = (level) => {
    if (chosen) return;
    OF.pct = level >= 2 ? 0 : 30; acc.clear(); seenAt.clear();
  };
  const share = () => OF.pct / 100;
  const cap = () => Math.round(40 + 360 * share());

  // ---------------- whose piece is this ----------------
  let depth = 0;
  OF.run = function (fn) { depth++; try { return fn(); } finally { depth--; } };
  const wrap = (fn) => function () { depth++; try { return fn.apply(this, arguments); } finally { depth--; } };
  OF.active = () => depth > 0 || !!(NC.Net && NC.Net.inLooks && NC.Net.inLooks());

  // ---------------- the share: per kind, spread evenly; a kind quiet for a while starts with a piece ----------------
  const acc = new Map(), seenAt = new Map();
  const sig = (f) => { try { const s = Function.prototype.toString.call(f); return s.length + s.slice(0, 48); } catch (e) { return '?'; } };
  const kindOf = (p) => String(p.type) + (typeof p.draw === 'function' ? '#' + sig(p.draw) : '');
  function let1(kind, k) {
    const now = performance.now();
    let a = now - (seenAt.get(kind) || -1e9) > QUIET ? 1 : acc.get(kind) || 0;
    seenAt.set(kind, now);
    a += k;
    const ok = a >= 1;
    acc.set(kind, ok ? a - 1 : a);
    if (acc.size > 600) { acc.clear(); seenAt.clear(); } // (kinds of 'custom' pieces are many: start over now and then)
    return ok;
  }
  // ...and the room left under the cap (counted once a frame, after FX.update)
  let live = 0;
  const st = { kept: 0, hidden: 0, dropped: 0, lights: 0, lightsDropped: 0, parts: 0, partsDropped: 0 };
  const hide = (p) => Object.defineProperty(p, 'layer', { get: () => 'none', set() {}, configurable: true });

  const baseAdd = FX.add;
  FX.add = function (p) {
    if (!p || OF.pct >= 100 || !OF.active() || !(p.life < LONG)) return baseAdd.apply(this, arguments);
    const k = share(), logic = typeof p.update === 'function' || typeof p.onEnd === 'function';
    if (depth > 0) { if (typeof p.update === 'function') p.update = wrap(p.update); if (typeof p.onEnd === 'function') p.onEnd = wrap(p.onEnd); } // (what it spawns later is theirs too)
    // a glfx particle burst (GL.parts): its particles at the share as well
    if (typeof p.add === 'function' && Array.isArray(p.parts)) {
      const add = p.add;
      let a = 1;
      p.add = function (pt) {
        a += k;
        if (a >= 1) { a -= 1; st.parts++; return add.call(this, pt); }
        st.partsDropped++; pt.t = pt.t || 0; return pt;
      };
    }
    if (k > 0 && live < cap() && let1(kindOf(p), k)) {
      p.ofOther = true; live++; st.kept++;
      return baseAdd.apply(this, arguments);
    }
    if (logic) { hide(p); st.hidden++; return baseAdd.apply(this, arguments); }
    // a plain piece: not added at all (the skill code may still hold it and move it: it only never shows)
    st.dropped++;
    p.t = 0; if (!p.layer) p.layer = 'glow';
    return p;
  };
  const baseUpdate = FX.update;
  FX.update = function () {
    const r = baseUpdate.apply(this, arguments);
    let n = 0;
    for (const p of FX.list) if (p.ofOther) n++;
    live = n;
    return r;
  };
  // the night lights their skills bring (V.light): the share, per colour
  if (V && V.light) {
    const baseLight = V.light;
    V.light = function (x, y, r, rgb, a, life, o) {
      if (OF.pct >= 100 || !OF.active() || !(life < LONG)) return baseLight.apply(this, arguments);
      if (share() > 0 && let1('light:' + rgb, share())) { st.lights++; return baseLight.apply(this, arguments); }
      st.lightsDropped++;
      return Object.assign({ x, y, r, rgb, a, life, t: 0 }, o || {}); // (held, moved, ended by the skill code: never lit)
    };
  }

  // ---------------- ESC → ตั้งค่า ----------------
  OF.set = (v) => {
    v = pick(v);
    if (v === null) return;
    OF.pct = v; chosen = true; acc.clear(); seenAt.clear();
    try { localStorage.setItem(KEY, String(v)); } catch (e) { /* storage blocked */ }
  };
  (NC.MENU_SETTINGS = NC.MENU_SETTINGS || []).push({
    name: 'เอฟเฟกต์ผู้เล่นอื่น',
    note: 'คนเยอะแล้วกระตุก: ยิ่งน้อยยิ่งลื่น · สกิลของเราเห็นเต็มเสมอ',
    group: 'perf',
    opts: [['100', 'ทั้งหมด'], ['60', '60%'], ['30', '30%'], ['0', 'ปิด']], // (four pills fit the menu at 800 px; five ran out of the row)
    get: () => String(OF.pct),
    set: (v) => OF.set(v),
  });
  // (tests) what was let through since the last reset
  OF.stats = () => Object.assign({ pct: OF.pct, cap: cap(), live }, st);
  OF.reset = () => { for (const k in st) st[k] = 0; acc.clear(); seenAt.clear(); };
})();
