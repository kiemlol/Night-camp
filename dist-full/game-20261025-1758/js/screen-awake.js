/* Screen Wake Lock: keep the visible game awake while a feature needs it. */
(function () {
  'use strict';
  const NC = (window.NC = window.NC || {});
  const reasons = new Set();
  const listeners = new Set();
  const messages = {
    idle: 'ปิดการเปิดหน้าจอค้าง',
    requesting: 'กำลังขอเปิดหน้าจอค้าง…',
    active: 'เปิดหน้าจอค้างอยู่',
    unsupported: 'เบราว์เซอร์นี้ไม่รองรับการเปิดหน้าจอค้าง',
    insecure: 'ต้องเปิดเกมผ่าน HTTPS เพื่อเปิดหน้าจอค้าง',
    denied: 'ระบบไม่อนุญาตให้เปิดหน้าจอค้าง กดลองอีกครั้ง',
    released: 'ระบบยกเลิกการเปิดหน้าจอค้าง กดลองอีกครั้ง',
    hidden: 'พักการเปิดหน้าจอค้างเมื่อออกจากหน้าเกม',
  };
  let status = 'idle';
  let sentinel = null;
  let pending = null;
  let generation = 0;
  let suspended = false;
  const desktopHidden = () => !!(window.NCDesktop && window.NCDesktop.isWindowHidden && window.NCDesktop.isWindowHidden());
  const visible = () => !suspended && !document.hidden && document.visibilityState !== 'hidden' && !desktopHidden();
  let wasVisible = visible();

  function getState() {
    return {
      requested: reasons.size > 0,
      active: !!sentinel && !sentinel.released,
      status,
      message: messages[status],
    };
  }

  function publish(next) {
    status = next;
    for (const listener of Array.from(listeners)) {
      try { listener(getState()); } catch (_) { /* UI errors must not stop the game. */ }
    }
  }

  function release(lock) {
    if (!lock) return;
    try {
      Promise.resolve(lock.release()).catch(() => {});
    } catch (_) { /* A browser may already have released the lock. */ }
  }

  function invalidate(next) {
    generation++;
    const old = sentinel;
    sentinel = null;
    release(old);
    publish(next);
  }

  const wanted = (job) => reasons.size > 0 && visible() && job.generation === generation;

  async function acquire(job) {
    let lock = null;
    try {
      if (!wanted(job)) return;
      lock = await navigator.wakeLock.request('screen');
      if (!wanted(job)) {
        release(lock);
        return;
      }
      sentinel = lock;
      const released = () => {
        // A cancelled lock can emit release after its replacement is active.
        if (sentinel !== lock) return;
        sentinel = null;
        publish(reasons.size ? (visible() ? 'released' : 'hidden') : 'idle');
      };
      lock.addEventListener('release', released, { once: true });
      if (lock.released) released();
      else publish('active');
    } catch (_) {
      if (lock && sentinel === lock) sentinel = null;
      release(lock);
      if (wanted(job)) publish('denied');
    } finally {
      if (pending === job) pending = null;
      // A hide/show or off/on cycle during a pending request needs a fresh lock.
      // Denial and OS release in the same generation never retry by themselves.
      if (job.generation !== generation && reasons.size && visible() && !sentinel) start();
    }
  }

  function start() {
    if (!reasons.size) return;
    if (!visible()) { publish('hidden'); return; }
    if (sentinel) return;
    if (pending) {
      if (status !== 'requesting') publish('requesting');
      return;
    }
    try {
      if (window.isSecureContext !== true) { publish('insecure'); return; }
      if (!navigator.wakeLock || typeof navigator.wakeLock.request !== 'function') {
        publish('unsupported');
        return;
      }
    } catch (_) { publish('denied'); return; }
    const job = { generation };
    pending = job;
    publish('requesting');
    void acquire(job);
  }

  function setReason(reason, enabled) {
    if (typeof reason !== 'string' || !reason) return getState();
    const previouslyRequested = reasons.size > 0;
    if (enabled) reasons.add(reason);
    else reasons.delete(reason);
    if (previouslyRequested && !reasons.size) invalidate('idle');
    else if (!previouslyRequested && reasons.size) {
      generation++;
      start();
    }
    return getState();
  }

  function visibilityChanged() {
    const nowVisible = visible();
    if (nowVisible === wasVisible) return;
    wasVisible = nowVisible;
    if (!nowVisible) invalidate(reasons.size ? 'hidden' : 'idle');
    else start();
  }

  document.addEventListener('visibilitychange', visibilityChanged);
  window.addEventListener('pagehide', () => { suspended = true; visibilityChanged(); });
  window.addEventListener('pageshow', () => { suspended = false; visibilityChanged(); });
  if (window.NCDesktop && window.NCDesktop.onWindowStateChanged) {
    window.NCDesktop.onWindowStateChanged(visibilityChanged);
  }

  NC.ScreenAwake = {
    getState,
    setReason,
    retry() { start(); return getState(); },
    subscribe(listener) {
      if (typeof listener !== 'function') return () => {};
      listeners.add(listener);
      try { listener(getState()); } catch (_) { /* Keep other subscribers working. */ }
      return () => listeners.delete(listener);
    },
  };
})();
