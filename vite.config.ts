import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'url';

import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(), 
        tailwindcss(), 
        VitePWA({
          registerType: 'autoUpdate',
          injectRegister: 'auto',
          devOptions: {
            enabled: true // Enable for testing
          },
          workbox: {
            globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,json}'],
            cleanupOutdatedCaches: true,
            clientsClaim: true,
            skipWaiting: true,
            maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10MB
          },
          manifest: {
            name: 'Smart Orders Manager',
            short_name: 'SmartOrder',
            description: 'نظام إدارة المتاجر المتكامل - يعمل بدون إنترنت',
            theme_color: '#4f46e5',
            background_color: '#ffffff',
            display: 'standalone',
            start_url: '/',
            icons: [
              {
                src: 'https://cdn-icons-png.flaticon.com/512/3061/3061264.png',
                sizes: '192x192',
                type: 'image/png'
              },
              {
                src: 'https://cdn-icons-png.flaticon.com/512/3061/3061264.png',
                sizes: '512x512',
                type: 'image/png'
              }
            ]
          }
        })
      ],
      define: {
        // Define process.env as an empty object first to prevent "process is not defined"
        'process.env': {},
        // Inject specific keys
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY || ''),
      },
      resolve: {
        alias: {
          '@': fileURLToPath(new URL('./src', import.meta.url)),
        }
      }
    };
});