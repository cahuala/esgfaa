import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../../../api'
import { Carregando, Erro } from '../../../componentes/Ui'
import Documento from './Documento'

/*
  Pauta final do curso, como as da Repartição de Administração Escolar: as unidades curriculares de cada bloco com
  as notas finais, a média de cada bloco, a média final e a classificação; a legenda das siglas e o quadro de
  estatísticas; «Aprovado» pelo Comandante no canto e as assinaturas do Director do Curso e do Director de Ensino.
  O Excel sai com as fórmulas (as médias dos blocos e a média final calculam-se lá, como nas pautas do arquivo).
*/
const fmt = (v) => (v === null || v === undefined ? '' : Number(v).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
// as cores das pautas da Repartição: os blocos, o cinzento das colunas fixas e o dourado das médias
const CORES_BLOCO = ['#99CCFF', '#00FF00', '#CC99FF', '#FF8080', '#FFCC99', '#CCFFCC']
const CINZA = '#C0C0C0'
const OURO = '#FFCC00'
const coluna = (n) => { let s = ''; for (let k = n + 1; k > 0; k = Math.floor((k - 1) / 26)) s = String.fromCharCode(65 + ((k - 1) % 26)) + s; return s }

function PautaFinal() {
  const { id } = useParams()
  const [d, setD] = useState(null)
  const [quem, setQuem] = useState({})
  const [director, setDirector] = useState(null)
  const [erro, setErro] = useState('')
  useEffect(() => {
    api(`/academico/turmas/${id}/pauta-final`).then((x) => {
      setD(x)
      api('/academico/directores-curso').then((r) => setDirector(r.directores?.[x.turma.cursoId] ?? null)).catch(() => {})
    }).catch((e) => setErro(e.message))
    api('/academico/documentos-academicos').then(setQuem).catch(() => {})
  }, [id])
  if (erro) return <Erro texto={erro} />
  if (!d) return <Carregando />

  const formula = d.plano.formula
  const comBlocos = formula !== 'media' && d.blocos.some((b) => b.sigla)
  const ajuste = d.plano.ajusteMaximo > 0
  const termo = d.plano.termo === 'auditor' ? 'Auditor' : 'Discente'
  const ucs = d.blocos.flatMap((b) => b.ucs)
  // como na pauta assinada: o bloco de uma só cadeira (o TII) não tem coluna «Média»; as disciplinas numeram-se seguidas
  const temMedia = (b) => comBlocos && b.ucs.length > 1
  const numero = new Map(ucs.filter((u) => !u.tii).map((u, i) => [u.id, i + 1]))
  const rotulo = (u) => (numero.has(u.id) ? `${numero.get(u.id)}. ${u.codigo}` : u.codigo)
  // com coeficientes diferentes há a «Média» (simples dos blocos) e a «Média Ponderada» (a final); sem, só a média final
  const ponderada = comBlocos && d.blocos.some((b) => Number(b.coeficiente) !== 1)
  const somaCoef = d.blocos.reduce((s, b) => s + Number(b.coeficiente || 1), 0)
  const notaBloco = (l, b) => (temMedia(b) || !comBlocos ? l.blocos[b.sigla] : l.ucs[b.ucs[0]?.codigo] ?? l.blocos[b.sigla])
  const mediaDe = (vs) => { const x = vs.filter((v) => v !== null && v !== undefined).map(Number); return x.length ? x.reduce((a, b) => a + b, 0) / x.length : null }

  // as cores dos blocos como nas pautas da Repartição (I azul, II verde, III lilás, IV salmão; o TII amarelo claro)
  const corBloco = (b, i) => (b.ucs.length === 1 && b.ucs[0].tii ? '#FFFF99' : CORES_BLOCO[i % CORES_BLOCO.length])

  // o Excel com o desenho e as contas da pauta da Repartição: as médias dos blocos (sem as cadeiras a 0), a média,
  // a ponderada e a ordenação com fórmulas (só onde dão o mesmo que a pauta assinada)
  async function excel() {
    const { default: escrever } = await import('write-excel-file/browser')
    const base = { fontFamily: 'Calibri', fontSize: 10, alignVertical: 'center' }
    // a biblioteca do Excel põe ela o «=» das fórmulas (com dois, o Excel não as reconhece)
    const C = (v, extra = {}) => ({ value: extra.type === 'Formula' ? String(v).replace(/^=/, '') : v, ...base, ...extra })
    const caixa = { borderStyle: 'thin', borderColor: '#000000' }
    const Cab = (v, cor, extra = {}) => C(v, { ...caixa, fontWeight: 'bold', align: 'center', wrap: true, ...(cor ? { backgroundColor: cor } : {}), ...extra })
    const fixas = ['Nº Ord', 'NIP', 'Posto', 'NOME']
    const blocoCols = (b) => b.ucs.length + (temMedia(b) ? 1 : 0)
    const fim = [...(ajuste ? [['Ajuste', null]] : []), ...(ponderada ? [['Média', OURO], ['Média Ponderada', OURO]] : [['Média final', OURO]]), ['Ordenação', null], ['Classificação', null]]
    const span = (cel, n) => [{ ...cel, ...(n > 1 ? { columnSpan: n } : {}) }, ...Array(Math.max(0, n - 1)).fill(null)]
    const vazio = () => C('')
    const coefs = [...fixas.map(vazio), ...d.blocos.flatMap((b, i) => span(Cab(`Coeficiente ${String(b.coeficiente).replace('.', ',')}`, corBloco(b, i), { fontSize: 8 }), blocoCols(b))), ...fim.map(vazio)]
    const cab1 = [...fixas.map((t) => Cab(t, CINZA, { rowSpan: 2 })), ...d.blocos.flatMap((b, i) => span(Cab(b.nome, corBloco(b, i)), blocoCols(b))), ...fim.map(([t, cor]) => Cab(t, cor, { rowSpan: 2 }))]
    const cab2 = [...fixas.map(() => null), ...d.blocos.flatMap((b, i) => [...b.ucs.map((u) => Cab(rotulo(u), corBloco(b, i))), ...(temMedia(b) ? [Cab('Média', corBloco(b, i))] : [])]), ...fim.map(() => null)]
    const so = comBlocos ? null : [[...fixas.map((t) => Cab(t, CINZA)), ...ucs.map((u) => Cab(rotulo(u), CORES_BLOCO[0])), ...fim.map(([t, cor]) => Cab(t, cor))]]
    const A = { fontFamily: 'Arial', fontSize: 12, fontWeight: 'bold' }
    const topo = [[], [C('APROVADO', A)], [C((comandante.cargo || 'O Comandante da ESG').toUpperCase(), A)], [], [C((comandante.nome || '').toUpperCase(), { fontFamily: 'Arial', fontSize: 12 })], [C(comandante.posto ? `**${comandante.posto.toUpperCase()}**` : '', A)], [],
      [C(`PAUTA ${d.turma.anoLetivo} — ${d.turma.curso}`.toUpperCase(), { ...A, fontSize: 11 })], [C(d.turma.nome)], []]
    const linha0 = topo.length + (comBlocos ? 3 : 1) // os estudantes começam a seguir aos cabeçalhos (1-based: linha0 + 1)
    const n = d.linhas.length
    const ult = linha0 + n
    const nota = (v, extra = {}) => (v === null || v === undefined ? C(null, { ...caixa, ...extra }) : C(Number(v), { type: Number, format: '0.00', align: 'center', ...caixa, ...extra }))
    const linhas = d.linhas.map((l, i) => {
      const r = linha0 + i + 1
      let col = fixas.length
      const p = { ...caixa, fontSize: 9 }
      const celulas = [C(i + 1, { type: Number, align: 'center', ...caixa }), C(l.estudante.nip, p), C((l.estudante.posto || '').toUpperCase(), p), C((l.estudante.nome || '').toUpperCase(), p)]
      const medias = []
      for (const b of d.blocos) {
        const a = `${coluna(col)}${r}`
        const tii = b.ucs.length === 1 && b.ucs[0].tii
        for (const u of b.ucs) { celulas.push(nota(l.ucs[u.codigo], tii && comBlocos ? { backgroundColor: '#00FF00' } : {})); col++ }
        const z = `${coluna(col - 1)}${r}`
        // a fórmula só quando dá o mesmo que a pauta assinada (há pautas com pesos dentro do bloco que a folha não diz)
        const calc = mediaDe(b.ucs.map((u) => (Number(l.ucs[u.codigo]) > 0 ? l.ucs[u.codigo] : null)))
        const v = notaBloco(l, b)
        if (temMedia(b)) {
          celulas.push(v === null || v === undefined || (calc !== null && Math.abs(calc - v) < 0.006) ? C(`=IFERROR(AVERAGEIF(${a}:${z},">0"),"")`, { type: 'Formula', format: '0.00', align: 'center', ...caixa }) : nota(v))
          medias.push({ ref: `${coluna(col)}${r}`, coef: b.coeficiente, v }); col++
        } else medias.push({ ref: a, coef: b.coeficiente, v })
      }
      let refAjuste = ''
      if (ajuste) { celulas.push(nota(Number(l.ajuste) || 0)); refAjuste = `+${coluna(col)}${r}`; col++ }
      const todas = `${coluna(fixas.length)}${r}:${coluna(col - 1 - (ajuste ? 1 : 0))}${r}`
      const simples = comBlocos ? `AVERAGE(${medias.map((x) => x.ref).join(',')})` : `AVERAGEIF(${todas},">0")`
      const ouro = { backgroundColor: OURO }
      if (ponderada) { celulas.push(l.mediaSimples === null ? nota(null, ouro) : C(`=IFERROR(${simples},"")`, { type: 'Formula', format: '0.00', align: 'center', ...caixa, ...ouro })); col++ }
      const conta = comBlocos ? (ponderada ? medias.reduce((t, x) => t + Number(x.v) * x.coef, 0) / somaCoef : medias.reduce((t, x) => t + Number(x.v), 0) / medias.length) + (Number(l.ajuste) || 0)
        : mediaDe(ucs.map((u) => (Number(l.ucs[u.codigo]) > 0 ? l.ucs[u.codigo] : null)))
      const formulaFinal = ponderada ? `(${medias.map((x) => `${x.ref}*${x.coef}`).join('+')})/${somaCoef}` : simples
      celulas.push(l.final === null ? nota(null, ouro) : Math.abs(conta - l.final) < 0.006 ? C(`=ROUND(${formulaFinal}${refAjuste},2)`, { type: 'Formula', format: '0.00', align: 'center', fontWeight: 'bold', ...caixa, ...ouro }) : nota(l.final, { fontWeight: 'bold', ...ouro }))
      const rf = coluna(col)
      celulas.push(l.final === null ? C(null, caixa) : C(`=RANK(${rf}${r},${rf}$${linha0 + 1}:${rf}$${ult})`, { type: 'Formula', align: 'center', ...caixa }))
      celulas.push(l.mencao === 'Distinto' ? C('Distinto', caixa) : l.final === null ? C(null, caixa) : C(`=IF(${rf}${r}>=18,"Muito Bom",IF(${rf}${r}>=14,"Bom",IF(${rf}${r}>=10,"Regular","Reprovado")))`, { type: 'Formula', ...caixa }))
      return celulas
    })
    // a linha «Média» da turma, a amarelo, coluna a coluna
    const total = (so ? so[0] : cab1).length - 2
    const am = { ...caixa, fontWeight: 'bold', backgroundColor: '#FFFF00', align: 'center' }
    const mediaTurma = n ? [[C(''), C(''), C(''), C('Média', { ...am, align: 'right' }), ...Array.from({ length: total - fixas.length }, (_, k) => { const c = coluna(fixas.length + k); return C(`=IFERROR(AVERAGE(${c}${linha0 + 1}:${c}${ult}),"")`, { type: 'Formula', format: '0.00', ...am }) })]] : []
    const legenda = [[], [C('Legenda', { fontWeight: 'bold' })], [Cab('Sigla', CINZA), Cab('Disciplina', CINZA, { columnSpan: 3 }), null, null, Cab('Carga horária', CINZA, { columnSpan: 2 }), null], ...ucs.map((u) => [C(u.codigo, { ...caixa, fontWeight: 'bold' }), C(u.nome, { ...caixa, columnSpan: 3 }), null, null, C(u.horas ? `${u.horas} h` : '', { ...caixa, align: 'center', columnSpan: 2 }), null])]
    const S = { fontFamily: 'Arial', fontSize: 11, fontWeight: 'bold', align: 'center' }
    const meio = Math.max(fixas.length + 2, Math.floor(total / 2) + 2)
    const par = (a, b) => { const r = Array.from({ length: meio + 1 }, () => C('')); r[3] = C(a, S); r[meio] = C(b, S); return r }
    const pessoa = (x) => (typeof x === 'object' ? x : { cargo: x })
    const dc = pessoa(dirCurso)
    const de = pessoa(dirEnsino)
    const data = new Date().toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase()
    const assinaturas = [[], [C(''), C(''), C(''), C(`LUANDA, AOS ${data}`, { fontFamily: 'Arial', fontSize: 11 })], [],
      par((dc.cargo || 'O Director do Curso').toUpperCase(), (de.cargo || 'O Director de Ensino').toUpperCase()), [],
      par('______________________________', '______________________________'),
      par((dc.nome || '').toUpperCase(), (de.nome || '').toUpperCase()),
      par(dc.posto ? `***${dc.posto.toUpperCase()}***` : '', de.posto ? `*${de.posto.toUpperCase()}*` : '')]
    const larguras = [{ width: 5 }, { width: 11 }, { width: 15 }, { width: 36 }, ...Array.from({ length: total - fixas.length + 2 }, () => ({ width: 8 }))]
    await escrever([...topo, ...(comBlocos ? [coefs, cab1, cab2] : so), ...linhas, ...mediaTurma, ...assinaturas, ...legenda], { sheet: 'Pauta', columns: larguras, orientation: 'landscape', stickyRowsCount: linha0 })
      .toFile(`pauta-final-${d.turma.nome}-${d.turma.anoLetivo}.xlsx`.replace(/[^\w.-]+/g, '-'))
  }

  const dirEnsino = quem.directorEnsino ? { cargo: 'O Director de Ensino', nome: quem.directorEnsino.nome, posto: quem.directorEnsino.posto } : 'O Director de Ensino'
  const dirCurso = director ? { cargo: 'O Director do Curso', nome: director.nome, posto: director.posto || '' } : 'O Director do Curso'
  const comandante = quem.comandante ? { cargo: quem.comandante.cargo || 'O Comandante da ESG', nome: quem.comandante.nome, posto: quem.comandante.posto } : { cargo: 'O Comandante da ESG' }
  return (
    <Documento
      anoLetivo={d.turma.anoLetivo} paisagem
      titulo={`PAUTA ${d.turma.anoLetivo}`} voltar={`/academico/turmas/${id}`}
      subtitulo={`${d.turma.curso} · ${d.turma.nome} · ${d.linhas.length} ${termo.toLowerCase()}(es)`}
      aprovado={comandante} assinaturas={[dirCurso, dirEnsino]}
      acoes={<button type="button" className="btn btn-white" onClick={() => excel().catch((e) => setErro(e.message))}><i className="fa fa-file-excel me-1 text-success" />Exportar Excel (com as fórmulas)</button>}
    >
      <table className="of-horario of-pauta-geral">
        <thead>
          {comBlocos && (
            <tr className="of-coeficientes">
              <th colSpan={4} className="border-0" />
              {d.blocos.map((b, i) => <th key={`c-${b.sigla}`} colSpan={b.ucs.length + (temMedia(b) ? 1 : 0)} className="of-centro fw-normal" style={{ background: corBloco(b, i), fontSize: '0.85em' }}>Coeficiente {String(b.coeficiente).replace('.', ',')}</th>)}
              <th colSpan={(ajuste ? 1 : 0) + (ponderada ? 2 : 1) + 2} className="border-0" />
            </tr>
          )}
          <tr>
            {['Nº Ord', 'NIP', 'Posto', 'Nome'].map((t) => <th key={t} rowSpan={comBlocos ? 2 : 1} className="of-centro" style={{ background: CINZA }}>{t}</th>)}
            {comBlocos
              ? d.blocos.map((b, i) => <th key={b.sigla} colSpan={b.ucs.length + (temMedia(b) ? 1 : 0)} className="of-centro" style={{ background: corBloco(b, i) }}>{b.nome}</th>)
              : ucs.map((u) => <th key={u.id} className="of-centro" style={{ background: CORES_BLOCO[0] }}>{rotulo(u)}</th>)}
            {ajuste && <th rowSpan={comBlocos ? 2 : 1} className="of-centro">Ajuste</th>}
            {ponderada && <th rowSpan={2} className="of-centro" style={{ background: OURO }}>Média</th>}
            <th rowSpan={comBlocos ? 2 : 1} className="of-centro" style={{ background: OURO }}>{ponderada ? 'Média Ponderada' : 'Média final'}</th>
            <th rowSpan={comBlocos ? 2 : 1} className="of-centro">Ordenação</th><th rowSpan={comBlocos ? 2 : 1}>Classificação</th>
          </tr>
          {comBlocos && <tr>{d.blocos.map((b, i) => [...b.ucs.map((u) => <th key={u.id} className="of-centro" style={{ background: corBloco(b, i) }}>{rotulo(u)}</th>), ...(temMedia(b) ? [<th key={`m-${b.sigla}`} className="of-centro" style={{ background: corBloco(b, i) }}>Média</th>] : [])])}</tr>}
        </thead>
        <tbody>
          {d.linhas.map((l, i) => (
            <tr key={l.estudante.id}>
              <td className="of-centro">{i + 1}</td><td>{l.estudante.nip}</td><td>{(l.estudante.posto || '').toUpperCase()}</td><td>{(l.estudante.nome || '').toUpperCase()}</td>
              {d.blocos.map((b) => [...b.ucs.map((u) => <td key={u.id} className="of-centro" style={comBlocos && b.ucs.length === 1 && u.tii ? { background: '#00FF00' } : undefined}>{fmt(l.ucs[u.codigo])}</td>), ...(temMedia(b) ? [<td key={`m-${b.sigla}`} className="of-centro">{fmt(l.blocos[b.sigla])}</td>] : [])])}
              {ajuste && <td className="of-centro">{l.ajuste ? fmt(l.ajuste) : ''}</td>}
              {ponderada && <td className="of-centro" style={{ background: OURO }}>{fmt(l.mediaSimples)}</td>}
              <td className="of-centro fw-bold" style={{ background: OURO }}>{fmt(l.final)}</td>
              <td className="of-centro">{l.ordem ?? ''}</td><td>{l.mencao ?? ''}</td>
            </tr>
          ))}
        </tbody>
        {d.linhas.length > 0 && (
          <tfoot>
            <tr className="fw-bold" style={{ background: '#FFFF00' }}>
              <td colSpan={4} className="text-end">Média</td>
              {d.blocos.map((b) => [...b.ucs.map((u) => <td key={u.id} className="of-centro">{fmt(mediaDe(d.linhas.map((l) => l.ucs[u.codigo])))}</td>), ...(temMedia(b) ? [<td key={`m-${b.sigla}`} className="of-centro">{fmt(mediaDe(d.linhas.map((l) => notaBloco(l, b))))}</td>] : [])])}
              {ajuste && <td />}
              {ponderada && <td className="of-centro">{fmt(mediaDe(d.linhas.map((l) => l.mediaSimples)))}</td>}
              <td className="of-centro">{fmt(mediaDe(d.linhas.map((l) => l.final)))}</td><td /><td />
            </tr>
          </tfoot>
        )}
      </table>
      {d.estatistica && (
        <table className="mt-2" style={{ width: 'auto' }}>
          <tbody>
            <tr><th colSpan={2}>Quadro de estatísticas</th></tr>
            <tr><td>Média</td><td className="of-centro">{fmt(d.estatistica.media)}</td></tr>
            <tr><td>Nota mais alta</td><td className="of-centro">{fmt(d.estatistica.maxima)}</td></tr>
            <tr><td>Nota mais baixa</td><td className="of-centro">{fmt(d.estatistica.minima)}</td></tr>
          </tbody>
        </table>
      )}
      {/* a legenda, como no Excel do arquivo: a sigla, a disciplina por extenso e a carga horária */}
      <table className="mt-2" style={{ width: 'auto' }}>
        <thead><tr><th>Sigla</th><th>Disciplina</th><th className="of-centro">Carga horária</th></tr></thead>
        <tbody>{ucs.map((u) => <tr key={u.id}><td><b>{u.codigo}</b></td><td>{u.nome}</td><td className="of-centro">{u.horas ? `${u.horas} h` : '—'}</td></tr>)}</tbody>
        {ucs.some((u) => u.horas) && <tfoot><tr><th colSpan={2} className="text-end">Total</th><th className="of-centro">{ucs.reduce((t, u) => t + (u.horas || 0), 0)} h</th></tr></tfoot>}
      </table>
    </Documento>
  )
}

export default PautaFinal
