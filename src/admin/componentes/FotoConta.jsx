import { useEffect, useState } from 'react'
import { API_URL } from '../../conteudo/api'
import { comSessao } from '../api'

const iniciais = (n = '') => n.replace(/^(\S+\.\s+)+/, '').trim().split(/\s+/).filter((_, i, a) => i === 0 || i === a.length - 1).map((x) => x[0]).join('').toUpperCase()

/*
  Fotografia de um estudante ou docente (vinda do Sistema de Gestão de Pessoal). Pede-se com a sessão
  (não é pública); sem fotografia, mostra as iniciais. temFoto evita pedir quando se sabe que não há.
*/
// sessao: as opções do pedido com a sessão (no portal, a do portal)
export default function FotoConta({ id, nome, temFoto = true, tamanho = 34, caminho, sessao = comSessao }) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    if (!temFoto || (!id && !caminho)) return undefined
    let u = null
    let vivo = true
    fetch(`${API_URL}${caminho ?? `/api/admin/academico/contas/${id}/foto`}`, sessao())
      .then((r) => (r.ok ? r.blob() : null))
      .then((b) => { if (b && vivo) { u = URL.createObjectURL(b); setUrl(u) } })
      .catch(() => {})
    return () => { vivo = false; if (u) URL.revokeObjectURL(u) }
  }, [id, temFoto, caminho, sessao])
  const estilo = { width: tamanho, height: tamanho, fontSize: tamanho * 0.38, flex: 'none' }
  return url
    ? <img src={url} alt={nome ? `Fotografia de ${nome}` : ''} className="rounded-circle object-fit-cover border" style={estilo} />
    : <span className="rounded-circle d-inline-flex align-items-center justify-content-center fw-bold" style={{ ...estilo, background: '#e8ecef', color: '#5b6670' }} aria-hidden="true">{iniciais(nome)}</span>
}
