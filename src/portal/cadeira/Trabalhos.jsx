import { useCallback, useEffect, useState } from 'react'
import { FaClock, FaDownload, FaTrashAlt, FaUpload } from 'react-icons/fa'
import { abrirFicheiro, api } from '../api'
import { Campo, Cartao, Etiqueta, Vazio } from '../componentes'
import { dataHora, faltam, localParaIso, nota } from '../formatar'

const ESTADO = { aberto: ['verde', 'Aberto'], atrasado: ['dourado', 'Fora de prazo (aceita atrasos)'], fechado: ['cinzento', 'Fechado'] }

function Trabalhos({ c, eDocente, recarregar, avisar }) {
  const [aberto, setAberto] = useState(null) // trabalho com as entregas abertas (docente)
  const baixar = (id, nome) => abrirFicheiro(id, { nome }).catch((e) => avisar({ tipo: 'erro', texto: e.message }))

  return (
    <div className={eDocente ? 'p-grelha-lado' : ''}>
      <div className="p-coluna">
        {c.trabalhos.length === 0 && <Vazio>Sem trabalhos.</Vazio>}
        {c.trabalhos.map((t) => (
          <Cartao key={t.id} titulo={t.titulo} acoes={<Etiqueta cor={ESTADO[t.estado][0]}>{ESTADO[t.estado][1]}</Etiqueta>}>
            <p className="p-linha-meta"><FaClock aria-hidden="true" /> Prazo: <strong>{dataHora(t.prazo)}</strong> · {faltam(t.prazo)}</p>
            {t.enunciado && <p className="p-texto-pre">{t.enunciado}</p>}
            {t.ficheiroId && <button type="button" className="p-botao p-botao-contorno p-botao-pequeno" onClick={() => baixar(t.ficheiroId, `Enunciado - ${t.titulo}`)}><FaDownload aria-hidden="true" /> Enunciado</button>}

            {eDocente ? (
              <div className="p-acoes-linha">
                <button type="button" className="p-botao p-botao-pequeno" onClick={() => setAberto(aberto === t.id ? null : t.id)}>
                  {aberto === t.id ? 'Fechar entregas' : `Ver entregas (${t.entregas})`}
                </button>
                <button type="button" className="p-botao-icone" aria-label="Apagar trabalho" onClick={async () => {
                  if (!window.confirm(`Apagar "${t.titulo}" e todas as entregas?`)) return
                  await api(`/trabalhos/${t.id}`, { metodo: 'DELETE' }).then(recarregar).catch((x) => avisar({ tipo: 'erro', texto: x.message }))
                }}><FaTrashAlt /></button>
              </div>
            ) : (
              <MinhaEntrega t={t} recarregar={recarregar} avisar={avisar} baixar={baixar} />
            )}
            {eDocente && aberto === t.id && <Entregas trabalho={t} avisar={avisar} baixar={baixar} />}
          </Cartao>
        ))}
      </div>
      {eDocente && <NovoTrabalho c={c} recarregar={recarregar} avisar={avisar} />}
    </div>
  )
}

// estudante: estado da sua entrega e formulário para entregar (ou substituir)
function MinhaEntrega({ t, recarregar, avisar, baixar }) {
  const [ficheiro, setFicheiro] = useState(null)
  const [comentario, setComentario] = useState('')
  const [aEnviar, setAEnviar] = useState(false)
  const [erro, setErro] = useState('')
  const e = t.entrega
  const podeEntregar = t.estado !== 'fechado' && !(e && e.nota !== null)

  async function entregar(ev) {
    ev.preventDefault()
    setErro('')
    setAEnviar(true)
    try {
      const fd = new FormData()
      fd.append('comentario', comentario)
      if (ficheiro) fd.append('ficheiro', ficheiro)
      await api(`/trabalhos/${t.id}/entrega`, { metodo: 'POST', formulario: fd })
      avisar({ texto: 'Trabalho entregue.' })
      recarregar()
    } catch (falha) {
      setErro(falha.message)
    } finally {
      setAEnviar(false)
    }
  }

  return (
    <div className="p-entrega">
      {e ? (
        <div className="p-entrega-feita">
          <Etiqueta cor={e.atrasada ? 'dourado' : 'verde'}>{e.atrasada ? 'Entregue com atraso' : 'Entregue'}</Etiqueta>
          <span className="p-texto-suave"> {dataHora(e.entregueEm)}</span>
          <button type="button" className="p-ligacao-simples" onClick={() => baixar(e.ficheiroId, `Entrega - ${t.titulo}`)}>Ver o que entreguei</button>
          {e.nota !== null && (
            <div className="p-correcao">
              <strong>Nota: {nota(e.nota)}</strong>
              {e.correcao && <p className="p-texto-pre">{e.correcao}</p>}
            </div>
          )}
        </div>
      ) : <Etiqueta cor={t.estado === 'fechado' ? 'vermelho' : 'cinzento'}>{t.estado === 'fechado' ? 'Não entregue' : 'Por entregar'}</Etiqueta>}

      {podeEntregar && (
        <form onSubmit={entregar} className="p-formulario p-entrega-form">
          {erro && <p className="p-erro" role="alert">{erro}</p>}
          <Campo id={`f-${t.id}`} rotulo={e ? 'Substituir a entrega' : 'Ficheiro'} ajuda="PDF, Word, PowerPoint, Excel, imagens ou ZIP.">
            <input id={`f-${t.id}`} type="file" onChange={(x) => setFicheiro(x.target.files[0] || null)} required />
          </Campo>
          <Campo id={`c-${t.id}`} rotulo="Comentário para o docente (opcional)">
            <textarea id={`c-${t.id}`} rows={2} maxLength={2000} value={comentario} onChange={(x) => setComentario(x.target.value)} />
          </Campo>
          <button type="submit" className="p-botao" disabled={aEnviar || !ficheiro}><FaUpload aria-hidden="true" /> {aEnviar ? 'A enviar…' : 'Entregar'}</button>
        </form>
      )}
    </div>
  )
}

