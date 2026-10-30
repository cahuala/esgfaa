import { useCallback, useEffect, useState } from 'react'
import { api, abrirFicheiro, enviarComProgresso } from '../api'
import { Cartao } from '../componentes'
import { dataHora, nota } from '../formatar'
import { confirmar } from '../dialogos'
import { NOMES_COMPONENTES } from '../regraAvaliacao'
import { t as tx } from '../../i18n/linguas'

const ESTADOS_PROVA = { enviado: ['bg-warning text-dark', tx('Enviada à Repartição')], impresso: ['bg-success', tx('Impressa')] }
const ESTADOS_PEDIDO = { pendente: ['bg-warning text-dark', tx('À espera do Comandante')], autorizado: ['bg-primary', tx('Autorizado: pode alterar')], recusado: ['bg-danger', tx('Recusado')], usado: ['bg-success', tx('Alterada')] }

/*
  Por baixo da pauta (docente):
  - Provas escritas para impressão: envia o enunciado (PDF ou Word) à Repartição de Administração Escolar,
    que imprime uma cópia por estudante; os estudantes nunca veem o ficheiro.
  - Alteração de notas publicadas: depois de publicadas, as notas só mudam para os estudantes que o
    Comandante autorizar. Escolhe-se a prova, os estudantes e o motivo; a autorização serve uma vez.
*/
export default function ControloNotas({ c, avisar }) {
  return (
    <div className="row g-3 mt-1 p-sem-impressao">
      <div className="col-xl-6"><ProvasEscritas c={c} avisar={avisar} /></div>
      <div className="col-xl-6"><AlteracoesNotas c={c} avisar={avisar} /></div>
    </div>
  )
}

function ProvasEscritas({ c, avisar }) {
  const [lista, setLista] = useState(null)
  const [f, setF] = useState({ titulo: '', data: '', copias: '', observacoes: '' })
  const [ficheiro, setFicheiro] = useState(null)
  const [envio, setEnvio] = useState(null)
  const carregar = useCallback(() => api(`/cadeiras/${c.id}/provas-escritas`).then(setLista).catch(() => setLista([])), [c.id])
  useEffect(() => { carregar() }, [carregar])

  async function enviar(e) {
    e.preventDefault()
    if (!ficheiro) return avisar({ tipo: 'erro', texto: tx('Escolha o ficheiro da prova (PDF ou Word).') })
    const fd = new FormData()
    for (const [k, v] of Object.entries(f)) if (v !== '') fd.append(k, v)
    fd.append('ficheiro', ficheiro)
    setEnvio(0)
    try {
      await enviarComProgresso(`/cadeiras/${c.id}/provas-escritas`, fd, { aoProgresso: setEnvio })
      avisar({ texto: tx('Prova enviada à Repartição de Administração Escolar para imprimir.') })
      setF({ titulo: '', data: '', copias: '', observacoes: '' })
      setFicheiro(null)
      e.target.reset()
      carregar()
    } catch (x) {
      avisar({ tipo: 'erro', texto: x.message })
    } finally {
      setEnvio(null)
    }
  }
  async function retirar(p) {
    if (!(await confirmar(tx('Retirar a prova «{0}»? A Repartição deixa de a ver.', { 0: p.titulo }), { titulo: tx('Retirar prova'), botao: tx('Retirar'), perigo: true }))) return
    api(`/provas-escritas/${p.id}`, { metodo: 'DELETE' }).then(carregar).catch((x) => avisar({ tipo: 'erro', texto: x.message }))
  }

  return (
    <Cartao titulo={<><i className="fa fa-print me-2" />{tx('Provas escritas para impressão')}</>}>
      <p className="small text-muted">{tx('Envie o enunciado da prova à Repartição de Administração Escolar, que imprime uma cópia por estudante. Os estudantes não veem este ficheiro.')}</p>
      <form onSubmit={enviar} className="row g-2 mb-3">
        <div className="col-sm-8"><label className="form-label small fw-bold" htmlFor="pe-titulo">{tx('Prova')}</label><input id="pe-titulo" className="form-control form-control-sm" required minLength={2} value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} placeholder={tx('Ex.: 1.º TAI — teste escrito')} /></div>
        <div className="col-sm-4"><label className="form-label small fw-bold" htmlFor="pe-data">{tx('Data da prova')}</label><input id="pe-data" type="date" className="form-control form-control-sm" value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} /></div>
        <div className="col-sm-8"><label className="form-label small fw-bold" htmlFor="pe-ficheiro">{tx('Enunciado (PDF ou Word)')}</label><input id="pe-ficheiro" type="file" className="form-control form-control-sm" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" required onChange={(e) => setFicheiro(e.target.files?.[0] ?? null)} /></div>
        <div className="col-sm-4"><label className="form-label small fw-bold" htmlFor="pe-copias">{tx('Cópias')}</label><input id="pe-copias" type="number" min={1} max={1000} className="form-control form-control-sm" value={f.copias} onChange={(e) => setF({ ...f, copias: e.target.value })} placeholder={tx('Uma por estudante')} /></div>
        <div className="col-12"><label className="form-label small fw-bold" htmlFor="pe-obs">{tx('Observações para a Repartição (opcional)')}</label><input id="pe-obs" className="form-control form-control-sm" value={f.observacoes} onChange={(e) => setF({ ...f, observacoes: e.target.value })} placeholder={tx('Ex.: frente e verso; agrafar')} /></div>
        <div className="col-12 d-flex align-items-center gap-2">
          <button type="submit" className="btn btn-theme btn-sm" disabled={envio !== null}><i className="fa fa-paper-plane me-1" />{envio !== null ? tx('A enviar… {0}%', { 0: envio }) : tx('Enviar para impressão')}</button>
        </div>
      </form>
      {lista?.length > 0 && (
        <div className="list-group">
          {lista.map((p) => (
            <div key={p.id} className="list-group-item d-flex flex-wrap align-items-center gap-2">
              <div className="flex-grow-1">
                <div className="fw-bold">{p.titulo}</div>
                <div className="small text-muted">{[p.data && p.data.split('-').reverse().join('/'), tx('{0} cópia(s)', { 0: p.copias }), tx('enviada {0}', { 0: dataHora(p.enviadoEm) }), p.impressoEm && tx('impressa {0} por {1}', { 0: dataHora(p.impressoEm), 1: p.impressoPor })].filter(Boolean).join(' · ')}</div>
              </div>
              <span className={`badge ${ESTADOS_PROVA[p.estado][0]}`}>{ESTADOS_PROVA[p.estado][1]}</span>
              <button type="button" className="btn btn-xs btn-white" onClick={() => abrirFicheiro(p.ficheiroId, { ver: true }).catch((x) => avisar({ tipo: 'erro', texto: x.message }))}><i className="fa fa-eye me-1" />{tx('Ver')}</button>
              {p.estado === 'enviado' && <button type="button" className="btn btn-xs btn-white text-danger" onClick={() => retirar(p)} aria-label={tx('Retirar')}><i className="fa fa-trash-alt" /></button>}
            </div>
          ))}
        </div>
      )}
    </Cartao>
  )
}

