import { useMemo, useState } from 'react'
import { exportarExcel, exportarPdf } from '../exportar'

const normalizar = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const TAMANHOS = [10, 25, 50, 100]

/*
  Tabela de todas as listas: pesquisa em todas as colunas, ordenação ao clicar no título, paginação,
  exportação para Excel e PDF (do que está filtrado, todas as páginas) e linhas clicáveis.
  colunas: [{ chave, titulo, valor?(linha) (texto/número para ordenar, pesquisar e exportar), mostrar?(linha) (o que se vê),
  ordenarPor?(linha) (outra chave para ordenar, ex.: o grau do posto), alinhar?: 'end' | 'center', exportar?: false, oculta?: true }]
  Sem ordem escolhida, as linhas ficam pela ordem em que vêm (as listas de pessoal vêm pela ordem hierárquica).
  Relatório à medida: no botão «Colunas» escolhem-se as colunas que se vêem e que saem no Excel e no PDF
  (as «oculta» começam escondidas); a escolha fica guardada neste computador, para cada lista.
*/
const lerEscolha = (k) => { try { return JSON.parse(localStorage.getItem(k)) } catch { return null } }
const guardarEscolha = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* sem armazenamento: fica só nesta visita */ } }
export default function Tabela({ titulo, subtitulo, colunas: todas, linhas, aoClicar, chave = (l) => l.id, porPagina = 25, acoes, vazio = 'Sem registos.', semExportar = false, ordemInicial }) {
  const [pesquisa, setPesquisa] = useState('')
  const [ordem, setOrdem] = useState(ordemInicial ?? null) // { chave, dir: 1 | -1 }
  const [pagina, setPagina] = useState(1)
  const [tamanho, setTamanho] = useState(porPagina)
  const [aExportar, setAExportar] = useState('')
  const chaveEscolha = `pes-colunas:${titulo}`
  const [escolha, setEscolha] = useState(() => lerEscolha(chaveEscolha)) // { chave: true (vê-se) | false (escondida) }
  const [verColunas, setVerColunas] = useState(false)
  const valor = (c, l) => (c.valor ? c.valor(l) : l[c.chave])
  const colunas = useMemo(() => todas.filter((c) => escolha?.[c.chave] ?? !c.oculta), [todas, escolha])
  const mudarColuna = (c, ver) => { const n = { ...escolha, [c.chave]: ver }; setEscolha(n); guardarEscolha(chaveEscolha, n) }
  const reporColunas = () => { setEscolha(null); try { localStorage.removeItem(chaveEscolha) } catch { /* nada */ } }

  const filtradas = useMemo(() => {
    const termos = normalizar(pesquisa).split(/\s+/).filter(Boolean)
    let r = termos.length ? linhas.filter((l) => { const t = normalizar(colunas.map((c) => valor(c, l)).join(' ')); return termos.every((x) => t.includes(x)) }) : linhas
    if (ordem) {
      const c = colunas.find((x) => x.chave === ordem.chave)
      if (c) {
        // o posto ordena-se pela ordem hierárquica do servidor (posto, unidade na orgânica, função, antiguidade)
        const hier = c.chave === 'posto' && r.length > 0 && r.every((l) => l.hierarquia)
        const chaveDe = (l) => (hier ? l.hierarquia : c.ordenarPor ? c.ordenarPor(l) : valor(c, l))
        r = [...r].sort((a, b) => {
          const va = chaveDe(a)
          const vb = chaveDe(b)
          if (va === vb) return 0
          if (va === null || va === undefined || va === '') return 1
          if (vb === null || vb === undefined || vb === '') return -1
          return (typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'pt', { numeric: true })) * ordem.dir
        })
      }
    }
    return r
  }, [linhas, pesquisa, ordem, colunas])

  const paginas = Math.max(1, Math.ceil(filtradas.length / tamanho))
  const atual = Math.min(pagina, paginas)
  const visiveis = filtradas.slice((atual - 1) * tamanho, atual * tamanho)
  const exportaveis = colunas.filter((c) => c.exportar !== false).map((c) => ({ titulo: c.titulo, valor: (l) => valor(c, l) }))

  async function exportar(formato) {
    setAExportar(formato)
    try {
      if (formato === 'excel') await exportarExcel(titulo, exportaveis, filtradas)
      else await exportarPdf(titulo, exportaveis, filtradas, { subtitulo: [subtitulo, pesquisa && `pesquisa: «${pesquisa}»`].filter(Boolean).join(' · ') })
    } finally {
      setAExportar('')
    }
  }

  const ordenar = (c) => setOrdem((o) => (o?.chave === c.chave ? (o.dir === 1 ? { chave: c.chave, dir: -1 } : null) : { chave: c.chave, dir: 1 }))
  const numeros = Array.from({ length: paginas }, (_, i) => i + 1).filter((n) => n === 1 || n === paginas || Math.abs(n - atual) <= 2)

  return (
    <div className="pes-tabela">
      <div className="pes-tabela-barra">
        <div className="pes-pesquisa">
          <i className="fa fa-search" />
          <input type="search" className="form-control form-control-sm" placeholder="Pesquisar…" value={pesquisa} onChange={(e) => { setPesquisa(e.target.value); setPagina(1) }} aria-label={`Pesquisar em ${titulo}`} />
        </div>
        <span className="pes-tabela-conta">{filtradas.length === linhas.length ? `${linhas.length} registo(s)` : `${filtradas.length} de ${linhas.length}`}</span>
        <div className="ms-auto d-flex gap-1 flex-wrap">
          {acoes}
          <div className="position-relative">
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setVerColunas(!verColunas)} aria-expanded={verColunas} title="Escolher as colunas (também as do Excel e do PDF)"><i className="fa fa-columns me-1" />Colunas{colunas.length < todas.length && ` (${colunas.length}/${todas.length})`}</button>
            {verColunas && (
              <div className="pes-colunas card shadow-sm p-2" style={{ position: 'absolute', right: 0, top: '100%', zIndex: 20, minWidth: 240, maxHeight: 360, overflowY: 'auto' }}>
                {todas.filter((c) => c.titulo).map((c) => (
                  <label key={c.chave} className="form-check small mb-1">
                    <input type="checkbox" className="form-check-input" checked={colunas.includes(c)} disabled={colunas.length === 1 && colunas.includes(c)} onChange={(e) => mudarColuna(c, e.target.checked)} />
                    <span className="form-check-label">{c.titulo}</span>
                  </label>
                ))}
                <div className="d-flex gap-1 mt-1 border-top pt-2">
                  <button type="button" className="btn btn-xs btn-outline-secondary" onClick={() => { const n = Object.fromEntries(todas.map((c) => [c.chave, true])); setEscolha(n); guardarEscolha(chaveEscolha, n) }}>Todas</button>
                  <button type="button" className="btn btn-xs btn-outline-secondary" onClick={reporColunas}>Repor</button>
                  <button type="button" className="btn btn-xs btn-theme ms-auto" onClick={() => setVerColunas(false)}>Fechar</button>
                </div>
              </div>
            )}
          </div>
          {!semExportar && (
            <>
              <button type="button" className="btn btn-sm btn-success" disabled={!filtradas.length || aExportar} onClick={() => exportar('excel')} title="Exportar para Excel">
                <i className={`fa ${aExportar === 'excel' ? 'fa-spinner fa-spin' : 'fa-file-excel'} me-1`} />Excel
              </button>
              <button type="button" className="btn btn-sm btn-danger" disabled={!filtradas.length || aExportar} onClick={() => exportar('pdf')} title="Exportar para PDF">
                <i className={`fa ${aExportar === 'pdf' ? 'fa-spinner fa-spin' : 'fa-file-pdf'} me-1`} />PDF
              </button>
            </>
          )}
        </div>
      </div>
      <div className="table-responsive">
        <table className={`table table-hover table-striped align-middle mb-0 ${aoClicar ? 'pes-clicavel' : ''}`}>
          <thead>
            <tr>
              {colunas.map((c) => (
                <th key={c.chave} className={c.alinhar ? `text-${c.alinhar}` : ''} aria-sort={ordem?.chave === c.chave ? (ordem.dir === 1 ? 'ascending' : 'descending') : 'none'}>
                  <button type="button" className="pes-ordenar" onClick={() => ordenar(c)}>
                    {c.titulo}
                    <i className={`fa ms-1 ${ordem?.chave === c.chave ? (ordem.dir === 1 ? 'fa-sort-up' : 'fa-sort-down') : 'fa-sort text-muted opacity-50'}`} />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visiveis.map((l) => (
              <tr key={chave(l)} onClick={aoClicar ? () => aoClicar(l) : undefined} tabIndex={aoClicar ? 0 : undefined} onKeyDown={aoClicar ? (e) => { if (e.key === 'Enter') aoClicar(l) } : undefined}>
                {colunas.map((c) => <td key={c.chave} className={c.alinhar ? `text-${c.alinhar}` : ''}>{c.mostrar ? c.mostrar(l) : valor(c, l) ?? '—'}</td>)}
              </tr>
            ))}
            {!visiveis.length && <tr><td colSpan={colunas.length} className="text-center text-muted py-4">{pesquisa ? 'Nada corresponde à pesquisa.' : vazio}</td></tr>}
          </tbody>
        </table>
      </div>
      {filtradas.length > TAMANHOS[0] && (
        <div className="pes-tabela-rodape">
          <label className="d-flex align-items-center gap-2 small">
            Mostrar
            <select className="form-select form-select-sm w-auto" value={tamanho} onChange={(e) => { setTamanho(Number(e.target.value)); setPagina(1) }}>
              {TAMANHOS.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            por página
          </label>
          <nav aria-label="Páginas" className="ms-auto">
            <ul className="pagination pagination-sm mb-0">
              <li className={`page-item ${atual === 1 ? 'disabled' : ''}`}><button type="button" className="page-link" onClick={() => setPagina(atual - 1)} aria-label="Anterior">‹</button></li>
              {numeros.map((n, i) => (
                <li key={n} className={`page-item ${n === atual ? 'active' : ''}`}>
                  {i > 0 && n - numeros[i - 1] > 1 && <span className="page-link border-0 bg-transparent">…</span>}
                  <button type="button" className="page-link" onClick={() => setPagina(n)}>{n}</button>
                </li>
              ))}
              <li className={`page-item ${atual === paginas ? 'disabled' : ''}`}><button type="button" className="page-link" onClick={() => setPagina(atual + 1)} aria-label="Seguinte">›</button></li>
            </ul>
          </nav>
        </div>
      )}
    </div>
  )
}
