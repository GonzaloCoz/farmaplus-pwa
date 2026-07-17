// vite.config.ts
import { defineConfig, loadEnv } from "file:///C:/Proyectos/farmaplus-pwa-main/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Proyectos/farmaplus-pwa-main/node_modules/@vitejs/plugin-react/dist/index.js";
import { VitePWA } from "file:///C:/Proyectos/farmaplus-pwa-main/node_modules/vite-plugin-pwa/dist/index.js";
import tailwindcss from "file:///C:/Proyectos/farmaplus-pwa-main/node_modules/@tailwindcss/vite/dist/index.mjs";
import path from "path";
var __vite_injected_original_dirname = "C:\\Proyectos\\farmaplus-pwa-main";
var vite_config_default = defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const base = mode === "development" ? "/" : env.VITE_BASE || "./";
  return {
    base,
    plugins: [
      tailwindcss(),
      react(),
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["favicon.ico", "icon.png"],
        manifest: {
          name: "Farmaplus - Gesti\xF3n de Inventario",
          short_name: "Farmaplus",
          description: "Sistema de gesti\xF3n de inventarios para Farmaplus. Gestiona inventarios c\xEDclicos, importa datos, genera reportes y m\xE1s.",
          theme_color: "#ffffff",
          background_color: "#ffffff",
          display: "standalone",
          orientation: "portrait-primary",
          scope: base,
          start_url: base,
          lang: "es-ES",
          icons: [
            {
              src: "icon.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "any"
            },
            {
              src: "icon.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any"
            },
            {
              src: "icon.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "maskable"
            },
            {
              src: "icon.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable"
            }
          ],
          shortcuts: [
            {
              name: "Stock",
              url: `${base}stock`,
              icons: [{ src: "icon.png", sizes: "192x192" }]
            },
            {
              name: "Inventarios",
              url: `${base}cyclic-inventory`,
              icons: [{ src: "icon.png", sizes: "192x192" }]
            }
          ],
          categories: ["business", "productivity"]
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
          globIgnores: ["**/bg.svg", "**/default_products.xlsx"],
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          // 5MB limit for regular assets
          navigateFallback: "index.html",
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: "CacheFirst",
              options: {
                cacheName: "google-fonts-cache",
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
              handler: "CacheFirst",
              options: {
                cacheName: "gstatic-fonts-cache",
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
              handler: "NetworkFirst",
              options: {
                cacheName: "supabase-cache",
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24
                  // 24 hours
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
        "@": path.resolve(__vite_injected_original_dirname, "./src")
      },
      dedupe: ["react", "react-dom"]
    },
    server: {
      watch: {
        ignored: ["**/android/**", "**/dist/**"]
      }
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            "react-vendor": ["react", "react-dom", "react-router-dom"],
            "ui-vendor": [
              "@base-ui-components/react"
            ],
            "supabase": ["@supabase/supabase-js"],
            "charts": ["recharts"],
            "utils": ["date-fns", "clsx", "tailwind-merge"]
          }
        },
        onwarn(warning, warn) {
          if (warning.code === "CIRCULAR_DEPENDENCY") return;
          if (warning.code === "THIS_IS_UNDEFINED") return;
          warn(warning);
        }
      },
      chunkSizeWarningLimit: 1e3,
      minify: "esbuild",
      cssCodeSplit: true,
      sourcemap: false,
      target: "es2015"
    },
    optimizeDeps: {
      entries: [
        "index.html",
        "!android/**",
        "!dist/**"
      ],
      include: [
        "react",
        "react-dom",
        "react-router-dom",
        "@supabase/supabase-js",
        "react-window",
        "react-virtualized-auto-sizer"
      ],
      exclude: ["xlsx"],
      // xlsx causes Rollup issues, load dynamically instead
      esbuildOptions: {
        target: "es2020",
        supported: {
          "top-level-await": false
        }
      }
    }
  };
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxQcm95ZWN0b3NcXFxcZmFybWFwbHVzLXB3YS1tYWluXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJDOlxcXFxQcm95ZWN0b3NcXFxcZmFybWFwbHVzLXB3YS1tYWluXFxcXHZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9DOi9Qcm95ZWN0b3MvZmFybWFwbHVzLXB3YS1tYWluL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnLCBsb2FkRW52IH0gZnJvbSAndml0ZSdcclxuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0J1xyXG5pbXBvcnQgeyBWaXRlUFdBIH0gZnJvbSAndml0ZS1wbHVnaW4tcHdhJ1xyXG5pbXBvcnQgdGFpbHdpbmRjc3MgZnJvbSAnQHRhaWx3aW5kY3NzL3ZpdGUnXHJcbmltcG9ydCBwYXRoIGZyb20gXCJwYXRoXCJcclxuXHJcbi8vIGh0dHBzOi8vdml0ZWpzLmRldi9jb25maWcvXHJcbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZygoeyBtb2RlIH0pID0+IHtcclxuICBjb25zdCBlbnYgPSBsb2FkRW52KG1vZGUsIHByb2Nlc3MuY3dkKCksICcnKTtcclxuICBjb25zdCBiYXNlID0gbW9kZSA9PT0gJ2RldmVsb3BtZW50JyA/ICcvJyA6IChlbnYuVklURV9CQVNFIHx8ICcuLycpO1xyXG5cclxuICByZXR1cm4ge1xyXG4gICAgYmFzZSxcclxuICAgIHBsdWdpbnM6IFtcclxuICAgICAgdGFpbHdpbmRjc3MoKSxcclxuICAgICAgcmVhY3QoKSxcclxuICAgICAgVml0ZVBXQSh7XHJcbiAgICAgICAgcmVnaXN0ZXJUeXBlOiAnYXV0b1VwZGF0ZScsXHJcbiAgICAgICAgaW5jbHVkZUFzc2V0czogWydmYXZpY29uLmljbycsICdpY29uLnBuZyddLFxyXG4gICAgICAgIG1hbmlmZXN0OiB7XHJcbiAgICAgICAgICBuYW1lOiAnRmFybWFwbHVzIC0gR2VzdGlcdTAwRjNuIGRlIEludmVudGFyaW8nLFxyXG4gICAgICAgICAgc2hvcnRfbmFtZTogJ0Zhcm1hcGx1cycsXHJcbiAgICAgICAgICBkZXNjcmlwdGlvbjogJ1Npc3RlbWEgZGUgZ2VzdGlcdTAwRjNuIGRlIGludmVudGFyaW9zIHBhcmEgRmFybWFwbHVzLiBHZXN0aW9uYSBpbnZlbnRhcmlvcyBjXHUwMEVEY2xpY29zLCBpbXBvcnRhIGRhdG9zLCBnZW5lcmEgcmVwb3J0ZXMgeSBtXHUwMEUxcy4nLFxyXG4gICAgICAgICAgdGhlbWVfY29sb3I6ICcjZmZmZmZmJyxcclxuICAgICAgICAgIGJhY2tncm91bmRfY29sb3I6ICcjZmZmZmZmJyxcclxuICAgICAgICAgIGRpc3BsYXk6ICdzdGFuZGFsb25lJyxcclxuICAgICAgICAgIG9yaWVudGF0aW9uOiAncG9ydHJhaXQtcHJpbWFyeScsXHJcbiAgICAgICAgICBzY29wZTogYmFzZSxcclxuICAgICAgICAgIHN0YXJ0X3VybDogYmFzZSxcclxuICAgICAgICAgIGxhbmc6ICdlcy1FUycsXHJcbiAgICAgICAgICBpY29uczogW1xyXG4gICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgc3JjOiAnaWNvbi5wbmcnLFxyXG4gICAgICAgICAgICAgIHNpemVzOiAnMTkyeDE5MicsXHJcbiAgICAgICAgICAgICAgdHlwZTogJ2ltYWdlL3BuZycsXHJcbiAgICAgICAgICAgICAgcHVycG9zZTogJ2FueSdcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgIHNyYzogJ2ljb24ucG5nJyxcclxuICAgICAgICAgICAgICBzaXplczogJzUxMng1MTInLFxyXG4gICAgICAgICAgICAgIHR5cGU6ICdpbWFnZS9wbmcnLFxyXG4gICAgICAgICAgICAgIHB1cnBvc2U6ICdhbnknXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICBzcmM6ICdpY29uLnBuZycsXHJcbiAgICAgICAgICAgICAgc2l6ZXM6ICcxOTJ4MTkyJyxcclxuICAgICAgICAgICAgICB0eXBlOiAnaW1hZ2UvcG5nJyxcclxuICAgICAgICAgICAgICBwdXJwb3NlOiAnbWFza2FibGUnXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICBzcmM6ICdpY29uLnBuZycsXHJcbiAgICAgICAgICAgICAgc2l6ZXM6ICc1MTJ4NTEyJyxcclxuICAgICAgICAgICAgICB0eXBlOiAnaW1hZ2UvcG5nJyxcclxuICAgICAgICAgICAgICBwdXJwb3NlOiAnbWFza2FibGUnXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIF0sXHJcbiAgICAgICAgICBzaG9ydGN1dHM6IFtcclxuICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgIG5hbWU6ICdTdG9jaycsXHJcbiAgICAgICAgICAgICAgdXJsOiBgJHtiYXNlfXN0b2NrYCxcclxuICAgICAgICAgICAgICBpY29uczogW3sgc3JjOiAnaWNvbi5wbmcnLCBzaXplczogJzE5MngxOTInIH1dXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICBuYW1lOiAnSW52ZW50YXJpb3MnLFxyXG4gICAgICAgICAgICAgIHVybDogYCR7YmFzZX1jeWNsaWMtaW52ZW50b3J5YCxcclxuICAgICAgICAgICAgICBpY29uczogW3sgc3JjOiAnaWNvbi5wbmcnLCBzaXplczogJzE5MngxOTInIH1dXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIF0sXHJcbiAgICAgICAgICBjYXRlZ29yaWVzOiBbJ2J1c2luZXNzJywgJ3Byb2R1Y3Rpdml0eSddXHJcbiAgICAgICAgfSxcclxuICAgICAgICB3b3JrYm94OiB7XHJcbiAgICAgICAgICBnbG9iUGF0dGVybnM6IFsnKiovKi57anMsY3NzLGh0bWwsaWNvLHBuZyxzdmcsd29mZjJ9J10sXHJcbiAgICAgICAgICBnbG9iSWdub3JlczogWycqKi9iZy5zdmcnLCAnKiovZGVmYXVsdF9wcm9kdWN0cy54bHN4J10sXHJcbiAgICAgICAgICBtYXhpbXVtRmlsZVNpemVUb0NhY2hlSW5CeXRlczogNSAqIDEwMjQgKiAxMDI0LCAvLyA1TUIgbGltaXQgZm9yIHJlZ3VsYXIgYXNzZXRzXHJcbiAgICAgICAgICBuYXZpZ2F0ZUZhbGxiYWNrOiAnaW5kZXguaHRtbCcsXHJcbiAgICAgICAgICBydW50aW1lQ2FjaGluZzogW1xyXG4gICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgdXJsUGF0dGVybjogL15odHRwczpcXC9cXC9mb250c1xcLmdvb2dsZWFwaXNcXC5jb21cXC8uKi9pLFxyXG4gICAgICAgICAgICAgIGhhbmRsZXI6ICdDYWNoZUZpcnN0JyxcclxuICAgICAgICAgICAgICBvcHRpb25zOiB7XHJcbiAgICAgICAgICAgICAgICBjYWNoZU5hbWU6ICdnb29nbGUtZm9udHMtY2FjaGUnLFxyXG4gICAgICAgICAgICAgICAgZXhwaXJhdGlvbjoge1xyXG4gICAgICAgICAgICAgICAgICBtYXhFbnRyaWVzOiAxMCxcclxuICAgICAgICAgICAgICAgICAgbWF4QWdlU2Vjb25kczogNjAgKiA2MCAqIDI0ICogMzY1XHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgY2FjaGVhYmxlUmVzcG9uc2U6IHtcclxuICAgICAgICAgICAgICAgICAgc3RhdHVzZXM6IFswLCAyMDBdXHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgdXJsUGF0dGVybjogL15odHRwczpcXC9cXC9mb250c1xcLmdzdGF0aWNcXC5jb21cXC8uKi9pLFxyXG4gICAgICAgICAgICAgIGhhbmRsZXI6ICdDYWNoZUZpcnN0JyxcclxuICAgICAgICAgICAgICBvcHRpb25zOiB7XHJcbiAgICAgICAgICAgICAgICBjYWNoZU5hbWU6ICdnc3RhdGljLWZvbnRzLWNhY2hlJyxcclxuICAgICAgICAgICAgICAgIGV4cGlyYXRpb246IHtcclxuICAgICAgICAgICAgICAgICAgbWF4RW50cmllczogMTAsXHJcbiAgICAgICAgICAgICAgICAgIG1heEFnZVNlY29uZHM6IDYwICogNjAgKiAyNCAqIDM2NVxyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIGNhY2hlYWJsZVJlc3BvbnNlOiB7XHJcbiAgICAgICAgICAgICAgICAgIHN0YXR1c2VzOiBbMCwgMjAwXVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgIHVybFBhdHRlcm46IC9eaHR0cHM6XFwvXFwvKC4qXFwuc3VwYWJhc2VcXC5jb3xzdXBhYmFzZVxcLmhhbHVcXC5jb21cXC5hcilcXC8uKi9pLFxyXG4gICAgICAgICAgICAgIGhhbmRsZXI6ICdOZXR3b3JrRmlyc3QnLFxyXG4gICAgICAgICAgICAgIG9wdGlvbnM6IHtcclxuICAgICAgICAgICAgICAgIGNhY2hlTmFtZTogJ3N1cGFiYXNlLWNhY2hlJyxcclxuICAgICAgICAgICAgICAgIGV4cGlyYXRpb246IHtcclxuICAgICAgICAgICAgICAgICAgbWF4RW50cmllczogMTAwLFxyXG4gICAgICAgICAgICAgICAgICBtYXhBZ2VTZWNvbmRzOiA2MCAqIDYwICogMjQgLy8gMjQgaG91cnNcclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICBjYWNoZWFibGVSZXNwb25zZToge1xyXG4gICAgICAgICAgICAgICAgICBzdGF0dXNlczogWzAsIDIwMF1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIF1cclxuICAgICAgICB9XHJcbiAgICAgIH0pXHJcbiAgICBdLFxyXG4gICAgcmVzb2x2ZToge1xyXG4gICAgICBhbGlhczoge1xyXG4gICAgICAgIFwiQFwiOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcIi4vc3JjXCIpLFxyXG4gICAgICB9LFxyXG4gICAgICBkZWR1cGU6IFsncmVhY3QnLCAncmVhY3QtZG9tJ11cclxuICAgIH0sXHJcbiAgICBzZXJ2ZXI6IHtcclxuICAgICAgd2F0Y2g6IHtcclxuICAgICAgICBpZ25vcmVkOiBbJyoqL2FuZHJvaWQvKionLCAnKiovZGlzdC8qKiddXHJcbiAgICAgIH1cclxuICAgIH0sXHJcbiAgICBidWlsZDoge1xyXG4gICAgICByb2xsdXBPcHRpb25zOiB7XHJcbiAgICAgICAgb3V0cHV0OiB7XHJcbiAgICAgICAgICBtYW51YWxDaHVua3M6IHtcclxuICAgICAgICAgICAgJ3JlYWN0LXZlbmRvcic6IFsncmVhY3QnLCAncmVhY3QtZG9tJywgJ3JlYWN0LXJvdXRlci1kb20nXSxcclxuICAgICAgICAgICAgJ3VpLXZlbmRvcic6IFtcclxuICAgICAgICAgICAgICAnQGJhc2UtdWktY29tcG9uZW50cy9yZWFjdCcsXHJcbiAgICAgICAgICAgIF0sXHJcbiAgICAgICAgICAgICdzdXBhYmFzZSc6IFsnQHN1cGFiYXNlL3N1cGFiYXNlLWpzJ10sXHJcbiAgICAgICAgICAgICdjaGFydHMnOiBbJ3JlY2hhcnRzJ10sXHJcbiAgICAgICAgICAgICd1dGlscyc6IFsnZGF0ZS1mbnMnLCAnY2xzeCcsICd0YWlsd2luZC1tZXJnZSddLFxyXG4gICAgICAgICAgfSxcclxuICAgICAgICB9LFxyXG4gICAgICAgIG9ud2Fybih3YXJuaW5nLCB3YXJuKSB7XHJcbiAgICAgICAgICAvLyBTdXBwcmVzcyBjaXJjdWxhciBkZXBlbmRlbmN5IHdhcm5pbmdzIC0gdGhleSdyZSBvZnRlbiBmYWxzZSBwb3NpdGl2ZXNcclxuICAgICAgICAgIGlmICh3YXJuaW5nLmNvZGUgPT09ICdDSVJDVUxBUl9ERVBFTkRFTkNZJykgcmV0dXJuO1xyXG4gICAgICAgICAgLy8gU3VwcHJlc3MgXCJ0aGlzXCIga2V5d29yZCB3YXJuaW5ncyBpbiBjbGFzcyBjb25zdHJ1Y3RvcnNcclxuICAgICAgICAgIGlmICh3YXJuaW5nLmNvZGUgPT09ICdUSElTX0lTX1VOREVGSU5FRCcpIHJldHVybjtcclxuICAgICAgICAgIHdhcm4od2FybmluZyk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9LFxyXG4gICAgICBjaHVua1NpemVXYXJuaW5nTGltaXQ6IDEwMDAsXHJcbiAgICAgIG1pbmlmeTogJ2VzYnVpbGQnLFxyXG4gICAgICBjc3NDb2RlU3BsaXQ6IHRydWUsXHJcbiAgICAgIHNvdXJjZW1hcDogZmFsc2UsXHJcbiAgICAgIHRhcmdldDogJ2VzMjAxNScsXHJcbiAgICB9LFxyXG4gICAgb3B0aW1pemVEZXBzOiB7XHJcbiAgICAgIGVudHJpZXM6IFtcclxuICAgICAgICAnaW5kZXguaHRtbCcsXHJcbiAgICAgICAgJyFhbmRyb2lkLyoqJyxcclxuICAgICAgICAnIWRpc3QvKionLFxyXG4gICAgICBdLFxyXG4gICAgICBpbmNsdWRlOiBbXHJcbiAgICAgICAgJ3JlYWN0JyxcclxuICAgICAgICAncmVhY3QtZG9tJyxcclxuICAgICAgICAncmVhY3Qtcm91dGVyLWRvbScsXHJcbiAgICAgICAgJ0BzdXBhYmFzZS9zdXBhYmFzZS1qcycsXHJcbiAgICAgICAgJ3JlYWN0LXdpbmRvdycsXHJcbiAgICAgICAgJ3JlYWN0LXZpcnR1YWxpemVkLWF1dG8tc2l6ZXInLFxyXG4gICAgICBdLFxyXG4gICAgICBleGNsdWRlOiBbJ3hsc3gnXSwgLy8geGxzeCBjYXVzZXMgUm9sbHVwIGlzc3VlcywgbG9hZCBkeW5hbWljYWxseSBpbnN0ZWFkXHJcbiAgICAgIGVzYnVpbGRPcHRpb25zOiB7XHJcbiAgICAgICAgdGFyZ2V0OiAnZXMyMDIwJyxcclxuICAgICAgICBzdXBwb3J0ZWQ6IHtcclxuICAgICAgICAgICd0b3AtbGV2ZWwtYXdhaXQnOiBmYWxzZVxyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH07XHJcbn0pO1xyXG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQXFSLFNBQVMsY0FBYyxlQUFlO0FBQzNULE9BQU8sV0FBVztBQUNsQixTQUFTLGVBQWU7QUFDeEIsT0FBTyxpQkFBaUI7QUFDeEIsT0FBTyxVQUFVO0FBSmpCLElBQU0sbUNBQW1DO0FBT3pDLElBQU8sc0JBQVEsYUFBYSxDQUFDLEVBQUUsS0FBSyxNQUFNO0FBQ3hDLFFBQU0sTUFBTSxRQUFRLE1BQU0sUUFBUSxJQUFJLEdBQUcsRUFBRTtBQUMzQyxRQUFNLE9BQU8sU0FBUyxnQkFBZ0IsTUFBTyxJQUFJLGFBQWE7QUFFOUQsU0FBTztBQUFBLElBQ0w7QUFBQSxJQUNBLFNBQVM7QUFBQSxNQUNQLFlBQVk7QUFBQSxNQUNaLE1BQU07QUFBQSxNQUNOLFFBQVE7QUFBQSxRQUNOLGNBQWM7QUFBQSxRQUNkLGVBQWUsQ0FBQyxlQUFlLFVBQVU7QUFBQSxRQUN6QyxVQUFVO0FBQUEsVUFDUixNQUFNO0FBQUEsVUFDTixZQUFZO0FBQUEsVUFDWixhQUFhO0FBQUEsVUFDYixhQUFhO0FBQUEsVUFDYixrQkFBa0I7QUFBQSxVQUNsQixTQUFTO0FBQUEsVUFDVCxhQUFhO0FBQUEsVUFDYixPQUFPO0FBQUEsVUFDUCxXQUFXO0FBQUEsVUFDWCxNQUFNO0FBQUEsVUFDTixPQUFPO0FBQUEsWUFDTDtBQUFBLGNBQ0UsS0FBSztBQUFBLGNBQ0wsT0FBTztBQUFBLGNBQ1AsTUFBTTtBQUFBLGNBQ04sU0FBUztBQUFBLFlBQ1g7QUFBQSxZQUNBO0FBQUEsY0FDRSxLQUFLO0FBQUEsY0FDTCxPQUFPO0FBQUEsY0FDUCxNQUFNO0FBQUEsY0FDTixTQUFTO0FBQUEsWUFDWDtBQUFBLFlBQ0E7QUFBQSxjQUNFLEtB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
