import { useMemo, useState } from 'react'
import './integridade.css'
import { t as tx, localAtual } from '../../i18n/linguas'

// cores das fontes (a 1.ª é a que mais coincide)
const CORES = ['#d62839', '#e07a1f', '#2a9d8f', '#3a6ea5', '#8e44ad', '#c9a227', '#6d597a', '#1b998b', '#b56576', '#457b9d', '#bc6c25', '#5f0f40']
const NIVEL_COR = { baixo: '#2a9d8f', medio: '#e09f3e', alto: '#d62839' }
const dia = (iso) => (iso ? new Date(iso).toLocaleString(localAtual(), { dateStyle: 'short', timeStyle: 'short' }) : '')

// etiqueta "IA" quando o indicador de utilização de IA é alto (50 % ou mais)
export function ChipIA({ a }) {
  if (a?.estado !== 'concluida' || a.iaPontuacao === null || a.iaPontuacao === undefined || a.iaPontuacao < 50) return null
  return <span className="o-chip ia" title={tx('Indicador de utilização de IA (avaliar no relatório)')}><i className="fa fa-robot" />{a.iaPontuacao}%</span>
}

// etiqueta curta com a percentagem (listas de entregas e de análises)
export function ChipOriginalidade({ a }) {
  if (!a) return <span className="o-chip cinza">—</span>
  if (a.estado === 'pendente') return <span className="o-chip cinza"><i className="fa fa-circle-notch fa-spin" />{tx('A verificar')}</span>
  if (a.estado === 'erro') return <span className="o-chip cinza" title={a.erro}><i className="fa fa-file-image" />{tx('Sem texto')}</span>
  return <span className={`o-chip ${a.nivel?.nivel}`} title={a.nivel?.rotulo}>{String(a.percentagem).replace('.', ',')}%</span>
}

