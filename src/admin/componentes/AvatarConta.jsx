import { API_URL } from '../../conteudo/api'

// a fotografia da conta do painel (O meu perfil) ou, sem ela, as iniciais (o posto abreviado não conta: «Cor. Ana Baptista» → AB)
const iniciaisDe = (n = '') => String(n).replace(/^(\S+\.\s+)+/, '').trim().split(/\s+/).filter((_, i, a) => i === 0 || i === a.length - 1).map((x) => x[0] ?? '').join('').toUpperCase()
const urlFoto = (foto) => (foto ? (/^https?:/.test(foto) ? foto : `${API_URL}${foto}`) : null)

export default function AvatarConta({ utilizador, className = 'admin-avatar', estilo }) {
  const url = urlFoto(utilizador?.foto)
  return (
    <span className={`${className} ${url ? 'admin-avatar-foto' : ''}`} style={estilo} aria-hidden="true">
      {url ? <img src={url} alt="" /> : iniciaisDe(utilizador?.nome)}
    </span>
  )
}
