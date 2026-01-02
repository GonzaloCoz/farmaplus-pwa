import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from "path"

// Minimal config for debugging
export default defineConfig({
    base: "/farmaplus-pwa/",
    plugins: [react()],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    build: {
        rollupOptions: {
            output: {
                // No manual chunks
            },
        },
        minify: false,
        sourcemap: true, // Enable for debugging
    },
})