function Medidor({ p, nivel }) {
  const raio = 62
  const volta = 2 * Math.PI * raio
  return (
    <div className="o-medidor" role="img" aria-label={tx('{0}% de semelhança', { 0: p })}>
      <svg viewBox="0 0 150 150"><circle className="fundo" cx="75" cy="75" r={raio} />{p > 0 && <circle className="valor" cx="75" cy="75" r={raio} stroke={NIVEL_COR[nivel]} strokeDasharray={`${(Math.min(p, 100) / 100) * volta} ${volta}`} />}</svg>
      <div className="o-medidor-texto"><b>{String(p).replace('.', ',')}%</b><span>{tx('semelhança')}</span></div>
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
    return <div className="card"><div className="o-espera"><i className="fa fa-circle-notch fa-spin d-block" /><b>{tx('A comparar o documento com o repositório…')}</b><div className="text-muted small mt-1">{tx('Demora normalmente poucos segundos. Esta página atualiza-se sozinha.')}</div></div></div>
  }
  if (r.estado === 'erro') {
    return <div className="alert alert-warning"><i className="fa fa-file-image me-2" /><b>{tx('Não foi possível analisar.')}</b> {r.erro}</div>
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
              {d.autor && <span>{tx('Autor:')} <b>{d.autor}</b></span>}
              {d.contexto && <span>{d.contexto}</span>}
              <span><b>{d.palavras.toLocaleString(localAtual())}</b> {tx('palavras')}</span>
              <span>{tx('Analisado a')} <b>{dia(r.concluidaEm)}</b></span>
              <span>{r.fontes.length} {tx('fonte(s) ·')} {r.trechos.length} {tx('trecho(s)')}</span>
            </div>
            <div className="small mt-2"><Internet i={r.internet} /></div>
            <div className="small text-muted mt-2">
              <i className="fa fa-info-circle me-1" />
              {tx('Comparado com os trabalhos entregues no portal, as obras digitais da biblioteca, o repositório de referência')}{r.internet?.estado === 'feita' ? tx(' e páginas da internet') : ''}.
              {r.opcoes?.excluirCitacoes && tx(' Citações entre aspas')}{r.opcoes?.excluirCitacoes && r.opcoes?.excluirReferencias ? tx(' e a') : r.opcoes?.excluirReferencias ? ' A' : ''}{r.opcoes?.excluirReferencias && tx(' lista de referências')}{(r.opcoes?.excluirCitacoes || r.opcoes?.excluirReferencias) && tx(' não contam.')}
              {' '}{tx('A percentagem indica texto coincidente, não plágio: cabe ao docente avaliar cada trecho.')}
            </div>
          </div>
        </div>
      </div>

      <CartaoIA ia={r.ia} pontuacao={r.iaPontuacao} verNoTexto={() => setModo('ia')} />

      <div className="o-corpo">
        <div className="card o-fontes">
          <div className="card-header fw-bold"><i className="fa fa-layer-group me-2" />{tx('Fontes coincidentes')}</div>
          {r.fontes.length === 0 && <div className="card-body text-muted small">{tx('Nenhuma coincidência com o repositório.')}</div>}
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
            <b className="flex-grow-1"><i className="fa fa-file-alt me-2" />{tx('Texto analisado')}</b>
            <div className="btn-group btn-group-sm o-sem-impressao" role="group" aria-label={tx('O que assinalar')}>
              <button type="button" className={`btn btn-xs ${modo === 'semelhanca' ? 'btn-dark' : 'btn-white'}`} onClick={() => setModo('semelhanca')}>{tx('Semelhanças')}</button>
              <button type="button" className={`btn btn-xs ${modo === 'ia' ? 'btn-dark' : 'btn-white'}`} onClick={() => { setModo('ia'); setAberto(null) }} disabled={!iaParagrafos.length} title={iaParagrafos.length ? '' : tx('Nenhum parágrafo suspeito')}>{tx('IA')}</button>
            </div>
            {foco && modo === 'semelhanca' && <button type="button" className="btn btn-xs btn-white o-sem-impressao" onClick={() => setFoco(null)}>{tx('Mostrar todas as fontes')}</button>}
            <button type="button" className="btn btn-xs btn-white o-sem-impressao" onClick={() => window.print()}><i className="fa fa-print me-1" />{tx('Imprimir')}</button>
          </div>
          <div className="o-documento">
            {partes.map((p, k) => (p.ia ? (
              <mark key={k} className="o-ia" title={`IA: ${p.ia.probabilidade}%${p.ia.motivo ? ` — ${p.ia.motivo}` : ''}`}><sup>{tx('IA')} {p.ia.probabilidade}%</sup>{p.texto}</mark>
            ) : p.trecho ? (
              <mark key={k} style={{ '--o-cor': cor[p.trecho.fonte] }} className={`${foco && foco !== p.trecho.fonte ? 'esbatido' : ''} ${aberto?.k === p.trecho.k ? 'ativo' : ''}`}
                onClick={() => setAberto(aberto?.k === p.trecho.k ? null : p.trecho)} title={tx('Fonte {0}: {1}', { 0: numero[p.trecho.fonte], 1: fonte[p.trecho.fonte]?.titulo })}>
                <sup>{numero[p.trecho.fonte]}</sup>{p.texto}
              </mark>
            ) : <span key={k}>{p.texto}</span>))}
          </div>
        </div>
      </div>

      {t && (
        <div className="o-comparar" style={{ '--o-cor': cor[t.fonte] }} role="dialog" aria-label={tx('Comparar trecho')}>
          <div className="d-flex align-items-center gap-2 px-3 pt-3">
            <b className="flex-grow-1 small">{tx('Fonte')} {numero[t.fonte]}: {fonte[t.fonte]?.titulo}<span className="d-block text-muted fw-normal">{t.palavras} {tx('palavras coincidentes')}</span></b>
            <button type="button" className="btn-close" onClick={() => setAberto(null)} aria-label={tx('Fechar')} />
          </div>
          <div className="o-comparar-corpo">
            <div><h6>{tx('Neste documento')}</h6><p>{r.texto.slice(t.inicio, t.fim)}</p></div>
            <div><h6>{tx('Na fonte')}</h6><p>{t.excerto}</p></div>
          </div>
        </div>
      )}
    </>
  )
}

