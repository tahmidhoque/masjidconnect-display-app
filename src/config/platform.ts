/**
 * Platform detection for Pi vs hosted (Vercel, Android TV WebView).
 *
 * The deploy server (deploy/server.mjs) runs on the Pi and provides /internal/*
 * endpoints. When the app is served from Vercel or any other origin, those
 * endpoints do not exist. Use isPiPlatform to skip Pi-specific behaviour.
 */
export const isPiPlatform =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
