import path from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const config = {
  porta: Number(process.env.PORT) || 3001,
  // pasta onde ficam a base de dados e os ficheiros carregados (deve ser um disco persistente em produção)
  pastaDados: path.resolve(raiz, process.env.DATA_DIR || 'dados'),
  // endereço público da API, usado para gerar os URLs das imagens (ex.: https://api.esgfaa.gov.ao)
  urlPublico: (process.env.PUBLIC_URL || '').replace(/\/$/, ''),
  // origens que podem chamar a API (site público e painel)
  origens: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:4173,https://cahuala.github.io')
    .split(',').map((o) => o.trim()).filter(Boolean),
  segredoJwt: process.env.JWT_SECRET || '',
  duracaoSessao: process.env.SESSION_TTL || '8h',
  tamanhoMaximoUpload: (Number(process.env.MAX_UPLOAD_MB) || 80) * 1024 * 1024,
  raiz,
}

if (!config.segredoJwt) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Defina JWT_SECRET no ambiente antes de arrancar a API em produção.')
  }
  config.segredoJwt = 'desenvolvimento-apenas-nao-usar-em-producao'
  console.warn('[aviso] JWT_SECRET não definido — a usar um segredo de desenvolvimento.')
}

config.pastaUploads = path.join(config.pastaDados, 'uploads')
config.ficheiroBase = path.join(config.pastaDados, 'esgfaa.sqlite')

export default config
