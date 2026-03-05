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
    port: Number(process.env.VITE_DEV_SERVER_PORT || 5173),
    strictPort: true,
    cors: true,
    hmr: {
      host: 'localhost',
      port: Number(process.env.VITE_DEV_SERVER_PORT || 5173),
    },
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/admin': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: '../static/react',
    emptyOutDir: true,
    manifest: '.vite/manifest.json',
    rollupOptions: {
      input: {
        'styles': resolve(__dirname, 'src/styles.css'),
        'shell': resolve(__dirname, 'src/shell.ts'),
        'interactions': resolve(__dirname, 'src/pages/interactions.tsx'),
        'interaction-new': resolve(__dirname, 'src/pages/interaction-new.tsx'),
        'electricity': resolve(__dirname, 'src/pages/electricity.tsx'),
        'zones': resolve(__dirname, 'src/pages/zones.tsx'),
        'contacts': resolve(__dirname, 'src/pages/contacts.tsx'),
        'documents': resolve(__dirname, 'src/pages/documents.tsx'),
        'equipment': resolve(__dirname, 'src/pages/equipment.tsx'),
        'equipment-stock': resolve(__dirname, 'src/pages/equipment-stock.tsx'),
        'equipment-stock-new': resolve(__dirname, 'src/pages/equipment-stock-new.tsx'),
        'equipment-stock-detail': resolve(__dirname, 'src/pages/equipment-stock-detail.tsx'),
        'equipment-stock-edit': resolve(__dirname, 'src/pages/equipment-stock-edit.tsx'),
        'projects': resolve(__dirname, 'src/pages/projects.tsx'),
        'project-detail': resolve(__dirname, 'src/pages/project-detail.tsx'),
        'project-new': resolve(__dirname, 'src/pages/project-new.tsx'),
        'project-edit': resolve(__dirname, 'src/pages/project-edit.tsx'),
        'project-groups': resolve(__dirname, 'src/pages/project-groups.tsx'),
        'project-group-detail': resolve(__dirname, 'src/pages/project-group-detail.tsx'),
        'tasks': resolve(__dirname, 'src/pages/tasks.tsx'),
        'photos': resolve(__dirname, 'src/pages/photos.tsx'),
        'settings': resolve(__dirname, 'src/pages/settings.tsx'),
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
}))
