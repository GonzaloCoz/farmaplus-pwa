import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { VitePWA } from 'vite-plugin-pwa'
import path from "path"

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'logo.png', 'farmaplus-logo.svg'],
      manifest: {
        short_name: "Farmaplus",
        name: "Farmaplus - Gestión de Inventario",
        description: "Sistema de gestión de inventarios para Farmaplus. Gestiona inventarios cíclicos, importa datos, genera reportes y más.",
        icons: [
          {
            src: "logo.png",
            type: "image/png",
            sizes: "192x192",
            purpose: "any maskable"
          },
          {
            src: "logo512.png",
            type: "image/png",
            sizes: "512x512",
            purpose: "any maskable"
          }
        ],
        start_url: "/farmaplus-pwa/",
        display: "standalone",
        orientation: "portrait-primary",
        theme_color: "#ffffff",
        background_color: "#ffffff",
        scope: "/farmaplus-pwa/",
        lang: "es-ES"
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365
              },
              cacheableResponse: {
                statuses: [0, 200]
              },
            }
          },
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 5 // 5 minutes
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-select',
            '@radix-ui/react-tabs',
          ],
          'supabase': ['@supabase/supabase-js'],
          'charts': ['recharts'],
          'utils': ['date-fns', 'clsx', 'tailwind-merge'],
        },
      },
      onwarn(warning, warn) {
        // Suppress circular dependency warnings - they're often false positives
        if (warning.code === 'CIRCULAR_DEPENDENCY') return;
        // Suppress "this" keyword warnings in class constructors
        if (warning.code === 'THIS_IS_UNDEFINED') return;
        warn(warning);
      }
    },
    chunkSizeWarningLimit: 1000,
    minify: 'esbuild',
    cssCodeSplit: true,
    sourcemap: false,
    target: 'es2015',
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@supabase/supabase-js',
      'react-window',
      'react-virtualized-auto-sizer',
    ],
    exclude: ['xlsx'], // xlsx causes Rollup issues, load dynamically instead
    esbuildOptions: {
      target: 'es2020',
      supported: {
        'top-level-await': true
      }
    }
  },
})
