import { Suspense, lazy, useState } from 'react'
import DOMPurify from 'dompurify'
import { api } from '../api'
import { Cartao } from '../componentes'
import { confirmar } from '../dialogos'
import { t as tx } from '../../i18n/linguas'

const EditorPagina = lazy(() => import('./EditorPagina'))

// número de cada capítulo: 1, 2, 2.1, 2.2, 3… (os subcapítulos contam dentro do capítulo de cima)
function numeracao(capitulos) {
  let n = 0
  let s = 0
  return capitulos.map((c) => {
    if (c.sub && n > 0) { s += 1; return `${n}.${s}` }
    n += 1
    s = 0
    return String(n)
  })
}

/*
  Livro (como o do Moodle): capítulos e subcapítulos com o seu índice, para ler um a um
  ou imprimir inteiro. O docente escreve-o aqui mesmo, capítulo a capítulo.
*/
function Livro({ m, eDocente, recarregar, avisar }) {
  const [editar, setEditar] = useState(false)
  const [atual, setAtual] = useState(0)
  const capitulos = m.estrutura || []
  const numeros = numeracao(capitulos)
  const c = capitulos[Math.min(atual, capitulos.length - 1)]

  function imprimir() {
    const janela = window.open('', '_blank')
    if (!janela) return
    const corpo = capitulos.map((x, i) => `<section><h${x.sub ? 3 : 2}>${numeros[i]}. ${DOMPurify.sanitize(x.titulo)}</h${x.sub ? 3 : 2}>${DOMPurify.sanitize(x.conteudo)}</section>`).join('')
    janela.document.write(`<!doctype html><html lang="pt"><head><meta charset="utf-8"><title>${DOMPurify.sanitize(m.titulo)}</title><style>body{font:12pt/1.6 Georgia,serif;max-width:720px;margin:2cm auto;color:#111}h1{font-size:24pt}h2{margin-top:2em;page-break-before:always}section:first-of-type h2{page-break-before:avoid}img{max-width:100%}table{border-collapse:collapse}td,th{border:1px solid #999;padding:4px 8px}</style></head><body><h1>${DOMPurify.sanitize(m.titulo)}</h1>${corpo}</body></html>`)
    janela.document.close()
    janela.focus()
    janela.print()
  }

  if (editar) return <EditorLivro m={m} fechar={() => setEditar(false)} recarregar={recarregar} avisar={avisar} />
  return (
    <Cartao
      titulo={<><i className="fa fa-book me-2" />{m.titulo}</>}
      acoes={(
        <span className="d-flex gap-1">
          <button type="button" className="btn btn-xs btn-white" onClick={imprimir}><i className="fa fa-print me-1" />{tx('Imprimir o livro')}</button>
          {eDocente && <button type="button" className="btn btn-xs btn-white" onClick={() => setEditar(true)}><i className="fa fa-pen me-1" />{tx('Editar o livro')}</button>}
        </span>
      )}
    >
      {m.descricao && <p className="text-muted">{m.descricao}</p>}
      <div className="row g-4">
        <nav className="col-lg-4 col-xl-3" aria-label={tx('Índice do livro')}>
          <ol className="p-livro-indice">
            {capitulos.map((x, i) => (
              <li key={i} className={x.sub ? 'sub' : ''}>
                <button type="button" className={i === atual ? 'ativo' : ''} onClick={() => setAtual(i)} aria-current={i === atual ? 'page' : undefined}>
                  <span className="p-livro-num">{numeros[i]}</span><span>{x.titulo}</span>
                </button>
              </li>
            ))}
          </ol>
        </nav>
        <article className="col-lg-8 col-xl-9">
          {c && (
            <>
              <h2 className="h4 mb-3">{numeros[atual]}. {c.titulo}</h2>
              {c.conteudo.replace(/<[^>]*>/g, '').trim() || /<img|<iframe|<video/i.test(c.conteudo)
                ? <div className="p-programa p-livro-texto" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(c.conteudo) }} />
                : <p className="text-muted fst-italic">{tx('Este capítulo ainda não tem texto.')}</p>}
              <div className="d-flex justify-content-between gap-2 mt-4 pt-3 border-top">
                {atual > 0 ? <button type="button" className="btn btn-white" onClick={() => setAtual(atual - 1)}><i className="fa fa-arrow-left me-1" />{capitulos[atual - 1].titulo}</button> : <span />}
                {atual < capitulos.length - 1 && <button type="button" className="btn btn-theme" onClick={() => setAtual(atual + 1)}>{capitulos[atual + 1].titulo} <i className="fa fa-arrow-right ms-1" /></button>}
              </div>
            </>
          )}
        </article>
      </div>
    </Cartao>
  )
}

