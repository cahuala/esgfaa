import fs from 'node:fs'
import jwt from 'jsonwebtoken'
import { Conflito, ErroValidacao, NaoEncontrado } from '../../../dominio/comum/erros.js'
import { TIPOS_PACOTE } from '../../../dominio/academico/atividades/materiais.js'
import { extrairPacote, ficheiroDoPacote, pacoteExiste } from '../../../infraestrutura/ficheiros/pacotes.js'

const AUDIENCIA = 'esgfaa-pacote'
const ESTADOS = ['iniciado', 'concluido', 'aprovado', 'reprovado']
const FEITO = new Set(['concluido', 'aprovado'])
const MAX_DADOS = 70_000 // o SCORM 2004 guarda até 64 000 caracteres em suspend_data

/*
  Pacotes SCORM e H5P dentro do portal. O portal pede um endereço (válido 8 horas, com a cadeira, o material
  e quem o abre assinados) e mostra-o numa moldura; a API serve o leitor e os ficheiros do pacote nesse
  endereço, e recebe dele o estado (concluído, aprovado…) e a nota, que contam para o progresso.
*/
export class ServicoPacotes {
  constructor({ pacotes, academico, recursos, contas, apoio, disponibilidade, registos, privados, segredo }) {
    Object.assign(this, { pacotes, academico, recursos, contas, apoio, disponibilidade, registos, privados, segredo })
  }

  // ao criar o material: confirma que o zip é um pacote do tipo certo e abre-o
  abrirZip(caminhoZip, tipo) {
    return extrairPacote(this.privados, fs.readFileSync(caminhoZip), tipo)
  }

