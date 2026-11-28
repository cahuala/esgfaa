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
/*
  O órgão onde o militar presta serviço (Lei 13/18, art. 83.º: o militar pertence a um Ramo e pode servir «fora do
  Ramo» — no Estado-Maior General, nos órgãos e serviços auxiliares do Presidente da República, na Inteligência e
  Segurança Militar, na Justiça Militar): a Casa Militar e as unidades presidenciais (UDP, USP, UGP) no CSPR, como nos
  dados estatísticos do arquivo; o SISM à parte (não é do Estado-Maior General); quem serve no próprio Ramo, no Ramo.
*/
const SIGLAS = {
  'Ministério da Defesa Nacional e dos Veteranos da Pátria': 'MINDENVP', 'Casa de Segurança do Presidente da República': 'CSPR', 'Casa Militar do Presidente da República': 'CSPR',
  'Estado-Maior General das FAA': 'EMG', 'Exército': 'EXE', 'Força Aérea Nacional': 'FAN', 'Marinha de Guerra Angolana': 'MGA', 'Polícia Nacional': 'PNA',
  'Unidade de Segurança Presidencial': 'CSPR', 'Unidade da Guarda Presidencial': 'CSPR', 'Unidade de Defesa Presidencial': 'CSPR', 'Serviço de Inteligência e Segurança Militar': 'SISM',
}
// os estrangeiros pelo país (as forças armadas do Congo: «Rep. Congo»), como nos mapas do arquivo
const orgaoDe = (l) => (l.origem === 'estrangeiro' || /forces arm[ée]es congolaises|congo/i.test(l.orgao || '') ? l.pais || (/congo/i.test(l.orgao || '') ? 'Rep. Congo' : 'Estrangeiros') : SIGLAS[l.orgao] || (l.orgao ? l.orgao : l.ramo || 'Outros'))
const ramoDe = (l) => (l.origem === 'policia' ? 'PNA' : l.origem === 'estrangeiro' ? l.pais : l.ramo)
// as colunas dos postos (pelo grau equivalente das FAA): generais, brigadeiros, coronéis, …
const CATEGORIAS = [
  [(g) => g >= 18, 'T.Gen / V.Alm / Comiss.'], [(g) => g === 17, 'Brig. / C.Alm'], [(g) => g === 16, 'Coronel / CMG'], [(g) => g === 15, 'T.Cor / C.Frag.'],
  [(g) => g === 14, 'Major / C.Corv.'], [(g) => g === 13, 'Capitão / T.Navio'], [(g) => g >= 10 && g <= 12, 'Subalternos'], [(g) => g >= 1 && g <= 9, 'Sargentos e praças'], [(g) => !g, 'Civis'],
]
const MENCOES = ['Distinto', 'Muito Bom', 'Bom', 'Regular', 'Reprovado']
/*
  Os mapas do grau de aproveitamento, um por entidade a quem se enviam (como os de 2025/2026 e as notas de envio do
  arquivo): o militar pertence a um Ramo (Lei 13/18) e vai no mapa do Ramo quando serve no Ramo ou no Estado-Maior
  General; quando está fora do Ramo num órgão auxiliar do Presidente da República (a Casa Militar, com a UDP, a USP e a
  UGP), no SISM ou no Ministério da Defesa, vai no mapa desse órgão (o ramo dele continua na linha). A Polícia Nacional
  e os estrangeiros à parte. [chave, título do mapa, destinatário da nota de envio, como se diz no texto da nota]
*/
// pela ordem dos mapas do arquivo (Exército, MGA, PNA, FAN, Casa Militar, SISM, Ministério da Defesa)
const MAPAS_RAMOS = [
  ['EXE', 'do Exército', 'SUA EXCELÊNCIA COMANDANTE\nDO EXÉRCITO', 'do Exército'],
  ['MGA', 'da Marinha de Guerra Angolana', 'SUA EXCELÊNCIA COMANDANTE\nDA MARINHA DE GUERRA ANGOLANA', 'da Marinha de Guerra Angolana (MGA)'],
  ['PNA', 'da Polícia Nacional de Angola', 'GABINETE DE SUA EXCELÊNCIA\nCOMANDANTE DA POLÍCIA NACIONAL DE ANGOLA/PNA', 'da Polícia Nacional de Angola (PNA)'],
  ['FAN', 'da Força Aérea Nacional', 'SUA EXCELÊNCIA COMANDANTE\nDA FORÇA AÉREA NACIONAL', 'da Força Aérea Nacional (FAN)'],
  ['CMPR', 'da Casa Militar do Presidente da República', 'GABINETE DE SUA EXCELÊNCIA MINISTRO DE ESTADO E CHEFE DA CASA MILITAR DO PRESIDENTE DA REPÚBLICA', 'da Casa Militar do Presidente da República'],
  ['SISM', 'do SISM', 'SUA EXCELÊNCIA CHEFE DO SERVIÇO DE INTELIGÊNCIA E SEGURANÇA MILITAR (SISM)', 'do Serviço de Inteligência e Segurança Militar (SISM)'],
  ['MINDEN', 'do Ministério da Defesa Nacional, Antigos Combatentes e Veteranos da Pátria', 'GABINETE DE SUA EXCELÊNCIA MINISTRO DA DEFESA NACIONAL, ANTIGOS COMBATENTES E VETERANOS DA PÁTRIA', 'do Ministério da Defesa Nacional, Antigos Combatentes e Veteranos da Pátria (MDNACVP)'],
]
const CASA_MILITAR = /casa militar|casa de seguran[çc]a do presidente|unidade d[ae] (defesa|seguran[çc]a|guarda) presidencial|\b(UDP|USP|UGP|CSPR)\b/i
const POLICIA = /pol[ií]cia nacional/i
const POSTO_POLICIA = /comiss[áa]rio|superintendente|intendente|inspector|subinspector|agente/i
const ESTRANGEIRO = /forces arm[ée]es|congo|mo[çc]ambique|cabo verde|guin[ée]|s[ãa]o tom[ée]|namíbia|zâmbia|brasil|portugal/i
const RAMO_DO_ORGAO = { 'Exército': 'EXE', 'Força Aérea Nacional': 'FAN', 'Marinha de Guerra Angolana': 'MGA' }
// os mapas de cada militar: o do seu Ramo (sempre) e, se serve fora do Ramo, também o do órgão (Casa Militar, SISM,
// Ministério da Defesa) — como nos mapas de 2025/2026 do arquivo; a Polícia Nacional e os estrangeiros só no seu
const orgaoDoTexto = (t) => (CASA_MILITAR.test(t) ? 'CMPR' : /intelig[êe]ncia e seguran[çc]a militar|\bSISM\b/i.test(t) ? 'SISM' : /minist[ée]rio da defesa|\bMINDEN|\bMDN/i.test(t) ? 'MINDEN' : null)
// pela unidade; se a unidade é o próprio Ramo, o EMG ou está em branco, pela função («Conselheiro do chefe do SISM»)
const orgaoMapa = (l) => orgaoDoTexto(l.orgao || '') || (!l.orgao || RAMO_DO_ORGAO[l.orgao] || /estado.maior general/i.test(l.orgao) ? orgaoDoTexto(l.funcao || '') : null)
const mapasDe = (l) => {
  if (l.origem === 'estrangeiro' || ESTRANGEIRO.test(l.orgao || '')) return [`dos países amigos${l.pais ? ` (${l.pais})` : ''}`]
  const orgao = orgaoMapa(l)
  // a Polícia Nacional não é um Ramo das FAA: o seu mapa e, se serve num órgão (o SISM), também o desse órgão
  if (l.origem === 'policia' || l.ramo === 'PNA' || POLICIA.test(l.orgao || '') || (!l.ramo && POSTO_POLICIA.test(l.posto || ''))) return orgao ? ['PNA', orgao] : ['PNA']
  const ramo = l.ramo || RAMO_DO_ORGAO[l.orgao] || 'de outra origem'
  return orgao ? [ramo, orgao] : [ramo]
}
const noMapa = (l, k) => mapasDe(l).includes(k)
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
  if (tipo === 'relacao') {
    // como a relação nominal do arquivo: uma folha por curso, com a proveniência, a função, as habilitações e o telefone
    const inicioTexto = d.inicio ? `Início de ${MESES[Number(d.inicio.slice(5, 7)) - 1]} de ${d.inicio.slice(0, 4)}` : ''
    const COL = ['Nº', 'NIP', 'PATENTE', 'NOME COMPLETO', 'RAMO', 'PROVENIÊNCIA', 'FUNÇÃO', 'HABILITAÇÕES LITERÁRIAS', 'Nº TELEFONE']
    corpo = cursos.map((c, m) => {
      excel.push({ folha: c.sigla ? `${c.turmas[0]?.match(/^\d+\.º/)?.[0] ?? ''} ${c.sigla}`.trim() : c.nome }, ['ESCOLA SUPERIOR DE GUERRA'], ['DIRECÇÃO DE ENSINO'], ['RELAÇÃO NOMINAL DOS DISCENTES'], [c.turmas.join(' / ').toUpperCase()], [inicioTexto], [], COL,
        ...c.linhas.map((l, i) => [String(i + 1).padStart(2, '0'), l.nip, l.posto, l.nome, ramoDe(l), l.orgao, l.funcao, l.habilitacao, l.telefone]))
      return (
        <section key={c.curso} className={m < cursos.length - 1 ? 'of-quebra mb-4' : 'mb-4'}>
          <h2 className="h6 text-uppercase fw-bold text-center mb-0">{c.turmas.join(' / ')}</h2>
          {inicioTexto && <div className="text-center small fw-bold mb-2">{inicioTexto}</div>}
          <table>
            <thead><tr>{COL.map((x) => <th key={x} className={x === 'Nº' ? 'of-num' : ''}>{x}</th>)}</tr></thead>
            <tbody>{c.linhas.map((l, i) => <tr key={l.id}><td className="of-num">{String(i + 1).padStart(2, '0')}</td><td>{l.nip}</td><td>{l.posto}</td><td>{l.nome}</td><td className="of-centro">{ramoDe(l)}</td><td className="small">{l.orgao}</td><td className="small">{l.funcao}</td><td className="small">{l.habilitacao}</td><td className="small">{l.telefone}</td></tr>)}</tbody>
          </table>
        </section>
      )
    })
  } else if (tipo === 'estatistica') {
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
    const mapas = MAPAS_RAMOS.map(([k, titulo]) => [k, titulo]).concat([...new Set(cursos.flatMap((c) => c.linhas.flatMap(mapasDe)))].filter((k) => !MAPAS_RAMOS.some(([x]) => x === k)).map((k) => [k, k]))
      .filter(([k]) => cursos.some((c) => c.linhas.some((l) => noMapa(l, k))))
    const local = `Escola Superior de Guerra do EMGFAA, em Luanda, ___ de ${MESES[Number(String(d.fim ?? '').slice(5, 7)) - 1] ?? '__________'} de ${String(d.fim ?? '').slice(0, 4) || '____'}.`
    corpo = mapas.map(([k, nome], m) => (
      <section key={k} className={m < mapas.length - 1 ? 'of-quebra mb-4' : 'mb-4'}>
        <h2 className="h6 text-uppercase fw-bold text-center mb-3">Mapa do grau de aproveitamento de oficiais discentes {nome}<br />do ano académico {ano}</h2>
        {excel.push({ folha: nome.replace(/^d[oa]s? /, '').toUpperCase() }, [`MAPA DO GRAU DE APROVEITAMENTO DE OFICIAIS DISCENTES ${nome.toUpperCase()}`], [`DO ANO ACADÉMICO ${ano}`], []) && null}
        {cursos.filter((c) => c.linhas.some((l) => noMapa(l, k))).map((c) => {
          const ls = c.linhas.filter((l) => noMapa(l, k))
          excel.push([`${nome.toUpperCase()} — ${nomeCurso(c)}`], ['Nº', 'NIP', 'Patente', 'Nome completo', 'Início e término', 'Média', 'Classificação'], ...ls.map((l, i) => [String(i + 1).padStart(2, '0'), l.nip, l.posto, l.nome, i ? '-' : periodoCurto, decimal(l.final), classificacao(l)]), ['', '', '', '', '', 'TOTAL GERAL', String(ls.length).padStart(2, '0')], [])
          return (
            <div key={c.curso} className="mb-3">
              <div className="fw-bold text-uppercase text-center">{nomeCurso(c)}</div>
              <table>
                <thead><tr><th className="of-num">Nº</th><th>NIP</th><th>Patente</th><th>Nome completo</th><th className="of-centro">Início e término</th><th className="of-centro">Média</th><th className="of-centro">Classificação</th></tr></thead>
                <tbody>{ls.map((l, i) => <tr key={l.id}><td className="of-num">{String(i + 1).padStart(2, '0')}</td><td>{l.nip}</td><td>{l.posto}</td><td>{l.nome}{['CMPR', 'SISM', 'MINDEN'].includes(k) && l.ramo ? ` (${l.ramo})` : ''}</td><td className="of-centro small">{i ? '-' : periodoCurto}</td><td className="of-centro">{fmt(l.final)}</td><td className="of-centro">{classificacao(l)}</td></tr>)}</tbody>
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
  } else if (tipo === 'envio') {
    // as notas de envio dos mapas (como as do arquivo): uma por entidade que tem discentes neste ano
    const comDiscentes = MAPAS_RAMOS.filter(([k]) => cursos.some((c) => c.linhas.some((l) => noMapa(l, k))))
    const cmdt = quem.comandante
    const mes = d.fim ? MESES[Number(d.fim.slice(5, 7)) - 1] : '__________'
    corpo = comDiscentes.map(([k, , destino, texto], m) => {
      excel.push({ folha: k }, ['FORÇAS ARMADAS ANGOLANAS'], ['ESTADO-MAIOR GENERAL'], ['ESCOLA SUPERIOR DE GUERRA'], [], ['À:'], ...destino.split('\n').map((x) => [x]), ['= L U A N D A ='], [], [`N/ NOTA DE REFª Nº _______GAB.CMDT.ESG/EMGFAA/${String(d.fim ?? '').slice(0, 4)}`], ['ASSUNTO: NOTA DE ENVIO'], ['Os Nossos Melhores Cumprimentos'],
        [`O Comando da Escola Superior de Guerra (ESG), vem através desta proceder o envio do Mapa do Grau de Aproveitamento de Oficiais Discentes ${texto}, referente ao Ano Académico ${ano}.`], ['Sem mais assunto de momento.'], [], [`ESCOLA SUPERIOR DE GUERRA DO EMGFAA, em Luanda, ___ de ${mes} de ${String(d.fim ?? '').slice(0, 4)}`], ['O COMANDANTE DA ESG'], [(cmdt?.nome || '').toUpperCase()], [cmdt?.posto ? `**${cmdt.posto.toUpperCase()}**` : ''])
      return (
        <section key={k} className={m < comDiscentes.length - 1 ? 'of-quebra mb-5' : 'mb-5'}>
          <div className="mb-3"><b>À:</b><br />{destino.split('\n').map((x) => <div key={x} className="fw-bold">{x}</div>)}<div className="ms-5">= L U A N D A =</div></div>
          <div className="mb-2">N/ NOTA DE REFª Nº _______GAB.CMDT.ESG/EMGFAA/{String(d.fim ?? '').slice(0, 4)}</div>
          <div className="mb-3"><b>ASSUNTO: NOTA DE ENVIO</b></div>
          <p>Os Nossos Melhores Cumprimentos</p>
          <p style={{ textIndent: '3em', textAlign: 'justify' }}>O Comando da Escola Superior de Guerra (ESG), vem através desta proceder o envio do Mapa do Grau de Aproveitamento de Oficiais Discentes {texto}, referente ao Ano Académico {ano}.</p>
          <p>Sem mais assunto de momento.</p>
          <p className="text-center mt-4">ESCOLA SUPERIOR DE GUERRA DO EMGFAA, em Luanda, ___ de {mes} de {String(d.fim ?? '').slice(0, 4)}</p>
          <div className="text-center mt-4"><div className="fw-bold">O COMANDANTE DA ESG</div><div className="mt-4">{(cmdt?.nome || '').toUpperCase()}</div><div className="fw-bold">{cmdt?.posto ? `**${cmdt.posto.toUpperCase()}**` : ''}</div></div>
        </section>
      )
    })
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
      paisagem={tipo === 'estatistica' || tipo === 'ramos' || tipo === 'relacao'}
      acoes={(
        <>
          <select className="form-select" style={{ width: 'auto' }} value={tipo} onChange={(e) => navegar(`/academico/documentos/ano/${e.target.value}?ano=${encodeURIComponent(ano)}`)} aria-label="Documento">
            {Object.entries(DOCUMENTOS_ANO).map(([k, t]) => <option key={k} value={k}>{t}</option>)}
          </select>
          <select className="form-select" style={{ width: 160 }} value={ano} onChange={(e) => setParams({ ano: e.target.value })} aria-label="Ano lectivo">
            {anos.map((a) => <option key={a.id} value={a.id}>{a.id}{a.atual ? ' (actual)' : ''}</option>)}
          </select>
          {tipo === 'entrega' && <label className="d-flex align-items-center gap-1 small">Por grupo <input type="number" min={1} max={100} className="form-control form-control-sm" style={{ width: 70 }} value={grupo} onChange={(e) => setGrupo(Math.max(1, Number(e.target.value) || 1))} /></label>}
          <button type="button" className="btn btn-white" onClick={() => descarregarCsv(ficheiro, excel.some((x) => x && !Array.isArray(x) && x.folha) ? excel : [['ESCOLA SUPERIOR DE GUERRA'], [`${titulo} — ano lectivo ${ano}`.toUpperCase()], [], ...excel])}><i className="fa fa-file-excel me-1 text-success" />Exportar Excel</button>
        </>
      )}
    >
      {!cursos.length ? <p className="text-center">Ainda não há discentes nas turmas deste ano lectivo. <Link to="/academico/turmas">Turmas</Link></p> : corpo}
    </Documento>
  )
}

export default DocumentosAno
