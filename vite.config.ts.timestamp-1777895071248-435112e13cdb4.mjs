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
        includeAssets: ["favicon.ico", "logo.png", "logo512.png"],
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
              src: "logo.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "any maskable"
            },
            {
              src: "logo512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any maskable"
            }
          ],
          shortcuts: [
            {
              name: "Stock",
              url: `${base}stock`,
              icons: [{ src: "logo.png", sizes: "192x192" }]
            },
            {
              name: "Inventarios",
              url: `${base}cyclic-inventory`,
              icons: [{ src: "logo.png", sizes: "192x192" }]
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxQcm95ZWN0b3NcXFxcZmFybWFwbHVzLXB3YS1tYWluXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJDOlxcXFxQcm95ZWN0b3NcXFxcZmFybWFwbHVzLXB3YS1tYWluXFxcXHZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9DOi9Qcm95ZWN0b3MvZmFybWFwbHVzLXB3YS1tYWluL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnLCBsb2FkRW52IH0gZnJvbSAndml0ZSdcclxuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0J1xyXG5pbXBvcnQgeyBWaXRlUFdBIH0gZnJvbSAndml0ZS1wbHVnaW4tcHdhJ1xyXG5pbXBvcnQgdGFpbHdpbmRjc3MgZnJvbSAnQHRhaWx3aW5kY3NzL3ZpdGUnXHJcbmltcG9ydCBwYXRoIGZyb20gXCJwYXRoXCJcclxuXHJcbi8vIGh0dHBzOi8vdml0ZWpzLmRldi9jb25maWcvXHJcbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZygoeyBtb2RlIH0pID0+IHtcclxuICBjb25zdCBlbnYgPSBsb2FkRW52KG1vZGUsIHByb2Nlc3MuY3dkKCksICcnKTtcclxuICBjb25zdCBiYXNlID0gbW9kZSA9PT0gJ2RldmVsb3BtZW50JyA/ICcvJyA6IChlbnYuVklURV9CQVNFIHx8ICcuLycpO1xyXG5cclxuICByZXR1cm4ge1xyXG4gICAgYmFzZSxcclxuICAgIHBsdWdpbnM6IFtcclxuICAgICAgdGFpbHdpbmRjc3MoKSxcclxuICAgICAgcmVhY3QoKSxcclxuICAgICAgVml0ZVBXQSh7XHJcbiAgICAgICAgcmVnaXN0ZXJUeXBlOiAnYXV0b1VwZGF0ZScsXHJcbiAgICAgICAgaW5jbHVkZUFzc2V0czogWydmYXZpY29uLmljbycsICdsb2dvLnBuZycsICdsb2dvNTEyLnBuZyddLFxyXG4gICAgICAgIG1hbmlmZXN0OiB7XHJcbiAgICAgICAgICBuYW1lOiAnRmFybWFwbHVzIC0gR2VzdGlcdTAwRjNuIGRlIEludmVudGFyaW8nLFxyXG4gICAgICAgICAgc2hvcnRfbmFtZTogJ0Zhcm1hcGx1cycsXHJcbiAgICAgICAgICBkZXNjcmlwdGlvbjogJ1Npc3RlbWEgZGUgZ2VzdGlcdTAwRjNuIGRlIGludmVudGFyaW9zIHBhcmEgRmFybWFwbHVzLiBHZXN0aW9uYSBpbnZlbnRhcmlvcyBjXHUwMEVEY2xpY29zLCBpbXBvcnRhIGRhdG9zLCBnZW5lcmEgcmVwb3J0ZXMgeSBtXHUwMEUxcy4nLFxyXG4gICAgICAgICAgdGhlbWVfY29sb3I6ICcjZmZmZmZmJyxcclxuICAgICAgICAgIGJhY2tncm91bmRfY29sb3I6ICcjZmZmZmZmJyxcclxuICAgICAgICAgIGRpc3BsYXk6ICdzdGFuZGFsb25lJyxcclxuICAgICAgICAgIG9yaWVudGF0aW9uOiAncG9ydHJhaXQtcHJpbWFyeScsXHJcbiAgICAgICAgICBzY29wZTogYmFzZSxcclxuICAgICAgICAgIHN0YXJ0X3VybDogYmFzZSxcclxuICAgICAgICAgIGxhbmc6ICdlcy1FUycsXHJcbiAgICAgICAgICBpY29uczogW1xyXG4gICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgc3JjOiAnbG9nby5wbmcnLFxyXG4gICAgICAgICAgICAgIHNpemVzOiAnMTkyeDE5MicsXHJcbiAgICAgICAgICAgICAgdHlwZTogJ2ltYWdlL3BuZycsXHJcbiAgICAgICAgICAgICAgcHVycG9zZTogJ2FueSBtYXNrYWJsZSdcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgIHNyYzogJ2xvZ281MTIucG5nJyxcclxuICAgICAgICAgICAgICBzaXplczogJzUxMng1MTInLFxyXG4gICAgICAgICAgICAgIHR5cGU6ICdpbWFnZS9wbmcnLFxyXG4gICAgICAgICAgICAgIHB1cnBvc2U6ICdhbnkgbWFza2FibGUnXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIF0sXHJcbiAgICAgICAgICBzaG9ydGN1dHM6IFtcclxuICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgIG5hbWU6ICdTdG9jaycsXHJcbiAgICAgICAgICAgICAgdXJsOiBgJHtiYXNlfXN0b2NrYCxcclxuICAgICAgICAgICAgICBpY29uczogW3sgc3JjOiAnbG9nby5wbmcnLCBzaXplczogJzE5MngxOTInIH1dXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICBuYW1lOiAnSW52ZW50YXJpb3MnLFxyXG4gICAgICAgICAgICAgIHVybDogYCR7YmFzZX1jeWNsaWMtaW52ZW50b3J5YCxcclxuICAgICAgICAgICAgICBpY29uczogW3sgc3JjOiAnbG9nby5wbmcnLCBzaXplczogJzE5MngxOTInIH1dXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIF0sXHJcbiAgICAgICAgICBjYXRlZ29yaWVzOiBbJ2J1c2luZXNzJywgJ3Byb2R1Y3Rpdml0eSddXHJcbiAgICAgICAgfSxcclxuICAgICAgICB3b3JrYm94OiB7XHJcbiAgICAgICAgICBnbG9iUGF0dGVybnM6IFsnKiovKi57anMsY3NzLGh0bWwsaWNvLHBuZyxzdmcsd29mZjJ9J10sXHJcbiAgICAgICAgICBnbG9iSWdub3JlczogWycqKi9iZy5zdmcnLCAnKiovZGVmYXVsdF9wcm9kdWN0cy54bHN4J10sXHJcbiAgICAgICAgICBtYXhpbXVtRmlsZVNpemVUb0NhY2hlSW5CeXRlczogNSAqIDEwMjQgKiAxMDI0LCAvLyA1TUIgbGltaXQgZm9yIHJlZ3VsYXIgYXNzZXRzXHJcbiAgICAgICAgICBuYXZpZ2F0ZUZhbGxiYWNrOiAnaW5kZXguaHRtbCcsXHJcbiAgICAgICAgICBydW50aW1lQ2FjaGluZzogW1xyXG4gICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgdXJsUGF0dGVybjogL15odHRwczpcXC9cXC9mb250c1xcLmdvb2dsZWFwaXNcXC5jb21cXC8uKi9pLFxyXG4gICAgICAgICAgICAgIGhhbmRsZXI6ICdDYWNoZUZpcnN0JyxcclxuICAgICAgICAgICAgICBvcHRpb25zOiB7XHJcbiAgICAgICAgICAgICAgICBjYWNoZU5hbWU6ICdnb29nbGUtZm9udHMtY2FjaGUnLFxyXG4gICAgICAgICAgICAgICAgZXhwaXJhdGlvbjoge1xyXG4gICAgICAgICAgICAgICAgICBtYXhFbnRyaWVzOiAxMCxcclxuICAgICAgICAgICAgICAgICAgbWF4QWdlU2Vjb25kczogNjAgKiA2MCAqIDI0ICogMzY1XHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgY2FjaGVhYmxlUmVzcG9uc2U6IHtcclxuICAgICAgICAgICAgICAgICAgc3RhdHVzZXM6IFswLCAyMDBdXHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgdXJsUGF0dGVybjogL15odHRwczpcXC9cXC9mb250c1xcLmdzdGF0aWNcXC5jb21cXC8uKi9pLFxyXG4gICAgICAgICAgICAgIGhhbmRsZXI6ICdDYWNoZUZpcnN0JyxcclxuICAgICAgICAgICAgICBvcHRpb25zOiB7XHJcbiAgICAgICAgICAgICAgICBjYWNoZU5hbWU6ICdnc3RhdGljLWZvbnRzLWNhY2hlJyxcclxuICAgICAgICAgICAgICAgIGV4cGlyYXRpb246IHtcclxuICAgICAgICAgICAgICAgICAgbWF4RW50cmllczogMTAsXHJcbiAgICAgICAgICAgICAgICAgIG1heEFnZVNlY29uZHM6IDYwICogNjAgKiAyNCAqIDM2NVxyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIGNhY2hlYWJsZVJlc3BvbnNlOiB7XHJcbiAgICAgICAgICAgICAgICAgIHN0YXR1c2VzOiBbMCwgMjAwXVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgIHVybFBhdHRlcm46IC9eaHR0cHM6XFwvXFwvKC4qXFwuc3VwYWJhc2VcXC5jb3xzdXBhYmFzZVxcLmhhbHVcXC5jb21cXC5hcilcXC8uKi9pLFxyXG4gICAgICAgICAgICAgIGhhbmRsZXI6ICdOZXR3b3JrRmlyc3QnLFxyXG4gICAgICAgICAgICAgIG9wdGlvbnM6IHtcclxuICAgICAgICAgICAgICAgIGNhY2hlTmFtZTogJ3N1cGFiYXNlLWNhY2hlJyxcclxuICAgICAgICAgICAgICAgIGV4cGlyYXRpb246IHtcclxuICAgICAgICAgICAgICAgICAgbWF4RW50cmllczogMTAwLFxyXG4gICAgICAgICAgICAgICAgICBtYXhBZ2VTZWNvbmRzOiA2MCAqIDYwICogMjQgLy8gMjQgaG91cnNcclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICBjYWNoZWFibGVSZXNwb25zZToge1xyXG4gICAgICAgICAgICAgICAgICBzdGF0dXNlczogWzAsIDIwMF1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIF1cclxuICAgICAgICB9XHJcbiAgICAgIH0pXHJcbiAgICBdLFxyXG4gICAgcmVzb2x2ZToge1xyXG4gICAgICBhbGlhczoge1xyXG4gICAgICAgIFwiQFwiOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcIi4vc3JjXCIpLFxyXG4gICAgICB9LFxyXG4gICAgfSxcclxuICAgIGJ1aWxkOiB7XHJcbiAgICAgIHJvbGx1cE9wdGlvbnM6IHtcclxuICAgICAgICBvdXRwdXQ6IHtcclxuICAgICAgICAgIG1hbnVhbENodW5rczoge1xyXG4gICAgICAgICAgICAncmVhY3QtdmVuZG9yJzogWydyZWFjdCcsICdyZWFjdC1kb20nLCAncmVhY3Qtcm91dGVyLWRvbSddLFxyXG4gICAgICAgICAgICAndWktdmVuZG9yJzogW1xyXG4gICAgICAgICAgICAgICdAYmFzZS11aS1jb21wb25lbnRzL3JlYWN0JyxcclxuICAgICAgICAgICAgXSxcclxuICAgICAgICAgICAgJ3N1cGFiYXNlJzogWydAc3VwYWJhc2Uvc3VwYWJhc2UtanMnXSxcclxuICAgICAgICAgICAgJ2NoYXJ0cyc6IFsncmVjaGFydHMnXSxcclxuICAgICAgICAgICAgJ3V0aWxzJzogWydkYXRlLWZucycsICdjbHN4JywgJ3RhaWx3aW5kLW1lcmdlJ10sXHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgb253YXJuKHdhcm5pbmcsIHdhcm4pIHtcclxuICAgICAgICAgIC8vIFN1cHByZXNzIGNpcmN1bGFyIGRlcGVuZGVuY3kgd2FybmluZ3MgLSB0aGV5J3JlIG9mdGVuIGZhbHNlIHBvc2l0aXZlc1xyXG4gICAgICAgICAgaWYgKHdhcm5pbmcuY29kZSA9PT0gJ0NJUkNVTEFSX0RFUEVOREVOQ1knKSByZXR1cm47XHJcbiAgICAgICAgICAvLyBTdXBwcmVzcyBcInRoaXNcIiBrZXl3b3JkIHdhcm5pbmdzIGluIGNsYXNzIGNvbnN0cnVjdG9yc1xyXG4gICAgICAgICAgaWYgKHdhcm5pbmcuY29kZSA9PT0gJ1RISVNfSVNfVU5ERUZJTkVEJykgcmV0dXJuO1xyXG4gICAgICAgICAgd2Fybih3YXJuaW5nKTtcclxuICAgICAgICB9XHJcbiAgICAgIH0sXHJcbiAgICAgIGNodW5rU2l6ZVdhcm5pbmdMaW1pdDogMTAwMCxcclxuICAgICAgbWluaWZ5OiAnZXNidWlsZCcsXHJcbiAgICAgIGNzc0NvZGVTcGxpdDogdHJ1ZSxcclxuICAgICAgc291cmNlbWFwOiBmYWxzZSxcclxuICAgICAgdGFyZ2V0OiAnZXMyMDE1JyxcclxuICAgIH0sXHJcbiAgICBvcHRpbWl6ZURlcHM6IHtcclxuICAgICAgaW5jbHVkZTogW1xyXG4gICAgICAgICdyZWFjdCcsXHJcbiAgICAgICAgJ3JlYWN0LWRvbScsXHJcbiAgICAgICAgJ3JlYWN0LXJvdXRlci1kb20nLFxyXG4gICAgICAgICdAc3VwYWJhc2Uvc3VwYWJhc2UtanMnLFxyXG4gICAgICAgICdyZWFjdC13aW5kb3cnLFxyXG4gICAgICAgICdyZWFjdC12aXJ0dWFsaXplZC1hdXRvLXNpemVyJyxcclxuICAgICAgXSxcclxuICAgICAgZXhjbHVkZTogWyd4bHN4J10sIC8vIHhsc3ggY2F1c2VzIFJvbGx1cCBpc3N1ZXMsIGxvYWQgZHluYW1pY2FsbHkgaW5zdGVhZFxyXG4gICAgICBlc2J1aWxkT3B0aW9uczoge1xyXG4gICAgICAgIHRhcmdldDogJ2VzMjAyMCcsXHJcbiAgICAgICAgc3VwcG9ydGVkOiB7XHJcbiAgICAgICAgICAndG9wLWxldmVsLWF3YWl0JzogZmFsc2VcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9O1xyXG59KTtcclxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUFxUixTQUFTLGNBQWMsZUFBZTtBQUMzVCxPQUFPLFdBQVc7QUFDbEIsU0FBUyxlQUFlO0FBQ3hCLE9BQU8saUJBQWlCO0FBQ3hCLE9BQU8sVUFBVTtBQUpqQixJQUFNLG1DQUFtQztBQU96QyxJQUFPLHNCQUFRLGFBQWEsQ0FBQyxFQUFFLEtBQUssTUFBTTtBQUN4QyxRQUFNLE1BQU0sUUFBUSxNQUFNLFFBQVEsSUFBSSxHQUFHLEVBQUU7QUFDM0MsUUFBTSxPQUFPLFNBQVMsZ0JBQWdCLE1BQU8sSUFBSSxhQUFhO0FBRTlELFNBQU87QUFBQSxJQUNMO0FBQUEsSUFDQSxTQUFTO0FBQUEsTUFDUCxZQUFZO0FBQUEsTUFDWixNQUFNO0FBQUEsTUFDTixRQUFRO0FBQUEsUUFDTixjQUFjO0FBQUEsUUFDZCxlQUFlLENBQUMsZUFBZSxZQUFZLGFBQWE7QUFBQSxRQUN4RCxVQUFVO0FBQUEsVUFDUixNQUFNO0FB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
