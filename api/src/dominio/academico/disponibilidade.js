import { ErroValidacao } from '../comum/erros.js'

/*
  Restrições de acesso às atividades (como as "Restrict access" do Moodle):
  - escondida (visivel = false): o estudante não a vê;
  - data: só abre a partir de disponivelDe (da atividade ou do capítulo);
  - requisitos: só abre depois de concluir outras atividades (e, se se pedir, com nota mínima).
  Uma atividade fechada aparece ao estudante com o motivo, mas não se abre.
*/

export const TIPOS_ATIVIDADE = ['material', 'trabalho', 'questionario']
const erro = (campo, mensagem) => new ErroValidacao(mensagem, { campo })
export const chave = (tipo, id) => `${tipo}-${id}`

/*
  Valida as restrições pedidas pelo docente. existentes: Set de chaves das atividades da cadeira;
  propria: a chave da própria atividade (não pode depender de si).
*/
export function validarRestricoes(dados, existentes, propria) {
  const r = {}
  if (dados.visivel !== undefined) r.visivel = Boolean(dados.visivel)
  if (dados.disponivelDe !== undefined) {
    if (dados.disponivelDe === null || dados.disponivelDe === '') r.disponivelDe = null
    else {
      const d = new Date(dados.disponivelDe)
      if (Number.isNaN(d.getTime())) throw erro('disponivelDe', 'Data de abertura inválida.')
      r.disponivelDe = d
    }
  }
  if (dados.requisitos !== undefined) {
    if (!Array.isArray(dados.requisitos) || dados.requisitos.length > 10) throw erro('requisitos', 'Até 10 condições.')
    const vistas = new Set()
    r.requisitos = dados.requisitos.map((x) => {
      if (!TIPOS_ATIVIDADE.includes(x?.tipo)) throw erro('requisitos', 'Condição inválida.')
      const id = Number(x.id)
      const k = chave(x.tipo, id)
      if (!existentes.has(k)) throw erro('requisitos', 'A condição tem de ser uma atividade desta cadeira.')
      if (k === propria) throw erro('requisitos', 'Uma atividade não pode depender de si própria.')
      if (vistas.has(k)) throw erro('requisitos', 'A mesma condição aparece duas vezes.')
      vistas.add(k)
      let notaMinima = null
      if (x.notaMinima !== undefined && x.notaMinima !== null && x.notaMinima !== '') {
        if (x.tipo === 'material') throw erro('requisitos', 'Os materiais não têm nota: use só "concluído".')
        notaMinima = Number(String(x.notaMinima).replace(',', '.'))
        if (!Number.isFinite(notaMinima) || notaMinima < 0 || notaMinima > 20) throw erro('requisitos', 'A nota mínima vai de 0 a 20.')
      }
      return { tipo: x.tipo, id, notaMinima }
    })
  }
  return r
}

/*
  A atividade está aberta para este estudante? estado: { "tipo-id": { feita, nota } };
  titulos: { "tipo-id": título } (para explicar o motivo). Devolve { aberta, motivos }.
  motivos: [{ tipo: 'data', data } | { tipo: 'requisito', titulo, notaMinima }]
*/
export function avaliarAcesso(atividade, { agora, estado = {}, titulos = {}, secao = null }) {
  const motivos = []
  const datas = [secao?.disponivelDe, atividade.disponivelDe].filter(Boolean).map((d) => new Date(d))
  const abre = datas.length ? new Date(Math.max(...datas.map((d) => d.getTime()))) : null
  if (abre && agora < abre) motivos.push({ tipo: 'data', data: abre.toISOString() })
  for (const r of atividade.requisitos || []) {
    const k = chave(r.tipo, r.id)
    if (!(k in titulos)) continue // condição sobre uma atividade que já não existe: ignora-se
    const e = estado[k]
    const cumprida = e?.feita && (r.notaMinima === null || r.notaMinima === undefined || (e.nota !== null && e.nota !== undefined && e.nota >= r.notaMinima))
    if (!cumprida) motivos.push({ tipo: 'requisito', titulo: titulos[k], notaMinima: r.notaMinima ?? null })
  }
  return { aberta: motivos.length === 0, motivos }
}

// texto curto dos motivos, para as mensagens de erro da API
export function explicarMotivos(motivos) {
  return motivos.map((m) => (m.tipo === 'data'
    ? `abre a ${new Date(m.data).toLocaleString('pt-PT', { timeZone: 'Africa/Luanda', dateStyle: 'short', timeStyle: 'short' })}`
    : m.notaMinima !== null ? `precisa de pelo menos ${m.notaMinima} valores em "${m.titulo}"` : `precisa de concluir "${m.titulo}"`)).join('; ')
}
