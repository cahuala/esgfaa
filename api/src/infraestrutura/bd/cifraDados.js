import crypto from 'node:crypto'

/*
  Encriptação dos dados pessoais na base de dados do portal (AES-256-GCM), como no sistema de pessoal:
  quem tiver só a base de dados ou uma cópia de segurança não os lê. A chave (DADOS_CHAVE) fica no .env.
  - texto: "c1:" + base64(iv 12 | etiqueta 16 | cifrado);
  - JSON (ex.: dados da conta): guarda-se { c1: "<cifrado do JSON>" };
  - o que estiver em texto (dados de antes) lê-se tal como está e cifra-se no arranque.
  O nome e o e-mail das contas não se cifram: servem para entrar, procurar e ordenar.
*/
const PREFIXO = 'c1:'

export class CifraDados {
  #chave

  constructor(chave) {
    const base = Buffer.isBuffer(chave) ? chave : Buffer.from(String(chave), /^[0-9a-f]{64}$/i.test(chave) ? 'hex' : 'base64')
    if (base.length < 32) throw new Error('DADOS_CHAVE tem de ter 32 bytes (64 caracteres hexadecimais ou 44 em base64).')
    this.#chave = Buffer.from(crypto.hkdfSync('sha256', base, Buffer.alloc(0), 'esgfaa-portal/cifra', 32))
  }

  static cifrado(v) {
    return (typeof v === 'string' && v.startsWith(PREFIXO)) || (v !== null && typeof v === 'object' && !Array.isArray(v) && typeof v.c1 === 'string' && Object.keys(v).length === 1)
  }

  cifrar(v) {
    if (v === null || v === undefined || v === '' || CifraDados.cifrado(v)) return v
    const iv = crypto.randomBytes(12)
    const c = crypto.createCipheriv('aes-256-gcm', this.#chave, iv)
    const corpo = Buffer.concat([c.update(String(v), 'utf8'), c.final()])
    return PREFIXO + Buffer.concat([iv, c.getAuthTag(), corpo]).toString('base64')
  }

  decifrar(v) {
    if (typeof v !== 'string' || !v.startsWith(PREFIXO)) return v
    const b = Buffer.from(v.slice(PREFIXO.length), 'base64')
    const d = crypto.createDecipheriv('aes-256-gcm', this.#chave, b.subarray(0, 12))
    d.setAuthTag(b.subarray(12, 28))
    return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8')
  }

  cifrarJson(v) {
    if (v === null || v === undefined || CifraDados.cifrado(v)) return v
    return { c1: this.cifrar(JSON.stringify(v)) }
  }

  decifrarJson(v) {
    return CifraDados.cifrado(v) && typeof v === 'object' ? JSON.parse(this.decifrar(v.c1)) : v
  }
}

// o que se cifra em cada modelo
export const CIFRADOS = {
  contaPortal: { json: ['dados'] }, // posto, ramo, NIP, telefone, departamento
  candidatura: { texto: ['telefone'], json: ['dados'] }, // o formulário de candidatura (BI, morada, filiação…)
  mensagemContacto: { texto: ['telefone', 'mensagem'] },
  doisFatores: { texto: ['segredo'] }, // segredo da verificação em dois passos
}

function cifrarDados(cifra, def, dados) {
  if (!dados || typeof dados !== 'object') return dados
  if (Array.isArray(dados)) return dados.map((d) => cifrarDados(cifra, def, d))
  const r = { ...dados }
  for (const c of def.texto ?? []) if (typeof r[c] === 'string') r[c] = cifra.cifrar(r[c])
  for (const c of def.json ?? []) if (r[c] !== undefined && r[c] !== null && typeof r[c] === 'object') r[c] = cifra.cifrarJson(r[c])
  return r
}

const ESCRITAS = ['create', 'update', 'updateMany', 'createMany', 'createManyAndReturn', 'updateManyAndReturn']

// extensão do Prisma: cifra ao escrever e decifra ao ler (também em include/select de outros modelos)
export function comCifra(prisma, cifra) {
  const query = {}
  const result = {}
  for (const [modelo, def] of Object.entries(CIFRADOS)) {
    query[modelo] = {
      async $allOperations({ operation, args, query: q }) {
        const a = { ...args }
        if (ESCRITAS.includes(operation)) a.data = cifrarDados(cifra, def, a.data)
        if (operation === 'upsert') Object.assign(a, { create: cifrarDados(cifra, def, a.create), update: cifrarDados(cifra, def, a.update) })
        return q(a)
      },
    }
    result[modelo] = Object.fromEntries([
      ...(def.texto ?? []).map((c) => [c, { needs: { [c]: true }, compute: (r) => cifra.decifrar(r[c]) }]),
      ...(def.json ?? []).map((c) => [c, { needs: { [c]: true }, compute: (r) => cifra.decifrarJson(r[c]) }]),
    ])
  }
  return prisma.$extends({ query, result })
}

// cifra o que ainda está em texto; o que já está cifrado fica. Devolve quantos registos mudaram.
export async function cifrarExistentes(prisma, cifra) {
  let n = 0
  for (const [modelo, def] of Object.entries(CIFRADOS)) {
    const campos = [...(def.texto ?? []), ...(def.json ?? [])]
    const linhas = await prisma[modelo].findMany({ select: { id: true, ...Object.fromEntries(campos.map((c) => [c, true])) } })
    for (const l of linhas) {
      const d = {}
      for (const c of def.texto ?? []) if (l[c] && !CifraDados.cifrado(l[c])) d[c] = cifra.cifrar(l[c])
      for (const c of def.json ?? []) if (l[c] !== null && l[c] !== undefined && !CifraDados.cifrado(l[c])) d[c] = cifra.cifrarJson(l[c])
      if (Object.keys(d).length) {
        await prisma[modelo].update({ where: { id: l.id }, data: d })
        n++
      }
    }
  }
  return n
}
