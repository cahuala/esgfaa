import { useEffect, useState } from 'react'
import { FaHeart, FaRegHeart, FaRegComment, FaShareAlt, FaEye, FaCheck, FaFacebookF, FaWhatsapp, FaLinkedinIn } from 'react-icons/fa'
import { useConteudo } from '../../conteudo/contexto'
import { API_URL, idVisitante, pedido } from '../../conteudo/api'
import { tempoRelativo } from '../../utils/datas'
import styles from './Interacoes.module.css'

/*
  Gostos, partilha, visualizações e comentários de uma notícia, evento ou artigo.
  Sem API configurada (ou se ela falhar) mostra só a partilha.
*/
// "Ana Silva" -> "AS"; "Ana" -> "AN"
const iniciais = (nome) => {
  const partes = nome.trim().split(/\s+/)
  return (partes.length > 1 ? partes[0][0] + partes[partes.length - 1][0] : partes[0].slice(0, 2)).toUpperCase()
}

function Interacoes({ colecao, id, titulo }) {
  const { atualizarEstatisticas } = useConteudo()
  const [estado, setEstado] = useState(null) // { gostos, gostei, comentarios, visualizacoes }
  const [indisponivel, setIndisponivel] = useState(!API_URL)
  const [form, setForm] = useState({ nome: '', texto: '', website: '' })
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const [copiado, setCopiado] = useState(false)
  const visitante = idVisitante()

  useEffect(() => {
    if (!API_URL) return
    let ativo = true
    pedido(`/api/publico/interacoes/${colecao}/${id}?visitante=${visitante}`)
      .then((r) => { if (ativo) { setEstado(r); setIndisponivel(false) } })
      .catch(() => { if (ativo) setIndisponivel(true) })
    pedido(`/api/publico/interacoes/${colecao}/${id}/visualizacao`, { method: 'POST', body: JSON.stringify({ visitante }) }).catch(() => {})
    return () => { ativo = false }
  }, [colecao, id, visitante])

  function aplicar(r) {
    setEstado(r)
    atualizarEstatisticas(colecao, id, { gostos: r.gostos, comentarios: r.comentarios.length, visualizacoes: r.visualizacoes })
  }

  async function alternarGosto() {
    if (!estado) return
    // resposta imediata no ecrã; corrige se o servidor discordar
    const anterior = estado
    setEstado({ ...estado, gostei: !estado.gostei, gostos: estado.gostos + (estado.gostei ? -1 : 1) })
    try {
      aplicar(await pedido(`/api/publico/interacoes/${colecao}/${id}/gosto`, { method: 'POST', body: JSON.stringify({ visitante }) }))
    } catch {
      setEstado(anterior)
    }
  }

  async function partilhar() {
    const url = window.location.href
    if (navigator.share) {
      try { await navigator.share({ title: titulo, url }) } catch { /* cancelado */ }
      return
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch { /* sem acesso à área de transferência */ }
  }

  async function comentar(e) {
    e.preventDefault()
    setErro('')
    setEnviando(true)
    try {
      const r = await pedido(`/api/publico/interacoes/${colecao}/${id}/comentarios`, {
        method: 'POST',
        body: JSON.stringify({ ...form, visitante }),
      })
      if (r) aplicar(r)
      setForm({ nome: form.nome, texto: '', website: '' })
    } catch (falha) {
      setErro(falha.message)
    } finally {
      setEnviando(false)
    }
  }

  const url = typeof window !== 'undefined' ? encodeURIComponent(window.location.href) : ''
  const t = encodeURIComponent(titulo)
  const total = estado?.comentarios.length || 0

  return (
    <section className={styles.interacoes} aria-label="Reações e comentários">
      <div className={styles.barra}>
        {!indisponivel && (
          <button
            className={`${styles.gosto} ${estado?.gostei ? styles.gostoAtivo : ''}`}
            onClick={alternarGosto}
            aria-pressed={Boolean(estado?.gostei)}
            disabled={!estado}
          >
            {estado?.gostei ? <FaHeart aria-hidden="true" /> : <FaRegHeart aria-hidden="true" />}
            <span>{estado?.gostei ? 'Gostei' : 'Gosto'}</span>
            <strong>{estado?.gostos ?? '–'}</strong>
          </button>
        )}

        {!indisponivel && (
          <a href="#comentarios" className={styles.botaoBarra}>
            <FaRegComment aria-hidden="true" />
            <span>{total} {total === 1 ? 'comentário' : 'comentários'}</span>
          </a>
        )}

        <button className={styles.botaoBarra} onClick={partilhar}>
          {copiado ? <FaCheck aria-hidden="true" /> : <FaShareAlt aria-hidden="true" />}
          <span>{copiado ? 'Ligação copiada' : 'Partilhar'}</span>
        </button>

        <div className={styles.redes}>
          <a href={`https://www.facebook.com/sharer/sharer.php?u=${url}`} target="_blank" rel="noopener noreferrer" aria-label="Partilhar no Facebook"><FaFacebookF /></a>
          <a href={`https://wa.me/?text=${t}%20${url}`} target="_blank" rel="noopener noreferrer" aria-label="Partilhar no WhatsApp"><FaWhatsapp /></a>
          <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${url}`} target="_blank" rel="noopener noreferrer" aria-label="Partilhar no LinkedIn"><FaLinkedinIn /></a>
        </div>

        {estado && estado.visualizacoes > 0 && (
          <span className={styles.vistas}><FaEye aria-hidden="true" /> {estado.visualizacoes} {estado.visualizacoes === 1 ? 'visualização' : 'visualizações'}</span>
        )}
      </div>

      {indisponivel ? (
        API_URL && <p className={styles.aviso}>Os gostos e comentários estão temporariamente indisponíveis.</p>
      ) : (
        <div id="comentarios" className={styles.comentarios}>
          <h2>
            Comentários <span>{String(total).padStart(2, '0')}</span>
          </h2>

          <form className={styles.formulario} onSubmit={comentar}>
            <div className={styles.linha}>
              <label>
                <span>Nome</span>
                <input
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  maxLength={80}
                  autoComplete="name"
                  required
                />
              </label>
              {/* campo armadilha para robôs: invisível para pessoas */}
              <label className={styles.armadilha} aria-hidden="true">
                Website
                <input tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
              </label>
            </div>
            <label>
              <span>Comentário</span>
              <textarea
                value={form.texto}
                onChange={(e) => setForm({ ...form, texto: e.target.value })}
                maxLength={2000}
                rows={4}
                required
              />
            </label>
            <div className={styles.enviar}>
              <small>Os comentários são públicos. Seja respeitoso: comentários ofensivos são removidos.</small>
              <button type="submit" disabled={enviando}>{enviando ? 'A publicar…' : 'Publicar comentário'}</button>
            </div>
            {erro && <p className={styles.erro} role="alert">{erro}</p>}
          </form>

          {total === 0 ? (
            <p className={styles.semComentarios}>Ainda não há comentários. Seja o primeiro a comentar.</p>
          ) : (
            <ol className={styles.lista}>
              {estado.comentarios.map((c) => (
                <li key={c.id}>
                  <span className={styles.avatar} aria-hidden="true">{iniciais(c.nome)}</span>
                  <div>
                    <p className={styles.autor}>
                      <strong>{c.nome}</strong>
                      <time dateTime={c.data}>{tempoRelativo(c.data)}</time>
                    </p>
                    <p className={styles.texto}>{c.texto}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </section>
  )
}

export default Interacoes
