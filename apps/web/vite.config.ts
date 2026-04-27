import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'Hero Syndrome',
        short_name: 'Hero Syndrome',
        description: 'An adaptive score, generated live from your phone’s signals.',
        theme_color: '#F4EFE3',
        background_color: '#1B1B19',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/, /^\/episode\//, /^\/song\//, /^\/preludes\//],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => /\/preludes\/manifest\.json$/.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'preludes-manifest',
              expiration: { maxEntries: 1, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
          {
            urlPattern: ({ url }) => /\/preludes\/[^/]+\.mp3$/.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'preludes-audio',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 30 },
              rangeRequests: true,
            },
          },
          {
            urlPattern: ({ url }) =>
              /\/song\/[^/]+\/[^/]+$/.test(url.pathname) || /\/episode\/[^/]+\/song\/[^/]+$/.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'songs-audio',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
              rangeRequests: true,
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
