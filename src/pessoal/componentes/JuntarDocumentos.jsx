import { useEffect, useRef, useState } from 'react'
import { api } from '../api'
import { useSessao } from '../sessao'
import { InputData, Modal } from './Ui'
import { aceite, analisar, caminhoDe, cortarPdf, dataDoTexto, terminarOcr } from '../separar'

const SEM_DATA = ['bi', 'foto']
const CORES = ['#0d6efd', '#198754', '#d63384', '#fd7e14', '#6f42c1', '#20c997', '#dc3545', '#6c757d']

// as partes com o fim (exclusivo), a data lida no texto das suas páginas e o título por omissão
function completar(partes, paginas) {
  return partes.map((p, i) => {
    const fim = partes[i + 1]?.inicio ?? Math.max(paginas.length, 1)
    const texto = paginas.slice(p.inicio, fim).map((x) => x.texto).join('\n')
    return { incluir: true, titulo: '', data: SEM_DATA.includes(p.tipo) ? '' : dataDoTexto(texto), ...p, fim }
  })
}

/*
  Juntar documentos aos processos individuais: o sistema lê cada ficheiro (PDF, imagem, Word), reconhece o tipo
  e separa os PDFs com vários documentos; a pessoa confere (miniaturas, cortes, tipo, título e data) e envia.
  itens: [{ pessoaId, pessoaNome?, ficheiro }] — de um militar (a ficha) ou de muitos (Importar).
*/
export default function JuntarDocumentos({ itens, aoFechar, aoTerminar }) {
  const { ref } = useSessao()
  // fixos enquanto a janela está aberta (a leitura não recomeça se a sessão se actualizar)
  const [tipos] = useState(ref.tiposDocumento)
  const [lidos, setLidos] = useState([])
  const [estado, setEstado] = useState({ fase: 'ler', texto: 'A preparar…', feito: 0 })
  const [abertos, setAbertos] = useState(() => new Set(itens.length <= 3 ? itens.map((_, i) => i) : []))
  const cancelado = useRef(false)
  const muitos = new Set(itens.map((x) => x.pessoaId)).size > 1

  useEffect(() => {
    cancelado.current = false
    ;(async () => {
      const r = []
      for (const [i, it] of itens.entries()) {
        if (cancelado.current) return
        const nome = caminhoDe(it.ficheiro)
        if (!aceite(it.ficheiro)) { r.push({ ...it, i, erro: 'Tipo de ficheiro não aceite (use PDF, JPG, PNG, WEBP, Word .docx ou Excel .xlsx).', paginas: [], partes: [] }); continue }
        try {
          const a = await analisar(it.ficheiro, tipos, (p, t) => setEstado({ fase: 'ler', feito: i, texto: `A ler ${i + 1} de ${itens.length}: ${nome}${t > 1 ? ` — página ${p} de ${t}` : ''}` }))
          r.push({ ...it, i, paginas: a.paginas, partes: completar(a.partes, a.paginas) })
        } catch (e) {
          r.push({ ...it, i, erro: `Não foi possível ler o ficheiro (${e.message}).`, paginas: [], partes: [] })
        }
        setLidos([...r])
      }
      if (!cancelado.current) setEstado({ fase: 'rever' })
    })()
    return () => { cancelado.current = true; terminarOcr() }
  }, [itens, tipos])

  const mudarParte = (i, k, valores) => setLidos((l) => l.map((x) => (x.i === i ? { ...x, partes: x.partes.map((p, j) => (j === k ? { ...p, ...valores } : p)) } : x)))
  // cortar (ou voltar a juntar) antes de uma página: a parte nova fica com o tipo reconhecido nessa página
  function cortar(i, pagina) {
    setLidos((l) => l.map((x) => {
      if (x.i !== i) return x
      const antigas = new Map(x.partes.map((p) => [p.inicio, p]))
      const novas = antigas.has(pagina)
        ? x.partes.filter((p) => p.inicio !== pagina)
        : [...x.partes, { inicio: pagina, tipo: x.paginas[pagina].tipo || x.partes.findLast((p) => p.inicio < pagina)?.tipo || 'outro' }]
      const partes = completar(novas.map(({ inicio, tipo }) => ({ inicio, tipo })).sort((a, b) => a.inicio - b.inicio), x.paginas)
      return { ...x, partes: partes.map((p) => { const o = antigas.get(p.inicio); return o ? { ...p, titulo: o.titulo, data: o.data, incluir: o.incluir } : p }) }
    }))
  }

  const aEnviar = lidos.flatMap((x) => (x.erro ? [] : x.partes.filter((p) => p.incluir).map((p) => ({ x, p }))))
  async function enviar() {
    setEstado({ fase: 'enviar', feito: 0, texto: '' })
    const falhas = []
    for (const [n, { x, p }] of aEnviar.entries()) {
      setEstado({ fase: 'enviar', feito: n, texto: `A enviar ${n + 1} de ${aEnviar.length}${x.pessoaNome ? ` — ${x.pessoaNome}` : ''}: ${tipos[p.tipo] ?? p.tipo}` })
      try {
        // um só documento: vai o ficheiro como veio; senão, só as páginas desta parte
        const f = x.partes.length === 1 ? x.ficheiro : await cortarPdf(x.ficheiro, p.inicio, p.fim)
        const fd = new FormData()
        fd.append('tipo', p.tipo)
        fd.append('titulo', p.titulo.trim().slice(0, 200))
        fd.append('data', p.data)
        fd.append('ficheiro', f)
        await api(`/pessoas/${x.pessoaId}/documentos`, { metodo: 'POST', formulario: fd })
      } catch (e) {
        falhas.push(`${x.pessoaNome ? `${x.pessoaNome} — ` : ''}${caminhoDe(x.ficheiro)} (${tipos[p.tipo] ?? p.tipo}): ${e.message}`)
      }
    }
    setEstado({ fase: 'feito', enviados: aEnviar.length - falhas.length, falhas })
  }

  const total = itens.length
  const lendo = estado.fase === 'ler'
  const rodape = estado.fase === 'feito'
    ? <button type="button" className="btn btn-theme" onClick={aoTerminar}>Fechar</button>
    : <>
      <button type="button" className="btn btn-outline-secondary" onClick={aoFechar} disabled={estado.fase === 'enviar'}>Cancelar</button>
      <button type="button" className="btn btn-theme" onClick={enviar} disabled={estado.fase !== 'rever' || !aEnviar.length}><i className="fa fa-folder-plus me-1" />Juntar {aEnviar.length} documento(s) ao processo{muitos ? ' de cada um' : ''}</button>
    </>
  return (
    <Modal titulo="Juntar documentos ao processo individual" aoFechar={estado.fase === 'enviar' ? () => {} : aoFechar} largo rodape={rodape}>
      {(lendo || estado.fase === 'enviar') && (
        <div className="mb-3">
          <div className="small mb-1"><i className="fa fa-spinner fa-spin me-1" />{estado.texto}</div>
          <div className="progress" style={{ height: 6 }}><div className="progress-bar bg-success" style={{ width: `${(estado.feito / (lendo ? total : aEnviar.length || 1)) * 100}%` }} /></div>
          {lendo && <div className="small text-muted mt-1">O sistema lê o cimo de cada página para reconhecer o documento. Nas digitalizações demora alguns segundos por página.</div>}
        </div>
      )}
      {estado.fase === 'feito' && (
        <div className={`alert ${estado.falhas.length ? 'alert-warning' : 'alert-success'}`}>
          <i className="fa fa-check-circle me-1" />{estado.enviados} documento(s) juntos ao processo.
          {estado.falhas.length > 0 && <ul className="mb-0 mt-2 small">{estado.falhas.map((f) => <li key={f}>{f}</li>)}</ul>}
        </div>
      )}
      {estado.fase === 'rever' && <p className="small text-muted">Confira o que o sistema reconheceu. Nas páginas, <i className="fa fa-cut" /> corta (ou volta a juntar) um documento antes dessa página. Mude o tipo, o título ou a data se for preciso; desmarque o que não quer juntar.</p>}
      {estado.fase !== 'feito' && lidos.map((x) => (
        <div key={x.i} className="border rounded mb-2">
          <div className="d-flex flex-wrap gap-2 align-items-center p-2 bg-light">
            <i className={`fa ${x.erro ? 'fa-exclamation-triangle text-danger' : 'fa-file-alt text-muted'}`} />
            <span className="fw-bold text-truncate flex-grow-1" style={{ minWidth: 0 }}>{x.pessoaNome && <span className="text-theme me-2">{x.pessoaNome}</span>}{caminhoDe(x.ficheiro)}</span>
            {!x.erro && <span className="small text-muted">{x.paginas.length > 1 ? `${x.paginas.length} páginas · ` : ''}{x.partes.length} documento(s)</span>}
            {x.paginas.length > 1 && <button type="button" className="btn btn-xs btn-outline-secondary" onClick={() => setAbertos((s) => { const n = new Set(s); if (n.has(x.i)) n.delete(x.i); else n.add(x.i); return n })}>{abertos.has(x.i) ? 'Esconder páginas' : 'Ver páginas'}</button>}
          </div>
          {x.erro && <div className="p-2 small text-danger">{x.erro}</div>}
          {abertos.has(x.i) && x.paginas.length > 1 && (
            <div className="d-flex flex-wrap gap-2 p-2">
              {x.paginas.map((pg, n) => {
                const k = x.partes.findLastIndex((p) => p.inicio <= n)
                return (
                  <div key={n} className="text-center" style={{ width: 96 }}>
                    <img src={pg.miniatura} alt={`Página ${n + 1}`} className="img-fluid border" style={{ borderColor: CORES[k % CORES.length], borderWidth: 3, borderStyle: 'solid' }} />
                    <div className="small d-flex justify-content-between align-items-center">
                      <span>Pág. {n + 1}</span>
                      {n > 0 && estado.fase === 'rever' && <button type="button" className={`btn btn-xs ${x.partes.some((p) => p.inicio === n) ? 'btn-danger' : 'btn-outline-secondary'}`} title={x.partes.some((p) => p.inicio === n) ? 'Juntar ao documento anterior' : 'Começa aqui outro documento'} onClick={() => cortar(x.i, n)}><i className="fa fa-cut" /></button>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          {x.partes.map((p, k) => (
            <div key={p.inicio} className="row g-2 align-items-center px-2 py-1 border-top mx-0">
              <div className="col-md-2 small"><label className="form-check mb-0"><input type="checkbox" className="form-check-input" checked={p.incluir} disabled={estado.fase !== 'rever'} onChange={(e) => mudarParte(x.i, k, { incluir: e.target.checked })} /> <span className="form-check-label" style={{ color: x.paginas.length > 1 ? CORES[k % CORES.length] : undefined }}>{x.paginas.length > 1 ? (p.fim - p.inicio > 1 ? `Págs. ${p.inicio + 1}–${p.fim}` : `Pág. ${p.inicio + 1}`) : 'Juntar'}</span></label></div>
              <div className="col-md-4"><select className="form-select form-select-sm" value={p.tipo} disabled={estado.fase !== 'rever'} onChange={(e) => mudarParte(x.i, k, { tipo: e.target.value })} aria-label="Tipo de documento">{Object.entries(tipos).map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></div>
              <div className="col-md-4"><input className="form-control form-control-sm" maxLength={200} placeholder={`Título (por omissão: ${tipos[p.tipo] ?? p.tipo})`} value={p.titulo} disabled={estado.fase !== 'rever'} onChange={(e) => mudarParte(x.i, k, { titulo: e.target.value })} /></div>
              <div className="col-md-2"><InputData value={p.data} disabled={estado.fase !== 'rever'} onChange={(e) => mudarParte(x.i, k, { data: e.target.value })} aria-label="Data do documento" /></div>
            </div>
          ))}
        </div>
      ))}
    </Modal>
  )
}
