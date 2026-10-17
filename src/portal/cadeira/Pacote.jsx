import { useEffect, useRef, useState } from 'react'
import { api } from '../api'
import { Cartao } from '../componentes'
import { dataHora } from '../formatar'
import { t as tx } from '../../i18n/linguas'

const ESTADOS = { nao_iniciado: ['bg-light text-dark border', tx('Não iniciou')], iniciado: ['bg-warning text-dark', tx('Em curso')], concluido: ['bg-success', tx('Concluído')], aprovado: ['bg-success', tx('Aprovado')], reprovado: ['bg-danger', tx('Não aprovado')] }
const minutos = (s) => (s ? tx('{0} min', { 0: Math.max(1, Math.round(s / 60)) }) : '—')

/*
  Conteúdo interativo (SCORM ou H5P) aberto dentro do portal: o leitor corre numa moldura servida
  pela API, que guarda o estado e a nota. O docente vê também os resultados da turma.
*/
function Pacote({ m, eDocente, aoMudar, falhou }) {
  const [url, setUrl] = useState('')
  const [estado, setEstado] = useState(null)
  const moldura = useRef(null)
  // abre-se uma vez por material (voltar a desenhar a página, por exemplo ao atualizar o progresso, não recomeça o pacote)
  const avisos = useRef({ falhou, aoMudar })
  useEffect(() => { avisos.current = { falhou, aoMudar } })
  useEffect(() => {
    let ativo = true
    api(`/materiais/${m.id}/pacote`, { metodo: 'POST' }).then((r) => { if (ativo) setUrl(r.url) }).catch((e) => avisos.current.falhou(e))
    return () => { ativo = false }
  }, [m.id])

  // o leitor avisa quando o estado muda (concluído, nota…)
  useEffect(() => {
    const ouvir = (e) => {
      if (!url || e.origin !== new URL(url).origin || !e.data?.esgPacote) return
      // um "iniciado" depois de concluído (ao voltar a abrir) não apaga o que já se fez
      setEstado((x) => (x && ['concluido', 'aprovado'].includes(x.estado) && e.data.estado === 'iniciado' ? x : e.data))
      if (['concluido', 'aprovado'].includes(e.data.estado)) avisos.current.aoMudar?.()
    }
    window.addEventListener('message', ouvir)
    return () => window.removeEventListener('message', ouvir)
  }, [url])

  const eScorm = m.tipo === 'scorm'
  return (
    <>
      <Cartao
        titulo={<><i className={`fa ${eScorm ? 'fa-cube' : 'fa-puzzle-piece'} me-2`} />{m.titulo}</>}
        acoes={estado && ESTADOS[estado.estado] && <span className={`badge ${ESTADOS[estado.estado][0]}`}>{ESTADOS[estado.estado][1]}{estado.nota !== null && estado.nota !== undefined ? ` · ${Number(estado.nota).toFixed(1)}` : ''}</span>}
        corpo={false}
      >
        {m.descricao && <p className="text-muted px-3 pt-3 mb-0">{m.descricao}</p>}
        <div className="p-pacote" ref={moldura}>
          {url ? <iframe title={m.titulo} src={url} allow="fullscreen; autoplay; encrypted-media" allowFullScreen /> : <div className="p-pacote-carregar">{tx('A abrir o conteúdo…')}</div>}
        </div>
        <div className="d-flex gap-2 flex-wrap p-2 border-top">
          <button type="button" className="btn btn-sm btn-white" onClick={() => moldura.current?.requestFullscreen?.()}><i className="fa fa-expand me-1" />{tx('Ecrã inteiro')}</button>
          <span className="small text-muted align-self-center ms-auto">{eScorm ? tx('Pacote SCORM {0}', { 0: m.estrutura?.versao || '' }) : tx('Conteúdo interativo H5P')} · {eDocente ? tx('como docente, as suas respostas não contam') : tx('o progresso fica guardado')}</span>
        </div>
      </Cartao>
      {eDocente && <Resultados m={m} />}
    </>
  )
}

function Resultados({ m }) {
  const [d, setD] = useState(null)
  useEffect(() => { api(`/materiais/${m.id}/pacote/resultados`).then(setD).catch(() => setD({ linhas: [] })) }, [m.id])
  if (!d) return null
  const feitos = d.linhas.filter((l) => ['concluido', 'aprovado'].includes(l.estado)).length
  return (
    <Cartao titulo={<><i className="fa fa-users me-2" />{tx('Resultados da turma')}</>} acoes={<span className="text-white small">{tx('{0} de {1} concluíram', { 0: feitos, 1: d.linhas.length })}</span>} corpo={false}>
      <div className="table-responsive">
        <table className="table table-striped align-middle mb-0">
          <thead><tr><th>{tx('Estudante')}</th><th>{tx('Estado')}</th><th className="text-center">{tx('Nota')}</th><th className="text-center">{tx('Tempo')}</th><th>{tx('Última vez')}</th></tr></thead>
          <tbody>
            {d.linhas.map((l) => (
              <tr key={l.estudante.id}>
                <td>{l.estudante.nome}</td>
                <td><span className={`badge ${ESTADOS[l.estado][0]}`}>{ESTADOS[l.estado][1]}</span></td>
                <td className="text-center">{l.nota === null ? '—' : Number(l.nota).toFixed(1)}</td>
                <td className="text-center">{minutos(l.tempoSegundos)}</td>
                <td className="small text-muted">{l.atualizadoEm ? dataHora(l.atualizadoEm) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Cartao>
  )
}

export default Pacote
