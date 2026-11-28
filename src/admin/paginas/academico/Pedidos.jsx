import { Fragment, useCallback, useEffect, useState } from 'react'
import { useAnoTrabalho } from '../../anoTrabalho'
import { abrirFicheiro, api } from '../../api'
import { useSessao } from '../../sessaoContexto'
import { Aviso, CabecalhoPagina, Carregando, Erro, Janela, Painel } from '../../componentes/Ui'
import { dataHora } from '../../formatar'
import { t as tx } from '../../../i18n/linguas'

const ESTADOS = { pendente: ['bg-secondary', tx('Pendente')], em_tratamento: ['bg-warning text-dark', tx('Em tratamento')], pronto: ['bg-success', tx('Pronto')], recusado: ['bg-danger', tx('Recusado')] }

// um pedido feito ao balcão, por ofício ou por telefone: a Repartição regista-o em nome do estudante
function NovoPedido({ aoCriar, aoFechar }) {
  const [tipos, setTipos] = useState([])
  const [estudantes, setEstudantes] = useState(null)
  const [f, setF] = useState({ q: '', estudanteId: '', tipo: '', motivo: '' })
  const [erro, setErro] = useState('')
  const [aGravar, setAGravar] = useState(false)
  useEffect(() => {
    api('/academico/pedidos/tipos').then((t) => { setTipos(t); setF((x) => ({ ...x, tipo: x.tipo || t[0] || '' })) }).catch((e) => setErro(e.message))
    api('/academico/contas?tipo=estudante').then(setEstudantes).catch((e) => setErro(e.message))
  }, [])
  const sem = (v) => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const termos = sem(f.q).split(/\s+/).filter(Boolean)
  const achados = (estudantes ?? []).filter((e) => termos.length && termos.every((x) => sem([e.nome, e.numero, e.dados?.nip].join(' ')).includes(x))).slice(0, 12)
  const escolhido = (estudantes ?? []).find((e) => String(e.id) === String(f.estudanteId))
  async function criar(ev) {
    ev.preventDefault()
    setAGravar(true); setErro('')
    try { await api('/academico/pedidos', { metodo: 'POST', corpo: { estudanteId: Number(f.estudanteId), tipo: f.tipo, ...(f.motivo.trim() ? { motivo: f.motivo.trim() } : {}) } }); aoCriar() } catch (e) { setErro(e.message) } finally { setAGravar(false) }
  }
  return (
    <Janela titulo={tx('Novo pedido de documento')} onFechar={aoFechar} larga>
      <form onSubmit={criar}>
        {erro && <div className="alert alert-danger py-2">{erro}</div>}
        <div className="row g-2">
          <div className="col-md-6">
            <label className="form-label fw-bold" htmlFor="np-q">{tx('1. Estudante')}</label>
            {escolhido
              ? <div className="d-flex align-items-center gap-2 border rounded p-2"><b className="me-auto">{[escolhido.dados?.posto, escolhido.nome].filter(Boolean).join(' ')}</b><button type="button" className="btn btn-xs btn-white" onClick={() => setF({ ...f, estudanteId: '' })}>{tx('Mudar')}</button></div>
              : <>
                <input id="np-q" className="form-control" placeholder={tx('Escreva o nome ou o NIP')} value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} autoFocus />
                <div className="list-group mt-1">{achados.map((e) => <button key={e.id} type="button" className="list-group-item list-group-item-action py-1 small" onClick={() => setF({ ...f, estudanteId: e.id, q: '' })}>{[e.dados?.posto, e.nome].filter(Boolean).join(' ')}{e.dados?.nip ? ` · NIP ${e.dados.nip}` : ''}</button>)}</div>
              </>}
          </div>
          <div className="col-md-6">
            <label className="form-label fw-bold" htmlFor="np-tipo">{tx('2. Documento')}</label>
            <select id="np-tipo" className="form-select mb-2" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>{tipos.map((t) => <option key={t} value={t}>{tx(t)}</option>)}</select>
            <label className="form-label" htmlFor="np-motivo">{tx('Motivo / observação')}{f.tipo === 'Outro' && ' *'}</label>
            <textarea id="np-motivo" className="form-control" rows={2} maxLength={1000} value={f.motivo} onChange={(e) => setF({ ...f, motivo: e.target.value })} />
          </div>
        </div>
        <div className="d-flex gap-2 mt-3">
          <button type="button" className="btn btn-white" onClick={aoFechar}>{tx('Cancelar')}</button>
          <button type="submit" className="btn btn-theme ms-auto" disabled={!f.estudanteId || !f.tipo || aGravar}><i className={`fa ${aGravar ? 'fa-spinner fa-spin' : 'fa-paper-plane'} me-1`} />{tx('Registar o pedido')}</button>
        </div>
      </form>
    </Janela>
  )
}

