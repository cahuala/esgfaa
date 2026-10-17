import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import { useDados } from '../useDados'
import { useSessao } from '../sessao'
import { exportarPdf } from '../exportar'
import { fichasDeProposta } from '../documentos'
import Foto from '../componentes/Foto'
import EscolherPessoa from '../componentes/EscolherPessoa'
import { Cabecalho, Campo, Carregando, Condicoes, Erro, Escolha, Estado, Modal, Painel } from '../componentes/Ui'
import { dataHoraPt, dataPt } from '../formatar'

const FILTRO_TIPO = { promocao: { tipo: 'militar' }, graduacao: { tipo: 'militar' }, progressao: { tipo: 'civil' } }

export default function Proposta() {
  const { id } = useParams()
  const { pode, avisar } = useSessao()
  const navegar = useNavigate()
  const { dados: carregada, erro } = useDados(`/propostas/${id}`)
  const [alterada, setP] = useState(null)
  const p = alterada?.id === Number(id) ? alterada : carregada
  const [aberto, setAberto] = useState(null)
  const [modal, setModal] = useState(null)
  const [cargos, setCargos] = useState([])
  const precisaCargos = p?.tipo === 'nomeacao' || p?.tipo === 'exoneracao'
  useEffect(() => { if (precisaCargos) api('/cargos').then(setCargos).catch(() => {}) }, [precisaCargos])

  const acao = async (caminho, corpo, mensagem) => {
    try {
      setP(await api(`/propostas/${id}${caminho}`, { metodo: caminho.startsWith('/itens/') ? 'DELETE' : 'POST', corpo }))
      setModal(null)
      avisar(mensagem)
    } catch (e) {
      avisar(e.message, 'erro')
    }
  }

  if (erro) return <Erro texto={erro} />
  if (!p) return <Carregando />
  const preparacao = p.estado === 'rascunho'
  const nomeCargo = (cid) => cargos.find((c) => c.id === cid)?.nome ?? ''
  const proposto = (i) => (p.tipo === 'progressao' ? `${i.categoriaAtual} → ${i.categoriaProposta}` : p.tipo === 'nomeacao' || p.tipo === 'exoneracao' ? nomeCargo(i.cargoId) : `${i.postoAtualNome} → ${i.postoPropostoNome}${i.modalidadeNome ? ` (${i.modalidadeNome.toLowerCase()})` : ''}`)

  const imprimir = () => exportarPdf(`Proposta n.º ${p.id} — ${p.titulo}`, [
    { titulo: 'N.º', valor: (i) => p.itens.indexOf(i) + 1 },
    { titulo: 'NIP / N.º', valor: (i) => i.nip || i.numeroAgente || '' },
    { titulo: 'Nome', valor: (i) => i.nome },
    { titulo: 'Ramo', valor: (i) => i.ramo || 'Civil' },
    { titulo: p.tipo === 'nomeacao' || p.tipo === 'exoneracao' ? 'Cargo' : 'Proposto', valor: proposto },
    { titulo: 'Condições da lei', valor: (i) => (i.cumpre ? 'Cumpre' : 'Não cumpre') },
    { titulo: 'Justificação', valor: (i) => i.justificacao },
  ], p.itens, { subtitulo: `${p.tipoNome} · ${p.estadoNome}${p.documento ? ` · ${p.documento} de ${dataPt(p.dataDocumento)}` : ''}` })

  return (
    <>
      <Cabecalho titulo={`Proposta n.º ${p.id}`} subtitulo={p.tipoNome} migalhas={[['Propostas', '/propostas'], [`N.º ${p.id}`]]}>
        <button type="button" className="btn btn-danger" onClick={imprimir} disabled={!p.itens.length}><i className="fa fa-file-pdf me-1" />PDF</button>
        <button type="button" className="btn btn-danger" onClick={() => fichasDeProposta(p, cargos).catch((e) => avisar(e.message, 'erro'))} disabled={!p.itens.length}><i className="fa fa-file-pdf me-1" />Fichas de proposta</button>
        {preparacao && pode('propor') && <button type="button" className="btn btn-warning" onClick={() => setModal('enviar')} disabled={!p.itens.length}><i className="fa fa-paper-plane me-1" />Enviar ao escalão superior</button>}
        {p.estado === 'enviada' && pode('editar') && <button type="button" className="btn btn-success" onClick={() => navegar(`/extractos?proposta=${p.id}&tipo=${p.tipo}`)}><i className="fa fa-file-contract me-1" />Registar o extracto</button>}
        {p.estado === 'enviada' && pode('decidir') && <>
          <button type="button" className="btn btn-outline-secondary" onClick={() => setModal('devolver')}><i className="fa fa-undo me-1" />Devolvida</button>
          <button type="button" className="btn btn-outline-danger" onClick={() => setModal('indeferir')}><i className="fa fa-times me-1" />Indeferida</button>
        </>}
        {['rascunho', 'enviada'].includes(p.estado) && pode('propor') && <button type="button" className="btn btn-link text-danger" onClick={() => setModal('cancelar')}>Cancelar proposta</button>}
      </Cabecalho>

      <div className="row">
        <div className="col-xl-4">
          <Painel titulo="Proposta" icone="fa-file-signature">
            <h5 className="mb-1">{p.titulo}</h5>
            <p className="mb-2"><Estado estado={p.estado} texto={p.estadoNome} /> <span className="text-muted small ms-1">{p.total} pessoa(s){p.naoCumprem > 0 && <span className="text-danger"> · {p.naoCumprem} não cumpre(m) a lei</span>}</span></p>
            {p.fundamentacao && <p className="small" style={{ whiteSpace: 'pre-wrap' }}>{p.fundamentacao}</p>}
            <dl className="small mb-0">
              <dt>Preparada por</dt><dd>{p.criadoPor} · {dataHoraPt(p.criadoEm)}</dd>
              {p.submetidaEm && <><dt>Enviada</dt><dd>{dataHoraPt(p.submetidaEm)}</dd></>}
              {p.documento && <><dt>{p.estado === 'concluida' ? 'Extracto' : p.estado === 'enviada' ? 'Ofício de envio' : 'Documento'}</dt><dd>{p.documento} de {dataPt(p.dataDocumento)}{p.entidade && ` · ${p.entidade}`}</dd></>}
              {p.decididoPor && <><dt>Resposta registada por</dt><dd>{p.decididoPor} · {dataHoraPt(p.decididaEm)}</dd></>}
              {p.motivo && <><dt>Motivo</dt><dd>{p.motivo}</dd></>}
            </dl>
          </Painel>
        </div>
        <div className="col-xl-8">
          <Painel titulo="Pessoas na proposta" icone="fa-users" acoes={preparacao && pode('propor') && <button type="button" className="btn btn-xs btn-theme" onClick={() => setModal('adicionar')}><i className="fa fa-user-plus me-1" />Adicionar</button>} corpo={false}>
            <div className="list-group list-group-flush">
              {p.itens.map((i, n) => (
                <div key={i.id} className="list-group-item">
                  <div className="d-flex align-items-center gap-2">
                    <span className="badge bg-light text-dark border">{n + 1}</span>
                    <i className={`fa fa-lg ${i.cumpre ? 'fa-check-circle text-success' : 'fa-times-circle text-danger'}`} title={i.cumpre ? 'Cumpre as condições da lei' : 'Não cumpre'} />
                    <Foto pessoaId={i.pessoaId} fotoId={i.fotoId} nome={i.nome} tamanho={38} />
                    <div className="me-auto">
                      <Link to={`/pessoas/${i.pessoaId}`} className="fw-bold">{i.nome}</Link> <span className="small text-muted">{i.nip || i.numeroAgente} · {i.ramo || 'Civil'}</span>
                      <div className="small">{proposto(i)}{i.inicio && ` · desde ${dataPt(i.inicio)}`}{i.fim && ` até ${dataPt(i.fim)}`}</div>
                      {i.justificacao && <div className="small text-muted">{i.justificacao}</div>}
                    </div>
                    <button type="button" className="btn btn-xs btn-outline-secondary" onClick={() => setAberto(aberto === i.id ? null : i.id)}>{aberto === i.id ? 'Esconder' : 'Ver'} condições</button>
                    {preparacao && pode('propor') && <button type="button" className="btn btn-xs btn-outline-danger" onClick={() => acao(`/itens/${i.id}`, undefined, 'Retirado da proposta.')} title="Retirar"><i className="fa fa-times" /></button>}
                  </div>
                  {aberto === i.id && <div className="mt-2 ms-5"><Condicoes condicoes={i.verificacao?.condicoes} /></div>}
                </div>
              ))}
              {!p.itens.length && <div className="list-group-item text-muted">Ainda ninguém. {preparacao && 'Use «Adicionar» para juntar pessoas.'}</div>}
            </div>
          </Painel>
        </div>
      </div>

      {modal === 'adicionar' && <Adicionar p={p} cargos={cargos} aoFechar={() => setModal(null)} aoAdicionar={(item) => acao('/itens', item, 'Adicionado à proposta.')} />}
      {modal === 'enviar' && <Decidir titulo="Enviar ao escalão superior" botao="Enviar" cor="warning" campos={['documento']} rotuloDocumento="N.º do ofício de envio (opcional)" aviso="Imprima as fichas de proposta (com a síntese biográfica de cada um, no perfil), assine e envie. Quando chegar a resposta, registe o extracto: é ele que actualiza as fichas." aoFechar={() => setModal(null)} aoConfirmar={(d) => acao('/submeter', d, 'Proposta enviada ao escalão superior.')} />}
      {modal === 'indeferir' && <Decidir titulo="Proposta indeferida pelo escalão superior" botao="Registar indeferimento" cor="danger" campos={['motivo', 'documento', 'dataDocumento']} rotuloDocumento="N.º do documento de resposta" aoFechar={() => setModal(null)} aoConfirmar={(d) => acao('/indeferir', d, 'Indeferimento registado.')} />}
      {modal === 'devolver' && <Decidir titulo="Proposta devolvida para correção" botao="Voltar à preparação" cor="secondary" campos={['motivo']} aoFechar={() => setModal(null)} aoConfirmar={(d) => acao('/devolver', d, 'A proposta voltou à preparação.')} />}
      {modal === 'cancelar' && <Decidir titulo="Cancelar a proposta" botao="Cancelar proposta" cor="danger" campos={['motivo']} aoFechar={() => setModal(null)} aoConfirmar={(d) => acao('/cancelar', d, 'Proposta cancelada.').then(() => navegar('/propostas'))} />}
    </>
  )
}

