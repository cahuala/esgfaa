import { Suspense, lazy, useCallback, useEffect, useState } from 'react'
import DOMPurify from 'dompurify'
import { api } from '../api'
import { Cartao, Carregando, Vazio } from '../componentes'
import { dataHora } from '../formatar'
import { confirmar } from '../dialogos'
import { t as tx } from '../../i18n/linguas'

const EditorPagina = lazy(() => import('./EditorPagina'))
const escapar = (t) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

// [[Título]] no texto vira ligação para outra página da wiki (a criar, se ainda não existir)
function comLigacoes(html, titulos) {
  return DOMPurify.sanitize(html).replace(/\[\[([^\]<>]{1,120})\]\]/g, (_, t) => {
    const titulo = t.trim()
    const existe = titulos.has(titulo.toLowerCase())
    return `<a href="#" data-wiki="${escapar(titulo)}" class="${existe ? '' : 'p-wiki-nova'}">${escapar(titulo)}</a>`
  })
}

/*
  Wiki da cadeira: páginas escritas por todos, com histórico de versões.
  O docente repõe versões antigas e apaga páginas.
*/
function Wiki({ c, eDocente, avisar }) {
  const [paginas, setPaginas] = useState(null)
  const [aberta, setAberta] = useState(null) // id
  const [nova, setNova] = useState(null) // título da página a criar
  const falhou = useCallback((e) => avisar({ tipo: 'erro', texto: e.message }), [avisar])
  const carregar = useCallback(() => api(`/cadeiras/${c.id}/wiki`).then(setPaginas).catch(falhou), [c.id, falhou])
  useEffect(() => { carregar() }, [carregar])
  if (!paginas) return <Carregando />

  const titulos = new Set(paginas.map((p) => p.titulo.toLowerCase()))
  function irPara(titulo) {
    const p = paginas.find((x) => x.titulo.toLowerCase() === titulo.toLowerCase())
    if (p) { setNova(null); setAberta(p.id) } else { setAberta(null); setNova(titulo) }
  }

  return (
    <div className="row">
      <div className="col-xl-3">
        <Cartao titulo={<><i className="fa fa-sitemap me-2" />{tx('Páginas')}</>} corpo={false}>
          <div className="list-group list-group-flush">
            {paginas.map((p) => (
              <button key={p.id} type="button" className={`list-group-item list-group-item-action text-start ${aberta === p.id ? 'active' : ''}`} onClick={() => { setNova(null); setAberta(p.id) }}>
                <span className="d-block fw-bold">{p.titulo}</span>
                <span className="small opacity-75">{dataHora(p.atualizadaEm)} · {p.versoes} {tx('versão(ões)')}</span>
              </button>
            ))}
            <button type="button" className="list-group-item list-group-item-action text-theme" onClick={() => { setAberta(null); setNova(paginas.length ? '' : tx('Página inicial')) }}><i className="fa fa-plus me-1" />{tx('Nova página')}</button>
          </div>
        </Cartao>
      </div>
      <div className="col-xl-9">
        {nova !== null ? (
          <Editar c={c} titulo={nova} avisar={avisar} feito={(p) => { setNova(null); carregar(); setAberta(p.id) }} cancelar={() => setNova(null)} />
        ) : aberta ? (
          <Pagina key={aberta} id={aberta} eDocente={eDocente} titulos={titulos} irPara={irPara} avisar={avisar} mudou={carregar} apagada={() => { setAberta(null); carregar() }} />
        ) : (
          <Vazio>{paginas.length ? tx('Escolha uma página à esquerda.') : tx('A wiki está vazia. Crie a página inicial: todos os participantes podem escrever e melhorar o texto.')}</Vazio>
        )}
      </div>
    </div>
  )
}

