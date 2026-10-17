import crypto from 'node:crypto'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

/*
  Política de segurança de conteúdo (CSP) nas páginas publicadas: só correm os scripts da própria aplicação
  (os poucos scripts inline entram pelo seu hash SHA-256), os pedidos só vão às APIs da Escola, e nada se
  carrega de sítios desconhecidos. Um script injectado (XSS) não corre nem consegue mandar dados para fora.
  Só no build: em desenvolvimento o Vite precisa de scripts inline.
*/
function csp(env) {
  const origem = (u) => { try { return u ? new URL(u).origin : '' } catch { return '' } }
  const apis = [...new Set([origem(env.VITE_API_URL), origem(env.VITE_PESSOAL_API)].filter(Boolean))].join(' ')
  return {
    name: 'esg-csp',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        const hashes = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)]
          .filter((m) => m[1].trim())
          .map((m) => `'sha256-${crypto.createHash('sha256').update(m[1]).digest('base64')}'`)
        const politica = [
          "default-src 'self'",
          `script-src 'self' ${hashes.join(' ')}`.trim(),
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
          "font-src 'self' data: https://fonts.gstatic.com",
          `img-src 'self' data: blob: https: ${apis}`.trim(),
          `media-src 'self' blob: ${apis}`.trim(),
          `connect-src 'self' ${apis}`.trim(),
          // vídeos (YouTube), mapa dos contactos, aulas ao vivo e pacotes SCORM/H5P servidos pela API
          `frame-src 'self' https: ${apis}`.trim(),
          "worker-src 'self' blob:",
          "object-src 'none'",
          "base-uri 'self'",
          // o LTI envia o formulário para a ferramenta externa
          "form-action 'self' https:",
        ].join('; ')
        return html.replace(/<head>/i, `<head>\n    <meta http-equiv="Content-Security-Policy" content="${politica}">`)
      },
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), csp(loadEnv(mode, process.cwd(), 'VITE_'))],
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
}))
