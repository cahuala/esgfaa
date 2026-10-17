import { useCallback, useEffect, useState } from 'react'
import { api } from '../../api'
import { useSessao } from '../../sessaoContexto'
import { Carregando, Painel } from '../../componentes/Ui'
import { t as tx } from '../../../i18n/linguas'

const COMPONENTES = { p1: '1.ª Prova', p2: '2.ª Prova', exame: 'Exame', recurso: 'Recurso' }
const data = (d) => d.split('-').reverse().join('/')

/*
  Prazos de lançamento das notas (Administração Escolar / Direcção de Ensino): o período em que os docentes
  podem lançar cada componente no portal — para toda a Escola, uma turma ou uma cadeira (prorrogação).
  Sem prazo definido para uma componente, o lançamento fica livre.
*/
export default function PrazosNotas({ turmas, avisar }) {
  const { pode } = useSessao()
  const gerir = pode('academico.gerir')
  const [lista, setLista] = useState(null)
  const [cadeiras, setCadeiras] = useState([])
  const vazio = { componente: 'p1', inicio: '', fim: '', turmaId: '', cadeiraId: '', descricao: '' }
  const [f, setF] = useState(vazio)
  const [erro, setErro] = useState('')
  const carregar = useCallback(() => api('/academico/prazos-notas').then(setLista).catch((e) => setErro(e.message)), [])
  useEffect(() => { carregar() }, [carregar])
  useEffect(() => {
    if (!f.turmaId) return
    api(`/academico/turmas/${f.turmaId}`).then((t) => setCadeiras(t.cadeiras ?? [])).catch(() => setCadeiras([]))
  }, [f.turmaId])

  async function criar(e) {
    e.preventDefault()
    setErro('')
    try {
      await api('/academico/prazos-notas', { metodo: 'POST', corpo: { ...f, turmaId: f.turmaId ? Number(f.turmaId) : null, cadeiraId: f.cadeiraId ? Number(f.cadeiraId) : null } })
      setF({ ...vazio, turmaId: f.turmaId })
      avisar({ texto: tx('Prazo definido. Os docentes só lançam essa componente dentro dele.') })
      carregar()
    } catch (x) {
      setErro(x.message)
    }
  }
  const hoje = new Date().toISOString().slice(0, 10)
  const estado = (p) => (p.inicio > hoje ? ['bg-info', tx('Ainda não abriu')] : p.fim < hoje ? ['bg-secondary', tx('Fechado')] : ['bg-success', tx('Aberto')])

  return (
    <div className="row">
      <div className="col-xl-8">
        <Painel titulo={tx('Prazos de lançamento das notas')} corpo={false}>
          {erro && !gerir && <div className="alert alert-danger m-2">{erro}</div>}
          {!lista ? <div className="panel-body"><Carregando /></div> : (
            <div className="table-responsive">
              <table className="table table-striped align-middle mb-0">
                <thead><tr><th>{tx('Componente')}</th><th>{tx('Período')}</th><th>{tx('Para')}</th><th>{tx('Estado')}</th><th /></tr></thead>
                <tbody>
                  {lista.length === 0 && <tr><td colSpan={5} className="text-center text-muted py-4">{tx('Nenhum prazo definido: os docentes lançam as notas a qualquer momento.')}</td></tr>}
                  {lista.map((p) => {
                    const [cor, texto] = estado(p)
                    return (
                      <tr key={p.id}>
                        <td><b>{tx(COMPONENTES[p.componente] ?? p.componente)}</b>{p.descricao && <div className="small text-muted">{p.descricao}</div>}</td>
                        <td className="text-nowrap">{data(p.inicio)} – {data(p.fim)}</td>
                        <td className="small">{p.cadeiraId ? <span className="badge bg-warning text-dark me-1">{tx('Prorrogação')}</span> : null}{p.ambito}</td>
                        <td><span className={`badge ${cor}`}>{texto}</span></td>
                        <td className="text-end">{gerir && <button type="button" className="btn btn-xs btn-white text-danger" aria-label={tx('Apagar prazo')} onClick={() => api(`/academico/prazos-notas/${p.id}`, { metodo: 'DELETE' }).then(carregar).catch((x) => avisar({ tipo: 'erro', texto: x.message }))}><i className="fa fa-times" /></button>}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="small text-muted p-2">{tx('Vale o prazo mais específico: o da cadeira (prorrogação), depois o da turma, depois o de toda a Escola. Fora do prazo, o docente não lança essa componente; a Administração Escolar pode sempre corrigir no painel (fica no registo de atividades).')}</div>
        </Painel>
      </div>
      {gerir && (
        <div className="col-xl-4">
          <Painel titulo={tx('Definir prazo')}>
            <form onSubmit={criar}>
              {erro && <div className="alert alert-danger py-2">{erro}</div>}
              <label className="form-label fw-bold" htmlFor="pz-comp">{tx('Componente')}</label>
              <select id="pz-comp" className="form-select mb-2" value={f.componente} onChange={(e) => setF({ ...f, componente: e.target.value })}>
                {Object.entries(COMPONENTES).map(([k, v]) => <option key={k} value={k}>{tx(v)}</option>)}
              </select>
              <div className="row g-2 mb-2">
                <div className="col-6"><label className="form-label fw-bold" htmlFor="pz-ini">{tx('De')}</label><input id="pz-ini" type="date" className="form-control" value={f.inicio} onChange={(e) => setF({ ...f, inicio: e.target.value })} required /></div>
                <div className="col-6"><label className="form-label fw-bold" htmlFor="pz-fim">{tx('Até (inclusive)')}</label><input id="pz-fim" type="date" className="form-control" value={f.fim} min={f.inicio} onChange={(e) => setF({ ...f, fim: e.target.value })} required /></div>
              </div>
              <label className="form-label fw-bold" htmlFor="pz-turma">{tx('Para')}</label>
              <select id="pz-turma" className="form-select mb-2" value={f.turmaId} onChange={(e) => setF({ ...f, turmaId: e.target.value, cadeiraId: '' })}>
                <option value="">{tx('Toda a Escola')}</option>
                {turmas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </select>
              {f.turmaId && (
                <>
                  <label className="form-label" htmlFor="pz-cad">{tx('Só uma cadeira (prorrogação)')}</label>
                  <select id="pz-cad" className="form-select mb-2" value={f.cadeiraId} onChange={(e) => setF({ ...f, cadeiraId: e.target.value })}>
                    <option value="">{tx('Todas as cadeiras da turma')}</option>
                    {cadeiras.map((c) => <option key={c.id} value={c.id}>{c.codigo} {c.nome}</option>)}
                  </select>
                </>
              )}
              <label className="form-label" htmlFor="pz-desc">{tx('Motivo / observação')}</label>
              <input id="pz-desc" className="form-control mb-3" value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} placeholder={tx('Ex.: Despacho da Direcção de Ensino')} />
              <button type="submit" className="btn btn-theme w-100"><i className="fa fa-clock me-1" /> {tx('Definir prazo')}</button>
            </form>
          </Painel>
        </div>
      )}
    </div>
  )
}
