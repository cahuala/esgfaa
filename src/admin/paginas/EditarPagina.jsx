import { useCallback, useEffect, useState } from 'react'
import { Navigate, useBlocker, useParams } from 'react-router-dom'
import { api } from '../api'
import { useSessao } from '../sessaoContexto'
import { PAGINAS } from '../esquemas'
import { Formulario } from '../componentes/Campo'
import { orgaosDe } from '../../components/Organograma/orgaos'
import { Aviso, CabecalhoPagina, Carregando, Erro } from '../componentes/Ui'
import Traducoes from '../componentes/Traducoes'
import { t as tx } from '../../i18n/linguas'

const SITE = import.meta.env.BASE_URL.replace(/\/$/, '')

function EditarPagina() {
  const { chave } = useParams()
  const def = PAGINAS[chave]
  const { pode } = useSessao()
  const podeEditar = pode('paginas.editar')
  const [dados, setDados] = useState(null)
  const [original, setOriginal] = useState(null)
  const [pessoas, setPessoas] = useState([])
  const [separador, setSeparador] = useState(0)
  const [erro, setErro] = useState('')
  const [aGuardar, setAGuardar] = useState(false)
  const [aviso, setAviso] = useState(null)

  const carregar = useCallback(() => {
    if (!def) return
    Promise.all([api(`/paginas/${chave}`), api('/colecoes/pessoas')])
      .then(([pg, lista]) => {
        // página guardada antes do organograma: começa com o que o site já mostra (tirado das áreas)
        const p = chave === 'institucional' && pg?.estrutura && !pg.estrutura.orgaos?.length
          ? { ...pg, estrutura: { ...pg.estrutura, orgaos: orgaosDe(pg.estrutura).map((o) => ({ sigla: '', responsavel: '', dependeDe: '', tipo: 'linha', ligacao: '', texto: '', ...o })) } }
          : pg
        setDados(p)
        setOriginal(JSON.stringify(p))
        setPessoas(lista)
      })
      .catch((e) => setErro(e.message))
  }, [chave, def])
  useEffect(carregar, [carregar])

  const alterado = dados !== null && JSON.stringify(dados) !== original
  const bloqueio = useBlocker(({ currentLocation, nextLocation }) => alterado && currentLocation.pathname !== nextLocation.pathname)

  if (!def) return <Navigate to="/" replace />

  async function guardar(e) {
    e.preventDefault()
    setAGuardar(true)
    try {
      const guardado = await api(`/paginas/${chave}`, { metodo: 'PUT', corpo: dados })
      setDados(guardado)
      setOriginal(JSON.stringify(guardado))
      setAviso({ texto: guardado._aprovacao?.estado === 'pendente' ? tx('Alterações enviadas ao Comandante. O site continua a mostrar a versão aprovada até ele decidir.') : tx('Página guardada e publicada.') })
    } catch (falha) {
      setAviso({ tipo: 'erro', texto: falha.message })
    } finally {
      setAGuardar(false)
    }
  }

  return (
    <>
      <CabecalhoPagina titulo={def.titulo} subtitulo={tx('conteúdos da página')} migalhas={[{ rotulo: tx('Páginas do site') }, { rotulo: def.titulo }]}>
        <a href={`${SITE}${def.rota}`} target="_blank" rel="noreferrer" className="btn btn-white">
          <i className="fa fa-external-link-alt me-1" /> {tx('Ver no site')}
        </a>
      </CabecalhoPagina>

      {erro && <Erro texto={erro} onRepetir={() => { setErro(''); carregar() }} />}
      {dados && <Traducoes colecao="paginas" id={chave} horizontal />}
      {!dados && !erro && <Carregando />}

      {dados?._aprovacao?.estado === 'pendente' && <div className="alert alert-info"><i className="fa fa-hourglass-half me-2" /><b>{tx('À espera da aprovação do Comandante.')}</b> {tx('Pedido por {0}, {1}.', { 0: dados._aprovacao.pedidoPor, 1: new Date(dados._aprovacao.pedidoEm).toLocaleString() })} {tx('O site mostra a versão aprovada; o que vê aqui é a alteração proposta.')}</div>}
      {dados?._aprovacao?.estado === 'recusado' && <div className="alert alert-danger"><i className="fa fa-times-circle me-2" /><b>{tx('O Comandante recusou a publicação')}</b>: {dados._aprovacao.motivo} {tx('Corrija e envie de novo.')}</div>}
      {dados && (
        <form onSubmit={guardar}>
          <ul className="nav nav-tabs nav-tabs-inverse">
            {def.grupos.map((g, i) => (
              <li key={g.titulo} className="nav-item">
                <button type="button" className={`nav-link ${i === separador ? 'active' : ''}`} onClick={() => setSeparador(i)}>{g.titulo}</button>
              </li>
            ))}
          </ul>
          <div className="tab-content panel rounded-0 rounded-bottom p-3 mb-3">
            <fieldset disabled={!podeEditar}>
              <Formulario campos={def.grupos[separador].campos} valor={dados} onChange={setDados} contexto={{ pessoas }} horizontal />
            </fieldset>
          </div>

          <div className="barra-guardar">
            <span className="text-muted">
              {alterado ? <><i className="fa fa-circle text-warning fs-8px me-2" />{tx('Alterações por guardar')}</> : <><i className="fa fa-check text-success me-2" />{tx('Tudo guardado')}</>}
            </span>
            <button type="submit" className="btn btn-theme" disabled={aGuardar || !alterado || !podeEditar}>
              {aGuardar ? <><span className="spinner-border spinner-border-sm me-1" /> {tx('A guardar…')}</> : (pode('publicacoes.aprovar') ? <><i className="fa fa-save me-1" /> {tx('Guardar e publicar')}</> : <><i className="fa fa-paper-plane me-1" /> {tx('Enviar alterações ao Comandante')}</>)}
            </button>
          </div>
        </form>
      )}

      {bloqueio.state === 'blocked' && (
        <>
          <div className="modal d-block" role="dialog" aria-modal="true">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header"><h4 className="modal-title">{tx('Alterações por guardar')}</h4></div>
                <div className="modal-body">{tx('Se sair agora, perde as alterações que fez a esta página.')}</div>
                <div className="modal-footer">
                  <button className="btn btn-white" onClick={() => bloqueio.reset()}>{tx('Continuar a editar')}</button>
                  <button className="btn btn-danger" onClick={() => bloqueio.proceed()}>{tx('Sair sem guardar')}</button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" />
        </>
      )}

      <Aviso aviso={aviso} onFechar={() => setAviso(null)} />
    </>
  )
}

export default EditarPagina
