import { ErroValidacao } from '../../../dominio/comum/erros.js'
import { TIPOS_MATERIAL } from '../../../dominio/academico/atividades/materiais.js'
import { validarLicao, validarLivro } from '../../../dominio/academico/atividades/livroLicao.js'
import { validarComentarios, validarPergunta } from '../../../dominio/academico/atividades/questionarios.js'
import { RESULTADOS } from '../../../dominio/academico/atividades/inqueritos.js'
import { validarPerguntasOpiniao } from '../../../dominio/comum/opiniao.js'
import { validarGrelha } from '../../../dominio/academico/avaliacao/grelha.js'
import { urlSegura } from '../../../dominio/comum/urls.js'
import { assinaturaPrivadaValida, TIPOS_PRIVADOS } from '../../../infraestrutura/ficheiros/privados.js'
import { criarZip, lerArquivo } from '../../../infraestrutura/copias/arquivo.js'
import { lerCursoMoodle } from '../../../infraestrutura/copias/moodle.js'
import { quem } from '../partilhado/autor.js'
import { COMPONENTES_NOTA } from '../../../dominio/academico/avaliacao/resultado.js'
import { TIPOS_ITEM_NOTA } from '../../../dominio/academico/avaliacao/composicao.js'
import { TIPOS_EVENTO } from '../../../dominio/academico/organizacao/calendario.js'

const FORMATO = 'esgfaa-cadeira'
const VERSAO = 1
const DIA_MS = 86_400_000

// leitura defensiva dos campos de uma cópia (pode vir de qualquer lado)
const str = (v, max = 300) => String(v ?? '').slice(0, max)
const num = (v, def = 0, min = -1e9, max = 1e9) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def }
const bool = (v, def = false) => (typeof v === 'boolean' ? v : def)
const data = (v) => { if (!v) return null; const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d }
const lista = (v, max = 2000) => (Array.isArray(v) ? v.slice(0, max) : [])
const tentar = (f, def) => { try { return f() } catch { return def } }
const requisitos = (v) => lista(v, 20).filter((r) => r && ['material', 'trabalho', 'questionario', 'inquerito', 'workshop'].includes(r.tipo))
  .map((r) => ({ tipo: r.tipo, id: r.id, ...(r.notaMinima !== undefined ? { notaMinima: num(r.notaMinima, 0, 0, 20) } : {}) }))

/*
  Cópia de segurança de uma cadeira num ficheiro .zip (capítulos, materiais com os ficheiros, trabalhos,
  questionários, sondagens, avaliação por pares, datas, programa e composição das notas — sem entregas,
  notas nem dados dos estudantes) e restauração a partir desse ficheiro ou de uma cópia do Moodle (.mbz).
  O que se restaura junta-se ao que a cadeira já tem.
*/
export class ServicoCopiaSeguranca {
  constructor({ copiasRepo, academico, privados, apoio, auditoria, filtroHtml, relogio, config }) {
    Object.assign(this, { copiasRepo, academico, privados, apoio, auditoria, filtroHtml, relogio, config })
  }

