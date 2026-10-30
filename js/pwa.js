/**
 * PWA Service Worker & Install Prompt Controller (PRD F-54)
 */

(function () {
  let deferredPrompt = null;

  window.addEventListener('beforeinstallprompt', (e) => {
    // 기본 브라우저 배너 지연
    e.preventDefault();
    deferredPrompt = e;

    // 설치 유도 버튼 표시 가능 시 처리
    const pwaBtn = document.getElementById('pwa-install-btn');
    if (pwaBtn) {
      pwaBtn.style.display = 'inline-flex';
      pwaBtn.addEventListener('click', async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          pwaBtn.style.display = 'none';
        }
        deferredPrompt = null;
      });
    }
  });

  // 오프라인/온라인 상태 감지
  window.addEventListener('online', () => {
    updateOnlineBadge(true);
  });
  window.addEventListener('offline', () => {
    updateOnlineBadge(false);
  });

  function updateOnlineBadge(isOnline) {
    const badge = document.getElementById('network-status-badge');
    if (badge) {
      if (isOnline) {
        badge.textContent = 'ONLINE';
        badge.className = 'status-pill status-online';
      } else {
        badge.textContent = 'OFFLINE (로컬 저장 중)';
        badge.className = 'status-pill status-offline';
      }
    }
  }

  // 서비스 워커 등록
  if ('serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.hostname === 'localhost')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('./sw.js')
        .then((reg) => {
          console.log('PWA ServiceWorker registered:', reg.scope);
        })
        .catch((err) => {
          console.warn('PWA ServiceWorker registration failed:', err);
        });
    });
  }
})();

