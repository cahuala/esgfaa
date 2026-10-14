import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import { Campo, Cartao, Carregando, Vazio } from '../componentes'
import { confirmar, pedir } from '../dialogos'

// grupos da cadeira: o docente cria e organiza; o estudante vê o seu grupo
function Grupos({ c, eDocente, avisar }) {
  const [d, setD] = useState(null)
  const [editar, setEditar] = useState(null) // grupo cujos membros se escolhem
  const falhou = useCallback((e) => avisar({ tipo: 'erro', texto: e.message }), [avisar])
  const carregar = useCallback(() => api(`/cadeiras/${c.id}/grupos`).then(setD).catch(falhou), [c.id, falhou])
  useEffect(() => { carregar() }, [carregar])
  if (!d) return <Carregando />

  if (!eDocente) {
    if (!d.meu) return <Vazio>Ainda não está em nenhum grupo nesta cadeira.</Vazio>
    return (
      <Cartao titulo={<><i className="fa fa-users me-2" />O meu grupo: {d.meu.nome}</>} corpo={false}>
        <ListaMembros membros={d.meu.membros} />
      </Cartao>
    )
  }

  async function novo() {
    const nome = await pedir('Nome do grupo', `Grupo ${d.grupos.length + 1}`, { botao: 'Criar grupo' })
    if (!nome) return
    await api(`/cadeiras/${c.id}/grupos`, { metodo: 'POST', corpo: { nome } }).then((g) => { carregar(); setEditar(g) }).catch(falhou)
  }
  async function renomear(g) {
    const nome = await pedir('Novo nome do grupo', g.nome)
    if (!nome || nome === g.nome) return
    await api(`/grupos/${g.id}`, { metodo: 'PUT', corpo: { nome } }).then(carregar).catch(falhou)
  }
  async function apagar(g) {
    if (!(await confirmar(`Apagar o ${g.nome}? Os membros ficam sem grupo.`, { titulo: 'Apagar grupo', botao: 'Apagar', perigo: true }))) return
    await api(`/grupos/${g.id}`, { metodo: 'DELETE' }).then(() => { avisar({ texto: 'Grupo apagado.' }); carregar() }).catch(falhou)
  }

  return (
    <div className="row">
      <div className="col-xl-8">
        <div className="d-flex flex-wrap gap-2 mb-3">
          <button type="button" className="btn btn-theme" onClick={novo}><i className="fa fa-plus me-1" />Novo grupo</button>
        </div>
        {d.grupos.length === 0 && <Vazio>Ainda não há grupos. Crie-os um a um ou ao acaso, ao lado.</Vazio>}
        <div className="row g-3">
          {d.grupos.map((g) => (
            <div key={g.id} className="col-md-6">
              <div className="panel panel-inverse h-100 mb-0">
                <div className="panel-heading">
                  <h2 className="panel-title"><i className="fa fa-users me-2" />{g.nome} <span className="badge bg-gray-500 ms-1">{g.membros.length}</span></h2>
                  <div className="panel-heading-btn">
                    <button type="button" className="btn btn-xs btn-icon btn-white me-1" onClick={() => setEditar(g)} aria-label={`Membros do ${g.nome}`} title="Escolher membros"><i className="fa fa-user-edit" /></button>
                    <button type="button" className="btn btn-xs btn-icon btn-white me-1" onClick={() => renomear(g)} aria-label={`Mudar o nome do ${g.nome}`} title="Mudar o nome"><i className="fa fa-pen" /></button>
                    <button type="button" className="btn btn-xs btn-icon btn-danger" onClick={() => apagar(g)} aria-label={`Apagar o ${g.nome}`}><i className="fa fa-trash-alt" /></button>
                  </div>
                </div>
                {g.membros.length ? <ListaMembros membros={g.membros} /> : <div className="panel-body text-muted small">Sem membros.</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="col-xl-4">
        <Automatico c={c} semGrupo={d.semGrupo.length} avisar={avisar} feito={setD} />
        <Cartao titulo={<><i className="fa fa-user-slash me-2" />Sem grupo ({d.semGrupo.length})</>} corpo={false}>
          {d.semGrupo.length ? <ListaMembros membros={d.semGrupo} /> : <div className="panel-body small text-muted">Todos os estudantes têm grupo.</div>}
        </Cartao>
      </div>
      {editar && <Membros c={c} g={editar} d={d} fechar={() => setEditar(null)} feito={() => { setEditar(null); avisar({ texto: 'Membros guardados.' }); carregar() }} falhou={falhou} />}
    </div>
  )
}

function ListaMembros({ membros }) {
  return (
    <div className="list-group list-group-flush">
      {membros.map((m) => (
        <div key={m.id} className="list-group-item d-flex gap-2 align-items-center">
          <span className="admin-avatar flex-shrink-0">{m.nome.split(/\s+/).filter((x) => !x.includes('.')).map((x) => x[0]).slice(0, 2).join('')}</span>
          <div className="min-w-0"><div className="fw-bold small text-truncate">{m.nome}</div><div className="small text-muted">{m.numero}</div></div>
        </div>
      ))}
    </div>
  )
}

// criar grupos ao acaso: N estudantes por grupo, ou N grupos
function Automatico({ c, semGrupo, avisar, feito }) {
  const [f, setF] = useState({ modo: 'tamanho', valor: 4, prefixo: 'Grupo', soSemGrupo: true })
  const [aCriar, setACriar] = useState(false)
  async function criar(e) {
    e.preventDefault()
    setACriar(true)
    try {
      feito(await api(`/cadeiras/${c.id}/grupos/automatico`, { metodo: 'POST', corpo: { ...f, valor: Number(f.valor) } }))
      avisar({ texto: 'Grupos criados ao acaso.' })
    } catch (falha) {
      avisar({ tipo: 'erro', texto: falha.message })
    } finally {
      setACriar(false)
    }
  }
  return (
    <Cartao titulo={<><i className="fa fa-random me-2" />Criar grupos ao acaso</>}>
      <form className="p-formulario" onSubmit={criar}>
        <div className="row g-2">
          <div className="col-7"><Campo id="ga-modo" rotulo="Distribuir por"><select id="ga-modo" value={f.modo} onChange={(e) => setF({ ...f, modo: e.target.value })}><option value="tamanho">Estudantes por grupo</option><option value="numero">Número de grupos</option></select></Campo></div>
          <div className="col-5"><Campo id="ga-valor" rotulo={f.modo === 'tamanho' ? 'Por grupo' : 'Grupos'}><input id="ga-valor" type="number" min={1} max={200} value={f.valor} onChange={(e) => setF({ ...f, valor: e.target.value })} required /></Campo></div>
        </div>
        <Campo id="ga-prefixo" rotulo="Nome dos grupos"><input id="ga-prefixo" value={f.prefixo} onChange={(e) => setF({ ...f, prefixo: e.target.value })} maxLength={40} /></Campo>
        <label className="p-caixa"><input type="checkbox" checked={f.soSemGrupo} onChange={(e) => setF({ ...f, soSemGrupo: e.target.checked })} /> Só quem está sem grupo ({semGrupo})</label>
        <div><button type="submit" className="btn btn-white" disabled={aCriar}>{aCriar ? 'A criar…' : 'Criar grupos'}</button></div>
      </form>
    </Cartao>
  )
}

// escolher os membros de um grupo (quem já está noutro grupo muda para este)
function Membros({ c, g, d, fechar, feito, falhou }) {
  const [escolhidos, setEscolhidos] = useState(() => new Set(g.membros.map((m) => m.id)))
  const [aGuardar, setAGuardar] = useState(false)
  const outroGrupo = Object.fromEntries(d.grupos.filter((x) => x.id !== g.id).flatMap((x) => x.membros.map((m) => [m.id, x.nome])))
  const todos = [...d.grupos.flatMap((x) => x.membros), ...d.semGrupo].sort((a, b) => a.nome.localeCompare(b.nome, 'pt'))
  const alternar = (id) => setEscolhidos((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  async function guardar() {
    setAGuardar(true)
    try {
      await api(`/grupos/${g.id}`, { metodo: 'PUT', corpo: { membros: [...escolhidos] } })
      feito()
    } catch (e) {
      falhou(e)
      setAGuardar(false)
    }
  }
  return (
    <>
      <div className="modal d-block" tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="membros-titulo" onClick={() => !aGuardar && fechar()}>
        <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable" onClick={(e) => e.stopPropagation()}>
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title" id="membros-titulo"><i className="fa fa-user-edit me-2" />Membros do {g.nome}</h4>
              <button type="button" className="btn-close" onClick={fechar} disabled={aGuardar} aria-label="Fechar" />
            </div>
            <div className="modal-body p-0">
              <div className="list-group list-group-flush">
                {todos.map((e) => (
                  <label key={e.id} className="list-group-item list-group-item-action d-flex gap-2 align-items-center">
                    <input type="checkbox" className="form-check-input mt-0" checked={escolhidos.has(e.id)} onChange={() => alternar(e.id)} aria-label={e.nome} />
                    <span className="flex-grow-1">{e.nome}<span className="d-block small text-muted">{e.numero}</span></span>
                    {outroGrupo[e.id] && <span className="badge bg-light text-dark border">{escolhidos.has(e.id) ? `sai do ${outroGrupo[e.id]}` : outroGrupo[e.id]}</span>}
                  </label>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <span className="me-auto small text-muted">{escolhidos.size} escolhido(s) · {c.codigo}</span>
              <button type="button" className="btn btn-white" onClick={fechar} disabled={aGuardar}>Cancelar</button>
              <button type="button" className="btn btn-theme" onClick={guardar} disabled={aGuardar}>{aGuardar ? 'A guardar…' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" />
    </>
  )
}

export default Grupos
