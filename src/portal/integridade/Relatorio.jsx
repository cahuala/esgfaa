import { useMemo, useState } from 'react'
import './integridade.css'

// cores das fontes (a 1.ª é a que mais coincide)
const CORES = ['#d62839', '#e07a1f', '#2a9d8f', '#3a6ea5', '#8e44ad', '#c9a227', '#6d597a', '#1b998b', '#b56576', '#457b9d', '#bc6c25', '#5f0f40']
const NIVEL_COR = { baixo: '#2a9d8f', medio: '#e09f3e', alto: '#d62839' }
const dia = (iso) => (iso ? new Date(iso).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' }) : '')

// etiqueta curta com a percentagem (listas de entregas e de análises)
export function ChipOriginalidade({ a }) {
  if (!a) return <span className="o-chip cinza">—</span>
  if (a.estado === 'pendente') return <span className="o-chip cinza"><i className="fa fa-circle-notch fa-spin" />A verificar</span>
  if (a.estado === 'erro') return <span className="o-chip cinza" title={a.erro}><i className="fa fa-file-image" />Sem texto</span>
  return <span className={`o-chip ${a.nivel?.nivel}`} title={a.nivel?.rotulo}>{String(a.percentagem).replace('.', ',')}%</span>
}

function Medidor({ p, nivel }) {
  const raio = 62
  const volta = 2 * Math.PI * raio
  return (
    <div className="o-medidor" role="img" aria-label={`${p}% de semelhança`}>
      <svg viewBox="0 0 150 150"><circle className="fundo" cx="75" cy="75" r={raio} />{p > 0 && <circle className="valor" cx="75" cy="75" r={raio} stroke={NIVEL_COR[nivel]} strokeDasharray={`${(Math.min(p, 100) / 100) * volta} ${volta}`} />}</svg>
      <div className="o-medidor-texto"><b>{String(p).replace('.', ',')}%</b><span>semelhança</span></div>
    </div>
  )
}

/*
  Relatório de originalidade: percentagem, fontes (cada uma com a sua cor) e o texto analisado
  com os trechos coincidentes assinalados. Clicar num trecho mostra-o lado a lado com a fonte.
*/
function Relatorio({ r }) {
  const [foco, setFoco] = useState(null) // fonte em destaque
  const [aberto, setAberto] = useState(null) // trecho a comparar
  const cor = useMemo(() => Object.fromEntries(r.fontes.map((f, k) => [f.id, CORES[k % CORES.length]])), [r.fontes])
  const numero = useMemo(() => Object.fromEntries(r.fontes.map((f, k) => [f.id, k + 1])), [r.fontes])
  const fonte = useMemo(() => Object.fromEntries(r.fontes.map((f) => [f.id, f])), [r.fontes])

  // o texto partido em pedaços normais e trechos coincidentes
  const partes = useMemo(() => {
    const l = []
    let p = 0
    for (const [k, t] of [...r.trechos].sort((a, b) => a.inicio - b.inicio).entries()) {
      if (t.inicio > p) l.push({ texto: r.texto.slice(p, t.inicio) })
      l.push({ texto: r.texto.slice(t.inicio, t.fim), trecho: { ...t, k } })
      p = t.fim
    }
    if (p < r.texto.length) l.push({ texto: r.texto.slice(p) })
    return l
  }, [r.texto, r.trechos])

  if (r.estado === 'pendente') {
    return <div className="card"><div className="o-espera"><i className="fa fa-circle-notch fa-spin d-block" /><b>A comparar o documento com o repositório…</b><div className="text-muted small mt-1">Demora normalmente poucos segundos. Esta página atualiza-se sozinha.</div></div></div>
  }
  if (r.estado === 'erro') {
    return <div className="alert alert-warning"><i className="fa fa-file-image me-2" /><b>Não foi possível analisar.</b> {r.erro}</div>
  }

  const d = r.documento
  const nivel = r.nivel?.nivel || 'baixo'
  const t = aberto
  return (
    <>
      <div className="card">
        <div className="card-body o-topo">
          <Medidor p={r.percentagem} nivel={nivel} />
          <div>
            <span className={`o-nivel ${nivel}`}><i className={`fa ${nivel === 'baixo' ? 'fa-check-circle' : nivel === 'medio' ? 'fa-search' : 'fa-exclamation-triangle'}`} />{r.nivel?.rotulo}</span>
            <h2 className="mt-2 mb-0" style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700 }}>{d.titulo}</h2>
            <div className="o-meta">
              {d.autor && <span>Autor: <b>{d.autor}</b></span>}
              {d.contexto && <span>{d.contexto}</span>}
              <span><b>{d.palavras.toLocaleString('pt-PT')}</b> palavras</span>
              <span>Analisado a <b>{dia(r.concluidaEm)}</b></span>
              <span>{r.fontes.length} fonte(s) · {r.trechos.length} trecho(s)</span>
            </div>
            <div className="small text-muted mt-2">
              <i className="fa fa-info-circle me-1" />
              Comparado com os trabalhos entregues no portal, as obras digitais da biblioteca e o repositório de referência.
              {r.opcoes?.excluirCitacoes && ' Citações entre aspas'}{r.opcoes?.excluirCitacoes && r.opcoes?.excluirReferencias ? ' e a' : r.opcoes?.excluirReferencias ? ' A' : ''}{r.opcoes?.excluirReferencias && ' lista de referências'}{(r.opcoes?.excluirCitacoes || r.opcoes?.excluirReferencias) && ' não contam.'}
              {' '}A percentagem indica texto coincidente, não plágio: cabe ao docente avaliar cada trecho.
            </div>
          </div>
        </div>
      </div>

      <div className="o-corpo">
        <div className="card o-fontes">
          <div className="card-header fw-bold"><i className="fa fa-layer-group me-2" />Fontes coincidentes</div>
          {r.fontes.length === 0 && <div className="card-body text-muted small">Nenhuma coincidência com o repositório.</div>}
          {r.fontes.map((f) => (
            <button key={f.id} type="button" className={`o-fonte ${foco === f.id ? 'ativa' : ''}`} style={{ '--o-cor': cor[f.id] }} onClick={() => setFoco(foco === f.id ? null : f.id)} aria-pressed={foco === f.id}>
              <span className="n">{numero[f.id]}</span>
              <span className="t">
                <b>{f.titulo}</b>
                <span>{[r.origens?.[f.origem], f.autor, f.contexto].filter(Boolean).join(' · ')}</span>
                <div className="o-barra"><i style={{ width: `${Math.min(100, f.percentagem)}%` }} /></div>
              </span>
              <span className="p">{String(f.percentagem).replace('.', ',')}%</span>
            </button>
          ))}
        </div>
        <div className="card">
          <div className="card-header d-flex align-items-center gap-2">
            <b className="flex-grow-1"><i className="fa fa-file-alt me-2" />Texto analisado</b>
            {foco && <button type="button" className="btn btn-xs btn-white o-sem-impressao" onClick={() => setFoco(null)}>Mostrar todas as fontes</button>}
            <button type="button" className="btn btn-xs btn-white o-sem-impressao" onClick={() => window.print()}><i className="fa fa-print me-1" />Imprimir</button>
          </div>
          <div className="o-documento">
            {partes.map((p, k) => (p.trecho ? (
              <mark key={k} style={{ '--o-cor': cor[p.trecho.fonte] }} className={`${foco && foco !== p.trecho.fonte ? 'esbatido' : ''} ${aberto?.k === p.trecho.k ? 'ativo' : ''}`}
                onClick={() => setAberto(aberto?.k === p.trecho.k ? null : p.trecho)} title={`Fonte ${numero[p.trecho.fonte]}: ${fonte[p.trecho.fonte]?.titulo}`}>
                <sup>{numero[p.trecho.fonte]}</sup>{p.texto}
              </mark>
            ) : <span key={k}>{p.texto}</span>))}
          </div>
        </div>
      </div>

      {t && (
        <div className="o-comparar" style={{ '--o-cor': cor[t.fonte] }} role="dialog" aria-label="Comparar trecho">
          <div className="d-flex align-items-center gap-2 px-3 pt-3">
            <b className="flex-grow-1 small">Fonte {numero[t.fonte]}: {fonte[t.fonte]?.titulo}<span className="d-block text-muted fw-normal">{t.palavras} palavras coincidentes</span></b>
            <button type="button" className="btn-close" onClick={() => setAberto(null)} aria-label="Fechar" />
          </div>
          <div className="o-comparar-corpo">
            <div><h6>Neste documento</h6><p>{r.texto.slice(t.inicio, t.fim)}</p></div>
            <div><h6>Na fonte</h6><p>{t.excerto}</p></div>
          </div>
        </div>
      )}
    </>
  )
}

export default Relatorio
