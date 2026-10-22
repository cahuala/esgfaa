import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { useDados } from '../useDados'
import { useSessao } from '../sessao'
import Tabela from '../componentes/Tabela'
import Foto from '../componentes/Foto'
import EscolherPessoa from '../componentes/EscolherPessoa'
import { Cabecalho, Campo, Carregando, Escolha, Modal, Painel } from '../componentes/Ui'
import { dataPt } from '../formatar'

/*
  Faltas e ausências que não são licenças: falta, ausência sem justificação, baixa hospitalar e detenção.
  Entram no Mapa de ausências temporárias do mês (e no efectivo físico do Mod. 2). O hospital e a
  detenção ficam «em curso» até se registar o fim (alta, libertação).
*/
const SEM_FIM = ['hospital', 'detido']

function NovaAusencia({ aoFechar, aoGuardar }) {
  const { ref } = useSessao()
  const [pessoa, setPessoa] = useState(null)
  const [d, setD] = useState({ tipo: 'falta', inicio: '', fim: '', motivo: '', documento: '' })
  const [erro, setErro] = useState('')
  const semFim = SEM_FIM.includes(d.tipo)
  const pronto = pessoa && d.inicio && (semFim || d.fim)
  async function guardar() {
    setErro('')
    try {
      await api('/ausencias', { metodo: 'POST', corpo: { pessoaId: pessoa.id, ...d, fim: d.fim || null } })
      aoGuardar()
    } catch (e) {
      setErro(e.message)
    }
  }
  return (
    <Modal titulo="Registar falta ou ausência" aoFechar={aoFechar} rodape={<><button type="button" className="btn btn-outline-secondary" onClick={aoFechar}>Cancelar</button><button type="button" className="btn btn-theme" disabled={!pronto} onClick={guardar}><i className="fa fa-check me-1" />Registar</button></>}>
      {erro && <div className="alert alert-danger">{erro}</div>}
      <div className="row">
        <Campo rotulo="Pessoa" obrigatorio col="col-12">
          {pessoa ? <div className="d-flex align-items-center gap-2"><strong>{pessoa.postoAbreviatura ? `${pessoa.postoAbreviatura} ` : ''}{pessoa.nome}</strong><button type="button" className="btn btn-xs btn-secondary" onClick={() => setPessoa(null)}>mudar</button></div> : <EscolherPessoa aoEscolher={setPessoa} />}
        </Campo>
        <Campo rotulo="Tipo" obrigatorio col="col-md-4"><Escolha valor={d.tipo} aoMudar={(v) => setD({ ...d, tipo: v })} opcoes={ref.tiposAusencia} vazio={null} /></Campo>
        <Campo rotulo="Início" obrigatorio col="col-md-4"><input type="date" className="form-control form-control-sm" value={d.inicio} onChange={(e) => setD({ ...d, inicio: e.target.value })} /></Campo>
        <Campo rotulo={semFim ? 'Fim (vazio enquanto durar)' : 'Último dia'} obrigatorio={!semFim} col="col-md-4"><input type="date" className="form-control form-control-sm" value={d.fim} min={d.inicio} onChange={(e) => setD({ ...d, fim: e.target.value })} /></Campo>
        <Campo rotulo="Motivo" col="col-md-7"><input className="form-control form-control-sm" maxLength={300} value={d.motivo} onChange={(e) => setD({ ...d, motivo: e.target.value })} placeholder={d.tipo === 'hospital' ? 'Ex.: internamento no Hospital Militar Principal' : d.tipo === 'detido' ? 'Ex.: detenção disciplinar' : ''} /></Campo>
        <Campo rotulo="Documento" col="col-md-5"><input className="form-control form-control-sm" maxLength={150} value={d.documento} onChange={(e) => setD({ ...d, documento: e.target.value })} placeholder="Participação, guia de baixa, auto…" /></Campo>
      </div>
    </Modal>
  )
}

