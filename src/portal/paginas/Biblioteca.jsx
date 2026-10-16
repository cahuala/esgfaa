import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api, urlFicheiro } from '../api'
import { Aviso, Carregando, Erro, Titulo, Vazio } from '../componentes'
import { data, tamanho } from '../formatar'
import { confirmar } from '../dialogos'
import Capa from '../biblioteca/Capa'
import LeitorPdf from '../../leitor/LeitorPdf'
import { useSessao } from '../sessaoContexto'
import { t as tx } from '../../i18n/linguas'

const MIGALHA = { rotulo: tx('Biblioteca'), para: '/biblioteca' }
const ACADEMICOS = ['tese', 'tfc', 'monografia']

// biblioteca no portal: a sala com as estantes, a ficha de cada obra e os meus empréstimos
function Biblioteca() {
  const { id } = useParams()
  return id ? <FichaObra key={id} id={Number(id)} /> : <Sala />
}

// largura de um elemento (para saber quantos livros cabem em cada prateleira)
function useLargura() {
  const [largura, setLargura] = useState(0)
  const [no, setNo] = useState(null)
  useEffect(() => {
    if (!no) return undefined
    const o = new ResizeObserver(([e]) => setLargura(e.contentRect.width))
    o.observe(no)
    return () => o.disconnect()
  }, [no])
  return [setNo, largura]
}

function fita(o) {
  if (o.exemplares && o.disponiveis) return ['livre', tx('Disponível')]
  if (o.exemplares) return ['fora', tx('Emprestado')]
  if (o.digital) return ['digital', tx('Digital')]
  return null
}

function Livro({ o }) {
  const f = fita(o)
  return (
    <Link to={`/biblioteca/${o.id}`} className="b-livro" title={o.titulo}>
      {f && <span className={`b-fita ${f[0]}`}>{f[1]}</span>}
      <Capa o={o} />
      <div className="b-legenda"><b>{o.titulo}</b><span>{o.autores.join(', ') || '—'}</span></div>
    </Link>
  )
}

// uma prateleira com setas (ou várias prateleiras, em grelha, para resultados de pesquisa)
function Estante({ titulo, nota, obras, grelha = false }) {
  const fila = useRef(null)
  const [setSala, largura] = useLargura()
  const [pontas, setPontas] = useState([true, false])
  const medir = useCallback(() => {
    const e = fila.current
    if (e) setPontas([e.scrollLeft < 4, e.scrollLeft + e.clientWidth >= e.scrollWidth - 4])
  }, [])
  useEffect(() => { medir() }, [medir, obras, largura])
  const mover = (d) => fila.current?.scrollBy({ left: d * fila.current.clientWidth * 0.8 })
  // em grelha, parte-se a lista em filas, cada uma com a sua tábua
  const livro = largura < 700 ? 112 + 18 : 148 + 30
  const porFila = Math.max(1, Math.floor((largura - 40) / livro))
  const filas = grelha ? Array.from({ length: Math.ceil(obras.length / porFila) }, (_, k) => obras.slice(k * porFila, (k + 1) * porFila)) : [obras]
  return (
    <section className="b-estante" ref={setSala} aria-label={titulo}>
      <div className="b-estante-cabeca">
        <h2 className="b-placa mb-0">{titulo}{nota && <small>{nota}</small>}</h2>
        {!grelha && !(pontas[0] && pontas[1]) && (
          <div className="b-setas">
            <button type="button" onClick={() => mover(-1)} disabled={pontas[0]} aria-label={tx('Ver os anteriores')}><i className="fa fa-chevron-left" /></button>
            <button type="button" onClick={() => mover(1)} disabled={pontas[1]} aria-label={tx('Ver mais')}><i className="fa fa-chevron-right" /></button>
          </div>
        )}
      </div>
      {filas.map((l, k) => (
        <div key={k} className="b-prateleira">
          <div className="b-tabua" />
          <div className={`b-livros ${grelha ? 'grelha' : ''}`} ref={grelha ? undefined : fila} onScroll={grelha ? undefined : medir}>
            {l.map((o) => <Livro key={o.id} o={o} />)}
          </div>
        </div>
      ))}
    </section>
  )
}

