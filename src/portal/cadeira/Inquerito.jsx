import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import { Bloqueio, Carregando, Cartao, Erro } from '../componentes'
import { dataHora } from '../formatar'
import ResultadosInquerito from './ResultadosInquerito'
import FormularioOpiniao from '../FormularioOpiniao'

const MOSTRAR = { apos_responder: 'Os estudantes veem os resultados depois de responderem.', apos_fecho: 'Os estudantes veem os resultados depois do fecho.', nunca: 'Só o docente vê os resultados.' }

// sondagem ou avaliação do docente aberta a partir da página da cadeira
function Inquerito({ c, eDocente, recarregar, avisar, so }) {
  const resumo = (c.inqueritos || []).find((i) => i.id === so)
  const [i, setI] = useState(null)
  const [erro, setErro] = useState('')
  const [respostas, setRespostas] = useState({})
  const [aEnviar, setAEnviar] = useState(false)
  const carregar = useCallback(() => api(`/inqueritos/${so}`).then((r) => {
    setI(r)
    setRespostas(r.minhaResposta || {})
  }).catch((e) => setErro(e.message)), [so])
  useEffect(() => { if (!resumo?.bloqueio) carregar() }, [carregar, resumo?.bloqueio])

  if (resumo?.bloqueio) return <Cartao titulo={resumo.titulo}><Bloqueio motivos={resumo.bloqueio} /></Cartao>
  if (erro) return <Erro texto={erro} />
  if (!i) return <Carregando />

  const definir = (k, v) => setRespostas((r) => ({ ...r, [k]: v }))
  async function enviar(e) {
    e.preventDefault()
    setAEnviar(true)
    try {
      const r = await api(`/inqueritos/${i.id}/respostas`, { metodo: 'POST', corpo: { respostas } })
      setI(r)
      avisar({ texto: i.tipo === 'avaliacao' ? 'Obrigado: a sua avaliação foi registada de forma anónima.' : 'Resposta registada.' })
      recarregar()
    } catch (falha) {
      avisar({ tipo: 'erro', texto: falha.message })
    } finally {
      setAEnviar(false)
    }
  }

  const icone = i.tipo === 'avaliacao' ? 'fa-user-check' : 'fa-poll'
  return (
    <div className="p-coluna">
      <Cartao
        titulo={<><i className={`fa ${icone} me-2`} />{i.titulo}</>}
        acoes={i.fecha && <span className={`badge ${i.fechado ? 'bg-gray-500' : 'bg-light text-dark'}`}>{i.fechado ? 'Fechou' : 'Fecha'} {dataHora(i.fecha)}</span>}
      >
        {i.descricao && <p className="text-muted">{i.descricao}</p>}
        {i.anonimo && <p className="small"><i className="fa fa-user-secret me-1 text-muted" />Respostas anónimas: não fica registado quem respondeu o quê.</p>}
        {eDocente && i.tipo === 'sondagem' && <p className="small text-muted mb-0">{MOSTRAR[i.mostrarResultados]} {i.estudantes !== undefined && `Responderam ${i.resultados?.total ?? 0} de ${i.estudantes} estudantes.`}</p>}

        {!eDocente && i.respondido && !i.podeResponder && <div className="alert alert-success mb-0"><i className="fa fa-check-circle me-1" />Já respondeu{i.tipo === 'avaliacao' ? '. Obrigado pela sua avaliação.' : '.'}</div>}
        {!eDocente && !i.respondido && i.fechado && <div className="alert alert-secondary mb-0">Este inquérito já fechou.</div>}
        {!eDocente && i.podeResponder && (
          <form onSubmit={enviar} className="p-formulario">
            <FormularioOpiniao perguntas={i.perguntas} respostas={respostas} definir={definir} numerar={i.tipo === 'avaliacao'} />
            <div><button type="submit" className="btn btn-theme" disabled={aEnviar}>{aEnviar ? 'A enviar…' : i.respondido ? 'Mudar a resposta' : 'Enviar'}</button></div>
          </form>
        )}
      </Cartao>

      {i.aviso && <div className="alert alert-info"><i className="fa fa-info-circle me-1" />{i.aviso}</div>}
      {i.resultados && (
        <Cartao titulo={<><i className="fa fa-chart-bar me-2" />Resultados</>}>
          <ResultadosInquerito resultados={i.resultados} media={i.tipo === 'avaliacao' ? i.media : undefined} />
        </Cartao>
      )}
      {i.porEstudante?.length > 0 && (
        <Cartao titulo={<><i className="fa fa-users me-2" />Respostas por estudante</>} corpo={false}>
          <div className="table-responsive">
            <table className="table table-striped mb-0">
              <thead><tr><th>Estudante</th><th>Escolha</th></tr></thead>
              <tbody>{i.porEstudante.map((r, k) => <tr key={k}><td>{r.estudante}</td><td>{(r.respostas[0] || []).map((j) => i.perguntas[0].opcoes[j]).join(', ')}</td></tr>)}</tbody>
            </table>
          </div>
        </Cartao>
      )}
    </div>
  )
}

export default Inquerito
