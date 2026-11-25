#!/usr/bin/env node
/*
  Carrega as relações nominais que vêm no pendrive (carregar/relacoes.json), na actualização:
    node --env-file=.env scripts/carregar-relacoes.js <relacoes.json> [<relatorio.txt>]
  1. a orgânica: acrescenta as unidades e os cargos que faltam (o que já existe fica como está: não se muda nem
     se apagam lugares);
  2. as fichas novas: militares, civis e domiciliares (por esta ordem; os domiciliares ligam-se ao oficial pelo NIP);
  3. os docentes e os estudantes (listas do corpo docente, dos discentes do ano lectivo e dos finalistas dos anos
     anteriores), uma só vez por versão das listas (ver carregarAcademicos).
  Nunca apaga nem altera o que já está no sistema: quem já existe fica como está («já existia»). Pode correr-se
  em todas as actualizações. Escreve um relatório (o que entrou, o que já existia e as linhas com problema).
*/
import fs from 'node:fs'
import { pathToFileURL } from 'node:url'

const sem = (t) => String(t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[.\s]+/g, ' ').trim()
const PARTICULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e'])
const palavras = (n) => new Set(sem(n).split(' ').filter((w) => w && !PARTICULAS.has(w)))
// o mesmo número com outro nome só é a mesma pessoa se os nomes tiverem pelo menos dois nomes em comum
const parecidos = (a, b) => { const x = palavras(a); return [...palavras(b)].filter((w) => x.has(w)).length >= 2 }
// age como o administrador do sistema (fica na auditoria como «carregamento das relações nominais»)
const QUEM = { email: 'carregamento das relações nominais', nome: 'Carregamento', papel: 'administrador' }

// devolve as linhas do relatório
export async function carregarRelacoes(contentor, dados, u = QUEM) {
  const linhas = [`Relações nominais (${dados.geradoEm ?? ''}) — carregadas em ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`, '']
  // 1. orgânica: só as unidades e os cargos que ainda não existem
  const existentes = await contentor.bd.cargo.findMany({ select: { nome: true, unidade: { select: { nome: true } } } })
  const ja = new Set(existentes.map((c) => `${sem(c.unidade?.nome)}|${sem(c.nome)}`))
  const novas = (dados.organica ?? []).filter((l) => !ja.has(`${sem(l.unidade)}|${sem(l.cargo)}`))
  if (novas.length) {
    const r = await contentor.servicos.organica.importarQuadro(u, { linhas: novas, simular: false })
    linhas.push(`Orgânica: ${r.resumo.unidades} unidade(s) e ${r.resumo.cargos} cargo(s) acrescentados${r.resumo.erros ? `, ${r.resumo.erros} linha(s) com problema` : ''}.`)
    for (const x of r.linhas.filter((y) => y.acao === 'erro')) linhas.push(`   - ${x.unidade} / ${x.cargo}: ${x.erro}`)
  } else linhas.push('Orgânica: nada a acrescentar (as unidades e os cargos já existem).')
  // 2. fichas novas
  for (const [nome, lista] of [['Militares', dados.militares], ['Civis', dados.civis], ['Domiciliares', dados.domiciliares]]) {
    if (!lista?.length) continue
    const r = await contentor.servicos.importacao.importar(u, { modo: 'novos', linhas: lista, simular: false })
    const jaExistia = r.linhas.filter((x) => x.acao === 'erro' && /^Já existe/.test(x.erro))
    const erros = r.linhas.filter((x) => x.acao === 'erro' && !/^Já existe/.test(x.erro))
    linhas.push('', `${nome}: ${r.resumo.validas} ficha(s) nova(s), ${jaExistia.length} já existia(m), ${erros.length} com problema.`)
    for (const x of erros) linhas.push(`   - ${x.nome || x.identificacao}: ${x.erro}`)
    for (const x of r.linhas.filter((y) => y.avisos?.length)) for (const a of x.avisos) linhas.push(`   · ${x.nome}: ${a}`)
  }
  // 3. docentes e estudantes
  if (dados.academicos?.pessoas?.length) linhas.push(...await carregarAcademicos(contentor, dados.academicos, u))
  return linhas
}

