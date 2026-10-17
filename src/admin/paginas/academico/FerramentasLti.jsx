import { useCallback, useEffect, useState } from 'react'
import { api } from '../../api'
import { useSessao } from '../../sessaoContexto'
import { Aviso, CabecalhoPagina, Carregando, Confirmar, Erro, Painel } from '../../componentes/Ui'
import { t as tx } from '../../../i18n/linguas'

const VAZIA = { nome: '', descricao: '', urlLogin: '', urlLancamento: '', redirecionamentos: '', idImplementacao: '1', partilharDados: false, ativa: true }

// um valor para copiar para a configuração da ferramenta
function Copiar({ rotulo, valor }) {
  const [feito, setFeito] = useState(false)
  return (
    <div className="mb-2">
      <span className="small text-muted d-block">{rotulo}</span>
      <div className="input-group input-group-sm">
        <input className="form-control font-monospace" value={valor} readOnly onFocus={(e) => e.target.select()} />
        <button type="button" className="btn btn-white" onClick={() => { navigator.clipboard?.writeText(valor); setFeito(true); setTimeout(() => setFeito(false), 1500) }}>
          <i className={`fa ${feito ? 'fa-check text-success' : 'fa-copy'}`} />
        </button>
      </div>
    </div>
  )
}

/*
  Ferramentas externas por LTI 1.3 (laboratórios virtuais, simuladores, bibliotecas digitais…): a Administração
  Escolar regista cada ferramenta com os endereços que esta indica, e dá à ferramenta os dados do portal.
  Depois, os docentes juntam-na às cadeiras como atividade, e os estudantes entram sem nova palavra-passe.
*/
function FerramentasLti() {
  const { pode } = useSessao()
  const gerir = pode('academico.gerir')
  const [d, setD] = useState(null)
  const [erro, setErro] = useState('')
  const [f, setF] = useState(null) // em edição
  const [aGuardar, setAGuardar] = useState(false)
  const [aviso, setAviso] = useState(null)
  const [confirmar, setConfirmar] = useState(null)
  const carregar = useCallback(() => api('/academico/lti').then(setD).catch((e) => setErro(e.message)), [])
  useEffect(() => { carregar() }, [carregar])

  async function guardar(e) {
    e.preventDefault()
    setAGuardar(true)
    try {
      const corpo = { ...f, redirecionamentos: String(f.redirecionamentos || '').split(/\s+/).filter(Boolean) }
      if (f.id) await api(`/academico/lti/${f.id}`, { metodo: 'PUT', corpo })
      else await api('/academico/lti', { metodo: 'POST', corpo })
      setF(null)
      setAviso({ texto: tx('Ferramenta guardada.') })
      carregar()
    } catch (falha) {
      setAviso({ tipo: 'erro', texto: falha.message })
    } finally {
      setAGuardar(false)
    }
  }

  if (erro) return <Erro texto={erro} onRepetir={carregar} />
  if (!d) return <Carregando />
  const campo = (k, rotulo, extra = {}) => (
    <div className="mb-2"><label className="form-label fw-bold" htmlFor={`lti-${k}`}>{rotulo}</label><input id={`lti-${k}`} className="form-control" value={f[k] ?? ''} onChange={(e) => setF({ ...f, [k]: e.target.value })} {...extra} /></div>
  )
  return (
    <>
      <CabecalhoPagina titulo={tx('Ferramentas externas (LTI)')} subtitulo={tx('laboratórios virtuais, simuladores e outras plataformas, com entrada direta a partir do portal')} migalhas={[{ rotulo: tx('Ferramentas externas (LTI)') }]}>
        {gerir && !f && <button type="button" className="btn btn-theme" onClick={() => setF(VAZIA)}><i className="fa fa-plus me-1" />{tx('Registar ferramenta')}</button>}
      </CabecalhoPagina>

      <div className="row g-3">
        <div className="col-xl-5">
          <Painel titulo={<><i className="fa fa-id-card me-2" />{tx('Dados do portal para a ferramenta')}</>}>
            <p className="small text-muted">{tx('Na configuração LTI 1.3 da ferramenta, indique estes dados da plataforma (o portal). O Client ID e o Deployment ID são os de cada ferramenta, na lista ao lado.')}</p>
            <Copiar rotulo={tx('Emissor (Issuer / Platform ID)')} valor={d.plataforma.emissor} />
            <Copiar rotulo={tx('Chaves públicas (JWKS URL)')} valor={d.plataforma.jwks} />
            <Copiar rotulo={tx('Endereço de autorização (Authentication / OIDC Auth URL)')} valor={d.plataforma.autorizacao} />
            {/^http:\/\/(localhost|127\.)/.test(d.plataforma.emissor) && <div className="alert alert-warning small mb-0 mt-2">{tx('Este é um endereço local. Em produção, defina PUBLIC_URL na API: o emissor não pode mudar depois de configurar as ferramentas.')}</div>}
          </Painel>
        </div>
        <div className="col-xl-7">
          {f ? (
            <Painel titulo={f.id ? tx('Editar ferramenta') : tx('Registar ferramenta')}>
              <form onSubmit={guardar}>
                {campo('nome', tx('Nome'), { required: true, maxLength: 120 })}
                {campo('descricao', tx('Descrição (opcional)'), { maxLength: 500 })}
                {campo('urlLogin', tx('Endereço de início de sessão da ferramenta (Login / OIDC initiation URL)'), { type: 'url', required: true, placeholder: 'https://…' })}
                {campo('urlLancamento', tx('Endereço de lançamento (Target link / Redirect URI)'), { type: 'url', required: true, placeholder: 'https://…' })}
                <div className="mb-2"><label className="form-label fw-bold" htmlFor="lti-red">{tx('Outros endereços de retorno (opcional, um por linha)')}</label><textarea id="lti-red" className="form-control" rows={2} value={Array.isArray(f.redirecionamentos) ? f.redirecionamentos.join('\n') : f.redirecionamentos} onChange={(e) => setF({ ...f, redirecionamentos: e.target.value })} /></div>
                {campo('idImplementacao', tx('Deployment ID'), { maxLength: 100 })}
                <label className="form-check mb-1"><input type="checkbox" className="form-check-input" checked={f.partilharDados} onChange={(e) => setF({ ...f, partilharDados: e.target.checked })} /> <span className="form-check-label">{tx('Enviar o nome e o e-mail de quem entra (sem isto, a ferramenta só recebe um identificador)')}</span></label>
                <label className="form-check mb-3"><input type="checkbox" className="form-check-input" checked={f.ativa} onChange={(e) => setF({ ...f, ativa: e.target.checked })} /> <span className="form-check-label">{tx('Ativa (os docentes podem usá-la)')}</span></label>
                <div className="d-flex gap-2">
                  <button type="submit" className="btn btn-theme" disabled={aGuardar}>{aGuardar ? tx('A guardar…') : tx('Guardar')}</button>
                  <button type="button" className="btn btn-white" onClick={() => setF(null)}>{tx('Cancelar')}</button>
                </div>
              </form>
            </Painel>
          ) : (
            <Painel titulo={tx('Ferramentas registadas ({0})', { 0: d.ferramentas.length })} corpo={false}>
              {d.ferramentas.length === 0 ? <div className="text-center text-muted py-5"><i className="fa fa-plug fa-2x d-block mb-2 opacity-50" />{tx('Ainda não há ferramentas. Registe a primeira com os endereços que a ferramenta lhe indicar.')}</div> : (
                <div className="list-group list-group-flush">
                  {d.ferramentas.map((x) => (
                    <div key={x.id} className="list-group-item">
                      <div className="d-flex align-items-center gap-2 mb-1">
                        <b className="flex-grow-1">{x.nome}</b>
                        <span className={`badge ${x.ativa ? 'bg-success' : 'bg-secondary'}`}>{x.ativa ? tx('Ativa') : tx('Desativada')}</span>
                        {gerir && <button type="button" className="btn btn-xs btn-white" onClick={() => setF({ ...x, redirecionamentos: x.redirecionamentos.join('\n') })}><i className="fa fa-pen" /></button>}
                        {gerir && <button type="button" className="btn btn-xs btn-white text-danger" onClick={() => setConfirmar({ titulo: tx('Apagar ferramenta'), texto: tx('Apagar «{0}»? As atividades que a usam deixam de abrir.', { 0: x.nome }), botao: tx('Apagar'), perigo: true, confirmar: async () => { setConfirmar(null); try { await api(`/academico/lti/${x.id}`, { metodo: 'DELETE' }); carregar() } catch (e) { setAviso({ tipo: 'erro', texto: e.message }) } } })}><i className="fa fa-trash-alt" /></button>}
                      </div>
                      {x.descricao && <div className="small text-muted mb-2">{x.descricao}</div>}
                      <div className="row g-2">
                        <div className="col-md-6"><Copiar rotulo="Client ID" valor={x.clienteId} /></div>
                        <div className="col-md-6"><Copiar rotulo="Deployment ID" valor={x.idImplementacao} /></div>
                      </div>
                    </div>
                  ))}
                </div>
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

export default FerramentasLti
