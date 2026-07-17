import { registerSW } from 'virtual:pwa-register';

export function register() {
  // ponytail: reload on new service worker activation to ensure latest bundle loads
  if ('serviceWorker' in navigator) {
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  }

  const updateSW = registerSW({
    onNeedRefresh() {
      console.log('Nueva versión disponible. Refrescando...');
      updateSW(true);
    },
    onOfflineReady() {
      console.log('App lista para trabajar offline');
    },
  });
}
