import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import tailwindcss from '@tailwindcss/vite'
import path from "path"

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const base = mode === 'development' ? '/' : (env.VITE_BASE || './');

  return {
    base,
    plugins: [
      tailwindcss(),
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'icon.png'],
        manifest: {
          name: 'Farmaplus - Gestión de Inventario',
          short_name: 'Farmaplus',
          description: 'Sistema de gestión de inventarios para Farmaplus. Gestiona inventarios cíclicos, importa datos, genera reportes y más.',
          theme_color: '#ffffff',
          background_color: '#ffffff',
          display: 'standalone',
          orientation: 'portrait-primary',
          scope: base,
          start_url: base,
          lang: 'es-ES',
          icons: [
            {
              src: 'icon.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: 'icon.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: 'icon.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'maskable'
            },
            {
              src: 'icon.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable'
            }
          ],
          shortcuts: [
            {
              name: 'Stock',
              url: `${base}stock`,
              icons: [{ src: 'icon.png', sizes: '192x192' }]
            },
            {
              name: 'Inventarios',
              url: `${base}cyclic-inventory`,
              icons: [{ src: 'icon.png', sizes: '192x192' }]
            }
          ],
          categories: ['business', 'productivity']
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          globIgnores: ['**/bg.svg', '**/default_products.xlsx'],
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB limit for regular assets
          navigateFallback: 'index.html',
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
                }
              }
            },
            {
              urlPattern: /^https:\/\/(.*\.supabase\.co|supabase\.halu\.com\.ar)\/.*/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'supabase-cache',
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24 // 24 hours
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
      dedupe: ['react', 'react-dom']
    },
    server: {
      watch: {
        ignored: ['**/android/**', '**/dist/**']
      }
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            'ui-vendor': [
              '@base-ui-components/react',
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
      entries: [
        'index.html',
        '!android/**',
        '!dist/**',
      ],
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
          'top-level-await': false
        }
      }
    }
  };
});
