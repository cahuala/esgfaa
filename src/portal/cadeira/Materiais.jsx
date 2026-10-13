import { useState } from 'react'
import { FaDownload, FaExternalLinkAlt, FaEye, FaFileAlt, FaLink, FaPlay, FaTrashAlt } from 'react-icons/fa'
import { abrirFicheiro, api } from '../api'
import { Campo, Cartao, Vazio } from '../componentes'
import { data } from '../formatar'

const ICONES = { ficheiro: FaFileAlt, ligacao: FaLink, video: FaPlay }

function Materiais({ c, eDocente, recarregar, avisar }) {
  // agrupados por tópico ("Semana 1", "Bibliografia", …)
  const grupos = c.materiais.reduce((g, m) => {
    const t = m.topico || 'Geral'
    ;(g[t] ||= []).push(m)
    return g
  }, {})

  async function apagar(m) {
    if (!window.confirm(`Apagar "${m.titulo}"? Os estudantes deixam de o ver.`)) return
    try {
      await api(`/materiais/${m.id}`, { metodo: 'DELETE' })
      avisar({ texto: 'Material apagado.' })
      recarregar()
    } catch (e) {
      avisar({ tipo: 'erro', texto: e.message })
    }
  }

  const abrir = (m, ver) => abrirFicheiro(m.ficheiroId, { nome: m.titulo, ver }).catch((e) => avisar({ tipo: 'erro', texto: e.message }))

  return (
    <div className={eDocente ? 'p-grelha-lado' : ''}>
      <div className="p-coluna">
        {c.materiais.length === 0 && <Vazio>{eDocente ? 'Ainda não publicou materiais.' : 'O docente ainda não publicou materiais.'}</Vazio>}
        {Object.entries(grupos).map(([topico, lista]) => (
          <Cartao key={topico} titulo={topico}>
            <ul className="p-lista">
              {lista.map((m) => {
                const Icone = ICONES[m.tipo] || FaFileAlt
                return (
                  <li key={m.id} className="p-material">
                    <span className="p-material-icone"><Icone aria-hidden="true" /></span>
                    <div className="p-material-texto">
                      <strong>{m.titulo}</strong>
                      {m.descricao && <span className="p-texto-suave">{m.descricao}</span>}
                      <small className="p-texto-fraco">Publicado em {data(m.publicadoEm)}</small>
                    </div>
                    <div className="p-material-acoes">
                      {m.tipo === 'ficheiro' ? (
                        <>
                          <button type="button" className="p-botao p-botao-contorno p-botao-pequeno" onClick={() => abrir(m, true)} title="Ver"><FaEye aria-hidden="true" /> Ver</button>
                          <button type="button" className="p-botao p-botao-pequeno" onClick={() => abrir(m, false)} title="Descarregar"><FaDownload aria-hidden="true" /> Descarregar</button>
                        </>
                      ) : (
                        <a href={m.url} target="_blank" rel="noopener noreferrer" className="p-botao p-botao-pequeno"><FaExternalLinkAlt aria-hidden="true" /> Abrir</a>
                      )}
                      {eDocente && <button type="button" className="p-botao-icone" onClick={() => apagar(m)} aria-label={`Apagar ${m.titulo}`}><FaTrashAlt /></button>}
                    </div>
                  </li>
                )
              })}
            </ul>
          </Cartao>
        ))}
      </div>
      {eDocente && <NovoMaterial c={c} recarregar={recarregar} avisar={avisar} />}
    </div>
  )
}

function NovoMaterial({ c, recarregar, avisar }) {
  const vazio = { titulo: '', topico: '', tipo: 'ficheiro', url: '', descricao: '' }
  const [f, setF] = useState(vazio)
  const [ficheiro, setFicheiro] = useState(null)
  const [erro, setErro] = useState('')
  const [aEnviar, setAEnviar] = useState(false)
  const topicos = [...new Set(c.materiais.map((m) => m.topico).filter(Boolean))]

  async function publicar(e) {
    e.preventDefault()
    setErro('')
    setAEnviar(true)
    try {
      const fd = new FormData()
      Object.entries(f).forEach(([k, v]) => fd.append(k, v))
      if (f.tipo === 'ficheiro' && ficheiro) fd.append('ficheiro', ficheiro)
      await api(`/cadeiras/${c.id}/materiais`, { metodo: 'POST', formulario: fd })
      setF({ ...vazio, topico: f.topico })
      setFicheiro(null)
      e.target.reset()
      avisar({ texto: 'Material publicado. Os estudantes já o veem.' })
      recarregar()
    } catch (falha) {
      setErro(falha.message)
    } finally {
      setAEnviar(false)
    }
  }

  return (
    <Cartao titulo="Publicar material">
      <form onSubmit={publicar} className="p-formulario">
        {erro && <p className="p-erro" role="alert">{erro}</p>}
        <Campo id="m-titulo" rotulo="Título">
          <input id="m-titulo" value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} maxLength={200} required />
        </Campo>
        <Campo id="m-topico" rotulo="Tópico" ajuda="Agrupa os materiais (ex.: Semana 1, Bibliografia).">
          <input id="m-topico" list="m-topicos" value={f.topico} onChange={(e) => setF({ ...f, topico: e.target.value })} maxLength={120} />
          <datalist id="m-topicos">{topicos.map((t) => <option key={t} value={t} />)}</datalist>
        </Campo>
        <Campo id="m-tipo" rotulo="Tipo">
          <select id="m-tipo" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>
            <option value="ficheiro">Ficheiro (PDF, Word, PowerPoint, Excel, imagem, vídeo)</option>
            <option value="ligacao">Ligação para outro site</option>
            <option value="video">Vídeo (YouTube ou outro endereço)</option>
          </select>
        </Campo>
        {f.tipo === 'ficheiro' ? (
          <Campo id="m-ficheiro" rotulo="Ficheiro">
            <input id="m-ficheiro" type="file" onChange={(e) => setFicheiro(e.target.files[0] || null)} required />
          </Campo>
        ) : (
          <Campo id="m-url" rotulo="Endereço">
            <input id="m-url" type="url" placeholder="https://…" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} required />
          </Campo>
        )}
        <Campo id="m-descricao" rotulo="Descrição (opcional)">
          <textarea id="m-descricao" rows={3} value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} maxLength={2000} />
        </Campo>
        <button type="submit" className="p-botao" disabled={aEnviar}>{aEnviar ? 'A publicar…' : 'Publicar'}</button>
      </form>
    </Cartao>
  )
}

export default Materiais
