import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: process.env.BASE_PATH || '/',
  build: {
    // quatro aplicações: o site público, o painel de administração, o portal académico e o sistema de
    // gestão de pessoal (este só para o servidor interno: o deploy do GitHub Pages retira-o)
    rollupOptions: {
      input: {
        site: resolve(import.meta.dirname, 'index.html'),
        p: resolve(import.meta.dirname, 'admin/index.html'),
        portal: resolve(import.meta.dirname, 'portal/index.html'),
        pessoal: resolve(import.meta.dirname, 'pessoal/index.html'),
      },
    },
  },
})
