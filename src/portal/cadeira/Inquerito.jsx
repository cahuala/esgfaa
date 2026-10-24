import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import { Bloqueio, Carregando, Cartao, Erro } from '../componentes'
import { dataHora } from '../formatar'
import ResultadosInquerito from './ResultadosInquerito'
import FormularioInquerito from '../inquerito/FormularioInquerito'
import EditorInquerito from '../inquerito/EditorInquerito'
import { t as tx } from '../../i18n/linguas'

const paraCampo = (iso) => (iso ? new Date(new Date(iso).getTime() - new Date(iso).getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : '')
const MOSTRAR = { apos_responder: tx('Os estudantes veem os resultados depois de responderem.'), apos_fecho: tx('Os estudantes veem os resultados depois do fecho.'), nunca: tx('Só o docente vê os resultados.') }

// sondagem, inquérito de opinião ou avaliação do docente aberta a partir da página da cadeira
function Inquerito({ c, eDocente, recarregar, avisar, so }) {
  const resumo = (c.inqueritos || []).find((i) => i.id === so)
  const [i, setI] = useState(null)
  const [erro, setErro] = useState('')
  const [respostas, setRespostas] = useState({})
  const [aEnviar, setAEnviar] = useState(false)
  const [editar, setEditar] = useState(null) // inquérito da cadeira em edição (docente)
  const carregar = useCallback(() => api(`/inqueritos/${so}`).then((r) => {
    setI(r)
    setRespostas(r.minhaResposta || {})
  }).catch((e) => setErro(e.message)), [so])
  useEffect(() => { if (!resumo?.bloqueio) carregar() }, [carregar, resumo?.bloqueio])

  if (resumo?.bloqueio) return <Cartao titulo={resumo.titulo}><Bloqueio motivos={resumo.bloqueio} /></Cartao>
  if (erro) return <Erro texto={erro} />
  if (!i) return <Carregando />

  if (editar) {
    return (
      <EditorInquerito
        f={editar}
        setF={setEditar}
        anonimoEditavel
        textoGuardar={tx('Guardar alterações')}
        guardar={(corpo, id) => api(`/inqueritos/${id}/formulario`, { metodo: 'PUT', corpo })}
        feito={() => { setEditar(null); avisar({ texto: tx('Inquérito guardado.') }); carregar(); recarregar() }}
        falhou={(e) => avisar({ tipo: 'erro', texto: e.message })}
        cancelar={() => setEditar(null)}
      />
    )
  }

  const definir = (k, v) => setRespostas((r) => ({ ...r, [k]: v }))
  async function enviar() {
    setAEnviar(true)
    try {
      const r = await api(`/inqueritos/${i.id}/respostas`, { metodo: 'POST', corpo: { respostas } })
      setI(r)
      avisar({ texto: i.tipo === 'avaliacao' ? tx('Obrigado: a sua avaliação foi registada de forma anónima.') : tx('Resposta registada.') })
      recarregar()
    } catch (falha) {
      avisar({ tipo: 'erro', texto: falha.message })
    } finally {
      setAEnviar(false)
    }
  }

  const icone = i.tipo === 'avaliacao' ? 'fa-user-check' : i.tipo === 'inquerito' ? 'fa-clipboard-list' : 'fa-poll'
  const feito = (texto, icon = 'fa-check-circle text-success') => <div className="gf-feito"><b><i className={`fa ${icon} me-2`} />{texto}</b></div>
  let estado = null
  if (eDocente) {
    estado = (
      <div className="gf-feito">
        <b><i className={`fa ${icone} text-muted me-2`} />{tx('{0} pergunta(s)', { 0: i.perguntas.length })}</b>
        {i.tipo === 'inquerito' && (
          <span className="d-flex flex-wrap align-items-center gap-2">
            <span className="text-muted">{tx('Responderam {0} estudante(s).', { 0: i.respostas ?? 0 })} {MOSTRAR.nunca}</span>
            <button type="button" className="btn btn-sm btn-white" onClick={() => setEditar({ ...i, fecha: paraCampo(i.fecha) })}><i className="fa fa-pen me-1" />{i.respostas ? tx('Editar título e fecho') : tx('Editar')}</button>
          </span>
        )}
        {i.tipo === 'sondagem' && <span className="text-muted">{MOSTRAR[i.mostrarResultados]} {i.estudantes !== undefined && tx('Responderam {0} de {1} estudantes.', { 0: i.resultados?.total ?? 0, 1: i.estudantes })}</span>}
      </div>
    )
  } else if (i.respondido && !i.podeResponder) estado = feito(i.tipo === 'avaliacao' ? tx('Já respondeu. Obrigado pela sua avaliação.') : tx('Já respondeu.'))
  else if (!i.podeResponder) estado = feito(i.fechado ? tx('Este inquérito já fechou.') : tx('Ainda não abriu.'), 'fa-lock text-muted')

  return (
    <div className="p-coluna">
      <FormularioInquerito
        titulo={i.titulo}
        descricao={i.descricao}
        anonimo={i.anonimo}
        rodape={i.fecha && <div className="gf-notas pt-0 border-0 mt-2"><span><i className="fa fa-calendar-alt me-2" />{i.fechado ? tx('Fechou') : tx('Fecha')} {dataHora(i.fecha)}</span></div>}
        perguntas={i.perguntas}
        respostas={respostas}
        definir={definir}
        limpar={() => setRespostas({})}
        aoEnviar={enviar}
        aEnviar={aEnviar}
        textoEnviar={i.respondido ? tx('Mudar a resposta') : tx('Enviar')}
        estado={estado}
      />

      {i.aviso && <div className="alert alert-info"><i className="fa fa-info-circle me-1" />{i.aviso}</div>}
      {i.resultados && (
        <Cartao titulo={<><i className="fa fa-chart-bar me-2" />{tx('Resultados')}</>}>
          <ResultadosInquerito resultados={i.resultados} media={i.tipo === 'avaliacao' ? i.media : undefined} />
        </Cartao>
      )}
      {i.porEstudante?.length > 0 && (
        <Cartao titulo={<><i className="fa fa-users me-2" />{tx('Respostas por estudante')}</>} corpo={false}>
          <div className="table-responsive">
            <table className="table table-striped mb-0">
              <thead><tr><th>{tx('Estudante')}</th><th>{tx('Escolha')}</th></tr></thead>
              <tbody>{i.porEstudante.map((r, k) => <tr key={k}><td>{r.estudante}</td><td>{(r.respostas[0] || []).map((j) => i.perguntas[0].opcoes[j]).join(', ')}</td></tr>)}</tbody>
            </table>
          </div>
        </Cartao>
      )}
    </div>
  )
}

export default Inquerito
