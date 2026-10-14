import '../../admin/editor/editor.css'
import EditorTexto from '../../admin/editor/EditorTexto'

// editor de texto do painel, para as páginas das cadeiras (sem envio de fotografias); carrega-se só quando é preciso
function EditorPagina(props) {
  return <EditorTexto {...props} semImagens />
}

export default EditorPagina