function Pagina({ id, eDocente, titulos, irPara, avisar, mudou, apagada }) {
  const [p, setP] = useState(null)
  const [versao, setVersao] = useState(null)
  const [editar, setEditar] = useState(false)
  const [historico, setHistorico] = useState(false)
  const falhou = useCallback((e) => avisar({ tipo: 'erro', texto: e.message }), [avisar])
  const carregar = useCallback((v) => api(`/wiki/${id}${v ? `?versao=${v}` : ''}`).then(setP).catch(falhou), [id, falhou])
  useEffect(() => { carregar(versao) }, [carregar, versao])
  if (!p) return <Carregando />

  const antiga = p.versao.id !== p.atual
  const clicar = (e) => {
    const a = e.target.closest('a[data-wiki]')
    if (a) { e.preventDefault(); irPara(a.dataset.wiki) }
  }
  const repor = () => api(`/wiki/${id}/restaurar`, { metodo: 'POST', corpo: { versaoId: p.versao.id } }).then((r) => { setVersao(null); setP(r); avisar({ texto: tx('Versão reposta.') }); mudou() }).catch(falhou)
  const apagar = async () => (await confirmar(tx('Apagar a página "{0}" e todas as versões?', { 0: p.titulo }), { titulo: tx('Apagar página'), botao: tx('Apagar'), perigo: true })) && api(`/wiki/${id}`, { metodo: 'DELETE' }).then(apagada).catch(falhou)

  if (editar) return <Editar pagina={p} avisar={avisar} feito={(r) => { setEditar(false); setVersao(null); setP(r); mudou() }} cancelar={() => setEditar(false)} />
  return (
    <>
      <Cartao
        titulo={<><i className="fa fa-file-alt me-2" />{p.titulo}</>}
        acoes={(
          <>
            {!antiga && <button type="button" className="btn btn-xs btn-white me-1" onClick={() => setEditar(true)}><i className="fa fa-pen me-1" />{tx('Editar')}</button>}
            <button type="button" className="btn btn-xs btn-white me-1" onClick={() => setHistorico(!historico)}><i className="fa fa-history me-1" />{tx('Histórico')}</button>
            {eDocente && <button type="button" className="btn btn-xs btn-danger" onClick={apagar} aria-label={tx('Apagar página')}><i className="fa fa-trash-alt" /></button>}
          </>
        )}
      >
        {antiga && (
          <div className="alert alert-warning d-flex align-items-center gap-2">
            <span className="flex-grow-1">{tx('Está a ver a versão de')} {dataHora(p.versao.criadaEm)} ({p.versao.autor.nome}).</span>
            {eDocente && <button type="button" className="btn btn-sm btn-theme" onClick={repor}>{tx('Repor esta versão')}</button>}
            <button type="button" className="btn btn-sm btn-white" onClick={() => setVersao(null)}>{tx('Ver a atual')}</button>
          </div>
        )}
        <div className="p-programa" onClick={clicar} dangerouslySetInnerHTML={{ __html: comLigacoes(p.versao.conteudo, titulos) }} />
        <div className="small text-muted mt-3">{tx('Última alteração:')} {p.versoes[0].autor.nome}, {dataHora(p.versoes[0].criadaEm)}</div>
      </Cartao>
      {historico && (
        <Cartao titulo={<><i className="fa fa-history me-2" />{tx('Versões (')}{p.versoes.length})</>} corpo={false}>
          <div className="list-group list-group-flush">
            {p.versoes.map((v, i) => (
              <button key={v.id} type="button" className={`list-group-item list-group-item-action text-start ${v.id === p.versao.id ? 'active' : ''}`} onClick={() => setVersao(i === 0 ? null : v.id)}>
                <b>{dataHora(v.criadaEm)}</b> · {v.autor.nome}{i === 0 && ' (atual)'}
                {v.resumo && <span className="d-block small opacity-75">{v.resumo}</span>}
              </button>
            ))}
          </div>
        </Cartao>
      )}
    </>
  )
}

function Editar({ c, pagina, titulo: tituloInicial = '', avisar, feito, cancelar }) {
  const [titulo, setTitulo] = useState(pagina?.titulo || tituloInicial)
  const [html, setHtml] = useState(pagina?.versao.conteudo || '')
  const [resumo, setResumo] = useState('')
  const [aGuardar, setAGuardar] = useState(false)
  async function guardar() {
    setAGuardar(true)
    try {
      const r = pagina
        ? await api(`/wiki/${pagina.id}`, { metodo: 'PUT', corpo: { conteudo: html, base: pagina.atual, resumo } })
        : await api(`/cadeiras/${c.id}/wiki`, { metodo: 'POST', corpo: { titulo, conteudo: html } })
      avisar({ texto: tx('Página guardada.') })
      feito(r)
    } catch (e) {
      avisar({ tipo: 'erro', texto: e.message })
    } finally {
      setAGuardar(false)
    }
  }
  return (
    <Cartao titulo={<><i className="fa fa-pen me-2" />{pagina ? `Editar: ${pagina.titulo}` : tx('Nova página')}</>}>
      {!pagina && <div className="mb-3"><label className="form-label fw-bold" htmlFor="w-titulo">{tx('Título')}</label><input id="w-titulo" className="form-control" value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={120} /></div>}
      <p className="small text-muted">{tx('Para ligar a outra página, escreva o título entre parêntesis retos duplos, por exemplo [[Capítulo 1]]. Se a página não existir, a ligação serve para a criar.')}</p>
      <Suspense fallback={<div className="text-muted small">{tx('A abrir o editor…')}</div>}>
        <EditorPagina html={html} onChange={setHtml} aoErro={(t) => avisar({ tipo: 'erro', texto: t })} />
      </Suspense>
      {pagina && <input className="form-control mt-2" value={resumo} onChange={(e) => setResumo(e.target.value)} placeholder={tx('O que mudou? (opcional)')} maxLength={200} aria-label={tx('Resumo da mudança')} />}
      <div className="d-flex gap-2 mt-3">
        <button type="button" className="btn btn-theme" onClick={guardar} disabled={aGuardar || (!pagina && titulo.trim().length < 2)}>{aGuardar ? tx('A guardar…') : tx('Guardar')}</button>
        <button type="button" className="btn btn-white" onClick={cancelar} disabled={aGuardar}>{tx('Cancelar')}</button>
      </div>
    </Cartao>
  )
}

export default Wiki
