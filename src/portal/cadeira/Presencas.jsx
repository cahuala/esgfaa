import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import { Campo, Cartao, Etiqueta, Vazio } from '../componentes'
import { data } from '../formatar'
import { t as tx } from '../../i18n/linguas'

const ESTADOS = { presente: ['verde', tx('Presente')], falta: ['vermelho', tx('Falta')], justificada: ['dourado', tx('Justificada')] }

function Presencas(props) {
  return props.eDocente ? <Aulas {...props} /> : <MinhasPresencas {...props} />
}

function MinhasPresencas({ c }) {
  if (!c.presencas.length) return <Vazio>{tx('Ainda não há aulas registadas.')}</Vazio>
  return (
    <Cartao titulo={tx('As minhas presenças')} acoes={<Etiqueta cor={c.assiduidade >= 75 ? 'verde' : 'vermelho'}>{tx('Assiduidade:')} {c.assiduidade} %</Etiqueta>}>
      <ul className="p-lista">
        {c.presencas.map((p) => (
          <li key={p.data} className="p-linha-entre">
            <span><strong>{data(p.data)}</strong>{p.sumario && <span className="p-texto-suave"> · {p.sumario}</span>}</span>
            <Etiqueta cor={ESTADOS[p.estado][0]}>{ESTADOS[p.estado][1]}</Etiqueta>
          </li>
        ))}
      </ul>
    </Cartao>
  )
}

// docente: registar a aula (data, sumário) e as presenças da turma
function Aulas({ c, avisar }) {
  const hoje = new Date().toISOString().slice(0, 10)
  const [d, setD] = useState(null)
  const [f, setF] = useState({ data: hoje, sumario: '' })
  const [estados, setEstados] = useState({})
  const [erro, setErro] = useState('')

  const carregar = useCallback(() => api(`/cadeiras/${c.id}/aulas`).then((r) => {
    setD(r)
    setEstados(Object.fromEntries(r.estudantes.map((e) => [e.id, 'presente'])))
  }).catch((e) => avisar({ tipo: 'erro', texto: e.message })), [c.id, avisar])
  useEffect(() => { carregar() }, [carregar])

  if (!d) return <p className="p-texto-suave">{tx('A carregar…')}</p>

  async function registar(e) {
    e.preventDefault()
    setErro('')
    try {
      await api(`/cadeiras/${c.id}/aulas`, { metodo: 'POST', corpo: { ...f, presencas: Object.entries(estados).map(([estudanteId, estado]) => ({ estudanteId: Number(estudanteId), estado })) } })
      setF({ data: hoje, sumario: '' })
      avisar({ texto: tx('Aula e presenças registadas.') })
      carregar()
    } catch (falha) {
      setErro(falha.message)
    }
  }

  return (
    <div className="p-grelha-lado">
      <Cartao titulo={tx('Aulas registadas')}>
        {d.aulas.length === 0 ? <Vazio>{tx('Ainda não registou aulas.')}</Vazio> : (
          <ul className="p-lista">
            {d.aulas.map((a) => {
              const v = Object.values(a.presencas)
              return (
                <li key={a.id}>
                  <strong>{data(a.data)}</strong>{a.sumario && <span className="p-texto-suave"> · {a.sumario}</span>}
                  <div className="p-linha-meta">{v.filter((x) => x === 'presente').length} {tx('presentes ·')} {v.filter((x) => x === 'falta').length} {tx('faltas ·')} {v.filter((x) => x === 'justificada').length} {tx('justificadas')}</div>
                </li>
              )
            })}
          </ul>
        )}
      </Cartao>
      <Cartao titulo={tx('Registar aula')}>
        <form onSubmit={registar} className="p-formulario">
          {erro && <p className="p-erro" role="alert">{erro}</p>}
          <Campo id="au-data" rotulo={tx('Data')}><input id="au-data" type="date" value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} required /></Campo>
          <Campo id="au-sumario" rotulo={tx('Sumário')}><textarea id="au-sumario" rows={3} value={f.sumario} onChange={(e) => setF({ ...f, sumario: e.target.value })} maxLength={2000} /></Campo>
          {d.estudantes.length === 0 ? <Vazio>{tx('A turma não tem estudantes.')}</Vazio> : (
            <ul className="p-lista p-presencas">
              {d.estudantes.map((e) => (
                <li key={e.id} className="p-linha-entre">
                  <span>{e.nome}</span>
                  <select className="form-select form-select-sm" aria-label={tx('Presença de {0}', { 0: e.nome })} value={estados[e.id]} onChange={(x) => setEstados({ ...estados, [e.id]: x.target.value })}>
                    {Object.entries(ESTADOS).map(([k, [, t]]) => <option key={k} value={k}>{t}</option>)}
                  </select>
                </li>
              ))}
            </ul>
          )}
          <button type="submit" className="btn btn-theme">{tx('Registar')}</button>
        </form>
      </Cartao>
    </div>
  )
}

export default Presencas
