// Pauta geral da turma: síntese de um estudante a partir dos resultados nas várias cadeiras.

const aprovada = (r) => r && (r.situacao === 'aprovado' || r.situacao === 'dispensado')

// resultados: [{ final, situacao } | null] -> média das aprovadas, aprovadas, em falta
export function mediaDaPautaGeral(resultados) {
  const feitas = resultados.filter(aprovada)
  const media = feitas.length ? Math.round((feitas.reduce((s, r) => s + Number(r.final), 0) / feitas.length) * 10) / 10 : null
  return {
    media,
    aprovadas: feitas.length,
    reprovadas: resultados.filter((r) => r?.situacao === 'reprovado').length,
    total: resultados.length,
    situacaoAno: resultados.length && feitas.length === resultados.length ? 'transita' : resultados.some((r) => !r || ['em_curso', 'exame', 'recurso'].includes(r.situacao)) ? 'em_curso' : 'com_cadeiras_em_atraso',
  }
}
