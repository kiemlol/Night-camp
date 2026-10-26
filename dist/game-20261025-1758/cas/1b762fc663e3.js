/* online/posbin.js — positions as bytes in a snapshot (2026-10-19, README "ลื่นแบบเกมเว็บ MMO อีกเกม: กลุ่ม B"; the server
   side is tools/online/patches/006_pos_view.patch, backend pos_binary.go). online/conn.js joins with match metadata
   pos: 'bin1'; a server with the patch then sends op 101 (or zlib 201) as a frame:
     byte 0      1 (the version: the record layout and STATES below)
     bytes 1-4   the JSON's length, uint32 little-endian
     the JSON    the same snapshot JSON as before, but the other heroes' rows have no x, y, aim, face, moving, hp,
                 lastInputSeq and the
                 monsters' rows no x, y, face, state (a state outside STATES stays in the row); a row new to this
                 connection carries "n", its number on this map
     the block   varint count + the heroes' records, varint count + the monsters' records, only the rows whose values
                 changed since this connection's last snapshot (all of them on a full snapshot or a newcomer):
                 varint n, a mask byte, then the values its bits name, in this order:
                   bit 0 x, y (int24 x 10 each) · bit 1 aim (int16 x 1000) · bit 2 face (int8) · bit 3 moving (its value in
                   bit 4) · bit 5 hp (float64) · bit 6 state (uint8, an index into STATES) · bit 7 lastInputSeq (varint)
   apply() writes those values back into the packet's rows (adding a row for an entity that only moved), so the packet
   is the same delta JSON the old wire gave and conn.js's mergeSnapshot, online/world.js and js/netsmooth.js read it as
   before. A server without the patch ignores the metadata and sends JSON (first byte '{'), handled as before.
   Also loaded by tools/perf/snapbytes.mjs (Node: no window). */
(function (root) {
  'use strict';
  const NC = root.NC || (root.NC = {});
  const VERSION = 1;
  // a monster's state as one byte (version 1; the same list as the server's posMonsterStates)
  const STATES = ['idle', 'chase', 'return', 'attack', 'windup', 'strike', 'stun', 'dead', 'hop', 'dash', 'recover', 'rise', 'roar', 'swoop', 'rest', 'act', 'change', 'gap', 'fuse', 'ready', 'under', 'dig', 'rain_windup'];
  const XY = 1, AIM = 2, FACE = 4, MOVING = 8, MOVING_ON = 16, HP = 32, STATE = 64, SEQ = 128;

  // the frame's two parts, or null for a plain JSON snapshot
  function split(bytes) {
    if (!bytes || bytes.length < 5 || bytes[0] !== VERSION) return null;
    const n = (bytes[1] | (bytes[2] << 8) | (bytes[3] << 16) | (bytes[4] << 24)) >>> 0;
    if (5 + n > bytes.length) throw new Error('posbin: frame shorter than its JSON');
    return { json: bytes.subarray(5, 5 + n), block: bytes.subarray(5 + n) };
  }

  function reader(b) {
    const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
    let i = 0;
    const need = (n) => { if (i + n > b.length) throw new Error('posbin: block ends early'); };
    return {
      get done() { return i >= b.length; },
      varint() {
        let v = 0, s = 0;
        for (;;) { need(1); const c = b[i++]; v += (c & 127) * 2 ** s; if (c < 128) return v; s += 7; if (s > 35) throw new Error('posbin: bad varint'); }
      },
      u8() { need(1); return b[i++]; },
      i8() { need(1); return dv.getInt8(i++); },
      i16() { need(2); const v = dv.getInt16(i, true); i += 2; return v; },
      i24() { need(3); let v = b[i] | (b[i + 1] << 8) | (b[i + 2] << 16); i += 3; return v & 0x800000 ? v - 0x1000000 : v; },
      f64() { need(8); const v = dv.getFloat64(i, true); i += 8; return v; },
    };
  }

  // nids: the connection's Map 'p<n>' / 'm<n>' -> entity id (online/conn.js keeps one per socket; a full snapshot starts it again)
  function apply(pk, block, nids) {
    if (pk.full !== false) nids.clear();
    const rows = { p: pk.players || (pk.players = []), m: pk.monsters || (pk.monsters = []) };
    const index = { p: new Map(), m: new Map() };
    for (const k of ['p', 'm']) for (const row of rows[k]) {
      index[k].set(row.id, row);
      if (row.n != null) { nids.set(k + row.n, row.id); delete row.n; }
    }
    const r = reader(block);
    for (const k of ['p', 'm']) {
      for (let c = r.varint(); c > 0; c--) {
        const n = r.varint(), mask = r.u8(), id = nids.get(k + n);
        if (id === undefined) throw new Error('posbin: no row numbered ' + k + n);
        let row = index[k].get(id);
        if (!row) { row = { id }; rows[k].push(row); index[k].set(id, row); }
        if (mask & XY) { row.x = r.i24() / 10; row.y = r.i24() / 10; }
        if (mask & AIM) row.aim = r.i16() / 1000;
        if (mask & FACE) row.face = r.i8();
        if (mask & MOVING) row.moving = !!(mask & MOVING_ON);
        if (mask & HP) row.hp = r.f64();
        if (mask & STATE) { const s = STATES[r.u8()]; if (s === undefined) throw new Error('posbin: unknown state'); row.state = s; }
        if (mask & SEQ) row.lastInputSeq = r.varint();
      }
    }
    if (!r.done) throw new Error('posbin: bytes after the block');
    return pk;
  }

  NC.PosBin = { VERSION, STATES, split, apply };
})(typeof window !== 'undefined' ? window : globalThis);
