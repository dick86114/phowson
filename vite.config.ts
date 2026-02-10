import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        allowedHosts: true,
        proxy: {
          '/media': {
            target: 'http://127.0.0.1:3001',
            changeOrigin: true,
          },
          '/auth': { target: 'http://127.0.0.1:3001', changeOrigin: true },
          '/me': { target: 'http://127.0.0.1:3001', changeOrigin: true },
          '/categories': { target: 'http://127.0.0.1:3001', changeOrigin: true },
          '/photos': { target: 'http://127.0.0.1:3001', changeOrigin: true },
          '/stats': { target: 'http://127.0.0.1:3001', changeOrigin: true },
          '/users': { target: 'http://127.0.0.1:3001', changeOrigin: true },
          '/site-settings': { target: 'http://127.0.0.1:3001', changeOrigin: true },
          '/ai': { target: 'http://127.0.0.1:3001', changeOrigin: true },
          '/activity': { target: 'http://127.0.0.1:3001', changeOrigin: true },
          '/health': { target: 'http://127.0.0.1:3001', changeOrigin: true },
          '/gamification': { target: 'http://127.0.0.1:3001', changeOrigin: true },
          '/uploads': { target: 'http://127.0.0.1:3001', changeOrigin: true },
          '/admin': {
            target: 'http://127.0.0.1:3001',
            changeOrigin: true,
            bypass: (req) => {
              if (req.headers.accept && req.headers.accept.includes('text/html')) {
                return false;
              }
            }
          }
        }
      },
      plugins: [
        react(),
        VitePWA({
          registerType: 'autoUpdate',
          includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
          manifest: {
            name: 'Phowson - 浮生',
            short_name: 'Phowson',
            description: 'AI 驱动的智能摄影日志',
            theme_color: '#3b82f6',
            background_color: '#ffffff',
            display: 'standalone',
            icons: [
              {
                src: 'pwa-192x192.png',
                sizes: '192x192',
                type: 'image/png'
              },
              {
                src: 'pwa-512x512.png',
                sizes: '512x512',
                type: 'image/png'
              },
              {
                src: 'pwa-512x512.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'any maskable'
              }
            ]
          },
          workbox: {
            maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
            globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
            cleanupOutdatedCaches: true,
            clientsClaim: true,
            skipWaiting: true,
            runtimeCaching: [
              {
                urlPattern: /^https:\/\/.*\.s3\..*\.amazonaws\.com\/.*/i,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'photo-cache',
                  expiration: {
                    maxEntries: 100,
                    maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
                  },
                  cacheableResponse: {
                    statuses: [0, 200],
                  },
                },
              },
              {
                urlPattern: /^https:\/\/ui-avatars\.com\/.*/i,
                handler: 'StaleWhileRevalidate',
                options: {
                  cacheName: 'avatar-cache',
                },
              },
            ],
          },
        }),
      ],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    'vendor-react': ['react', 'react-dom', 'react-router-dom'],
                    'vendor-ui': ['lucide-react', 'react-hot-toast', 'react-hook-form', 'react-zoom-pan-pinch'],
                    'vendor-maps': ['leaflet', 'react-leaflet'],
                    'vendor-utils': ['@tanstack/react-query', 'html2canvas', 'jspdf', 'qrcode.react']
                }
            }
        }
      }
    };
});
