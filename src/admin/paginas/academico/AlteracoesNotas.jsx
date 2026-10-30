import { useCallback, useEffect, useState } from 'react'
import { api } from '../../api'
import { useSessao } from '../../sessaoContexto'
import { Aviso, CabecalhoPagina, Carregando, Erro, Painel } from '../../componentes/Ui'
import Exportar from '../../componentes/Exportar'
import { dataHora } from '../../formatar'
import { NOMES_COMPONENTES } from '../../../portal/regraAvaliacao'
import { t as tx } from '../../../i18n/linguas'

const ESTADOS = { pendente: ['bg-warning text-dark', tx('Por decidir')], autorizado: ['bg-primary', tx('Autorizado')], recusado: ['bg-danger', tx('Recusado')], usado: ['bg-success', tx('Nota alterada')] }
const nota = (v) => (v === null || v === undefined ? '—' : Number(v).toLocaleString('pt-PT', { maximumFractionDigits: 2 }))
const nomeProva = (p) => (p.prova ? `${p.prova.tipo} ${p.prova.titulo}` : NOMES_COMPONENTES[p.componente] ?? p.componente)

/*
  Pedidos de alteração de notas já publicadas: cada docente pede para os estudantes em causa, com o
  motivo; o Comandante autoriza ou recusa (um ou vários de uma vez). A autorização serve uma só vez.
*/
function AlteracoesNotas() {
  const { pode } = useSessao()
  const decide = pode('academico.homologar')
  const [lista, setLista] = useState(null)
  const [erro, setErro] = useState('')
  const [estado, setEstado] = useState('pendente')
  const [escolhidos, setEscolhidos] = useState([])
  const [fundamento, setFundamento] = useState('')
  const [aviso, setAviso] = useState(null)
  const carregar = useCallback(() => api(`/academico/alteracoes-notas${estado ? `?estado=${estado}` : ''}`).then((r) => { setErro(''); setLista(r); setEscolhidos([]) }).catch((e) => setErro(e.message)), [estado])
  useEffect(() => { carregar() }, [carregar])

  const pendentes = (lista ?? []).filter((p) => p.estado === 'pendente')
  const marcar = (id) => setEscolhidos((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]))
  async function decidir(decisao) {
    try {
      const r = await api('/academico/alteracoes-notas/decidir', { metodo: 'POST', corpo: { ids: escolhidos, decisao, fundamento } })
      setAviso({ texto: decisao === 'autorizar' ? tx('{0} alteração(ões) autorizada(s). O docente foi avisado.', { 0: r.decididos }) : tx('{0} pedido(s) recusado(s). O docente foi avisado.', { 0: r.decididos }) })
      setFundamento('')
      carregar()
      window.dispatchEvent(new Event('esg-pendentes'))
    } catch (e) {
      setAviso({ tipo: 'erro', texto: e.message })
    }
  }

  return (
    <>
      <CabecalhoPagina titulo={tx('Alterações de notas')} subtitulo={tx('notas já publicadas: só mudam com autorização do Comandante')} migalhas={[{ rotulo: tx('Administração Escolar') }, { rotulo: tx('Alterações de notas') }]} />
      {erro && <Erro texto={erro} onRepetir={carregar} />}
      {!decide && <div className="alert alert-info py-2"><i className="fa fa-info-circle me-2" />{tx('Só o Comandante autoriza ou recusa. Aqui pode acompanhar os pedidos.')}</div>}
      <Painel
        titulo={`${tx('Pedidos')}${lista ? ` (${lista.length})` : ''}`}
        corpo={false}
        acoes={lista?.length > 0 && <Exportar titulo={tx('Alterações de notas')} filtro={estado ? ESTADOS[estado][1] : ''} linhas={lista} colunas={[
          { titulo: tx('Pedido em'), valor: (p) => dataHora(p.pedidoEm) }, { titulo: tx('Cadeira'), valor: (p) => `${p.cadeira.codigo} ${p.cadeira.nome}` }, { titulo: tx('Turma'), valor: (p) => p.cadeira.turma?.nome },
          { titulo: tx('Prova'), valor: nomeProva }, { titulo: tx('Estudante'), valor: (p) => p.estudante?.nome }, { titulo: tx('Nota atual'), valor: (p) => p.notaAtual }, { titulo: tx('Nota nova'), valor: (p) => p.notaNova },
          { titulo: tx('Motivo'), valor: (p) => p.motivo }, { titulo: tx('Docente'), valor: (p) => p.docente }, { titulo: tx('Estado'), valor: (p) => ESTADOS[p.estado][1] }, { titulo: tx('Decidido por'), valor: (p) => p.decididoPor }, { titulo: tx('Fundamento'), valor: (p) => p.fundamento },
        ]} />}
      >
        <div className="panel-body pb-0 d-flex flex-wrap gap-2 align-items-center">
          <div className="btn-group btn-group-sm">
            {[['pendente', tx('Por decidir')], ['autorizado', tx('Autorizados')], ['usado', tx('Alteradas')], ['recusado', tx('Recusados')], ['', tx('Todos')]].map(([k, v]) => <button key={k} type="button" className={`btn ${estado === k ? 'btn-dark' : 'btn-white'}`} onClick={() => setEstado(k)}>{v}</button>)}
          </div>
        </div>
        {decide && pendentes.length > 0 && (
          <div className="panel-body pb-0">
            <div className="border rounded p-2 bg-light d-flex flex-wrap gap-2 align-items-center">
              <label className="form-check mb-0 me-2"><input type="checkbox" className="form-check-input" checked={escolhidos.length === pendentes.length} onChange={(e) => setEscolhidos(e.target.checked ? pendentes.map((p) => p.id) : [])} /> <span className="form-check-label small">{tx('Todos')}</span></label>
              <input className="form-control form-control-sm flex-grow-1" style={{ minWidth: 220, maxWidth: 520 }} value={fundamento} onChange={(e) => setFundamento(e.target.value)} placeholder={tx('Fundamento (obrigatório para recusar)')} aria-label={tx('Fundamento')} />
              <button type="button" className="btn btn-sm btn-success" disabled={!escolhidos.length} onClick={() => decidir('autorizar')}><i className="fa fa-check me-1" />{tx('Autorizar ({0})', { 0: escolhidos.length })}</button>
              <button type="button" className="btn btn-sm btn-danger" disabled={!escolhidos.length || !fundamento.trim()} onClick={() => decidir('recusar')}><i className="fa fa-times me-1" />{tx('Recusar ({0})', { 0: escolhidos.length })}</button>
            </div>
          </div>
        )}
        {!lista && !erro ? <Carregando /> : (
          <div className="table-responsive mt-3">
            <table className="table table-striped align-middle mb-0">
              <thead><tr>{decide && <th style={{ width: 1 }} />}<th>{tx('Estudante')}</th><th>{tx('Cadeira e prova')}</th><th className="text-center">{tx('Nota')}</th><th>{tx('Motivo do docente')}</th><th>{tx('Estado')}</th></tr></thead>
              <tbody>
                {lista?.length === 0 && <tr><td colSpan={6} className="text-center text-muted py-4">{estado === 'pendente' ? tx('Não há pedidos por decidir.') : tx('Sem pedidos.')}</td></tr>}
                {lista?.map((p) => (
                  <tr key={p.id}>
                    {decide && <td>{p.estado === 'pendente' && <input type="checkbox" className="form-check-input" checked={escolhidos.includes(p.id)} onChange={() => marcar(p.id)} aria-label={tx('Escolher o pedido de {0}', { 0: p.estudante?.nome })} />}</td>}
                    <td className="fw-bold">{p.estudante?.nome}<div className="small text-muted fw-normal">{p.estudante?.numero}</div></td>
                    <td><b>{p.cadeira.codigo}</b> {p.cadeira.nome} · {nomeProva(p)}<div className="small text-muted">{p.cadeira.turma?.nome}</div></td>
                    <td className="text-center text-nowrap">{nota(p.notaAtual)}{p.notaNova !== null && <> → <b>{nota(p.notaNova)}</b></>}</td>
                    <td>{p.motivo}<div className="small text-muted">{p.docente} · {dataHora(p.pedidoEm)}</div></td>
                    <td><span className={`badge ${ESTADOS[p.estado][0]}`}>{ESTADOS[p.estado][1]}</span>{p.decididoEm && <div className="small text-muted">{p.decididoPor} · {dataHora(p.decididoEm)}</div>}{p.fundamento && <div className="small">{p.fundamento}</div>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Painel>
      <Aviso aviso={aviso} onFechar={() => setAviso(null)} />
    </>
  )
}

export default AlteracoesNotas
