import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
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
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      dedupe: ['react', 'react-dom']
    },
    clearScreen: false,
    envPrefix: ['VITE_', 'TAURI_ENV_*'],
    server: {
      port: 1420,
      strictPort: true,
      host: "127.0.0.1",
      watch: {
        ignored: ['**/src-tauri/**', '**/dist/**']
      },
      proxy: {
        '/api-farmaplus': {
          target: 'https://www.farmaplus.com.ar',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api-farmaplus/, '')
        }
      }
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            'animation-vendor': ['motion'],
            'tanstack-vendor': ['@tanstack/react-query', '@tanstack/react-table', '@tanstack/react-virtual'],
            'three-vendor': ['three', '@react-three/fiber', '@react-three/drei'],
            'ui-vendor': ['@base-ui/react'],
            'icons-vendor': ['@untitledui/icons', 'lucide-react'],
            'supabase': ['@supabase/supabase-js'],
            'charts': ['recharts'],
            'utils': ['date-fns', 'clsx', 'tailwind-merge', 'zod', 'zustand'],
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
        '!dist/**',
      ],
      include: [
        'react',
        'react-dom',
        'react-router-dom',
        '@supabase/supabase-js',
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
