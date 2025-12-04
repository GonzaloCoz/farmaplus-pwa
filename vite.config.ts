import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from "path"

// https://vitejs.dev/config/
export default defineConfig({
  // La base debe coincidir con el nombre de tu repositorio en GitHub
  base: "/farmaplus-pwa/",
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Code splitting para optimizar carga
    rollupOptions: {
      output: {
        manualChunks: {
          // Separar React y dependencias core
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          // Componentes UI de Radix
          'ui-vendor': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-popover',
            '@radix-ui/react-select',
            '@radix-ui/react-tabs',
            '@radix-ui/react-toast',
            '@radix-ui/react-tooltip',
            '@radix-ui/react-accordion',
            '@radix-ui/react-alert-dialog',
            '@radix-ui/react-avatar',
            '@radix-ui/react-checkbox',
            '@radix-ui/react-label',
            '@radix-ui/react-radio-group',
            '@radix-ui/react-scroll-area',
            '@radix-ui/react-separator',
            '@radix-ui/react-slider',
            '@radix-ui/react-switch',
          ],
          // Gráficos (solo se carga en Dashboard)
          'chart-vendor': ['recharts'],
          // Formularios
          'form-vendor': ['react-hook-form', 'zod', '@hookform/resolvers'],
          // Utilidades
          'utils': ['date-fns', 'clsx', 'tailwind-merge'],
          // Animaciones
          'animation': ['framer-motion'],
          // Scanner y utilidades específicas
          'scanner': ['html5-qrcode'],
          // Excel
          'excel': ['xlsx'],
        },
      },
    },
    // Optimización de chunks
    chunkSizeWarningLimit: 500,
    // Minificación agresiva
    // Minificación por defecto (esbuild)
    minify: true,
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
