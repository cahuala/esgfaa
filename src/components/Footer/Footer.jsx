
import { Link } from 'react-router-dom'
import { FaFacebookF, FaInstagram, FaLinkedinIn, FaYoutube } from 'react-icons/fa'
import Logo from '../../assets/Logo.png'
import { useConteudo } from '../../conteudo/contexto'
import styles from './Footer.module.css'

const colunas = [
  {
    titulo: 'Institucional',
    links: [
      { label: 'História', to: '/Institucional#historia' },
      { label: 'Missão, Visão e Valores', to: '/Institucional#missao' },
      { label: 'Organização e Estrutura', to: '/Institucional#estrutura' },
      { label: 'Direção / Comando', to: '/Institucional#comando' },
    ],
  },
  {
    titulo: 'Formação',
    links: [
      { label: 'Cursos e Programas', to: '/Cursos' },
      { label: 'Calendário Académico', to: '/Cursos#calendario' },
      { label: 'Requisitos de Admissão', to: '/Cursos#admissao' },
    ],
  },
  {
    titulo: 'Recursos',
    links: [
      { label: 'Notícias', to: '/Noticias' },
      { label: 'Eventos', to: '/Eventos' },
      { label: 'Publicações e Documentos', to: '/Artigos' },
      { label: 'Investigação Científica', to: '/Artigos' },
    ],
  },
  {
    titulo: 'Ajuda e Contactos',
    links: [
      { label: 'Contactos', to: '/Contactos#formulario' },
      { label: 'Perguntas Frequentes', to: '/Contactos#faq' },
      { label: 'Portal Académico', href: `${import.meta.env.BASE_URL}portal/` },
    ],
  },
]

function Footer() {
  const ano = new Date().getFullYear()
  const { email } = useConteudo().paginas.contactos

  return (
    <footer className={styles.footer}>
      <div className={styles.topo}>
        <div className={styles.bloco}>
          <div className={styles.marca}>
            <img src={Logo} alt="" className={styles.logo} />
            <strong>Escola Superior de Guerra</strong>
          </div>
          <p className={styles.descricao}>
            Escola Superior de Guerra das Forças Armadas Angolanas — formação, investigação
            e cooperação ao serviço da defesa nacional.
          </p>
          <span className={styles.redesTitulo}>Siga-nos</span>
          <div className={styles.redes}>
            <a href="#" aria-label="Facebook" className={styles.redeIcone}>
                 <FaFacebookF />
            </a>
            <a href="#" aria-label="Instagram" className={styles.redeIcone}>
                <FaInstagram />
            </a>
            <a href="#" aria-label="LinkedIn" className={styles.redeIcone}>
                <FaLinkedinIn />
            </a>
            <a href="#" aria-label="YouTube" className={styles.redeIcone}>
                <FaYoutube />
            </a>
          </div>
        </div>

        {colunas.map((coluna) => (
          <div className={styles.bloco} key={coluna.titulo}>
            <h4>{coluna.titulo}</h4>
            <ul>
              {coluna.links.map((link) => (
                <li key={link.label}>
                  {link.href ? <a href={link.href}>{link.label}</a> : <Link to={link.to}>{link.label}</Link>}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className={styles.base}>
        <p>© {ano} Escola Superior de Guerra das Forças Armadas Angolanas. Todos os direitos reservados.</p>
        <div className={styles.baseLinks}>
          <Link to="/Contactos">Localização</Link>
          <a href={`mailto:${email}`}>{email}</a>
        </div>
      </div>
    </footer>
  )
}

export default Footer