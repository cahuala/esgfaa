#!/usr/bin/env node
/*
  Carrega as relações nominais que vêm no pendrive (carregar/relacoes.json), na actualização:
    node --env-file=.env scripts/carregar-relacoes.js <relacoes.json> [<relatorio.txt>]
  1. a orgânica: acrescenta as unidades e os cargos que faltam (o que já existe fica como está: não se muda nem
     se apagam lugares);
  2. as fichas novas: militares, civis e domiciliares (por esta ordem; os domiciliares ligam-se ao oficial pelo NIP).
  Nunca apaga nem altera o que já está no sistema: quem já existe fica como está («já existia»). Pode correr-se
  em todas as actualizações. Escreve um relatório (o que entrou, o que já existia e as linhas com problema).
*/
import fs from 'node:fs'
import { pathToFileURL } from 'node:url'

const sem = (t) => String(t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[.\s]+/g, ' ').trim()
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
