import { useEffect, useMemo, useRef } from 'react'
import ReactQuill from 'react-quill-new'
import 'react-quill-new/dist/quill.snow.css'

// botões próprios (inserir elementos no ponto do cursor) e os seus ícones Font Awesome
const INSERIR = {
  'inserir-imagem': ['fa-image', 'Inserir imagem aqui'],
  'inserir-galeria': ['fa-images', 'Inserir galeria aqui'],
  'inserir-video': ['fa-video', 'Inserir vídeo aqui'],
  'inserir-citacao': ['fa-quote-right', 'Inserir citação em destaque aqui'],
  'inserir-destaque': ['fa-square-full', 'Inserir caixa de destaque aqui'],
}

const BARRA = [
  [{ header: [2, 3, false] }],
  ['bold', 'italic', 'underline', 'strike'],
  [{ list: 'ordered' }, { list: 'bullet' }, 'blockquote'],
  [{ align: [] }],
  ['link', 'clean'],
  Object.keys(INSERIR),
]

// o Quill 2 escreve os espaços como &nbsp;, o que impede o texto de mudar de linha no site
const espacosNormais = (html) => html.replace(/&nbsp;/g, ' ')

const TITULOS = {
  'ql-bold': 'Negrito (Ctrl+B)', 'ql-italic': 'Itálico (Ctrl+I)', 'ql-underline': 'Sublinhado (Ctrl+U)', 'ql-strike': 'Riscado',
  'ql-blockquote': 'Citação no texto', 'ql-link': 'Ligação', 'ql-clean': 'Limpar formatação',
}

/*
  Texto do documento (Quill). A barra aparece quando o bloco está em edição.
  onInserir(tipo, htmlAntes, htmlDepois): divide o texto no cursor e insere um elemento entre as partes.
*/
function BlocoTexto({ html, onChange, onInserir, placeholder }) {
  const editor = useRef(null)
  const caixa = useRef(null)

  // os botões "inserir" da barra lançam um evento; aqui passa-se ao documento
  useEffect(() => {
    const el = caixa.current
    const tratar = (e) => onInserir(e.detail.tipo, e.detail.antes, e.detail.depois)
    el.addEventListener('esg-inserir', tratar)
    return () => el.removeEventListener('esg-inserir', tratar)
  }, [onInserir])

  const modules = useMemo(() => ({
    toolbar: {
      container: BARRA,
      handlers: Object.fromEntries(Object.keys(INSERIR).map((nome) => [nome, function inserir() {
        const quill = this.quill
        const cursor = quill.getSelection(true)?.index ?? quill.getLength()
        const antes = espacosNormais(quill.getSemanticHTML(0, cursor))
        const depois = espacosNormais(quill.getSemanticHTML(cursor, quill.getLength() - cursor))
        quill.container.dispatchEvent(new CustomEvent('esg-inserir', { bubbles: true, detail: { tipo: nome.replace('inserir-', ''), antes, depois } }))
      }])),
    },
  }), [])

  // ícones e dicas dos botões da barra
  useEffect(() => {
    const barra = editor.current?.getEditor().getModule('toolbar').container
    if (!barra) return
    for (const [nome, [icone, titulo]] of Object.entries(INSERIR)) {
      const botao = barra.querySelector(`.ql-${nome}`)
      if (botao && !botao.dataset.pronto) {
        botao.innerHTML = `<i class="fa ${icone}"></i>`
        botao.title = titulo
        botao.dataset.pronto = '1'
      }
    }
    barra.querySelectorAll('button').forEach((b) => {
      const classe = [...b.classList].find((c) => TITULOS[c])
      if (classe && !b.title) b.title = TITULOS[classe]
    })
  }, [])

  return (
    <div className="doc-texto" ref={caixa}>
      <ReactQuill
        ref={editor}
        theme="snow"
        value={html || ''}
        // só alterações do utilizador (o Quill normaliza o HTML ao abrir e isso não é uma edição)
        onChange={(valor, delta, origem) => { if (origem === 'user') onChange(espacosNormais(valor)) }}
        modules={modules}
        placeholder={placeholder}
      />
    </div>
  )
}

export default BlocoTexto
