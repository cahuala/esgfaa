import { useMemo, useState } from 'react'
import './integridade.css'

// cores das fontes (a 1.ª é a que mais coincide)
const CORES = ['#d62839', '#e07a1f', '#2a9d8f', '#3a6ea5', '#8e44ad', '#c9a227', '#6d597a', '#1b998b', '#b56576', '#457b9d', '#bc6c25', '#5f0f40']
const NIVEL_COR = { baixo: '#2a9d8f', medio: '#e09f3e', alto: '#d62839' }
const dia = (iso) => (iso ? new Date(iso).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' }) : '')

// etiqueta "IA" quando o indicador de utilização de IA é alto (50 % ou mais)
export function ChipIA({ a }) {
  if (a?.estado !== 'concluida' || a.iaPontuacao === null || a.iaPontuacao === undefined || a.iaPontuacao < 50) return null
  return <span className="o-chip ia" title="Indicador de utilização de IA (avaliar no relatório)"><i className="fa fa-robot" />{a.iaPontuacao}%</span>
}

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
  const [modo, setModo] = useState('semelhanca') // o que se assinala no texto: semelhanças ou IA
  const cor = useMemo(() => Object.fromEntries(r.fontes.map((f, k) => [f.id, CORES[k % CORES.length]])), [r.fontes])
  const numero = useMemo(() => Object.fromEntries(r.fontes.map((f, k) => [f.id, k + 1])), [r.fontes])
  const fonte = useMemo(() => Object.fromEntries(r.fontes.map((f) => [f.id, f])), [r.fontes])

  const iaParagrafos = useMemo(() => r.ia?.claude?.paragrafos?.length ? r.ia.claude.paragrafos : (r.ia?.local?.paragrafos || []).map((x) => ({ ...x, probabilidade: x.pontuacao })), [r.ia])

  // o texto partido em pedaços normais e trechos coincidentes (ou parágrafos suspeitos de IA)
  const partes = useMemo(() => {
    const l = []
    let p = 0
    if (modo === 'ia') {
      for (const x of [...iaParagrafos].sort((a, b) => a.inicio - b.inicio)) {
        if (x.inicio < p) continue
        if (x.inicio > p) l.push({ texto: r.texto.slice(p, x.inicio) })
        l.push({ texto: r.texto.slice(x.inicio, x.fim), ia: x })
        p = x.fim
      }
      if (p < r.texto.length) l.push({ texto: r.texto.slice(p) })
      return l
    }
    for (const [k, t] of [...r.trechos].sort((a, b) => a.inicio - b.inicio).entries()) {
      if (t.inicio > p) l.push({ texto: r.texto.slice(p, t.inicio) })
      l.push({ texto: r.texto.slice(t.inicio, t.fim), trecho: { ...t, k } })
      p = t.fim
    }
    if (p < r.texto.length) l.push({ texto: r.texto.slice(p) })
    return l
  }, [r.texto, r.trechos, modo, iaParagrafos])

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
            <div className="small mt-2"><Internet i={r.internet} /></div>
            <div className="small text-muted mt-2">
              <i className="fa fa-info-circle me-1" />
              Comparado com os trabalhos entregues no portal, as obras digitais da biblioteca, o repositório de referência{r.internet?.estado === 'feita' ? ' e páginas da internet' : ''}.
              {r.opcoes?.excluirCitacoes && ' Citações entre aspas'}{r.opcoes?.excluirCitacoes && r.opcoes?.excluirReferencias ? ' e a' : r.opcoes?.excluirReferencias ? ' A' : ''}{r.opcoes?.excluirReferencias && ' lista de referências'}{(r.opcoes?.excluirCitacoes || r.opcoes?.excluirReferencias) && ' não contam.'}
              {' '}A percentagem indica texto coincidente, não plágio: cabe ao docente avaliar cada trecho.
            </div>
          </div>
        </div>
      </div>

      <CartaoIA ia={r.ia} pontuacao={r.iaPontuacao} verNoTexto={() => setModo('ia')} />

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
                {f.url && <a href={f.url} target="_blank" rel="noopener noreferrer nofollow" className="d-block small text-truncate" onClick={(e) => e.stopPropagation()}><i className="fa fa-external-link-alt me-1" />{f.url.replace(/^https?:\/\//, '')}</a>}
                <div className="o-barra"><i style={{ width: `${Math.min(100, f.percentagem)}%` }} /></div>
              </span>
              <span className="p">{String(f.percentagem).replace('.', ',')}%</span>
            </button>
          ))}
        </div>
        <div className="card">
          <div className="card-header d-flex align-items-center gap-2">
            <b className="flex-grow-1"><i className="fa fa-file-alt me-2" />Texto analisado</b>
            <div className="btn-group btn-group-sm o-sem-impressao" role="group" aria-label="O que assinalar">
              <button type="button" className={`btn btn-xs ${modo === 'semelhanca' ? 'btn-dark' : 'btn-white'}`} onClick={() => setModo('semelhanca')}>Semelhanças</button>
              <button type="button" className={`btn btn-xs ${modo === 'ia' ? 'btn-dark' : 'btn-white'}`} onClick={() => { setModo('ia'); setAberto(null) }} disabled={!iaParagrafos.length} title={iaParagrafos.length ? '' : 'Nenhum parágrafo suspeito'}>IA</button>
            </div>
            {foco && modo === 'semelhanca' && <button type="button" className="btn btn-xs btn-white o-sem-impressao" onClick={() => setFoco(null)}>Mostrar todas as fontes</button>}
            <button type="button" className="btn btn-xs btn-white o-sem-impressao" onClick={() => window.print()}><i className="fa fa-print me-1" />Imprimir</button>
          </div>
          <div className="o-documento">
            {partes.map((p, k) => (p.ia ? (
              <mark key={k} className="o-ia" title={`IA: ${p.ia.probabilidade}%${p.ia.motivo ? ` — ${p.ia.motivo}` : ''}`}><sup>IA {p.ia.probabilidade}%</sup>{p.texto}</mark>
            ) : p.trecho ? (
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

function Internet({ i }) {
  if (!i?.estado || i.estado === 'sem-servico') return <span className="text-muted"><i className="fa fa-globe me-1" />Pesquisa na internet não configurada (a Escola tem de ativar a chave do Brave Search).</span>
  if (i.estado === 'desligada') return <span className="text-muted"><i className="fa fa-globe me-1" />Sem pesquisa na internet nesta análise.</span>
  return (
    <span className="text-muted">
      <i className="fa fa-globe me-1 text-primary" />Internet: {i.frases} frase(s) pesquisada(s), {i.paginas} página(s) lida(s) e comparada(s).
      {i.erro && <span className="text-warning"> Pesquisa incompleta: {i.erro}</span>}
    </span>
  )
}

// cartão da utilização de IA: indicador local e, se houver, a avaliação do Claude
function CartaoIA({ ia, pontuacao, verNoTexto }) {
  if (!ia || (!ia.local && !ia.claude)) return null
  const p = pontuacao
  const cor = p === null || p === undefined ? '#6c757d' : p >= 70 ? '#7b2cbf' : p >= 50 ? '#9d4edd' : p >= 30 ? '#c77dff' : '#2a9d8f'
  const rotulo = p === null || p === undefined ? 'Sem avaliação' : p >= 70 ? 'Forte indício de texto gerado por IA' : p >= 50 ? 'Alguns indícios de IA' : p >= 30 ? 'Poucos indícios de IA' : 'Sem indícios relevantes de IA'
  const suspeitos = ia.claude?.paragrafos?.length ?? ia.local?.paragrafos?.length ?? 0
  return (
    <div className="card mt-3 o-cartao-ia" style={{ '--o-cor': cor }}>
      <div className="card-body d-flex flex-wrap gap-4 align-items-center">
        <div className="o-ia-valor"><b>{p ?? '—'}{p !== null && p !== undefined ? '%' : ''}</b><span>IA</span></div>
        <div className="flex-grow-1" style={{ minWidth: 260 }}>
          <div className="fw-bold" style={{ color: cor }}><i className="fa fa-robot me-2" />Utilização de IA: {rotulo}</div>
          {ia.claude?.avaliacao && <p className="mb-1 mt-1">{ia.claude.avaliacao}</p>}
          <div className="small text-muted">
            {ia.claude ? <>Avaliação do Claude (Anthropic){ia.claude.parcial ? ' sobre o início do texto' : ''}. </> : ia.servico ? <>A avaliação do Claude falhou{ia.erro ? ` (${ia.erro})` : ''}; mostram-se os indicadores locais. </> : <>Indicadores locais (sem serviço externo). </>}
            {ia.local?.pontuacao !== null && ia.local?.pontuacao !== undefined && ia.claude && <>Indicadores locais: {ia.local.pontuacao}%. </>}
            Nenhum detetor é infalível: use isto como pista, falando com o estudante, e nunca como prova.
          </div>
          {ia.local?.sinais?.length > 0 && (
            <div className="mt-2 d-flex flex-wrap gap-1">{ia.local.sinais.map((s) => <span key={s.sinal} className="badge bg-light text-dark border fw-normal">{s.sinal}</span>)}</div>
          )}
        </div>
        {suspeitos > 0 && <button type="button" className="btn btn-white o-sem-impressao" onClick={verNoTexto}><i className="fa fa-highlighter me-1" />Ver {suspeitos} parágrafo(s) no texto</button>}
      </div>
    </div>
  )
}

export default Relatorio
