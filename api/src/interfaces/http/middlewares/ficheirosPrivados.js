import multer from 'multer'
import { limparTexto } from '../../../dominio/comum/texto.js'
import { ErroValidacao } from '../../../dominio/comum/erros.js'
import { TIPOS_PRIVADOS } from '../../../infraestrutura/ficheiros/privados.js'

// nomes enviados pelo navegador chegam em latin1 (multer); repõe-se o UTF-8
const nomeOriginal = (n) => limparTexto(Buffer.from(n, 'latin1').toString('utf8')).slice(0, 200)

/*
  Recebe ficheiros para a pasta privada: o campo "ficheiro" (um) e, se maximo > 1, o campo "ficheiros" (vários).
  Tipos fora da lista são recusados; o tipo real é confirmado depois, no caso de uso.
  Põe em req.ficheiros [{ caminho, nome, tipo, tamanho }] e em req.ficheiro o primeiro (ou null).
*/
export function receberFicheiro({ privados, config, maximo = 1 }) {
  const upload = multer({
    storage: multer.diskStorage({
      destination: (req, f, cb) => cb(null, privados.pastaDoMes()),
      filename: (req, f, cb) => cb(null, privados.nomeNovo(f.mimetype)),
    }),
    limits: { fileSize: config.tamanhoMaximoUpload, files: maximo, fields: 30 },
    fileFilter: (req, f, cb) => {
      if (TIPOS_PRIVADOS[f.mimetype]) return cb(null, true)
      cb(new ErroValidacao('Tipo de ficheiro não permitido (aceites: PDF, Word, PowerPoint, Excel, imagens, vídeo MP4/WebM e ZIP).', { campo: 'ficheiro' }))
    },
  }).fields([{ name: 'ficheiro', maxCount: 1 }, ...(maximo > 1 ? [{ name: 'ficheiros', maxCount: maximo }] : [])])

  return (req, res, next) => {
    req.limiteUpload = config.tamanhoMaximoUpload
    upload(req, res, (erro) => {
      const recebidos = [...(req.files?.ficheiro || []), ...(req.files?.ficheiros || [])]
      if (erro) {
        // um ficheiro recusado a meio não deixa os outros esquecidos no disco
        for (const f of recebidos) privados.apagar(f.path)
        if (erro.code === 'LIMIT_FILE_COUNT' || erro.code === 'LIMIT_UNEXPECTED_FILE') return next(new ErroValidacao(`No máximo ${maximo} ficheiro(s).`, { campo: 'ficheiros' }))
        return next(erro)
      }
      req.ficheiros = recebidos.map((f) => ({ caminho: f.path, nome: nomeOriginal(f.originalname), tipo: f.mimetype, tamanho: f.size }))
      req.ficheiro = req.ficheiros[0] || null
      next()
    })
  }
}

const INLINE = /^(application\/pdf|image\/|video\/)/

// envia um ficheiro privado (descarregar, ou ver no navegador com ?ver=1 para PDF/imagens/vídeo)
export function enviarFicheiro(req, res, { caminho, nome, tipo }) {
  const disposicao = req.query.ver === '1' && INLINE.test(tipo) ? 'inline' : 'attachment'
  const ascii = nome.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_')
  res.set({
    'Content-Type': tipo,
    'Content-Disposition': `${disposicao}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nome)}`,
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
  })
  res.sendFile(caminho, { dotfiles: 'deny' })
}
