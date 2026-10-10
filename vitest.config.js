import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// Testes do site e do painel (componentes React e funções), num navegador simulado (jsdom)
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['tests/site/**/*.test.{js,jsx}'],
    setupFiles: ['tests/site/preparar.js'],
    env: { VITE_API_URL: 'http://api.teste' },
    css: { modules: { classNameStrategy: 'non-scoped' } },
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      include: ['src/utils/**', 'src/admin/api.js', 'src/admin/formatar.js', 'src/admin/editor/normalizar.js', 'src/conteudo/api.js', 'src/components/ConteudoRico/**', 'src/components/Interacoes/**'],
    },
  },
})
