import { NOMES_COMPONENTES, SITUACOES } from './regraAvaliacao'

const num = (v) => (v === null || v === undefined ? '' : String(v).replace('.', ','))
const campo = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`

/*
  Pauta em CSV para o Excel (separador ";" e vírgula decimal, como no Excel em português),
  com a MAC, a nota final, a situação e a classificação. linhas: as da pauta (com os valores atuais).
*/
export function exportarPautaExcel(cadeira, linhas) {
  const cabecalho = ['N.º', 'Estudante', 'Número', NOMES_COMPONENTES.p1, NOMES_COMPONENTES.p2, 'MAC', NOMES_COMPONENTES.exame, NOMES_COMPONENTES.recurso, 'Nota final', 'Situação', 'Classificação']
  const corpo = linhas.map((l, i) => [
    i + 1, l.estudante.nome, l.estudante.numero, num(l.p1), num(l.p2), num(l.mac), num(l.exame), num(l.recurso),
    l.situacao === 'recurso' ? '' : num(l.final), SITUACOES[l.situacao]?.texto || '', l.situacao === 'reprovado' ? '' : l.classificacao || '',
  ])
  const titulo = [[`Pauta — ${cadeira.codigo} ${cadeira.nome}`], [cadeira.turma?.nome || ''], []]
  const csv = [...titulo, cabecalho, ...corpo].map((r) => r.map(campo).join(';')).join('\r\n')
  const url = URL.createObjectURL(new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `Pauta ${cadeira.codigo} ${(cadeira.turma?.nome || '').replace(/[\\/:*?"<>|]/g, '')}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}
