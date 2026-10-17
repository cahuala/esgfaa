import { useCallback, useEffect, useState } from 'react'
import { FaEye, FaEyeSlash, FaPrint, FaSave } from 'react-icons/fa'
import { api } from '../api'
import { Cartao, Vazio } from '../componentes'
import { Nota, Situacao } from '../avaliacao'
import Composicao from './Composicao'
import { exportarPautaExcel } from '../exportarPauta'
import { COMPONENTES_NOTA, NOMES_COMPONENTES, REGRA, SITUACOES, resultadoDisciplina } from '../regraAvaliacao'
import { t as tx } from '../../i18n/linguas'
import CabecalhoImpressao from '../../components/CabecalhoImpressao'

function Avaliacoes(props) {
  return props.eDocente ? <Pauta {...props} /> : <MinhasNotas {...props} />
}

// estudante: as suas notas nesta disciplina, em linha
function MinhasNotas({ c }) {
  const n = c.notas
  return (
    <Cartao titulo={tx('As minhas notas')} acoes={<Situacao situacao={n.situacao} />}>
      <div className="p-notas-linha">
        {COMPONENTES_NOTA.slice(0, 2).map((k) => <div key={k}><span>{NOMES_COMPONENTES[k]}</span><Nota valor={n[k]} /></div>)}
        <div className="p-notas-destaque"><span>{tx('MAC')}</span><Nota valor={n.mac} /></div>
        <div><span>{tx('Exame')}</span>{n.situacao === 'dispensado' ? <span className="p-nota-vazia">{tx('dispensado')}</span> : <Nota valor={n.exame} />}</div>
        <div><span>{tx('Recurso')}</span><Nota valor={n.recurso} /></div>
        <div className="p-notas-final"><span>{tx('Nota final')}</span><Nota valor={n.situacao === 'recurso' ? null : n.final} forte />{n.classificacao && n.situacao !== 'reprovado' && <small>{n.classificacao}</small>}</div>
      </div>
      {n.observacao && <p className="p-resposta">{n.observacao}</p>}
      <p className="p-legenda">{REGRA} {tx('“—” = nota ainda não publicada.')}</p>
    </Cartao>
  )
}

const paraTexto = (v) => (v === null || v === undefined ? '' : String(v).replace('.', ','))
const paraNumero = (v) => {
  const t = String(v).trim().replace(',', '.')
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) && n >= 0 && n <= 20 ? n : undefined // undefined = inválida
}

