import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useSessao } from '../sessao'
import Tabela from '../componentes/Tabela'
import { Cabecalho, Campo, Carregando, Escolha, Modal, Painel } from '../componentes/Ui'

// quadro orgânico: unidades da Escola e os cargos de cada uma, com o posto e os lugares (art. 18.º)
export default function QuadroOrganico() {
  const { ref, pode, avisar } = useSessao()
  const navegar = useNavigate()
  const [unidades, setUnidades] = useState(null)
  const [cargos, setCargos] = useState(null)
  const [filtro, setFiltro] = useState('')
  const [modal, setModal] = useState(null)
  const carregar = useCallback(() => {
    api('/unidades').then(setUnidades).catch(() => setUnidades([]))
    api('/cargos').then(setCargos).catch(() => setCargos([]))
  }, [])
  useEffect(() => { carregar() }, [carregar])
  const gerir = pode('administrar')
  const visiveis = useMemo(() => (cargos ?? []).filter((c) => !filtro || String(c.unidadeId) === filtro), [cargos, filtro])

  const colunas = useMemo(() => [
    { chave: 'cargo', titulo: 'Cargo', valor: (c) => c.nome, mostrar: (c) => <strong>{c.nome}</strong> },
    { chave: 'unidade', titulo: 'Unidade', valor: (c) => c.unidadeNome },
    { chave: 'funcao', titulo: 'Função (art. 21.º)', valor: (c) => c.funcaoNome },
    { chave: 'posto', titulo: 'Posto / categoria', valor: (c) => c.postoRequeridoNome || c.categoriaCivil || (c.tipo === 'civil' ? 'Civil' : '') },
    { chave: 'lugares', titulo: 'Lugares', valor: (c) => c.vagas, alinhar: 'end' },
    { chave: 'livres', titulo: 'Livres', valor: (c) => c.livres, alinhar: 'end', mostrar: (c) => <span className={c.livres ? 'text-success fw-bold' : 'text-muted'}>{c.livres}</span> },
    { chave: 'ocupantes', titulo: 'Ocupado por', valor: (c) => c.ocupantes.map((o) => `${o.descricao} ${o.nome}`).join('; '), mostrar: (c) => c.ocupantes.map((o) => <div key={o.id}><Link to={`/pessoas/${o.id}`} onClick={(e) => e.stopPropagation()}>{o.descricao} {o.nome}</Link></div>) },
  ], [])

  if (!unidades || !cargos) return <Carregando />
  const lugares = cargos.reduce((s, c) => s + c.vagas, 0)
  const ocupados = cargos.reduce((s, c) => s + Math.min(c.vagas, c.ocupados), 0)
  return (
    <>
      <Cabecalho titulo="Quadro orgânico" subtitulo={`${ocupados} de ${lugares} lugares ocupados`} migalhas={[['Quadro orgânico']]}>
        {gerir && <button type="button" className="btn btn-outline-theme" onClick={() => setModal({ unidade: {} })}><i className="fa fa-plus me-1" />Unidade</button>}
        {gerir && <button type="button" className="btn btn-theme" onClick={() => setModal({ cargo: {} })}><i className="fa fa-plus me-1" />Cargo</button>}
      </Cabecalho>
      <div className="row">
        <div className="col-xl-3">
          <Painel titulo="Unidades" icone="fa-sitemap" corpo={false}>
            <div className="list-group list-group-flush">
              <button type="button" className={`list-group-item list-group-item-action ${!filtro ? 'active' : ''}`} onClick={() => setFiltro('')}>Todas <span className="badge bg-secondary float-end">{cargos.length}</span></button>
              {unidades.map((u) => (
                <div key={u.id} className={`list-group-item list-group-item-action d-flex align-items-center ${filtro === String(u.id) ? 'active' : ''}`} style={{ paddingLeft: u.paiId ? 28 : undefined }}>
                  <button type="button" className="btn btn-link p-0 text-reset text-start me-auto text-decoration-none" onClick={() => setFiltro(String(u.id))}>{u.sigla && <strong className="me-1">{u.sigla}</strong>}{u.nome}</button>
                  <button type="button" className="btn btn-xs btn-link text-reset" title="Ver as pessoas" onClick={() => navegar(`/pessoas?unidadeId=${u.id}`)}><i className="fa fa-users me-1" />{u.pessoas}</button>
                  {gerir && <button type="button" className="btn btn-xs btn-link text-reset" title="Editar" onClick={() => setModal({ unidade: u })}><i className="fa fa-pen" /></button>}
                </div>
              ))}
            </div>
          </Painel>
        </div>
        <div className="col-xl-9">
          <Painel titulo="Cargos" icone="fa-chair">
            <Tabela titulo={`Quadro orgânico${filtro ? ` — ${unidades.find((u) => String(u.id) === filtro)?.nome}` : ''}`} colunas={colunas} linhas={visiveis} aoClicar={gerir ? (c) => setModal({ cargo: c }) : undefined} />
          </Painel>
        </div>
      </div>
      {modal?.unidade && <FormUnidade u={modal.unidade} unidades={unidades} aoFechar={() => setModal(null)} aoGuardar={(m) => { setModal(null); avisar(m); carregar() }} />}
      {modal?.cargo && <FormCargo c={modal.cargo} unidades={unidades} refs={ref} aoFechar={() => setModal(null)} aoGuardar={(m) => { setModal(null); avisar(m); carregar() }} />}
    </>
  )
}