  async exportar(ctx, cadeiraId) {
    const cadeira = await this.apoio.cadeiraDoDocente(ctx.conta, cadeiraId)
    const c = await this.copiasRepo.conteudoDe(cadeira.id)
    const entradas = {}
    const ficheiros = []
    for (const f of c.ficheiros) {
      try {
        entradas[`ficheiros/${f.id}`] = this.privados.ler(f.caminho)
        ficheiros.push({ id: f.id, nome: f.nome, tipo: f.tipo, tamanho: f.tamanho })
      } catch { /* ficheiro em falta no disco: fica de fora */ }
    }
    // sem a alocação dos docentes nem os caminhos no disco
    const o = c.cadeira
    entradas['cadeira.json'] = JSON.stringify({
      formato: FORMATO, versao: VERSAO, exportadoEm: this.relogio.agora().toISOString(),
      cadeira: { codigo: o.codigo, nome: o.nome, programa: o.programa, programaFicheiroId: o.programaFicheiroId },
      ficheiros, secoes: c.secoes, materiais: c.materiais, trabalhos: c.trabalhos, questionarios: c.questionarios,
      sondagens: c.sondagens, workshops: c.workshops, eventos: c.eventos, composicoes: c.composicoes,
    })
    await this.auditoria.registar(ctx, { acao: 'exportar_cadeira', colecao: 'cadeiras', alvoId: cadeira.id, alvoTitulo: `${cadeira.codigo} — ${cadeira.nome}`, utilizador: quem(ctx.conta) })
    const dia = this.relogio.agora().toISOString().slice(0, 10)
    return { nome: `Cópia ${cadeira.codigo} ${cadeira.nome} ${dia}.zip`.replace(/[\\/:*?"<>|]/g, ''), dados: criarZip(entradas) }
  }

  async restaurar(ctx, cadeiraId, ficheiro) {
    const destino = await this.apoio.cadeiraDoDocente(ctx.conta, cadeiraId)
    if (!ficheiro?.dados?.length) throw new ErroValidacao('Escolha o ficheiro da cópia (.zip do ESGFAA ou .mbz do Moodle).', { campo: 'ficheiro' })
    const { formato, entradas } = lerArquivo(ficheiro.dados)
    const ignorados = {}
    const r = formato === 'esgfaa' ? await this.#doEsgfaa(ctx, entradas, ignorados) : await this.#doMoodle(ctx, entradas, ignorados)
    const resumo = await this.copiasRepo.aplicar(destino.id, r.conteudo, { ficheiros: r.ficheiros, docentes: false, data: (d) => new Date(d), dia: (s) => s })
    await this.auditoria.registar(ctx, { acao: 'restaurar_cadeira', colecao: 'cadeiras', alvoId: destino.id, alvoTitulo: `${destino.codigo} — ${formato === 'moodle' ? 'cópia do Moodle' : 'cópia de segurança'}`, detalhes: { ...resumo, ignorados }, utilizador: quem(ctx.conta) })
    return { formato, origem: r.origem, ...resumo, ignorados }
  }

  // guarda um ficheiro de dentro da cópia, se for de um tipo aceite e for mesmo desse tipo
  async #guardarFicheiro(ctx, { nome, tipo, dados }, ignorados) {
    const b = Buffer.from(dados)
    if (!TIPOS_PRIVADOS[tipo] || !assinaturaPrivadaValida(b.subarray(0, 16), tipo) || b.length > this.config.tamanhoMaximoUpload) {
      ignorados.ficheiros = (ignorados.ficheiros || 0) + 1
      return null
    }
    const novo = this.privados.guardar(b, tipo)
    await this.academico.criarFicheiro({ id: novo.id, caminho: novo.caminho, nome: str(nome, 200) || 'ficheiro', tipo, tamanho: b.length, donoId: ctx.conta.id })
    return novo.id
  }

  async #doEsgfaa(ctx, entradas, ignorados) {
    let j
    try { j = JSON.parse(new TextDecoder().decode(entradas['cadeira.json'])) } catch { throw new ErroValidacao('A cópia está danificada (cadeira.json).', { campo: 'ficheiro' }) }
    if (j?.formato !== FORMATO || num(j.versao) > VERSAO) throw new ErroValidacao('Esta cópia é de uma versão mais recente do sistema ou não é de uma cadeira.', { campo: 'ficheiro' })
    const ficheiros = {}
    for (const f of lista(j.ficheiros, 5000)) {
      const dados = entradas[`ficheiros/${str(f.id, 40)}`]
      if (dados) {
        const id = await this.#guardarFicheiro(ctx, { nome: f.nome, tipo: str(f.tipo, 120), dados }, ignorados)
        if (id) ficheiros[f.id] = id
      }
    }
    const html = (h) => this.filtroHtml(str(h, 200_000))
    const base = (a) => ({ id: a.id, secaoId: a.secaoId ?? null, visivel: bool(a.visivel, true), disponivelDe: data(a.disponivelDe), requisitos: requisitos(a.requisitos), titulo: str(a.titulo, 300) || 'Sem título', descricao: str(a.descricao, 3000) })
    const conteudo = {
      cadeira: { programa: j.cadeira?.programa ? html(j.cadeira.programa) : null, programaFicheiroId: j.cadeira?.programaFicheiroId ?? null },
      secoes: lista(j.secoes, 200).map((s, i) => ({ id: s.id, ordem: num(s.ordem, i, 0, 10_000), titulo: str(s.titulo, 200) || `Capítulo ${i + 1}`, resumo: str(s.resumo, 3000), visivel: bool(s.visivel, true), disponivelDe: data(s.disponivelDe) })),
      materiais: lista(j.materiais).filter((m) => TIPOS_MATERIAL.includes(m.tipo)).map((m) => ({
        ...base(m), tipo: m.tipo, autorId: ctx.conta.id, ficheiroId: m.ficheiroId ?? null,
        url: m.url && urlSegura(str(m.url, 2000)) ? str(m.url, 2000) : '',
        conteudo: m.conteudo ? html(m.conteudo) : '',
        estrutura: m.tipo === 'livro' ? tentar(() => validarLivro(m.estrutura, this.filtroHtml), []) : m.tipo === 'licao' ? tentar(() => validarLicao(m.estrutura, this.filtroHtml), []) : [],
        inicio: data(m.inicio), duracao: m.duracao ? num(m.duracao, 60, 5, 600) : null,
        ficheiros: lista(m.ficheiros, 200).map((f, i) => ({ ficheiroId: f.ficheiroId, ordem: num(f.ordem, i, 0, 10_000) })),
      })),
      trabalhos: lista(j.trabalhos).map((t) => ({
        ...base(t), enunciado: str(t.enunciado, 10_000), prazo: data(t.prazo) || new Date(this.relogio.agora().getTime() + 30 * DIA_MS), aceitaAtraso: bool(t.aceitaAtraso),
        ficheiroId: t.ficheiroId ?? null, tipoEntrega: ['ficheiro', 'texto', 'ambos'].includes(t.tipoEntrega) ? t.tipoEntrega : 'ficheiro', maxFicheiros: num(t.maxFicheiros, 1, 1, 10),
        grelha: tentar(() => validarGrelha(t.grelha), []), emGrupo: bool(t.emGrupo), anonimo: bool(t.anonimo) && !bool(t.emGrupo), notasOcultas: bool(t.notasOcultas) || bool(t.anonimo),
      })),
      questionarios: lista(j.questionarios, 500).map((q) => ({
        ...base(q), abre: data(q.abre), fecha: data(q.fecha), duracao: num(q.duracao, 0, 0, 600), tentativas: num(q.tentativas, 1, 0, 50), publicado: false,
        mostrarRespostas: bool(q.mostrarRespostas, true), baralhar: bool(q.baralhar), perguntasPorTentativa: num(q.perguntasPorTentativa, 0, 0, 500),
        porPagina: num(q.porPagina, 0, 0, 500), sequencial: bool(q.sequencial), comentarios: tentar(() => validarComentarios(q.comentarios), []),
        perguntas: lista(q.perguntas, 500).map((p, i) => tentar(() => ({ ordem: num(p.ordem, i, 0, 10_000), ...validarPergunta({ ...p, pontos: p.pontos === undefined ? 1 : String(p.pontos) }) }), null)).filter(Boolean),
      })),
      sondagens: lista(j.sondagens, 200).map((i) => tentar(() => ({
        ...base(i), perguntas: validarPerguntasOpiniao(i.perguntas), anonimo: bool(i.anonimo), resultados: RESULTADOS.includes(i.resultados) ? i.resultados : 'apos_responder', fecha: data(i.fecha),
      }), null)).filter(Boolean),
      workshops: lista(j.workshops, 200).map((w) => ({
        ...base(w), enunciado: str(w.enunciado, 10_000), grelha: tentar(() => validarGrelha(w.grelha), []),
        fimSubmissao: data(w.fimSubmissao) || new Date(this.relogio.agora().getTime() + 14 * DIA_MS), fimAvaliacao: data(w.fimAvaliacao) || new Date(this.relogio.agora().getTime() + 21 * DIA_MS),
        avaliacoesPorPar: num(w.avaliacoesPorPar, 3, 1, 10), anonimo: bool(w.anonimo, true),
      })),
      eventos: lista(j.eventos, 500).filter((e) => /^\d{4}-\d{2}-\d{2}$/.test(String(e.data)) && e.tipo in TIPOS_EVENTO).map((e) => ({ tipo: e.tipo, titulo: str(e.titulo, 200) || 'Data', data: String(e.data), inicio: /^\d{2}:\d{2}$/.test(e.inicio) ? e.inicio : '', fim: /^\d{2}:\d{2}$/.test(e.fim) ? e.fim : '', local: str(e.local, 200), descricao: str(e.descricao, 2000) })),
      composicoes: lista(j.composicoes, 10).filter((x) => COMPONENTES_NOTA.includes(x.componente)).map((x) => ({ componente: x.componente, itens: lista(x.itens, 30).filter((i) => TIPOS_ITEM_NOTA.includes(i.tipo)).map((i) => ({ tipo: i.tipo, id: i.id, peso: num(i.peso, 1, 0, 100) })) })),
      docencias: [],
    }
    return { conteudo, ficheiros, origem: `${str(j.cadeira?.codigo, 20)} ${str(j.cadeira?.nome, 200)}`.trim() }
  }

  async #doMoodle(ctx, entradas, ignorados) {
    const curso = lerCursoMoodle(entradas)
    Object.assign(ignorados, curso.ignorados)
    const ficheiros = {}
    let n = 0
    const guardar = async (f) => { const id = await this.#guardarFicheiro(ctx, f, ignorados); if (id) ficheiros[`m${++n}`] = id; return id ? `m${n}` : null }
    // o tópico 0 do Moodle (sem título) é a secção geral da cadeira; os outros são capítulos
    const secoes = curso.secoes.filter((s) => !s.geral).sort((a, b) => a.numero - b.numero)
    const chaveSecao = new Set(secoes.map((s) => s.chave))
    const secaoDe = (chave) => (chaveSecao.has(chave) ? chave : null)
    const materiais = []
    const trabalhos = []
    let id = 0
    for (const a of curso.atividades) {
      const comum = { id: ++id, secaoId: secaoDe(a.secao), visivel: true, disponivelDe: null, requisitos: [], titulo: str(a.titulo, 300) || 'Sem título', descricao: str(a.descricao, 3000) }
      if (a.tipo === 'trabalho') {
        trabalhos.push({ ...comum, enunciado: str(a.enunciado, 10_000), prazo: a.prazo || new Date(this.relogio.agora().getTime() + 30 * DIA_MS), aceitaAtraso: false, ficheiroId: null, tipoEntrega: 'ficheiro', maxFicheiros: 1, grelha: [], emGrupo: false, anonimo: false, notasOcultas: false })
        continue
      }
      const m = { ...comum, tipo: a.tipo, autorId: ctx.conta.id, ficheiroId: null, url: '', conteudo: '', estrutura: [], inicio: null, duracao: null, ficheiros: [] }
      if (a.tipo === 'pagina') m.conteudo = this.filtroHtml(str(a.conteudo, 200_000))
      if (a.tipo === 'ligacao') {
        if (!/^https?:\/\//.test(a.url) || !urlSegura(a.url)) { ignorados.ligacoes = (ignorados.ligacoes || 0) + 1; continue }
        m.url = str(a.url, 2000)
      }
      if (a.tipo === 'ficheiro') {
        m.ficheiroId = a.ficheiros[0] ? await guardar(a.ficheiros[0]) : null
        if (!m.ficheiroId) continue
      }
      if (a.tipo === 'pasta') {
        for (const f of a.ficheiros.slice(0, 200)) { const k = await guardar(f); if (k) m.ficheiros.push({ ficheiroId: k, ordem: m.ficheiros.length }) }
        if (!m.ficheiros.length) continue
      }
      materiais.push(m)
    }
    const conteudo = {
      cadeira: { programa: null, programaFicheiroId: null },
      secoes: secoes.map((s, i) => ({ id: s.chave, ordem: i + 1, titulo: str(s.titulo, 200), resumo: str(s.resumo, 3000), visivel: s.visivel, disponivelDe: null })),
      materiais, trabalhos, questionarios: [], sondagens: [], workshops: [], eventos: [], composicoes: [], docencias: [],
    }
    return { conteudo, ficheiros, origem: curso.titulo }
  }
}
