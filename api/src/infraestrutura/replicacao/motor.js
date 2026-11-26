import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { lerEsquema, ondeChave } from './esquema.js'
import { DONOS, camposDe, escreve, interessa } from '../../dominio/replicacao/donos.js'

/*
  Replicação entre os sistemas separados (cada um com a sua base de dados, a mesma estrutura):
    - os gatilhos do PostgreSQL põem na fila (replicacao_fila) a chave de cada linha que muda nas tabelas que este
      sistema escreve; quando se aplicam linhas de outro sistema, a fila guarda a origem (para não voltarem para trás);
    - o que se envia é o estado actual de cada linha (ou «apagada»): repetir um envio ou uma mudança desfeita não estraga;
    - quem recebe aplica só o que é de quem envia (donos.js): as linhas e os campos de que ele é dono; nas notas, a mais
      recente; os ficheiros (materiais, entregas) vão com o conteúdo;
    - os sistemas internos (Gestão Escolar, Gestão do Site) é que ligam ao servidor online (que não chega à rede da
      Escola): cada troca leva o que mudou cá e traz, na resposta, o que mudou lá desde a última troca.
  Pedidos assinados com a chave partilhada (REPLICACAO_CHAVE): HMAC-SHA256 de «<sistema>.<data>.<corpo>», a menos de 5 min.
*/
export const ID_ONLINE = 1_000_000_000
const LIMITE_LINHAS = 400
const LIMITE_BYTES = 24 * 1024 * 1024
const MAX_FICHEIRO = 25 * 1024 * 1024
const JANELA_S = 300

export const assinar = (chave, sistema, data, corpo) => crypto.createHmac('sha256', chave).update(`${sistema}.${data}.${corpo}`).digest('hex')
export function verificarAssinatura(chave, sistema, data, corpo, assinatura, agora = Date.now()) {
  if (!chave || !/^\d{9,12}$/.test(String(data)) || Math.abs(agora / 1000 - Number(data)) > JANELA_S) return false
  const esperada = Buffer.from(assinar(chave, sistema, data, corpo))
  const dada = Buffer.from(String(assinatura ?? ''))
  return esperada.length === dada.length && crypto.timingSafeEqual(esperada, dada)
}

// valores para JSON e de volta (datas, decimais, inteiros grandes, binários)
const codificar = (v) => (v instanceof Date ? v.toISOString() : typeof v === 'bigint' ? v.toString() : Buffer.isBuffer(v) || v instanceof Uint8Array ? Buffer.from(v).toString('base64') : v !== null && typeof v === 'object' && typeof v.toFixed === 'function' && typeof v.d !== 'undefined' ? v.toString() : v)
function descodificar(campo, v, nuloJson) {
  if (v === null || v === undefined) return campo.tipo === 'Json' ? nuloJson : null
  if (campo.lista) return v
  switch (campo.tipo) {
    case 'DateTime': return new Date(v)
    case 'BigInt': return BigInt(v)
    case 'Bytes': return Buffer.from(v, 'base64')
    default: return v
  }
}

export class Replicacao {
  constructor({ prisma, sistema, chave, url = '', pares = ['escolar', 'site'], privados = null, pastaUploads = '', intervaloS = 15, registar = () => {}, fetch: buscar = globalThis.fetch, Prisma }) {
    Object.assign(this, { prisma, sistema, chave, url: url.replace(/\/$/, ''), pares, privados, pastaUploads, intervaloS, registar, buscar, Prisma })
    this.esquema = lerEsquema()
    this.porTabela = new Map(Object.values(this.esquema).map((m) => [m.tabela, m]))
    this.aTrocar = false
  }

