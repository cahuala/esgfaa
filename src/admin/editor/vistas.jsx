import { useRef, useState } from 'react'
import { NodeViewWrapper } from '@tiptap/react'
import { carregar } from './carregar'
import { TextoAuto } from './Elementos'

const POSICOES = [
  ['esquerda', 'fa-align-left', 'Imagem à esquerda, com o texto à volta'],
  ['centro', 'fa-align-center', 'Imagem ao centro, sem texto à volta'],
  ['direita', 'fa-align-right', 'Imagem à direita, com o texto à volta'],
  ['larga', 'fa-expand-alt', 'Imagem larga, sai da coluna do texto'],
]
const TAMANHOS = [25, 33, 50, 75, 100]

const idYoutube = (texto) => {
  const t = String(texto || '').trim()
  const m = t.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/)
  return m ? m[1] : /^[\w-]{11}$/.test(t) ? t : ''
}

function useEnvio(extension) {
  const [aEnviar, setAEnviar] = useState(false)
  async function enviar(ficheiros) {
    setAEnviar(true)
    try {
      return await carregar(ficheiros)
    } catch (e) {
      extension.options.aoErro(e.message)
      return []
    } finally {
      setAEnviar(false)
    }
  }
  return [aEnviar, enviar]
}

function SeletorFicheiro({ aceitar, multiplos, onFicheiros, children, className }) {
  const entrada = useRef(null)
  return (
    <>
      <button type="button" className={className} onClick={() => entrada.current.click()}>{children}</button>
      <input ref={entrada} type="file" accept={aceitar} multiple={multiplos} hidden onChange={(e) => { if (e.target.files.length) onFicheiros(e.target.files); e.target.value = '' }} />
    </>
  )
}

// ---------- imagem ----------

export function VistaFigura({ node, updateAttributes, deleteNode, selected, extension, editor }) {
  const { src, legenda, posicao, largura } = node.attrs
  const lateral = posicao === 'esquerda' || posicao === 'direita'
  const atual = posicao === 'larga' ? null : largura || (lateral ? 45 : 100)
  const [aRedimensionar, setARedimensionar] = useState(null) // largura temporária durante o arrasto
  const [aEnviar, enviar] = useEnvio(extension)
  const figura = useRef(null)
  const editavel = editor.isEditable

  // arrastar o canto para mudar a largura (em % da coluna de texto)
  function redimensionar(e) {
    e.preventDefault()
    e.stopPropagation()
    const coluna = editor.view.dom.clientWidth
    const inicio = e.clientX
    const largInicial = figura.current.offsetWidth
    const sentido = posicao === 'direita' ? -1 : 1
    let valor = atual
    const mover = (ev) => {
      const px = largInicial + (ev.clientX - inicio) * sentido
      valor = Math.round(Math.min(100, Math.max(20, (px / coluna) * 100)))
      setARedimensionar(valor)
    }
    const largar = () => {
      document.removeEventListener('mousemove', mover)
      document.removeEventListener('mouseup', largar)
      setARedimensionar(null)
      updateAttributes({ largura: valor, posicao: posicao === 'larga' ? 'centro' : posicao })
    }
    document.addEventListener('mousemove', mover)
    document.addEventListener('mouseup', largar)
  }

  const largVisivel = aRedimensionar ?? atual
  return (
    <NodeViewWrapper
      as="figure"
      ref={figura}
      className={`ed-figura ed-pos-${posicao} ${selected ? 'ed-selecionada' : ''}`}
      style={largVisivel && posicao !== 'larga' ? { width: `${largVisivel}%` } : undefined}
      data-posicao={posicao}
    >
      {selected && editavel && (
        <div className="ed-barra-elemento" contentEditable={false}>
          {POSICOES.map(([valor, icone, dica]) => (
            <button key={valor} type="button" title={dica} className={posicao === valor ? 'ativo' : ''} onClick={() => updateAttributes({ posicao: valor, largura: valor === 'larga' ? null : (valor === 'centro' ? (largura && largura < 100 ? largura : null) : (largura && largura < 100 ? largura : 45)) })}>
              <i className={`fa ${icone}`} />
            </button>
          ))}
          <span className="ed-sep" />
          {posicao !== 'larga' && TAMANHOS.map((t) => (
            <button key={t} type="button" title={`Largura ${t}%`} className={`ed-tamanho ${Math.round(atual) === t ? 'ativo' : ''}`} onClick={() => updateAttributes({ largura: t === 100 ? null : t })}>{t}%</button>
          ))}
          {posicao !== 'larga' && <span className="ed-sep" />}
          <SeletorFicheiro aceitar="image/*" onFicheiros={async (f) => { const [url] = await enviar(f); if (url) updateAttributes({ src: url }) }}>
            <i className={`fa ${aEnviar ? 'fa-spinner fa-spin' : 'fa-sync-alt'}`} title="Substituir imagem" />
          </SeletorFicheiro>
          <button type="button" title="Apagar imagem" className="perigo" onClick={deleteNode}><i className="fa fa-trash-alt" /></button>
        </div>
      )}

      <div className="ed-figura-imagem" data-drag-handle="" title={editavel ? 'Arraste para mudar a imagem de sítio no texto' : undefined}>
        {src ? <img src={src} alt={legenda} draggable={false} /> : (
          <div className="ed-vazio">
            <i className="fa fa-image fa-2x" />
            <SeletorFicheiro className="btn btn-sm btn-white mt-2" aceitar="image/*" onFicheiros={async (f) => { const [url] = await enviar(f); if (url) updateAttributes({ src: url }) }}>
              {aEnviar ? 'A carregar…' : 'Escolher imagem'}
            </SeletorFicheiro>
          </div>
        )}
        {selected && editavel && posicao !== 'larga' && (
          <span className={`ed-pega ${posicao === 'direita' ? 'ed-pega-esq' : ''}`} onMouseDown={redimensionar} title="Arraste para mudar o tamanho" />
        )}
        {aRedimensionar && <span className="ed-medida">{aRedimensionar}%</span>}
      </div>

      <TextoAuto className="ed-legenda" placeholder={editavel ? 'Escreva uma legenda…' : ''} valor={legenda} onChange={(v) => editavel && updateAttributes({ legenda: v.replace(/\n/g, ' ') })} />
    </NodeViewWrapper>
  )
}

