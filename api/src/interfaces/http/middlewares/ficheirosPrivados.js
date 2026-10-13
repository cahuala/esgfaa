import multer from 'multer'
import { limparTexto } from '../../../dominio/comum/texto.js'
import { ErroValidacao } from '../../../dominio/comum/erros.js'
import { TIPOS_PRIVADOS } from '../../../infraestrutura/ficheiros/privados.js'

// nomes enviados pelo navegador chegam em latin1 (multer); repõe-se o UTF-8
const nomeOriginal = (n) => limparTexto(Buffer.from(n, 'latin1').toString('utf8')).slice(0, 200)

/*
  Recebe um ficheiro (campo "ficheiro") para a pasta privada.
  Tipos fora da lista são recusados; o tipo real é confirmado depois, no caso de uso.
  Põe em req.ficheiro { caminho, nome, tipo, tamanho } (ou null se não vier ficheiro).
*/
export function receberFicheiro({ privados, config }) {
  const upload = multer({
    storage: multer.diskStorage({
      destination: (req, f, cb) => cb(null, privados.pastaDoMes()),
      filename: (req, f, cb) => cb(null, privados.nomeNovo(f.mimetype)),
    }),
    limits: { fileSize: config.tamanhoMaximoUpload, files: 1, fields: 12 },
    fileFilter: (req, f, cb) => {
      if (TIPOS_PRIVADOS[f.mimetype]) return cb(null, true)
      cb(new ErroValidacao('Tipo de ficheiro não permitido (aceites: PDF, Word, PowerPoint, Excel, imagens, vídeo MP4/WebM e ZIP).', { campo: 'ficheiro' }))
    },
  }).single('ficheiro')

  return (req, res, next) => {
    req.limiteUpload = config.tamanhoMaximoUpload
    upload(req, res, (erro) => {
      if (erro) return next(erro)
      req.ficheiro = req.file ? { caminho: req.file.path, nome: nomeOriginal(req.file.originalname), tipo: req.file.mimetype, tamanho: req.file.size } : null
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