  // as tabelas com gatilho: o que este sistema escreve (no online, tudo o que se replica: também passa de um ao outro)
  #tabelasComGatilho() {
    return Object.keys(DONOS).filter((n) => this.esquema[n] && (this.sistema === 'online' || escreve(n, this.sistema)))
  }

  // instala (ou refaz) os gatilhos; no servidor online, as linhas novas numeram-se a partir de mil milhões
  async preparar() {
    const p = this.prisma
    const comGatilho = new Set(this.#tabelasComGatilho())
    for (const m of Object.values(this.esquema)) {
      await p.$executeRawUnsafe(`DROP TRIGGER IF EXISTS replicacao ON "${m.tabela}"`)
      if (!comGatilho.has(m.nome)) continue
      const cols = m.pk.map((k) => `'${m.campos[k].coluna}'`).join(', ')
      await p.$executeRawUnsafe(`CREATE TRIGGER replicacao AFTER INSERT OR UPDATE OR DELETE ON "${m.tabela}" FOR EACH ROW EXECUTE FUNCTION replicacao_registar(${cols})`)
    }
    if (this.sistema === 'online') {
      for (const m of Object.values(this.esquema).filter((x) => x.autoincremento && x.pk.length === 1 && comGatilho.has(x.nome))) {
        const col = m.campos[m.pk[0]].coluna
        await p.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"${m.tabela}"', '${col}'), GREATEST(${ID_ONLINE}, (SELECT COALESCE(MAX("${col}"), 0) FROM "${m.tabela}") + 1), false)`)
      }
    }
  }

  // tudo o que é deste sistema vai para a fila (a primeira troca, ou para voltar a sincronizar tudo)
  async enviarTudo() {
    let n = 0
    for (const nome of Object.keys(DONOS).filter((x) => this.esquema[x] && escreve(x, this.sistema))) {
      const m = this.esquema[nome]
      const chave = m.pk.map((k) => `'${m.campos[k].coluna}', "${m.campos[k].coluna}"`).join(', ')
      n += Number(await this.prisma.$executeRawUnsafe(`INSERT INTO replicacao_fila (tabela, chave, origem) SELECT '${m.tabela}', jsonb_build_object(${chave}), '' FROM "${m.tabela}"`))
    }
    return n
  }

  // as mudanças da fila para um sistema, depois de «desde»: o estado actual de cada linha (ou apagada)
  async paraEnviar(destino, desde) {
    const inicio = BigInt(desde || 0)
    const fila = await this.prisma.replicacaoFila.findMany({ where: { id: { gt: inicio }, origem: { not: destino } }, orderBy: { id: 'asc' }, take: LIMITE_LINHAS * 3 })
    const linhas = []
    const vistas = new Set()
    let bytes = 0
    let ate = inicio
    let cortado = false
    for (const f of fila) {
      if (linhas.length >= LIMITE_LINHAS || bytes >= LIMITE_BYTES) { cortado = true; break }
      ate = f.id
      const m = this.porTabela.get(f.tabela)
      if (!m || !interessa(m.nome, destino)) continue
      // só o que é deste sistema; o online passa adiante o que veio de outro (a Gestão do Site → a Gestão Escolar)
      if (!(f.origem === '' ? escreve(m.nome, this.sistema) : this.sistema === 'online')) continue
      const chave = Object.fromEntries(m.pk.map((k) => [k, f.chave[m.campos[k].coluna]]))
      const id = `${m.nome}|${JSON.stringify(chave)}`
      if (vistas.has(id)) continue
      vistas.add(id)
      const atual = await this.prisma[m.delegate].findUnique({ where: ondeChave(m, this.#tipar(m, chave)) })
      const d = atual ? Object.fromEntries(Object.entries(atual).filter(([k]) => m.campos[k]).map(([k, v]) => [k, codificar(v)])) : null
      const linha = { m: m.nome, k: chave, d, ...(f.origem ? { o: f.origem } : {}) }
      if (d && m.nome === 'Ficheiro' && this.privados && d.caminho) {
        try {
          const ficheiro = this.privados.absoluto(d.caminho)
          const t = fs.statSync(ficheiro).size
          if (t <= MAX_FICHEIRO) { linha.f = fs.readFileSync(ficheiro).toString('base64'); bytes += t }
        } catch { /* o ficheiro ainda não está no disco: vai a linha */ }
      }
      linhas.push(linha)
    }
    return { linhas, ate: ate.toString(), mais: cortado || fila.length >= LIMITE_LINHAS * 3 }
  }

  #tipar(m, chave) {
    return Object.fromEntries(Object.entries(chave).map(([k, v]) => [k, m.campos[k] ? descodificar(m.campos[k], v, null) : v]))
  }

  // aplica as linhas que vieram de «origem»: só o que é dela; as que falham por ordem (o pai ainda não chegou) repetem-se
  async aplicar(origem, linhas = []) {
    const r = { aplicadas: 0, ignoradas: 0, erros: [] }
    let porFazer = linhas
    for (let volta = 0; volta < 4 && porFazer.length; volta++) {
      const falharam = []
      for (const l of porFazer) {
        try {
          const feito = await this.#aplicarLinha(origem, l)
          if (feito) r.aplicadas++
          else r.ignoradas++
        } catch (e) {
          falharam.push({ l, erro: e })
        }
      }
      if (falharam.length === porFazer.length) { r.erros.push(...falharam.map((x) => `${x.l.m} ${JSON.stringify(x.l.k)}: ${String(x.erro.message).split('\n').pop().slice(0, 200)}`)); break }
      porFazer = falharam.map((x) => x.l)
      if (volta === 3) r.erros.push(...falharam.map((x) => `${x.l.m} ${JSON.stringify(x.l.k)}: ${String(x.erro.message).split('\n').pop().slice(0, 200)}`))
    }
    return r
  }

  async #aplicarLinha(remetente, l) {
    // o servidor online passa adiante o que veio de outro sistema: conta a origem verdadeira
    const origem = remetente === 'online' && l.o && l.o !== this.sistema ? l.o : remetente
    const m = this.esquema[l.m]
    if (!m || !DONOS[m.nome] || !interessa(m.nome, this.sistema)) return false
    const pode = camposDe(m.nome, origem)
    if (!pode.todas && !pode.so.length) return false
    const onde = ondeChave(m, this.#tipar(m, l.k))
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRawUnsafe('SELECT set_config(\'replicacao.origem\', $1, true)', origem)
      const atual = await tx[m.delegate].findUnique({ where: onde })
      if (l.d === null) {
        if (!atual || !pode.todas) return false
        await tx[m.delegate].deleteMany({ where: onde })
        return true
      }
      // o que se escreve: as colunas de quem envia, sem as referências a tabelas que ficam só no outro sistema
      const locais = new Set(m.estrangeiras.filter((e) => !DONOS[e.alvo]).flatMap((e) => e.campos))
      const dados = {}
      for (const [k, v] of Object.entries(l.d)) {
        const c = m.campos[k]
        if (!c || locais.has(k)) continue
        // ao criar, a linha vai inteira (do dono); ao actualizar, só as colunas de quem envia
        if (atual && (pode.todas ? pode.excepto.includes(k) : !pode.so.includes(k))) continue
        dados[k] = descodificar(c, v, this.Prisma?.DbNull ?? null)
      }
      if (DONOS[m.nome].ultima && atual && m.atualizado && atual[m.atualizado] && dados[m.atualizado] && new Date(atual[m.atualizado]) > dados[m.atualizado]) return false
      if (atual) {
        for (const k of m.pk) delete dados[k]
        if (!Object.keys(dados).length) return false
        await tx[m.delegate].update({ where: onde, data: dados })
      } else {
        // só quem é dono (ou quando as duas partes criam) cria a linha
        if (!pode.todas) return false
        await tx[m.delegate].create({ data: { ...dados, ...this.#tipar(m, l.k) } })
      }
      if (l.f && m.nome === 'Ficheiro' && this.privados && l.d.caminho) {
        const destino = this.privados.absoluto(l.d.caminho)
        fs.mkdirSync(path.dirname(destino), { recursive: true })
        fs.writeFileSync(destino, Buffer.from(l.f, 'base64'))
      }
      return true
    }, { timeout: 60_000 })
  }

  // os ficheiros públicos (imagens das notícias, capas…) mudados depois de «desde» (ms), por ordem, até ao limite
  #uploadsDesde(desde) {
    if (!this.pastaUploads || !fs.existsSync(this.pastaUploads)) return { ficheiros: [], ate: desde, mais: false }
    const todos = []
    const andar = (d) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const f = path.join(d, e.name)
        if (e.isDirectory()) andar(f)
        else if (e.isFile()) { const t = fs.statSync(f); if (Math.floor(t.mtimeMs) > desde && t.size <= MAX_FICHEIRO) todos.push({ f, mtime: Math.floor(t.mtimeMs), tamanho: t.size }) }
      }
    }
    andar(this.pastaUploads)
    todos.sort((a, b) => a.mtime - b.mtime)
    const ficheiros = []
    let bytes = 0
    let ate = desde
    for (const x of todos) {
      if (bytes + x.tamanho > LIMITE_BYTES && ficheiros.length) return { ficheiros, ate, mais: true }
      ficheiros.push({ caminho: path.relative(this.pastaUploads, x.f).split(path.sep).join('/'), f: fs.readFileSync(x.f).toString('base64') })
      bytes += x.tamanho
      ate = x.mtime
    }
    return { ficheiros, ate, mais: false }
  }

  #gravarUploads(ficheiros = []) {
    if (!this.pastaUploads) return 0
    let n = 0
    for (const x of ficheiros) {
      const destino = path.resolve(this.pastaUploads, x.caminho)
      if (!destino.startsWith(path.resolve(this.pastaUploads) + path.sep)) continue // nunca fora da pasta
      fs.mkdirSync(path.dirname(destino), { recursive: true })
      fs.writeFileSync(destino, Buffer.from(x.f, 'base64'))
      n++
    }
    return n
  }

  // ---------- servidor online: responde a cada troca de um sistema interno ----------
  async servirTroca(origem, { linhas = [], desde = '0', ficheiros = [] } = {}) {
    const aplicado = await this.aplicar(origem, linhas)
    aplicado.ficheiros = this.#gravarUploads(ficheiros)
    const resposta = await this.paraEnviar(origem, desde)
    await this.prisma.replicacaoCursor.upsert({ where: { par: origem }, create: { par: origem, recebido: BigInt(desde || 0), ultimaTroca: new Date() }, update: { recebido: BigInt(desde || 0), ultimaTroca: new Date(), ultimoErro: aplicado.erros.slice(0, 3).join(' | ').slice(0, 1000) } })
    // a fila que todos os sistemas já receberam (e com mais de um dia) não faz falta
    const pares = await this.prisma.replicacaoCursor.findMany({ where: { par: { in: this.pares } } })
    if (pares.length === this.pares.length) {
      const minimo = pares.reduce((a, c) => (c.recebido < a ? c.recebido : a), pares[0].recebido)
      await this.prisma.replicacaoFila.deleteMany({ where: { id: { lte: minimo }, criadaEm: { lt: new Date(Date.now() - 86_400_000) } } })
    }
    return { aplicado, ...resposta }
  }

  // ---------- sistemas internos: trocam com o servidor online ----------
  async trocar() {
    if (this.aTrocar || !this.url) return null
    this.aTrocar = true
    const total = { enviadas: 0, recebidas: 0, erros: [] }
    try {
      for (let volta = 0; volta < 50; volta++) {
        const cursor = await this.prisma.replicacaoCursor.upsert({ where: { par: 'online' }, create: { par: 'online' }, update: {} })
        const minhas = await this.paraEnviar('online', cursor.enviado)
        const up = this.#uploadsDesde(Number(cursor.uploadsAte))
        const corpo = JSON.stringify({ linhas: minhas.linhas, desde: cursor.recebido.toString(), ficheiros: up.ficheiros })
        const data = String(Math.floor(Date.now() / 1000))
        const r = await this.buscar(`${this.url}/api/replicacao/trocar`, {
          method: 'POST', body: corpo,
          headers: { 'Content-Type': 'application/json', 'X-Sistema': this.sistema, 'X-Data': data, 'X-Assinatura': assinar(this.chave, this.sistema, data, corpo) },
          signal: AbortSignal.timeout(120_000),
        })
        if (!r.ok) throw new Error(`O servidor online respondeu ${r.status}: ${(await r.text()).slice(0, 200)}`)
        const resp = await r.json()
        if (resp.aplicado?.erros?.length) total.erros.push(...resp.aplicado.erros)
        const deles = await this.aplicar('online', resp.linhas ?? [])
        total.erros.push(...deles.erros)
        total.enviadas += minhas.linhas.length
        total.recebidas += (resp.linhas ?? []).length
        await this.prisma.replicacaoCursor.update({ where: { par: 'online' }, data: { enviado: BigInt(minhas.ate), recebido: BigInt(resp.ate ?? cursor.recebido), uploadsAte: BigInt(up.ate), ultimaTroca: new Date(), ultimoErro: total.erros.slice(0, 3).join(' | ').slice(0, 1000) } })
        total.ficheiros = (total.ficheiros ?? 0) + up.ficheiros.length
        if (!minhas.mais && !resp.mais && !up.mais) break
      }
      // a fila já enviada não faz falta
      const c = await this.prisma.replicacaoCursor.findUnique({ where: { par: 'online' } })
      if (c) await this.prisma.replicacaoFila.deleteMany({ where: { id: { lte: c.enviado }, criadaEm: { lt: new Date(Date.now() - 86_400_000) } } })
      return total
    } catch (e) {
      await this.prisma.replicacaoCursor.upsert({ where: { par: 'online' }, create: { par: 'online', ultimoErro: e.message.slice(0, 1000) }, update: { ultimoErro: e.message.slice(0, 1000) } }).catch(() => {})
      throw e
    } finally {
      this.aTrocar = false
    }
  }

  async estado() {
    const [cursores, porEnviar] = await Promise.all([this.prisma.replicacaoCursor.findMany(), this.prisma.replicacaoFila.count({ where: { origem: '' } })])
    return { sistema: this.sistema, url: this.url, porEnviar, pares: cursores.map((c) => ({ par: c.par, enviado: c.enviado.toString(), recebido: c.recebido.toString(), ultimaTroca: c.ultimaTroca, ultimoErro: c.ultimoErro })) }
  }

  iniciar() {
    if (this.sistema === 'online' || !this.url || this.temporizador) return
    const correr = () => this.trocar().catch((e) => this.registar({ nivel: 'erro', mensagem: 'Replicação com o servidor online', erro: e.message }))
    this.temporizador = setInterval(correr, this.intervaloS * 1000)
    this.temporizador.unref?.()
    setTimeout(correr, 2000).unref?.()
  }

  parar() {
    clearInterval(this.temporizador)
    this.temporizador = null
  }
}