// ---------- galeria ----------

export function VistaGaleria({ node, updateAttributes, deleteNode, selected, extension, editor }) {
  const { imagens, legenda } = node.attrs
  const [aEnviar, enviar] = useEnvio(extension)
  const editavel = editor.isEditable
  const acrescentar = async (f) => {
    const urls = await enviar(f)
    if (urls.length) updateAttributes({ imagens: [...imagens, ...urls.map((src) => ({ src, legenda: '' }))] })
  }
  const mover = (i, d) => {
    const lista = [...imagens]
    const j = i + d
    if (j < 0 || j >= lista.length) return
    ;[lista[i], lista[j]] = [lista[j], lista[i]]
    updateAttributes({ imagens: lista })
  }

  return (
    <NodeViewWrapper className={`ed-galeria ${selected ? 'ed-selecionada' : ''}`}>
      {selected && editavel && (
        <div className="ed-barra-elemento" contentEditable={false}>
          <SeletorFicheiro aceitar="image/*" multiplos onFicheiros={acrescentar}>
            <i className={`fa ${aEnviar ? 'fa-spinner fa-spin' : 'fa-plus'} me-1`} /> Fotografias
          </SeletorFicheiro>
          <button type="button" title="Apagar galeria" className="perigo" onClick={deleteNode}><i className="fa fa-trash-alt" /></button>
        </div>
      )}
      <div className="ed-galeria-cabeca" data-drag-handle="" title="Arraste para mudar a galeria de sítio">
        <i className="fa fa-grip-vertical me-2" /> Galeria · {imagens.length} {imagens.length === 1 ? 'fotografia' : 'fotografias'}
      </div>
      <div className="ed-galeria-grelha" style={{ '--colunas': Math.min(3, Math.max(2, imagens.length)) }}>
        {imagens.map((img, i) => (
          <div key={`${img.src}-${i}`} className="ed-galeria-item">
            <img src={img.src} alt="" draggable={false} />
            {editavel && (
              <div className="ed-galeria-acoes">
                <button type="button" title="Para trás" onClick={() => mover(i, -1)}><i className="fa fa-arrow-left" /></button>
                <button type="button" title="Para a frente" onClick={() => mover(i, 1)}><i className="fa fa-arrow-right" /></button>
                <button type="button" title="Retirar" onClick={() => updateAttributes({ imagens: imagens.filter((_, j) => j !== i) })}><i className="fa fa-times" /></button>
              </div>
            )}
            <input className="ed-legenda ed-legenda-pequena" placeholder="Legenda" value={img.legenda || ''} readOnly={!editavel}
              onChange={(e) => updateAttributes({ imagens: imagens.map((x, j) => (j === i ? { ...x, legenda: e.target.value } : x)) })} />
          </div>
        ))}
        {editavel && (
          <SeletorFicheiro className="ed-galeria-mais" aceitar="image/*" multiplos onFicheiros={acrescentar}>
            <i className={`fa ${aEnviar ? 'fa-spinner fa-spin' : 'fa-plus'} fa-lg`} />
            <span>{imagens.length ? 'Acrescentar' : 'Escolher fotografias'}</span>
          </SeletorFicheiro>
        )}
      </div>
      <TextoAuto className="ed-legenda" placeholder={editavel ? 'Legenda da galeria…' : ''} valor={legenda} onChange={(v) => editavel && updateAttributes({ legenda: v.replace(/\n/g, ' ') })} />
    </NodeViewWrapper>
  )
}

