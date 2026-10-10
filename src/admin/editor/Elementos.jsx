import { useEffect, useRef, useState } from 'react'
import { carregar } from './carregar'

function idYoutube(texto) {
  const t = String(texto || '').trim()
  const m = t.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/)
  return m ? m[1] : t
}

// textarea que cresce com o texto (título, entrada, legendas)
export function TextoAuto({ valor, onChange, className, placeholder, maxLength }) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [valor])
  return (
    <textarea
      ref={ref}
      rows={1}
      className={className}
      placeholder={placeholder}
      value={valor || ''}
      maxLength={maxLength}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

// zona para escolher ou arrastar ficheiros
export function ZonaFicheiro({ aceitar, multiplos, onFicheiros, abrirJa, children, className = '' }) {
  const entrada = useRef(null)
  const [sobre, setSobre] = useState(false)

  // abre logo o seletor de ficheiros quando o elemento acaba de ser inserido
  useEffect(() => {
    if (abrirJa) entrada.current?.click()
  }, [abrirJa])

  return (
    <div
      className={`doc-zona ${sobre ? 'doc-zona-sobre' : ''} ${className}`}
      // o clique do próprio input (disparado abaixo) sobe até aqui: ignora-o para não reabrir o seletor
      onClick={(e) => { if (e.target !== entrada.current) entrada.current.click() }}
      onDragOver={(e) => { e.preventDefault(); setSobre(true) }}
      onDragLeave={() => setSobre(false)}
      onDrop={(e) => { e.preventDefault(); setSobre(false); if (e.dataTransfer.files.length) onFicheiros(e.dataTransfer.files) }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && entrada.current.click()}
    >
      {children}
      <input ref={entrada} type="file" accept={aceitar} multiple={multiplos} hidden onChange={(e) => { if (e.target.files.length) onFicheiros(e.target.files); e.target.value = '' }} />
    </div>
  )
}

function useCarregamento(aoErro) {
  const [aCarregar, setACarregar] = useState(false)
  async function enviar(ficheiros) {
    setACarregar(true)
    try {
      return await carregar(ficheiros)
    } catch (e) {
      aoErro(e.message)
      return []
    } finally {
      setACarregar(false)
    }
  }
  return [aCarregar, enviar]
}

const POSICOES = [
  ['esquerda', 'fa-align-left', 'À esquerda, com o texto à volta'],
  ['centro', 'fa-align-center', 'Ao centro, na largura do texto'],
  ['direita', 'fa-align-right', 'À direita, com o texto à volta'],
  ['larga', 'fa-expand', 'Larga, sai da coluna de texto'],
]

// ---------- imagem ----------

export function Imagem({ bloco, onChange, abrirJa, aoErro }) {
  const [aCarregar, enviar] = useCarregamento(aoErro)
  const posicao = bloco.posicao || 'centro'

  if (!bloco.src) {
    return (
      <ZonaFicheiro aceitar="image/*" abrirJa={abrirJa} onFicheiros={async (f) => { const [url] = await enviar(f); if (url) onChange({ ...bloco, src: url }) }}>
        <i className="fa fa-image fa-2x mb-2" />
        <strong>{aCarregar ? 'A carregar a imagem…' : 'Escolher imagem'}</strong>
        <span>ou arraste uma fotografia para aqui</span>
      </ZonaFicheiro>
    )
  }

  return (
    <figure className={`doc-figura doc-pos-${posicao}`}>
      <div className="doc-figura-imagem">
        <img src={bloco.src} alt={bloco.legenda || ''} />
        <div className="doc-ferramentas" role="toolbar" aria-label="Posição da imagem">
          {POSICOES.map(([valor, icone, dica]) => (
            <button key={valor} type="button" className={posicao === valor ? 'ativo' : ''} title={dica} onClick={() => onChange({ ...bloco, posicao: valor })}>
              <i className={`fa ${icone}`} />
            </button>
          ))}
          <span className="doc-ferramentas-sep" />
          <ZonaFicheiro aceitar="image/*" className="doc-botao-zona" onFicheiros={async (f) => { const [url] = await enviar(f); if (url) onChange({ ...bloco, src: url }) }}>
            <span title="Substituir imagem"><i className={`fa ${aCarregar ? 'fa-spinner fa-spin' : 'fa-sync-alt'}`} /></span>
          </ZonaFicheiro>
        </div>
      </div>
      <TextoAuto className="doc-legenda" placeholder="Escreva uma legenda (opcional)" valor={bloco.legenda} onChange={(v) => onChange({ ...bloco, legenda: v })} />
    </figure>
  )
}

// ---------- galeria ----------

export function Galeria({ bloco, onChange, abrirJa, aoErro }) {
  const [aCarregar, enviar] = useCarregamento(aoErro)
  const imagens = bloco.imagens || []
  const acrescentar = async (f) => {
    const urls = await enviar(f)
    if (urls.length) onChange({ ...bloco, imagens: [...imagens, ...urls.map((src) => ({ src, legenda: '' }))] })
  }

  return (
    <figure className="doc-galeria">
      {imagens.length > 0 && (
        <div className="doc-galeria-grelha">
          {imagens.map((img, i) => (
            <div key={`${img.src}-${i}`} className="doc-galeria-item">
              <img src={img.src} alt="" />
              <button type="button" className="doc-galeria-remover" title="Retirar da galeria" onClick={() => onChange({ ...bloco, imagens: imagens.filter((_, j) => j !== i) })}>
                <i className="fa fa-times" />
              </button>
              <input className="doc-galeria-legenda" placeholder="Legenda" value={img.legenda || ''} onChange={(e) => onChange({ ...bloco, imagens: imagens.map((x, j) => (j === i ? { ...x, legenda: e.target.value } : x)) })} />
            </div>
          ))}
        </div>
      )}
      <ZonaFicheiro aceitar="image/*" multiplos abrirJa={abrirJa && !imagens.length} onFicheiros={acrescentar} className={imagens.length ? 'doc-zona-pequena' : ''}>
        <i className="fa fa-images fa-lg me-2" />
        <strong>{aCarregar ? 'A carregar…' : imagens.length ? 'Acrescentar fotografias' : 'Escolher fotografias para a galeria'}</strong>
        {!imagens.length && <span>pode escolher várias de uma vez</span>}
      </ZonaFicheiro>
      <TextoAuto className="doc-legenda" placeholder="Legenda da galeria (opcional)" valor={bloco.legenda} onChange={(v) => onChange({ ...bloco, legenda: v })} />
    </figure>
  )
}

// ---------- vídeo ----------

export function Video({ bloco, onChange, aoErro }) {
  const [aCarregar, enviar] = useCarregamento(aoErro)
  const tem = bloco.youtube || bloco.src

  return (
    <figure className="doc-video">
      {tem ? (
        <div className="doc-video-moldura">
          {bloco.youtube
            ? <iframe src={`https://www.youtube-nocookie.com/embed/${bloco.youtube}`} title="Vídeo" allowFullScreen />
            : <video src={bloco.src} poster={bloco.poster} controls />}
          <div className="doc-ferramentas">
            <button type="button" title="Trocar vídeo" onClick={() => onChange({ ...bloco, youtube: '', src: '' })}><i className="fa fa-sync-alt" /></button>
          </div>
        </div>
      ) : (
        <div className="doc-video-escolha">
          <i className="fab fa-youtube fa-2x" />
          <input
            className="form-control"
            placeholder="Cole aqui o endereço do vídeo do YouTube"
            onChange={(e) => { const id = idYoutube(e.target.value); if (/^[\w-]{11}$/.test(id)) onChange({ ...bloco, youtube: id }) }}
          />
          <span className="text-muted">ou</span>
          <ZonaFicheiro aceitar="video/mp4,video/webm" className="doc-botao-texto" onFicheiros={async (f) => { const [url] = await enviar(f); if (url) onChange({ ...bloco, src: url }) }}>
            <span className="btn btn-white btn-sm"><i className={`fa ${aCarregar ? 'fa-spinner fa-spin' : 'fa-upload'} me-1`} />Carregar MP4</span>
          </ZonaFicheiro>
        </div>
      )}
      <TextoAuto className="doc-legenda" placeholder="Legenda do vídeo (opcional)" valor={bloco.legenda} onChange={(v) => onChange({ ...bloco, legenda: v })} />
    </figure>
  )
}

// ---------- citação em destaque ----------

export function Citacao({ bloco, onChange }) {
  return (
    <blockquote className="doc-citacao">
      <TextoAuto className="doc-citacao-texto" placeholder="Escreva a citação…" valor={bloco.texto} onChange={(v) => onChange({ ...bloco, texto: v })} />
      <div className="doc-citacao-autor">
        <span>—</span>
        <input placeholder="Autor da citação (opcional)" value={bloco.autor || ''} onChange={(e) => onChange({ ...bloco, autor: e.target.value })} />
      </div>
    </blockquote>
  )
}

// ---------- caixa de destaque ----------

export function Destaque({ bloco, onChange }) {
  return (
    <aside className="doc-destaque">
      <input className="doc-destaque-titulo" placeholder="Título da caixa (opcional)" value={bloco.titulo || ''} onChange={(e) => onChange({ ...bloco, titulo: e.target.value })} />
      <TextoAuto className="doc-destaque-texto" placeholder="Texto em destaque…" valor={bloco.texto} onChange={(v) => onChange({ ...bloco, texto: v })} />
    </aside>
  )
}

// ---------- referências bibliográficas ----------

export function Referencias({ bloco, onChange }) {
  return (
    <section className="doc-referencias">
      <h4>Referências</h4>
      <TextoAuto
        className="doc-referencias-texto"
        placeholder="Uma referência por linha"
        valor={(bloco.itens || []).join('\n')}
        onChange={(v) => onChange({ ...bloco, itens: v.split('\n') })}
      />
    </section>
  )
}
