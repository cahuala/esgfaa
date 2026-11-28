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

  // o Excel como o da Repartição: as médias dos blocos (sem as cadeiras a 0), a média, a ponderada e a ordenação com fórmulas
  async function excel() {
    const { default: escrever } = await import('write-excel-file/browser')
    const C = (v, extra = {}) => ({ value: v, ...extra })
    const B = (v, extra = {}) => C(v, { fontWeight: 'bold', align: 'center', ...extra })
    const fixas = ['Nº Ord', 'NIP', 'Posto', 'NOME']
    const blocoCols = (b) => b.ucs.length + (temMedia(b) ? 1 : 0)
    const fim = [...(ajuste ? ['Ajuste'] : []), ...(ponderada ? ['Média', 'Média Ponderada'] : ['Média final']), 'Ordenação', 'Classificação']
    const span = (texto, n, extra) => [B(texto, { ...extra, ...(n > 1 ? { columnSpan: n } : {}) }), ...Array(Math.max(0, n - 1)).fill(null)]
    const coefs = [...fixas.map(() => C('')), ...d.blocos.flatMap((b) => span(comBlocos ? `Coeficiente ${String(b.coeficiente).replace('.', ',')}` : '', blocoCols(b), { fontWeight: 'normal' })), ...fim.map(() => C(''))]
    const cab1 = [...fixas.map(() => C('')), ...d.blocos.flatMap((b) => span(comBlocos ? b.nome : '', blocoCols(b))), ...fim.map(() => C(''))]
    const cab2 = [...fixas.map((t) => B(t)), ...d.blocos.flatMap((b) => [...b.ucs.map((u) => B(rotulo(u))), ...(temMedia(b) ? [B('Média')] : [])]), ...fim.map((t) => B(t))]
    const topo = [[C('APROVADO', { fontWeight: 'bold' })], [C(comandante.cargo?.toUpperCase() ?? 'O COMANDANTE DA ESG')], [C(comandante.nome?.toUpperCase() ?? '')], [C(comandante.posto?.toUpperCase() ?? '', { fontWeight: 'bold' })], [],
      [C(`PAUTA ${d.turma.anoLetivo} — ${d.turma.curso}`.toUpperCase(), { fontWeight: 'bold', fontSize: 13 })], [C(d.turma.nome)], []]
    const linha0 = topo.length + (comBlocos ? 3 : 1) // os estudantes começam a seguir aos cabeçalhos (1-based: linha0 + 1)
    const n = d.linhas.length
    const ult = linha0 + n
    const num = (v) => (v === null || v === undefined ? C(null) : C(Number(v), { type: Number, format: '0.00' }))
    const linhas = d.linhas.map((l, i) => {
      const r = linha0 + i + 1
      let col = fixas.length
      const celulas = [C(i + 1, { type: Number }), C(l.estudante.nip), C(l.estudante.posto), C(l.estudante.nome)]
      const medias = []
      for (const b of d.blocos) {
        const a = `${coluna(col)}${r}`
        for (const u of b.ucs) { celulas.push(num(l.ucs[u.codigo])); col++ }
        const z = `${coluna(col - 1)}${r}`
        // a fórmula só quando dá o mesmo que a pauta assinada (há pautas com pesos dentro do bloco que a folha não diz)
        const calc = mediaDe(b.ucs.map((u) => (Number(l.ucs[u.codigo]) > 0 ? l.ucs[u.codigo] : null)))
        const v = notaBloco(l, b)
        if (temMedia(b)) {
          celulas.push(v === null || v === undefined || (calc !== null && Math.abs(calc - v) < 0.006) ? C(`=IFERROR(AVERAGEIF(${a}:${z},">0"),"")`, { type: 'Formula', format: '0.00', fontWeight: 'bold' }) : C(Number(v), { type: Number, format: '0.00', fontWeight: 'bold' }))
          medias.push({ ref: `${coluna(col)}${r}`, coef: b.coeficiente, v }); col++
        } else medias.push({ ref: a, coef: b.coeficiente, v })
      }
      let refAjuste = ''
      if (ajuste) { celulas.push(C(Number(l.ajuste) || 0, { type: Number, format: '0.00' })); refAjuste = `+${coluna(col)}${r}`; col++ }
      const todas = `${coluna(fixas.length)}${r}:${coluna(col - 1 - (ajuste ? 1 : 0))}${r}`
      const simples = comBlocos ? `AVERAGE(${medias.map((x) => x.ref).join(',')})` : `AVERAGEIF(${todas},">0")`
      if (ponderada) { celulas.push(C(`=IFERROR(${simples},"")`, { type: 'Formula', format: '0.00' })); col++ }
      const base = ponderada ? `(${medias.map((x) => `${x.ref}*${x.coef}`).join('+')})/${somaCoef}` : simples
      // a média final é a da pauta assinada (no arquivo) — a fórmula refaz a conta; se a pauta não a tem, fica em branco
      const vs = comBlocos ? medias.map((x) => (x.v === null || x.v === undefined ? NaN : Number(x.v))) : []
      const conta = comBlocos ? (ponderada ? vs.reduce((t, v, k) => t + v * medias[k].coef, 0) / somaCoef : vs.reduce((t, v) => t + v, 0) / vs.length) + (Number(l.ajuste) || 0)
        : mediaDe(ucs.map((u) => (Number(l.ucs[u.codigo]) > 0 ? l.ucs[u.codigo] : null)))
      celulas.push(l.final === null ? C(null) : Math.abs(conta - l.final) < 0.006 ? C(`=ROUND(${base}${refAjuste},2)`, { type: 'Formula', format: '0.00', fontWeight: 'bold' }) : C(Number(l.final), { type: Number, format: '0.00', fontWeight: 'bold' }))
      const rf = coluna(col)
      celulas.push(l.final === null ? C(null) : C(`=RANK(${rf}${r},${rf}$${linha0 + 1}:${rf}$${ult})`, { type: 'Formula' }))
      celulas.push(l.mencao === 'Distinto' ? C('Distinto') : l.final === null ? C(null) : C(`=IF(${rf}${r}>=18,"Muito Bom",IF(${rf}${r}>=14,"Bom",IF(${rf}${r}>=10,"Regular","Reprovado")))`, { type: 'Formula' }))
      return celulas
    })
    // a linha «Média» da turma, coluna a coluna
    const total = cab2.length - 2
    const mediaTurma = n ? [[C(''), C(''), C(''), B('Média'), ...Array.from({ length: total - fixas.length }, (_, k) => { const c = coluna(fixas.length + k); return C(`=IFERROR(AVERAGE(${c}${linha0 + 1}:${c}${ult}),"")`, { type: 'Formula', format: '0.00', fontWeight: 'bold' }) })]] : []
    const legenda = [[], [C('Legenda', { fontWeight: 'bold' })], [B('Sigla'), B('Disciplina'), B('Carga horária')], ...ucs.map((u) => [C(u.codigo, { fontWeight: 'bold' }), C(u.nome), C(u.horas ? `${u.horas} h` : '')])]
    const assinaturas = [[], [C(dirCurso.cargo?.toUpperCase?.() ?? 'O DIRECTOR DO CURSO'), C(''), C(''), C(''), C(''), C(dirEnsino.cargo?.toUpperCase?.() ?? 'O DIRECTOR DE ENSINO')], [], [C(dirCurso.nome?.toUpperCase?.() ?? ''), C(''), C(''), C(''), C(''), C(dirEnsino.nome?.toUpperCase?.() ?? '')], [C(dirCurso.posto?.toUpperCase?.() ?? ''), C(''), C(''), C(''), C(''), C(dirEnsino.posto?.toUpperCase?.() ?? '')]]
    await escrever([...topo, ...(comBlocos ? [coefs, cab1] : []), cab2, ...linhas, ...mediaTurma, ...legenda, ...assinaturas], { sheet: 'Pauta', columns: [{ width: 6 }, { width: 12 }, { width: 16 }, { width: 38 }] }).toFile(`pauta-final-${d.turma.nome}-${d.turma.anoLetivo}.xlsx`.replace(/[^\w.-]+/g, '-'))
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
          {comBlocos && (
            <tr className="of-coeficientes">
              <th colSpan={4} className="border-0" />
              {d.blocos.map((b) => <th key={`c-${b.sigla}`} colSpan={b.ucs.length + (temMedia(b) ? 1 : 0)} className="of-centro fw-normal">Coeficiente {String(b.coeficiente).replace('.', ',')}</th>)}
              <th colSpan={(ajuste ? 1 : 0) + (ponderada ? 2 : 1) + 2} className="border-0" />
            </tr>
          )}
          <tr>
            <th rowSpan={comBlocos ? 2 : 1} className="of-num">Nº Ord</th><th rowSpan={comBlocos ? 2 : 1}>NIP</th><th rowSpan={comBlocos ? 2 : 1}>Posto</th><th rowSpan={comBlocos ? 2 : 1}>Nome</th>
            {comBlocos
              ? d.blocos.map((b) => <th key={b.sigla} colSpan={b.ucs.length + (temMedia(b) ? 1 : 0)} className="of-centro">{b.nome}</th>)
              : ucs.map((u) => <th key={u.id} className="of-centro">{rotulo(u)}</th>)}
            {ajuste && <th rowSpan={comBlocos ? 2 : 1} className="of-centro">Ajuste</th>}
            {ponderada && <th rowSpan={2} className="of-centro">Média</th>}
            <th rowSpan={comBlocos ? 2 : 1} className="of-centro">{ponderada ? 'Média Ponderada' : 'Média final'}</th>
            <th rowSpan={comBlocos ? 2 : 1} className="of-centro">Ordenação</th><th rowSpan={comBlocos ? 2 : 1}>Classificação</th>
          </tr>
          {comBlocos && <tr>{d.blocos.map((b) => [...b.ucs.map((u) => <th key={u.id} className="of-centro">{rotulo(u)}</th>), ...(temMedia(b) ? [<th key={`m-${b.sigla}`} className="of-centro">Média</th>] : [])])}</tr>}
        </thead>
        <tbody>
          {d.linhas.map((l, i) => (
            <tr key={l.estudante.id}>
              <td className="of-num">{i + 1}</td><td>{l.estudante.nip}</td><td>{l.estudante.posto}</td><td>{l.estudante.nome}</td>
              {d.blocos.map((b) => [...b.ucs.map((u) => <td key={u.id} className="of-centro">{fmt(l.ucs[u.codigo])}</td>), ...(temMedia(b) ? [<td key={`m-${b.sigla}`} className="of-centro fw-bold">{fmt(l.blocos[b.sigla])}</td>] : [])])}
              {ajuste && <td className="of-centro">{l.ajuste ? fmt(l.ajuste) : ''}</td>}
              {ponderada && <td className="of-centro">{fmt(l.mediaSimples)}</td>}
              <td className="of-centro fw-bold">{fmt(l.final)}</td>
              <td className="of-centro">{l.ordem ?? ''}</td><td>{l.mencao ?? ''}</td>
            </tr>
          ))}
        </tbody>
        {d.linhas.length > 0 && (
          <tfoot>
            <tr className="fw-bold">
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
