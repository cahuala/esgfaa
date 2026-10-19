import { Link } from 'react-router-dom'
import { useCallback, useEffect, useState } from 'react'
import { api } from '../../api'
import { useSessao } from '../../sessaoContexto'
import { Carregando } from '../../componentes/Ui'
import { COMPONENTES_NOTA, NOMES_COMPONENTES, REGRA, SITUACOES, resultadoDisciplina } from '../../../portal/regraAvaliacao'
import Composicao from '../../../portal/cadeira/Composicao'
import { exportarPautaExcel } from '../../../portal/exportarPauta'
import { t as tx, localAtual } from '../../../i18n/linguas'

const COR = { cinzento: 'bg-gray-400', verde: 'bg-success', azul: 'bg-primary', dourado: 'bg-warning text-dark', vermelho: 'bg-danger' }
const paraTexto = (v) => (v === null || v === undefined ? '' : String(v).replace('.', ','))
const paraNumero = (v) => {
  const t = String(v).trim().replace(',', '.')
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) && n >= 0 && n <= 20 ? n : undefined
}
const nota = (v) => (v === null || v === undefined ? '—' : Number(v).toLocaleString(localAtual(), { maximumFractionDigits: 2 }))

/*
  Pauta da cadeira no painel: a Administração Escolar lança e publica notas (permissão academico.notas),
  com a mesma regra do portal (MAC, dispensa, exame, recurso).
*/
function PautaAdmin({ cadeira, avisar }) {
  const { pode } = useSessao()
  const editar = pode('academico.notas')
  const [p, setP] = useState(null)
  const [edicao, setEdicao] = useState({})
  const [alterado, setAlterado] = useState(false)
  const [compor, setCompor] = useState(null)

  const aplicar = useCallback((r) => {
    setP(r)
    setEdicao(Object.fromEntries(r.linhas.map((l) => [l.estudante.id, { ...Object.fromEntries(COMPONENTES_NOTA.map((k) => [k, paraTexto(l[k])])), observacao: l.observacao }])))
    setAlterado(false)
  }, [])
  useEffect(() => { api(`/academico/cadeiras/${cadeira.id}/pauta`).then(aplicar).catch((e) => avisar({ tipo: 'erro', texto: e.message })) }, [cadeira.id, aplicar, avisar])

  if (!p) return <Carregando />
  if (p.linhas.length === 0) return <div className="alert alert-info mb-0">{tx('A turma não tem estudantes matriculados.')}</div>

  const resultado = (l) => {
    const id = l.estudante.id
    const v = Object.fromEntries(COMPONENTES_NOTA.map((k) => [k, paraNumero(edicao[id][k])]))
    const invalidas = COMPONENTES_NOTA.filter((k) => v[k] === undefined)
    for (const k of invalidas) v[k] = null
    return { ...resultadoDisciplina(v, { assiduidade: l.assiduidade }), invalidas }
  }
  const resultados = Object.fromEntries(p.linhas.map((l) => [l.estudante.id, resultado(l)]))
  const invalida = Object.values(resultados).some((r) => r.invalidas.length)

  async function guardar() {
    try {
      aplicar(await api(`/academico/cadeiras/${cadeira.id}/pauta`, { metodo: 'PUT', corpo: { linhas: p.linhas.map((l) => ({ estudanteId: l.estudante.id, ...edicao[l.estudante.id] })) } }))
      avisar({ texto: tx('Pauta guardada.') })
    } catch (e) {
      avisar({ tipo: 'erro', texto: e.message })
    }
  }

  async function publicar(k) {
    const publicadas = p.publicadas.includes(k) ? p.publicadas.filter((x) => x !== k) : [...p.publicadas, k]
    try {
      const r = await api(`/academico/cadeiras/${cadeira.id}/pauta/publicacao`, { metodo: 'PUT', corpo: { publicadas } })
      setP({ ...p, publicadas: r.publicadas })
      avisar({ texto: `${NOMES_COMPONENTES[k]}: ${publicadas.includes(k) ? tx('publicada aos estudantes') : tx('escondida dos estudantes')}.` })
    } catch (e) {
      avisar({ tipo: 'erro', texto: e.message })
    }
  }

  const calculada = (k) => Boolean(p.composicoes?.[k])
  const guardarComposicao = async (itens) => {
    aplicar(await api(`/academico/cadeiras/${cadeira.id}/pauta/composicao`, { metodo: 'PUT', corpo: { componente: compor, itens } }))
    avisar({ texto: itens ? tx('{0}: calculada a partir das atividades.', { 0: NOMES_COMPONENTES[compor] }) : tx('{0}: volta a ser lançada à mão.', { 0: NOMES_COMPONENTES[compor] }) })
  }

  const coluna = (k) => {
    const pub = p.publicadas.includes(k)
    return (
      <th key={k} className="text-center">
        {NOMES_COMPONENTES[k]}
        {editar && <button type="button" className={`btn btn-xs ms-1 ${calculada(k) ? 'btn-primary' : 'btn-white'}`} onClick={() => setCompor(k)} aria-label={tx('Como se calcula: {0}', { 0: NOMES_COMPONENTES[k] })} title={tx('Calcular a partir de trabalhos e questionários')}><i className="fa fa-calculator" /></button>}
        <div>
          <button type="button" disabled={!editar} className={`btn btn-xs mt-1 ${pub ? 'btn-success' : 'btn-white'}`} onClick={() => publicar(k)} aria-pressed={pub}>
            <i className={`fa ${pub ? 'fa-eye' : 'fa-eye-slash'} me-1`} />{pub ? tx('Publicada') : tx('Por publicar')}
          </button>
        </div>
      </th>
    )
  }

  const celula = (l, k) => {
    const id = l.estudante.id
    const mal = resultados[id].invalidas.includes(k)
    if (calculada(k)) return <td key={k} className="text-center fw-bold bg-primary bg-opacity-10" title={tx('Calculada a partir das atividades')}>{nota(paraNumero(edicao[id][k]) ?? null)}</td>
    return (
      <td key={k} className="text-center">
        <input
          className={`form-control form-control-sm text-center mx-auto fw-bold ${mal ? 'is-invalid' : ''}`}
          style={{ width: 70 }}
          inputMode="decimal"
          disabled={!editar}
          aria-label={tx('{0} de {1}', { 0: NOMES_COMPONENTES[k], 1: l.estudante.nome })}
          value={edicao[id][k]}
          onChange={(e) => { setEdicao({ ...edicao, [id]: { ...edicao[id], [k]: e.target.value } }); setAlterado(true) }}
        />
      </td>
    )
  }

  return (
    <>
      <div className="d-flex align-items-center gap-2 mb-3 flex-wrap">
        {Object.entries(SITUACOES).map(([k, s]) => {
          const n = Object.values(resultados).filter((r) => r.situacao === k).length
          return n ? <span key={k} className={`badge ${COR[s.cor]}`}>{s.texto}: {n}</span> : null
        })}
        {editar && (
          <div className="ms-auto d-flex gap-2 align-items-center">
            {alterado && <span className="text-warning small fw-bold">{tx('Alterações por guardar')}</span>}
            <button type="button" className="btn btn-white" onClick={() => exportarPautaExcel(cadeira, p.linhas.map((l) => ({ ...l, ...Object.fromEntries(COMPONENTES_NOTA.map((k) => [k, paraNumero(edicao[l.estudante.id][k]) ?? null])), ...resultados[l.estudante.id] })))}><i className="fa fa-file-excel me-1" /> {tx('Exportar Excel')}</button>
            <Link to={`/academico/documentos/cadeira/${cadeira.id}/pauta`} className="btn btn-white"><i className="fa fa-print me-1" /> {tx('Imprimir pauta')}</Link>
            <button type="button" className="btn btn-theme" disabled={!alterado || invalida} onClick={guardar}><i className="fa fa-save me-1" /> {tx('Guardar pauta')}</button>
          </div>
        )}
      </div>
      <div className="table-responsive">
        <table className="table table-bordered align-middle mb-2">
          <thead className="table-dark">
            <tr>
              <th>{tx('N.º')}</th><th>{tx('Estudante')}</th>
              {coluna('p1')}{coluna('p2')}
              <th className="text-center">{tx('MAC')}</th>
              {coluna('exame')}{coluna('recurso')}
              <th className="text-center">{tx('Nota final')}</th><th className="text-center">{tx('Situação')}</th>
            </tr>
          </thead>
          <tbody>
            {p.linhas.map((l, i) => {
              const r = resultados[l.estudante.id]
              const s = SITUACOES[r.situacao]
              return (
                <tr key={l.estudante.id}>
                  <td className="text-muted">{i + 1}</td>
                  <td><span className="fw-bold">{l.estudante.nome}</span><div className="small text-muted">{l.estudante.numero}</div></td>
                  {celula(l, 'p1')}{celula(l, 'p2')}
                  <td className="text-center bg-warning-transparent-1 fw-bold">{nota(r.mac)}</td>
                  {celula(l, 'exame')}{celula(l, 'recurso')}
                  <td className={`text-center fs-16px fw-bolder ${r.final !== null && r.final < 10 ? 'text-danger' : ''}`}>{r.situacao === 'recurso' ? '—' : nota(r.final)}</td>
                  <td className="text-center"><span className={`badge ${COR[s.cor]}`}>{s.texto}</span>{r.classificacao && r.situacao !== 'reprovado' && <div className="small text-muted">{r.classificacao}</div>}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {compor && <Composicao componente={compor} atividades={p.atividades || []} atual={p.composicoes?.[compor]} guardar={guardarComposicao} fechar={() => setCompor(null)} />}
      <p className="small text-muted mb-0">{REGRA} {tx('Os estudantes só veem as colunas publicadas. O botão')} <i className="fa fa-calculator" /> {tx('calcula uma coluna a partir de trabalhos e questionários.')}</p>
    </>
  )
}

export default PautaAdmin
