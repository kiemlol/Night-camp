/* The web online client's side of the elements' statuses (js/statuses.js, backend/statuses.go): the server sends a
   monster's stacks (`st`: { burn: 3, shock: 1 }) and a `frozen` flag, and a `reaction` event with its key. The skill
   files read e.st[k] = { t, n } and e.frozen, so after each snapshot the records are turned into those (a full snapshot
   leaves the cured ones out, a delta sends them as null); a reaction says its name over the monster as statuses.js
   does. Apart from js/online.js so the FX replay sources stay untouched (scripts/export-unity-fx-replay.mjs). */
(function () {
  const NC = window.NC;
  const LASTS = 1e9; // (a status lasts until the server ends it)
  // statuses.js reaction(): the names and colours
  const REACTIONS = {
    steam: ['ไอน้ำระเบิด!', '220,240,255'], superconduct: ['ไฟฟ้าช็อตน้ำแข็ง!', '170,230,255'], overload: ['โอเวอร์โหลด!', '255,200,110'],
    poisonfire: ['พิษลุกไหม้!', '180,240,90'], wildfire: ['ไฟลามทุ่ง!', '255,160,80'], cleanse: ['ชำระล้าง!', '255,236,160'],
  };
  const REACTION_LIFT = 210, REACTION_SIZE = 38, REACTION_SHAKE = 5;

  function statuses(stacks) {
    if (!stacks || typeof stacks !== 'object') return null;
    const st = {};
    for (const [k, n] of Object.entries(stacks)) if (Number(n) > 0) st[k] = { t: LASTS, n: Number(n), acc: 0 };
    return Object.keys(st).length ? st : null;
  }
  function onSnapshot(event) {
    const monsters = event.detail?.snapshot?.monsters, game = NC.game;
    if (!Array.isArray(monsters) || !game) return;
    const byId = new Map((game.enemies || []).map((e) => [e.id, e]));
    for (const record of monsters) {
      const e = record && byId.get(record.id);
      if (!e) continue;
      sync(e, record);
    }
  }
  function sync(e, record) {
    e.st = statuses(record.st);
    e.frozen = record.frozen === true ? LASTS : 0;
  }
  function onEvent(data, game = NC.game) {
    if (!data || data.type !== 'reaction') return;
    const e = (game?.enemies || []).find((m) => (m.sid || m.id) === data.targetId), said = REACTIONS[data.key];
    if (!e || !said) return;
    NC.FX.num(e.x, e.y - (NC.reactionLift ? NC.reactionLift(e) : REACTION_LIFT), said[0], { fill: `rgb(${said[1]})`, size: e.dummy ? 28 : REACTION_SIZE }); // (a dummy: above its readout, js/statuses.js)
    NC.VFX?.shake?.(game, REACTION_SHAKE);
  }
  window.addEventListener('nightcamp:online-snapshot', onSnapshot);
  window.addEventListener('nightcamp:online-event', (event) => onEvent(event.detail));
  NC.OnlineStatuses = Object.freeze({ sync, event: onEvent });
})();
