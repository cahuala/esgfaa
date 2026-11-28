#!/usr/bin/env node
/*
  Carga inicial da Gestão Escolar, na instalação (e em cada actualização; não repete nada):
    - arranque-*.json        as turmas do ano lectivo com as cadeiras dos planos, as matrículas, o departamento de
                             cada cadeira e os docentes habituais (propostos ao Comandante);
    - gestao-pautas*.json    as pautas assinadas do arquivo (as notas, a média final e a classificação), com as contas
                             dos discentes que o Pessoal ainda não enviou (activas, para verem as notas).
  O que já está no sistema não muda; os anos fechados ficam de fora.
    node --env-file=<config> scripts/carregar-inicial.js <pasta com os ficheiros> [relatorio.txt]
*/
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

// quem carrega: a instalação (fica no registo de actividades)
const INSTALACAO = { id: null, nome: 'Instalação (carga inicial do arquivo)', papel: 'administrador', pode: () => true, exigir: () => {} }

export async function carregarInicial(contentor, pasta) {
  const linhas = [`Carga inicial da Gestão Escolar — ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`, '']
  const ctx = { actor: INSTALACAO, ip: null, agente: 'instalador' }
  const arq = contentor.servicos.administracaoEscolar.arquivo
  const ficheiros = fs.existsSync(pasta) ? fs.readdirSync(pasta).filter((f) => f.endsWith('.json')).sort() : []
  if (!ficheiros.length) return [...linhas, `Sem ficheiros para carregar em ${pasta}.`]
  // primeiro o arranque do ano (o catálogo das cadeiras), depois o arquivo
  // pela ordem certa: o arranque do ano (o catálogo), as pautas e as turmas do arquivo, os docentes de cada ano (precisam
  // das turmas) e os horários (precisam dos docentes nas turmas)
  const ORDEM = { 'arranque-ano-lectivo': 0, 'arquivo-administracao-escolar': 1, 'docentes-dos-anos': 2, 'docentes-horarios': 3 }
  const lidos = ficheiros.map((f) => ({ f, j: JSON.parse(fs.readFileSync(path.join(pasta, f), 'utf8')) })).sort((a, b) => (ORDEM[a.j.tipo] ?? 1) - (ORDEM[b.j.tipo] ?? 1) || a.f.localeCompare(b.f))
  for (const { f, j } of lidos) {
    try {
      // os docentes dos horários do arquivo: ficam guardados para a Repartição confirmar (Docentes dos horários)
      if (j.tipo === 'docentes-horarios') {
        const g = await contentor.servicos.administracaoEscolar.docentesHorarios.guardar(ctx, { linhas: j.linhas ?? [] })
        // os anos anteriores sem dúvida ficam logo; o resto espera pela Repartição
        const sd = await contentor.servicos.administracaoEscolar.docentesHorarios.confirmarSemDuvida(ctx)
        linhas.push(`${f}: ${g.linhas} linha(s) dos horários guardadas; ${sd.feitas} docente(s) sem dúvida ficaram nas cadeiras dos anos anteriores — os outros confirma-os a Repartição em «Docentes dos horários do arquivo».`, '')
        continue
      }
      // os docentes de cada ano anterior (as listas do corpo docente): nas cadeiras desse ano
      if (j.tipo === 'docentes-dos-anos') {
        const g = await arq.guardarDocentesDosAnos(ctx, j.anos ?? [])
        linhas.push(`${f}: as listas do corpo docente de ${g.anos} ano(s) lectivo(s) guardadas; ${g.propostos} docente(s) ficaram nas cadeiras desses anos (os que ainda não chegaram do Pessoal entram quando chegarem).`, '')
        continue
      }
      const r = j.tipo === 'arranque-ano-lectivo'
        ? await arq.arrancar(ctx, { anoLetivo: j.anoLetivo, cadeiras: j.cadeiras ?? [], turmas: j.turmas ?? [], simular: false })
        : await arq.importar(ctx, { turmas: j.turmas ?? [], simular: false })
      linhas.push(`${f}:`)
      for (const t of r.turmas) {
        linhas.push(`   ${t.turma}: ${t.estado}${t.motivo ? ` — ${t.motivo}` : ''}${t.discentes !== undefined ? ` · ${t.discentes} discente(s), ${t.comConta} com conta` : ''}${t.contasNovas?.length ? `, ${t.contasNovas.length} conta(s) criada(s)` : ''}`)
        if (t.semConta?.length) linhas.push(`      sem conta (não se pôde criar): ${t.semConta.join('; ')}`)
      }
      if (j.avisos?.length) linhas.push('   Para conferir:', ...j.avisos.map((a) => `   - ${a}`))
    } catch (e) {
      linhas.push(`${f}: ERRO — ${e.message}`)
    }
    linhas.push('')
  }
  return linhas
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [pasta, relatorio] = process.argv.slice(2)
  if (!pasta || !fs.existsSync(pasta)) {
    console.log('Sem dados para a carga inicial.')
    process.exit(0)
  }
  const { criarConfig } = await import('../src/infraestrutura/config.js')
  const { criarContentor } = await import('../src/contentor.js')
  const contentor = criarContentor(criarConfig())
  let linhas
  try {
    linhas = await carregarInicial(contentor, pasta)
  } finally {
    await contentor.fechar()
  }
  const texto = linhas.join('\n')
  console.log(texto)
  if (relatorio) fs.writeFileSync(relatorio, `\uFEFF${texto.replace(/\n/g, '\r\n')}\r\n`)
}
