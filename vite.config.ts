// Vite root config — Svelte shell + offline-first PWA (W47 shell-only:
// manifest + service worker; no install/UX beyond the manifest).
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Kaquarium',
        short_name: 'Kaquarium',
        start_url: '.',
        display: 'standalone',
        background_color: '#0b1622',
        theme_color: '#0b1622',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,json}'],
      },
    }),
  ],
});
