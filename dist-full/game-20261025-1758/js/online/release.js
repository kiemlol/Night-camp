/* online/release.js — the game's version as players see it (2026-10-18, the user: "ทำ ui แจ้ง popup update … ทำเรื่อง ver
   ด้วย"; picked "v0.5.0 + วันที่", the update card with the version and date, a "มีอะไรใหม่" window and a version label on
   the front screens). A deploy (tools/online/live/deploy_web.sh) writes release.json into its build folder:
   { build, version: "0.5.1", date: ISO time, notes: ["…"] }, and the same plus force/note into the site's /version.json.
   This file only reads, checks and words them (both files are untrusted input); online/update.js shows them. It touches no
   page, so tools/online/live/release.mjs (the deploy's side) and tests/online-release.test.mjs load it as it is. */
(function () {
  'use strict';
  const NC = window.NC = window.NC || {};
  const FIRST = '0.5.0', MAX_NOTES = 12, NOTE_LEN = 160, TZ = 'Asia/Bangkok';
  const VERSION_RE = /^(\d{1,4})\.(\d{1,4})\.(\d{1,6})$/, BUILD_RE = /^[A-Za-z0-9._-]{1,80}$/;
  const clean = (t) => String(t).replace(/\s+/g, ' ').trim().slice(0, NOTE_LEN);
  const isVersion = (v) => typeof v === 'string' && VERSION_RE.test(v);
  const isBuild = (b) => typeof b === 'string' && BUILD_RE.test(b);

  // the version after v (the last number + 1); the first deploy with versions is 0.5.0
  function next(v) {
    const m = isVersion(v) ? v.match(VERSION_RE) : null;
    return m ? `${+m[1]}.${+m[2]}.${+m[3] + 1}` : FIRST;
  }
  // a list of notes, or the one line "a · b · c" a version.json from before versions has
  function notesOf(list, line) {
    const raw = Array.isArray(list) ? list : typeof line === 'string' ? line.split('·') : [];
    return raw.filter((n) => typeof n === 'string').map(clean).filter(Boolean).slice(0, MAX_NOTES);
  }
  function parse(v) {
    if (!v || typeof v !== 'object') return null;
    const t = typeof v.date === 'string' ? Date.parse(v.date) : NaN;
    return {
      build: isBuild(v.build) ? v.build : '',
      version: isVersion(v.version) ? v.version : '',
      date: Number.isFinite(t) ? new Date(t).toISOString() : '',
      notes: notesOf(v.notes, v.note),
    };
  }
  // "18 ต.ค. 69" (+ " 17:42"), the players' clock
  function when(iso, withTime) {
    const t = Date.parse(iso || '');
    if (!Number.isFinite(t)) return '';
    const day = { timeZone: TZ, day: 'numeric', month: 'short', year: '2-digit' };
    const opts = withTime ? { ...day, hour: '2-digit', minute: '2-digit', hour12: false } : day;
    try { return new Date(t).toLocaleString('th-TH', opts); } catch (e) { return ''; }
  }
  // "v0.5.1 · 18 ต.ค. 69"
  function label(rel, withTime) {
    if (!rel) return '';
    return [rel.version ? 'v' + rel.version : '', when(rel.date, withTime)].filter(Boolean).join(' · ');
  }
  NC.Release = Object.freeze({ FIRST, MAX_NOTES, isVersion, isBuild, next, notesOf, parse, when, label });
})();
