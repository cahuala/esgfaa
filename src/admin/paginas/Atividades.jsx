import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { COLECOES, NOMES_ACOES } from '../esquemas'
import { CabecalhoPagina, Carregando, Erro, Painel } from '../componentes/Ui'
import { dataHora } from '../formatar'

const CORES = {
  falha_entrada: 'bg-danger',
  apagar: 'bg-danger',
  apagar_comentario: 'bg-warning text-dark',
  entrar: 'bg-gray-500',
  sair: 'bg-gray-500',
  criar: 'bg-success',
  criar_utilizador: 'bg-success',
  editar: 'bg-primary',
  editar_pagina: 'bg-primary',
  editar_utilizador: 'bg-indigo',
  alterar_senha: 'bg-indigo',
  carregar_ficheiro: 'bg-cyan',
}
const NOMES_COLECOES = { ...Object.fromEntries(Object.entries(COLECOES).map(([k, v]) => [k, v.titulo])), paginas: 'Páginas', utilizadores: 'Utilizadores' }

function detalhes(a) {
  if (!a.detalhes) return null
  try {
    const d = JSON.parse(a.detalhes)
    if (d.campos) return d.campos.length ? `Campos: ${d.campos.join(', ')}` : 'Sem alterações'
    if (d.email && a.acao === 'falha_entrada') return `E-mail usado: ${d.email}`
    if (d.texto) return `“${d.texto}”`
    if (d.papel) return `${d.email} · ${d.papel}`
    if (d.url) return `${(d.tamanho / 1024).toFixed(0)} KB`
    return a.detalhes
  } catch {
    return a.detalhes
  }
}

function Atividades() {
  const [parametros, setParametros] = useSearchParams()
  const [dados, setDados] = useState(null)
  const [utilizadores, setUtilizadores] = useState([])
  const [erro, setErro] = useState('')

  const filtros = Object.fromEntries(['utilizador', 'acao', 'colecao', 'desde', 'ate', 'q', 'pagina'].map((k) => [k, parametros.get(k) || '']))

  const carregar = useCallback(() => {
    const q = new URLSearchParams(Object.entries(Object.fromEntries(parametros)).filter(([, v]) => v))
    api(`/atividades?${q}`).then((r) => { setErro(''); setDados(r) }).catch((e) => setErro(e.message))
  }, [parametros])
  useEffect(carregar, [carregar])
  useEffect(() => { api('/utilizadores').then(setUtilizadores).catch(() => {}) }, [])

  function mudar(campo, valor) {
    const novo = new URLSearchParams(parametros)
    if (valor) novo.set(campo, valor)
    else novo.delete(campo)
    if (campo !== 'pagina') novo.delete('pagina')
    setParametros(novo)
  }

  const totalPaginas = dados ? Math.max(1, Math.ceil(dados.total / dados.porPagina)) : 1

  return (
    <>
      <CabecalhoPagina titulo="Registo de atividades" subtitulo="segurança e auditoria" migalhas={[{ rotulo: 'Registo de atividades' }]} />
      {erro && <Erro texto={erro} onRepetir={() => { setErro(''); carregar() }} />}

      <Painel titulo="Filtros">
        <div className="row g-2">
          <div className="col-md-3">
            <select className="form-select" value={filtros.utilizador} onChange={(e) => mudar('utilizador', e.target.value)} aria-label="Utilizador">
              <option value="">Todos os utilizadores</option>
              {utilizadores.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </select>
          </div>
          <div className="col-md-2">
            <select className="form-select" value={filtros.acao} onChange={(e) => mudar('acao', e.target.value)} aria-label="Ação">
              <option value="">Todas as ações</option>
              {dados?.acoes.map((a) => <option key={a} value={a}>{NOMES_ACOES[a] || a}</option>)}
            </select>
          </div>
          <div className="col-md-2">
            <select className="form-select" value={filtros.colecao} onChange={(e) => mudar('colecao', e.target.value)} aria-label="Área">
              <option value="">Todas as áreas</option>
              {Object.entries(NOMES_COLECOES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="col-md-2"><input type="date" className="form-control" value={filtros.desde} onChange={(e) => mudar('desde', e.target.value)} aria-label="Desde" title="Desde" /></div>
          <div className="col-md-2"><input type="date" className="form-control" value={filtros.ate} onChange={(e) => mudar('ate', e.target.value)} aria-label="Até" title="Até" /></div>
          <div className="col-md-1 d-grid"><button className="btn btn-white" onClick={() => setParametros({})} title="Limpar filtros"><i className="fa fa-times" /></button></div>
          <div className="col-12">
            <input className="form-control" placeholder="Pesquisar título, detalhe ou endereço IP…" defaultValue={filtros.q} onKeyDown={(e) => e.key === 'Enter' && mudar('q', e.target.value)} />
          </div>
        </div>
      </Painel>

      <Painel titulo={`Ações registadas${dados ? ` (${dados.total})` : ''}`} corpo={false}>
        {!dados && !erro ? <Carregando /> : (
          <div className="table-responsive">
            <table className="table table-striped align-middle mb-0 small">
              <thead>
                <tr><th>Data</th><th>Utilizador</th><th>Ação</th><th>Alvo</th><th>Detalhes</th><th>IP</th></tr>
              </thead>
              <tbody>
                {dados?.linhas.length === 0 && <tr><td colSpan={6} className="text-center text-muted py-4">Sem registos para estes filtros.</td></tr>}
                {dados?.linhas.map((a) => (
                  <tr key={a.id} className={a.acao === 'falha_entrada' ? 'linha-alerta' : ''}>
                    <td className="text-nowrap">{dataHora(a.data)}</td>
                    <td className="text-nowrap fw-bold">{a.utilizador_nome || <span className="text-muted fw-normal">desconhecido</span>}</td>
                    <td><span className={`badge ${CORES[a.acao] || 'bg-secondary'}`}>{NOMES_ACOES[a.acao] || a.acao}</span></td>
                    <td>
                      {a.colecao && <span className="text-muted">{NOMES_COLECOES[a.colecao] || a.colecao} · </span>}
                      {a.alvo_titulo || '—'}
                    </td>
                    <td className="text-muted texto-comentario">{detalhes(a)}</td>
                    <td className="text-nowrap text-muted" title={a.agente}>{a.ip}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {totalPaginas > 1 && (
          <div className="panel-body d-flex justify-content-end">
            <ul className="pagination mb-0">
              <li className={`page-item ${dados.pagina <= 1 ? 'disabled' : ''}`}><button className="page-link" onClick={() => mudar('pagina', String(dados.pagina - 1))}>Anterior</button></li>
              <li className="page-item disabled"><span className="page-link">{dados.pagina} / {totalPaginas}</span></li>
              <li className={`page-item ${dados.pagina >= totalPaginas ? 'disabled' : ''}`}><button className="page-link" onClick={() => mudar('pagina', String(dados.pagina + 1))}>Seguinte</button></li>
            </ul>
          </div>
        )}
      </Painel>
    </>
  )
}

export default Atividades