function Sala() {
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState(params.get('q') || '')
  const tipo = params.get('tipo') || ''
  const assunto = params.get('assunto') || ''
  const [todas, setTodas] = useState(null)
  const [resultados, setResultados] = useState(null)
  const [erro, setErro] = useState('')
  useEffect(() => { api('/biblioteca').then(setTodas).catch((e) => setErro(e.message)) }, [])
  const procura = q.trim() || tipo || assunto
  useEffect(() => {
    if (!procura) return undefined
    const t = setTimeout(() => {
      api(`/biblioteca?${new URLSearchParams({ q: assunto || q.trim(), tipo })}`).then(setResultados).catch((e) => setErro(e.message))
    }, 250)
    return () => clearTimeout(t)
  }, [q, tipo, assunto, procura])
  const definir = (mud) => setParams(Object.fromEntries(Object.entries({ q: q.trim(), tipo, assunto, ...mud }).filter(([, v]) => v)), { replace: true })

  // estantes da sala: novidades, para ler já, teses e TFC, e uma por assunto
  const estantes = useMemo(() => {
    if (!todas) return []
    const l = todas.obras
    const porAssunto = new Map()
    for (const o of l) for (const a of o.assuntos) porAssunto.set(a, [...(porAssunto.get(a) || []), o])
    const assuntos = [...porAssunto].filter(([, x]) => x.length >= 2).sort((a, b) => b[1].length - a[1].length).slice(0, 6)
    return [
      [tx('Novidades'), tx('chegaram há pouco'), [...l].sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)).slice(0, 14)],
      [tx('Para ler já'), tx('versão digital no portal'), l.filter((o) => o.digital?.podeLer)],
      [tx('Teses e trabalhos de fim de curso'), tx('produção da Escola'), l.filter((o) => ACADEMICOS.includes(o.tipo))],
      ...assuntos.map(([a, x]) => [a, tx('{0} obras', { 0: x.length }), x]),
      [tx('Todo o acervo'), tx('por ordem alfabética'), l],
    ].filter(([, , x]) => x.length)
  }, [todas])
  const assuntos = useMemo(() => {
    const c = new Map()
    for (const o of todas?.obras || []) for (const a of o.assuntos) c.set(a, (c.get(a) || 0) + 1)
    return [...c].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([a]) => a)
  }, [todas])

  if (erro) return <Erro texto={erro} />
  if (!todas) return <Carregando />
  const obras = todas.obras
  return (
    <div className="b-sala">
      <header className="b-entrada">
        <div className="b-entrada-rotulo">{tx('Biblioteca · Escola Superior de Guerra')}</div>
        <h1>{tx('Escolha o seu próximo livro')}</h1>
        <p>{tx('Percorra as estantes, abra a ficha de cada obra, leia no portal o que tem versão digital e reserve o que quer levantar no balcão.')}</p>
        <form className="b-procura" role="search" onSubmit={(e) => { e.preventDefault(); definir({ assunto: '' }) }}>
          <i className="fa fa-search" />
          <input type="search" value={q} onChange={(e) => { setQ(e.target.value); if (assunto) definir({ assunto: '', q: e.target.value }) }} placeholder={tx('Título, autor, assunto ou ISBN')} aria-label={tx('Procurar no catálogo')} />
          <select value={tipo} onChange={(e) => definir({ tipo: e.target.value })} aria-label={tx('Tipo de obra')}>
            <option value="">{tx('Tudo')}</option>
            {Object.entries(todas.tipos).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </form>
        <div className="b-numeros">
          <div><b>{obras.length}</b>{tx('obras')}</div>
          <div><b>{obras.reduce((t, o) => t + o.disponiveis, 0)}</b>{tx('exemplares na estante')}</div>
          <div><b>{obras.filter((o) => o.digital?.podeLer).length}</b>{tx('para ler no portal')}</div>
          <Link to="/biblioteca/emprestimos" className="ms-auto align-self-end btn btn-sm" style={{ background: '#e0b354', color: '#20160b', fontWeight: 600 }}><i className="fa fa-bookmark me-1" />{tx('Os meus empréstimos e reservas')}</Link>
        </div>
        {assuntos.length > 0 && (
          <div className="b-assuntos">
            {assuntos.map((a) => <button key={a} type="button" className={`b-assunto ${assunto === a ? 'ativo' : ''}`} onClick={() => { setQ(''); definir({ assunto: assunto === a ? '' : a, q: '' }) }}>{a}</button>)}
          </div>
        )}
      </header>

      {procura ? (
        !resultados ? <Carregando /> : resultados.obras.length === 0
          ? <section className="b-estante"><div className="b-vazio-estante"><i className="fa fa-book-open me-2" />{tx('Nenhuma obra encontrada. Experimente outras palavras ou')} <button type="button" className="btn btn-link p-0 align-baseline" onClick={() => { setQ(''); setParams({}) }}>{tx('volte às estantes')}</button>.</div></section>
          : <Estante grelha titulo={assunto || (q.trim() ? `«${q.trim()}»` : todas.tipos[tipo])} nota={tx('{0} obra(s)', { 0: resultados.obras.length })} obras={resultados.obras} />
      ) : obras.length === 0 ? <Vazio>{tx('A biblioteca ainda não tem obras no catálogo.')}</Vazio> : (
        estantes.map(([t, n, l]) => <Estante key={t} titulo={t} nota={n} obras={l} />)
      )}
      {todas.regras && <p className="small text-muted">{tx('Pode ter até')} {todas.regras.maximo} {tx('livros de cada vez, por')} {todas.regras.prazoDias} {tx('dias. Levanta-se e devolve-se no balcão da biblioteca.')}</p>}
    </div>
  )
}

