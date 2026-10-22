import { useCallback, useEffect, useState } from 'react'
import { api } from '../../api'
import { useSessao } from '../../sessaoContexto'
import { Carregando, Painel } from '../../componentes/Ui'
import { t as tx, localAtual } from '../../../i18n/linguas'

const nota = (v) => (v === null || v === undefined ? '—' : Number(v).toLocaleString(localAtual(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
const PASSOS = [['aberto', 'Em avaliação'], ['proposta', 'Proposta do Director de Ensino'], ['confirmada', 'Confirmada em Conselho de Curso'], ['homologada', 'Homologada pelo Comandante']]
const dia = (v) => (v ? new Date(v).toLocaleDateString(localAtual()) : '')

/*
  Pedidos de revisão das provas (regulamento da ESG): o auditor/discente reclama por escrito ao Director do
  Curso; o Director de Ensino delibera e escreve a nota da revisão, que pode subir, manter-se ou baixar.
  Decide-se antes da proposta ao Conselho de Curso. Só aparece quando há pedidos.
*/
function RevisoesProvas({ turma, decidir, termo, avisar }) {
  const [lista, setLista] = useState(null)
  const [edicao, setEdicao] = useState({}) // chave → { nota, fundamento }
  const base = `/academico/turmas/${turma.id}/revisoes`
  useEffect(() => { api(base).then(setLista).catch(() => setLista([])) }, [base])
  if (!lista?.length) return null
  const chave = (x) => `${x.avaliacao.id}-${x.estudante.id}`
  const pendentes = lista.filter((x) => !x.revisao.decididaEm).length
  async function decidirUm(x) {
    const e = edicao[chave(x)] ?? {}
    try {
      setLista(await api(base, { metodo: 'PUT', corpo: { avaliacaoId: x.avaliacao.id, estudanteId: x.estudante.id, nota: e.nota ?? String(x.nota), fundamento: e.fundamento ?? '' } }))
      avisar({ texto: tx('Revisão decidida. O {0} foi notificado.', { 0: termo.toLowerCase() }) })
    } catch (err) {
      avisar({ tipo: 'erro', texto: err.message })
    }
  }
  const mudar = (x, campo, v) => setEdicao({ ...edicao, [chave(x)]: { ...edicao[chave(x)], [campo]: v } })
  return (
    <div className="mb-3">
      <h6 className="fw-bold"><i className="fa fa-balance-scale me-1" />{tx('Pedidos de revisão das provas')} {pendentes > 0 && <span className="badge bg-warning text-dark">{tx('{0} por decidir', { 0: pendentes })}</span>}</h6>
      <div className="table-responsive">
        <table className="table table-sm align-middle mb-0">
          <thead><tr><th>{termo}</th><th>{tx('Prova')}</th><th>{tx('Fundamentação do pedido')}</th><th className="text-center">{tx('Nota')}</th><th>{tx('Decisão')}</th></tr></thead>
          <tbody>{lista.map((x) => (
            <tr key={chave(x)}>
              <td><b>{x.estudante.nome}</b><div className="small text-muted">{dia(x.revisao.pedidaEm)}</div></td>
              <td><span className="badge bg-dark me-1">{x.cadeira.codigo}</span>{x.avaliacao.tipo} {x.avaliacao.titulo}</td>
              <td className="small" style={{ maxWidth: 320, whiteSpace: 'pre-wrap' }}>{x.revisao.motivo}</td>
              <td className="text-center">{x.revisao.decididaEm ? <>{nota(x.revisao.notaAnterior)} → <b>{nota(x.nota)}</b></> : nota(x.nota)}</td>
              <td>{x.revisao.decididaEm
                ? <><span className={`badge ${{ subiu: 'bg-success', manteve: 'bg-secondary', baixou: 'bg-danger' }[x.revisao.decisao]}`}>{tx(x.decisaoNome)}</span><div className="small text-muted">{x.revisao.decisor} · {dia(x.revisao.decididaEm)}{x.revisao.fundamento ? ` · ${x.revisao.fundamento}` : ''}</div></>
                : decidir
                  ? <div className="d-flex flex-wrap gap-1 align-items-center">
                      <input className="form-control form-control-sm text-center" style={{ width: 70 }} inputMode="decimal" value={edicao[chave(x)]?.nota ?? String(x.nota).replace('.', ',')} onChange={(e) => mudar(x, 'nota', e.target.value)} aria-label={tx('Nota da revisão')} />
                      <input className="form-control form-control-sm" style={{ minWidth: 180, flex: 1 }} placeholder={tx('Fundamentação da decisão')} value={edicao[chave(x)]?.fundamento ?? ''} onChange={(e) => mudar(x, 'fundamento', e.target.value)} aria-label={tx('Fundamentação da decisão')} />
                      <button type="button" className="btn btn-xs btn-theme" onClick={() => decidirUm(x)}>{tx('Decidir')}</button>
                    </div>
                  : <span className="badge bg-info text-dark">{tx('Aguarda o Director de Ensino')}</span>}
              </td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  )
}

/*
  Conselho de Curso de uma turma com plano: o juízo ampliativo de cada auditor/discente (Director de Ensino),
  a proposta das classificações, a confirmação em Conselho de Curso (acta e data), o ajuste e o DISTINTO e a
  homologação (Comandante). Mostra em que passo está e só deixa fazer o passo seguinte a quem pode.
*/
export default function ConselhoCurso({ turma, avisar }) {
  const { pode } = useSessao()
  const conselho = pode('academico.conselho')
  const homologar = pode('academico.homologar')
  const [d, setD] = useState(null)
  const [juizo, setJuizo] = useState(null) // { linha, factores, texto }
  const [acta, setActa] = useState({ acta: '', dataConselho: '' })
  const [distinto, setDistinto] = useState('')
  const [ajustes, setAjustes] = useState({})
  const [motivo, setMotivo] = useState('')
  const falhou = useCallback((e) => avisar({ tipo: 'erro', texto: e.message }), [avisar])
  const base = `/academico/turmas/${turma.id}/conselho`
  const aplicar = useCallback((r) => { setD(r); setAjustes(Object.fromEntries(r.linhas.map((l) => [l.estudanteId, String(l.ajuste ?? 0)]))); setDistinto(String(r.linhas.find((l) => l.distinto)?.estudanteId ?? '')) }, [])
  useEffect(() => { api(base).then(aplicar).catch(falhou) }, [base, aplicar, falhou])
  if (!d) return <Carregando />

  const passo = PASSOS.findIndex(([k]) => k === d.conselho.estado)
  const termo = d.plano.termo === 'auditor' ? tx('Auditor') : tx('Discente')
  const fazer = (caminho, corpo, ok) => api(`${base}${caminho}`, { metodo: caminho.startsWith('/juizo') || caminho.startsWith('/ajuste') ? 'PUT' : 'POST', corpo }).then((r) => { aplicar(r); if (ok) avisar({ texto: ok }) }).catch(falhou)
  const comJuizo = d.linhas.filter((l) => l.juizoCompleto).length
  const podeDistinto = d.linhas.filter((l) => l.podeDistinto)

  return (
    <Painel titulo={<><i className="fa fa-gavel me-2" />{tx('Conselho de Curso e homologação')}</>}>
      <ol className="d-flex flex-wrap gap-2 list-unstyled mb-3">
        {PASSOS.map(([k, n], i) => <li key={k} className={`badge ${i < passo ? 'bg-success' : i === passo ? 'bg-primary' : 'bg-gray-300 text-dark'} p-2`}>{i + 1}. {tx(n)}</li>)}
      </ol>
      <div className="small text-muted mb-3">
        {d.conselho.propostaEm && <div>{tx('Proposta por {0} em {1}.', { 0: d.conselho.propostaPor, 1: dia(d.conselho.propostaEm) })}</div>}
        {d.conselho.confirmadaEm && <div>{tx('Conselho de Curso de {0} (acta n.º {1}).', { 0: dia(d.conselho.dataConselho), 1: d.conselho.acta })}</div>}
        {d.conselho.homologadaEm && <div>{tx('Homologada por {0} em {1}.', { 0: d.conselho.homologadaPor, 1: dia(d.conselho.homologadaEm) })}</div>}
        {d.conselho.estado === 'aberto' && d.conselho.observacoes && <div>{tx('Reaberta: {0}', { 0: d.conselho.observacoes })}</div>}
      </div>

      <RevisoesProvas turma={turma} decidir={conselho && d.conselho.estado === 'aberto'} termo={termo} avisar={avisar} />

      <div className="table-responsive">
        <table className="table table-sm align-middle mb-3">
          <thead><tr><th>{termo}</th><th className="text-center">{tx('Média')}</th>{d.plano.ajusteMaximo > 0 && <th className="text-center">{tx('Ajuste')}</th>}<th className="text-center">{tx('Nota final')}</th><th className="text-center">{tx('Menção')}</th><th>{tx('Juízo ampliativo')}</th><th className="text-center">{tx('Distinto')}</th></tr></thead>
          <tbody>{d.linhas.map((l) => (
            <tr key={l.estudanteId}>
              <td><b>{l.estudante.nome}</b><div className="small text-muted">{l.concluido ? tx('concluiu') : l.emFalta.slice(0, 2).join(' · ')}</div></td>
              <td className="text-center">{nota(l.media)}</td>
              {d.plano.ajusteMaximo > 0 && <td className="text-center">{homologar && d.conselho.estado === 'confirmada'
                ? <div className="d-flex gap-1 justify-content-center"><input className="form-control form-control-sm text-center" style={{ width: 70 }} value={ajustes[l.estudanteId] ?? '0'} onChange={(e) => setAjustes({ ...ajustes, [l.estudanteId]: e.target.value })} aria-label={tx('Ajuste de {0}', { 0: l.estudante.nome })} /><button type="button" className="btn btn-xs btn-white" onClick={() => fazer(`/ajuste/${l.estudanteId}`, { ajuste: ajustes[l.estudanteId] }, tx('Ajuste guardado.'))}>{tx('Guardar')}</button></div>
                : (l.ajuste ? `${l.ajuste > 0 ? '+' : ''}${nota(l.ajuste)}` : '—')}</td>}
              <td className="text-center fw-bold">{nota(l.final)}</td>
              <td className="text-center">{l.mencao ? <span className={`badge ${l.mencao === 'Reprovado' ? 'bg-danger' : 'bg-success'}`}>{l.mencao}</span> : '—'}</td>
              <td>
                {l.juizoCompleto ? <span className="badge bg-success me-1">{tx('completo')}</span> : <span className="badge bg-warning text-dark me-1">{tx('por fazer')}</span>}
                <button type="button" className="btn btn-xs btn-white" onClick={() => setJuizo({ linha: l, factores: { ...(l.juizo?.factores ?? {}) }, texto: l.juizo?.texto ?? '' })}>{conselho && ['aberto', 'proposta'].includes(d.conselho.estado) ? tx('Preencher') : tx('Ver')}</button>
              </td>
              <td className="text-center">{l.distinto ? <span className="badge bg-warning text-dark"><i className="fa fa-medal me-1" />{tx('DISTINTO')}</span> : homologar && d.conselho.estado === 'confirmada' && l.podeDistinto ? <input type="radio" name="distinto" className="form-check-input" checked={distinto === String(l.estudanteId)} onChange={() => setDistinto(String(l.estudanteId))} aria-label={tx('Distinto para {0}', { 0: l.estudante.nome })} /> : ''}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>

      {d.conselho.estado === 'aberto' && conselho && (
        <div className="d-flex flex-wrap align-items-center gap-2">
          <button type="button" className="btn btn-theme" disabled={comJuizo < d.linhas.length} onClick={() => fazer('/propor', {}, tx('Classificações propostas: as notas da turma ficam fechadas.'))}><i className="fa fa-paper-plane me-1" />{tx('Propor as classificações')}</button>
          <span className="small text-muted">{tx('Juízos ampliativos completos: {0} de {1}. A proposta fixa as classificações e fecha as notas da turma.', { 0: comJuizo, 1: d.linhas.length })}</span>
        </div>
      )}
      {d.conselho.estado === 'proposta' && conselho && (
        <div className="row g-2 align-items-end">
          <div className="col-md-3"><label className="form-label small fw-bold" htmlFor="cc-acta">{tx('N.º da acta')}</label><input id="cc-acta" className="form-control form-control-sm" value={acta.acta} onChange={(e) => setActa({ ...acta, acta: e.target.value })} /></div>
          <div className="col-md-3"><label className="form-label small fw-bold" htmlFor="cc-data">{tx('Data do Conselho de Curso')}</label><input id="cc-data" type="date" className="form-control form-control-sm" value={acta.dataConselho} onChange={(e) => setActa({ ...acta, dataConselho: e.target.value })} /></div>
          <div className="col-md-4"><button type="button" className="btn btn-theme" disabled={!acta.acta || !acta.dataConselho} onClick={() => fazer('/confirmar', acta, tx('Confirmada em Conselho de Curso.'))}><i className="fa fa-users me-1" />{tx('Confirmar em Conselho de Curso')}</button></div>
        </div>
      )}
      {d.conselho.estado === 'confirmada' && homologar && (
        <div className="d-flex flex-wrap align-items-center gap-2">
          <button type="button" className="btn btn-theme" onClick={() => fazer('/homologar', { distinto: distinto ? [Number(distinto)] : [] }, tx('Classificações homologadas.'))}><i className="fa fa-stamp me-1" />{tx('Homologar')}</button>
          {distinto && <button type="button" className="btn btn-white" onClick={() => setDistinto('')}>{tx('Sem Distinto')}</button>}
          <span className="small text-muted">{podeDistinto.length > 1 ? tx('Empate na melhor nota: escolha o DISTINTO proposto pelo Director de Ensino.') : tx('O DISTINTO só pode ir para quem concluiu com a melhor nota final.')}</span>
        </div>
      )}
      {d.conselho.estado !== 'aberto' && ((d.conselho.estado === 'homologada' && homologar) || (d.conselho.estado !== 'homologada' && conselho)) && (
        <div className="d-flex flex-wrap gap-2 align-items-center mt-3 border-top pt-3">
          <input className="form-control form-control-sm" style={{ maxWidth: 360 }} placeholder={tx('Motivo para reabrir (fica registado)')} value={motivo} onChange={(e) => setMotivo(e.target.value)} aria-label={tx('Motivo para reabrir')} />
          <button type="button" className="btn btn-sm btn-outline-danger" disabled={motivo.trim().length < 5} onClick={() => fazer('/reabrir', { motivo }, tx('Reaberta: as notas voltam a poder mudar.'))}><i className="fa fa-unlock me-1" />{tx('Reabrir')}</button>
        </div>
      )}
      {!conselho && !homologar && <div className="small text-muted">{tx('Os passos do Conselho de Curso fazem-se com os papéis «Director de Ensino» e «Comandante da ESG».')}</div>}

      {juizo && <Juizo d={d} juizo={juizo} setJuizo={setJuizo} editar={conselho && ['aberto', 'proposta'].includes(d.conselho.estado)} guardar={() => fazer(`/juizo/${juizo.linha.estudanteId}`, { factores: juizo.factores, texto: juizo.texto }, tx('Juízo ampliativo guardado.')).then(() => setJuizo(null))} />}
    </Painel>
  )
}

function Juizo({ d, juizo, setJuizo, editar, guardar }) {
  return (
    <div className="modal d-block" tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="juizo-titulo" style={{ background: 'rgba(0,0,0,.4)' }}>
      <div className="modal-dialog modal-lg modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header"><h5 className="modal-title" id="juizo-titulo">{tx('Juízo ampliativo — {0}', { 0: juizo.linha.estudante.nome })}</h5><button type="button" className="btn-close" onClick={() => setJuizo(null)} aria-label={tx('Fechar')} /></div>
          <div className="modal-body">
            <table className="table table-sm align-middle">
              <tbody>{Object.entries(d.factores).map(([k, n]) => (
                <tr key={k}>
                  <th className="fw-normal">{n}</th>
                  <td>{editar ? <select className="form-select form-select-sm" value={juizo.factores[k] ?? ''} onChange={(e) => setJuizo({ ...juizo, factores: { ...juizo.factores, [k]: e.target.value } })} aria-label={n}><option value="">—</option>{d.escala.map((x) => <option key={x} value={x}>{x}</option>)}</select> : juizo.factores[k] ?? '—'}</td>
                </tr>
              ))}</tbody>
            </table>
            <label className="form-label small fw-bold" htmlFor="juizo-texto">{tx('Apreciação')}</label>
            {editar ? <textarea id="juizo-texto" className="form-control" rows={4} maxLength={4000} value={juizo.texto} onChange={(e) => setJuizo({ ...juizo, texto: e.target.value })} /> : <p className="mb-0" style={{ whiteSpace: 'pre-wrap' }}>{juizo.texto || '—'}</p>}
          </div>
          <div className="modal-footer"><button type="button" className="btn btn-white" onClick={() => setJuizo(null)}>{tx('Fechar')}</button>{editar && <button type="button" className="btn btn-theme" onClick={guardar}>{tx('Guardar')}</button>}</div>
        </div>
      </div>
    </div>
  )
}
