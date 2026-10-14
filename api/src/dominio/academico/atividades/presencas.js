// Presenças nas aulas e assiduidade.

export const ESTADOS_PRESENCA = ['presente', 'falta', 'justificada']

// percentagem de presença (justificadas não contam como falta)
export function assiduidade(presencas) {
  if (!presencas.length) return null
  const contam = presencas.filter((p) => p.estado !== 'justificada')
  if (!contam.length) return 100
  return Math.round((contam.filter((p) => p.estado === 'presente').length / contam.length) * 100)
}
