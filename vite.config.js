import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: process.env.BASE_PATH || '/',
  build: {
    // três aplicações: o site público, o painel de administração e o portal académico
    rollupOptions: {
      input: {
        site: resolve(import.meta.dirname, 'index.html'),
        p: resolve(import.meta.dirname, 'admin/index.html'),
        portal: resolve(import.meta.dirname, 'portal/index.html'),
      },
    },
  },
})
