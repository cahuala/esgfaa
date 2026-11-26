import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../../../api'
import { Carregando, Erro } from '../../../componentes/Ui'
import Documento from './Documento'
import { decimal, descarregarCsv, dataPt } from './csv'
import { useAnoTrabalho } from '../../../anoTrabalho'
import { DOCUMENTOS_ANO } from './tiposDocumentosAno'

/*
  Documentos do ano lectivo que a Repartição de Administração Escolar tira no fim dos cursos (como os do arquivo):
  dados estatísticos, dados por ramos, resumo dos dados estatísticos, relação para a entrega dos diplomas e
  certificados e a lista final de dados para os diplomas. Cada um imprime-se e exporta-se para o Excel.
*/

// o órgão de origem em sigla, como nos quadros (MINDENVP, CSPR, EMG, EXE, FAN, MGA, PNA…)
const SIGLAS = {
  'Ministério da Defesa Nacional e dos Veteranos da Pátria': 'MINDENVP', 'Casa de Segurança do Presidente da República': 'CSPR', 'Casa Militar do Presidente da República': 'CMPR',
  'Estado-Maior General das FAA': 'EMG', 'Exército': 'EXE', 'Força Aérea Nacional': 'FAN', 'Marinha de Guerra Angolana': 'MGA', 'Polícia Nacional': 'PNA',
  'Unidade de Segurança Presidencial': 'USP', 'Unidade da Guarda Presidencial': 'UGP', 'Unidade de Defesa Presidencial': 'UDP', 'Serviço de Inteligência e Segurança Militar': 'SISM',
}
const orgaoDe = (l) => (l.origem === 'estrangeiro' ? l.pais || 'Estrangeiros' : SIGLAS[l.orgao] || (l.orgao ? l.orgao : l.ramo || 'Outros'))
const ramoDe = (l) => (l.origem === 'policia' ? 'PNA' : l.origem === 'estrangeiro' ? l.pais : l.ramo)
// as colunas dos postos (pelo grau equivalente das FAA): generais, brigadeiros, coronéis, …
const CATEGORIAS = [
  [(g) => g >= 18, 'T.Gen / V.Alm / Comiss.'], [(g) => g === 17, 'Brig. / C.Alm'], [(g) => g === 16, 'Coronel / CMG'], [(g) => g === 15, 'T.Cor / C.Frag.'],
  [(g) => g === 14, 'Major / C.Corv.'], [(g) => g === 13, 'Capitão / T.Navio'], [(g) => g >= 10 && g <= 12, 'Subalternos'], [(g) => g >= 1 && g <= 9, 'Sargentos e praças'], [(g) => !g, 'Civis'],
]
const MENCOES = ['Distinto', 'Muito Bom', 'Bom', 'Regular', 'Reprovado']
const nomeCurso = (c) => `${c.nome}${c.sigla ? ` (${c.sigla})` : ''}`
const media = (l) => { const n = l.filter((x) => x.final !== null && x.final !== undefined).map((x) => Number(x.final)); return n.length ? n.reduce((a, b) => a + b, 0) / n.length : null }
const fmt = (v) => (v === null || v === undefined ? '—' : Number(v).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))