export default function Ausencias() {
  const { ref, pode, avisar } = useSessao()
  const navegar = useNavigate()
  const [params, setParams] = useSearchParams()
  const filtros = useMemo(() => Object.fromEntries(params), [params])
  const { dados: linhas, erro, recarregar } = useDados('/ausencias', filtros)
  const [nova, setNova] = useState(false)
  const mudar = (k, v) => { const n = new URLSearchParams(params); if (v) n.set(k, v); else n.delete(k); setParams(n) }
  const acao = (caminho, opcoes, ok) => api(caminho, opcoes).then(() => { avisar(ok); recarregar() }).catch((x) => avisar(x.message, 'erro'))
  const hoje = new Date().toISOString().slice(0, 10)
  const colunas = useMemo(() => [
    { chave: 'nome', titulo: 'Nome', valor: (l) => l.nome, mostrar: (l) => <span className="pes-pessoa"><Foto pessoaId={l.pessoaId} fotoId={l.fotoId} nome={l.nome} /><strong>{l.nome}</strong></span> },
    { chave: 'ident', titulo: 'NIP / N.º', valor: (l) => l.identificacao },
    { chave: 'posto', titulo: 'Posto', valor: (l) => l.postoNome },
    { chave: 'tipo', titulo: 'Tipo', valor: (l) => l.tipoNome },
    { chave: 'inicio', titulo: 'Início', valor: (l) => l.inicio, mostrar: (l) => dataPt(l.inicio) },
    { chave: 'fim', titulo: 'Fim', valor: (l) => l.fim ?? '', mostrar: (l) => (l.fim ? dataPt(l.fim) : <span className="badge bg-warning text-dark">em curso</span>) },
    { chave: 'dias', titulo: 'Dias', valor: (l) => l.dias, alinhar: 'end' },
    { chave: 'motivo', titulo: 'Motivo', valor: (l) => [l.motivo, l.documento].filter(Boolean).join(' · ') },
    ...(pode('editar') ? [{ chave: 'acoes', titulo: '', exportar: false, valor: () => '', mostrar: (l) => (
      <span className="d-flex gap-1" onClick={(e) => e.stopPropagation()}>
        {!l.fim && <button type="button" className="btn btn-xs btn-outline-success" title={l.tipo === 'hospital' ? 'Registar a alta (hoje)' : 'Registar o fim (hoje)'} onClick={() => acao(`/ausencias/${l.id}`, { metodo: 'PUT', corpo: { fim: hoje } }, 'Fim registado.')}><i className="fa fa-flag-checkered" /></button>}
        <button type="button" className="btn btn-xs btn-outline-danger" title="Apagar" onClick={() => window.confirm('Apagar este registo?') && acao(`/ausencias/${l.id}`, { metodo: 'DELETE' }, 'Registo apagado.')}><i className="fa fa-trash" /></button>
      </span>
    ) }] : []),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [pode, hoje])
  return (
    <>
      <Cabecalho titulo="Faltas e ausências" subtitulo="faltas, sem justificação, hospital e detidos" migalhas={[['Carreiras'], ['Faltas e ausências']]}>
        {pode('editar') && <button type="button" className="btn btn-theme" onClick={() => setNova(true)}><i className="fa fa-plus me-1" />Registar</button>}
      </Cabecalho>
      <Painel>
        <div className="row mb-2">
          <div className="col-md-3"><Escolha valor={filtros.tipo} aoMudar={(v) => mudar('tipo', v)} opcoes={ref.tiposAusencia} vazio="Todos os tipos" aria-label="Tipo" /></div>
          <div className="col-md-3"><Escolha valor={filtros.emCurso} aoMudar={(v) => mudar('emCurso', v)} opcoes={{ 1: 'Só em curso (hoje)' }} vazio="Todas" aria-label="Em curso" /></div>
        </div>
        <p className="small text-muted">Contam no Mapa de ausências temporárias do mês (colunas Faltas, Hospital, Aus/S.Just. e Detidos) e no efectivo físico do Mod. 2. As licenças (férias, doença, casamento…) registam-se em Licenças; a missão e a formação, no estado do militar.</p>
        {erro ? <div className="alert alert-danger">{erro}</div> : !linhas ? <Carregando /> : <Tabela titulo="Faltas e ausências" colunas={colunas} linhas={linhas} aoClicar={(l) => navegar(`/pessoas/${l.pessoaId}`)} />}
      </Painel>
      {nova && <NovaAusencia aoFechar={() => setNova(false)} aoGuardar={() => { setNova(false); avisar('Registado.'); recarregar() }} />}
    </>
  )
}