// pedidos de documentos: os feitos pelos estudantes no portal e os registados aqui pela Repartição
function Pedidos() {
  const { pode } = useSessao()
  const [lista, setLista] = useState(null)
  const [erro, setErro] = useState('')
  const [estado, setEstado] = useState('')
  const [aberto, setAberto] = useState(null)
  const [aviso, setAviso] = useState(null)
  const [novo, setNovo] = useState(false)

  // os pedidos feitos dentro do ano lectivo do menu (do início ao fim do ano lectivo)
  const { ano, anos } = useAnoTrabalho()
  const periodo = anos.find((x) => x.id === ano)
  const de = String(periodo?.inicio ?? '').slice(0, 10)
  const ate = String(periodo?.fim ?? '').slice(0, 10)
  const carregar = useCallback(() => api(`/academico/pedidos${estado ? `?estado=${estado}` : ''}`).then((r) => { setErro(''); setLista(r.filter((p) => !de || !ate || (String(p.criadoEm ?? '').slice(0, 10) >= de && String(p.criadoEm ?? '').slice(0, 10) <= ate))) }).catch((e) => setErro(e.message)), [estado, de, ate])
  useEffect(() => { carregar() }, [carregar])

  return (
    <>
      <CabecalhoPagina titulo={tx('Pedidos de documentos')} subtitulo={tx('feitos no portal ou registados pela Repartição')} migalhas={[{ rotulo: tx('Administração Escolar') }, { rotulo: tx('Pedidos') }]}>
        {pode('academico.gerir') && !novo && <button type="button" className="btn btn-theme" onClick={() => setNovo(true)}><i className="fa fa-plus me-1" />{tx('Novo pedido')}</button>}
      </CabecalhoPagina>
      {novo && <NovoPedido aoFechar={() => setNovo(false)} aoCriar={() => { setNovo(false); setAviso({ texto: tx('Pedido registado.') }); carregar() }} />}
      {erro && <Erro texto={erro} onRepetir={carregar} />}
      <Painel titulo={`Pedidos${lista ? ` (${lista.length})` : ''}`} corpo={false}>
        <div className="panel-body pb-0">
          <select className="form-select w-auto" value={estado} onChange={(e) => setEstado(e.target.value)} aria-label={tx('Estado')}>
            <option value="">{tx('Todos os estados')}</option>
            {Object.entries(ESTADOS).map(([k, [, v]]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        {!lista && !erro ? <Carregando /> : (
          <div className="table-responsive mt-3">
            <table className="table table-striped align-middle mb-0">
              <thead><tr><th>{tx('Estudante')}</th><th>{tx('Documento')}</th><th>{tx('Pedido em')}</th><th>{tx('Estado')}</th><th /></tr></thead>
              <tbody>
                {lista?.length === 0 && <tr><td colSpan={5} className="text-center text-muted py-4">{tx('Sem pedidos.')}</td></tr>}
                {lista?.map((p) => (
                  <Fragment key={p.id}>
                    <tr>
                      <td><span className="fw-bold">{p.estudante.nome}</span><div className="small text-muted">{p.estudante.numero}</div></td>
                      <td>{p.tipo}{p.motivo && <div className="small text-muted texto-comentario">{p.motivo}</div>}</td>
                      <td className="text-nowrap">{dataHora(p.criadoEm)}</td>
                      <td><span className={`badge ${ESTADOS[p.estado][0]}`}>{ESTADOS[p.estado][1]}</span></td>
                      <td className="text-end">{pode('academico.gerir') && <button type="button" className="btn btn-sm btn-primary" onClick={() => setAberto(aberto === p.id ? null : p.id)}>{tx('Tratar')}</button>}</td>
                    </tr>
                    {aberto === p.id && (
                      <TratarPedido p={p} aoFechar={() => setAberto(null)} aoGuardar={() => { setAberto(null); setAviso({ texto: tx('Pedido actualizado.') }); carregar() }} avisar={setAviso} />
                    )}
                  </Fragment>
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

function TratarPedido({ p, aoGuardar, aoFechar, avisar }) {
  const [f, setF] = useState({ estado: p.estado, resposta: p.resposta || '' })
  const [ficheiro, setFicheiro] = useState(null)
  const [aGuardar, setAGuardar] = useState(false)

  async function guardar(e) {
    e.preventDefault()
    setAGuardar(true)
    try {
      const fd = new FormData()
      fd.append('estado', f.estado)
      fd.append('resposta', f.resposta)
      if (ficheiro) fd.append('ficheiro', ficheiro)
      await api(`/academico/pedidos/${p.id}`, { metodo: 'PUT', formulario: fd })
      aoGuardar()
    } catch (falha) {
      avisar({ tipo: 'erro', texto: falha.message })
    } finally {
      setAGuardar(false)
    }
  }

  return (
    <Janela titulo={`${tx('Tratar o pedido')} · ${p.tipo}`} onFechar={aoFechar} larga>
    <div className="small text-muted mb-2">{p.estudante.nome} · {dataHora(p.criadoEm)}{p.motivo && ` · ${p.motivo}`}</div>
    <form className="row g-2 align-items-end" onSubmit={guardar}>
      <div className="col-md-4">
        <label className="form-label fw-bold" htmlFor={`pe-${p.id}`}>{tx('Estado')}</label>
        <select id={`pe-${p.id}`} className="form-select" value={f.estado} onChange={(e) => setF({ ...f, estado: e.target.value })}>
          {Object.entries(ESTADOS).map(([k, [, v]]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <div className="col-md-8">
        <label className="form-label fw-bold" htmlFor={`pr-${p.id}`}>{tx('Resposta ao estudante')}</label>
        <input id={`pr-${p.id}`} className="form-control" value={f.resposta} onChange={(e) => setF({ ...f, resposta: e.target.value })} placeholder={tx('Ex.: pode levantar na Administração Escolar a partir de…')} />
      </div>
      <div className="col-12">
        <label className="form-label fw-bold" htmlFor={`pf-${p.id}`}>{tx('Documento (PDF)')}</label>
        <input id={`pf-${p.id}`} type="file" accept="application/pdf" className="form-control" onChange={(e) => setFicheiro(e.target.files[0] || null)} />
        {p.ficheiroId && <button type="button" className="btn btn-link btn-sm p-0" onClick={() => abrirFicheiro(p.ficheiroId, `${p.tipo}.pdf`).catch((x) => avisar({ tipo: 'erro', texto: x.message }))}>{tx('Ver o documento actual')}</button>}
      </div>
      <div className="col-12 d-flex gap-2 justify-content-end mt-3"><button type="button" className="btn btn-white" onClick={aoFechar}>{tx('Cancelar')}</button><button type="submit" className="btn btn-theme" disabled={aGuardar}>{tx('Guardar')}</button></div>
    </form>
    </Janela>
  )
}

export default Pedidos