function FichaObra({ id }) {
  const [o, setO] = useState(null)
  const [relacionadas, setRelacionadas] = useState([])
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState(null)
  const navegar = useNavigate()
  const [aEnviar, setAEnviar] = useState(false)
  const carregar = useCallback(() => api(`/biblioteca/obras/${id}`).then((x) => {
    setO(x)
    if (x.assuntos[0]) api(`/biblioteca?${new URLSearchParams({ q: x.assuntos[0] })}`).then((r) => setRelacionadas(r.obras.filter((y) => y.id !== x.id))).catch(() => {})
  }).catch((e) => setErro(e.message)), [id])
  useEffect(() => { carregar() }, [carregar])
  if (erro) return <Erro texto={erro} />
  if (!o) return <Carregando />

  async function reservar() {
    setAEnviar(true)
    try {
      await api(`/biblioteca/obras/${o.id}/reserva`, { metodo: 'POST' })
      setAviso({ texto: tx('Reservado. A biblioteca avisa-o quando o livro estiver separado para levantar.') })
      carregar()
    } catch (e) {
      setAviso({ tipo: 'erro', texto: e.message })
    } finally {
      setAEnviar(false)
    }
  }
  async function cancelar() {
    if (!(await confirmar(tx('Cancelar a reserva de "{0}"?', { 0: o.titulo }), { titulo: tx('Cancelar reserva'), botao: tx('Cancelar reserva'), perigo: true }))) return
    await api(`/biblioteca/reservas/${o.minhaReserva.id}`, { metodo: 'DELETE' }).then(() => { setAviso({ texto: tx('Reserva cancelada.') }); carregar() }).catch((e) => setAviso({ tipo: 'erro', texto: e.message }))
  }

  const r = o.minhaReserva
  const [cor, estado, nota] = o.comigo ? ['#3d5a80', tx('Está consigo'), tx('Devolva até {0}.', { 0: data(o.comigo.prazo) })]
    : r?.estado === 'pronta' ? ['#9b2226', tx('Pronto a levantar'), tx('Separado para si: levante-o no balcão até {0}.', { 0: data(r.levantarAte) })]
      : r ? ['#b5651d', tx('Reservado'), tx('A biblioteca vai separar um exemplar e avisá-lo no portal.')]
        : o.disponiveis ? ['#2a9d8f', tx('{0} de {1} na estante', { 0: o.disponiveis, 1: o.exemplares }), o.localizacoes.length ? tx('Onde está: {0}{1}', { 0: o.localizacoes.join('; '), 1: o.cota ? ` · cota ${o.cota}` : '' }) : tx('Cota {0}', { 0: o.cota || '—' })]
          : o.exemplares ? ['#b5651d', tx('Todos os exemplares estão emprestados'), o.devolucaoPrevista ? tx('Próxima devolução prevista a {0}. Reserve para ser o próximo.', { 0: data(o.devolucaoPrevista) }) : tx('Reserve para ser o próximo.')]
            : ['#6c757d', tx('Sem exemplares em papel'), o.digital ? tx('Esta obra existe só em versão digital.') : '']
  const detalhes = [[tx('Tipo'), o.tipos[o.tipo]], [tx('Editora'), o.editora], [tx('Ano'), o.ano], [tx('Edição'), o.edicao], ['ISBN', o.isbn], [tx('Idioma'), o.idiomas[o.idioma]], [tx('Cota'), o.cota]].filter(([, v]) => v)

  return (
    <div className="b-sala">
      <ol className="breadcrumb mb-3">
        <li className="breadcrumb-item"><Link to="/">{tx('Portal')}</Link></li>
        <li className="breadcrumb-item"><Link to="/biblioteca">{tx('Biblioteca')}</Link></li>
        <li className="breadcrumb-item active">{o.titulo}</li>
      </ol>
      <div className="b-ficha">
        <div className="b-ficha-livro"><div className="b-livro3d"><Capa o={o} /></div></div>
        <div>
          <h1>{o.titulo}</h1>
          {o.subtitulo && <div className="b-ficha-sub">{o.subtitulo}</div>}
          <div className="b-ficha-autores">{o.autores.length ? <>{tx('de')} <b>{o.autores.join(', ')}</b></> : <span className="text-muted">{tx('Autor não indicado')}</span>}</div>

          <div className="b-estado">
            <span className="ponto" style={{ background: cor }} />
            <div><b className="d-block">{estado}</b><span className="small text-muted">{nota}</span></div>
          </div>
          <div className="b-ficha-acoes">
            {o.digital?.podeLer && <button type="button" className="btn btn-lg btn-theme" onClick={() => navegar(`/biblioteca/${o.id}/ler`)}><i className="fa fa-book-open me-2" />{tx('Ler agora')}{o.digital.tamanho ? <small className="ms-2 opacity-75">{tx('PDF ·')} {tamanho(o.digital.tamanho)}</small> : null}</button>}
            {o.exemplares > 0 && !o.comigo && !r && <button type="button" className={`btn btn-lg ${o.digital?.podeLer ? 'btn-white' : 'btn-theme'}`} onClick={reservar} disabled={aEnviar}><i className="fa fa-bookmark me-2" />{aEnviar ? tx('A reservar…') : o.disponiveis ? tx('Reservar para levantar') : tx('Reservar (ser o próximo)')}</button>}
            {r && <button type="button" className="btn btn-white" onClick={cancelar}><i className="fa fa-times me-1" />{tx('Cancelar reserva')}</button>}
            {o.digital && !o.digital.podeLer && <span className="small text-muted"><i className="fa fa-lock me-1" />{tx('A versão digital é só para docentes.')}</span>}
          </div>

          <dl className="b-detalhes mb-0">
            {detalhes.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
          </dl>
          {o.resumo && <p className="b-resumo">{o.resumo}</p>}
          {o.assuntos.length > 0 && (
            <div className="mt-3">
              {o.assuntos.map((a) => <Link key={a} className="b-chip" to={`/biblioteca?${new URLSearchParams({ assunto: a })}`}><i className="fa fa-tag me-1 opacity-50" />{a}</Link>)}
            </div>
          )}
        </div>
      </div>
      {relacionadas.length > 0 && <div className="mt-5"><Estante titulo={tx('Na mesma estante')} nota={o.assuntos[0]} obras={relacionadas} /></div>}
      <Aviso aviso={aviso} onFechar={() => setAviso(null)} />
    </div>
  )
}

const ESTADO_RESERVA = { pendente: ['bg-warning text-dark', tx('À espera')], pronta: ['bg-danger', tx('Pronto a levantar')] }

/*
  Ler uma obra da biblioteca no portal, como uma página web: as páginas seguem-se no ecrã.
  Lê-se e não se leva — sem descarregar, imprimir nem copiar, com o nome de quem lê em cada página.
*/
export function LerObra() {
  const { id } = useParams()
  const { conta } = useSessao()
  const [o, setO] = useState(null)
  const [url, setUrl] = useState(null)
  const [erro, setErro] = useState('')
  useEffect(() => {
    let criado = null
    api(`/biblioteca/obras/${id}`).then(setO).catch((e) => setErro(e.message))
    urlFicheiro(`/biblioteca/obras/${id}/digital`).then((u) => { criado = u; setUrl(u) }).catch((e) => setErro(e.message))
    return () => { if (criado) URL.revokeObjectURL(criado) }
  }, [id])
  if (erro) return <Erro texto={erro} />
  if (!o || !url) return <Carregando />
  return (
    <div className="b-ler">
      <Titulo migalhas={[MIGALHA, { rotulo: o.titulo, para: `/biblioteca/${o.id}` }]} rotulo={tx('A ler')} titulo={o.titulo} sub={o.autores?.join(', ')}>
        <Link to={`/biblioteca/${o.id}`} className="btn btn-white"><i className="fa fa-arrow-left me-1" />{tx('Voltar à ficha')}</Link>
      </Titulo>
      <p className="small text-muted"><i className="fa fa-lock me-1" />{tx('Esta obra lê-se aqui, no portal: não se descarrega, não se imprime nem se copia.')}</p>
      <LeitorPdf key={url} fonte={url} titulo={o.titulo} protegido marca={`${conta.nome} · ${tx('Biblioteca da Escola Superior de Guerra')}`} />
    </div>
  )
}

export function MeusEmprestimos() {
  const [d, setD] = useState(null)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState(null)
  const [agora] = useState(() => Date.now())
  const carregar = useCallback(() => api('/biblioteca/emprestimos').then(setD).catch((e) => setErro(e.message)), [])
  useEffect(() => { carregar() }, [carregar])
  if (erro) return <Erro texto={erro} />
  if (!d) return <Carregando />
  const falhou = (falha) => setAviso({ tipo: 'erro', texto: falha.message })
  const renovar = (e) => api(`/biblioteca/emprestimos/${e.id}/renovar`, { metodo: 'POST' })
    .then((r) => { setD(r); setAviso({ texto: tx('Renovado até {0}.', { 0: data(r.ativos.find((x) => x.id === e.id).prazo) }) }) }).catch(falhou)
  async function cancelar(r) {
    if (!(await confirmar(tx('Cancelar a reserva de "{0}"?', { 0: r.obra.titulo }), { titulo: tx('Cancelar reserva'), botao: tx('Cancelar reserva'), perigo: true }))) return
    await api(`/biblioteca/reservas/${r.id}`, { metodo: 'DELETE' }).then(setD).catch(falhou)
  }
  return (
    <div className="b-sala">
      <Titulo rotulo={tx('Biblioteca')} titulo={tx('Os meus livros')} sub={tx('até {0} livros por {1} dias · {2} renovações · {3} reservas', { 0: d.regras.maximo, 1: d.regras.prazoDias, 2: d.regras.renovacoes, 3: d.regras.reservas })} migalhas={[MIGALHA, { rotulo: tx('Os meus livros') }]}>
        <Link to="/biblioteca" className="btn btn-white"><i className="fa fa-book-reader me-1" />{tx('Ir às estantes')}</Link>
      </Titulo>
      <div className="row">
        <div className="col-xl-8">
          <div className="card mb-4">
            <div className="card-header fw-bold"><i className="fa fa-book me-2" />{tx('Comigo (')}{d.ativos.length})</div>
            {d.ativos.length === 0 ? <div className="card-body"><Vazio>{tx('Não tem livros emprestados.')} <Link to="/biblioteca">{tx('Escolha um nas estantes')}</Link>.</Vazio></div> : d.ativos.map((e) => {
              const total = new Date(e.prazo) - new Date(e.emprestadoEm)
              const passou = Math.min(1, Math.max(0, (agora - new Date(e.emprestadoEm)) / total))
              const dias = Math.ceil((new Date(e.prazo) - agora) / 86_400_000)
              return (
                <div key={e.id} className="b-emprestimo">
                  <Link to={`/biblioteca/${e.exemplar.obra.id}`}><Capa o={{ id: e.exemplar.obra.id, titulo: e.exemplar.obra.titulo, autores: e.exemplar.obra.autores, capa: e.exemplar.obra.capa, tipo: e.exemplar.obra.tipo }} /></Link>
                  <div>
                    <Link to={`/biblioteca/${e.exemplar.obra.id}`} className="fw-bold text-body fs-15px">{e.exemplar.obra.titulo}</Link>
                    <div className="small text-muted">{e.exemplar.obra.autores.join(', ')} {tx('· exemplar')} {e.exemplar.codigo}{e.renovacoes ? tx(' · renovado {0}×', { 0: e.renovacoes }) : ''}</div>
                    <div className="b-prazo"><i style={{ width: `${passou * 100}%`, background: e.emAtraso ? '#9b2226' : dias <= 3 ? '#e09f3e' : '#2a9d8f' }} /></div>
                    <div className={`small mt-1 ${e.emAtraso ? 'text-danger fw-bold' : ''}`}>{e.emAtraso ? tx('{0} dia(s) de atraso: devolva na biblioteca', { 0: e.diasAtraso }) : tx('Devolver até {0} · faltam {1} dia(s)', { 0: data(e.prazo), 1: dias })}</div>
                  </div>
                  <button type="button" className="btn btn-white" disabled={!e.podeRenovar} onClick={() => renovar(e)} title={e.podeRenovar ? tx('Mais tempo, a contar de hoje') : e.emAtraso ? tx('Fora do prazo: devolva na biblioteca') : tx('Ainda não dá mais tempo, ou já renovou o máximo')}><i className="fa fa-redo me-1" />{tx('Renovar')}</button>
                </div>
              )
            })}
          </div>
          {d.historico.length > 0 && (
            <div className="card mb-4">
              <div className="card-header fw-bold"><i className="fa fa-history me-2" />{tx('Já li')}</div>
              <div className="list-group list-group-flush">
                {d.historico.map((e) => (
                  <Link key={e.id} to={`/biblioteca/${e.exemplar.obra.id}`} className="list-group-item list-group-item-action d-flex gap-3">
                    <span className="flex-grow-1">{e.exemplar.obra.titulo}</span>
                    <span className="small text-muted text-nowrap">{data(e.emprestadoEm)} – {data(e.devolvidoEm)}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="col-xl-4">
          <div className="card mb-4">
            <div className="card-header fw-bold"><i className="fa fa-bookmark me-2" />{tx('Reservas (')}{d.reservas.length})</div>
            {d.reservas.length === 0 ? <div className="card-body small text-muted">{tx('Não tem reservas. Na ficha de cada livro pode reservá-lo para o levantar no balcão.')}</div> : d.reservas.map((r) => (
              <div key={r.id} className="b-emprestimo" style={{ gridTemplateColumns: '56px 1fr' }}>
                <Link to={`/biblioteca/${r.obra.id}`}><Capa o={r.obra} /></Link>
                <div>
                  <Link to={`/biblioteca/${r.obra.id}`} className="fw-bold text-body">{r.obra.titulo}</Link>
                  <div className="my-1"><span className={`badge ${ESTADO_RESERVA[r.estado][0]}`}>{ESTADO_RESERVA[r.estado][1]}</span></div>
                  <div className="small text-muted">{r.estado === 'pronta' ? tx('Levante no balcão até {0}.', { 0: data(r.levantarAte) }) : tx('Pedida a {0}.', { 0: data(r.criadaEm) })}</div>
                  <button type="button" className="btn btn-link btn-sm p-0 text-danger" onClick={() => cancelar(r)}>{tx('Cancelar')}</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <Aviso aviso={aviso} onFechar={() => setAviso(null)} />
    </div>
  )
}

export default Biblioteca
