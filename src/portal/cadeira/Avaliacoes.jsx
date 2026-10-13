import { useCallback, useEffect, useState } from 'react'
import { FaEye, FaEyeSlash, FaTrashAlt } from 'react-icons/fa'
import { api } from '../api'
import { Campo, Cartao, Etiqueta, Vazio } from '../componentes'
import { data, nota } from '../formatar'
import { Situacao } from '../paginas/Notas'

const TIPOS = { teste: 'Teste', trabalho: 'Trabalho', exame: 'Exame', participacao: 'Participação', outro: 'Outro' }

function Avaliacoes(props) {
  return props.eDocente ? <Pauta {...props} /> : <MinhasNotas {...props} />
}

// estudante: as suas notas publicadas e a média
function MinhasNotas({ c }) {
  if (!c.avaliacoes.length) return <Vazio>Ainda não há notas publicadas nesta cadeira.</Vazio>
  return (
    <Cartao titulo="As minhas notas" acoes={<Situacao c={c.resultado} />}>
      <div className="p-tabela-rolavel">
        <table className="p-tabela">
          <thead><tr><th>Avaliação</th><th>Data</th><th className="p-num">Peso</th><th className="p-num">Nota</th></tr></thead>
          <tbody>
            {c.avaliacoes.map((a) => (
              <tr key={a.id}>
                <td>{a.nome} <span className="p-texto-fraco">· {TIPOS[a.tipo] || a.tipo}</span>{a.observacao && <div className="p-texto-suave">{a.observacao}</div>}</td>
                <td>{data(a.data)}</td>
                <td className="p-num">{a.peso} %</td>
                <td className="p-num"><strong>{nota(a.nota)}</strong></td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr><th colSpan={3}>Média {c.resultado.completa ? 'final' : 'até agora'}</th><th className="p-num">{nota(c.resultado.media)}</th></tr></tfoot>
        </table>
      </div>
    </Cartao>
  )
}

// docente: elementos de avaliação (peso e publicação) e pauta com todas as notas
function Pauta({ c, avisar }) {
  const [p, setP] = useState(null)
  const [edicao, setEdicao] = useState({}) // { avaliacaoId: { estudanteId: valor } }
  const [f, setF] = useState({ nome: '', tipo: 'teste', peso: '', data: '' })
  const [erro, setErro] = useState('')

  const carregar = useCallback(() => api(`/cadeiras/${c.id}/pauta`).then((r) => {
    setP(r)
    setEdicao(Object.fromEntries(r.avaliacoes.map((a) => [a.id, Object.fromEntries(r.linhas.map((l) => [l.estudante.id, l.notas[a.id]?.valor ?? '']))])))
  }).catch((e) => avisar({ tipo: 'erro', texto: e.message })), [c.id, avisar])
  useEffect(() => { carregar() }, [carregar])

  if (!p) return <p className="p-texto-suave">A carregar a pauta…</p>
  const somaPesos = p.avaliacoes.reduce((s, a) => s + a.peso, 0)

  async function criar(e) {
    e.preventDefault()
    setErro('')
    try {
      await api(`/cadeiras/${c.id}/avaliacoes`, { metodo: 'POST', corpo: f })
      setF({ nome: '', tipo: 'teste', peso: '', data: '' })
      carregar()
    } catch (falha) {
      setErro(falha.message)
    }
  }

  async function guardarColuna(a) {
    try {
      const notas = p.linhas.map((l) => ({ estudanteId: l.estudante.id, valor: edicao[a.id][l.estudante.id] === '' ? null : String(edicao[a.id][l.estudante.id]) }))
      await api(`/avaliacoes/${a.id}/notas`, { metodo: 'PUT', corpo: { notas } })
      avisar({ texto: `Notas de "${a.nome}" guardadas${a.publicada ? '' : ' (ainda não publicadas)'}.` })
      carregar()
    } catch (e) {
      avisar({ tipo: 'erro', texto: e.message })
    }
  }

  async function publicar(a) {
    await api(`/avaliacoes/${a.id}`, { metodo: 'PUT', corpo: { publicada: !a.publicada } })
      .then(() => { avisar({ texto: a.publicada ? 'Notas escondidas dos estudantes.' : 'Notas publicadas: os estudantes já as veem.' }); carregar() })
      .catch((x) => avisar({ tipo: 'erro', texto: x.message }))
  }

  async function apagar(a) {
    if (!window.confirm(`Apagar "${a.nome}" e todas as notas lançadas?`)) return
    await api(`/avaliacoes/${a.id}`, { metodo: 'DELETE' }).then(carregar).catch((x) => avisar({ tipo: 'erro', texto: x.message }))
  }

  return (
    <div className="p-coluna">
      <Cartao titulo="Pauta" acoes={<Etiqueta cor={somaPesos === 100 ? 'verde' : 'dourado'}>Pesos: {somaPesos} %</Etiqueta>}>
        {p.avaliacoes.length === 0 ? <Vazio>Crie primeiro os elementos de avaliação (abaixo).</Vazio> : p.linhas.length === 0 ? <Vazio>A turma não tem estudantes matriculados.</Vazio> : (
          <div className="p-tabela-rolavel">
            <table className="p-tabela p-pauta">
              <thead>
                <tr>
                  <th>Estudante</th>
                  {p.avaliacoes.map((a) => (
                    <th key={a.id} className="p-num">
                      {a.nome}<div className="p-texto-fraco">{a.peso} %</div>
                      <div className="p-pauta-acoes">
                        <button type="button" className="p-botao p-botao-pequeno" onClick={() => guardarColuna(a)}>Guardar</button>
                        <button type="button" className="p-botao-icone" onClick={() => publicar(a)} title={a.publicada ? 'Esconder dos estudantes' : 'Publicar aos estudantes'} aria-label={a.publicada ? `Esconder ${a.nome}` : `Publicar ${a.nome}`}>{a.publicada ? <FaEye /> : <FaEyeSlash />}</button>
                        <button type="button" className="p-botao-icone" onClick={() => apagar(a)} aria-label={`Apagar ${a.nome}`}><FaTrashAlt /></button>
                      </div>
                    </th>
                  ))}
                  <th className="p-num">Média</th>
                </tr>
              </thead>
              <tbody>
                {p.linhas.map((l) => (
                  <tr key={l.estudante.id}>
                    <td><strong>{l.estudante.nome}</strong><div className="p-texto-fraco">{l.estudante.numero}</div></td>
                    {p.avaliacoes.map((a) => (
                      <td key={a.id} className="p-num">
                        <input
                          className="p-nota"
                          inputMode="decimal"
                          aria-label={`${a.nome} de ${l.estudante.nome}`}
                          value={edicao[a.id]?.[l.estudante.id] ?? ''}
                          onChange={(e) => setEdicao({ ...edicao, [a.id]: { ...edicao[a.id], [l.estudante.id]: e.target.value } })}
                        />
                      </td>
                    ))}
                    <td className="p-num"><strong>{nota(l.media)}</strong>{l.completa && <div className={l.aprovado ? 'p-ok' : 'p-mau'}>{l.aprovado ? 'Aprovado' : 'Reprovado'}</div>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="p-texto-fraco">Notas de 0 a 20 (aceita vírgula). Guarde cada coluna; o ícone do olho publica ou esconde essa avaliação aos estudantes.</p>
      </Cartao>
      <Cartao titulo="Novo elemento de avaliação">
        <form onSubmit={criar} className="p-formulario p-formulario-linha">
          {erro && <p className="p-erro p-largo" role="alert">{erro}</p>}
          <Campo id="av-nome" rotulo="Nome"><input id="av-nome" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} placeholder="Teste 1" required /></Campo>
          <Campo id="av-tipo" rotulo="Tipo">
            <select id="av-tipo" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>{Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          </Campo>
          <Campo id="av-peso" rotulo="Peso (%)"><input id="av-peso" type="number" min={1} max={100} value={f.peso} onChange={(e) => setF({ ...f, peso: e.target.value })} required /></Campo>
          <Campo id="av-data" rotulo="Data"><input id="av-data" type="date" value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} /></Campo>
          <button type="submit" className="p-botao">Adicionar</button>
        </form>
      </Cartao>
    </div>
  )
}

export default Avaliacoes
