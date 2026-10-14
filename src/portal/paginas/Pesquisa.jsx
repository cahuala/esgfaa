import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { Cartao, Carregando, Titulo, Vazio } from '../componentes'

const TIPOS = {
  cadeira: ['fa-book-open', 'Cadeiras'],
  material: ['fa-file-alt', 'Materiais'],
  trabalho: ['fa-file-signature', 'Trabalhos'],
  questionario: ['fa-question-circle', 'Questionários'],
  forum: ['fa-comments', 'Fórum'],
  glossario: ['fa-book', 'Glossário'],
  wiki: ['fa-sitemap', 'Wiki'],
  aviso: ['fa-bullhorn', 'Avisos'],
}

// realça o termo pesquisado no texto
function Realce({ texto, q }) {
  if (!q) return texto
  const i = texto.toLowerCase().indexOf(q.toLowerCase())
  if (i < 0) return texto
  return <>{texto.slice(0, i)}<mark className="p-0">{texto.slice(i, i + q.length)}</mark>{texto.slice(i + q.length)}</>
}

// pesquisa global: cadeiras, materiais, trabalhos, questionários, fórum, glossário, wiki e avisos
function Pesquisa() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') || ''
  const [campo, setCampo] = useState(q)
  const [r, setR] = useState(null)
  const [erro, setErro] = useState('')
  useEffect(() => {
    if (q.trim().length < 2) return
    let atual = true
    api(`/pesquisa?q=${encodeURIComponent(q)}`).then((x) => { if (atual) { setR(x); setErro('') } }).catch((e) => atual && setErro(e.message))
    return () => { atual = false }
  }, [q])
  const resultado = r?.q === q.trim() ? r : null
  const grupos = resultado ? Object.keys(TIPOS).map((t) => [t, resultado.resultados.filter((x) => x.tipo === t)]).filter(([, l]) => l.length) : []

  return (
    <>
      <Titulo rotulo="Pesquisa" titulo="Pesquisar no portal" sub="nas suas cadeiras: materiais, trabalhos, fórum, glossário, wiki e avisos" />
      <form className="d-flex gap-2 mb-4" onSubmit={(e) => { e.preventDefault(); setParams(campo.trim() ? { q: campo.trim() } : {}) }} role="search">
        <input className="form-control form-control-lg" value={campo} onChange={(e) => setCampo(e.target.value)} placeholder="O que procura?" aria-label="Termo a pesquisar" autoFocus />
        <button type="submit" className="btn btn-theme btn-lg"><i className="fa fa-search" /></button>
      </form>
      {erro && <div className="alert alert-danger">{erro}</div>}
      {q.trim().length >= 2 && !resultado && !erro && <Carregando texto="A pesquisar…" />}
      {resultado && resultado.total === 0 && <Vazio>Nada encontrado para "{q}".</Vazio>}
      {grupos.map(([t, lista]) => (
        <Cartao key={t} titulo={<><i className={`fa ${TIPOS[t][0]} me-2`} />{TIPOS[t][1]} ({lista.length})</>} corpo={false}>
          <div className="list-group list-group-flush">
            {lista.map((x) => (
              <Link key={`${t}-${x.id}`} to={x.ligacao} className="list-group-item list-group-item-action">
                <div className="d-flex justify-content-between gap-2">
                  <b><Realce texto={x.titulo} q={q} /></b>
                  {x.cadeira && t !== 'cadeira' && <span className="badge bg-light text-dark border flex-shrink-0">{x.cadeira.codigo}</span>}
                </div>
                {x.excerto && <div className="small text-muted"><Realce texto={x.excerto} q={q} /></div>}
              </Link>
            ))}
          </div>
        </Cartao>
      ))}
    </>
  )
}

export default Pesquisa
