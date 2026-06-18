import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  root: 'extension',
  base: '',
  resolve: {
    alias: {
      '@': resolve('extension')
    }
  },
  build: {
    outDir: resolve('dist/extension'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve('extension/popup/index.html'),
        options: resolve('extension/options/index.html'),
        serviceWorker: resolve('extension/service-worker.ts')
      },
      output: {
        entryFileNames: (chunk) => {
          if (chunk.name === 'serviceWorker') return 'service-worker.js'
          return 'assets/[name]-[hash].js'
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]'
      }
    },
    target: 'esnext'
  },
  plugins: [vue()]
})
