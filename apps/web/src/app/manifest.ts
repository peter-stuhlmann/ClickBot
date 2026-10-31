import type { MetadataRoute } from 'next';

/** Web app manifest: name and icons when the app is added to a home screen (Android, desktop). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Click-Bot',
    short_name: 'Click-Bot',
    description: 'Automatisierte Tests für eigene Websites und Kundenseiten.',
    lang: 'de',
    start_url: '/',
    display: 'standalone',
    background_color: '#f6f7f9',
    theme_color: '#0f172a',
    // Made by `pnpm --filter @click-bot/web icons` (scripts/make-icons.mjs).
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
