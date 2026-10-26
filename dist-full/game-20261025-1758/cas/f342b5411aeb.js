/* core.js — namespace, math helpers, seeded random, noise */
(function () {
  'use strict';
  const NC = (window.NC = window.NC || {});
  // The one word of the address the game reads (2026-10-21, the owner: "ลบสวิชออกให้หมด อย่าให้เหลือ"): ?online=<server>
  // (+ its ?serverkey, js/online/conn.js) makes the page the online client. There are no test switches: nothing else in
  // the address changes the game. An online page never reads or writes the offline save (the server holds the hero).
  NC.ONLINE = typeof location !== 'undefined' && new URLSearchParams(location.search).has('online');
  try { localStorage.removeItem('nc_admin'); } catch (e) { /* storage blocked (the old admin switch's leftover) */ }

  NC.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  NC.lerp = (a, b, t) => a + (b - a) * t;
  NC.dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
  NC.angle = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);
  NC.ease = (t) => 1 - Math.pow(1 - NC.clamp(t, 0, 1), 3);
  NC.rand = (a, b) => a + Math.random() * (b - a);
  NC.pick = (list) => list[Math.floor(Math.random() * list.length)];

  NC.rng = function (seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  NC.hash = function (x, y, s) {
    let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 144664051)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };

  NC.noise = function (x, y, s) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = NC.hash(xi, yi, s), b = NC.hash(xi + 1, yi, s);
    const c = NC.hash(xi, yi + 1, s), d = NC.hash(xi + 1, yi + 1, s);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };

  NC.fbm = function (x, y, s, oct) {
    let sum = 0, amp = 0.5, f = 1, norm = 0;
    for (let i = 0; i < (oct || 3); i++) {
      sum += amp * NC.noise(x * f, y * f, s + i * 31);
      norm += amp; amp *= 0.5; f *= 2;
    }
    return sum / norm;
  };

  // rounded rectangle path
  NC.rrect = function (ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };

  // five-point star path
  NC.star = function (ctx, x, y, r, rot) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = rot + (i * Math.PI) / 5 - Math.PI / 2;
      const rr = i % 2 ? r * 0.45 : r;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
  };

  NC.OUTLINE = '#2a2435'; // the bold navy-purple outline colour of the art style
})();