function Adicionar({ p, cargos, aoFechar, aoAdicionar }) {
  const { ref } = useSessao()
  const [pessoa, setPessoa] = useState(null)
  const [item, setItem] = useState({})
  const postos = pessoa?.ramo ? ref.postos[pessoa.ramo].filter((x) => x.grau > pessoa.grau && x.grau <= pessoa.grau + 2) : []
  const set = (k) => (v) => setItem({ ...item, [k]: v?.target ? v.target.value : v })
  return (
    <Modal titulo="Adicionar à proposta" aoFechar={aoFechar} rodape={<><button type="button" className="btn btn-light" onClick={aoFechar}>Cancelar</button><button type="button" className="btn btn-theme" disabled={!pessoa} onClick={() => aoAdicionar({ pessoaId: pessoa.id, ...item, cargoId: item.cargoId ? Number(item.cargoId) : undefined })}>Adicionar</button></>}>
      <div className="row">
        <Campo rotulo="Pessoa" obrigatorio col="col-12">
          {pessoa ? <div><strong>{pessoa.postoAbreviatura} {pessoa.nome}</strong> <button type="button" className="btn btn-xs btn-secondary" onClick={() => setPessoa(null)}>mudar</button></div> : <EscolherPessoa filtro={FILTRO_TIPO[p.tipo]} excluir={p.itens.map((i) => i.pessoaId)} aoEscolher={setPessoa} />}
        </Campo>
        {p.tipo === 'promocao' && <Campo rotulo="Modalidade"><Escolha valor={item.modalidade} aoMudar={set('modalidade')} opcoes={{ distincao: 'Distinção (art. 57.º)', excepcional: 'Título excepcional (art. 58.º)' }} vazio="A da lei (art. 98.º)" /></Campo>}
        {p.tipo === 'graduacao' && <Campo rotulo="Posto da graduação" obrigatorio><Escolha valor={item.postoProposto} aoMudar={set('postoProposto')} opcoes={postos.map((x) => [x.id, x.nome])} /></Campo>}
        {p.tipo === 'nomeacao' && <Campo rotulo="Cargo" obrigatorio col="col-12"><Escolha valor={item.cargoId} aoMudar={set('cargoId')} opcoes={cargos.map((c) => [c.id, `${c.nome}${c.unidadeNome ? ` — ${c.unidadeNome}` : ''} · ${c.livres} livre(s)`])} /></Campo>}
        {['graduacao', 'nomeacao', 'exoneracao'].includes(p.tipo) && <>
          <Campo rotulo={p.tipo === 'exoneracao' ? 'Data' : 'Início'} col="col-md-6"><input type="date" className="form-control form-control-sm" value={item.inicio ?? ''} onChange={set('inicio')} /></Campo>
          {p.tipo !== 'exoneracao' && <Campo rotulo="Fim (se temporária)" col="col-md-6"><input type="date" className="form-control form-control-sm" value={item.fim ?? ''} onChange={set('fim')} /></Campo>}
        </>}
        <Campo rotulo="Justificação" col="col-12"><textarea rows={2} className="form-control form-control-sm" value={item.justificacao ?? ''} onChange={set('justificacao')} /></Campo>
      </div>
    </Modal>
  )
}

