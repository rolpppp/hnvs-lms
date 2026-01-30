import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa';

const disableHmr = process.env.DISABLE_HMR === '1' || process.env.DISABLE_HMR === 'true';

export default defineConfig({
  // Optionally disable HMR websocket (useful for testing without WS)
  server: disableHmr ? { hmr: false } : undefined,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'HNVS Learning System',
        short_name: 'HNVS LMS',
        description: 'Offline-First Learning Management System for Hilongos National Vocational School',
        theme_color: '#1e3a8a',
        background_color: '#f8fafc',
        display: 'standalone', // <--- Hides the browser URL bar
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/src/assets/logo.png',
            sizes: '192x192 512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        // Caches the "App Shell" (HTML, CSS, JS) so it loads instantly offline
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        
        // Don't cache API calls to Supabase (we handle that manually with Dexie/useSync)
        runtimeCaching: [
            // Example: If you had external fonts, you could cache them here
        ]
      }
    })
  ],
});