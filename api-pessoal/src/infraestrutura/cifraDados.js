import crypto from 'node:crypto'

/*
  Encriptação dos dados pessoais sensíveis na base de dados (AES-256-GCM): o BI, a filiação, o telefone e a
  morada ficam ilegíveis para quem tiver só a base de dados ou uma cópia de segurança. A chave (DADOS_CHAVE)
  fica no .env do servidor, nunca na base de dados.
  - cifrar: "c1:" + base64(iv 12 bytes | etiqueta 16 bytes | texto cifrado); o mesmo texto dá sempre um
    resultado diferente (iv aleatório) e qualquer alteração ao cifrado é detectada;
  - indice: HMAC-SHA256 do valor normalizado — permite procurar e não repetir o BI sem o decifrar;
  - decifrar aceita texto antigo sem prefixo (os dados de antes da encriptação lêem-se até serem cifrados).
*/
const PREFIXO = 'c1:'

export class CifraDados {
  #chave
  #chaveIndice

  constructor(chave) {
    const base = Buffer.isBuffer(chave) ? chave : Buffer.from(String(chave), /^[0-9a-f]{64}$/i.test(chave) ? 'hex' : 'base64')
    if (base.length < 32) throw new Error('DADOS_CHAVE tem de ter 32 bytes (64 caracteres hexadecimais ou 44 em base64).')
    this.#chave = Buffer.from(crypto.hkdfSync('sha256', base, Buffer.alloc(0), 'esgfaa-pessoal/cifra', 32))
    this.#chaveIndice = Buffer.from(crypto.hkdfSync('sha256', base, Buffer.alloc(0), 'esgfaa-pessoal/indice', 32))
  }

  static cifrado(v) {
    return typeof v === 'string' && v.startsWith(PREFIXO)
  }

  cifrar(v) {
    if (v === null || v === undefined || v === '' || CifraDados.cifrado(v)) return v
    const iv = crypto.randomBytes(12)
    const c = crypto.createCipheriv('aes-256-gcm', this.#chave, iv)
    const corpo = Buffer.concat([c.update(String(v), 'utf8'), c.final()])
    return PREFIXO + Buffer.concat([iv, c.getAuthTag(), corpo]).toString('base64')
  }

  decifrar(v) {
    if (!CifraDados.cifrado(v)) return v
    const b = Buffer.from(v.slice(PREFIXO.length), 'base64')
    const d = crypto.createDecipheriv('aes-256-gcm', this.#chave, b.subarray(0, 12))
    d.setAuthTag(b.subarray(12, 28))
    return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8')
  }

  indice(v) {
    if (v === null || v === undefined || v === '') return null
    return crypto.createHmac('sha256', this.#chaveIndice).update(String(v).trim().toUpperCase().replace(/\s/g, '')).digest('hex')
  }
}

// campos da ficha (modelo Pessoa) guardados cifrados; o BI tem também o índice (único)
export const CAMPOS_CIFRADOS = ['bi', 'pai', 'mae', 'telefone', 'morada', 'bairro', 'rua', 'casa', 'telefoneAlternativo', 'conjuge', 'agregado', 'vencimento']

// prepara os dados de uma escrita: cifra os campos e calcula o índice do BI
export function cifrarEscrita(cifra, dados) {
  if (!dados || typeof dados !== 'object') return dados
  if (Array.isArray(dados)) return dados.map((d) => cifrarEscrita(cifra, d))
  const r = { ...dados }
  if ('bi' in r) r.biIndice = cifra.indice(r.bi)
  for (const c of CAMPOS_CIFRADOS) if (typeof r[c] === 'string') r[c] = cifra.cifrar(r[c])
  return r
}

/*
  Extensão do Prisma: as escritas em pessoa cifram, as leituras (também dentro de include/select de outros
  modelos) decifram. O resto do código não sabe que os dados estão cifrados.
*/
export function comCifra(prisma, cifra) {
  return prisma.$extends({
    query: {
      pessoa: {
        async $allOperations({ operation, args, query }) {
          const a = { ...args }
          if (['create', 'update', 'updateMany', 'createMany', 'createManyAndReturn', 'updateManyAndReturn'].includes(operation)) a.data = cifrarEscrita(cifra, a.data)
          if (operation === 'upsert') Object.assign(a, { create: cifrarEscrita(cifra, a.create), update: cifrarEscrita(cifra, a.update) })
          // procurar pelo BI: pelo índice (o cifrado muda de cada vez)
          if (a.where && typeof a.where.bi === 'string') {
            const { bi, ...resto } = a.where
            a.where = { ...resto, biIndice: cifra.indice(bi) }
          }
          return query(a)
        },
      },
      // segredo da verificação em dois passos
      doisFatores: {
        async $allOperations({ operation, args, query }) {
          const a = { ...args }
          const cif = (d) => (d && typeof d.segredo === 'string' ? { ...d, segredo: cifra.cifrar(d.segredo) } : d)
          if (['create', 'update', 'updateMany'].includes(operation)) a.data = cif(a.data)
          if (operation === 'upsert') Object.assign(a, { create: cif(a.create), update: cif(a.update) })
          return query(a)
        },
      },
    },
    result: {
      pessoa: Object.fromEntries(CAMPOS_CIFRADOS.map((c) => [c, { needs: { [c]: true }, compute: (p) => cifra.decifrar(p[c]) }])),
      doisFatores: { segredo: { needs: { segredo: true }, compute: (r) => cifra.decifrar(r.segredo) } },
    },
  })
}

// cifra o que ainda está em texto (dados de antes da encriptação); pode correr sempre: o que já está cifrado fica
export async function cifrarExistentes(prisma, cifra) {
  const l = await prisma.pessoa.findMany({ select: { id: true, biIndice: true, ...Object.fromEntries(CAMPOS_CIFRADOS.map((c) => [c, true])) } })
  let n = 0
  for (const p of l) {
    const d = {}
    for (const c of CAMPOS_CIFRADOS) if (p[c] && !CifraDados.cifrado(p[c])) d[c] = cifra.cifrar(p[c])
    if (p.bi && !p.biIndice) d.biIndice = cifra.indice(CifraDados.cifrado(p.bi) ? cifra.decifrar(p.bi) : p.bi)
    if (Object.keys(d).length) {
      await prisma.pessoa.update({ where: { id: p.id }, data: d })
      n++
    }
  }
  return n
}
