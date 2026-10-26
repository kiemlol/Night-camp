/* online-progress.js — the Game Bible's EXP rules from the server, for the online client (js/progression.js offline).
   The server keeps them on the hero (backend/rested.go, catch_up.go, faint_cost.go) and sends them in the self
   snapshot: rested (the ไออุ่นกองไฟ EXP left), catchUp (แสงนำทาง: +0.5 / +1 / +1.5), feathers (ขนนกไออุ่น) and
   faint (the last faint's cost: at, lost, feather, left). This shows what progression.js shows offline: the log lines,
   the Base EXP bar's badge (NC.Progress.online) and the feather at Uncle Coco's (the buy action, kind "feather"). */
(function () {
  'use strict';
  const NC = window.NC;
  const NEW_SESSION_MS = 5000; // no snapshot for this long: a reconnect, its first snapshot greets again
  const pct = (k) => Math.round(k * 100);
  let last = null, lastAt = 0;

  function greet(self) {
    if (self.rested > 1) NC.HUD.log(`ไออุ่นกองไฟ: EXP ×2 อีก ${Math.round(self.rested).toLocaleString()} แต้ม (สะสมตอนพักในค่าย)`, 'level');
  }
  function catchUpLine(k) {
    return k > 0 ? `แสงนำทาง: EXP +${pct(k)}% (ตามหลังเลเวลกลางของ 100 อันดับแรก)` : 'แสงนำทางจางลง · EXP กลับเป็นปกติ';
  }
  function compare(before, now) {
    if (!before) {
      greet(now);
      if (now.catchUp > 0) NC.HUD.log(catchUpLine(now.catchUp), 'level');
      return;
    }
    if (before.rested > 0 && now.rested <= 0) NC.HUD.log('ไออุ่นกองไฟหมดแล้ว · EXP กลับเป็นปกติ', 'sys');
    if (before.catchUp !== now.catchUp) NC.HUD.log(catchUpLine(now.catchUp), now.catchUp > 0 ? 'level' : 'sys');
    // (the faint's line is online/faint.js's in the current client)
    if (NC.Online && NC.Online.active && now.faint && now.faint.at !== (before.faint && before.faint.at) && (now.faint.feather || now.faint.lost > 0))
      NC.HUD.log(NC.faintLine(now.faint.lost || 0, !!now.faint.feather, now.faint.left || 0), now.faint.feather ? 'item' : 'warn');
  }
  function featherButton(near) {
    const sp = document.getElementById('online-buy-sp');
    if (!sp) return;
    let b = document.getElementById('online-buy-feather');
    if (!b) {
      const F = NC.EXPERIENCE.faint.feather;
      b = document.createElement('button'); b.id = 'online-buy-feather'; b.type = 'button';
      b.textContent = `ขนนกไออุ่น ${F.price}`; b.title = 'หมดแรงครั้งหน้าไม่เสีย EXP (ใช้อัตโนมัติ ตั้งแต่ Lv 20)';
      b.addEventListener('click', () => NC.Online.action('buy', { kind: F.id, count: 1 }));
      sp.after(b);
    }
    b.disabled = !near;
  }
  addEventListener('nightcamp:online-snapshot', (event) => {
    const data = event.detail && event.detail.snapshot, self = data && data.self;
    if (!self || !NC.game) return;
    const at = event.detail.receivedAt || performance.now();
    const now = { rested: +self.rested || 0, catchUp: +self.catchUp || 0, feathers: +self.feathers || 0, faint: self.faint || null };
    if (at - lastAt > NEW_SESSION_MS) last = null;
    compare(last, now);
    last = now; lastAt = at;
    NC.Progress.online = { rested: now.rested, guide: now.catchUp };
    NC.game.player.feathers = now.feathers;
    if (!(NC.Online && NC.Online.active)) return; // (the current client sells the feather at Uncle Coco's itself)
    const hp = document.getElementById('online-buy-hp');
    featherButton(!!hp && !hp.disabled);
  });
})();
