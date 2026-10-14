import { useCallback, useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { abrirCaminho, api } from '../api'
import { Aviso, Cartao, Carregando, Erro, Titulo, Vazio } from '../componentes'
import { data, tamanho } from '../formatar'

const MIGALHA = { rotulo: 'Biblioteca', para: '/biblioteca' }

// biblioteca no portal: pesquisa no catálogo, ficha da obra (disponibilidade e leitura digital) e os meus empréstimos
function Biblioteca() {
  const { id } = useParams()
  return id ? <FichaObra id={Number(id)} /> : <Pesquisa />
}

function Disponibilidade({ o }) {
  if (!o.exemplares) return o.digital ? <span className="badge bg-success">Digital</span> : <span className="badge bg-gray-500">Sem exemplares</span>
  if (o.disponiveis) return <span className="badge bg-success">{o.disponiveis} disponível(eis)</span>
  return <span className="badge bg-warning text-dark">Emprestado{o.devolucaoPrevista ? ` · volta a ${data(o.devolucaoPrevista)}` : ''}</span>
}

function Pesquisa() {
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState(params.get('q') || '')
  const [tipo, setTipo] = useState(params.get('tipo') || '')
  const [soDigital, setSoDigital] = useState(params.get('digital') === '1')
  const [d, setD] = useState(null)
  const [erro, setErro] = useState('')
  useEffect(() => {
    const t = setTimeout(() => {
      setParams(Object.fromEntries(Object.entries({ q, tipo, digital: soDigital ? '1' : '' }).filter(([, v]) => v)), { replace: true })
      api(`/biblioteca?${new URLSearchParams({ q, tipo, soDigital: soDigital ? '1' : '' })}`).then(setD).catch((e) => setErro(e.message))
    }, 250)
    return () => clearTimeout(t)
  }, [q, tipo, soDigital, setParams])
  if (erro) return <Erro texto={erro} />
  return (
    <>
      <Titulo rotulo="Biblioteca" titulo="Biblioteca" sub="catálogo da Escola: livros, teses e trabalhos de fim de curso">
        <Link to="/biblioteca/emprestimos" className="btn btn-white"><i className="fa fa-hand-holding me-1" />Os meus empréstimos</Link>
      </Titulo>
      <Cartao corpo={false}>
        <div className="panel-body d-flex flex-wrap gap-2 align-items-center">
          <div className="input-group flex-grow-1" style={{ maxWidth: 520 }}>
            <span className="input-group-text"><i className="fa fa-search" /></span>
            <input type="search" className="form-control" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Título, autor, assunto ou ISBN" aria-label="Pesquisar no catálogo" autoFocus />
          </div>
          <select className="form-select w-auto" value={tipo} onChange={(e) => setTipo(e.target.value)} aria-label="Tipo de obra">
            <option value="">Todos os tipos</option>
            {d && Object.entries(d.tipos).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <label className="p-caixa mb-0"><input type="checkbox" checked={soDigital} onChange={(e) => setSoDigital(e.target.checked)} /> Só com versão digital</label>
        </div>
        {!d ? <Carregando /> : d.obras.length === 0 ? <div className="panel-body pt-0"><Vazio>{q || tipo || soDigital ? 'Nada encontrado. Experimente outras palavras.' : 'O catálogo ainda está vazio.'}</Vazio></div> : (
          <div className="list-group list-group-flush">
            {d.obras.map((o) => (
              <Link key={o.id} to={`/biblioteca/${o.id}`} className="list-group-item list-group-item-action d-flex gap-3 align-items-center">
                <span className="p-atividade-icone bg-lime"><i className={`fa ${o.tipo === 'tfc' || o.tipo === 'tese' ? 'fa-graduation-cap' : 'fa-book'}`} /></span>
                <span className="flex-grow-1 min-w-0">
                  <b className="d-block text-truncate">{o.titulo}{o.subtitulo && <span className="fw-normal text-muted">: {o.subtitulo}</span>}</b>
                  <span className="small text-muted">{[o.autores.join('; '), o.ano, d.tipos[o.tipo]].filter(Boolean).join(' · ')}</span>
                </span>
                {o.digital && <i className={`fa fa-file-pdf ${o.digital.podeLer ? 'text-danger' : 'text-muted'}`} title={o.digital.podeLer ? 'Pode ler no portal' : 'Digital só para docentes'} />}
                <Disponibilidade o={o} />
              </Link>
            ))}
          </div>
        )}
      </Cartao>
      {d?.regras && <p className="small text-muted">Empréstimos: até {d.regras.maximo} livros de cada vez, por {d.regras.prazoDias} dias. Levante e devolva no balcão da biblioteca.</p>}
    </>
  )
}

function FichaObra({ id }) {
  const [o, setO] = useState(null)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState(null)
  useEffect(() => { api(`/biblioteca/obras/${id}`).then(setO).catch((e) => setErro(e.message)) }, [id])
  if (erro) return <Erro texto={erro} />
  if (!o) return <Carregando />
  const ler = () => abrirCaminho(`/biblioteca/obras/${o.id}/digital`, { nome: `${o.titulo}.pdf`, ver: true }).catch((e) => setAviso({ tipo: 'erro', texto: e.message }))
  const linhas = [
    ['Autor(es)', o.autores.join('; ')], ['Editora', o.editora], ['Ano', o.ano], ['Edição', o.edicao], ['ISBN', o.isbn], ['Idioma', o.idiomas[o.idioma]],
    ['Assuntos', o.assuntos.join(' · ')], ['Cota', o.cota], ['Onde está', o.localizacoes.join('; ')],
  ].filter(([, v]) => v)
  return (
    <>
      <Titulo rotulo="Obra" titulo={o.titulo} sub={o.tipos[o.tipo]} migalhas={[MIGALHA, { rotulo: o.titulo }]} />
      <div className="row">
        <div className="col-xl-8">
          <Cartao titulo={<><i className="fa fa-book me-2" />{o.subtitulo || 'Ficha'}</>}>
            <dl className="row mb-0">
              {linhas.map(([k, v]) => <div key={k} className="col-12 d-flex border-bottom py-2"><dt className="col-4 col-md-3 text-muted fw-normal">{k}</dt><dd className="col mb-0">{v}</dd></div>)}
            </dl>
            {o.resumo && <p className="p-texto-pre mt-3 mb-0">{o.resumo}</p>}
          </Cartao>
        </div>
        <div className="col-xl-4">
          <Cartao titulo={<><i className="fa fa-map-marker-alt me-2" />Disponibilidade</>}>
            {o.exemplares ? (
              <>
                <div className="fs-4 fw-bold">{o.disponiveis} de {o.exemplares}</div>
                <div className="text-muted small mb-2">exemplar(es) na estante</div>
                {!o.disponiveis && o.devolucaoPrevista && <div className="small">Próxima devolução prevista: <b>{data(o.devolucaoPrevista)}</b></div>}
                <div className="small text-muted mt-2">Peça-o no balcão da biblioteca{o.cota ? ` (cota ${o.cota})` : ''}.</div>
              </>
            ) : <div className="text-muted">Não há exemplares em papel.</div>}
          </Cartao>
          {o.digital && (
            <Cartao titulo={<><i className="fa fa-file-pdf me-2" />Versão digital</>}>
              {o.digital.podeLer
                ? <button type="button" className="btn btn-theme w-100" onClick={ler}><i className="fa fa-book-open me-1" />Ler no navegador{o.digital.tamanho ? ` (${tamanho(o.digital.tamanho)})` : ''}</button>
                : <div className="text-muted small">A versão digital desta obra é só para docentes.</div>}
            </Cartao>
          )}
        </div>
      </div>
      <Aviso aviso={aviso} onFechar={() => setAviso(null)} />
    </>
  )
}

export function MeusEmprestimos() {
  const [d, setD] = useState(null)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState(null)
  const carregar = useCallback(() => api('/biblioteca/emprestimos').then(setD).catch((e) => setErro(e.message)), [])
  useEffect(() => { carregar() }, [carregar])
  if (erro) return <Erro texto={erro} />
  if (!d) return <Carregando />
  const renovar = (e) => api(`/biblioteca/emprestimos/${e.id}/renovar`, { metodo: 'POST' })
    .then((r) => { setD(r); setAviso({ texto: `Renovado até ${data(r.ativos.find((x) => x.id === e.id).prazo)}.` }) })
    .catch((falha) => setAviso({ tipo: 'erro', texto: falha.message }))
  return (
    <>
      <Titulo rotulo="Biblioteca" titulo="Os meus empréstimos" sub={`até ${d.regras.maximo} livros, ${d.regras.prazoDias} dias, ${d.regras.renovacoes} renovações`} migalhas={[MIGALHA, { rotulo: 'Os meus empréstimos' }]} />
      <Cartao titulo={<><i className="fa fa-hand-holding me-2" />Comigo ({d.ativos.length})</>} corpo={false}>
        {d.ativos.length === 0 ? <div className="panel-body"><Vazio>Não tem livros emprestados. <Link to="/biblioteca">Procurar no catálogo</Link></Vazio></div> : (
          <div className="list-group list-group-flush">
            {d.ativos.map((e) => (
              <div key={e.id} className={`list-group-item d-flex flex-wrap gap-3 align-items-center ${e.emAtraso ? 'list-group-item-danger' : ''}`}>
                <span className="flex-grow-1">
                  <b className="d-block">{e.exemplar.obra.titulo}</b>
                  <span className="small text-muted">{e.exemplar.codigo} · levantado a {data(e.emprestadoEm)}{e.renovacoes ? ` · renovado ${e.renovacoes}×` : ''}</span>
                </span>
                <span className="text-end">
                  <span className="d-block small text-muted">Devolver até</span>
                  <b className={e.emAtraso ? 'text-danger' : ''}>{data(e.prazo)}</b>
                  {e.emAtraso && <span className="d-block small text-danger">{e.diasAtraso} dia(s) de atraso</span>}
                </span>
                <button type="button" className="btn btn-sm btn-white" disabled={!e.podeRenovar} onClick={() => renovar(e)} title={e.podeRenovar ? 'Mais tempo, a contar de hoje' : e.emAtraso ? 'Fora do prazo: devolva na biblioteca' : 'Já renovou o máximo de vezes'}><i className="fa fa-redo me-1" />Renovar</button>
              </div>
            ))}
          </div>
        )}
      </Cartao>
      {d.historico.length > 0 && (
        <Cartao titulo={<><i className="fa fa-history me-2" />Já devolvidos</>} corpo={false}>
          <div className="list-group list-group-flush">
            {d.historico.map((e) => (
              <div key={e.id} className="list-group-item d-flex gap-3">
                <span className="flex-grow-1">{e.exemplar.obra.titulo}</span>
                <span className="small text-muted text-nowrap">{data(e.emprestadoEm)} – {data(e.devolvidoEm)}</span>
              </div>
            ))}
          </div>
        </Cartao>
      )}
      <Aviso aviso={aviso} onFechar={() => setAviso(null)} />
    </>
  )
}

export default Biblioteca
