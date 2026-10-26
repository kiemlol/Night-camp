/* npcwin.js — the NPC windows in the K look get their NPC beside the content, like Uncle Coco's shop (js/shopwin.js):
   the forge (#forge: ป๋าหมูหริ่ง) and the four life-skill teachers (#lifementor: ยายกระต่าย, ลุงบีเวอร์ฟันเก,
   ตุ่นหัวไฟ, ตานาก). Their paintings are assets/kui/npc_<id>.jpg (Codex, assets/gen/make_npc_panel_prompts.py). The
   windows' own code is untouched: after HUD.init this moves each card's content into a two-column body (the painting
   with a speech bubble | the content). The bubble shows what the NPC says: the smith's latest line (NC.Forge.npc.say),
   a teacher's line from the window (.mt-say, hidden there). css/kskin.css draws it (and makes it a strip on top of the
   window on a phone held upright). Esc closes these older windows, like the K ones. */
(function () {
  'use strict';
  const NC = window.NC;
  const $ = (id) => document.getElementById(id);
  const ART = (id) => `assets/kui/npc_${id}.jpg`;
  const TEACHERS = { rabbit: 'rabbit', beaver: 'beaver', mole: 'mole', otter: 'otter' }; // (mentor id -> painting)

  function wrap(card, art) {
    if (!card || card.querySelector('.nw-body')) return null;
    const body = document.createElement('div'), pic = document.createElement('div'), bub = document.createElement('div'), main = document.createElement('div');
    body.className = 'nw-body'; pic.className = 'nw-art'; bub.className = 'nw-bubble'; main.className = 'nw-main';
    if (art) pic.style.backgroundImage = `url(${art})`;
    pic.appendChild(bub);
    for (const k of [...card.children]) if (!k.classList.contains('ptitle')) main.appendChild(k);
    body.append(pic, main);
    card.appendChild(body);
    return { pic, bub };
  }
  const setBubble = (bub, text) => {
    text = String(text || '').replace(/\s+/g, ' ').trim();
    if (bub.textContent !== text) { bub.textContent = text; bub.classList.toggle('long', text.length > 36); }
  };

  let forge = null, mentor = null;
  const baseInit = NC.HUD.init.bind(NC.HUD);
  NC.HUD.init = function (game) {
    baseInit(game);
    // the forge: the smith's latest line while the window is open
    const fw = $('forge');
    forge = fw && wrap(fw.querySelector('.card'), ART('smith'));
    // a teacher: the painting by who is talking, the line the window shows
    const mw = $('lifementor');
    mentor = mw && wrap(mw.querySelector('.card'), '');
    const body = $('mt-body');
    if (mentor && body) new MutationObserver(syncMentor).observe(body, { childList: true, subtree: true, characterData: true });
  };
  function syncMentor() {
    if (!mentor) return;
    const L = NC.Life, name = ($('mt-name') || {}).textContent || '';
    const m = L && L.mentors.find((q) => q.name === name), id = m && TEACHERS[m.id];
    const want = id ? `url("${ART(id)}")` : '';
    if (mentor.pic.dataset.id !== (id || '')) { mentor.pic.dataset.id = id || ''; mentor.pic.style.backgroundImage = want; }
    const say = document.querySelector('#mt-body .mt-say');
    setBubble(mentor.bub, say ? say.textContent : '');
  }
  // Esc closes these older windows (like the K windows) instead of opening the game menu over them
  const OLD = ['forge', 'lifementor', 'vend', 'vbuy', 'autofarm'];
  addEventListener('keydown', (e) => {
    if (e.code !== 'Escape') return;
    const id = OLD.find((k) => { const w = $(k); return w && !w.hidden; });
    if (!id) return;
    const t = document.activeElement;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) { t.blur(); } // (typing a shop's name or a price: Esc leaves the box first)
    e.stopImmediatePropagation(); e.preventDefault();
    NC.HUD.panel(id, false);
    if (NC.game) NC.game.paused = false;
  }, true);
  setInterval(() => {
    if (forge && $('forge') && !$('forge').hidden && NC.Forge) {
      const n = NC.Forge.npc;
      setBubble(forge.bub, n.say || 'มาแล้วเหรอ! มีอะไรให้ป๋าตีไหม?');
    }
  }, 300);
})();
