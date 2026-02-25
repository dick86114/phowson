import path from 'path';
import fs from 'fs';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const isProd = mode === 'production';
    const privateWebCandidate = path.resolve(process.cwd(), 'private/web/plugin.tsx');
    const privateWebFallback = path.resolve(process.cwd(), 'private-stubs/web.tsx');
    const privateWebDisabled =
      String(env.VITE_PRIVATE_WEB_DISABLED || '').trim().toLowerCase() === 'true' ||
      String(env.VITE_PRIVATE_WEB_DISABLED || '').trim() === '1';
    const privateWebModule = String(env.PRIVATE_WEB_MODULE || '').trim();
    const privateWebPath = privateWebDisabled
      ? privateWebFallback
      : privateWebModule || (fs.existsSync(privateWebCandidate) ? privateWebCandidate : privateWebFallback);
    const proxyTarget = String(env.VITE_PROXY_TARGET || 'http://127.0.0.1:2615').trim();
    
    return {
      esbuild: {
        drop: isProd ? ['console', 'debugger'] : [],
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
          '@private/web': privateWebPath,
        },
      },
      server: {
        port: 2614,
        host: '0.0.0.0',
        allowedHosts: true,
        proxy: {
          '/media': {
            target: proxyTarget,
            changeOrigin: true,
          },
          '/auth': { target: proxyTarget, changeOrigin: true },
          '/me': { target: proxyTarget, changeOrigin: true },
          '/categories': { target: proxyTarget, changeOrigin: true },
          '/photos': { target: proxyTarget, changeOrigin: true },
          '/stats': { target: proxyTarget, changeOrigin: true },
          '/users': { target: proxyTarget, changeOrigin: true },
          '/roles': { target: proxyTarget, changeOrigin: true },
          '/site-settings': { target: proxyTarget, changeOrigin: true },
          '/ai': { target: proxyTarget, changeOrigin: true },
          '/activity': { target: proxyTarget, changeOrigin: true },
          '/geocode': { target: proxyTarget, changeOrigin: true },
          '/health': { target: proxyTarget, changeOrigin: true },
          '/gamification': { target: proxyTarget, changeOrigin: true },
          '/uploads': { target: proxyTarget, changeOrigin: true },
          '/admin': {
            target: proxyTarget,
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
            maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
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
      build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    'vendor-react': ['react', 'react-dom', 'react-router-dom'],
                    'vendor-ui': ['framer-motion', 'lucide-react'],
                    'vendor-maps': ['leaflet', 'react-leaflet'],
                }
            }
        }
      }
    };
});