function Decidir({ titulo, botao, cor, campos, aviso, aoFechar, aoConfirmar, rotuloDocumento = 'N.º do documento' }) {
  const [d, setD] = useState({ documento: '', dataDocumento: new Date().toISOString().slice(0, 10), entidade: '', motivo: '' })
  const corpo = Object.fromEntries(campos.map((k) => [k, d[k]]))
  return (
    <Modal titulo={titulo} aoFechar={aoFechar} rodape={<><button type="button" className="btn btn-light" onClick={aoFechar}>Voltar</button><button type="button" className={`btn btn-${cor}`} onClick={() => aoConfirmar(corpo)}>{botao}</button></>}>
      {aviso && <div className="alert alert-info">{aviso}</div>}
      <div className="row">
        {campos.includes('documento') && <Campo rotulo={rotuloDocumento}><input className="form-control form-control-sm" value={d.documento} onChange={(e) => setD({ ...d, documento: e.target.value })} /></Campo>}
        {campos.includes('dataDocumento') && <Campo rotulo="Data do documento"><input type="date" className="form-control form-control-sm" value={d.dataDocumento} onChange={(e) => setD({ ...d, dataDocumento: e.target.value })} /></Campo>}
        {campos.includes('motivo') && <Campo rotulo="Motivo" col="col-12"><textarea rows={3} className="form-control form-control-sm" value={d.motivo} onChange={(e) => setD({ ...d, motivo: e.target.value })} /></Campo>}
      </div>
    </Modal>
  )
}
