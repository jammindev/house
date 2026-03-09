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
        'styles': resolve(__dirname, 'src/styles.css'),
        'shell': resolve(__dirname, 'src/shell.ts'),
        'dashboard': resolve(__dirname, 'src/pages/dashboard/index.tsx'),
        'interactions': resolve(__dirname, 'src/pages/interactions/list.tsx'),
        'interaction-new': resolve(__dirname, 'src/pages/interactions/new.tsx'),
        'electricity': resolve(__dirname, 'src/pages/electricity/board.tsx'),
        'zones': resolve(__dirname, 'src/pages/zones/list.tsx'),
        'zones-detail': resolve(__dirname, 'src/pages/zones/detail.tsx'),
        'contacts': resolve(__dirname, 'src/pages/contacts/list.tsx'),
        'contact-new': resolve(__dirname, 'src/pages/contacts/new.tsx'),
        'contact-detail': resolve(__dirname, 'src/pages/contacts/detail.tsx'),
        'contact-edit': resolve(__dirname, 'src/pages/contacts/edit.tsx'),
        'structure-new': resolve(__dirname, 'src/pages/structures/new.tsx'),
        'structure-detail': resolve(__dirname, 'src/pages/structures/detail.tsx'),
        'structure-edit': resolve(__dirname, 'src/pages/structures/edit.tsx'),
        'documents': resolve(__dirname, 'src/pages/documents/list.tsx'),
        'document-new': resolve(__dirname, 'src/pages/documents/new.tsx'),
        'document-detail': resolve(__dirname, 'src/pages/documents/detail.tsx'),
        'equipment': resolve(__dirname, 'src/pages/equipment/list.tsx'),
        'equipment-detail': resolve(__dirname, 'src/pages/equipment/detail.tsx'),
        'equipment-new': resolve(__dirname, 'src/pages/equipment/new.tsx'),
        'equipment-edit': resolve(__dirname, 'src/pages/equipment/edit.tsx'),
        'stock': resolve(__dirname, 'src/pages/stock/list.tsx'),
        'stock-new': resolve(__dirname, 'src/pages/stock/new.tsx'),
        'stock-detail': resolve(__dirname, 'src/pages/stock/detail.tsx'),
        'stock-edit': resolve(__dirname, 'src/pages/stock/edit.tsx'),
        'projects': resolve(__dirname, 'src/pages/projects/list.tsx'),
        'project-detail': resolve(__dirname, 'src/pages/projects/detail.tsx'),
        'project-new': resolve(__dirname, 'src/pages/projects/new.tsx'),
        'project-edit': resolve(__dirname, 'src/pages/projects/edit.tsx'),
        'project-groups': resolve(__dirname, 'src/pages/projects/groups.tsx'),
        'project-group-detail': resolve(__dirname, 'src/pages/projects/group-detail.tsx'),
        'tasks': resolve(__dirname, 'src/pages/tasks/list.tsx'),
        'photos': resolve(__dirname, 'src/pages/photos/list.tsx'),
        'settings': resolve(__dirname, 'src/pages/settings/index.tsx'),
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
