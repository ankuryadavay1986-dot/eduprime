/* ═══════════════════════════════════════════════════
   Edu Prime — PWA Controller  (pwa.js)
   • Service Worker registration
   • Install prompt (custom banner)
   • Update detection
   • Offline / Online toast
   ═══════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── Register Service Worker ── */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {

      /* Skip on mobile localhost — SW needs HTTPS on mobile browsers */
      const isSecure = location.protocol === 'https:';
      const isLocalhost = ['localhost', '127.0.0.1', '::1'].includes(location.hostname);
      if (!isSecure && !isLocalhost) {
        console.warn('[PWA] SW skipped: needs HTTPS');
        return;
      }

      try {
        const swBase = new URL('./', location.href).pathname;
        const reg = await navigator.serviceWorker.register(swBase + 'sw.js', { scope: swBase });
        console.log('[PWA] SW registered, scope:', reg.scope);

        /* ── Detect SW update ── */
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              showUpdateBanner();
            }
          });
        });

      } catch (err) {
        /* Silently ignore on dev/local — don't show red error in console */
        console.warn('[PWA] SW registration skipped (dev mode):', err.message || err);
      }
    });
  }

  /* ══════════════════════════════════════════════
     INSTALL PROMPT
     ══════════════════════════════════════════════ */
  let deferredPrompt = null;

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;

    /* Only show if not already installed & not dismissed recently */
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    if (!dismissed || Number(dismissed) < oneDayAgo) {
      setTimeout(showInstallBanner, 3000); // show after 3s
    }
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    removeInstallBanner();
    showToast('✅ Edu Prime installed successfully!', 'success');
  });

  /* ── Install Banner UI ── */
  function showInstallBanner() {
    if (document.getElementById('pwa-install-banner')) return;

    const banner = document.createElement('div');
    banner.id = 'pwa-install-banner';
    banner.innerHTML = `
      <div class="pwa-banner-inner">
        <img src="/icons/icon-96.png" alt="Edu Prime" class="pwa-banner-icon" onerror="this.style.display='none'"/>
        <div class="pwa-banner-text">
          <strong>Install Edu Prime</strong>
          <span>Add to home screen for faster access</span>
        </div>
        <div class="pwa-banner-actions">
          <button id="pwa-install-btn">Install</button>
          <button id="pwa-dismiss-btn">✕</button>
        </div>
      </div>
    `;

    /* Inline styles — no extra CSS file needed */
    Object.assign(banner.style, {
      position:     'fixed',
      bottom:       '80px',
      left:         '12px',
      right:        '12px',
      zIndex:       '9999',
      background:   'linear-gradient(135deg, #1a1030 0%, #0f0f1a 100%)',
      border:       '1px solid rgba(139,92,246,0.35)',
      borderRadius: '16px',
      padding:      '14px 16px',
      boxShadow:    '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(139,92,246,0.1)',
      animation:    'pwaSlideUp 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards',
      fontFamily:   'Inter, sans-serif'
    });

    /* Inject keyframe once */
    if (!document.getElementById('pwa-style')) {
      const style = document.createElement('style');
      style.id = 'pwa-style';
      style.textContent = `
        @keyframes pwaSlideUp {
          from { opacity:0; transform:translateY(20px); }
          to   { opacity:1; transform:translateY(0); }
        }
        #pwa-install-banner .pwa-banner-inner {
          display:flex; align-items:center; gap:12px;
        }
        #pwa-install-banner .pwa-banner-icon {
          width:44px; height:44px; border-radius:10px; flex-shrink:0;
        }
        #pwa-install-banner .pwa-banner-text {
          flex:1; display:flex; flex-direction:column; gap:2px;
        }
        #pwa-install-banner .pwa-banner-text strong {
          color:rgba(255,255,255,0.92); font-size:.9rem; font-weight:600;
        }
        #pwa-install-banner .pwa-banner-text span {
          color:rgba(255,255,255,0.5); font-size:.75rem;
        }
        #pwa-install-banner .pwa-banner-actions {
          display:flex; align-items:center; gap:8px; flex-shrink:0;
        }
        #pwa-install-btn {
          background:linear-gradient(135deg,#7c3aed,#5b3df0);
          color:#fff; border:none; border-radius:20px;
          padding:7px 18px; font-size:.82rem; font-weight:600;
          cursor:pointer; white-space:nowrap;
          box-shadow:0 2px 12px rgba(139,92,246,0.4);
        }
        #pwa-install-btn:hover { background:linear-gradient(135deg,#8b5cf6,#6d28d9); }
        #pwa-dismiss-btn {
          background:transparent; border:1px solid rgba(255,255,255,0.15);
          color:rgba(255,255,255,0.5); border-radius:50%;
          width:28px; height:28px; cursor:pointer; font-size:.75rem;
          display:flex; align-items:center; justify-content:center;
        }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(banner);

    document.getElementById('pwa-install-btn').addEventListener('click', async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        deferredPrompt = null;
        removeInstallBanner();
      }
    });

    document.getElementById('pwa-dismiss-btn').addEventListener('click', () => {
      localStorage.setItem('pwa-install-dismissed', String(Date.now()));
      removeInstallBanner();
    });
  }

  function removeInstallBanner() {
    document.getElementById('pwa-install-banner')?.remove();
  }

  /* ══════════════════════════════════════════════
     UPDATE BANNER
     ══════════════════════════════════════════════ */
  function showUpdateBanner() {
    if (document.getElementById('pwa-update-banner')) return;

    const banner = document.createElement('div');
    banner.id = 'pwa-update-banner';
    banner.innerHTML = `
      <span>🔄 New version available!</span>
      <button id="pwa-update-btn">Update</button>
    `;
    Object.assign(banner.style, {
      position:     'fixed',
      top:          '0',
      left:         '0',
      right:        '0',
      zIndex:       '99999',
      background:   'linear-gradient(90deg,#7c3aed,#5b3df0)',
      color:        '#fff',
      padding:      '10px 16px',
      display:      'flex',
      alignItems:   'center',
      justifyContent:'space-between',
      fontSize:     '.85rem',
      fontFamily:   'Inter, sans-serif',
      fontWeight:   '500'
    });

    document.body.appendChild(banner);

    document.getElementById('pwa-update-btn').addEventListener('click', () => {
      navigator.serviceWorker.getRegistration().then(reg => {
        reg?.waiting?.postMessage({ type: 'SKIP_WAITING' });
        window.location.reload();
      });
    });
  }

  /* ══════════════════════════════════════════════
     ONLINE / OFFLINE DETECTION
     ══════════════════════════════════════════════ */
  function showToast(message, type = 'info') {
    /* Use existing toast system if available, else create one */
    const container = document.getElementById('toastContainer') || createToastContainer();
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;

    const colors = {
      success: '#10b981',
      error:   '#ef4444',
      info:    '#8b5cf6'
    };

    Object.assign(toast.style, {
      background:   colors[type] ?? colors.info,
      color:        '#fff',
      padding:      '10px 16px',
      borderRadius: '10px',
      fontSize:     '.85rem',
      fontWeight:   '500',
      fontFamily:   'Inter, sans-serif',
      boxShadow:    '0 4px 16px rgba(0,0,0,0.3)',
      animation:    'pwaSlideUp 0.3s ease forwards',
      marginTop:    '8px'
    });

    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
  }

  function createToastContainer() {
    const el = document.createElement('div');
    el.id = 'toastContainer';
    Object.assign(el.style, {
      position:  'fixed',
      bottom:    '90px',
      right:     '16px',
      zIndex:    '99998',
      display:   'flex',
      flexDirection: 'column',
      alignItems: 'flex-end'
    });
    document.body.appendChild(el);
    return el;
  }

  window.addEventListener('offline', () => {
    showToast('📶 You are offline. Some features may not work.', 'error');
  });

  window.addEventListener('online', () => {
    showToast('✅ Back online!', 'success');
  });

})();
