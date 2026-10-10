import { useEffect, useRef, useState } from 'react'
import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import StarterKit from '@tiptap/starter-kit'
import TextAlign from '@tiptap/extension-text-align'
import Highlight from '@tiptap/extension-highlight'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import { Color, FontSize, TextStyle } from '@tiptap/extension-text-style'
import { TableKit } from '@tiptap/extension-table'
import { CharacterCount, Placeholder } from '@tiptap/extensions'
import { CaixaDestaque, Figura, Galeria, Video } from './extensoes'
import { carregar } from './carregar'

const ESTILOS = [
  ['p', 'Texto normal'],
  ['h2', 'Título'],
  ['h3', 'Subtítulo'],
  ['h4', 'Título pequeno'],
]
const TAMANHOS = [['', 'Normal'], ['14px', 'Pequeno'], ['19px', 'Médio'], ['22px', 'Grande'], ['28px', 'Muito grande']]
const CORES = ['#14100e', '#5c4f47', '#8c7f76', '#e53917', '#b42a10', '#c9a227', '#1e7d4b', '#1f5fa8']
const REALCES = ['#fff3a3', '#ffd9cc', '#d7f5df', '#dbe9ff']

// ---------- envio de imagens largadas ou coladas no texto ----------

/*
  Onde colocar um elemento (imagem, galeria, vídeo) pedido numa posição do texto:
  como a âncora de imagem do Word, nunca parte uma frase — vai para o início do parágrafo
  onde está o cursor (o texto desse parágrafo contorna a imagem), ou para depois dele se o
  cursor estiver no fim.
*/
function posicaoElemento(state, pos) {
  const $pos = state.doc.resolve(Math.min(pos, state.doc.content.size))
  const pai = $pos.parent
  if (!pai.isTextblock || $pos.depth === 0) return pos
  if ($pos.parentOffset === 0) return $pos.before()
  if ($pos.parentOffset >= pai.content.size) return $pos.after()
  return $pos.before()
}

async function inserirFicheiros(view, ficheiros, posicao, aoErro) {
  const imagens = [...ficheiros].filter((f) => f.type.startsWith('image/'))
  if (!imagens.length) return false
  try {
    const urls = await carregar(imagens)
    const { schema } = view.state
    const nos = urls.length > 1
      ? [schema.nodes.galeria.create({ imagens: urls.map((src) => ({ src, legenda: '' })) })]
      : urls.map((src) => schema.nodes.figura.create({ src }))
    const pos = posicaoElemento(view.state, posicao ?? view.state.selection.from)
    view.dispatch(view.state.tr.insert(pos, nos))
  } catch (e) {
    aoErro(e.message)
  }
  return true
}

// ---------- pequenos componentes da barra ----------

function Botao({ ativo, desativado, onClick, titulo, children, className = '' }) {
  return (
    <button
      type="button"
      className={`ed-btn ${ativo ? 'ativo' : ''} ${className}`}
      disabled={desativado}
      title={titulo}
      aria-label={titulo}
      aria-pressed={ativo}
      // mousedown evita que o editor perca a seleção ao clicar na barra
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function Paleta({ titulo, icone, cores, atual, onEscolher, onLimpar, corIcone }) {
  const [aberto, setAberto] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!aberto) return
    const fora = (e) => { if (!ref.current?.contains(e.target)) setAberto(false) }
    document.addEventListener('mousedown', fora)
    return () => document.removeEventListener('mousedown', fora)
  }, [aberto])
  return (
    <div className="ed-paleta" ref={ref}>
      <Botao titulo={titulo} onClick={() => setAberto(!aberto)}>
        <span className="ed-icone-cor"><i className={`fa ${icone}`} /><span style={{ background: atual || corIcone }} /></span>
        <i className="fa fa-caret-down ed-seta" />
      </Botao>
      {aberto && (
        <div className="ed-paleta-menu" onMouseDown={(e) => e.preventDefault()}>
          <div className="ed-paleta-cores">
            {cores.map((c) => (
              <button key={c} type="button" title={c} style={{ background: c }} className={atual === c ? 'ativo' : ''} onClick={() => { onEscolher(c); setAberto(false) }} />
            ))}
          </div>
          <button type="button" className="ed-paleta-limpar" onClick={() => { onLimpar(); setAberto(false) }}>Sem cor</button>
        </div>
      )}
    </div>
  )
}

