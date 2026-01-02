import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { VitePWA } from 'vite-plugin-pwa'
import path from "path"

// https://vitejs.dev/config/
export default defineConfig({
  // La base debe coincidir con el nombre de tu repositorio en GitHub
  base: "/farmaplus-pwa/",
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
                maxAgeSeconds: 60 * 60 * 24 * 365 // <== 365 days
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
                maxAgeSeconds: 60 * 60 * 24 * 365 // <== 365 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              },
            }
          },
          // Cache Supabase API requests (StaleWhileRevalidate)
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'supabase-api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 // 1 day
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
    // Code splitting para optimizar carga
    rollupOptions: {
      output: {
        // manualChunks: {
        //   // Separar React y dependencias core
        //   'react-vendor': ['react', 'react-dom', 'react-router-dom'],
        //   // Componentes UI de Radix
        //   'ui-vendor': [
        //     '@radix-ui/react-dialog',
        //     '@radix-ui/react-dropdown-menu',
        //     '@radix-ui/react-popover',
        //     '@radix-ui/react-select',
        //     '@radix-ui/react-tabs',
        //     '@radix-ui/react-toast',
        //     '@radix-ui/react-tooltip',
        //     '@radix-ui/react-accordion',
        //     '@radix-ui/react-alert-dialog',
        //     '@radix-ui/react-avatar',
        //     '@radix-ui/react-checkbox',
        //     '@radix-ui/react-label',
        //     '@radix-ui/react-radio-group',
        //     '@radix-ui/react-scroll-area',
        //     '@radix-ui/react-separator',
        //     '@radix-ui/react-slider',
        //     '@radix-ui/react-switch',
        //   ],
        //   // Gráficos (solo se carga en Dashboard)
        //   'chart-vendor': ['recharts'],
        //   // Formularios
        //   'form-vendor': ['react-hook-form', 'zod', '@hookform/resolvers'],
        //   // Utilidades
        //   'utils': ['date-fns', 'clsx', 'tailwind-merge'],
        //   // Animaciones
        //   'animation': ['framer-motion'],
        //   // Scanner y utilidades específicas
        //   'scanner': ['html5-qrcode'],
        //   // Excel
        //   'excel': ['xlsx'],
        // },
      },
    },
    // Optimización de chunks
    chunkSizeWarningLimit: 500,
    // Minificación agresiva
    // Minificación por defecto (esbuild)
    minify: false,
    // Optimizar CSS
    cssCodeSplit: true,
    // Source maps solo para errores
    sourcemap: false,
  },
  // Optimización de dependencias
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
    ],
  },
})
