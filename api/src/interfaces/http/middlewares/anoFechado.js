/*
  Ano lectivo fechado: as alterações (POST, PUT, PATCH, DELETE) às turmas, cadeiras, matrículas, inscrições,
  horários, notas e actividades de um ano lectivo fechado são recusadas, venham da Administração Escolar ou dos
  docentes e estudantes no portal. Consultar continua possível. Reabre-se por ordem do Comandante.
  regras: [[/^\/turmas\/(\d+)/, 'turmaId'], …] — o primeiro número do caminho é o id do que se altera.
*/
const ESCRITA = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export function bloquearAnoFechado(anos, regras, { doCorpo = [] } = {}) {
  return async (req, res, next) => {
    if (!ESCRITA.has(req.method)) return next()
    try {
      for (const [re, chave] of regras) {
        const m = re.exec(req.path)
        if (m) {
          await anos.exigirAberto({ [chave]: Number(m[1]) })
          return next()
        }
      }
      // criar algo de um ano lectivo (uma turma, a distribuição dos docentes): o ano vem no corpo
      for (const [metodo, re] of doCorpo) {
        if (req.method === metodo && re.test(req.path) && typeof req.body?.anoLetivo === 'string') await anos.exigirAberto({ anoLetivo: req.body.anoLetivo })
      }
      return next()
    } catch (e) {
      return next(e)
    }
  }
}

// a Administração Escolar (painel): /api/admin/academico/…
export const REGRAS_SECRETARIA = [
  [/^\/turmas\/(\d+)/, 'turmaId'], [/^\/cadeiras\/(\d+)/, 'cadeiraId'], [/^\/matriculas\/(\d+)/, 'matriculaId'],
  [/^\/inscricoes\/(\d+)/, 'inscricaoId'], [/^\/horarios\/(\d+)/, 'horarioId'],
]
export const CORPO_SECRETARIA = [['POST', /^\/turmas\/?$/], ['POST', /^\/distribuicao\/?$/]]
// o portal dos docentes e estudantes: /api/portal/…
export const REGRAS_PORTAL = [
  [/^\/cadeiras\/(\d+)/, 'cadeiraId'], [/^\/trabalhos\/(\d+)/, 'trabalhoId'], [/^\/questionarios\/(\d+)/, 'questionarioId'],
  [/^\/materiais\/(\d+)/, 'materialId'], [/^\/entregas\/(\d+)/, 'entregaId'], [/^\/tentativas\/(\d+)/, 'tentativaId'],
]