// docente: pauta em matriz (estudantes × provas), com MAC e nota final calculadas enquanto escreve
function Pauta({ c, avisar }) {
  const [p, setP] = useState(null)
  const [edicao, setEdicao] = useState({}) // { estudanteId: { p1, p2, exame, recurso, observacao } }
  const [alterado, setAlterado] = useState(false)
  const [aGuardar, setAGuardar] = useState(false)
  const [compor, setCompor] = useState(null) // componente cuja composição se está a editar

  const aplicar = useCallback((r) => {
    setP(r)
    setEdicao(Object.fromEntries(r.linhas.map((l) => [l.estudante.id, {
      ...Object.fromEntries(COMPONENTES_NOTA.map((k) => [k, paraTexto(l[k])])), observacao: l.observacao,
    }])))
    setAlterado(false)
  }, [])
  const carregar = useCallback(() => api(`/cadeiras/${c.id}/pauta`).then(aplicar).catch((e) => avisar({ tipo: 'erro', texto: e.message })), [c.id, aplicar, avisar])
  useEffect(() => { carregar() }, [carregar])

  if (!p) return <p className="p-texto-suave">{tx('A carregar a pauta…')}</p>
  if (p.linhas.length === 0) return <Vazio>{tx('A turma não tem estudantes matriculados.')}</Vazio>

  const mudar = (id, k, v) => { setEdicao({ ...edicao, [id]: { ...edicao[id], [k]: v } }); setAlterado(true) }
  const calculo = (id) => {
    const valores = Object.fromEntries(COMPONENTES_NOTA.map((k) => [k, paraNumero(edicao[id][k])]))
    const invalidas = COMPONENTES_NOTA.filter((k) => valores[k] === undefined)
    for (const k of invalidas) valores[k] = null
    return { ...resultadoDisciplina(valores), invalidas }
  }
  const resultados = Object.fromEntries(p.linhas.map((l) => [l.estudante.id, calculo(l.estudante.id)]))
  const contagem = Object.values(resultados).reduce((s, r) => ({ ...s, [r.situacao]: (s[r.situacao] || 0) + 1 }), {})
  const temInvalidas = Object.values(resultados).some((r) => r.invalidas.length)

  async function guardar() {
    setAGuardar(true)
    try {
      const linhas = p.linhas.map((l) => ({ estudanteId: l.estudante.id, ...edicao[l.estudante.id] }))
      aplicar(await api(`/cadeiras/${c.id}/pauta`, { metodo: 'PUT', corpo: { linhas } }))
      avisar({ texto: tx('Pauta guardada.') })
    } catch (e) {
      avisar({ tipo: 'erro', texto: e.message })
    } finally {
      setAGuardar(false)
    }
  }

  async function publicar(k) {
    const publicadas = p.publicadas.includes(k) ? p.publicadas.filter((x) => x !== k) : [...p.publicadas, k]
    try {
      setP({ ...p, ...(await api(`/cadeiras/${c.id}/pauta/publicacao`, { metodo: 'PUT', corpo: { publicadas } })), linhas: p.linhas })
      avisar({ texto: publicadas.includes(k) ? tx('{0}: publicada aos estudantes.', { 0: NOMES_COMPONENTES[k] }) : tx('{0}: escondida dos estudantes.', { 0: NOMES_COMPONENTES[k] }) })
    } catch (e) {
      avisar({ tipo: 'erro', texto: e.message })
    }
  }

  const calculada = (k) => Boolean(p.composicoes?.[k])
  const guardarComposicao = async (itens) => {
    aplicar(await api(`/cadeiras/${c.id}/pauta/composicao`, { metodo: 'PUT', corpo: { componente: compor, itens } }))
    avisar({ texto: itens ? tx('{0}: calculada a partir das atividades.', { 0: NOMES_COMPONENTES[compor] }) : tx('{0}: volta a ser lançada à mão.', { 0: NOMES_COMPONENTES[compor] }) })
  }

  // prazo de lançamento definido pela Administração Escolar: fora dele a coluna fica fechada
  const prazo = (k) => p.prazos?.[k]
  const fechada = (k) => Boolean(prazo(k) && !prazo(k).aberto)
  const cabeca = (k) => {
    const pub = p.publicadas.includes(k)
    return (
      <th scope="col" key={k}>
        {NOMES_COMPONENTES[k]}
        {prazo(k) && !prazo(k).livre && <div className={`small fw-normal p-sem-impressao ${fechada(k) ? 'text-danger' : 'text-success'}`} title={prazo(k).origem}><i className={`fa ${fechada(k) ? 'fa-lock' : 'fa-lock-open'} me-1`} />{prazo(k).texto}</div>}
        <button type="button" className={`btn btn-xs ms-1 p-sem-impressao ${calculada(k) ? 'btn-primary' : 'btn-white'}`} onClick={() => setCompor(k)} title={calculada(k) ? tx('Calculada a partir das atividades. Clique para mudar.') : tx('Calcular a partir de trabalhos e questionários')} aria-label={tx('Como se calcula: {0}', { 0: NOMES_COMPONENTES[k] })}>
          <i className="fa fa-calculator" />
        </button>
        <button type="button" className={`p-publicar p-sem-impressao ${pub ? 'p-publicada' : ''}`} onClick={() => publicar(k)} aria-pressed={pub} title={pub ? tx('Os estudantes já veem esta coluna. Clique para esconder.') : tx('Ainda escondida. Clique para publicar aos estudantes.')}>
          {pub ? <FaEye aria-hidden="true" /> : <FaEyeSlash aria-hidden="true" />} {pub ? tx('Publicada') : tx('Por publicar')}
        </button>
      </th>
    )
  }

  const campo = (l, k, desativado) => {
    const id = l.estudante.id
    const invalida = resultados[id].invalidas.includes(k)
    // componente calculada: mostra o valor, não se escreve
    if (calculada(k)) return <td className="p-celula-calculada" title={tx('Calculada a partir das atividades')}><Nota valor={paraNumero(edicao[id][k]) ?? null} /></td>
    if (fechada(k)) return <td className="p-celula-inativa" title={tx('Prazo de lançamento fechado')}><Nota valor={paraNumero(edicao[id][k]) ?? null} /></td>
    return (
      <td className={desativado && !edicao[id][k] ? 'p-celula-inativa' : ''}>
        <input
          className={`form-control form-control-sm p-nota ${invalida ? 'p-nota-invalida' : ''}`}
          inputMode="decimal"
          aria-label={tx('{0} de {1}', { 0: NOMES_COMPONENTES[k], 1: l.estudante.nome })}
          aria-invalid={invalida || undefined}
          value={edicao[id][k]}
          disabled={desativado && !edicao[id][k]}
          placeholder={desativado ? '' : '—'}
          onChange={(e) => mudar(id, k, e.target.value)}
        />
      </td>
    )
  }

  return (
    <div className="p-coluna">
      <div className="p-pauta-barra">
        <div className="p-pauta-contagem">
          {Object.entries(SITUACOES).filter(([k]) => contagem[k]).map(([k, s]) => <span key={k} className={`badge ${{ cinzento: 'bg-gray-400', verde: 'bg-success', azul: 'bg-primary', dourado: 'bg-warning text-dark', vermelho: 'bg-danger' }[s.cor]}`}>{s.texto}: {contagem[k]}</span>)}
        </div>
        <div className="p-acoes-linha p-sem-impressao">
          {alterado && <span className="p-por-guardar">{tx('Alterações por guardar')}</span>}
          <button type="button" className="btn btn-white" onClick={() => exportarPautaExcel(c, p.linhas.map((l) => ({ ...l, ...Object.fromEntries(COMPONENTES_NOTA.map((k) => [k, paraNumero(edicao[l.estudante.id][k]) ?? null])), ...resultados[l.estudante.id] })))}><i className="fa fa-file-excel me-1" /> {tx('Exportar Excel')}</button>
          <button type="button" className="btn btn-white" onClick={() => window.print()}><FaPrint aria-hidden="true" /> {tx('Imprimir')}</button>
          <button type="button" className="btn btn-theme" onClick={guardar} disabled={!alterado || aGuardar || temInvalidas}><FaSave aria-hidden="true" /> {aGuardar ? tx('A guardar…') : tx('Guardar pauta')}</button>
        </div>
      </div>

      {COMPONENTES_NOTA.some(fechada) && <div className="alert alert-warning py-2 p-sem-impressao"><i className="fa fa-lock me-1" />{tx('Algumas colunas estão fechadas: o prazo de lançamento definido pela Administração Escolar não está aberto. Para lançar fora do prazo, peça uma prorrogação.')}</div>}
      <div className="panel mb-2 overflow-hidden">
        <CabecalhoImpressao titulo="Pauta" subtitulo={`${c.codigo} ${c.nome} · ${c.turma?.nome ?? ''}`} area="Administração Escolar" />
        <div className="table-responsive">
          <table className="table table-bordered table-hover align-middle text-center mb-0 p-matriz p-matriz-pauta">
            <thead>
              <tr>
                <th scope="col" className="p-matriz-num">{tx('N.º')}</th>
                <th scope="col" className="p-matriz-nome">{tx('Estudante')}</th>
                {cabeca('p1')}
                {cabeca('p2')}
                <th scope="col" className="p-matriz-mac">{tx('MAC')}</th>
                {cabeca('exame')}
                {cabeca('recurso')}
                <th scope="col" className="p-matriz-final">{tx('Nota final')}</th>
                <th scope="col">{tx('Situação')}</th>
              </tr>
            </thead>
            <tbody>
              {p.linhas.map((l, i) => {
                const r = resultados[l.estudante.id]
                const semExame = r.situacao === 'dispensado' || r.situacao === 'em_curso'
                const semRecurso = !['recurso', 'reprovado'].includes(r.situacao) && !(r.situacao === 'aprovado' && edicao[l.estudante.id].recurso)
                return (
                  <tr key={l.estudante.id}>
                    <td className="p-matriz-num">{i + 1}</td>
                    <th scope="row" className="p-matriz-nome">{l.estudante.nome}<small>{l.estudante.numero}</small></th>
                    {campo(l, 'p1')}
                    {campo(l, 'p2')}
                    <td className="p-matriz-mac"><Nota valor={r.mac} /></td>
                    {campo(l, 'exame', semExame)}
                    {campo(l, 'recurso', semRecurso)}
                    <td className="p-matriz-final"><Nota valor={r.situacao === 'recurso' ? null : r.final} forte /></td>
                    <td><Situacao situacao={r.situacao} />{r.classificacao && r.situacao !== 'reprovado' && <small className="p-classificacao">{r.classificacao}</small>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
      {compor && <Composicao componente={compor} atividades={p.atividades || []} atual={p.composicoes?.[compor]} guardar={guardarComposicao} fechar={() => setCompor(null)} />}
      <p className="p-legenda">{REGRA} {tx('Notas de 0 a 20 (aceita vírgula); campo vazio = sem nota. O botão')} <i className="fa fa-calculator" /> {tx('de cada coluna calcula-a a partir de trabalhos e questionários. O exame fica bloqueado para os dispensados e o recurso só abre para quem reprovou no exame. Os estudantes só veem as colunas publicadas.')}</p>
    </div>
  )
}

export default Avaliacoes
