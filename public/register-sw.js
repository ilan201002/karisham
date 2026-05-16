// P1-6: PWA update flow — מזהה גרסה חדשה ומבקש מהמשתמש לרענן.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async function () {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');

      // אם יש SW ממתין לחילופי שליטה (אחרי deploy חדש) — נשאל את המשתמש
      function promptReload(worker) {
        // הצגת UI מינימלי: bar עליון עם כפתור רענון
        if (document.getElementById('sw-update-bar')) return;
        const bar = document.createElement('div');
        bar.id = 'sw-update-bar';
        bar.dir = 'rtl';
        bar.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#0A1F44;color:#fff;padding:12px 16px;padding-top:calc(12px + env(safe-area-inset-top));font-family:-apple-system,Heebo,sans-serif;font-size:14px;font-weight:600;display:flex;align-items:center;justify-content:space-between;gap:12px;z-index:9999;box-shadow:0 2px 8px rgba(0,0,0,0.18)';
        bar.innerHTML = '<span>🚀 גרסה חדשה זמינה</span><button id="sw-update-btn" style="background:#1B4FD8;color:#fff;border:none;border-radius:8px;padding:8px 18px;font-weight:700;cursor:pointer;font-family:inherit">רענן עכשיו</button>';
        document.body.appendChild(bar);
        document.getElementById('sw-update-btn').addEventListener('click', () => {
          worker.postMessage({ type: 'SKIP_WAITING' });
        });
      }

      // האזנה ל-update flow:
      if (reg.waiting) promptReload(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            promptReload(newWorker);
          }
        });
      });

      // כאשר ה-SW החדש מקבל שליטה — לטעון מחדש את הדף
      let reloaded = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloaded) return;
        reloaded = true;
        window.location.reload();
      });

      // בדיקה ידנית כל 30 דקות
      setInterval(() => { reg.update().catch(() => {}); }, 30 * 60 * 1000);
    } catch (e) {
      console.warn('[SW] registration failed:', e);
    }
  });
}
