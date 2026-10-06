
import { Link } from 'react-router-dom'
import { FaFacebookF, FaInstagram, FaLinkedinIn, FaYoutube } from 'react-icons/fa'
import Logo from '../../assets/Logo.png'
import styles from './Footer.module.css'

const colunas = [
  {
    titulo: 'Institucional',
    links: [
      { label: 'História', to: '/Institucional' },
      { label: 'Missão, Visão e Valores', to: '/Institucional' },
      { label: 'Organização e Estrutura', to: '/Institucional' },
      { label: 'Direção / Comando', to: '/Institucional' },
    ],
  },
  {
    titulo: 'Formação',
    links: [
      { label: 'Cursos e Programas', to: '/Cursos' },
      { label: 'Calendário Académico', to: '/Cursos' },
      { label: 'Requisitos de Admissão', to: '/Cursos' },
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
      { label: 'Contactos', to: '/Contactos' },
      { label: 'Perguntas Frequentes', to: '/#faq' },
      { label: 'Portal Académico', to: '/Contactos' },
    ],
  },
]

function Footer() {
  const ano = new Date().getFullYear()

  return (
    <footer className={styles.footer}>
      <div className={styles.topo}>
        <div className={styles.bloco}>
          <img src={Logo} alt="ESGFAA" className={styles.logo} />
          <p className={styles.descricao}>
            Escola Superior de Guerra das Forças Armadas Angolanas — formação, investigação
            e cooperação ao serviço da defesa nacional.
          </p>
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
                  <Link to={link.to}>{link.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className={styles.linha} />

      <div className={styles.base}>
        <p>© {ano} Escola Superior de Guerra das Forças Armadas Angolanas. Todos os direitos reservados.</p>
        <div className={styles.baseLinks}>
          <Link to="/Contactos">Localização</Link>
          <span>·</span>
          <a href="mailto:geral@esgfaa.gov.ao">geral@esgfaa.gov.ao</a>
        </div>
      </div>
    </footer>
  )
}

export default Footer