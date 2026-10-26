/* online/herostatus.js — the hero's statuses are the server's (2026-10-18, a tester's priest swarmed in the graveyard:
   "ต้องเดินออกระยะถึงจะตีโดน ถ้ามอนมารุมตีแทบไม่โดน"). The zombies, skeletons and wisps there put ใบ้ (silence: no skills) on
   the hero and the bats ตาบอด; the server (backend hero_status.go) refused every skill while silenced, but js/online read
   neither self.hst nor self.hstFx, so the web cast it anyway: the light fell, the cooldown ran, nothing was hit and
   nothing said why. Now:
     - self.hst {id: {t, dur}} is the hero's p.hst, which js/hstatus.js already shows (the chip in the buff row with its
       seconds, the mark over the head, blindness's dark edge) and checks: no moving or swinging while stopped, no skills
       while silenced (online/world.js asks NC.HS.noSkill before it sends one);
     - self.hstFx's words float once each, with the log line of a status landing: "ใบ้!", "ต้านใบ้" / "กันใบ้", "ตื่น!",
       "หายแล้ว", the HP a damage over time took;
     - the rest stays the server's: the rolls, the damage over time, the cures it gives by itself (js/hstatus.js skips its
       own online), and a click on a status chip asks it for one ({action:"buildloot", kind:"useCure", id:"g"|"p"},
       backend build_loot.go).
   Loaded after online/world.js. Test hooks: NC.OnlineHeroStatus. */
(function () {
  'use strict';
  const NC = window.NC, O = NC.Online, HS = NC.HS, FX = NC.FX;
  if (!O || !O.enabled || !HS) return;

  // ---------------- self.hst -> p.hst ----------------
  function sync(self, g) {
    const p = g && g.player;
    if (!p || !self) return;
    const src = self.hst && typeof self.hst === 'object' ? self.hst : {};
    const next = {};
    for (const id of HS.IDS) {
      const s = src[id], t = s ? Number(s.t) : 0;
      if (!(t > 0)) continue;
      const was = p.hst && p.hst[id];
      // (acc: js/hstatus.js's own damage-over-time clock, unused online)
      next[id] = { t, dur: Math.max(Number(s.dur) || 0, t), acc: 0, at: was ? was.at : g.time };
    }
    p.hst = next;
  }

  // ---------------- self.hstFx: each word once ----------------
  // (a word stays in the list for a snapshot or two; its seq is new when it was not in the last list: the seq starts over
  //  on another map or server, so a remembered highest seq would hide the new ones)
  const WORD = {
    land: (D) => [D.th + '!', D.color, 30],
    resist: (D) => ['ต้าน' + D.th, D.color, 24],
    immune: (D) => ['กัน' + D.th, D.color, 24],
    wake: () => ['ตื่น!', '#c9b6ff', 26],
    cure: () => ['หายแล้ว', '#bff5c8', 26],
  };
  let lastSeqs = new Set();
  function words(self, g) {
    const p = g && g.player, list = self && Array.isArray(self.hstFx) ? self.hstFx : [];
    const seqs = new Set(list.map((w) => w && w.seq));
    if (p) for (const w of list) {
      if (!w || lastSeqs.has(w.seq)) continue;
      const D = HS.ST[w.id];
      if (w.op === 'dot') {
        if (D && w.n > 0) FX.num(p.x + NC.rand(-20, 20), p.y - 150, Math.round(w.n), { fill: D.color, size: 28 });
        continue;
      }
      const make = WORD[w.op];
      if (!make || (!D && w.op !== 'wake' && w.op !== 'cure')) continue;
      const [text, fill, size] = make(D || {});
      FX.num(p.x, p.y - 200, text, { fill, size });
      if (w.op === 'land' && NC.HUD && NC.HUD.log) NC.HUD.log(`ติดสถานะ ${D.th}${w.from ? ' จาก' + w.from : ''} · ${D.what}`, 'warn');
    }
    lastSeqs = seqs;
  }

  O.on('snapshot', (st) => {
    const g = NC.game;
    if (!st || !st.self || !g || !g.player || st.mapId !== g.mapId) return;
    sync(st.self, g);
    words(st.self, g);
  });
  O.on('status', (s) => { if (s === 'reconnecting' || s === 'error') lastSeqs = new Set(); });

  // ---------------- a cure by hand: the server's ----------------
  HS.remoteCure = (which) => O.action({ action: 'buildloot', kind: 'useCure', id: which }) !== false;

  NC.OnlineHeroStatus = { sync, words };
})();
