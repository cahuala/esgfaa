import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import { useSessao } from '../sessaoContexto'
import { Aviso, CabecalhoPagina, Carregando, Confirmar, Erro, Painel } from '../componentes/Ui'
import { dataHora } from '../formatar'
import { t as tx } from '../../i18n/linguas'

const CORES = { nova: 'bg-danger', lida: 'bg-secondary', respondida: 'bg-success' }
const FILTROS = { porTratar: tx('Por tratar'), todas: tx('Todas'), respondida: tx('Respondidas') }

// avisa o menu (contador de mensagens novas) quando se trata uma mensagem
const avisarMenu = () => window.dispatchEvent(new Event('esg-contactos'))

/*
  Mensagens do formulário de contacto do site, como uma caixa de correio:
  à esquerda a lista, à direita a mensagem aberta, com "Responder por e-mail" e as notas internas.
*/
function MensagensSite() {
  const { pode } = useSessao()
  const gerir = pode('contactos.gerir')
  const [d, setD] = useState(null)
  const [erro, setErro] = useState('')
  const [filtro, setFiltro] = useState('porTratar')
  const [pesquisa, setPesquisa] = useState('')
  const [aberta, setAberta] = useState(null)
  const [notas, setNotas] = useState('')
  const [confirmar, setConfirmar] = useState(null)
  const [aviso, setAviso] = useState(null)

  const carregar = useCallback(() => api('/contactos').then((r) => { setErro(''); setD(r) }).catch((e) => setErro(e.message)), [])
  useEffect(() => { carregar() }, [carregar])

  const substituir = (m) => { setD((x) => ({ ...x, mensagens: x.mensagens.map((y) => (y.id === m.id ? m : y)) })); setAberta(m); avisarMenu() }

  async function abrir(m) {
    setAberta(m)
    setNotas(m.notas || '')
    try { substituir(await api(`/contactos/${m.id}`)) } catch (e) { setAviso({ tipo: 'erro', texto: e.message }) }
  }

  async function mudar(corpo, texto) {
    try {
      const m = await api(`/contactos/${aberta.id}`, { metodo: 'PATCH', corpo })
      substituir(m)
      if (texto) setAviso({ texto })
    } catch (e) {
      setAviso({ tipo: 'erro', texto: e.message })
    }
  }

  function pedirApagar() {
    const m = aberta
    setConfirmar({
      titulo: tx('Apagar mensagem'),
      texto: <>{tx('Apagar a mensagem de')} <b>{m.nome}</b>? {tx('Não se pode desfazer.')}</>,
      botao: tx('Apagar'),
      perigo: true,
      confirmar: async () => {
        setConfirmar(null)
        try {
          await api(`/contactos/${m.id}`, { metodo: 'DELETE' })
          setD((x) => ({ ...x, mensagens: x.mensagens.filter((y) => y.id !== m.id) }))
          setAberta(null)
          avisarMenu()
          setAviso({ texto: tx('Mensagem apagada.') })
        } catch (e) {
          setAviso({ tipo: 'erro', texto: e.message })
        }
      },
    })
  }

  if (erro) return <Erro texto={erro} onRepetir={carregar} />
  if (!d) return <Carregando />
  const termo = pesquisa.trim().toLowerCase()
  const lista = d.mensagens.filter((m) => (filtro === 'todas' || (filtro === 'respondida' ? m.estado === 'respondida' : m.estado !== 'respondida'))
    && (!termo || `${m.nome} ${m.email} ${m.assunto} ${m.mensagem}`.toLowerCase().includes(termo)))
  const novas = d.mensagens.filter((m) => m.estado === 'nova').length
  const responder = aberta && `mailto:${aberta.email}?subject=${encodeURIComponent(`Re: ${aberta.assunto}`)}&body=${encodeURIComponent(`\n\n\n— ${tx('Mensagem de {0}, {1}:', { 0: aberta.nome, 1: dataHora(aberta.criadoEm) })}\n> ${aberta.mensagem.replace(/\n/g, '\n> ')}`)}`

  return (
    <>
      <CabecalhoPagina titulo={tx('Mensagens do site')} subtitulo={tx('enviadas pelo formulário de contacto')} migalhas={[{ rotulo: tx('Mensagens do site') }]} />
      <div className="row g-3">
        <div className="col-lg-5">
          <Painel titulo={<>{tx('Caixa de entrada')}{novas > 0 && <span className="badge bg-danger ms-2">{tx('{0} nova(s)', { 0: novas })}</span>}</>} corpo={false}>
            <div className="panel-body pb-2 d-flex flex-column gap-2">
              <div className="btn-group btn-group-sm">
                {Object.entries(FILTROS).map(([k, v]) => <button key={k} type="button" className={`btn ${filtro === k ? 'btn-dark' : 'btn-white'}`} onClick={() => setFiltro(k)}>{v}</button>)}
              </div>
              <div className="input-group input-group-sm">
                <span className="input-group-text"><i className="fa fa-search" /></span>
                <input className="form-control" placeholder={tx('Pesquisar nome, e-mail ou texto…')} value={pesquisa} onChange={(e) => setPesquisa(e.target.value)} />
              </div>
            </div>
            <div className="list-group list-group-flush esg-caixa">
              {lista.length === 0 && <div className="text-center text-muted py-5"><i className="fa fa-inbox fa-2x d-block mb-2 opacity-50" />{filtro === 'porTratar' ? tx('Não há mensagens por tratar.') : tx('Sem mensagens.')}</div>}
              {lista.map((m) => (
                <button key={m.id} type="button" onClick={() => abrir(m)} className={`list-group-item list-group-item-action text-start ${aberta?.id === m.id ? 'active' : ''}`}>
                  <div className="d-flex align-items-center gap-2">
                    <span className={`${m.estado === 'nova' ? 'fw-bold' : ''} text-truncate flex-grow-1`}>{m.nome}</span>
                    <small className="text-nowrap opacity-75">{dataHora(m.criadoEm)}</small>
                  </div>
                  <div className={`small text-truncate ${m.estado === 'nova' ? 'fw-bold' : ''}`}>{m.assunto}</div>
                  <div className="small text-truncate opacity-75">{m.mensagem}</div>
                </button>
              ))}
            </div>
          </Painel>
        </div>

        <div className="col-lg-7">
          {!aberta ? (
            <Painel titulo={tx('Mensagem')}><div className="text-center text-muted py-5">{tx('Escolha uma mensagem à esquerda para a ler.')}</div></Painel>
          ) : (
            <Painel titulo={aberta.assunto} acoes={<span className={`badge ${CORES[aberta.estado]}`}>{tx(d.estados[aberta.estado])}</span>}>
              <dl className="row mb-3 small">
                <dt className="col-sm-3">{tx('De')}</dt><dd className="col-sm-9">{aberta.nome} · <a href={`mailto:${aberta.email}`}>{aberta.email}</a></dd>
                {aberta.telefone && <><dt className="col-sm-3">{tx('Telefone')}</dt><dd className="col-sm-9"><a href={`tel:${aberta.telefone.replace(/\s/g, '')}`}>{aberta.telefone}</a></dd></>}
                <dt className="col-sm-3">{tx('Recebida')}</dt><dd className="col-sm-9">{dataHora(aberta.criadoEm)}</dd>
                {aberta.tratadoPor && <><dt className="col-sm-3">{tx('Tratada por')}</dt><dd className="col-sm-9">{aberta.tratadoPor}</dd></>}
              </dl>
              <div className="p-3 rounded bg-light mb-3" style={{ whiteSpace: 'pre-wrap' }}>{aberta.mensagem}</div>

              <div className="d-flex flex-wrap gap-2 mb-3">
                <a className="btn btn-theme" href={responder}><i className="fa fa-reply me-1" />{tx('Responder por e-mail')}</a>
                {gerir && aberta.estado !== 'respondida' && <button type="button" className="btn btn-success" onClick={() => mudar({ estado: 'respondida' }, tx('Marcada como respondida.'))}><i className="fa fa-check me-1" />{tx('Marcar como respondida')}</button>}
                {gerir && aberta.estado === 'respondida' && <button type="button" className="btn btn-white" onClick={() => mudar({ estado: 'lida' })}><i className="fa fa-undo me-1" />{tx('Voltar a pôr por tratar')}</button>}
                {gerir && <button type="button" className="btn btn-white text-danger ms-auto" onClick={pedirApagar}><i className="fa fa-trash-alt me-1" />{tx('Apagar')}</button>}
              </div>

              {gerir && (
                <>
                  <label className="form-label fw-bold" htmlFor="c-notas">{tx('Notas internas')} <small className="fw-normal text-muted">({tx('só se veem aqui')})</small></label>
                  <textarea id="c-notas" className="form-control mb-2" rows={3} maxLength={3000} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder={tx('Ex.: reencaminhado para a Repartição de Administração Escolar.')} />
                  <button type="button" className="btn btn-sm btn-white" disabled={notas === (aberta.notas || '')} onClick={() => mudar({ notas }, tx('Notas guardadas.'))}>{tx('Guardar notas')}</button>
                </>
              )}
            </Painel>
          )}
        </div>
      </div>
      <Confirmar pedido={confirmar} onCancelar={() => setConfirmar(null)} />
      <Aviso aviso={aviso} onFechar={() => setAviso(null)} />
    </>
  )
}

export default MensagensSite
