import { useCallback, useEffect, useState } from 'react'
import { FaEye, FaEyeSlash, FaPrint, FaSave } from 'react-icons/fa'
import { api } from '../api'
import { Cartao, Vazio } from '../componentes'
import { Nota, Situacao } from '../avaliacao'
import { COMPONENTES_NOTA, NOMES_COMPONENTES, REGRA, SITUACOES, resultadoDisciplina } from '../regraAvaliacao'

function Avaliacoes(props) {
  return props.eDocente ? <Pauta {...props} /> : <MinhasNotas {...props} />
}

// estudante: as suas notas nesta disciplina, em linha
function MinhasNotas({ c }) {
  const n = c.notas
  return (
    <Cartao titulo="As minhas notas" acoes={<Situacao situacao={n.situacao} />}>
      <div className="p-notas-linha">
        {COMPONENTES_NOTA.slice(0, 2).map((k) => <div key={k}><span>{NOMES_COMPONENTES[k]}</span><Nota valor={n[k]} /></div>)}
        <div className="p-notas-destaque"><span>MAC</span><Nota valor={n.mac} /></div>
        <div><span>Exame</span>{n.situacao === 'dispensado' ? <span className="p-nota-vazia">dispensado</span> : <Nota valor={n.exame} />}</div>
        <div><span>Recurso</span><Nota valor={n.recurso} /></div>
        <div className="p-notas-final"><span>Nota final</span><Nota valor={n.situacao === 'recurso' ? null : n.final} forte />{n.classificacao && n.situacao !== 'reprovado' && <small>{n.classificacao}</small>}</div>
      </div>
      {n.observacao && <p className="p-resposta">{n.observacao}</p>}
      <p className="p-legenda">{REGRA} “—” = nota ainda não publicada.</p>
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

  const aplicar = useCallback((r) => {
    setP(r)
    setEdicao(Object.fromEntries(r.linhas.map((l) => [l.estudante.id, {
      ...Object.fromEntries(COMPONENTES_NOTA.map((k) => [k, paraTexto(l[k])])), observacao: l.observacao,
    }])))
    setAlterado(false)
  }, [])
  const carregar = useCallback(() => api(`/cadeiras/${c.id}/pauta`).then(aplicar).catch((e) => avisar({ tipo: 'erro', texto: e.message })), [c.id, aplicar, avisar])
  useEffect(() => { carregar() }, [carregar])

  if (!p) return <p className="p-texto-suave">A carregar a pauta…</p>
  if (p.linhas.length === 0) return <Vazio>A turma não tem estudantes matriculados.</Vazio>

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
      avisar({ texto: 'Pauta guardada.' })
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
      avisar({ texto: publicadas.includes(k) ? `${NOMES_COMPONENTES[k]}: publicada aos estudantes.` : `${NOMES_COMPONENTES[k]}: escondida dos estudantes.` })
    } catch (e) {
      avisar({ tipo: 'erro', texto: e.message })
    }
  }

  const cabeca = (k) => {
    const pub = p.publicadas.includes(k)
    return (
      <th scope="col" key={k}>
        {NOMES_COMPONENTES[k]}
        <button type="button" className={`p-publicar p-sem-impressao ${pub ? 'p-publicada' : ''}`} onClick={() => publicar(k)} aria-pressed={pub} title={pub ? 'Os estudantes já veem esta coluna. Clique para esconder.' : 'Ainda escondida. Clique para publicar aos estudantes.'}>
          {pub ? <FaEye aria-hidden="true" /> : <FaEyeSlash aria-hidden="true" />} {pub ? 'Publicada' : 'Por publicar'}
        </button>
      </th>
    )
  }

  const campo = (l, k, desativado) => {
    const id = l.estudante.id
    const invalida = resultados[id].invalidas.includes(k)
    return (
      <td className={desativado && !edicao[id][k] ? 'p-celula-inativa' : ''}>
        <input
          className={`p-nota ${invalida ? 'p-nota-invalida' : ''}`}
          inputMode="decimal"
          aria-label={`${NOMES_COMPONENTES[k]} de ${l.estudante.nome}`}
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
          {alterado && <span className="p-por-guardar">Alterações por guardar</span>}
          <button type="button" className="p-botao p-botao-contorno" onClick={() => window.print()}><FaPrint aria-hidden="true" /> Imprimir</button>
          <button type="button" className="p-botao" onClick={guardar} disabled={!alterado || aGuardar || temInvalidas}><FaSave aria-hidden="true" /> {aGuardar ? 'A guardar…' : 'Guardar pauta'}</button>
        </div>
      </div>

      <div className="panel mb-2 overflow-hidden">
        <div className="p-impressao-cabeca">Pauta · {c.codigo} {c.nome} · {c.turma?.nome}</div>
        <div className="p-tabela-rolavel">
          <table className="p-matriz p-matriz-pauta">
            <thead>
              <tr>
                <th scope="col" className="p-matriz-num">N.º</th>
                <th scope="col" className="p-matriz-nome">Estudante</th>
                {cabeca('p1')}
                {cabeca('p2')}
                <th scope="col" className="p-matriz-mac">MAC</th>
                {cabeca('exame')}
                {cabeca('recurso')}
                <th scope="col" className="p-matriz-final">Nota final</th>
                <th scope="col">Situação</th>
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
      <p className="p-legenda">{REGRA} Notas de 0 a 20 (aceita vírgula); campo vazio = sem nota. O exame fica bloqueado para os dispensados e o recurso só abre para quem reprovou no exame. Os estudantes só veem as colunas publicadas.</p>
    </div>
  )
}

export default Avaliacoes
