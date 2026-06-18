import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  root: 'capacitor',
  base: '',
  resolve: {
    alias: {
      '@': resolve('capacitor')
    }
  },
  build: {
    outDir: resolve('capacitor/www/dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: resolve('capacitor/index.html')
    },
    target: 'esnext'
  },
  plugins: [vue()]
})
