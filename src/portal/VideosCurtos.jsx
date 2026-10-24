import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Historias from '../components/Historias/Historias'
import { api, enviarComProgresso, urlFicheiro } from './api'
import { API_URL } from '../conteudo/api'
import { confirmar, pedir } from './dialogos'
import { gruposDoSite } from '../utils/videosDoSite'
import { t as tx } from '../i18n/linguas'

/*
  Vídeos curtos no Portal, como os estados do WhatsApp:
  - na cadeira, os vídeos do docente (o docente publica com o círculo «+»: grava no telemóvel e escolhe);
  - na página inicial, um círculo por cadeira com vídeos novos e as actividades da Escola em vídeo.
  Os ficheiros pedem-se com a sessão: a capa logo, o vídeo só quando se vai ver.
*/
const MAX_MB = 60
const MAX_SEGUNDOS = 180

// as capas dos vídeos (ficheiros privados), como endereços locais; revogam-se ao sair
function useCapas(ids) {
  const [capas, setCapas] = useState({})
  const pedidas = useRef(new Map())
  const chave = ids.join(',')
  useEffect(() => {
    for (const id of chave ? chave.split(',') : []) {
      if (pedidas.current.has(id)) continue
      pedidas.current.set(id, null)
      urlFicheiro(`/ficheiros/${id}`).then((u) => { pedidas.current.set(id, u); setCapas((m) => ({ ...m, [id]: u })) }, () => {})
    }
  }, [chave])
  useEffect(() => () => { for (const u of pedidas.current.values()) if (u) URL.revokeObjectURL(u) }, [])
  return capas
}

const comoItem = (v, capas) => ({
  id: `cadeira-${v.id}`, video: v, poster: v.capaId ? capas[v.capaId] : undefined, legenda: v.legenda, data: v.criadoEm,
  obter: () => urlFicheiro(`/ficheiros/${v.ficheiroId}`),
})

// a duração e a primeira imagem do vídeo escolhido (a capa), tiradas no navegador
function prepararVideo(ficheiro) {
  return new Promise((resolver, rejeitar) => {
    const url = URL.createObjectURL(ficheiro)
    const v = document.createElement('video')
    v.muted = true
    v.playsInline = true
    v.preload = 'auto'
    const acabar = (r) => { URL.revokeObjectURL(url); resolver(r) }
    v.onerror = () => { URL.revokeObjectURL(url); rejeitar(new Error(tx('Este vídeo não abre no navegador. Grave-o em MP4.'))) }
    v.onloadedmetadata = () => { v.currentTime = Math.min(0.5, (v.duration || 1) / 2) }
    v.onseeked = () => {
      const c = document.createElement('canvas')
      const k = Math.min(1, 720 / Math.max(v.videoWidth || 1, v.videoHeight || 1))
      c.width = Math.round((v.videoWidth || 360) * k)
      c.height = Math.round((v.videoHeight || 640) * k)
      c.getContext('2d').drawImage(v, 0, 0, c.width, c.height)
      // alguns vídeos gravados no navegador (WebM) não dizem a duração: fica por saber
      c.toBlob((capa) => acabar({ duracao: Number.isFinite(v.duration) ? v.duration : null, capa }), 'image/jpeg', 0.8)
    }
    v.src = url
  })
}