// docente: lista de estudantes, entregas e correção
function Entregas({ trabalho, avisar, baixar }) {
  const [d, setD] = useState(null)
  const [notas, setNotas] = useState({})
  const carregar = useCallback(() => api(`/trabalhos/${trabalho.id}/entregas`).then((r) => {
    setD(r)
    setNotas(Object.fromEntries(r.linhas.filter((l) => l.entrega).map((l) => [l.entrega.id, { nota: l.entrega.nota ?? '', correcao: l.entrega.correcao }])))
  }).catch((e) => avisar({ tipo: 'erro', texto: e.message })), [trabalho.id, avisar])
  useEffect(() => { carregar() }, [carregar])
  if (!d) return <p className="p-texto-suave">A carregar entregas…</p>

  async function corrigir(id) {
    try {
      await api(`/entregas/${id}`, { metodo: 'PUT', corpo: notas[id] })
      avisar({ texto: 'Correção guardada.' })
    } catch (e) {
      avisar({ tipo: 'erro', texto: e.message })
    }
  }

  const entregues = d.linhas.filter((l) => l.entrega).length
  return (
    <div className="p-entregas">
      <p className="p-texto-suave">{entregues} de {d.linhas.length} estudantes entregaram.</p>
      <div className="p-tabela-rolavel">
        <table className="p-tabela">
          <thead><tr><th>Estudante</th><th>Entrega</th><th className="p-num">Nota</th><th>Comentário</th><th /></tr></thead>
          <tbody>
            {d.linhas.map(({ estudante, entrega }) => (
              <tr key={estudante.id}>
                <td><strong>{estudante.nome}</strong><div className="p-texto-fraco">{estudante.numero}</div></td>
                <td>
                  {entrega ? (
                    <>
                      <button type="button" className="p-ligacao-simples" onClick={() => baixar(entrega.ficheiroId, `${estudante.numero} - ${trabalho.titulo}`)}>Descarregar</button>
                      <div className="p-texto-fraco">{dataHora(entrega.entregueEm)}{entrega.atrasada && ' · atrasada'}</div>
                      {entrega.comentario && <div className="p-texto-suave">“{entrega.comentario}”</div>}
                    </>
                  ) : <span className="p-texto-fraco">Não entregou</span>}
                </td>
                <td className="p-num">
                  {entrega && <input className="p-nota" inputMode="decimal" aria-label={`Nota de ${estudante.nome}`} value={notas[entrega.id]?.nota ?? ''} onChange={(e) => setNotas({ ...notas, [entrega.id]: { ...notas[entrega.id], nota: e.target.value } })} />}
                </td>
                <td>{entrega && <input aria-label={`Comentário para ${estudante.nome}`} value={notas[entrega.id]?.correcao ?? ''} onChange={(e) => setNotas({ ...notas, [entrega.id]: { ...notas[entrega.id], correcao: e.target.value } })} />}</td>
                <td>{entrega && <button type="button" className="p-botao p-botao-pequeno" onClick={() => corrigir(entrega.id)}>Guardar</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function NovoTrabalho({ c, recarregar, avisar }) {
  const vazio = { titulo: '', enunciado: '', prazo: '', aceitaAtraso: false }
  const [f, setF] = useState(vazio)
  const [ficheiro, setFicheiro] = useState(null)
  const [erro, setErro] = useState('')

  async function criar(e) {
    e.preventDefault()
    setErro('')
    try {
      const fd = new FormData()
      fd.append('titulo', f.titulo)
      fd.append('enunciado', f.enunciado)
      fd.append('prazo', localParaIso(f.prazo))
      fd.append('aceitaAtraso', String(f.aceitaAtraso))
      if (ficheiro) fd.append('ficheiro', ficheiro)
      await api(`/cadeiras/${c.id}/trabalhos`, { metodo: 'POST', formulario: fd })
      setF(vazio)
      setFicheiro(null)
      e.target.reset()
      avisar({ texto: 'Trabalho criado. Os estudantes já o veem.' })
      recarregar()
    } catch (falha) {
      setErro(falha.message)
    }
  }

  return (
    <Cartao titulo="Novo trabalho">
      <form onSubmit={criar} className="p-formulario">
        {erro && <p className="p-erro" role="alert">{erro}</p>}
        <Campo id="t-titulo" rotulo="Título"><input id="t-titulo" value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} maxLength={200} required /></Campo>
        <Campo id="t-enunciado" rotulo="Enunciado"><textarea id="t-enunciado" rows={5} value={f.enunciado} onChange={(e) => setF({ ...f, enunciado: e.target.value })} /></Campo>
        <Campo id="t-ficheiro" rotulo="Enunciado em ficheiro (opcional)"><input id="t-ficheiro" type="file" onChange={(e) => setFicheiro(e.target.files[0] || null)} /></Campo>
        <Campo id="t-prazo" rotulo="Prazo de entrega"><input id="t-prazo" type="datetime-local" value={f.prazo} onChange={(e) => setF({ ...f, prazo: e.target.value })} required /></Campo>
        <label className="p-caixa"><input type="checkbox" checked={f.aceitaAtraso} onChange={(e) => setF({ ...f, aceitaAtraso: e.target.checked })} /> Aceitar entregas depois do prazo (ficam marcadas como atrasadas)</label>
        <button type="submit" className="p-botao">Criar trabalho</button>
      </form>
    </Cartao>
  )
}

export default Trabalhos
