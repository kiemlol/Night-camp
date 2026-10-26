/* loading.js — the loading screen: key art with rising embers and fireflies, the logo, a firelit progress bar that
   follows the real loading (the sprites: NC.SPR fills as NC.loadAssets goes; then the map being built), tips that
   change every few seconds; it fades away when the game starts (game.js removes #loading, an empty marker).
   The screen itself is plain HTML + css/loading.css, so it shows before any script runs. Load right after assets.js. */
(function () {
  'use strict';
  const NC = window.NC;
  const el = document.getElementById('preload');
  if (!el) return;
  const $ = (id) => document.getElementById(id);
  const text = $('pl-text'), pct = $('pl-pct'), fill = $('pl-fill'), flame = $('pl-flame'), tipEl = $('pl-tip');

  // ---------------- the key art and the logo fade in once they have loaded ----------------
  const art = el.querySelector('.pl-art'), logo = el.querySelector('.pl-logo');
  const shown = (img, fn) => { if (!img) return; if (img.complete && img.naturalWidth) fn(); else img.addEventListener('load', fn); };
  shown(art, () => art.classList.add('on'));
  shown(logo, () => el.classList.add('logo'));
  const noLogo = () => { el.classList.add('nologo'); if (logo) logo.remove(); };
  if (logo) { logo.addEventListener('error', noLogo); if (logo.complete && !logo.naturalWidth) noLogo(); } else el.classList.add('nologo');

  // ---------------- progress: preparing -> the sprites -> building the map -> fade out ----------------
  let shownP = 0, target = 0.03, phase = 'boot', total = 0;
  const setText = (t) => { if (text.textContent !== t) text.textContent = t; };
  const all = () => { const m = {}; for (const k in NC) if (/^ASSET_MANIFEST/.test(k)) Object.assign(m, NC[k]); return m; };
  // (the sprites counted are the start set, js/assets.js: the rest streams in after the game starts)
  const startSet = () => (NC.Sprites ? NC.Sprites.startSet() : null);
  (NC.assetsBefore || (NC.assetsBefore = [])).push(() => {
    phase = 'sprites';
    total = startSet() ? 0 : Object.keys(all()).length;
  });
  (NC.assetsLoaded || (NC.assetsLoaded = [])).push(() => new Promise((ok) => {
    // the map is built right after this, in one go: show that first (two frames, so the page paints)
    phase = 'world'; target = 0.9; setText('กำลังจุดกองไฟ และสร้างแผนที่…'); draw(true);
    // (a hidden tab gets no animation frames: the timer carries on without them)
    let done = false;
    const go = () => { if (!done) { done = true; ok(); } };
    requestAnimationFrame(() => requestAnimationFrame(go));
    setTimeout(go, 120);
  }));
  function draw(now) {
    if (phase === 'sprites') {
      const set = startSet();
      if (set) total = set.length;
      const n = set ? total - NC.Sprites.missing(set) : NC.SPR ? Object.keys(NC.SPR).length : 0;
      target = 0.05 + 0.82 * (total ? Math.min(1, n / total) : 0);
      setText(`กำลังโหลดภาพ… ${n} / ${total}`);
    } else if (phase === 'world' && NC.Sprites && NC.Sprites.boot && NC.Sprites.boot.total) {
      // (js/stream.js: the art of the map the hero starts on and of the hero's gear)
      const b = NC.Sprites.boot, n = b.total - NC.Sprites.missing(b.names);
      target = 0.87 + 0.08 * Math.min(1, n / b.total);
      setText(`กำลังโหลดแผนที่… ${n} / ${b.total}`);
    } else if (phase === 'boot') setText('กำลังเตรียมค่าย…');
    shownP = now ? target : shownP + (target - shownP) * 0.25;
    const w = Math.max(0, Math.min(1, shownP));
    fill.style.width = `calc(${(w * 100).toFixed(2)}% - 6px)`;
    flame.style.left = `calc(${(w * 100).toFixed(2)}% - ${(w * 6).toFixed(1)}px + 3px)`;
    pct.textContent = Math.round(w * 100) + '%';
  }
  const timer = setInterval(() => {
    draw(false);
    if (!document.getElementById('loading')) { // the game has started
      clearInterval(timer);
      target = shownP = 1; draw(true); setText('พร้อมแล้ว!');
      setTimeout(() => { el.classList.add('out'); setTimeout(() => { el.remove(); running = false; }, 900); }, 250);
    }
  }, 80);

  // ---------------- tips ----------------
  const TIPS = [
    'กด <b>X</b> นั่งพัก HP / SP ฟื้นเร็วขึ้น 2 เท่า · นั่ง<b>ข้างกองไฟ</b>ในค่ายเร็วขึ้น 4 เท่า',
    'มอนแต่ละชนิดดรอป<b>วัสดุ</b>ของตัวเอง เอาไปขาย<b>ลุงโกโก้</b>ที่ร้านกลางค่ายได้ (กด <b>B</b>)',
    'กด <b>I</b> เปิดอุปกรณ์ ลองใส่<b>ชุดแฟชั่น</b> เป็ด เห็ด กบ แพนด้า กระต่าย ฟักทอง',
    'กด <b>P</b> ชวนเพื่อน AI เข้าปาร์ตี้ได้สูงสุด 3 คน',
    '<b>ราชาเห็ดเรืองแสง</b>หลับอยู่ในป่าเห็ด · วงแดงบนพื้นคือท่ากระโดดทุบ หลบให้ทัน!',
    'เดินไปยืนที่<b>วาร์ป</b>สุดถนนขอบแมพ เพื่อไปทุ่งล่ามอน · ป้ายเหนือวาร์ปบอกเลเวลมอน',
    'ตีให้ถูก<b>ธาตุ</b> ตัวเลขดาเมจจะเป็นสีส้ม · กรอบเป้าหมายบอกว่าอาวุธเราได้กี่ %',
    'Job Lv 10 แล้ว<b>เปลี่ยนอาชีพ</b>ได้ที่หน้าสกิล (กด <b>K</b>)',
    'กด <b>L</b> เปิดห้องดูท่าทาง เลือกท่ายืนกับชุดท่าโจมตีของตัวเองได้',
    'มอนโจมตีจะ<b>ง้าง</b>ก่อนเสมอ (ตัวกะพริบแดง) ถอยหลบตอนนั้นพอดี',
    'เปลี่ยน<b>ทรงผม สีผม ดวงตา ปาก</b> ได้ทุกเมื่อที่เมนู <b>ESC</b> > ปรับแต่งตัวละคร',
    'กด <b>M</b> แล้วเปิดแท็บ<b>แผนที่โลก</b> ดูว่าแมพไหนเหมาะกับเลเวลและธาตุของอาชีพเรา',
    'ฟักทองกับแครอทใน<b>ไร่ฟักทอง</b> (ถนนตะวันออกของค่าย) ไม่ตีก่อน เหมาะกับมือใหม่',
    '<b>ผีดวงไฟ</b>ในเนินสุสานรับดาเมจกายภาพไม่มีธาตุแค่ 25% · ใช้สกิลธาตุหรือพาพระไปด้วย',
    '<b>ภูเขาไฟหลับ</b> (ทางใต้ของผาหินแดง) มอนธาตุไฟล้วน สกิลน้ำแข็งแรงขึ้น 1.5 เท่า',
    'ใน<b>หนองพิษ</b> มอนธาตุพิษไม่รับดาเมจพิษเลย โจรสายพิษควรไปแมพอื่น',
    '<b>ดันเจี้ยน</b>: ถ้ำค้างคาว (ทุ่งหญ้า) เหมืองมด (ไร่ฟักทอง) สุสานใต้ดิน (โบสถ์ร้าง) ปล่องภูเขาไฟ · ชั้นล่างสุดมีบอส',
    'ตี<b>หีบสมบัติ</b>ในห้องทางตันของดันเจี้ยนให้แตก ได้เหรียญ วัสดุ ยา บางทีได้ของสวมใส่',
    'ว่ากันว่าถ้าไล่ค้างคาวในถ้ำค้างคาวมาก ๆ จะได้ยินเสียงปีกนับพันจากส่วนลึกของถ้ำ...',
  ];
  // the online player's page (NC.PLAYER_VIEW, js/online/boot.js): no tips about the developer's lab (L) or the test-only
  // AI party; the ESC button is called ปรับแต่งหน้าตา there (js/menuwin.js)
  if (window.NC && window.NC.PLAYER_VIEW) {
    for (let i = TIPS.length - 1; i >= 0; i--) if (/<b>L<\/b>|เพื่อน AI/.test(TIPS[i])) TIPS.splice(i, 1);
    for (let i = 0; i < TIPS.length; i++) TIPS[i] = TIPS[i].replace('ปรับแต่งตัวละคร', 'ปรับแต่งหน้าตา');
  }
  let tip = Math.floor(Math.random() * TIPS.length);
  const showTip = () => { tipEl.innerHTML = 'เคล็ดลับ · ' + TIPS[tip]; };
  showTip();
  const tipTimer = setInterval(() => {
    if (!el.isConnected) return clearInterval(tipTimer);
    tipEl.classList.add('fade');
    setTimeout(() => { tip = (tip + 1) % TIPS.length; showTip(); tipEl.classList.remove('fade'); }, 450);
  }, 4800);

  // ---------------- embers from the campfire and fireflies ----------------
  // where the fire is on the key art (fractions of the picture), from data-fire="x,y" on #preload
  const cv = el.querySelector('.pl-fx'), ctx = cv.getContext('2d');
  const fireAt = (el.dataset.fire || '0.5,0.66').split(',').map(Number);
  const sparks = [], flies = [];
  let running = true, last = performance.now();
  // the picture is drawn with object-fit: cover: where a point of it lands on the screen
  function onScreen(fx, fy) {
    const W = cv.width, H = cv.height, iw = (art && art.naturalWidth) || 16, ih = (art && art.naturalHeight) || 9;
    const k = Math.max(W / iw, H / ih), ox = (W - iw * k) * 0.5, oy = (H - ih * k) * 0.45; // (object-position 50% 45%)
    return [ox + fx * iw * k, oy + fy * ih * k, k];
  }
  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const dpr = Math.min(2, window.devicePixelRatio || 1), W = Math.round(innerWidth * dpr), H = Math.round(innerHeight * dpr);
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    ctx.clearRect(0, 0, W, H);
    const [fx, fy] = onScreen(fireAt[0], fireAt[1]), s = Math.min(W, H) / 900;
    if (sparks.length < 70 && Math.random() < dt * 34)
      sparks.push({ x: fx + (Math.random() - 0.5) * 60 * s, y: fy, vx: (Math.random() - 0.5) * 30 * s, vy: -(60 + Math.random() * 90) * s, t: 0, life: 1.2 + Math.random() * 1.6, r: (1.2 + Math.random() * 2.2) * s, ph: Math.random() * 9 });
    while (flies.length < 16) flies.push({ x: Math.random() * W, y: H * (0.35 + Math.random() * 0.5), ph: Math.random() * 9, sp: 0.4 + Math.random() * 0.8 });
    ctx.globalCompositeOperation = 'lighter';
    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i];
      p.t += dt; p.x += (p.vx + Math.sin(p.t * 3 + p.ph) * 18 * s) * dt; p.y += p.vy * dt; p.vy *= 1 - dt * 0.2;
      if (p.t > p.life) { sparks.splice(i, 1); continue; }
      const a = Math.min(1, p.t * 4) * (1 - p.t / p.life);
      ctx.fillStyle = `rgba(255,${150 + Math.floor(80 * (1 - p.t / p.life))},70,${a})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }
    for (const f of flies) {
      f.ph += dt * f.sp;
      const x = f.x + Math.sin(f.ph * 1.3) * 30 * s, y = f.y + Math.cos(f.ph) * 20 * s, a = 0.35 + 0.35 * Math.sin(f.ph * 3);
      const g = ctx.createRadialGradient(x, y, 0, x, y, 9 * s);
      g.addColorStop(0, `rgba(230,255,170,${a})`); g.addColorStop(1, 'rgba(230,255,170,0)');
      ctx.fillStyle = g; ctx.fillRect(x - 9 * s, y - 9 * s, 18 * s, 18 * s);
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  requestAnimationFrame(frame);
  draw(true);
})();
