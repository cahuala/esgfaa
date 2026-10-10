import { ErroDominio } from '../../../dominio/comum/erros.js'

const ESTADOS = {
  validacao: 400,
  nao_autenticado: 401,
  sem_permissao: 403,
  nao_encontrado: 404,
  conflito: 409,
  conta_bloqueada: 423,
}

export function naoEncontrado(req, res) {
  res.status(404).json({ erro: 'Endereço não encontrado.', codigo: 'nao_encontrado' })
}

// converte erros em respostas { erro, codigo }; erros inesperados nunca expõem detalhes internos
export function tratarErros(registar = (e) => console.error(e)) {
  // eslint-disable-next-line no-unused-vars
  return (erro, req, res, next) => {
    if (erro instanceof ErroDominio) {
      const corpo = { erro: erro.message, codigo: erro.codigo }
      if (erro.codigo === 'conta_bloqueada' && erro.detalhes?.ate) {
        corpo.ate = erro.detalhes.ate
        res.set('Retry-After', String(Math.max(1, Math.ceil((new Date(erro.detalhes.ate) - Date.now()) / 1000))))
      }
      return res.status(ESTADOS[erro.codigo] || 400).json(corpo)
    }
    if (erro.type === 'entity.parse.failed') return res.status(400).json({ erro: 'Pedido mal formado.', codigo: 'validacao' })
    if (erro.type === 'entity.too.large') return res.status(413).json({ erro: 'Conteúdo demasiado grande.', codigo: 'demasiado_grande' })
    if (erro.name === 'MulterError') {
      const mensagens = {
        LIMIT_FILE_SIZE: `Ficheiro demasiado grande (máximo ${Math.round((req.limiteUpload || 0) / 1048576)} MB).`,
        LIMIT_FILE_COUNT: 'Demasiados ficheiros de uma vez (máximo 20).',
        LIMIT_UNEXPECTED_FILE: 'Campo de ficheiro inesperado.',
      }
      return res.status(400).json({ erro: mensagens[erro.code] || 'Envio de ficheiro inválido.', codigo: 'validacao' })
    }
    registar({ id: req.id, erro })
    res.status(500).json({ erro: 'Erro interno do servidor.', codigo: 'interno', pedido: req.id })
  }
}