  async #materialAcessivel(conta, materialId) {
    const m = await this.academico.material(materialId)
    if (!m || !TIPOS_PACOTE.includes(m.tipo)) throw new NaoEncontrado('Conteúdo não encontrado.')
    if (conta.tipo === 'docente') await this.apoio.cadeiraDoDocente(conta, m.cadeiraId)
    else {
      await this.apoio.cadeiraAcessivel(conta, m.cadeiraId)
      await this.disponibilidade.exigir(m.cadeiraId, conta.id, 'material', m.id)
    }
    return m
  }

  // pacote restaurado de uma cópia ou copiado de outro servidor: abre-se outra vez a partir do zip guardado
  async #garantirAberto(m) {
    if (pacoteExiste(this.privados, m.estrutura?.pasta)) return m.estrutura
    const f = m.ficheiroId && (await this.academico.ficheiro(m.ficheiroId))
    if (!f) throw new Conflito('O pacote deste conteúdo já não existe. Volte a carregá-lo.')
    const estrutura = extrairPacote(this.privados, this.privados.ler(f.caminho), m.tipo)
    await this.pacotes.atualizarEstrutura(m.id, estrutura)
    return estrutura
  }

  async abrir(ctx, materialId, base) {
    const m = await this.#materialAcessivel(ctx.conta, materialId)
    await this.#garantirAberto(m)
    if (ctx.conta.tipo === 'estudante') await this.registos?.registar(ctx.conta, m.cadeiraId, 'material', m.id)
    const token = jwt.sign({ m: m.id, c: ctx.conta.id }, this.segredo, { audience: AUDIENCIA, expiresIn: '8h', algorithm: 'HS256' })
    return { url: `${base}/api/pacotes/${token}/__leitor`, tipo: m.tipo }
  }

  #lerToken(token) {
    try {
      const p = jwt.verify(String(token), this.segredo, { audience: AUDIENCIA, algorithms: ['HS256'] })
      return { materialId: Number(p.m), contaId: Number(p.c) }
    } catch {
      throw new NaoEncontrado('Este endereço expirou. Abra outra vez o conteúdo no portal.')
    }
  }

  // o que o leitor precisa: tipo, página inicial, quem é e o progresso guardado
  async leitor(token) {
    const { materialId, contaId } = this.#lerToken(token)
    const [m, conta] = await Promise.all([this.academico.material(materialId), this.contas.porId(contaId)])
    if (!m || !conta?.ativo) throw new NaoEncontrado('Conteúdo não encontrado.')
    const estrutura = await this.#garantirAberto(m)
    const progresso = conta.tipo === 'estudante' ? await this.pacotes.progresso(m.id, conta.id) : null
    return { tipo: m.tipo, titulo: m.titulo, estrutura, conta: { id: conta.id, nome: conta.nome, numero: conta.numero || String(conta.id) }, eEstudante: conta.tipo === 'estudante', progresso }
  }

  async ficheiro(token, caminho) {
    const { materialId } = this.#lerToken(token)
    const m = await this.academico.material(materialId)
    const f = m && ficheiroDoPacote(this.privados, m.estrutura?.pasta, caminho)
    if (!f) throw new NaoEncontrado('Ficheiro não encontrado.')
    return f
  }

  // o pacote envia o estado; só conta para os estudantes (o docente pode experimentar à vontade)
  async guardarEstado(token, { estado, nota, dados, tempoSegundos }) {
    const { materialId, contaId } = this.#lerToken(token)
    const conta = await this.contas.porId(contaId)
    if (!conta?.ativo) throw new NaoEncontrado('Conteúdo não encontrado.')
    if (conta.tipo !== 'estudante') return { guardado: false }
    const atual = await this.pacotes.progresso(materialId, contaId)
    const mudanca = {}
    if (estado !== undefined) {
      if (!ESTADOS.includes(estado)) throw new ErroValidacao('Estado desconhecido.')
      // depois de concluído não volta a "iniciado"
      mudanca.estado = FEITO.has(atual?.estado) && !FEITO.has(estado) && estado !== 'reprovado' ? atual.estado : estado
    }
    if (nota !== undefined && nota !== null) {
      const n = Number(nota)
      if (!Number.isFinite(n) || n < 0 || n > 20) throw new ErroValidacao('A nota vai de 0 a 20.')
      mudanca.nota = Math.round(n * 100) / 100
    }
    if (dados !== undefined) {
      if (!dados || typeof dados !== 'object' || Array.isArray(dados) || JSON.stringify(dados).length > MAX_DADOS) throw new ErroValidacao('Dados do pacote inválidos ou demasiado grandes.')
      mudanca.dados = dados
    }
    if (tempoSegundos !== undefined) mudanca.tempoSegundos = Math.min(10_000_000, Math.max(atual?.tempoSegundos || 0, Math.round(Number(tempoSegundos) || 0)))
    const p = await this.pacotes.guardar(materialId, contaId, mudanca)
    if (FEITO.has(p.estado) && !FEITO.has(atual?.estado)) await this.recursos.marcarConclusao(materialId, contaId, true)
    return { guardado: true, estado: p.estado, nota: p.nota }
  }

  // para o docente: o estado e a nota de cada estudante da turma
  async resultados(ctx, materialId) {
    const m = await this.academico.material(materialId)
    if (!m || !TIPOS_PACOTE.includes(m.tipo)) throw new NaoEncontrado('Conteúdo não encontrado.')
    const cadeira = await this.apoio.cadeiraDoDocente(ctx.conta, m.cadeiraId)
    const [estudantes, lista] = await Promise.all([this.academico.estudantesDaCadeira(cadeira), this.pacotes.doMaterial(m.id)])
    const de = Object.fromEntries(lista.map((p) => [p.estudanteId, p]))
    return {
      linhas: estudantes.map((e) => ({ estudante: { id: e.id, nome: e.nome, numero: e.numero }, estado: de[e.id]?.estado || 'nao_iniciado', nota: de[e.id]?.nota ?? null, tempoSegundos: de[e.id]?.tempoSegundos || 0, atualizadoEm: de[e.id]?.atualizadoEm || null })),
    }
  }
}
