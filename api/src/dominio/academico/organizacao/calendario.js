import { HORA, dataValida, erro, escolha, texto } from '../comum/validacao.js'

// Calendário académico: provas, exames, recursos, eventos e feriados.

export const TIPOS_EVENTO = {
  p1: '1.ª Prova', p2: '2.ª Prova', exame: 'Exame', recurso: 'Recurso', geral: 'Evento', feriado: 'Feriado / sem aulas',
}

export const TIPOS_EVENTO_CADEIRA = ['p1', 'p2', 'exame', 'recurso', 'geral']

export function validarEvento(dados, tiposPermitidos = Object.keys(TIPOS_EVENTO)) {
  const tipo = escolha(dados.tipo, 'tipo', 'Tipo', tiposPermitidos)
  if (!dataValida(dados.data)) throw erro('data', 'Indique a data.')
  const inicio = dados.inicio || ''
  const fim = dados.fim || ''
  if ((inicio && !HORA.test(inicio)) || (fim && !HORA.test(fim))) throw erro('inicio', 'Horas no formato HH:MM.')
  if (inicio && fim && inicio >= fim) throw erro('fim', 'A hora de fim tem de ser depois da de início.')
  return {
    tipo, data: dados.data, inicio, fim,
    titulo: texto(dados.titulo || TIPOS_EVENTO[tipo], 'titulo', 'Título', { min: 2, max: 150 }),
    local: texto(dados.local, 'local', 'Local', { max: 120, obrigatorio: false }),
    descricao: texto(dados.descricao, 'descricao', 'Descrição', { max: 2000, obrigatorio: false }),
  }
}

// intervalo pedido ao calendário: no máximo ~6 semanas e datas válidas
export function intervaloCalendario(de, ate) {
  if (!dataValida(de) || !dataValida(ate) || de > ate) throw erro('de', 'Intervalo de datas inválido.')
  const dias = (Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86_400_000
  if (dias > 45) throw erro('ate', 'Peça no máximo 45 dias de cada vez.')
  return { de, ate }
}
