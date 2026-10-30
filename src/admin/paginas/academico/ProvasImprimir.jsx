import { useCallback, useEffect, useState } from 'react'
import { api, obterFicheiro } from '../../api'
import { useSessao } from '../../sessaoContexto'
import { Aviso, CabecalhoPagina, Carregando, Erro, Painel } from '../../componentes/Ui'
import Exportar from '../../componentes/Exportar'
import { dataHora } from '../../formatar'
import { t as tx } from '../../../i18n/linguas'

const ESTADOS = { enviado: ['bg-warning text-dark', tx('Por imprimir')], impresso: ['bg-success', tx('Impressa')] }
const dia = (d) => (d ? d.split('-').reverse().join('/') : '—')

/*
  Provas escritas que os docentes enviaram para imprimir: a Repartição de Administração Escolar abre o
  enunciado, imprime as cópias (uma por estudante) e marca como impressa — o docente é avisado no portal.
*/
function ProvasImprimir() {
  const { pode } = useSessao()
  const [lista, setLista] = useState(null)
  const [erro, setErro] = useState('')
  const [estado, setEstado] = useState('enviado')
  const [aviso, setAviso] = useState(null)
  const gerir = pode('academico.gerir')
  const carregar = useCallback(() => api(`/academico/provas-escritas${estado ? `?estado=${estado}` : ''}`).then((r) => { setErro(''); setLista(r) }).catch((e) => setErro(e.message)), [estado])
  useEffect(() => { carregar() }, [carregar])

  // o PDF abre noutro separador, pronto a imprimir; um documento Word descarrega-se
  const abrir = (p) => obterFicheiro(`/academico/ficheiros/${p.ficheiroId}?ver=1`, `${p.cadeira.codigo} - ${p.titulo}`, { abrir: true }).catch((e) => setAviso({ tipo: 'erro', texto: e.message }))
  const marcar = (p, impresso) => api(`/academico/provas-escritas/${p.id}`, { metodo: 'PUT', corpo: { impresso } })
    .then(() => { setAviso({ texto: impresso ? tx('Marcada como impressa. O docente foi avisado.') : tx('Voltou a «por imprimir».') }); carregar(); window.dispatchEvent(new Event('esg-pendentes')) })
    .catch((e) => setAviso({ tipo: 'erro', texto: e.message }))

  return (
    <>
      <CabecalhoPagina titulo={tx('Provas para imprimir')} subtitulo={tx('enviadas pelos docentes no portal')} migalhas={[{ rotulo: tx('Administração Escolar') }, { rotulo: tx('Provas para imprimir') }]} />
      {erro && <Erro texto={erro} onRepetir={carregar} />}
      <Painel
        titulo={`${tx('Provas')}${lista ? ` (${lista.length})` : ''}`}
        corpo={false}
        acoes={lista?.length > 0 && <Exportar titulo={tx('Provas para imprimir')} filtro={estado ? ESTADOS[estado][1] : ''} linhas={lista} colunas={[
          { titulo: tx('Data da prova'), valor: (p) => dia(p.data) }, { titulo: tx('Cadeira'), valor: (p) => `${p.cadeira.codigo} ${p.cadeira.nome}` }, { titulo: tx('Turma'), valor: (p) => p.cadeira.turma?.nome },
          { titulo: tx('Prova'), valor: (p) => p.titulo }, { titulo: tx('Docente'), valor: (p) => p.docente }, { titulo: tx('Cópias'), valor: (p) => p.copias }, { titulo: tx('Estado'), valor: (p) => ESTADOS[p.estado][1] },
        ]} />}
      >
        <div className="panel-body pb-0 d-flex flex-wrap gap-2 align-items-center">
          <div className="btn-group btn-group-sm">
            {[['enviado', tx('Por imprimir')], ['impresso', tx('Impressas')], ['', tx('Todas')]].map(([k, v]) => <button key={k} type="button" className={`btn ${estado === k ? 'btn-dark' : 'btn-white'}`} onClick={() => setEstado(k)}>{v}</button>)}
          </div>
          <span className="small text-muted">{tx('Abra o enunciado, imprima as cópias indicadas e marque como impressa.')}</span>
        </div>
        {!lista && !erro ? <Carregando /> : (
          <div className="table-responsive mt-3">
            <table className="table table-striped align-middle mb-0">
              <thead><tr><th>{tx('Data da prova')}</th><th>{tx('Cadeira e turma')}</th><th>{tx('Prova')}</th><th>{tx('Docente')}</th><th className="text-center">{tx('Cópias')}</th><th>{tx('Estado')}</th><th className="text-end">{tx('Ações')}</th></tr></thead>
              <tbody>
                {lista?.length === 0 && <tr><td colSpan={7} className="text-center text-muted py-4">{estado === 'enviado' ? tx('Não há provas por imprimir.') : tx('Sem provas.')}</td></tr>}
                {lista?.map((p) => (
                  <tr key={p.id}>
                    <td className="text-nowrap fw-bold">{dia(p.data)}</td>
                    <td><b>{p.cadeira.codigo}</b> {p.cadeira.nome}<div className="small text-muted">{p.cadeira.turma?.nome}</div></td>
                    <td>{p.titulo}{p.observacoes && <div className="small text-muted"><i className="fa fa-info-circle me-1" />{p.observacoes}</div>}</td>
                    <td>{p.docente}<div className="small text-muted">{dataHora(p.enviadoEm)}</div></td>
                    <td className="text-center fs-5 fw-bold">{p.copias}</td>
                    <td><span className={`badge ${ESTADOS[p.estado][0]}`}>{ESTADOS[p.estado][1]}</span>{p.impressoEm && <div className="small text-muted">{p.impressoPor} · {dataHora(p.impressoEm)}</div>}</td>
                    <td className="text-end text-nowrap">
                      <button type="button" className="btn btn-sm btn-white me-1" onClick={() => abrir(p)}><i className="fa fa-print me-1" />{tx('Abrir e imprimir')}</button>
                      {gerir && p.estado === 'enviado' && <button type="button" className="btn btn-sm btn-success" onClick={() => marcar(p, true)}><i className="fa fa-check me-1" />{tx('Impressa')}</button>}
                      {gerir && p.estado === 'impresso' && <button type="button" className="btn btn-sm btn-white" onClick={() => marcar(p, false)} title={tx('Voltar a «por imprimir»')}><i className="fa fa-undo" /></button>}
                    </td>
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

export default ProvasImprimir
