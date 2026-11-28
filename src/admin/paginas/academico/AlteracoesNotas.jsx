import { useCallback, useEffect, useState } from 'react'
import { useAnoTrabalho } from '../../anoTrabalho'
import { api } from '../../api'
import { useSessao } from '../../sessaoContexto'
import { Aviso, CabecalhoPagina, Carregando, Erro, Janela, Painel } from '../../componentes/Ui'
import Exportar from '../../componentes/Exportar'
import { dataHora } from '../../formatar'
import { NOMES_COMPONENTES } from '../../../portal/regraAvaliacao'
import { t as tx } from '../../../i18n/linguas'

const ESTADOS = { pendente: ['bg-warning text-dark', tx('Por decidir')], autorizado: ['bg-primary', tx('Autorizado')], recusado: ['bg-danger', tx('Recusado')], usado: ['bg-success', tx('Nota alterada')] }
const nota = (v) => (v === null || v === undefined ? '—' : Number(v).toLocaleString('pt-PT', { maximumFractionDigits: 2 }))
const nomeProva = (p) => (p.prova ? `${p.prova.tipo} ${p.prova.titulo}` : NOMES_COMPONENTES[p.componente] ?? p.componente)

/*
  Pedidos de alteração de notas já publicadas: cada docente pede para os estudantes em causa, com o
  motivo; o Comandante autoriza ou recusa (um ou vários de uma vez). A autorização serve uma só vez.
*/
function AlteracoesNotas() {
  const { pode } = useSessao()
  const decide = pode('academico.homologar')
  const gere = pode('academico.gerir')
  const [nova, setNova] = useState(false)
  const [lista, setLista] = useState(null)
  const [erro, setErro] = useState('')
  const [estado, setEstado] = useState('pendente')
  const [escolhidos, setEscolhidos] = useState([])
  const [fundamento, setFundamento] = useState('')
  const [aviso, setAviso] = useState(null)
  // só as do ano lectivo do menu
  const { ano } = useAnoTrabalho()
  const carregar = useCallback(() => api(`/academico/alteracoes-notas${estado ? `?estado=${estado}` : ''}`).then((r) => { setErro(''); setLista(r.filter((p) => !ano || !p.cadeira?.turma?.anoLetivo || p.cadeira.turma.anoLetivo === ano)); setEscolhidos([]) }).catch((e) => setErro(e.message)), [estado, ano])
  useEffect(() => { carregar() }, [carregar])

  const pendentes = (lista ?? []).filter((p) => p.estado === 'pendente')
  const marcar = (id) => setEscolhidos((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]))
  async function decidir(decisao) {
    try {
      const r = await api('/academico/alteracoes-notas/decidir', { metodo: 'POST', corpo: { ids: escolhidos, decisao, fundamento } })
      setAviso({ texto: decisao === 'autorizar' ? tx('{0} alteração(ões) autorizada(s). O docente foi avisado.', { 0: r.decididos }) : tx('{0} pedido(s) recusado(s). O docente foi avisado.', { 0: r.decididos }) })
      setFundamento('')
      carregar()
      window.dispatchEvent(new Event('esg-pendentes'))
    } catch (e) {
      setAviso({ tipo: 'erro', texto: e.message })
    }
  }

  return (
    <>
      <CabecalhoPagina titulo={tx('Alterações de notas')} subtitulo={tx('notas já publicadas: só mudam com autorização do Comandante')} migalhas={[{ rotulo: tx('Administração Escolar') }, { rotulo: tx('Alterações de notas') }]} />
      {erro && <Erro texto={erro} onRepetir={carregar} />}
      {!decide && <div className="alert alert-info py-2"><i className="fa fa-info-circle me-2" />{tx('Só o Comandante autoriza ou recusa. Quando autoriza, a nota fica logo alterada.')}</div>}
      {gere && <div className="mb-3"><button type="button" className="btn btn-primary" onClick={() => setNova(true)}><i className="fa fa-pen me-1" />{tx('Alterar uma nota')}</button></div>}
      <Painel
        titulo={`${tx('Pedidos')}${lista ? ` (${lista.length})` : ''}`}
        corpo={false}
        acoes={lista?.length > 0 && <Exportar titulo={tx('Alterações de notas')} filtro={estado ? ESTADOS[estado][1] : ''} linhas={lista} colunas={[
          { titulo: tx('Pedido em'), valor: (p) => dataHora(p.pedidoEm) }, { titulo: tx('Cadeira'), valor: (p) => `${p.cadeira.codigo} ${p.cadeira.nome}` }, { titulo: tx('Turma'), valor: (p) => p.cadeira.turma?.nome },
          { titulo: tx('Prova'), valor: nomeProva }, { titulo: tx('Estudante'), valor: (p) => p.estudante?.nome }, { titulo: tx('Nota actual'), valor: (p) => p.notaAtual }, { titulo: tx('Nota nova'), valor: (p) => p.notaNova },
          { titulo: tx('Motivo'), valor: (p) => p.motivo }, { titulo: tx('Docente'), valor: (p) => p.docente }, { titulo: tx('Estado'), valor: (p) => ESTADOS[p.estado][1] }, { titulo: tx('Decidido por'), valor: (p) => p.decididoPor }, { titulo: tx('Fundamento'), valor: (p) => p.fundamento },
        ]} />}
      >
        <div className="panel-body pb-0 d-flex flex-wrap gap-2 align-items-center">
          <div className="btn-group btn-group-sm">
            {[['pendente', tx('Por decidir')], ['autorizado', tx('Autorizados')], ['usado', tx('Alteradas')], ['recusado', tx('Recusados')], ['', tx('Todos')]].map(([k, v]) => <button key={k} type="button" className={`btn ${estado === k ? 'btn-dark' : 'btn-white'}`} onClick={() => setEstado(k)}>{v}</button>)}
          </div>
        </div>
        {decide && pendentes.length > 0 && (
          <div className="panel-body pb-0">
            <div className="border rounded p-2 bg-light d-flex flex-wrap gap-2 align-items-center">
              <label className="form-check mb-0 me-2"><input type="checkbox" className="form-check-input" checked={escolhidos.length === pendentes.length} onChange={(e) => setEscolhidos(e.target.checked ? pendentes.map((p) => p.id) : [])} /> <span className="form-check-label small">{tx('Todos')}</span></label>
              <input className="form-control form-control-sm flex-grow-1" style={{ minWidth: 220, maxWidth: 520 }} value={fundamento} onChange={(e) => setFundamento(e.target.value)} placeholder={tx('Fundamento (obrigatório para recusar)')} aria-label={tx('Fundamento')} />
              <button type="button" className="btn btn-sm btn-success" disabled={!escolhidos.length} onClick={() => decidir('autorizar')}><i className="fa fa-check me-1" />{tx('Autorizar ({0})', { 0: escolhidos.length })}</button>
              <button type="button" className="btn btn-sm btn-danger" disabled={!escolhidos.length || !fundamento.trim()} onClick={() => decidir('recusar')}><i className="fa fa-times me-1" />{tx('Recusar ({0})', { 0: escolhidos.length })}</button>
            </div>
          </div>
        )}
        {!lista && !erro ? <Carregando /> : (
          <div className="table-responsive mt-3">
            <table className="table table-striped align-middle mb-0">
              <thead><tr>{decide && <th style={{ width: 1 }} />}<th>{tx('Estudante')}</th><th>{tx('Cadeira e prova')}</th><th className="text-center">{tx('Nota')}</th><th>{tx('Motivo do docente')}</th><th>{tx('Estado')}</th></tr></thead>
              <tbody>
                {lista?.length === 0 && <tr><td colSpan={6} className="text-center text-muted py-4">{estado === 'pendente' ? tx('Não há pedidos por decidir.') : tx('Sem pedidos.')}</td></tr>}
                {lista?.map((p) => (
                  <tr key={p.id}>
                    {decide && <td>{p.estado === 'pendente' && <input type="checkbox" className="form-check-input" checked={escolhidos.includes(p.id)} onChange={() => marcar(p.id)} aria-label={tx('Escolher o pedido de {0}', { 0: p.estudante?.nome })} />}</td>}
                    <td className="fw-bold">{p.estudante?.nome}<div className="small text-muted fw-normal">{p.estudante?.numero}</div></td>
                    <td><b>{p.cadeira.codigo}</b> {p.cadeira.nome} · {nomeProva(p)}<div className="small text-muted">{p.cadeira.turma?.nome}</div></td>
                    <td className="text-center text-nowrap">{nota(p.notaAtual)}{p.notaNova !== null && <> → <b>{nota(p.notaNova)}</b></>}</td>
                    <td>{p.motivo}<div className="small text-muted">{p.docente || tx('Administração Escolar')} · {dataHora(p.pedidoEm)}</div></td>
                    <td><span className={`badge ${ESTADOS[p.estado][0]}`}>{ESTADOS[p.estado][1]}</span>{p.decididoEm && <div className="small text-muted">{p.decididoPor} · {dataHora(p.decididoEm)}</div>}{p.fundamento && <div className="small">{p.fundamento}</div>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Painel>
      {nova && <JanelaAlterar ano={ano} decide={decide} onFechar={() => setNova(false)} onFeito={(r) => { setNova(false); setAviso({ texto: r.alterada ? tx('Nota alterada.') : tx('Pedido enviado ao Comandante. Quando ele autorizar, a nota fica alterada.') }); setEstado(r.alterada ? 'usado' : 'pendente'); carregar(); window.dispatchEvent(new Event('esg-pendentes')) }} />}
      <Aviso aviso={aviso} onFechar={() => setAviso(null)} />
    </>
  )
}

/*
  Alterar uma nota já publicada: a turma, a cadeira, a prova, o estudante, a nota nova e o motivo. Vai ao Comandante;
  quando ele autoriza, a nota muda na pauta (pedida pelo próprio Comandante, muda logo).
*/
function JanelaAlterar({ ano, decide, onFechar, onFeito }) {
  const [turmas, setTurmas] = useState(null)
  const [turmaId, setTurmaId] = useState('')
  const [cadeiras, setCadeiras] = useState([])
  const [cadeiraId, setCadeiraId] = useState('')
  const [pauta, setPauta] = useState(null)
  const [prova, setProva] = useState('')
  const [estudanteId, setEstudanteId] = useState('')
  const [notaNova, setNotaNova] = useState('')
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState('')
  const [aGravar, setAGravar] = useState(false)
  useEffect(() => { api('/academico/turmas').then((l) => setTurmas(l.filter((t) => !ano || t.anoLetivo === ano))).catch((e) => setErro(e.message)) }, [ano])
  const escolherTurma = (id) => {
    setTurmaId(id); setCadeiraId(''); setCadeiras([]); setPauta(null); setProva(''); setEstudanteId('')
    if (id) api(`/academico/turmas/${id}`).then((t) => setCadeiras(t.cadeiras ?? [])).catch((e) => setErro(e.message))
  }
  const escolherCadeira = (id) => {
    setCadeiraId(id); setPauta(null); setProva(''); setEstudanteId('')
    if (id) api(`/academico/cadeiras/${id}/pauta`).then(setPauta).catch((e) => setErro(e.message))
  }
  // as provas já publicadas (as outras corrigem-se na pauta, sem pedir)
  const esg = pauta?.modo === 'esg'
  const provas = !pauta ? [] : esg
    ? pauta.avaliacoes.filter((a) => a.publicadaEm).map((a) => ({ chave: `a${a.id}`, nome: `${a.tipo} ${a.titulo}`, nota: (l) => l.notas?.[a.id]?.nota ?? null, corpo: { avaliacaoId: a.id } }))
    : (pauta.publicadas ?? []).map((k) => ({ chave: `c${k}`, nome: NOMES_COMPONENTES[k] ?? k, nota: (l) => l[k] ?? null, corpo: { componente: k } }))
  const p = provas.find((x) => x.chave === prova)
  const linha = pauta?.linhas.find((l) => String(l.estudante.id) === String(estudanteId))
  const valida = p && linha && notaNova !== '' && Number(notaNova) >= 0 && Number(notaNova) <= 20 && motivo.trim().length >= 10
  const enviar = () => {
    setAGravar(true); setErro('')
    api('/academico/alteracoes-notas', { metodo: 'POST', corpo: { cadeiraId: Number(cadeiraId), ...p.corpo, estudanteId: linha.estudante.id, notaNova: Number(String(notaNova).replace(',', '.')), motivo: motivo.trim() } })
      .then(onFeito).catch((e) => { setErro(e.message); setAGravar(false) })
  }
  return (
    <Janela titulo={tx('Alterar uma nota')} onFechar={onFechar}
      rodape={<><button type="button" className="btn btn-white" onClick={onFechar}>{tx('Cancelar')}</button><button type="button" className="btn btn-primary" disabled={!valida || aGravar} onClick={enviar}>{decide ? tx('Alterar a nota') : tx('Enviar ao Comandante')}</button></>}>
      {erro && <div className="alert alert-danger py-2">{erro}</div>}
      {turmas === null ? <Carregando compacta /> : (
        <div className="row g-2">
          <div className="col-12"><label className="form-label small mb-0">{tx('Turma')}</label>
            <select className="form-select" value={turmaId} onChange={(e) => escolherTurma(e.target.value)}><option value="">—</option>{turmas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}</select></div>
          {turmaId && <div className="col-12"><label className="form-label small mb-0">{tx('Cadeira')}</label>
            <select className="form-select" value={cadeiraId} onChange={(e) => escolherCadeira(e.target.value)}><option value="">—</option>{cadeiras.map((c) => <option key={c.id} value={c.id}>{c.codigo} {c.nome}</option>)}</select></div>}
          {cadeiraId && !pauta && <Carregando compacta />}
          {pauta && provas.length === 0 && <div className="col-12 text-muted small">{tx('Esta cadeira ainda não tem notas publicadas: corrigem-se na pauta, sem pedir.')}</div>}
          {provas.length > 0 && <div className="col-sm-6"><label className="form-label small mb-0">{tx('Prova')}</label>
            <select className="form-select" value={prova} onChange={(e) => setProva(e.target.value)}><option value="">—</option>{provas.map((x) => <option key={x.chave} value={x.chave}>{x.nome}</option>)}</select></div>}
          {provas.length > 0 && <div className="col-sm-6"><label className="form-label small mb-0">{tx('Estudante')}</label>
            <select className="form-select" value={estudanteId} onChange={(e) => setEstudanteId(e.target.value)}><option value="">—</option>{pauta.linhas.map((l) => <option key={l.estudante.id} value={l.estudante.id}>{l.estudante.nome}</option>)}</select></div>}
          {p && linha && (
            <>
              <div className="col-sm-6"><label className="form-label small mb-0">{tx('Nota actual')}</label><div className="form-control-plaintext fw-bold">{nota(p.nota(linha))}</div></div>
              <div className="col-sm-6"><label className="form-label small mb-0">{tx('Nota nova')}</label><input type="number" min={0} max={20} step="0.01" className="form-control" value={notaNova} onChange={(e) => setNotaNova(e.target.value)} autoFocus /></div>
              <div className="col-12"><label className="form-label small mb-0">{tx('Motivo')}</label><textarea className="form-control" rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder={tx('Pelo menos 10 letras')} /></div>
            </>
          )}
        </div>
      )}
    </Janela>
  )
}

export default AlteracoesNotas