// docente: capítulos à esquerda (ordenar, subcapítulo, apagar) e o texto do escolhido à direita
function EditorLivro({ m, fechar, recarregar, avisar }) {
  const [capitulos, setCapitulos] = useState(() => (m.estrutura || []).map((x) => ({ ...x })))
  const [atual, setAtual] = useState(0)
  const [aGuardar, setAGuardar] = useState(false)
  const [alterado, setAlterado] = useState(false)
  const mudar = (i, campo, v) => { setAlterado(true); setCapitulos((l) => l.map((x, j) => (j === i ? { ...x, [campo]: v } : x))) }
  const mover = (i, d) => {
    const j = i + d
    if (j < 0 || j >= capitulos.length) return
    setAlterado(true)
    setCapitulos((l) => { const n = [...l]; [n[i], n[j]] = [n[j], n[i]]; return n })
    setAtual(j)
  }
  const juntar = () => { setAlterado(true); setCapitulos((l) => [...l, { titulo: tx('Capítulo {0}', { 0: l.length + 1 }), conteudo: '', sub: false }]); setAtual(capitulos.length) }
  async function apagar(i) {
    if (capitulos.length === 1) return
    if (!(await confirmar(tx('Apagar o capítulo "{0}"?', { 0: capitulos[i].titulo }), { titulo: tx('Apagar capítulo'), botao: tx('Apagar'), perigo: true }))) return
    setAlterado(true)
    setCapitulos((l) => l.filter((_, j) => j !== i))
    setAtual(Math.max(0, i - 1))
  }
  async function guardar() {
    setAGuardar(true)
    try {
      await api(`/materiais/${m.id}`, { metodo: 'PUT', corpo: { estrutura: capitulos.map((x, i) => ({ ...x, sub: i > 0 && x.sub })) } })
      avisar({ texto: tx('Livro guardado.') })
      recarregar()
      fechar()
    } catch (e) {
      avisar({ tipo: 'erro', texto: e.message })
    } finally {
      setAGuardar(false)
    }
  }
  async function sair() {
    if (alterado && !(await confirmar(tx('Sair sem guardar as alterações?'), { titulo: tx('Editar o livro'), botao: tx('Sair') }))) return
    fechar()
  }
  const c = capitulos[atual]

  return (
    <Cartao titulo={<><i className="fa fa-book me-2" />{tx('Editar o livro')}: {m.titulo}</>}>
      <div className="row g-4">
        <div className="col-lg-4">
          <ol className="p-livro-indice editar">
            {capitulos.map((x, i) => (
              <li key={i} className={x.sub ? 'sub' : ''}>
                <button type="button" className={i === atual ? 'ativo' : ''} onClick={() => setAtual(i)}><span>{x.titulo || tx('(sem título)')}</span></button>
                <span className="p-livro-acoes">
                  <button type="button" className="btn btn-xs btn-white" onClick={() => mover(i, -1)} disabled={i === 0} aria-label={tx('Subir capítulo')}><i className="fa fa-arrow-up" /></button>
                  <button type="button" className="btn btn-xs btn-white" onClick={() => mover(i, 1)} disabled={i === capitulos.length - 1} aria-label={tx('Descer capítulo')}><i className="fa fa-arrow-down" /></button>
                  <button type="button" className="btn btn-xs btn-white text-danger" onClick={() => apagar(i)} disabled={capitulos.length === 1} aria-label={tx('Apagar capítulo')}><i className="fa fa-trash-alt" /></button>
                </span>
              </li>
            ))}
          </ol>
          <button type="button" className="btn btn-sm btn-white w-100 mt-2" onClick={juntar} disabled={capitulos.length >= 100}><i className="fa fa-plus me-1" />{tx('Novo capítulo')}</button>
        </div>
        <div className="col-lg-8">
          {c && (
            <div key={atual} className="p-formulario">
              <div className="d-flex gap-2 align-items-end flex-wrap">
                <label className="flex-grow-1" htmlFor="lv-titulo"><span className="form-label fw-bold d-block mb-1">{tx('Título do capítulo')}</span>
                  <input id="lv-titulo" className="form-control" value={c.titulo} onChange={(e) => mudar(atual, 'titulo', e.target.value)} maxLength={200} />
                </label>
                {atual > 0 && <label className="p-caixa mb-2"><input type="checkbox" checked={Boolean(c.sub)} onChange={(e) => mudar(atual, 'sub', e.target.checked)} /> {tx('Subcapítulo')}</label>}
              </div>
              <Suspense fallback={<div className="text-muted small">{tx('A abrir o editor…')}</div>}>
                <EditorPagina html={c.conteudo} onChange={(h) => mudar(atual, 'conteudo', h)} aoErro={(t) => avisar({ tipo: 'erro', texto: t })} placeholder={tx('Escreva aqui o texto do capítulo…')} />
              </Suspense>
            </div>
          )}
        </div>
      </div>
      <div className="d-flex gap-2 mt-3">
        <button type="button" className="btn btn-theme" onClick={guardar} disabled={aGuardar}><i className="fa fa-save me-1" />{aGuardar ? tx('A guardar…') : tx('Guardar o livro')}</button>
        <button type="button" className="btn btn-white" onClick={sair} disabled={aGuardar}>{tx('Cancelar')}</button>
      </div>
    </Cartao>
  )
}

export default Livro
