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
        'Button': resolve(__dirname, 'src/web-components/Button.tsx'),
        'Input': resolve(__dirname, 'src/web-components/Input.tsx'),
        'Badge': resolve(__dirname, 'src/web-components/Badge.tsx'),
        'Card': resolve(__dirname, 'src/web-components/Card.tsx'),
        'Textarea': resolve(__dirname, 'src/web-components/Textarea.tsx'),
        'Select': resolve(__dirname, 'src/web-components/Select.tsx'),
        'Alert': resolve(__dirname, 'src/web-components/Alert.tsx'),
        'Skeleton': resolve(__dirname, 'src/web-components/Skeleton.tsx'),
        'InteractionList': resolve(__dirname, 'src/web-components/InteractionList.tsx'),
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