export function VideosDaCadeira({ c, eDocente, avisar }) {
  const [lista, setLista] = useState([])
  const [envio, setEnvio] = useState(null) // percentagem do envio
  const entrada = useRef(null)
  const carregar = useCallback(() => api(`/cadeiras/${c.id}/videos-curtos`).then(setLista).catch(() => setLista([])), [c.id])
  useEffect(() => { carregar() }, [carregar])
  const capas = useCapas(lista.map((v) => v.capaId).filter(Boolean))
  const grupos = useMemo(() => lista.map((v) => ({
    id: `v-${v.id}`, titulo: v.legenda || new Date(v.criadoEm).toLocaleDateString(), subtitulo: v.autor, capa: v.capaId ? capas[v.capaId] : undefined,
    itens: [comoItem(v, capas)],
  })), [lista, capas])

  async function escolhido(e) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    try {
      if (!/^video\/(mp4|webm|quicktime)$/.test(f.type)) throw new Error(tx('Escolha um vídeo (MP4).'))
      if (f.size > MAX_MB * 1024 * 1024) throw new Error(tx('O vídeo tem mais de {0} MB. Grave um vídeo mais curto.', { 0: MAX_MB }))
      const { duracao, capa } = await prepararVideo(f)
      if (duracao > MAX_SEGUNDOS) throw new Error(tx('O vídeo tem de ter até 3 minutos.'))
      const legenda = await pedir(tx('Legenda (opcional)'), '', { titulo: tx('Novo vídeo curto'), botao: tx('Publicar'), obrigatorio: false })
      if (legenda === null) return
      const fd = new FormData()
      // o iPhone grava em .mov (QuickTime); o conteúdo é MP4, que é o que o servidor aceita
      fd.append('ficheiro', f.type === 'video/quicktime' ? new File([f], f.name.replace(/\.mov$/i, '.mp4'), { type: 'video/mp4' }) : f)
      if (capa) fd.append('ficheiros', new File([capa], 'capa.jpg', { type: 'image/jpeg' }))
      fd.append('legenda', legenda)
      if (duracao !== null) fd.append('duracao', String(Math.round(duracao)))
      setEnvio(0)
      await enviarComProgresso(`/cadeiras/${c.id}/videos-curtos`, fd, { aoProgresso: setEnvio })
      avisar({ texto: tx('Vídeo publicado. Os estudantes da cadeira já o podem ver.') })
      carregar()
    } catch (x) {
      avisar({ tipo: 'erro', texto: x.message })
    } finally {
      setEnvio(null)
    }
  }

  async function apagar(item) {
    if (!(await confirmar(tx('Apagar este vídeo? Os estudantes deixam de o ver.'), { titulo: tx('Apagar vídeo'), botao: tx('Apagar'), perigo: true }))) return false
    try {
      await api(`/videos-curtos/${item.video.id}`, { metodo: 'DELETE' })
      carregar()
      return true
    } catch (x) {
      avisar({ tipo: 'erro', texto: x.message })
      return false
    }
  }

  if (!eDocente && !lista.length) return null
  return (
    <div className="mb-3">
      <Historias
        grupos={grupos}
        titulo={tx('Vídeos curtos')}
        adicionar={eDocente && envio === null ? { texto: tx('Novo vídeo'), aoClicar: () => entrada.current?.click() } : null}
        apagar={eDocente ? apagar : null}
      />
      {eDocente && <input ref={entrada} type="file" accept="video/*" capture="environment" hidden onChange={escolhido} />}
      {envio !== null && (
        <div className="d-flex align-items-center gap-2 small">
          <span>{tx('A enviar o vídeo…')}</span>
          <div className="progress flex-grow-1" style={{ height: 6, maxWidth: 280 }}><div className="progress-bar bg-theme" style={{ width: `${envio}%` }} /></div>
          <span>{envio}%</span>
        </div>
      )}
      {eDocente && !lista.length && envio === null && <div className="small text-muted">{tx('Grave no telemóvel a aula, o exercício ou a visita (até 3 minutos) e publique-o aqui. Os estudantes veem-no como um estado do WhatsApp.')}</div>}
    </div>
  )
}

// página inicial do Portal: as cadeiras com vídeos novos e as actividades da Escola
export function VideosDoInicio() {
  const [cadeiras, setCadeiras] = useState([])
  const [escola, setEscola] = useState([])
  const navegar = useNavigate()
  useEffect(() => {
    api('/videos-curtos').then(setCadeiras).catch(() => {})
    if (API_URL) fetch(`${API_URL}/api/publico/videos-curtos`).then((r) => (r.ok ? r.json() : null)).then((d) => d && setEscola(gruposDoSite(d))).catch(() => {})
  }, [])
  const capas = useCapas(cadeiras.flatMap((g) => g.videos.map((v) => v.capaId)).filter(Boolean))
  const grupos = useMemo(() => [
    ...cadeiras.map((g) => ({
      id: `cadeira-${g.cadeira.id}`, tipo: 'cadeira', cadeiraId: g.cadeira.id, textoVerMais: tx('Abrir a cadeira'), titulo: g.cadeira.nome, subtitulo: g.cadeira.codigo,
      capa: g.videos.map((v) => v.capaId && capas[v.capaId]).find(Boolean),
      itens: g.videos.map((v) => comoItem(v, capas)),
    })),
    ...escola.map((g) => ({ ...g, subtitulo: g.subtitulo || tx('Escola') })),
  ], [cadeiras, escola, capas])
  if (!grupos.length) return null
  return (
    <div className="mb-3">
      <Historias
        grupos={grupos}
        titulo={tx('Destaques')}
        verMais={(g) => (g.tipo === 'cadeira' ? navegar(`/cadeiras/${g.cadeiraId}`) : window.location.assign(new URL(g.ligacao, window.location.origin).href))}
      />
    </div>
  )
}
