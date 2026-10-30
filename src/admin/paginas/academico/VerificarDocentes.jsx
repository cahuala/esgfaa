import { useCallback, useEffect, useState } from 'react'
import { api } from '../../api'
import { useSessao } from '../../sessaoContexto'
import { Aviso, CabecalhoPagina, Carregando, Erro, Painel } from '../../componentes/Ui'
import Exportar from '../../componentes/Exportar'
import { dataHora } from '../../formatar'
import { t as tx } from '../../../i18n/linguas'

const cadeiras = (d) => d.docencias.map((x) => `${x.cadeira.codigo} ${x.cadeira.nome}${x.cadeira.turma ? ` (${x.cadeira.turma.nome})` : ''}`)

/*
  Lista dos docentes, para o Comandante verificar: os que o Pessoal e Quadros regista chegam aqui
  como «por verificar»; o Comandante confere (nome, posto, cadeiras) e marca como verificados.
*/
function VerificarDocentes() {
  const { pode } = useSessao()
  const verifica = pode('academico.homologar')
  const [lista, setLista] = useState(null)
  const [erro, setErro] = useState('')
  const [filtro, setFiltro] = useState('por')
  const [escolhidos, setEscolhidos] = useState([])
  const [aviso, setAviso] = useState(null)
  const carregar = useCallback(() => api('/academico/docentes-verificacao').then((r) => { setErro(''); setLista(r); setEscolhidos([]) }).catch((e) => setErro(e.message)), [])
  useEffect(() => { carregar() }, [carregar])

  const visiveis = (lista ?? []).filter((d) => (filtro === 'por' ? !d.verificadoEm : filtro === 'feitos' ? d.verificadoEm : true))
  const porVerificar = visiveis.filter((d) => !d.verificadoEm)
  const marcar = (id) => setEscolhidos((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]))
  const verificar = () => api('/academico/docentes-verificacao', { metodo: 'POST', corpo: { ids: escolhidos } })
    .then((r) => { setAviso({ texto: tx('{0} docente(s) verificado(s).', { 0: r.verificados }) }); carregar(); window.dispatchEvent(new Event('esg-pendentes')) })
    .catch((e) => setAviso({ tipo: 'erro', texto: e.message }))

  return (
    <>
      <CabecalhoPagina titulo={tx('Docentes')} subtitulo={tx('lista verificada pelo Comandante')} migalhas={[{ rotulo: tx('Administração Escolar') }, { rotulo: tx('Docentes') }]} />
      {erro && <Erro texto={erro} onRepetir={carregar} />}
      <Painel
        titulo={`${tx('Docentes')}${lista ? ` (${visiveis.length})` : ''}`}
        corpo={false}
        acoes={visiveis.length > 0 && <Exportar titulo={tx('Lista de docentes')} filtro={{ por: tx('Por verificar'), feitos: tx('Verificados'), todos: '' }[filtro]} linhas={visiveis} colunas={[
          { titulo: tx('N.º'), valor: (d) => d.numero }, { titulo: tx('Nome'), valor: (d) => d.nome }, { titulo: tx('Posto'), valor: (d) => d.dados?.posto }, { titulo: tx('E-mail'), valor: (d) => d.email },
          { titulo: tx('Cadeiras'), valor: (d) => cadeiras(d).join('; ') }, { titulo: tx('Registado em'), valor: (d) => dataHora(d.criadoEm) }, { titulo: tx('Verificado por'), valor: (d) => d.verificadoPor }, { titulo: tx('Verificado em'), valor: (d) => (d.verificadoEm ? dataHora(d.verificadoEm) : '') },
        ]} />}
      >
        <div className="panel-body pb-0 d-flex flex-wrap gap-2 align-items-center">
          <div className="btn-group btn-group-sm">
            {[['por', tx('Por verificar')], ['feitos', tx('Verificados')], ['todos', tx('Todos')]].map(([k, v]) => <button key={k} type="button" className={`btn ${filtro === k ? 'btn-dark' : 'btn-white'}`} onClick={() => setFiltro(k)}>{v}</button>)}
          </div>
          {verifica && porVerificar.length > 0 && (
            <>
              <label className="form-check mb-0 ms-2"><input type="checkbox" className="form-check-input" checked={escolhidos.length === porVerificar.length} onChange={(e) => setEscolhidos(e.target.checked ? porVerificar.map((d) => d.id) : [])} /> <span className="form-check-label small">{tx('Todos')}</span></label>
              <button type="button" className="btn btn-sm btn-success" disabled={!escolhidos.length} onClick={verificar}><i className="fa fa-check-double me-1" />{tx('Marcar como verificados ({0})', { 0: escolhidos.length })}</button>
            </>
          )}
        </div>
        {!lista && !erro ? <Carregando /> : (
          <div className="table-responsive mt-3">
            <table className="table table-striped align-middle mb-0">
              <thead><tr>{verifica && <th style={{ width: 1 }} />}<th>{tx('Docente')}</th><th>{tx('Cadeiras')}</th><th>{tx('Registado em')}</th><th>{tx('Verificação')}</th></tr></thead>
              <tbody>
                {visiveis.length === 0 && <tr><td colSpan={5} className="text-center text-muted py-4">{filtro === 'por' ? tx('Todos os docentes estão verificados.') : tx('Sem docentes.')}</td></tr>}
                {visiveis.map((d) => (
                  <tr key={d.id} className={d.ativo ? '' : 'text-muted'}>
                    {verifica && <td>{!d.verificadoEm && <input type="checkbox" className="form-check-input" checked={escolhidos.includes(d.id)} onChange={() => marcar(d.id)} aria-label={tx('Escolher {0}', { 0: d.nome })} />}</td>}
                    <td><b>{d.nome}</b>{!d.ativo && <span className="badge bg-secondary ms-1">{tx('Inativo')}</span>}<div className="small text-muted">{[d.numero, d.dados?.posto, d.email].filter(Boolean).join(' · ')}</div></td>
                    <td className="small">{cadeiras(d).join('; ') || <span className="text-muted">{tx('Sem cadeiras atribuídas')}</span>}</td>
                    <td className="small text-nowrap">{dataHora(d.criadoEm)}</td>
                    <td>{d.verificadoEm ? <><span className="badge bg-success">{tx('Verificado')}</span><div className="small text-muted">{d.verificadoPor} · {dataHora(d.verificadoEm)}</div></> : <span className="badge bg-warning text-dark">{tx('Por verificar')}</span>}</td>
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

export default VerificarDocentes