const CHAVE_ACADEMICOS = 'carga-docentes-discentes'
const tipoDoCurso = (n) => (/promo[cç][aã]o/i.test(n) ? 'promocao' : /actualiza|capacita/i.test(n) ? 'actualizacao' : /l[ií]ngua/i.test(n) ? 'qualificacao' : 'formacao')
// os cursos que a lei pede para a promoção (só quando já foram concluídos)
const chaveDoCurso = (n) => (/promo[cç][aã]o [aà] oficial superior/i.test(n) ? 'promocao_oficial_superior' : /superior de comando e direc/i.test(n) ? 'comando_direccao' : null)

/*
  Docentes e estudantes das listas (o corpo docente, os discentes do ano lectivo e os finalistas dos anos
  anteriores), já juntos pela conversão: uma pessoa = uma linha, mesmo que venha em várias listas.
  - Quem já tem ficha (pelo NIP ou n.º de agente; sem eles, pelo nome completo) não é criado de novo nem os seus
    dados mudam: só se acrescenta o que falta — a função de docente ou de estudante (o efectivo que também dá aulas
    ou está num curso), o tipo de docente, a habilitação e a área de formação se estiverem em branco, e os cursos
    feitos na Escola que ainda não estão na ficha.
  - Quem não tem ficha entra: os docentes e os estudantes deste ano lectivo ficam na Escola; os finalistas dos anos
    anteriores ficam como saídos («Fim do curso», na data da relação), com o curso na ficha.
  - Os docentes da relação nominal do corpo docente já estão em funções: não se pede o despacho de docente novo.
  - Os casos duvidosos (o número é de outra pessoa; o mesmo nome com outro NIP e outro posto; várias fichas com o
    mesmo nome) não se tocam: vão para o relatório, para conferir.
  Corre uma só vez por versão das listas (fica registado em «definicoes»): o que se mudar depois à mão não volta.
*/
export async function carregarAcademicos(contentor, ac, u = QUEM) {
  const { bd } = contentor
  const s = contentor.servicos
  const linhas = ['', `Docentes e estudantes (${ac.versao}):`]
  const feita = await bd.definicao.findUnique({ where: { chave: CHAVE_ACADEMICOS } })
  if (feita?.valor?.versao === ac.versao) return [...linhas, `   já tinham sido carregados em ${String(feita.valor.em ?? '').slice(0, 10)} (não se repete).`]
  const todas = await bd.pessoa.findMany({ select: { id: true, nome: true, nip: true, numeroAgente: true, tipo: true, posto: true, vinculo: true, outrosVinculos: true, tipoDocente: true, habilitacao: true, areaFormacao: true, ativo: true, cursos: { select: { nome: true } } } })
  const porNumero = new Map()
  const porNome = new Map()
  const indexar = (p) => {
    for (const k of [p.nip, p.numeroAgente]) if (k) porNumero.set(String(k).toUpperCase(), p)
    porNome.set(sem(p.nome), [...(porNome.get(sem(p.nome)) ?? []), p])
  }
  todas.forEach(indexar)
  const n = { novas: 0, saidas: 0, acrescentadas: 0, iguais: 0, cursos: 0, anos: 0 }
  const conferir = []
  const avisos = []
  const erros = []
  // os anos lectivos em que foi docente ou estudante (cada lista de cada ano); os repetidos não entram
  const juntarAnos = async (p, anos = []) => {
    if (!anos.length) return
    const r = await bd.anoAcademico.createMany({ data: anos.map((a) => ({ pessoaId: p.id, anoLetivo: a.anoLetivo, papel: a.papel, curso: a.curso ?? '', tipoDocente: a.tipoDocente ?? null, concluido: a.concluido ?? null })), skipDuplicates: true })
    n.anos += r.count
  }
  const juntarCursos = async (p, cursos = []) => {
    for (const c of cursos) {
      if ((p.cursos ?? []).some((k) => sem(k.nome) === sem(c.nome))) continue
      await bd.curso.create({ data: { pessoaId: p.id, nome: c.nome, tipo: tipoDoCurso(c.nome), local: 'Escola Superior de Guerra', fim: c.fim ? new Date(c.fim) : null, aproveitamento: c.aproveitamento ?? null, chave: c.fim ? chaveDoCurso(c.nome) : null } })
      ;(p.cursos ??= []).push({ nome: c.nome })
      n.cursos++
    }
  }
  for (const x of ac.pessoas) {
    const numeros = [x.nip, x.numeroAgente, ...(x.outrosNips ?? [])].filter(Boolean).map((k) => String(k).toUpperCase())
    const quem = `${x.nome}${numeros[0] ? ` (${numeros[0]})` : ''}`
    try {
      let p = numeros.map((k) => porNumero.get(k)).find(Boolean)
      if (p && !parecidos(p.nome, x.nome)) { conferir.push(`${quem}: no sistema esse número é de ${p.nome} — não se mexeu.`); continue }
      if (!p) {
        const mesmos = porNome.get(sem(x.nome)) ?? []
        if (mesmos.length > 1) { conferir.push(`${quem}: há ${mesmos.length} fichas com este nome — não se mexeu.`); continue }
        const y = mesmos[0]
        const numeroY = y && String(y.nip || y.numeroAgente || '').toUpperCase()
        // o mesmo nome com outro NIP: é a mesma pessoa (NIP mal escrito) se o posto também for o mesmo. Um nome curto
        // (duas palavras) com outro NIP é outra pessoa. Com outro posto: se a lista é deste ano (docente ou
        // estudante), são duas pessoas; se é de um curso antigo, pode ter sido promovido desde então — fica para conferir
        const outroNumero = Boolean(y && numeros.length && numeroY && !numeros.includes(numeroY))
        const outroPosto = (y?.posto ?? '') !== (x.posto ?? '')
        const outra = outroNumero && (palavras(x.nome).size < 3 || (outroPosto && Boolean(x.docente || x.estudante)))
        if (outroNumero && outroPosto && !outra) { conferir.push(`${quem}: já há uma ficha com este nome (${numeroY}, outro posto) — é a mesma pessoa? Não se criou outra.`); continue }
        if (outra) avisos.push(`${quem}: há outra ficha com o mesmo nome (${numeroY}); são pessoas diferentes — entrou com ficha própria.`)
        p = outra ? null : y
      }
      if (p) {
        const vs = p.vinculo === 'domiciliar' ? ['domiciliar'] : [...new Set([p.vinculo, ...(p.outrosVinculos ?? [])])]
        if (vs.includes('domiciliar')) { conferir.push(`${quem}: a ficha com este nome/número é de uma empregada(o) domiciliar — não se mexeu.`); continue }
        const falta = [x.docente && !vs.includes('docente') && 'docente', x.estudante && !vs.includes('estudante') && 'estudante'].filter(Boolean)
        if (falta.length && !p.ativo) { conferir.push(`${quem}: a ficha está como saída da Escola; nas listas é ${falta.join(' e ')} — confirme e, se for o caso, ponha-a(o) outra vez na Escola.`); await juntarCursos(p, x.cursos); await juntarAnos(p, x.anos); continue }
        const d = {}
        if (falta.length) d.outrosVinculos = [...new Set([...(p.outrosVinculos ?? []), ...falta])].filter((v) => v !== p.vinculo)
        if (x.docente && !p.tipoDocente) d.tipoDocente = x.docente.tipo
        if (x.habilitacao && !p.habilitacao) d.habilitacao = x.habilitacao
        if (x.areaFormacao && !p.areaFormacao) d.areaFormacao = x.areaFormacao
        if (x.postoExterno && !p.postoExterno) d.postoExterno = x.postoExterno
        if (Object.keys(d).length) {
          await s.pessoas.editar(u, p.id, d, { silencioso: true, despachado: true })
          Object.assign(p, d)
          n.acrescentadas++
        } else n.iguais++
        await juntarCursos(p, x.cursos)
        await juntarAnos(p, x.anos)
        continue
      }
      // na Escola: os docentes da lista deste ano e os estudantes deste ano lectivo
      const ativo = Boolean((x.docente && !x.docente.antigo) || x.estudante)
      const d = { tipo: x.tipo, nome: x.nome, vinculo: x.docente ? 'docente' : 'estudante', outrosVinculos: x.docente && x.estudante ? ['estudante'] : [], ativo }
      for (const k of ['nomeGuerra', 'nip', 'numeroAgente', 'posto', 'ramo', 'fps', 'situacao', 'unidadeOrigem', 'postoExterno', 'nacionalidade', 'paisNascimento', 'habilitacao', 'areaFormacao', 'observacoes']) if (x[k]) d[k] = x[k]
      if (x.docente) d.tipoDocente = x.docente.tipo
      if (!ativo && x.docente) Object.assign(d, { motivoSaida: x.docente.motivoSaida ?? 'Já não consta da relação do corpo docente' })
      else if (!ativo) Object.assign(d, { motivoSaida: 'Fim do curso', dataSaidaEscola: x.ultimoFim ?? null })
      const g = await s.pessoas.criar(u, d, { silencioso: true, despachado: true })
      const novo = { ...g, cursos: [] }
      indexar(novo)
      n.novas++
      if (!ativo) n.saidas++
      await juntarCursos(novo, x.cursos)
      await juntarAnos(novo, x.anos)
    } catch (e) {
      erros.push(`${quem}: ${e.message}`)
    }
  }
  linhas.push(
    `   ${n.novas} ficha(s) nova(s) (${n.novas - n.saidas} na Escola: docentes e estudantes deste ano; ${n.saidas} finalistas de anos anteriores, como saídos).`,
    `   ${n.acrescentadas} ficha(s) que já existiam ficaram também como docente/estudante (ou com a habilitação que faltava); ${n.iguais} já tinham tudo.`,
    `   ${n.cursos} curso(s) feitos na Escola acrescentados às fichas; ${n.anos} ano(s) lectivo(s) de docente ou estudante registados.`,
  )
  if (conferir.length) linhas.push(`   Para conferir (${conferir.length}):`, ...conferir.map((t) => `   - ${t}`))
  if (avisos.length) linhas.push(`   Avisos (${avisos.length}):`, ...avisos.map((t) => `   · ${t}`))
  if (erros.length) linhas.push(`   Com problema (${erros.length}):`, ...erros.map((t) => `   - ${t}`))
  await bd.definicao.upsert({ where: { chave: CHAVE_ACADEMICOS }, create: { chave: CHAVE_ACADEMICOS, valor: { versao: ac.versao, em: new Date().toISOString(), ...n } }, update: { valor: { versao: ac.versao, em: new Date().toISOString(), ...n } } })
  await s.auditoria?.registar?.(u, 'importar_excel', `${n.novas} ficha(s) de docentes e estudantes (listas)`, n)
  return linhas
}

// corrido directamente (também no Windows, onde o caminho tem C:\ e barras ao contrário)
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [ficheiro, relatorio] = process.argv.slice(2)
  if (!ficheiro || !fs.existsSync(ficheiro)) {
    console.log('Sem relações nominais para carregar.')
    process.exit(0)
  }
  const { criarConfig } = await import('../src/config.js')
  const { criarContentor } = await import('../src/contentor.js')
  const contentor = criarContentor(criarConfig())
  let linhas
  try {
    linhas = await carregarRelacoes(contentor, JSON.parse(fs.readFileSync(ficheiro, 'utf8')))
  } finally {
    await contentor.fechar()
  }
  const texto = linhas.join('\n')
  console.log(texto)
  if (relatorio) fs.writeFileSync(relatorio, `\ufeff${texto.replace(/\n/g, '\r\n')}\r\n`)
}
