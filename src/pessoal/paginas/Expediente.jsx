import { useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { abrirFicheiro, api, enviarComProgresso } from '../api'
import { useSessao } from '../sessao'
import { useDados } from '../useDados'
import Tabela from '../componentes/Tabela'
import Carregar from '../componentes/Carregar'
import { Cabecalho, Campo, Carregando, Erro, Escolha, Modal, Painel } from '../componentes/Ui'
import { dataHoraPt, dataPt } from '../formatar'

const CAIXAS = [['por_receber', 'Por receber', 'fa-inbox'], ['na_unidade', 'Na minha unidade', 'fa-folder-open'], ['enviados', 'Enviados', 'fa-paper-plane'], ['arquivo', 'Arquivo', 'fa-archive']]
const COR_CLASS = { normal: 'bg-light text-dark border', urgente: 'bg-danger', confidencial: 'bg-dark' }
const avisarMenu = () => window.dispatchEvent(new Event('pes-avisos'))

// expediente entre as áreas da Escola: documentos digitais com protocolo e o percurso do original em papel
export default function Expediente() {
  const { id } = useParams()
  return id ? <Documento id={Number(id)} /> : <Caixas />
}

function Caixas() {
  const { utilizador, pode } = useSessao()
  const navegar = useNavigate()
  const [params, setParams] = useSearchParams()
  // o administrador sem unidade abre o livro de expediente (todas as áreas)
  const caixa = params.get('caixa') ?? (utilizador.unidadeId ? 'por_receber' : 'todos')
  // no livro e no arquivo: o período, o sentido (entrada, saída, interno) e o armário
  const comFiltros = caixa === 'todos' || caixa === 'arquivo'
  const filtros = useMemo(() => (comFiltros ? Object.fromEntries(['de', 'ate', 'sentido', 'armario'].map((k) => [k, params.get(k) ?? '']).filter(([, v]) => v)) : {}), [params, comFiltros])
  const consulta = useMemo(() => ({ caixa, ...filtros }), [caixa, filtros])
  const mudar = (k, v) => { const n = new URLSearchParams(params); n.set('caixa', caixa); if (v) n.set(k, v); else n.delete(k); setParams(n) }
  const { dados, erro, recarregar } = useDados('/expediente', consulta)
  const [novo, setNovo] = useState(false)
  const colunas = useMemo(() => [
    { chave: 'protocolo', titulo: 'Protocolo', valor: (x) => x.protocolo, mostrar: (x) => <><strong>{x.protocolo}</strong>{x.porReceber && <span className="badge bg-warning text-dark ms-1">novo</span>}</> },
    { chave: 'data', titulo: 'Data', valor: (x) => x.criadoEm, mostrar: (x) => dataHoraPt(x.criadoEm) },
    { chave: 'assunto', titulo: 'Assunto', valor: (x) => x.assunto, mostrar: (x) => <><strong>{x.assunto}</strong><div className="small text-muted">{x.tipoNome}{x.numero && ` n.º ${x.numero}`}{x.anexos ? ` · 📎 ${x.anexos}` : ''}</div></> },
    { chave: 'class', titulo: 'Classificação', valor: (x) => x.classificacao, mostrar: (x) => <span className={`badge ${COR_CLASS[x.classificacao]}`}>{x.classificacao}</span> },
    { chave: 'origem', titulo: 'Origem', valor: (x) => x.origem },
    { chave: 'local', titulo: 'Onde está', valor: (x) => x.localAtual },
    { chave: 'fisico', titulo: 'Original', valor: (x) => (x.temFisico ? (x.fisicoPendente ? 'Por chegar' : 'Sim') : ''), mostrar: (x) => (x.temFisico ? <span className={`badge ${x.fisicoPendente ? 'bg-warning text-dark' : 'bg-success'}`}><i className="fa fa-file-alt me-1" />{x.fisicoPendente ? 'por chegar' : 'papel'}</span> : '') },
    { chave: 'sentido', titulo: 'Sentido', valor: (x) => ({ interno: 'Interno', entrada: 'Entrada', saida: 'Saída' }[x.sentido] ?? x.sentido), oculta: caixa !== 'todos' },
    { chave: 'arquivo', titulo: 'Armário / prateleira / pasta', valor: (x) => [x.armario && `Armário ${x.armario}`, x.prateleira && `prat. ${x.prateleira}`, x.pasta && `pasta ${x.pasta}`].filter(Boolean).join(' · '), oculta: caixa !== 'arquivo' },
    { chave: 'prazo', titulo: 'Prazo', valor: (x) => x.prazo ?? '', mostrar: (x) => (x.prazo ? <span className={x.prazo < new Date().toISOString().slice(0, 10) && x.estado === 'em_curso' ? 'text-danger fw-bold' : ''}>{dataPt(x.prazo)}</span> : '') },
  ], [caixa])
  if (!utilizador.unidadeId && !pode('administrar') && !pode('supervisionar')) return <div className="alert alert-warning">A sua conta não está ligada a nenhuma unidade. Peça ao administrador para a indicar.</div>
  const caixas = pode('administrar') || pode('supervisionar') ? [...CAIXAS, ['todos', 'Livro de expediente', 'fa-book']] : CAIXAS
  return (
    <>
      <Cabecalho titulo="Expediente" subtitulo={utilizador.unidadeNome} migalhas={[['Expediente']]}>
        {utilizador.unidadeId && <button type="button" className="btn btn-theme" onClick={() => setNovo(true)}><i className="fa fa-plus me-1" />Novo documento</button>}
      </Cabecalho>
      <ul className="nav nav-tabs mb-3">{caixas.map(([k, t, ic]) => <li key={k} className="nav-item"><button type="button" className={`nav-link ${caixa === k ? 'active' : ''}`} onClick={() => setParams({ caixa: k })}><i className={`fa ${ic} me-1`} />{t}</button></li>)}</ul>
      {comFiltros && (
        <div className="row g-2 mb-2 align-items-end">
          <div className="col-6 col-md-2"><label className="form-label small mb-0 text-muted">Registado de</label><input type="date" className="form-control form-control-sm" value={filtros.de ?? ''} onChange={(e) => mudar('de', e.target.value)} /></div>
          <div className="col-6 col-md-2"><label className="form-label small mb-0 text-muted">até</label><input type="date" className="form-control form-control-sm" value={filtros.ate ?? ''} min={filtros.de} onChange={(e) => mudar('ate', e.target.value)} /></div>
          <div className="col-6 col-md-3"><label className="form-label small mb-0 text-muted">Sentido</label><Escolha valor={filtros.sentido} aoMudar={(v) => mudar('sentido', v)} opcoes={{ entrada: 'Entrada (de fora da Escola)', saida: 'Saída (para fora da Escola)', interno: 'Interno' }} vazio="Todos" /></div>
          <div className="col-6 col-md-2"><label className="form-label small mb-0 text-muted">Armário</label><input className="form-control form-control-sm" defaultValue={filtros.armario ?? ''} key={filtros.armario ?? ''} onBlur={(e) => mudar('armario', e.target.value.trim())} onKeyDown={(e) => e.key === 'Enter' && mudar('armario', e.target.value.trim())} placeholder="Ex.: A1" /></div>
        </div>
      )}
      <Painel>
        {erro ? <Erro texto={erro} /> : !dados ? <Carregando /> : <Tabela titulo={`Expediente — ${caixas.find((c) => c[0] === caixa)[1]}`} subtitulo={[utilizador.unidadeNome, filtros.de && `de ${dataPt(filtros.de)}`, filtros.ate && `até ${dataPt(filtros.ate)}`, filtros.sentido && { entrada: 'entradas', saida: 'saídas', interno: 'internos' }[filtros.sentido], filtros.armario && `armário ${filtros.armario}`].filter(Boolean).join(' · ')} colunas={colunas} linhas={dados} aoClicar={(x) => navegar(`/expediente/${x.id}`)} vazio="Nada nesta caixa." />}
      </Painel>
      {novo && <NovoDocumento aoFechar={() => setNovo(false)} aoCriar={(x) => { setNovo(false); recarregar(); navegar(`/expediente/${x.id}`) }} />}
    </>
  )
}

// áreas de destino pela árvore da orgânica (com recuo para as subunidades)
function Destinos({ valor, aoMudar, unidades, minha }) {
  const nivel = (u) => { let n = 0; for (let x = u; x?.paiId; x = unidades.find((y) => y.id === x.paiId)) n++; return n }
  const ordem = []
  const andar = (pai) => unidades.filter((u) => (u.paiId ?? null) === pai).forEach((u) => { ordem.push(u); andar(u.id) })
  andar(null)
  return (
    <div className="border rounded p-2" style={{ maxHeight: 220, overflow: 'auto' }}>
      {ordem.filter((u) => u.id !== minha).map((u) => (
        <label key={u.id} className="form-check d-block small" style={{ marginLeft: nivel(u) * 16 }}><input type="checkbox" className="form-check-input" checked={valor.includes(u.id)} onChange={(e) => aoMudar(e.target.checked ? [...valor, u.id] : valor.filter((x) => x !== u.id))} /> <span className="form-check-label">{u.sigla && <strong className="me-1">{u.sigla}</strong>}{u.nome}</span></label>
      ))}
    </div>
  )
}

function NovoDocumento({ aoFechar, aoCriar }) {
  const { ref, utilizador } = useSessao()
  const { dados: unidades } = useDados('/expediente/unidades')
  const [d, setD] = useState({ sentido: 'interno', tipo: 'oficio', numero: '', assunto: '', resumo: '', classificacao: 'normal', entidadeExterna: '', temFisico: false, prazo: '', destinos: [], nota: '', portador: '' })
  const [anexos, setAnexos] = useState([])
  const [erro, setErro] = useState('')
  const [aEnviar, setAEnviar] = useState(false)
  const set = (k) => (v) => setD({ ...d, [k]: v?.target ? (v.target.type === 'checkbox' ? v.target.checked : v.target.value) : v })
  async function enviar() {
    setErro('')
    setAEnviar(true)
    const fd = new FormData()
    fd.append('dados', JSON.stringify({ ...d, prazo: d.prazo || null }))
    for (const f of anexos) fd.append('anexos', f)
    try {
      const x = await api('/expediente', { metodo: 'POST', formulario: fd })
      avisarMenu()
      aoCriar(x)
    } catch (e) {
      setErro(e.message)
      setAEnviar(false)
    }
  }
  return (
    <Modal titulo="Novo documento" largo aoFechar={aoFechar} rodape={<><button type="button" className="btn btn-outline-secondary" onClick={aoFechar}>Cancelar</button><button type="button" className="btn btn-theme" onClick={enviar} disabled={aEnviar || !d.assunto}><i className="fa fa-paper-plane me-1" />{d.sentido === 'entrada' ? 'Registar entrada' : 'Enviar'}</button></>}>
      {erro && <div className="alert alert-danger">{erro}</div>}
      <div className="row">
        <Campo rotulo="Sentido" col="col-md-4"><Escolha valor={d.sentido} aoMudar={set('sentido')} opcoes={ref.sentidos} vazio={null} /></Campo>
        <Campo rotulo="Tipo" col="col-md-4"><Escolha valor={d.tipo} aoMudar={set('tipo')} opcoes={ref.tiposExpediente} vazio={null} /></Campo>
        <Campo rotulo="Classificação" col="col-md-4"><Escolha valor={d.classificacao} aoMudar={set('classificacao')} opcoes={ref.classificacoes} vazio={null} /></Campo>
        <Campo rotulo="Assunto" obrigatorio col="col-md-8"><input className="form-control form-control-sm" value={d.assunto} onChange={set('assunto')} /></Campo>
        <Campo rotulo="N.º do documento" col="col-md-4"><input className="form-control form-control-sm" placeholder="Ex.: ____/ESG/2026" value={d.numero} onChange={set('numero')} /></Campo>
        {d.sentido !== 'interno' && <Campo rotulo={d.sentido === 'entrada' ? 'Veio de (entidade externa)' : 'Para (entidade externa)'} col="col-md-8"><input className="form-control form-control-sm" value={d.entidadeExterna} onChange={set('entidadeExterna')} /></Campo>}
        <Campo rotulo="Prazo de resposta" col="col-md-4"><input type="date" className="form-control form-control-sm" value={d.prazo} onChange={set('prazo')} /></Campo>
        <Campo rotulo="Resumo" col="col-12"><textarea className="form-control form-control-sm" rows={3} value={d.resumo} onChange={set('resumo')} /></Campo>
        <Campo rotulo={d.sentido === 'entrada' ? 'Distribuir também a (opcional)' : 'Enviar a (áreas da Escola)'} obrigatorio={d.sentido === 'interno'} col="col-md-6">{unidades ? <Destinos valor={d.destinos} aoMudar={set('destinos')} unidades={unidades} minha={utilizador.unidadeId} /> : <Carregando />}</Campo>
        <div className="col-md-6">
          <Campo rotulo="Anexos (documento digitalizado)" col="col-12"><Carregar aceitar="application/pdf,image/*,.docx,.xlsx" multiplo maxMb={25} compacto ficheiros={anexos} aoMudar={setAnexos} ajuda="PDF, imagens, Word ou Excel · até 25 MB cada" /></Campo>
          <Campo rotulo="Nota para quem recebe" col="col-12"><input className="form-control form-control-sm" value={d.nota} onChange={set('nota')} /></Campo>
          <div className="col-12"><label className="form-check"><input type="checkbox" className="form-check-input" checked={d.temFisico} onChange={set('temFisico')} /> <span className="form-check-label">Há original em papel (segue depois do digital)</span></label></div>
          {d.temFisico && d.sentido !== 'entrada' && <Campo rotulo="Quem leva o original" col="col-12"><input className="form-control form-control-sm" placeholder="Ex.: Sold. Bumba (estafeta)" value={d.portador} onChange={set('portador')} /></Campo>}
        </div>
      </div>
    </Modal>
  )
}

function Documento({ id }) {
  const { utilizador, avisar, pode } = useSessao()
  const navegar = useNavigate()
  const { dados: carregado, erro } = useDados(`/expediente/${id}`)
  const [alterado, setX] = useState(null)
  const x = alterado?.id === id ? alterado : carregado
  const { dados: unidades } = useDados('/expediente/unidades')
  const [modal, setModal] = useState(null)
  const [envio, setEnvio] = useState(null)
  const acao = async (caminho, corpo, msg, formulario) => {
    try {
      setX(await api(`/expediente/${id}${caminho}`, { metodo: 'POST', corpo, formulario }))
      setModal(null)
      avisarMenu()
      if (msg) avisar(msg)
    } catch (e) {
      avisar(e.message, 'erro')
    }
  }
  if (erro) return <Erro texto={erro} />
  if (!x) return <Carregando />
  const fisicoPorConfirmar = x.movimentos.some((m) => m.paraUnidadeId === utilizador.unidadeId && ['a_enviar', 'entregue'].includes(m.fisico))
  return (
    <>
      <Cabecalho titulo={x.protocolo} subtitulo={x.assunto} migalhas={[['Expediente', '/expediente'], [x.protocolo]]}>
        <button type="button" className="btn btn-outline-secondary" onClick={() => navegar(-1)}>Voltar</button>
        {x.porReceber && <button type="button" className="btn btn-success" onClick={() => acao('/receber', {}, 'Recepção confirmada.')}><i className="fa fa-check me-1" />Confirmar recepção</button>}
        {fisicoPorConfirmar && <button type="button" className="btn btn-outline-success" onClick={() => acao('/receber', { fisico: true }, 'Original em papel recebido.')}><i className="fa fa-file-alt me-1" />Recebi o original</button>}
        {x.estado === 'em_curso' && x.naMinhaUnidade && !x.porReceber && <button type="button" className="btn btn-theme" onClick={() => setModal('encaminhar')}><i className="fa fa-share me-1" />Encaminhar</button>}
        {x.estado === 'em_curso' && x.naMinhaUnidade && !x.porReceber && <button type="button" className="btn btn-outline-secondary" onClick={() => setModal('arquivar')}><i className="fa fa-archive me-1" />Arquivar</button>}
        {x.estado === 'arquivado' && <button type="button" className="btn btn-outline-secondary" onClick={() => acao('/reabrir', undefined, 'Reaberto.')}>Reabrir</button>}
        {x.estado === 'em_curso' && x.naMinhaUnidade && !x.porReceber && x.despacho?.estado !== 'pendente' && <button type="button" className="btn btn-outline-dark" onClick={() => setModal('despacho')}><i className="fa fa-stamp me-1" />Submeter a despacho do Comandante</button>}
      </Cabecalho>
      {x.despacho && <Despacho x={x} podeDespachar={pode('despachar')} aoDespachar={(c) => acao('/despachar', c, 'Despachado. A unidade vê o despacho no documento.')} />}
      <div className="row">
        <div className="col-xl-5">
          <Painel titulo="Documento" icone="fa-file-alt">
            <div className="d-flex gap-1 flex-wrap mb-2"><span className="badge bg-light text-dark border">{x.tipoNome}</span><span className={`badge ${COR_CLASS[x.classificacao]}`}>{x.classificacao}</span>{x.estado === 'arquivado' && <span className="badge bg-secondary">arquivado</span>}{x.temFisico && <span className="badge bg-info">com original em papel</span>}</div>
            <dl className="small mb-0">
              {x.numero && <><dt>N.º</dt><dd>{x.numero}</dd></>}
              <dt>Origem</dt><dd>{x.origem} · registado por {x.criadoPor} em {dataHoraPt(x.criadoEm)}</dd>
              <dt>Onde está</dt><dd>{x.localAtual}</dd>
              {x.prazo && <><dt>Prazo</dt><dd>{dataPt(x.prazo)}</dd></>}
              {x.estado === 'arquivado' && <><dt>Arquivado</dt><dd>{[x.armario && `Armário ${x.armario}`, x.prateleira && `prateleira ${x.prateleira}`, x.pasta && `pasta ${x.pasta}`].filter(Boolean).join(' · ') || 'sem sítio indicado'}{x.arquivadoEm && ` · ${dataHoraPt(x.arquivadoEm)}`}</dd></>}
              {x.resumo && <><dt>Resumo</dt><dd style={{ whiteSpace: 'pre-wrap' }}>{x.resumo}</dd></>}
            </dl>
          </Painel>
          <Painel titulo={`Anexos (${x.anexos.length})`} icone="fa-paperclip" corpo={false}>
            {x.naMinhaUnidade && x.estado === 'em_curso' && <div className="p-2 border-bottom"><Carregar aceitar="application/pdf,image/*,.docx,.xlsx" multiplo maxMb={25} compacto titulo="Juntar anexos: arraste para aqui" progresso={envio} aoEscolher={(l) => { const fd = new FormData(); for (const f of l) fd.append('anexos', f); setEnvio(0); enviarComProgresso(`/expediente/${id}/anexos`, fd, setEnvio).then((r) => { setX(r); avisar('Anexo(s) junto(s).') }).catch((e) => avisar(e.message, 'erro')).finally(() => setEnvio(null)) }} /></div>}
            <div className="list-group list-group-flush">
              {x.anexos.map((a) => <button key={a.id} type="button" className="list-group-item list-group-item-action" onClick={() => abrirFicheiro(`/anexos/${a.id}`, a.nome).catch((e) => avisar(e.message, 'erro'))}><i className={`fa ${a.mime === 'application/pdf' ? 'fa-file-pdf text-danger' : a.mime.startsWith('image/') ? 'fa-file-image text-info' : 'fa-file'} me-2`} />{a.nome}<span className="small text-muted ms-2">{Math.ceil(a.tamanho / 1024)} KB · {a.por}</span></button>)}
              {!x.anexos.length && <div className="list-group-item text-muted small">Sem anexos.</div>}
            </div>
          </Painel>
        </div>
        <div className="col-xl-7">
          <Painel titulo="Percurso" icone="fa-route">
            <ul className="pes-percurso">
              {x.movimentos.map((m) => (
                <li key={m.id} className={m.recebidoEm ? '' : 'pendente'}>
                  <div><strong>{m.de || 'Exterior'}</strong> <i className="fa fa-arrow-right mx-1 text-muted" /> <strong>{m.para}</strong></div>
                  <div className="small text-muted">Enviado por {m.enviadoPor} · {dataHoraPt(m.enviadoEm)}</div>
                  {m.nota && <div className="small fst-italic">«{m.nota}»</div>}
                  <div className="small">{m.recebidoEm ? <span className="text-success"><i className="fa fa-check me-1" />Recebido por {m.recebidoPor} · {dataHoraPt(m.recebidoEm)}</span> : <span className="text-warning"><i className="fa fa-clock me-1" />Por receber</span>}</div>
                  {m.fisico !== 'nao_aplica' && (
                    <div className="small"><i className="fa fa-file-alt me-1" />{m.fisicoNome}{m.fisicoPortador && ` · levado por ${m.fisicoPortador}`}{m.fisicoRecebidoEm && ` · ${dataHoraPt(m.fisicoRecebidoEm)}`}
                      {m.fisico === 'a_enviar' && m.deUnidadeId === utilizador.unidadeId && <button type="button" className="btn btn-xs btn-outline-secondary ms-2" onClick={() => setModal({ entregue: m })}>Registar entrega</button>}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </Painel>
        </div>
      </div>
      {modal === 'despacho' && <SubmeterDespacho x={x} aoFechar={() => setModal(null)} aoSubmeter={(c) => acao('/despacho', c, 'Submetido a despacho do Comandante.')} />}
      {modal === 'arquivar' && <Arquivar x={x} aoFechar={() => setModal(null)} aoArquivar={(sitio) => acao('/arquivar', sitio, 'Arquivado.')} />}
      {modal === 'encaminhar' && <Encaminhar x={x} unidades={unidades ?? []} minha={utilizador.unidadeId} aoFechar={() => setModal(null)} aoEnviar={(c) => acao('/encaminhar', c, 'Encaminhado.')} />}
      {modal?.entregue && <Entrega aoFechar={() => setModal(null)} aoConfirmar={(portador) => api(`/expediente/${id}/movimentos/${modal.entregue.id}/entregue`, { metodo: 'POST', corpo: { portador } }).then((r) => { setX(r); setModal(null); avisar('Entrega do original registada.') }).catch((e) => avisar(e.message, 'erro'))} portador={modal.entregue.fisicoPortador} />}
    </>
  )
}

function Encaminhar({ x, unidades, minha, aoFechar, aoEnviar }) {
  const [d, setD] = useState({ destinos: [], nota: '', fisico: x.temFisico, portador: '' })
  return (
    <Modal titulo="Encaminhar" aoFechar={aoFechar} rodape={<><button type="button" className="btn btn-outline-secondary" onClick={aoFechar}>Cancelar</button><button type="button" className="btn btn-theme" disabled={!d.destinos.length} onClick={() => aoEnviar(d)}><i className="fa fa-share me-1" />Encaminhar</button></>}>
      <div className="row">
        <Campo rotulo="Para" obrigatorio col="col-12"><Destinos valor={d.destinos} aoMudar={(v) => setD({ ...d, destinos: v })} unidades={unidades} minha={minha} /></Campo>
        <Campo rotulo="Nota / despacho interno" col="col-12"><textarea rows={2} className="form-control form-control-sm" value={d.nota} onChange={(e) => setD({ ...d, nota: e.target.value })} placeholder="Ex.: Para informar até sexta-feira." /></Campo>
        {x.temFisico && <div className="col-12"><label className="form-check"><input type="checkbox" className="form-check-input" checked={d.fisico} onChange={(e) => setD({ ...d, fisico: e.target.checked })} /> <span className="form-check-label">O original em papel também segue</span></label></div>}
        {x.temFisico && d.fisico && <Campo rotulo="Quem leva o original" col="col-12"><input className="form-control form-control-sm" value={d.portador} onChange={(e) => setD({ ...d, portador: e.target.value })} /></Campo>}
      </div>
    </Modal>
  )
}

function Entrega({ portador: inicial = '', aoFechar, aoConfirmar }) {
  const [portador, setPortador] = useState(inicial)
  return (
    <Modal titulo="Entrega do original em papel" aoFechar={aoFechar} rodape={<><button type="button" className="btn btn-outline-secondary" onClick={aoFechar}>Cancelar</button><button type="button" className="btn btn-theme" onClick={() => aoConfirmar(portador)}>Registar</button></>}>
      <Campo rotulo="Entregue por (portador)" col="col-12"><input className="form-control form-control-sm" value={portador} onChange={(e) => setPortador(e.target.value)} /></Campo>
      <p className="small text-muted mb-0">A unidade que recebe confirma depois «Recebi o original».</p>
    </Modal>
  )
}

// Secretária digital: a unidade que tem o documento submete-o a despacho do Comandante, com uma nota
function SubmeterDespacho({ x, aoFechar, aoSubmeter }) {
  const [nota, setNota] = useState('')
  return (
    <Modal titulo={`Submeter ${x.protocolo} a despacho`} aoFechar={aoFechar} rodape={<><button type="button" className="btn btn-outline-secondary" onClick={aoFechar}>Cancelar</button><button type="button" className="btn btn-dark" onClick={() => aoSubmeter({ nota })}><i className="fa fa-stamp me-1" />Submeter</button></>}>
      <p className="small text-muted">O documento (com os anexos) aparece na Secretária digital do Comandante. O despacho dele fica registado aqui, no documento.</p>
      <label className="form-label small fw-bold" htmlFor="desp-nota">Nota para o Comandante (opcional)</label>
      <textarea id="desp-nota" className="form-control" rows={3} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ex.: para autorização; parecer favorável da Repartição" />
    </Modal>
  )
}

// o despacho no documento: à espera, ou a decisão do Comandante; quem despacha escolhe aqui
const DECISOES = { visto: 'Visto', concordo: 'Concordo', autorizo: 'Autorizo', nao_concordo: 'Não concordo', indefiro: 'Indefiro', tomei_conhecimento: 'Tomei conhecimento', informe: 'Informe / ver comigo', arquive_se: 'Arquive-se' }
function Despacho({ x, podeDespachar, aoDespachar }) {
  const [d, setD] = useState({ decisao: 'visto', texto: '' })
  const p = x.despacho
  if (p.estado === 'despachado') {
    return (
      <div className="alert alert-success d-flex gap-3 align-items-start">
        <i className="fa fa-stamp fa-2x mt-1" />
        <div>
          <div className="fw-bold">Despacho do Comandante: {p.decisaoNome}</div>
          {p.texto && <div style={{ whiteSpace: 'pre-wrap' }}>{p.texto}</div>}
          <div className="small text-muted mt-1">{p.despachadoPor} · {dataHoraPt(p.despachadoEm)} — submetido por {p.pedidoPor}{p.pedidoUnidade ? ` (${p.pedidoUnidade})` : ''}</div>
        </div>
      </div>
    )
  }
  return (
    <div className="alert alert-warning">
      <div className="fw-bold"><i className="fa fa-hourglass-half me-2" />À espera do despacho do Comandante</div>
      <div className="small">Submetido por {p.pedidoPor}{p.pedidoUnidade ? ` (${p.pedidoUnidade})` : ''} · {dataHoraPt(p.pedidoEm)}{p.nota ? ` — «${p.nota}»` : ''}</div>
      {podeDespachar && (
        <div className="mt-2 d-flex flex-wrap gap-2 align-items-start">
          <select className="form-select w-auto" value={d.decisao} onChange={(e) => setD({ ...d, decisao: e.target.value })} aria-label="Despacho">{Object.entries(DECISOES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <textarea className="form-control flex-grow-1" style={{ minWidth: 240 }} rows={2} value={d.texto} onChange={(e) => setD({ ...d, texto: e.target.value })} placeholder="Texto do despacho (opcional)" aria-label="Texto do despacho" />
          <button type="button" className="btn btn-dark" onClick={() => aoDespachar(d)}><i className="fa fa-stamp me-1" />Despachar</button>
        </div>
      )}
    </div>
  )
}

// arquivar: onde fica o original em papel (armário, prateleira, pasta), para o encontrar depois
function Arquivar({ x, aoFechar, aoArquivar }) {
  const [d, setD] = useState({ armario: x.armario ?? '', prateleira: x.prateleira ?? '', pasta: x.pasta ?? '' })
  const campo = (k, rotulo, exemplo, col) => <Campo rotulo={rotulo} col={col}><input className="form-control form-control-sm" maxLength={k === 'pasta' ? 100 : 60} value={d[k]} placeholder={exemplo} onChange={(e) => setD({ ...d, [k]: e.target.value })} /></Campo>
  return (
    <Modal titulo={`Arquivar ${x.protocolo}`} aoFechar={aoFechar} rodape={<><button type="button" className="btn btn-outline-secondary" onClick={aoFechar}>Cancelar</button><button type="button" className="btn btn-theme" onClick={() => aoArquivar(d)}><i className="fa fa-archive me-1" />Arquivar</button></>}>
      <p className="small text-muted">{x.temFisico ? 'Onde fica guardado o original em papel.' : 'Sem original em papel: o sítio é opcional (por exemplo, a pasta onde fica uma cópia impressa).'}</p>
      <div className="row">
        {campo('armario', 'Armário', 'Ex.: A1', 'col-md-4')}
        {campo('prateleira', 'Prateleira', 'Ex.: 3', 'col-md-4')}
        {campo('pasta', 'Pasta / dossier', 'Ex.: Ofícios recebidos 2026', 'col-md-4')}
      </div>
    </Modal>
  )
}