function FormUnidade({ u, unidades, aoFechar, aoGuardar }) {
  const [d, setD] = useState({ nome: u.nome ?? '', sigla: u.sigla ?? '', paiId: u.paiId ?? '', ordem: u.ordem ?? 0 })
  const [erro, setErro] = useState('')
  const guardar = () => api(u.id ? `/unidades/${u.id}` : '/unidades', { metodo: u.id ? 'PUT' : 'POST', corpo: { ...d, paiId: d.paiId ? Number(d.paiId) : null, ordem: Number(d.ordem) } }).then(() => aoGuardar('Unidade guardada.')).catch((e) => setErro(e.message))
  const apagar = () => api(`/unidades/${u.id}`, { metodo: 'DELETE' }).then(() => aoGuardar('Unidade apagada.')).catch((e) => setErro(e.message))
  return (
    <Modal titulo={u.id ? 'Editar unidade' : 'Nova unidade'} aoFechar={aoFechar} rodape={<>{u.id && <button type="button" className="btn btn-outline-danger me-auto" onClick={apagar}>Apagar</button>}<button type="button" className="btn btn-light" onClick={aoFechar}>Cancelar</button><button type="button" className="btn btn-theme" onClick={guardar}>Guardar</button></>}>
      {erro && <div className="alert alert-danger">{erro}</div>}
      <div className="row">
        <Campo rotulo="Nome" obrigatorio col="col-md-8"><input className="form-control form-control-sm" value={d.nome} onChange={(e) => setD({ ...d, nome: e.target.value })} /></Campo>
        <Campo rotulo="Sigla" col="col-md-4"><input className="form-control form-control-sm" value={d.sigla} onChange={(e) => setD({ ...d, sigla: e.target.value })} /></Campo>
        <Campo rotulo="Dentro de" col="col-md-8"><Escolha valor={d.paiId} aoMudar={(v) => setD({ ...d, paiId: v })} opcoes={unidades.filter((x) => x.id !== u.id).map((x) => [x.id, x.nome])} vazio="(topo)" /></Campo>
        <Campo rotulo="Ordem" col="col-md-4"><input type="number" className="form-control form-control-sm" value={d.ordem} onChange={(e) => setD({ ...d, ordem: e.target.value })} /></Campo>
      </div>
    </Modal>
  )
}

function FormCargo({ c, unidades, refs, aoFechar, aoGuardar }) {
  const [d, setD] = useState({ nome: c.nome ?? '', unidadeId: c.unidadeId ?? '', funcao: c.funcao ?? 'execucao', tipo: c.tipo ?? 'militar', postoRequerido: c.postoRequerido ?? '', categoriaCivil: c.categoriaCivil ?? '', vagas: c.vagas ?? 1 })
  const [erro, setErro] = useState('')
  const guardar = () => api(c.id ? `/cargos/${c.id}` : '/cargos', { metodo: c.id ? 'PUT' : 'POST', corpo: { ...d, unidadeId: d.unidadeId ? Number(d.unidadeId) : null, postoRequerido: d.postoRequerido || null, categoriaCivil: d.categoriaCivil || null, vagas: Number(d.vagas) } }).then(() => aoGuardar('Cargo guardado.')).catch((e) => setErro(e.message))
  const apagar = () => api(`/cargos/${c.id}`, { metodo: 'DELETE' }).then(() => aoGuardar('Cargo apagado.')).catch((e) => setErro(e.message))
  return (
    <Modal titulo={c.id ? 'Editar cargo' : 'Novo cargo'} aoFechar={aoFechar} rodape={<>{c.id && <button type="button" className="btn btn-outline-danger me-auto" onClick={apagar}>Apagar</button>}<button type="button" className="btn btn-light" onClick={aoFechar}>Cancelar</button><button type="button" className="btn btn-theme" onClick={guardar}>Guardar</button></>}>
      {erro && <div className="alert alert-danger">{erro}</div>}
      <div className="row">
        <Campo rotulo="Cargo" obrigatorio col="col-12"><input className="form-control form-control-sm" value={d.nome} onChange={(e) => setD({ ...d, nome: e.target.value })} /></Campo>
        <Campo rotulo="Unidade"><Escolha valor={d.unidadeId} aoMudar={(v) => setD({ ...d, unidadeId: v })} opcoes={unidades.map((u) => [u.id, u.nome])} /></Campo>
        <Campo rotulo="Função (art. 21.º)"><Escolha valor={d.funcao} aoMudar={(v) => setD({ ...d, funcao: v })} opcoes={refs.funcoes} vazio={null} /></Campo>
        <Campo rotulo="Para" col="col-md-4"><Escolha valor={d.tipo} aoMudar={(v) => setD({ ...d, tipo: v })} opcoes={{ militar: 'Militar', civil: 'Civil', ambos: 'Militar ou civil' }} vazio={null} /></Campo>
        {d.tipo !== 'civil' && <Campo rotulo="Posto do cargo" col="col-md-4" ajuda="Ninguém é nomeado para cargo de posto inferior (art. 19.º)."><Escolha valor={d.postoRequerido} aoMudar={(v) => setD({ ...d, postoRequerido: v })} opcoes={refs.postos.EXE.map((p) => [p.id, `${p.nome} / ${refs.postos.MGA.find((x) => x.id === p.id).nome}`])} /></Campo>}
        {d.tipo !== 'militar' && <Campo rotulo="Categoria (civis)" col="col-md-4"><input className="form-control form-control-sm" value={d.categoriaCivil} onChange={(e) => setD({ ...d, categoriaCivil: e.target.value })} /></Campo>}
        <Campo rotulo="Lugares" col="col-md-4"><input type="number" min="1" className="form-control form-control-sm" value={d.vagas} onChange={(e) => setD({ ...d, vagas: e.target.value })} /></Campo>
      </div>
    </Modal>
  )
}
