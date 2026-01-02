import { registerSW } from 'virtual:pwa-register';

export function register() {
  const updateSW = registerSW({
    onNeedRefresh() {
      // Optional: Show a prompt to user
      // For now we use autoUpdate, so this might not fire unless configured otherwise
      console.log('Nueva versión disponible. Refrescando...');
    },
    onOfflineReady() {
      console.log('App lista para trabajar offline');
    },
  });
}