// ---------- editor ----------

/*
  Editor de texto completo (TipTap/ProseMirror), ao estilo de um processador de texto.
  html: conteúdo inicial; onChange(html) em cada alteração do utilizador.
  antes: conteúdo mostrado entre o friso e o texto (cabeçalho do documento).
*/
function EditorTexto({ html, onChange, aoErro, editavel = true, placeholder = 'Comece a escrever o texto…', antes = null }) {
  const entradaImagem = useRef(null)
  const entradaGaleria = useRef(null)
  const [ligacao, setLigacao] = useState(null) // texto do endereço em edição (null = fechado)

  const editor = useEditor({
    editable: editavel,
    content: html || '',
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        link: { openOnClick: false, autolink: true, defaultProtocol: 'https', HTMLAttributes: { rel: 'noopener noreferrer', target: null } },
        codeBlock: false,
        code: false,
      }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TextStyle,
      Color,
      FontSize,
      Highlight.configure({ multicolor: true }),
      Subscript,
      Superscript,
      TableKit.configure({ table: { resizable: false } }),
      Placeholder.configure({ placeholder }),
      CharacterCount,
      Figura.configure({ aoErro }),
      Galeria.configure({ aoErro }),
      Video.configure({ aoErro }),
      CaixaDestaque,
    ],
    editorProps: {
      attributes: { class: 'ed-documento', spellcheck: 'true', lang: 'pt' },
      // largar fotografias do computador no ponto exato do texto
      handleDrop(view, event, slice, movido) {
        if (movido || !event.dataTransfer?.files?.length) return false
        const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos
        if (![...event.dataTransfer.files].some((f) => f.type.startsWith('image/'))) return false
        event.preventDefault()
        inserirFicheiros(view, event.dataTransfer.files, pos, aoErro)
        return true
      },
      // colar imagens (ex.: captura de ecrã)
      handlePaste(view, event) {
        const ficheiros = event.clipboardData?.files
        if (!ficheiros?.length || ![...ficheiros].some((f) => f.type.startsWith('image/'))) return false
        event.preventDefault()
        inserirFicheiros(view, ficheiros, null, aoErro)
        return true
      },
    },
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
  })

  useEffect(() => {
    // false: mudar o modo não conta como alteração do texto
    editor?.setEditable(editavel, false)
  }, [editor, editavel])

  const e = useEditorState({
    editor,
    selector: ({ editor: ed }) => {
      if (!ed) return null
      const estilo = ed.isActive('heading', { level: 2 }) ? 'h2' : ed.isActive('heading', { level: 3 }) ? 'h3' : ed.isActive('heading', { level: 4 }) ? 'h4' : 'p'
      const alinhamento = ['center', 'right', 'justify'].find((a) => ed.isActive({ textAlign: a })) || 'left'
      return {
        estilo,
        alinhamento,
        tamanho: ed.getAttributes('textStyle').fontSize || '',
        cor: ed.getAttributes('textStyle').color || '',
        realce: ed.getAttributes('highlight').color || '',
        negrito: ed.isActive('bold'),
        italico: ed.isActive('italic'),
        sublinhado: ed.isActive('underline'),
        riscado: ed.isActive('strike'),
        sub: ed.isActive('subscript'),
        sup: ed.isActive('superscript'),
        marcadores: ed.isActive('bulletList'),
        numerada: ed.isActive('orderedList'),
        citacao: ed.isActive('blockquote'),
        destaque: ed.isActive('caixaDestaque'),
        ligacao: ed.isActive('link'),
        tabela: ed.isActive('table'),
        podeDesfazer: ed.can().undo(),
        podeRefazer: ed.can().redo(),
        podeAvancar: ed.can().sinkListItem('listItem'),
        podeRecuar: ed.can().liftListItem('listItem'),
        palavras: ed.storage.characterCount.words(),
        caracteres: ed.storage.characterCount.characters(),
      }
    },
  })

  if (!editor || !e) return null
  const c = () => editor.chain().focus()

  function definirEstilo(v) {
    if (v === 'p') c().setParagraph().run()
    else c().toggleHeading({ level: Number(v[1]) }).run()
  }

  function abrirLigacao() {
    setLigacao(editor.getAttributes('link').href || 'https://')
  }

  function aplicarLigacao(ev) {
    ev?.preventDefault()
    const url = (ligacao || '').trim()
    if (!url || url === 'https://') c().extendMarkRange('link').unsetLink().run()
    else c().extendMarkRange('link').setLink({ href: /^(https?:|mailto:|\/)/.test(url) ? url : `https://${url}` }).run()
    setLigacao(null)
  }

  async function escolherImagens(ficheiros, galeria) {
    const pos = posicaoElemento(editor.state, editor.state.selection.from)
    if (galeria && ficheiros.length) {
      try {
        const urls = await carregar(ficheiros)
        c().insertContentAt(pos, { type: 'galeria', attrs: { imagens: urls.map((src) => ({ src, legenda: '' })) } }).run()
      } catch (er) { aoErro(er.message) }
    } else {
      await inserirFicheiros(editor.view, ficheiros, pos, aoErro)
    }
  }

  return (
    <div className={`ed ${editavel ? '' : 'ed-so-leitura'}`}>
      {editavel && (
        <div className="ed-friso" role="toolbar" aria-label="Formatação do texto">
          <div className="ed-grupo">
            <Botao titulo="Desfazer (Ctrl+Z)" desativado={!e.podeDesfazer} onClick={() => c().undo().run()}><i className="fa fa-undo" /></Botao>
            <Botao titulo="Refazer (Ctrl+Y)" desativado={!e.podeRefazer} onClick={() => c().redo().run()}><i className="fa fa-redo" /></Botao>
          </div>

          <div className="ed-grupo">
            <select className="ed-select ed-select-estilo" value={e.estilo} onChange={(ev) => definirEstilo(ev.target.value)} title="Estilo do parágrafo">
              {ESTILOS.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
            </select>
            <select className="ed-select" value={e.tamanho} onChange={(ev) => (ev.target.value ? c().setFontSize(ev.target.value).run() : c().unsetFontSize().run())} title="Tamanho do texto">
              {TAMANHOS.map(([v, r]) => <option key={r} value={v}>{r}</option>)}
            </select>
          </div>

          <div className="ed-grupo">
            <Botao titulo="Negrito (Ctrl+B)" ativo={e.negrito} onClick={() => c().toggleBold().run()}><i className="fa fa-bold" /></Botao>
            <Botao titulo="Itálico (Ctrl+I)" ativo={e.italico} onClick={() => c().toggleItalic().run()}><i className="fa fa-italic" /></Botao>
            <Botao titulo="Sublinhado (Ctrl+U)" ativo={e.sublinhado} onClick={() => c().toggleUnderline().run()}><i className="fa fa-underline" /></Botao>
            <Botao titulo="Riscado" ativo={e.riscado} onClick={() => c().toggleStrike().run()}><i className="fa fa-strikethrough" /></Botao>
            <Botao titulo="Expoente" ativo={e.sup} onClick={() => c().toggleSuperscript().run()}><i className="fa fa-superscript" /></Botao>
            <Botao titulo="Índice" ativo={e.sub} onClick={() => c().toggleSubscript().run()}><i className="fa fa-subscript" /></Botao>
            <Paleta titulo="Cor do texto" icone="fa-font" cores={CORES} atual={e.cor} corIcone="#14100e" onEscolher={(cor) => c().setColor(cor).run()} onLimpar={() => c().unsetColor().run()} />
            <Paleta titulo="Realce" icone="fa-highlighter" cores={REALCES} atual={e.realce} corIcone="#fff3a3" onEscolher={(cor) => c().toggleHighlight({ color: cor }).run()} onLimpar={() => c().unsetHighlight().run()} />
          </div>

          <div className="ed-grupo">
            <Botao titulo="Alinhar à esquerda" ativo={e.alinhamento === 'left'} onClick={() => c().setTextAlign('left').run()}><i className="fa fa-align-left" /></Botao>
            <Botao titulo="Centrar" ativo={e.alinhamento === 'center'} onClick={() => c().setTextAlign('center').run()}><i className="fa fa-align-center" /></Botao>
            <Botao titulo="Alinhar à direita" ativo={e.alinhamento === 'right'} onClick={() => c().setTextAlign('right').run()}><i className="fa fa-align-right" /></Botao>
            <Botao titulo="Justificar" ativo={e.alinhamento === 'justify'} onClick={() => c().setTextAlign('justify').run()}><i className="fa fa-align-justify" /></Botao>
          </div>

          <div className="ed-grupo">
            <Botao titulo="Lista com marcadores" ativo={e.marcadores} onClick={() => c().toggleBulletList().run()}><i className="fa fa-list-ul" /></Botao>
            <Botao titulo="Lista numerada" ativo={e.numerada} onClick={() => c().toggleOrderedList().run()}><i className="fa fa-list-ol" /></Botao>
            <Botao titulo="Diminuir avanço" desativado={!e.podeRecuar} onClick={() => c().liftListItem('listItem').run()}><i className="fa fa-outdent" /></Botao>
            <Botao titulo="Aumentar avanço" desativado={!e.podeAvancar} onClick={() => c().sinkListItem('listItem').run()}><i className="fa fa-indent" /></Botao>
          </div>

          <div className="ed-grupo">
            <Botao titulo="Citação" ativo={e.citacao} onClick={() => c().toggleBlockquote().run()}><i className="fa fa-quote-right" /></Botao>
            <Botao titulo="Caixa de destaque" ativo={e.destaque} onClick={() => c().alternarDestaque().run()}><i className="fa fa-square-full" /></Botao>
            <Botao titulo="Ligação" ativo={e.ligacao} onClick={abrirLigacao}><i className="fa fa-link" /></Botao>
            <Botao titulo="Linha horizontal" onClick={() => c().setHorizontalRule().run()}><i className="fa fa-minus" /></Botao>
            <Botao titulo="Limpar formatação" onClick={() => c().unsetAllMarks().clearNodes().run()}><i className="fa fa-remove-format" /></Botao>
          </div>

          <div className="ed-grupo ed-grupo-inserir">
            <span className="ed-rotulo">Inserir</span>
            <Botao titulo="Imagem no ponto do cursor" onClick={() => entradaImagem.current.click()}><i className="fa fa-image" /><span>Imagem</span></Botao>
            <Botao titulo="Galeria de fotografias" onClick={() => entradaGaleria.current.click()}><i className="fa fa-images" /><span>Galeria</span></Botao>
            <Botao titulo="Vídeo do YouTube ou MP4" onClick={() => c().insertContentAt(posicaoElemento(editor.state, editor.state.selection.from), { type: 'video' }).run()}><i className="fa fa-video" /><span>Vídeo</span></Botao>
            <Botao titulo="Tabela" onClick={() => c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><i className="fa fa-table" /><span>Tabela</span></Botao>
          </div>

          {e.tabela && (
            <div className="ed-grupo ed-grupo-tabela">
              <span className="ed-rotulo">Tabela</span>
              <Botao titulo="Linha acima" onClick={() => c().addRowBefore().run()}><i className="fa fa-arrow-up" /></Botao>
              <Botao titulo="Linha abaixo" onClick={() => c().addRowAfter().run()}><i className="fa fa-arrow-down" /></Botao>
              <Botao titulo="Coluna à esquerda" onClick={() => c().addColumnBefore().run()}><i className="fa fa-arrow-left" /></Botao>
              <Botao titulo="Coluna à direita" onClick={() => c().addColumnAfter().run()}><i className="fa fa-arrow-right" /></Botao>
              <Botao titulo="Apagar linha" onClick={() => c().deleteRow().run()}><i className="fa fa-grip-lines" /></Botao>
              <Botao titulo="Apagar coluna" onClick={() => c().deleteColumn().run()}><i className="fa fa-grip-lines-vertical" /></Botao>
              <Botao titulo="Juntar ou separar células" onClick={() => c().mergeOrSplit().run()}><i className="fa fa-object-group" /></Botao>
              <Botao titulo="Apagar tabela" className="perigo" onClick={() => c().deleteTable().run()}><i className="fa fa-trash-alt" /></Botao>
            </div>
          )}

          {ligacao !== null && (
            <form className="ed-ligacao" onSubmit={aplicarLigacao}>
              <i className="fa fa-link" />
              <input autoFocus value={ligacao} onChange={(ev) => setLigacao(ev.target.value)} placeholder="https://… ou /Cursos" onKeyDown={(ev) => ev.key === 'Escape' && setLigacao(null)} />
              <button type="submit" className="btn btn-sm btn-theme">Aplicar</button>
              {e.ligacao && <button type="button" className="btn btn-sm btn-white" onClick={() => { c().extendMarkRange('link').unsetLink().run(); setLigacao(null) }}>Retirar</button>}
              <button type="button" className="btn btn-sm btn-link" onClick={() => setLigacao(null)}>Cancelar</button>
            </form>
          )}

          <input ref={entradaImagem} type="file" accept="image/*" multiple hidden onChange={(ev) => { if (ev.target.files.length) escolherImagens(ev.target.files, false); ev.target.value = '' }} />
          <input ref={entradaGaleria} type="file" accept="image/*" multiple hidden onChange={(ev) => { if (ev.target.files.length) escolherImagens(ev.target.files, true); ev.target.value = '' }} />
        </div>
      )}

      {editavel && (
        <BubbleMenu editor={editor} className="ed-bolha" shouldShow={({ editor: ed, from, to }) => from !== to && !ed.isActive('figura') && !ed.isActive('galeria') && !ed.isActive('video')}>
          <Botao titulo="Negrito" ativo={e.negrito} onClick={() => c().toggleBold().run()}><i className="fa fa-bold" /></Botao>
          <Botao titulo="Itálico" ativo={e.italico} onClick={() => c().toggleItalic().run()}><i className="fa fa-italic" /></Botao>
          <Botao titulo="Sublinhado" ativo={e.sublinhado} onClick={() => c().toggleUnderline().run()}><i className="fa fa-underline" /></Botao>
          <Botao titulo="Título" ativo={e.estilo === 'h2'} onClick={() => c().toggleHeading({ level: 2 }).run()}><b>T</b></Botao>
          <Botao titulo="Ligação" ativo={e.ligacao} onClick={abrirLigacao}><i className="fa fa-link" /></Botao>
          <Botao titulo="Realçar" onClick={() => c().toggleHighlight({ color: REALCES[0] }).run()}><i className="fa fa-highlighter" /></Botao>
        </BubbleMenu>
      )}

      {/* cabeçalho do documento (título, entrada, capa) entre o friso e o texto */}
      {antes}

      <EditorContent editor={editor} className="ed-area" />

      <div className="ed-estado">
        <span><b>{e.palavras.toLocaleString('pt-PT')}</b> palavras</span>
        <span><b>{e.caracteres.toLocaleString('pt-PT')}</b> caracteres</span>
        <span>~{Math.max(1, Math.round(e.palavras / 200))} min de leitura</span>
        {editavel && <span className="ed-dica"><i className="fa fa-info-circle me-1" />Arraste as imagens para as mudar de sítio · largue fotografias diretamente no texto</span>}
      </div>
    </div>
  )
}

export default EditorTexto
