import { useEffect, useRef, useState } from 'react'
import { FaHeart, FaRegHeart, FaRegComment, FaShareAlt, FaEye, FaCheck, FaFacebookF, FaWhatsapp, FaLinkedinIn, FaPaperPlane, FaUser } from 'react-icons/fa'
import { useConteudo } from '../../conteudo/contexto'
import { API_URL, idVisitante, pedido } from '../../conteudo/api'
import { tempoRelativo } from '../../utils/datas'
import styles from './Interacoes.module.css'
import { t } from '../../i18n/linguas'

/*
  Gostos, partilha, visualizações e comentários de uma notícia, evento ou artigo.
  Sem API configurada (ou se ela falhar) mostra só a partilha.
*/
// "Ana Silva" -> "AS"; "Ana" -> "AN"
const iniciais = (nome) => {
  const partes = nome.trim().split(/\s+/)
  return (partes.length > 1 ? partes[0][0] + partes[partes.length - 1][0] : partes[0].slice(0, 2)).toUpperCase()
}

// o nome fica no navegador para o próximo comentário (só neste dispositivo)
const CHAVE_NOME = 'esgfaa-nome-comentario'
const nomeGuardado = () => {
  try { return localStorage.getItem(CHAVE_NOME) || '' } catch { return '' }
}
const guardarNome = (nome) => {
  try { localStorage.setItem(CHAVE_NOME, nome.trim()) } catch { /* sem armazenamento */ }
}

function Interacoes({ colecao, id, titulo }) {
  const { atualizarEstatisticas } = useConteudo()
  const [estado, setEstado] = useState(null) // { gostos, gostei, comentarios, visualizacoes }
  const [indisponivel, setIndisponivel] = useState(!API_URL)
  const [form, setForm] = useState(() => ({ nome: nomeGuardado(), texto: '', website: '' }))
  const formRef = useRef(null)
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
      guardarNome(form.nome)
      setForm({ nome: form.nome, texto: '', website: '' })
      const caixa = formRef.current?.querySelector('textarea')
      if (caixa) caixa.style.height = ''
    } catch (falha) {
      setErro(falha.message)
    } finally {
      setEnviando(false)
    }
  }

  const url = typeof window !== 'undefined' ? encodeURIComponent(window.location.href) : ''
  const tit = encodeURIComponent(titulo)
  const total = estado?.comentarios.length || 0

  return (
    <section className={styles.interacoes} aria-label={t('Reações e comentários')}>
      <div className={styles.barra}>
        {!indisponivel && (
          <button
            className={`${styles.gosto} ${estado?.gostei ? styles.gostoAtivo : ''}`}
            onClick={alternarGosto}
            aria-pressed={Boolean(estado?.gostei)}
            disabled={!estado}
          >
            {estado?.gostei ? <FaHeart aria-hidden="true" /> : <FaRegHeart aria-hidden="true" />}
            <span>{estado?.gostei ? t('Gostei') : t('Gosto')}</span>
            <strong>{estado?.gostos ?? '–'}</strong>
          </button>
        )}

        {!indisponivel && (
          <a href="#comentarios" className={styles.botaoBarra}>
            <FaRegComment aria-hidden="true" />
            <span>{total === 1 ? t('1 comentário') : t('{n} comentários', { n: total })}</span>
          </a>
        )}

        <button className={styles.botaoBarra} onClick={partilhar}>
          {copiado ? <FaCheck aria-hidden="true" /> : <FaShareAlt aria-hidden="true" />}
          <span>{copiado ? t('Ligação copiada') : t('Partilhar')}</span>
        </button>

        <div className={styles.redes}>
          <a href={`https://www.facebook.com/sharer/sharer.php?u=${url}`} target="_blank" rel="noopener noreferrer" aria-label={t('Partilhar no {rede}', { rede: 'Facebook' })}><FaFacebookF /></a>
          <a href={`https://wa.me/?text=${tit}%20${url}`} target="_blank" rel="noopener noreferrer" aria-label={t('Partilhar no {rede}', { rede: 'WhatsApp' })}><FaWhatsapp /></a>
          <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${url}`} target="_blank" rel="noopener noreferrer" aria-label={t('Partilhar no {rede}', { rede: 'LinkedIn' })}><FaLinkedinIn /></a>
        </div>

        {estado && estado.visualizacoes > 0 && (
          <span className={styles.vistas}><FaEye aria-hidden="true" /> {estado.visualizacoes === 1 ? t('1 visualização') : t('{n} visualizações', { n: estado.visualizacoes })}</span>
        )}
      </div>

      {indisponivel ? (
        API_URL && <p className={styles.aviso}>{t('Os gostos e comentários estão temporariamente indisponíveis.')}</p>
      ) : (
        <div id="comentarios" className={styles.comentarios}>
          <h2>
            {t('Comentários')} <span>{total}</span>
          </h2>

          <form className={styles.formulario} onSubmit={comentar} ref={formRef}>
            <span className={styles.avatar} aria-hidden="true">{form.nome.trim() ? iniciais(form.nome) : <FaUser />}</span>
            <div className={styles.campos}>
              <input
                className={styles.nome}
                aria-label={t('Nome')}
                placeholder={t('O seu nome')}
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                maxLength={80}
                autoComplete="name"
                required
              />
              {/* campo armadilha para robôs: invisível para pessoas */}
              <label className={styles.armadilha} aria-hidden="true">
                Website
                <input tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
              </label>
              <div className={styles.balaoEscrever}>
                <textarea
                  aria-label={t('Comentário')}
                  placeholder={t('Escreva um comentário…')}
                  value={form.texto}
                  onChange={(e) => {
                    setForm({ ...form, texto: e.target.value })
                    // cresce com o texto, como no Facebook
                    e.target.style.height = 'auto'
                    e.target.style.height = `${e.target.scrollHeight}px`
                  }}
                  onKeyDown={(e) => {
                    // Enter publica; Shift+Enter muda de linha
                    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault()
                      formRef.current?.requestSubmit()
                    }
                  }}
                  maxLength={2000}
                  rows={1}
                  required
                />
                <button type="submit" className={styles.enviarBotao} disabled={enviando || !form.texto.trim()} aria-label={t('Publicar comentário')} title={t('Publicar comentário')}>
                  <FaPaperPlane aria-hidden="true" />
                </button>
              </div>
              <small className={styles.nota}>{enviando ? t('A publicar…') : t('Os comentários são públicos. Seja respeitoso: comentários ofensivos são removidos.')}</small>
              {erro && <p className={styles.erro} role="alert">{erro}</p>}
            </div>
          </form>

          {total === 0 ? (
            <p className={styles.semComentarios}>{t('Ainda não há comentários. Seja o primeiro a comentar.')}</p>
          ) : (
            <ol className={styles.lista}>
              {estado.comentarios.map((c) => (
                <li key={c.id}>
                  <span className={styles.avatar} aria-hidden="true">{iniciais(c.nome)}</span>
                  <div>
                    <div className={styles.balao}>
                      <strong className={styles.autor}>{c.nome}</strong>
                      <p className={styles.texto}>{c.texto}</p>
                    </div>
                    <time className={styles.quando} dateTime={c.data}>{tempoRelativo(c.data)}</time>
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