function AlteracoesNotas({ c, avisar }) {
  const [pedidos, setPedidos] = useState(null)
  const [pauta, setPauta] = useState(null)
  const [aberto, setAberto] = useState(false)
  const [f, setF] = useState({ prova: '', estudanteIds: [], motivo: '' })
  const [aEnviar, setAEnviar] = useState(false)
  const carregar = useCallback(() => {
    api(`/cadeiras/${c.id}/alteracoes-notas`).then(setPedidos).catch(() => setPedidos([]))
    api(`/cadeiras/${c.id}/pauta`).then(setPauta).catch(() => {})
  }, [c.id])
  useEffect(() => { carregar() }, [carregar])

  // as provas já publicadas (só essas pedem autorização para mudar)
  const provas = !pauta ? [] : pauta.modo === 'esg'
    ? pauta.avaliacoes.filter((a) => a.publicadaEm).map((a) => ({ chave: `a${a.id}`, corpo: { avaliacaoId: a.id }, nome: `${a.tipo} ${a.titulo}`, nota: (l) => l.notas[a.id]?.nota }))
    : (pauta.publicadas ?? []).map((k) => ({ chave: k, corpo: { componente: k }, nome: NOMES_COMPONENTES[k], nota: (l) => l[k] }))
  const prova = provas.find((p) => p.chave === f.prova)
  const marcar = (id) => setF({ ...f, estudanteIds: f.estudanteIds.includes(id) ? f.estudanteIds.filter((x) => x !== id) : [...f.estudanteIds, id] })

  async function pedir(e) {
    e.preventDefault()
    setAEnviar(true)
    try {
      setPedidos(await api(`/cadeiras/${c.id}/alteracoes-notas`, { metodo: 'POST', corpo: { ...prova.corpo, estudanteIds: f.estudanteIds, motivo: f.motivo } }))
      avisar({ texto: tx('Pedido enviado ao Comandante. Será avisado da decisão.') })
      setF({ prova: '', estudanteIds: [], motivo: '' })
      setAberto(false)
    } catch (x) {
      avisar({ tipo: 'erro', texto: x.message })
    } finally {
      setAEnviar(false)
    }
  }

  const autorizados = (pedidos ?? []).filter((p) => p.estado === 'autorizado')
  return (
    <Cartao
      titulo={<><i className="fa fa-user-shield me-2" />{tx('Alteração de notas publicadas')}</>}
      acoes={provas.length > 0 && !aberto && <button type="button" className="btn btn-xs btn-white" onClick={() => setAberto(true)}><i className="fa fa-plus me-1" />{tx('Pedir alteração')}</button>}
    >
      <p className="small text-muted">{tx('Depois de publicadas, as notas só mudam com autorização do Comandante, estudante a estudante. A autorização serve uma vez e fica registada.')}</p>
      {autorizados.length > 0 && (
        <div className="alert alert-primary py-2 small">
          <i className="fa fa-unlock me-1" />{tx('Pode alterar agora na pauta:')} {autorizados.map((p) => `${p.estudante?.nome} (${p.prova ? `${p.prova.tipo} ${p.prova.titulo}` : NOMES_COMPONENTES[p.componente]})`).join('; ')}
        </div>
      )}
      {aberto && (
        <form onSubmit={pedir} className="border rounded p-2 mb-3">
          <label className="form-label small fw-bold" htmlFor="an-prova">{tx('Prova')}</label>
          <select id="an-prova" className="form-select form-select-sm mb-2" required value={f.prova} onChange={(e) => setF({ ...f, prova: e.target.value, estudanteIds: [] })}>
            <option value="">{tx('Escolha a prova publicada')}</option>
            {provas.map((p) => <option key={p.chave} value={p.chave}>{p.nome}</option>)}
          </select>
          {prova && (
            <>
              <div className="small fw-bold mb-1">{tx('Estudantes (um ou mais)')}</div>
              <div className="border rounded mb-2" style={{ maxHeight: 220, overflowY: 'auto' }}>
                {pauta.linhas.map((l) => (
                  <label key={l.estudante.id} className="d-flex align-items-center gap-2 px-2 py-1 border-bottom small mb-0">
                    <input type="checkbox" className="form-check-input mt-0" checked={f.estudanteIds.includes(l.estudante.id)} onChange={() => marcar(l.estudante.id)} />
                    <span className="flex-grow-1">{l.estudante.nome}</span>
                    <span className="text-muted">{nota(prova.nota(l) ?? null)}</span>
                  </label>
                ))}
              </div>
            </>
          )}
          <label className="form-label small fw-bold" htmlFor="an-motivo">{tx('Motivo')}</label>
          <textarea id="an-motivo" className="form-control form-control-sm mb-2" rows={2} required minLength={10} value={f.motivo} onChange={(e) => setF({ ...f, motivo: e.target.value })} placeholder={tx('Ex.: erro de soma na correção da pergunta 3')} />
          <div className="d-flex gap-2">
            <button type="submit" className="btn btn-theme btn-sm" disabled={aEnviar || !prova || !f.estudanteIds.length}><i className="fa fa-paper-plane me-1" />{tx('Pedir ao Comandante ({0})', { 0: f.estudanteIds.length })}</button>
            <button type="button" className="btn btn-white btn-sm" onClick={() => setAberto(false)}>{tx('Cancelar')}</button>
          </div>
        </form>
      )}
      {!provas.length && <div className="small text-muted">{tx('Ainda não há notas publicadas nesta cadeira.')}</div>}
      {pedidos?.length > 0 && (
        <div className="table-responsive">
          <table className="table table-sm align-middle mb-0 small">
            <thead><tr><th>{tx('Estudante')}</th><th>{tx('Prova')}</th><th className="text-center">{tx('Nota')}</th><th>{tx('Estado')}</th></tr></thead>
            <tbody>
              {pedidos.map((p) => (
                <tr key={p.id} title={p.motivo}>
                  <td>{p.estudante?.nome}</td>
                  <td>{p.prova ? `${p.prova.tipo} ${p.prova.titulo}` : NOMES_COMPONENTES[p.componente]}</td>
                  <td className="text-center text-nowrap">{nota(p.notaAtual)}{p.notaNova !== null && <> → <b>{nota(p.notaNova)}</b></>}</td>
                  <td><span className={`badge ${ESTADOS_PEDIDO[p.estado][0]}`}>{ESTADOS_PEDIDO[p.estado][1]}</span>{p.fundamento && <div className="text-muted">{p.fundamento}</div>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Cartao>
  )
}