function Internet({ i }) {
  if (!i?.estado || i.estado === 'sem-servico') return <span className="text-muted"><i className="fa fa-globe me-1" />{tx('Pesquisa na internet não configurada (a Escola tem de ativar a chave do Brave Search).')}</span>
  if (i.estado === 'desligada') return <span className="text-muted"><i className="fa fa-globe me-1" />{tx('Sem pesquisa na internet nesta análise.')}</span>
  return (
    <span className="text-muted">
      <i className="fa fa-globe me-1 text-primary" />{tx('Internet:')} {i.frases} {tx('frase(s) pesquisada(s),')} {i.paginas} {tx('página(s) lida(s) e comparada(s).')}
      {i.erro && <span className="text-warning"> {tx('Pesquisa incompleta:')} {i.erro}</span>}
    </span>
  )
}

// cartão da utilização de IA: indicador local e, se houver, a avaliação do Claude
function CartaoIA({ ia, pontuacao, verNoTexto }) {
  if (!ia || (!ia.local && !ia.claude)) return null
  const p = pontuacao
  const cor = p === null || p === undefined ? '#6c757d' : p >= 70 ? '#7b2cbf' : p >= 50 ? '#9d4edd' : p >= 30 ? '#c77dff' : '#2a9d8f'
  const rotulo = p === null || p === undefined ? tx('Sem avaliação') : p >= 70 ? tx('Forte indício de texto gerado por IA') : p >= 50 ? tx('Alguns indícios de IA') : p >= 30 ? tx('Poucos indícios de IA') : tx('Sem indícios relevantes de IA')
  const suspeitos = ia.claude?.paragrafos?.length ?? ia.local?.paragrafos?.length ?? 0
  return (
    <div className="card mt-3 o-cartao-ia" style={{ '--o-cor': cor }}>
      <div className="card-body d-flex flex-wrap gap-4 align-items-center">
        <div className="o-ia-valor"><b>{p ?? '—'}{p !== null && p !== undefined ? '%' : ''}</b><span>{tx('IA')}</span></div>
        <div className="flex-grow-1" style={{ minWidth: 260 }}>
          <div className="fw-bold" style={{ color: cor }}><i className="fa fa-robot me-2" />{tx('Utilização de IA:')} {rotulo}</div>
          {ia.claude?.avaliacao && <p className="mb-1 mt-1">{ia.claude.avaliacao}</p>}
          <div className="small text-muted">
            {ia.claude ? <>{tx('Avaliação do Claude (Anthropic)')}{ia.claude.parcial ? tx(' sobre o início do texto') : ''}. </> : ia.servico ? <>{tx('A avaliação do Claude falhou')}{ia.erro ? ` (${ia.erro})` : ''}{tx('; mostram-se os indicadores locais.')} </> : <>{tx('Indicadores locais (sem serviço externo).')} </>}
            {ia.local?.pontuacao !== null && ia.local?.pontuacao !== undefined && ia.claude && <>{tx('Indicadores locais:')} {ia.local.pontuacao}%. </>}
            {tx('Nenhum detetor é infalível: use isto como pista, falando com o estudante, e nunca como prova.')}
          </div>
          {ia.local?.sinais?.length > 0 && (
            <div className="mt-2 d-flex flex-wrap gap-1">{ia.local.sinais.map((s) => <span key={s.sinal} className="badge bg-light text-dark border fw-normal">{s.sinal}</span>)}</div>
          )}
        </div>
        {suspeitos > 0 && <button type="button" className="btn btn-white o-sem-impressao" onClick={verNoTexto}><i className="fa fa-highlighter me-1" />{tx('Ver')} {suspeitos} {tx('parágrafo(s) no texto')}</button>}
      </div>
    </div>
  )
}

export default Relatorio
