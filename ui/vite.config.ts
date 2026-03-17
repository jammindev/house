// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react()],
  root: resolve(__dirname),
  base: command === 'serve' ? '/static/react/' : '/static/react/',
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@apps': resolve(__dirname, '../apps'),
    },
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
  },
  server: {
    host: 'localhost',
    port: Number(process.env.VITE_DEV_SERVER_PORT || 5174),
    strictPort: true,
    cors: true,
    hmr: {
      host: 'localhost',
      port: Number(process.env.VITE_DEV_SERVER_PORT || 5174),
    },
    proxy: {
      '/api': {
        target: 'http://localhost:8001',
        changeOrigin: true,
      },
      '/admin': {
        target: 'http://localhost:8001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: '../static/react',
    emptyOutDir: true,
    manifest: '.vite/manifest.json',
    chunkSizeWarningLimit: 400,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/main.tsx'),
        styles: resolve(__dirname, 'src/styles.css'),
      },
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },
  css: {
    postcss: resolve(__dirname, 'postcss.config.js'),
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
  },
}))
