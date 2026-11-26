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
const peso = (u, formula) => (formula !== 'blocos' && u.creditos > 0 ? u.creditos : 1)
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
  const comMedias = formula !== 'media'
  const ajuste = d.plano.ajusteMaximo > 0
  const termo = d.plano.termo === 'auditor' ? 'Auditor' : 'Discente'
  const ucs = d.blocos.flatMap((b) => b.ucs)

  // o Excel com as fórmulas das pautas: média de cada bloco, média final e classificação
  async function excel() {
    const { default: escrever } = await import('write-excel-file/browser')
    const C = (v, extra = {}) => ({ value: v, ...extra })
    const fixas = ['Nº', 'NIP', 'Posto', 'Ramo', 'Nome']
    const cab1 = [...fixas.map(() => C('')), ...d.blocos.flatMap((b) => [C(b.nome, { fontWeight: 'bold', columnSpan: b.ucs.length + (comMedias ? 1 : 0) }), ...Array(b.ucs.length + (comMedias ? 1 : 0) - 1).fill(null)]), ...(ajuste ? [C('')] : []), C('Média final', { fontWeight: 'bold' }), C('Classificação', { fontWeight: 'bold' })]
    const cab2 = [...fixas.map((t) => C(t, { fontWeight: 'bold' })), ...d.blocos.flatMap((b) => [...b.ucs.map((u) => C(u.codigo, { fontWeight: 'bold' })), ...(comMedias ? [C('Média', { fontWeight: 'bold' })] : [])]), ...(ajuste ? [C('Ajuste', { fontWeight: 'bold' })] : []), C(''), C('')]
    const linha0 = 5 // as linhas dos estudantes começam na 6.ª (1-based): título, curso, vazia, cabeçalho 1, cabeçalho 2
    const linhas = d.linhas.map((l, i) => {
      const r = linha0 + i + 1
      let col = fixas.length
      const celulas = [C(i + 1, { type: Number }), C(l.estudante.nip), C(l.estudante.posto), C(l.estudante.ramo), C(l.estudante.nome)]
      const mediasBloco = []
      const todasUcs = []
      for (const b of d.blocos) {
        const refs = b.ucs.map((u) => { const ref = `${coluna(col)}${r}`; col++; return { u, ref } })
        for (const { u } of refs) celulas.push(l.ucs[u.codigo] === null || l.ucs[u.codigo] === undefined ? C(null) : C(Number(l.ucs[u.codigo]), { type: Number, format: '0.00' }))
        todasUcs.push(...refs.map((x) => x.ref))
        if (comMedias) {
          const soma = refs.reduce((s, x) => s + peso(x.u, formula), 0)
          const f = formula === 'blocos' ? `=ROUND(AVERAGE(${refs[0].ref}:${refs[refs.length - 1].ref}),2)` : `=ROUND((${refs.map((x) => `${x.ref}*${peso(x.u, formula)}`).join('+')})/${soma},2)`
          celulas.push(C(f, { type: 'Formula', format: '0.00', fontWeight: 'bold' }))
          mediasBloco.push({ ref: `${coluna(col)}${r}`, coef: b.coeficiente })
          col++
        }
      }
      let refAjuste = ''
      if (ajuste) { celulas.push(C(Number(l.ajuste) || 0, { type: Number, format: '0.00' })); refAjuste = `+${coluna(col)}${r}`; col++ }
      const base = comMedias ? `(${mediasBloco.map((x) => `${x.ref}*${x.coef}`).join('+')})/${mediasBloco.reduce((s, x) => s + x.coef, 0)}` : `AVERAGE(${todasUcs[0]}:${todasUcs[todasUcs.length - 1]})`
      const refFinal = `${coluna(col)}${r}`
      celulas.push(C(`=ROUND(${base}${refAjuste},2)`, { type: 'Formula', format: '0.00', fontWeight: 'bold' }))
      celulas.push(l.mencao === 'Distinto' ? C('Distinto') : C(`=IF(${refFinal}>=18,"Muito Bom",IF(${refFinal}>=14,"Bom",IF(${refFinal}>=10,"Regular","Reprovado")))`, { type: 'Formula' }))
      return celulas
    })
    const legenda = [[], [C('Legenda', { fontWeight: 'bold' })], ...ucs.map((u) => [C(u.codigo, { fontWeight: 'bold' }), C(u.nome), C(formula === 'ponderada' || formula === 'percentagem' ? `${u.creditos || 1} UCréd` : '')])]
    const n = d.linhas.length
    const colFinal = coluna(cab2.length - 2)
    const estat = n ? [[], [C('Quadro de estatísticas', { fontWeight: 'bold' })], [C('Média'), C(`=ROUND(AVERAGE(${colFinal}${linha0 + 1}:${colFinal}${linha0 + n}),2)`, { type: 'Formula', format: '0.00' })], [C('Nota mais alta'), C(`=MAX(${colFinal}${linha0 + 1}:${colFinal}${linha0 + n})`, { type: 'Formula', format: '0.00' })], [C('Nota mais baixa'), C(`=MIN(${colFinal}${linha0 + 1}:${colFinal}${linha0 + n})`, { type: 'Formula', format: '0.00' })]] : []
    await escrever([[C(`PAUTA ${d.turma.anoLetivo} — ${d.turma.curso}`, { fontWeight: 'bold', fontSize: 13 })], [C(`${d.turma.nome} · ${d.plano.nome}`)], [], cab1, cab2, ...linhas, ...estat, ...legenda], { sheet: 'Pauta', columns: [{ width: 5 }, { width: 12 }, { width: 18 }, { width: 7 }, { width: 38 }] }).toFile(`pauta-final-${d.turma.nome}-${d.turma.anoLetivo}.xlsx`.replace(/[^\w.-]+/g, '-'))
  }

  const dirEnsino = quem.directorEnsino ? { cargo: 'O Director de Ensino', nome: quem.directorEnsino.nome, posto: quem.directorEnsino.posto } : 'O Director de Ensino'
  const dirCurso = director ? { cargo: 'O Director do Curso', nome: director.nome, posto: '' } : 'O Director do Curso'
  const comandante = quem.comandante ? { cargo: quem.comandante.cargo || 'O Comandante da ESG', nome: quem.comandante.nome, posto: quem.comandante.posto } : { cargo: 'O Comandante da ESG' }
  return (
    <Documento
      anoLetivo={d.turma.anoLetivo} paisagem
      titulo={`PAUTA ${d.turma.anoLetivo}`} voltar={`/academico/turmas/${id}`}
      subtitulo={`${d.turma.curso} · ${d.turma.nome} · ${d.linhas.length} ${termo.toLowerCase()}(es)`}
      aprovado={comandante} assinaturas={[dirCurso, dirEnsino]}
      acoes={<button type="button" className="btn btn-white" onClick={() => excel().catch((e) => setErro(e.message))}><i className="fa fa-file-excel me-1 text-success" />Exportar Excel (com as fórmulas)</button>}
    >
      <table className="of-horario">
        <thead>
          <tr>
            <th rowSpan={2} className="of-num">Nº</th><th rowSpan={2}>NIP</th><th rowSpan={2}>Posto</th><th rowSpan={2}>Ramo</th><th rowSpan={2}>Nome completo</th>
            {d.blocos.map((b) => <th key={b.sigla || b.nome} colSpan={b.ucs.length + (comMedias ? 1 : 0)} className="of-centro">{b.nome}{comMedias && b.coeficiente ? ` (×${String(b.coeficiente).replace('.', ',')})` : ''}</th>)}
            {ajuste && <th rowSpan={2} className="of-centro">Ajuste</th>}
            <th rowSpan={2} className="of-centro">Média final</th><th rowSpan={2}>Classificação</th>
          </tr>
          <tr>{d.blocos.map((b) => [...b.ucs.map((u) => <th key={u.id} className="of-centro">{u.codigo}</th>), ...(comMedias ? [<th key={`m-${b.sigla}`} className="of-centro">Média</th>] : [])])}</tr>
        </thead>
        <tbody>
          {d.linhas.map((l, i) => (
            <tr key={l.estudante.id}>
              <td className="of-num">{String(i + 1).padStart(2, '0')}</td><td>{l.estudante.nip}</td><td>{l.estudante.posto}</td><td>{l.estudante.ramo}</td><td>{l.estudante.nome}</td>
              {d.blocos.map((b) => [...b.ucs.map((u) => <td key={u.id} className="of-centro">{fmt(l.ucs[u.codigo])}</td>), ...(comMedias ? [<td key={`m-${b.sigla}`} className="of-centro fw-bold">{fmt(l.blocos[b.sigla])}</td>] : [])])}
              {ajuste && <td className="of-centro">{l.ajuste ? fmt(l.ajuste) : ''}</td>}
              <td className="of-centro fw-bold">{fmt(l.final)}</td><td>{l.mencao ?? ''}</td>
            </tr>
          ))}
        </tbody>
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
      <div className="mt-2 small"><b>Legenda:</b> {ucs.map((u) => `${u.codigo} — ${u.nome}`).join('; ')}.</div>
    </Documento>
  )
}

export default PautaFinal
