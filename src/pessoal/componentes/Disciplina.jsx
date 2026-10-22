import { useState } from 'react'
import { api } from '../api'
import { useSessao } from '../sessao'
import { dataPt } from '../formatar'
import { Campo, Modal } from './Ui'
import Anexo from './Anexo'
import { juntarAoProcesso } from '../anexos'

const TIPOS = {
  punicao: { nome: 'Punição disciplinar', icone: 'fa-gavel', cor: 'danger', infr: 'Infracção cometida', autoridade: 'Autoridade que aplicou' },
  condenacao: { nome: 'Condenação criminal', icone: 'fa-balance-scale', cor: 'dark', infr: 'Crime', autoridade: 'Tribunal' },
  louvor: { nome: 'Louvor', icone: 'fa-award', cor: 'success', infr: 'Motivo do louvor', autoridade: 'Quem louvou' },
  condecoracao: { nome: 'Distinção / condecoração', icone: 'fa-medal', cor: 'warning', infr: 'Distinção', autoridade: 'Entidade' },
}
const anoAtual = new Date().getFullYear()

/*
  Disciplina e assiduidade (para militares e civis, como na ficha de registo biográfico e na ficha
  disciplinar): processos disciplinares e criminais com a pena e a autoridade, louvores e distinções, as
  faltas justificadas e injustificadas de cada ano e a classificação de serviço. Tudo vai para as fichas.
*/
export default function Disciplina({ p, editar, aoMudar }) {
  const { avisar } = useSessao()
  const [novo, setNovo] = useState(null)
  const [aGravar, setAGravar] = useState(false)
  const registos = (p.eventos ?? []).filter((e) => TIPOS[e.tipo]).sort((a, b) => String(b.data).localeCompare(String(a.data)))
  const r = p.registo ?? {}
  const assid = r.assiduidade ?? []
  const classif = r.classificacoes ?? []

  async function gravarRegisto(parte) {
    setAGravar(true)
    try {
      await api(`/pessoas/${p.id}`, { metodo: 'PUT', corpo: { registo: { ...r, ...parte } } })
      avisar('Guardado.')
      aoMudar()
    } catch (e) {
      avisar(e.message, 'erro')
    } finally {
      setAGravar(false)
    }
  }
  async function apagar(e) {
    try { await api(`/pessoas/${p.id}/eventos/${e.id}`, { metodo: 'DELETE' }); avisar('Registo apagado.'); aoMudar() } catch (x) { avisar(x.message, 'erro') }
  }

  return (
    <>
      <div className="pes-bloco">
        <div className="pes-bloco-t">
          <span><i className="fa fa-gavel me-2" />Processos disciplinares, condenações, louvores e distinções</span>
          {editar && <div className="d-flex gap-1 flex-wrap">{Object.entries(TIPOS).map(([k, t]) => <button key={k} type="button" className={`btn btn-xs btn-outline-${t.cor === 'warning' ? 'secondary' : t.cor}`} onClick={() => setNovo({ tipo: k, data: new Date().toISOString().slice(0, 10), descricao: '', pena: '', entidade: '', documento: '' })}><i className={`fa ${t.icone} me-1`} />{t.nome}</button>)}</div>}
        </div>
        <div className="pes-bloco-c">
          <div className="d-flex flex-wrap gap-2 mb-3">
            <span className={`badge ${p.processoPendente ? 'bg-danger' : 'bg-success'}`}>{p.processoPendente ? 'Tem processo disciplinar ou criminal pendente' : 'Sem processo pendente'}</span>
            <span className="small text-muted">Marca-se na ficha («Editar» → Na Escola). {p.tipo === 'militar' ? 'Impede a promoção (art. 50.º).' : 'Impede a progressão na carreira.'}</span>
          </div>
          {registos.length ? (
            <div className="table-responsive">
              <table className="table table-sm align-middle mb-0">
                <thead><tr><th>Data</th><th>Tipo</th><th>Infracção / motivo</th><th>Pena</th><th>Autoridade / tribunal</th><th>Documento</th>{editar && <th />}</tr></thead>
                <tbody>{registos.map((e) => (
                  <tr key={e.id}>
                    <td className="text-nowrap">{dataPt(e.data)}</td>
                    <td><span className={`badge bg-${TIPOS[e.tipo].cor} ${TIPOS[e.tipo].cor === 'warning' ? 'text-dark' : ''}`}><i className={`fa ${TIPOS[e.tipo].icone} me-1`} />{TIPOS[e.tipo].nome}</span></td>
                    <td>{e.descricao || '—'}</td><td>{e.pena || '—'}</td><td>{e.entidade || '—'}</td><td className="small">{e.documento || '—'}</td>
                    {editar && <td className="text-end"><button type="button" className="btn btn-xs btn-outline-danger" title="Apagar" onClick={() => apagar(e)}><i className="fa fa-trash" /></button></td>}
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ) : <p className="text-muted small mb-0">Nada registado. Os registos entram na ficha disciplinar, na ficha de registo biográfico (processo disciplinar, distinções e registo criminal e disciplinar) e no PIP.</p>}
        </div>
      </div>

      <div className="row">
        <div className="col-xl-6">
          <TabelaAnos titulo="Assiduidade (faltas)" icone="fa-calendar-times" editar={editar} aGravar={aGravar} linhas={assid}
            colunas={[['ano', 'Ano', 4], ['justificadas', 'Faltas justificadas', 5], ['injustificadas', 'Faltas injustificadas', 5]]}
            aoGravar={(assiduidade) => gravarRegisto({ assiduidade })} />
        </div>
        <div className="col-xl-6">
          <TabelaAnos titulo="Classificação de serviço prestado" icone="fa-star" editar={editar} aGravar={aGravar} linhas={classif}
            colunas={[['ano', 'Ano', 4], ['ponderacao', 'Valor de ponderação', 20], ['pontos', 'Total de pontos', 20]]}
            aoGravar={(classificacoes) => gravarRegisto({ classificacoes })} />
        </div>
      </div>

      {novo && <NovoRegisto p={p} d={novo} setD={setNovo} aoFechar={() => setNovo(null)} aoGuardar={() => { setNovo(null); avisar('Registado.'); aoMudar() }} />}
    </>
  )
}

// tabela por ano (assiduidade, classificação de serviço), editável numa só vez
function TabelaAnos({ titulo, icone, linhas, colunas, editar, aGravar, aoGravar }) {
  const [rasc, setRasc] = useState(null)
  const l = rasc ?? linhas
  const mudar = (i, k, v) => setRasc(l.map((x, j) => (j === i ? { ...x, [k]: v } : x)))
  return (
    <div className="pes-bloco">
      <div className="pes-bloco-t"><span><i className={`fa ${icone} me-2`} />{titulo}</span>
        {editar && (rasc
          ? <div className="d-flex gap-1"><button type="button" className="btn btn-xs btn-white" onClick={() => setRasc(null)}>Cancelar</button><button type="button" className="btn btn-xs btn-theme" disabled={aGravar} onClick={() => { aoGravar(l.filter((x) => x.ano)); setRasc(null) }}><i className="fa fa-save me-1" />Guardar</button></div>
          : <button type="button" className="btn btn-xs btn-theme" onClick={() => setRasc([...linhas, { ano: String(anoAtual) }].sort((a, b) => String(b.ano).localeCompare(String(a.ano))))}><i className="fa fa-pen me-1" />Editar</button>)}
      </div>
      <table className="table table-sm mb-0">
        <thead><tr>{colunas.map(([k, t]) => <th key={k}>{t}</th>)}{rasc && <th />}</tr></thead>
        <tbody>
          {!l.length && <tr><td colSpan={colunas.length + 1} className="text-muted small">Nada registado.</td></tr>}
          {l.map((x, i) => (
            <tr key={i}>
              {colunas.map(([k, t, max]) => <td key={k}>{rasc ? <input className="form-control form-control-sm" value={x[k] ?? ''} maxLength={max} inputMode={k === 'ano' ? 'numeric' : undefined} aria-label={t} onChange={(e) => mudar(i, k, e.target.value)} /> : (x[k] || '—')}</td>)}
              {rasc && <td><button type="button" className="btn btn-xs btn-outline-danger" aria-label="Retirar" onClick={() => setRasc(l.filter((_, j) => j !== i))}><i className="fa fa-times" /></button></td>}
            </tr>
          ))}
        </tbody>
      </table>
      {rasc && <div className="p-2"><button type="button" className="pes-btn-juntar" onClick={() => setRasc([...l, { ano: '' }])}><i className="fa fa-plus me-1" />Juntar ano</button></div>}
    </div>
  )
}

function NovoRegisto({ p, d, setD, aoFechar, aoGuardar }) {
  const { avisar } = useSessao()
  const [erro, setErro] = useState('')
  const [ficheiro, setFicheiro] = useState(null)
  const [aGravar, setAGravar] = useState(false)
  const t = TIPOS[d.tipo]
  async function guardar() {
    setErro('')
    setAGravar(true)
    try {
      await api(`/pessoas/${p.id}/eventos`, { metodo: 'POST', corpo: d })
    } catch (e) {
      setErro(e.message)
      setAGravar(false)
      return
    }
    // o registo já ficou: se o ficheiro falhar, avisa (junta-se depois no processo individual)
    await juntarAoProcesso(p.id, ficheiro, { tipo: d.tipo === 'punicao' || d.tipo === 'condenacao' ? 'punicao' : 'louvor', titulo: `${t.nome}${d.documento ? ` — ${d.documento}` : ''}`, data: d.data }).catch((e) => avisar(`Registado, mas o documento não foi enviado: ${e.message}`, 'erro'))
    aoGuardar()
  }
  const comPena = d.tipo === 'punicao' || d.tipo === 'condenacao'
  return (
    <Modal titulo={`${t.nome} — ${p.nome}`} aoFechar={aoFechar} rodape={<><button type="button" className="btn btn-white" onClick={aoFechar}>Cancelar</button><button type="button" className="btn btn-theme" disabled={aGravar} onClick={guardar}><i className="fa fa-save me-1" />Registar</button></>}>
      {erro && <div className="alert alert-danger py-2">{erro}</div>}
      <div className="row">
        <Campo rotulo="Data" col="col-md-4"><input type="date" className="form-control form-control-sm" value={d.data} onChange={(e) => setD({ ...d, data: e.target.value })} /></Campo>
        <Campo rotulo={t.infr} obrigatorio col="col-md-8"><input className="form-control form-control-sm" value={d.descricao} maxLength={1000} onChange={(e) => setD({ ...d, descricao: e.target.value })} /></Campo>
        {comPena && <Campo rotulo={d.tipo === 'condenacao' ? 'Pena imposta' : 'Pena aplicada'} col="col-md-6"><input className="form-control form-control-sm" list="penas" value={d.pena} maxLength={300} onChange={(e) => setD({ ...d, pena: e.target.value })} /><datalist id="penas">{(d.tipo === 'punicao' ? ['Repreensão', 'Repreensão registada', 'Multa', 'Suspensão', 'Despromoção', 'Demissão'] : ['Pena de prisão', 'Pena suspensa', 'Multa']).map((x) => <option key={x} value={x} />)}</datalist></Campo>}
        <Campo rotulo={t.autoridade} col={comPena ? 'col-md-6' : 'col-md-6'}><input className="form-control form-control-sm" value={d.entidade} maxLength={150} onChange={(e) => setD({ ...d, entidade: e.target.value })} /></Campo>
        <Campo rotulo="Documento (ordem, despacho, sentença…)" col="col-md-6"><input className="form-control form-control-sm" value={d.documento} maxLength={150} onChange={(e) => setD({ ...d, documento: e.target.value })} /></Campo>
        <Campo rotulo="Documento digitalizado" col="col-12"><Anexo ficheiro={ficheiro} aoMudar={setFicheiro} /></Campo>
      </div>
    </Modal>
  )
}