// ---------- vídeo ----------

export function VistaVideo({ node, updateAttributes, deleteNode, selected, extension, editor }) {
  const { youtube, src, poster, legenda } = node.attrs
  const [endereco, setEndereco] = useState('')
  const [aEnviar, enviar] = useEnvio(extension)
  const editavel = editor.isEditable
  const tem = youtube || src

  return (
    <NodeViewWrapper as="figure" className={`ed-video ${selected ? 'ed-selecionada' : ''}`}>
      {selected && editavel && tem && (
        <div className="ed-barra-elemento" contentEditable={false}>
          <button type="button" title="Trocar vídeo" onClick={() => updateAttributes({ youtube: '', src: '' })}><i className="fa fa-sync-alt me-1" /> Trocar</button>
          <button type="button" title="Apagar vídeo" className="perigo" onClick={deleteNode}><i className="fa fa-trash-alt" /></button>
        </div>
      )}
      {tem ? (
        <div className="ed-video-moldura" data-drag-handle="">
          {youtube
            ? <img src={`https://i.ytimg.com/vi/${youtube}/hqdefault.jpg`} alt="" draggable={false} />
            : <video src={src} poster={poster || undefined} preload="metadata" />}
          <span className="ed-video-play"><i className={`fa ${youtube ? 'fab fa-youtube' : 'fa-play'}`} /></span>
        </div>
      ) : (
        <div className="ed-video-escolha">
          <i className="fab fa-youtube fa-2x text-danger" />
          <input
            className="form-control"
            placeholder="Cole o endereço do vídeo do YouTube e carregue Enter"
            value={endereco}
            onChange={(e) => setEndereco(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                const id = idYoutube(endereco)
                if (id) updateAttributes({ youtube: id })
                else extension.options.aoErro('Não reconheço esse endereço do YouTube.')
              }
            }}
          />
          <button type="button" className="btn btn-sm btn-theme" onClick={() => { const id = idYoutube(endereco); if (id) updateAttributes({ youtube: id }); else extension.options.aoErro('Não reconheço esse endereço do YouTube.') }}>Inserir</button>
          <span className="text-muted small">ou</span>
          <SeletorFicheiro className="btn btn-sm btn-white" aceitar="video/mp4,video/webm" onFicheiros={async (f) => { const [url] = await enviar(f); if (url) updateAttributes({ src: url }) }}>
            <i className={`fa ${aEnviar ? 'fa-spinner fa-spin' : 'fa-upload'} me-1`} />Carregar MP4
          </SeletorFicheiro>
          <button type="button" className="btn btn-sm btn-link text-danger" onClick={deleteNode} title="Cancelar">Cancelar</button>
        </div>
      )}
      <TextoAuto className="ed-legenda" placeholder={editavel ? 'Legenda do vídeo…' : ''} valor={legenda} onChange={(v) => editavel && updateAttributes({ legenda: v.replace(/\n/g, ' ') })} />
    </NodeViewWrapper>
  )
}
