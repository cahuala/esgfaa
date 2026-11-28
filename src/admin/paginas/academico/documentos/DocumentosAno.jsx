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
// os mapas por ramo, pela ordem do arquivo; a Casa Militar vem da unidade de origem (os seus oficiais saem do ramo)
const MAPAS_RAMOS = [['EXE', 'do Exército'], ['MGA', 'da MGA'], ['PNA', 'da PNA'], ['FAN', 'da FAN'], ['CASA MILITAR', 'da Casa Militar']]
// a Casa Militar junta as unidades presidenciais (UDP, USP, UGP); a Polícia pela unidade ou pelo posto; os estrangeiros à parte
const CASA_MILITAR = /casa militar|unidade de (defesa|seguran[çc]a|guarda) presidencial|\b(UDP|USP|UGP)\b/i
const POLICIA = /pol[ií]cia nacional/i
const POSTO_POLICIA = /comiss[áa]rio|superintendente|intendente|inspector|subinspector|agente/i
const ESTRANGEIRO = /forces arm[ée]es|congo|mo[çc]ambique|cabo verde|guin[ée]|s[ãa]o tom[ée]|namíbia|zâmbia|brasil|portugal/i
const mapaDe = (l) => {
  if (l.origem === 'estrangeiro' || ESTRANGEIRO.test(l.orgao || '')) return `dos países amigos${l.pais ? ` (${l.pais})` : ''}`
  if (CASA_MILITAR.test(l.orgao || '')) return 'CASA MILITAR'
  if (l.origem === 'policia' || l.ramo === 'PNA' || POLICIA.test(l.orgao || '') || (!l.ramo && POSTO_POLICIA.test(l.posto || ''))) return 'PNA'
  return l.ramo || 'de outra origem'
}
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const mencaoDe = (n) => (n === null || n === undefined ? '' : n >= 18 ? 'Muito BOM' : n >= 14 ? 'BOM' : n >= 10 ? 'REGULAR' : 'REPROVADO')
// a classificação como nos mapas do arquivo: «BOM», «Muito BOM», «BOM/C/Distinção»
const classificacao = (l) => (l.mencao === 'Distinto' ? `${mencaoDe(l.final)}/C/Distinção` : mencaoDe(l.final))
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
    // só vale a resposta do ano que está escolhido (uma resposta atrasada de outro ano deixava a página a carregar)
    let vivo = true
    api(`/academico/documentos-do-ano?anoLetivo=${encodeURIComponent(ano)}`).then((x) => { if (vivo) { setErro(''); setR({ ano, d: x }) } }).catch((e) => { if (vivo) setErro(e.message) })
    return () => { vivo = false }
  }, [ano])
  if (!DOCUMENTOS_ANO[tipo]) return <Erro texto="Documento desconhecido." />
  if (erro) return <Erro texto={erro} />
  if (!d) return <Carregando />

  const cursos = d.cursos.filter((c) => c.linhas.length)
  const periodo = [dataPt(d.inicio), dataPt(d.fim)].filter(Boolean).join(' a ')
  // o período curto dos mapas: «21.10.24 á 25.07.2025»
  const curta = (iso, ano4) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${ano4 ? iso.slice(0, 4) : iso.slice(2, 4)}` : '')
  const periodoCurto = d.inicio && d.fim ? `${curta(d.inicio)} á ${curta(d.fim, true)}` : periodo
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
    // como no arquivo: um mapa por ramo (Exército, MGA, PNA, FAN, Casa Militar…), cada um com os cursos, o total geral,
    // a data e a assinatura do Director de Ensino; a classificação em maiúsculas («BOM/C/Distinção» no Distinto)
    const mapas = MAPAS_RAMOS.map(([k, titulo]) => [k, titulo]).concat([...new Set(cursos.flatMap((c) => c.linhas.map(mapaDe)))].filter((k) => !MAPAS_RAMOS.some(([x]) => x === k)).map((k) => [k, k]))
      .filter(([k]) => cursos.some((c) => c.linhas.some((l) => mapaDe(l) === k)))
    const local = `Escola Superior de Guerra do EMGFAA, em Luanda, ___ de ${MESES[Number(String(d.fim ?? '').slice(5, 7)) - 1] ?? '__________'} de ${String(d.fim ?? '').slice(0, 4) || '____'}.`
    corpo = mapas.map(([k, nome], m) => (
      <section key={k} className={m < mapas.length - 1 ? 'of-quebra mb-4' : 'mb-4'}>
        <h2 className="h6 text-uppercase fw-bold text-center mb-3">Mapa do grau de aproveitamento de oficiais discentes {nome}<br />do ano académico {ano}</h2>
        {cursos.filter((c) => c.linhas.some((l) => mapaDe(l) === k)).map((c) => {
          const ls = c.linhas.filter((l) => mapaDe(l) === k)
          excel.push([`${nome.toUpperCase()} — ${nomeCurso(c)}`], ['Nº', 'NIP', 'Patente', 'Nome completo', 'Início e término', 'Média', 'Classificação'], ...ls.map((l, i) => [String(i + 1).padStart(2, '0'), l.nip, l.posto, l.nome, i ? '-' : periodoCurto, decimal(l.final), classificacao(l)]), ['', '', '', '', '', 'TOTAL GERAL', String(ls.length).padStart(2, '0')], [])
          return (
            <div key={c.curso} className="mb-3">
              <div className="fw-bold text-uppercase text-center">{nomeCurso(c)}</div>
              <table>
                <thead><tr><th className="of-num">Nº</th><th>NIP</th><th>Patente</th><th>Nome completo</th><th className="of-centro">Início e término</th><th className="of-centro">Média</th><th className="of-centro">Classificação</th></tr></thead>
                <tbody>{ls.map((l, i) => <tr key={l.id}><td className="of-num">{String(i + 1).padStart(2, '0')}</td><td>{l.nip}</td><td>{l.posto}</td><td>{l.nome}</td><td className="of-centro small">{i ? '-' : periodoCurto}</td><td className="of-centro">{fmt(l.final)}</td><td className="of-centro">{classificacao(l)}</td></tr>)}</tbody>
                <tfoot><tr><th colSpan={6} className="text-end">TOTAL GERAL</th><th className="of-centro">{String(ls.length).padStart(2, '0')}</th></tr></tfoot>
              </table>
            </div>
          )
        })}
        {m < mapas.length - 1 && (
          <div className="mt-3 text-center small">
            <div className="mb-4">{local}</div>
            <div className="fw-bold">O DIRECTOR DE ENSINO</div>
            <div className="mt-4">{typeof director === 'object' ? (director.nome || '').toUpperCase() : ''}</div>
            <div className="fw-bold">{typeof director === 'object' && director.posto ? `*${director.posto.toUpperCase()}*` : ''}</div>
          </div>
        )}
      </section>
    ))
  } else if (tipo === 'finais') {
    // como no arquivo: matriculados, terminaram com aproveitamento, baixas, média, menções e % de aproveitamento
    const linhas = cursos.map((c) => {
      const n = Object.fromEntries(MENCOES.map((m) => [m, c.linhas.filter((l) => l.mencao === m).length]))
      const aprovados = c.linhas.filter((l) => l.mencao && l.mencao !== 'Reprovado').length
      const matriculados = c.linhas.length + (c.baixas || 0)
      return { c, n, aprovados, matriculados, media: media(c.linhas), percentagem: matriculados ? (aprovados / matriculados) * 100 : null }
    })
    excel = [['Curso', 'Matriculados', 'Terminaram com aproveitamento', 'Baixas', 'Média do curso', ...MENCOES, '% de aproveitamento'], ...linhas.map((x) => [nomeCurso(x.c), x.matriculados, x.aprovados, x.c.baixas || 0, decimal(x.media?.toFixed(2)), ...MENCOES.map((m) => x.n[m]), decimal(x.percentagem?.toFixed(1))])]
    corpo = (
      <>
        {linhas.map((x) => (
          <div key={x.c.curso} className="mb-3">
            <div className="fw-bold text-uppercase">{nomeCurso(x.c)}</div>
            <div>Matriculados: {x.matriculados} — terminaram com aproveitamento {x.aprovados}.{x.c.baixas ? ` ${x.c.baixas} baixa(s) de curso.` : ''}</div>
            <div>Média do curso: {fmt(x.media)}</div>
            <div>{MENCOES.map((m) => `${m} – ${String(x.n[m]).padStart(2, '0')}`).join(' | ')}</div>
            <div>% de aproveitamento: {x.percentagem === null ? '—' : `${x.percentagem.toFixed(1).replace('.', ',')} %`}</div>
          </div>
        ))}
      </>
    )
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
      assinaturas={['ramos', 'resumo', 'estatistica', 'finais'].includes(tipo) ? [director] : []}
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
