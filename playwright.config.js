import { defineConfig } from '@playwright/test'

// Testes ponta-a-ponta: API real (base de dados descartável) + site e painel em modo de desenvolvimento.
const API = 'http://localhost:3101'
const SITE = 'http://localhost:5174'
export const ADMIN_E2E = { email: 'admin@esgfaa.gov.ao', senha: 'E2eComando2026seguro' }

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: SITE,
    // no computador usa o Chrome instalado; no CI usa o Chromium do Playwright
    ...(process.env.CI ? {} : { channel: 'chrome' }),
    locale: 'pt-PT',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'node tests/e2e/arrancar-api.js',
      url: `${API}/api/saude`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        PORT: '3101', NODE_ENV: 'test', LOG: 'nenhum',
        CORS_ORIGINS: SITE,
        ADMIN_EMAIL: ADMIN_E2E.email, ADMIN_PASSWORD: ADMIN_E2E.senha,
      },
    },
    {
      command: 'npx vite --port 5174 --strictPort',
      url: SITE,
      reuseExistingServer: false,
      timeout: 60_000,
      env: { VITE_API_URL: API },
    },
  ],
})