function DocumentosAno() {
  const { tipo } = useParams()
  const navegar = useNavigate()
  const [params, setParams] = useSearchParams()
  const { ano: anoTrabalho, anos } = useAnoTrabalho()
  const ano = params.get('ano') || anoTrabalho
  const [r, setR] = useState({ ano: null, d: null })
  const d = r.ano === ano ? r.d : null
  const [quem, setQuem] = useState({})
  const [erro, setErro] = useState('')
  const [grupo, setGrupo] = useState(10)
  useEffect(() => { api('/academico/documentos-academicos').then(setQuem).catch(() => {}) }, [])
  useEffect(() => {
    if (!ano) return
    api(`/academico/documentos-do-ano?anoLetivo=${encodeURIComponent(ano)}`).then((x) => { setErro(''); setR({ ano, d: x }) }).catch((e) => setErro(e.message))
  }, [ano])
  if (!DOCUMENTOS_ANO[tipo]) return <Erro texto="Documento desconhecido." />
  if (erro) return <Erro texto={erro} />
  if (!d) return <Carregando />

  const cursos = d.cursos.filter((c) => c.linhas.length)
  const periodo = [dataPt(d.inicio), dataPt(d.fim)].filter(Boolean).join(' a ')
  const director = quem.directorEnsino ? { cargo: quem.directorEnsino.cargo || 'O Director de Ensino', nome: quem.directorEnsino.nome, posto: quem.directorEnsino.posto } : 'O Director de Ensino'
  const titulo = DOCUMENTOS_ANO[tipo]
  const ficheiro = `${titulo} ${ano}`.replace(/\W+/g, '-')

  // as linhas de cada documento: o que se vê e o que vai para o Excel
  let corpo = null
  let excel = []
  if (tipo === 'estatistica') {
    const colunas = CATEGORIAS.filter(([f]) => cursos.some((c) => c.linhas.some((l) => f(l.grau))))
    corpo = cursos.map((c) => {
      const orgaos = [...new Set(c.linhas.map(orgaoDe))]
      const conta = (o, f) => c.linhas.filter((l) => (o === null || orgaoDe(l) === o) && f(l.grau)).length
      excel.push([nomeCurso(c)], ['N/O', 'Designação', ...colunas.map(([, n]) => n), 'Total'], ...orgaos.map((o, i) => [i + 1, o, ...colunas.map(([f]) => conta(o, f)), conta(o, () => true)]), ['', 'TOTAL GERAL', ...colunas.map(([f]) => conta(null, f)), c.linhas.length], [])
      return (
        <section key={c.curso} className="mb-4">
          <h2 className="h6 text-uppercase fw-bold text-center">{nomeCurso(c)}</h2>
          <table>
            <thead><tr><th className="of-num">N/O</th><th>Designação</th>{colunas.map(([, n]) => <th key={n} className="of-centro">{n}</th>)}<th className="of-centro">Total</th></tr></thead>
            <tbody>
              {orgaos.map((o, i) => <tr key={o}><td className="of-num">{String(i + 1).padStart(2, '0')}</td><td>{o}</td>{colunas.map(([f, n]) => <td key={n} className="of-centro">{conta(o, f) || ''}</td>)}<td className="of-centro fw-bold">{conta(o, () => true)}</td></tr>)}
              <tr className="fw-bold"><td /><td>TOTAL GERAL</td>{colunas.map(([f, n]) => <td key={n} className="of-centro">{conta(null, f)}</td>)}<td className="of-centro">{c.linhas.length}</td></tr>
            </tbody>
          </table>
        </section>
      )
    })
  } else if (tipo === 'ramos') {
    corpo = cursos.map((c) => {
      const orgaos = [...new Set(c.linhas.map(orgaoDe))]
      return (
        <section key={c.curso} className="mb-4">
          <h2 className="h6 text-uppercase fw-bold text-center">{nomeCurso(c)}</h2>
          {orgaos.map((o) => {
            const ls = c.linhas.filter((l) => orgaoDe(l) === o)
            excel.push([`${nomeCurso(c)} — ${o}`], ['Nº', 'NIP', 'Patente', 'Nome completo', 'Início e término', 'Média', 'Classificação'], ...ls.map((l, i) => [i + 1, l.nip, l.posto, l.nome, periodo, decimal(l.final), l.mencao ?? '']), [])
            return (
              <div key={o} className="mb-2">
                <div className="fw-bold small text-uppercase mt-2">{o}</div>
                <table>
                  <thead><tr><th className="of-num">Nº</th><th>NIP</th><th>Patente</th><th>Nome completo</th><th>Início e término</th><th className="of-centro">Média</th><th>Classificação</th></tr></thead>
                  <tbody>{ls.map((l, i) => <tr key={l.id}><td className="of-num">{String(i + 1).padStart(2, '0')}</td><td>{l.nip}</td><td>{l.posto}</td><td>{l.nome}</td><td className="small">{periodo}</td><td className="of-centro">{fmt(l.final)}</td><td>{l.mencao ?? ''}</td></tr>)}</tbody>
                </table>
              </div>
            )
          })}
        </section>
      )
    })
  } else if (tipo === 'resumo') {
    const linhas = cursos.map((c, i) => {
      const n = Object.fromEntries(MENCOES.map((m) => [m, c.linhas.filter((l) => l.mencao === m).length]))
      const com = c.linhas.filter((l) => l.final !== null && l.final !== undefined)
      const melhor = com.sort((a, b) => Number(b.final) - Number(a.final))[0]
      return { i: i + 1, c, n, media: media(c.linhas), melhor }
    })
    excel = [['N.º', 'Curso', 'Total', ...MENCOES, 'Média', 'Melhor discente', 'Nota'], ...linhas.map((x) => [x.i, nomeCurso(x.c), x.c.linhas.length, ...MENCOES.map((m) => x.n[m]), decimal(x.media?.toFixed(2)), x.melhor ? `${x.melhor.posto} ${x.melhor.nome}`.trim() : '', decimal(x.melhor?.final)])]
    corpo = (
      <>
        {linhas.map((x) => (
          <div key={x.c.curso} className="mb-3">
            <div className="fw-bold">{x.i}. {nomeCurso(x.c)} — {x.c.linhas.length} discente(s)</div>
            <ul className="mb-1">
              {MENCOES.filter((m) => x.n[m]).map((m) => <li key={m}>{m}: {x.n[m]}</li>)}
              <li>Média: {fmt(x.media)} valores</li>
              {x.melhor && <li>Melhor discente: {x.melhor.posto} {x.melhor.nome} — {fmt(x.melhor.final)}</li>}
            </ul>
          </div>
        ))}
        {linhas.some((x) => x.media === null) && <p className="small">Os cursos sem média ainda não têm a classificação final (conselho de curso).</p>}
      </>
    )
  } else if (tipo === 'entrega') {
    corpo = cursos.map((c) => {
      const grupos = []
      for (let k = 0; k < c.linhas.length; k += grupo) grupos.push(c.linhas.slice(k, k + grupo))
      grupos.forEach((g, gi) => excel.push([`${nomeCurso(c)} — ${gi + 1}.º grupo`], ['N/O', 'Posto', 'Nome completo'], ...g.map((l, i) => [i + 1, l.posto, l.nome]), []))
      return (
        <section key={c.curso} className="mb-4">
          <h2 className="h6 text-uppercase fw-bold text-center">{c.nome}</h2>
          {grupos.map((g, gi) => (
            <div key={gi} className="mb-2">
              <div className="fw-bold small">{gi + 1}.º GRUPO</div>
              <table>
                <thead><tr><th className="of-num">N/O</th><th>Posto</th><th>Nome completo</th></tr></thead>
                <tbody>{g.map((l, i) => <tr key={l.id}><td className="of-num">{String(i + 1).padStart(2, '0')}</td><td>{l.posto}</td><td>{l.nome}</td></tr>)}</tbody>
              </table>
            </div>
          ))}
        </section>
      )
    })
  } else if (tipo === 'diplomas') {
    corpo = cursos.map((c) => {
      excel.push([`${nomeCurso(c)} — lista final de dados para constar nos diplomas`], ['N.º', 'NIP', 'Posto', 'Nome', 'Ramo', 'Obs.'], ...c.linhas.map((l, i) => [i + 1, l.nip, l.posto, l.nome, ramoDe(l), '']), [])
      return (
        <section key={c.curso} className="mb-4">
          <h2 className="h6 text-uppercase fw-bold text-center">{nomeCurso(c)}</h2>
          <table>
            <thead><tr><th className="of-num">N.º</th><th>NIP</th><th>Posto</th><th>Nome</th><th>Ramo</th><th style={{ width: 140 }}>Obs.</th></tr></thead>
            <tbody>{c.linhas.map((l, i) => <tr key={l.id}><td className="of-num">{String(i + 1).padStart(2, '0')}</td><td>{l.nip}</td><td>{l.posto}</td><td>{l.nome}</td><td>{ramoDe(l)}</td><td /></tr>)}</tbody>
          </table>
        </section>
      )
    })
  }

  return (
    <Documento
      anoLetivo={ano}
      titulo={titulo.toUpperCase()} voltar="/academico/turmas"
      subtitulo={`Ano lectivo ${ano} · ${cursos.length} curso(s) · ${cursos.reduce((s, c) => s + c.linhas.length, 0)} discente(s)`}
      assinaturas={tipo === 'ramos' || tipo === 'resumo' || tipo === 'estatistica' ? [director] : []}
      paisagem={tipo === 'estatistica' || tipo === 'ramos'}
      acoes={(
        <>
          <select className="form-select" style={{ width: 'auto' }} value={tipo} onChange={(e) => navegar(`/academico/documentos/ano/${e.target.value}?ano=${encodeURIComponent(ano)}`)} aria-label="Documento">
            {Object.entries(DOCUMENTOS_ANO).map(([k, t]) => <option key={k} value={k}>{t}</option>)}
          </select>
          <select className="form-select" style={{ width: 160 }} value={ano} onChange={(e) => setParams({ ano: e.target.value })} aria-label="Ano lectivo">
            {anos.map((a) => <option key={a.id} value={a.id}>{a.id}{a.atual ? ' (actual)' : ''}</option>)}
          </select>
          {tipo === 'entrega' && <label className="d-flex align-items-center gap-1 small">Por grupo <input type="number" min={1} max={100} className="form-control form-control-sm" style={{ width: 70 }} value={grupo} onChange={(e) => setGrupo(Math.max(1, Number(e.target.value) || 1))} /></label>}
          <button type="button" className="btn btn-white" onClick={() => descarregarCsv(ficheiro, [[`${titulo} — ano lectivo ${ano}`], [], ...excel])}><i className="fa fa-file-excel me-1 text-success" />Exportar Excel</button>
        </>
      )}
    >
      {!cursos.length ? <p className="text-center">Ainda não há discentes nas turmas deste ano lectivo. <Link to="/academico/turmas">Turmas</Link></p> : corpo}
    </Documento>
  )
}

export default DocumentosAno
