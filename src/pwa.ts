/**
 * PWA registration and programmatic update.
 * Registers the service worker so updates can be applied; exports a function
 * to trigger an update check and reload when a new version is active.
 */

import logger from './utils/logger';

let updateSW: ((reloadPage?: boolean) => Promise<void>) | undefined;

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  import('virtual:pwa-register')
    .then(({ registerSW }) => {
      updateSW = registerSW({
        immediate: true,
        onNeedRefresh() {
          logger.info('[PWA] New content available');
        },
        onOfflineReady() {
          logger.info('[PWA] App ready to work offline');
        },
      });
      logger.info('[PWA] Service worker registration enabled');
    })
    .catch((err) => {
      logger.warn('[PWA] Could not load PWA register', { error: String(err) });
    });
}

/**
 * Check for a new service worker version, install it, and reload when active.
 * Call this when FORCE_UPDATE is received so the display downloads and applies the latest app version.
 */
export async function checkAndApplyUpdate(): Promise<void> {
  if (typeof updateSW === 'function') {
    await updateSW(true);
    return;
  }
  if (!('serviceWorker' in navigator)) {
    logger.warn('[PWA] Service workers not supported');
    return;
  }
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) {
      logger.warn('[PWA] No service worker registration');
      return;
    }
    await reg.update();
    navigator.serviceWorker.addEventListener(
      'controllerchange',
      () => {
        logger.info('[PWA] New controller active, reloading');
        window.location.reload();
      },
      { once: true },
    );
  } catch (err) {
    logger.error('[PWA] Update check failed', { error: String(err) });
  }
}
