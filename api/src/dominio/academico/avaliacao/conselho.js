import { erro } from '../comum/validacao.js'

/*
  Conselho de Curso e homologação (Plano de Curso, Secção III, n.º 4):
  - as qualidades pessoais de cada auditor/discente são detalhadas em juízo ampliativo, elaborado pelo
    Director de Ensino (ou Director de Curso), sobre os factores do plano (11; 10 no COAMP);
  - o Director de Ensino propõe ao Comandante o grau de aproveitamento; a classificação é confirmada em
    Conselho de Curso e homologada pelo Comandante da ESG;
  - ouvido o Conselho, o Comandante pode atribuir o DISTINTO ao melhor do curso (em caso de igualdade, sob
    proposta do Director de Ensino) e, nos planos que o prevêem, ajustar a média final (ex.: ±0,25 no COAMP).
  Estados da turma: aberto → proposta → confirmada (Conselho de Curso) → homologada (Comandante).
*/
export const FACTORES_JUIZO = {
  culturaMilitar: 'Cultura geral militar',
  culturaCientifica: 'Cultura científica e académica',
  autoconfianca: 'Autoconfiança e autodomínio',
  adaptabilidade: 'Adaptabilidade',
  iniciativa: 'Iniciativa',
  comunicacao: 'Poder de comunicação',
  senso: 'Senso e ponderação',
  decisao: 'Decisão',
  planeamento: 'Planeamento e organização',
  analise: 'Capacidade de análise, selecção e objectividade',
  trabalhoGrupo: 'Capacidade de coordenar e participar em trabalhos de grupo',
}
export const ESCALA_JUIZO = ['Muito Bom', 'Bom', 'Suficiente', 'Insuficiente']
export const ESTADOS_CONSELHO = { aberto: 'Em avaliação', proposta: 'Proposta do Director de Ensino', confirmada: 'Confirmada em Conselho de Curso', homologada: 'Homologada pelo Comandante' }

// os factores do juízo de um plano (o plano pode ter menos: o COAMP não tem «Cultura científica e académica»)
export const factoresDoPlano = (plano) => {
  const lista = (plano?.factoresJuizo ?? []).filter((k) => FACTORES_JUIZO[k])
  return lista.length ? Object.fromEntries(lista.map((k) => [k, FACTORES_JUIZO[k]])) : FACTORES_JUIZO
}

export function validarJuizo(d, lista = FACTORES_JUIZO) {
  const factores = {}
  for (const [k] of Object.entries(lista)) {
    const v = d?.factores?.[k]
    if (v === undefined || v === null || v === '') continue
    if (!ESCALA_JUIZO.includes(v)) throw erro('juizo', `Factor «${FACTORES_JUIZO[k]}»: escolha ${ESCALA_JUIZO.join(', ')}.`)
    factores[k] = v
  }
  const texto = String(d?.texto ?? '').trim().slice(0, 4000)
  return { factores, texto }
}

// o juízo está completo quando todos os factores do plano têm apreciação
export const juizoCompleto = (j, lista = FACTORES_JUIZO) => Object.keys(lista).every((k) => j?.factores?.[k])

/*
  Quem pode receber o DISTINTO: só quem concluiu o curso e tem a melhor nota final (em caso de igualdade,
  qualquer um dos empatados, sob proposta do Director de Ensino). linhas: [{ estudanteId, concluido, final }].
*/
export function podeTerDistinto(linhas, estudanteId) {
  const concluidas = linhas.filter((l) => l.concluido && l.final !== null)
  if (!concluidas.length) return false
  const melhor = Math.max(...concluidas.map((l) => Number(l.final)))
  const l = concluidas.find((x) => x.estudanteId === estudanteId)
  return Boolean(l) && Number(l.final) === melhor
}
