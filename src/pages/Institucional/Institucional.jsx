import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { FaChalkboardTeacher, FaFlask, FaGlobeAfrica, FaUserGraduate, FaBook, FaCogs } from 'react-icons/fa'
import CabecalhoPagina from '../../components/CabecalhoPagina/CabecalhoPagina'
import MissaoVisaoValores from '../../components/MissaoVisaoValores/MissaoVisaoValores'
import CtaBanner from '../../components/CTABanner/CtaBanner'
import pessoas from '../../data/pessoas'
import { iniciais } from '../../utils/texto'
import ImagemCabecalho from '../../assets/Escola De Guerra.png'
import ImagemHistoria from '../../assets/Escola2.jpeg'
import pagina from '../../styles/pagina.module.css'
import styles from './Institucional.module.css'

const seccoes = [
  { id: 'historia', label: 'História' },
  { id: 'missao', label: 'Missão, Visão e Valores' },
  { id: 'estrutura', label: 'Organização e Estrutura' },
  { id: 'comando', label: 'Direção / Comando' },
]

const numeros = [
  { valor: '+10', legenda: 'anos de existência' },
  { valor: '+500', legenda: 'oficiais formados' },
  { valor: '3', legenda: 'cursos de formação superior' },
  { valor: '+20', legenda: 'acordos de cooperação' },
]

// ATENÇÃO: conteúdo provisório — substituir pelos marcos oficiais da história da Escola.
const marcos = [
  { ano: '2014', titulo: 'Criação da Escola', texto: 'Instituída como estabelecimento de ensino superior militar das FAA.' },
  { ano: '2015', titulo: 'Primeiro curso', texto: 'Arranque do primeiro Curso de Estado-Maior.' },
  { ano: '2018', titulo: 'Cooperação internacional', texto: 'Assinatura dos primeiros protocolos com escolas parceiras.' },
  { ano: '2021', titulo: 'Novo comando', texto: 'Início de um novo ciclo de modernização curricular.' },
  { ano: '2026', titulo: 'Investigação', texto: 'Reforço do Departamento de Investigação e das publicações.' },
]

const orgaos = [
  { icone: <FaUserGraduate />, nome: 'Direção de Ensino', texto: 'Planeia e coordena os cursos, os planos curriculares e a avaliação dos alunos.' },
  { icone: <FaFlask />, nome: 'Departamento de Investigação', texto: 'Promove a investigação científica em estratégia, segurança e defesa.' },
  { icone: <FaChalkboardTeacher />, nome: 'Corpo Docente', texto: 'Reúne os docentes militares e civis responsáveis pela formação.' },
  { icone: <FaGlobeAfrica />, nome: 'Cooperação Internacional', texto: 'Gere os protocolos e o intercâmbio com instituições parceiras.' },
  { icone: <FaBook />, nome: 'Secretaria Académica', texto: 'Trata das candidaturas, matrículas, certificados e calendário académico.' },
  { icone: <FaCogs />, nome: 'Serviços de Apoio', texto: 'Asseguram a logística, as instalações e os recursos administrativos.' },
]

function Institucional() {
  const [ativa, setAtiva] = useState(seccoes[0].id)
  const menuRef = useRef(null)
  const comandante = pessoas[0]
  const direcao = pessoas.slice(1)

  // destaca no menu a última secção cujo topo já passou o meio do ecrã
  useEffect(() => {
    let pedido = null
    function atualizar() {
      pedido = null
      const meio = window.innerHeight / 2
      const atual = seccoes.reduce((escolhida, s) => {
        const el = document.getElementById(s.id)
        return el && el.getBoundingClientRect().top <= meio ? s.id : escolhida
      }, seccoes[0].id)
      setAtiva(atual)
    }
    function aoFazerScroll() {
      if (!pedido) pedido = requestAnimationFrame(atualizar)
    }
    atualizar()
    window.addEventListener('scroll', aoFazerScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', aoFazerScroll)
      if (pedido) cancelAnimationFrame(pedido)
    }
  }, [])

  // no telemóvel o menu desliza na horizontal: mantém o separador ativo à vista
  useEffect(() => {
    const menu = menuRef.current
    const link = menu?.querySelector('[aria-current]')
    if (!menu || !link) return
    const destino = link.offsetLeft - (menu.clientWidth - link.offsetWidth) / 2
    menu.scrollTo({ left: destino, behavior: 'smooth' })
  }, [ativa])

  return (
    <main>
      <CabecalhoPagina
        etiqueta="Institucional"
        titulo="Uma Escola ao serviço da defesa nacional."
        descricao="A Escola Superior de Guerra forma os oficiais que planeiam, comandam e dirigem as Forças Armadas Angolanas."
        imagem={ImagemCabecalho}
        migalhas={[{ label: 'Institucional' }]}
      />

      <nav className={styles.subnav} aria-label="Secções da página">
        <div className={styles.subnavInterior} ref={menuRef}>
          {seccoes.map((s) => (
            <Link
              key={s.id}
              to={{ hash: `#${s.id}` }}
              className={`${styles.subnavLink} ${ativa === s.id ? styles.subnavAtivo : ''}`}
              aria-current={ativa === s.id ? 'true' : undefined}
            >
              {s.label}
            </Link>
          ))}
        </div>
      </nav>

      {/* História */}
      <section id="historia" className={pagina.secao}>
        <div className={pagina.container}>
          <div className={styles.historia}>
            <div>
              <span className={pagina.etiqueta}>História</span>
              <h2 className={pagina.tituloSecao}>Mais de uma década a formar quem comanda.</h2>
              <p className={styles.texto}>
                A Escola Superior de Guerra das Forças Armadas Angolanas nasceu da necessidade de formar, em Angola,
                os oficiais destinados às mais altas funções de comando, direção e estado-maior.
              </p>
              <p className={styles.texto}>
                Desde então, a Escola consolidou-se como o principal estabelecimento de ensino superior militar do
                país, combinando formação doutrinária, investigação científica e cooperação com instituições congéneres.
              </p>
            </div>
            <figure className={styles.historiaFoto}>
              <img src={ImagemHistoria} alt="Oficiais numa sessão no auditório da Escola" />
            </figure>
          </div>

          <ul className={styles.numeros}>
            {numeros.map((n) => (
              <li key={n.legenda}>
                <strong>{n.valor}</strong>
                <span>{n.legenda}</span>
              </li>
            ))}
          </ul>

          <ol className={styles.marcos}>
            {marcos.map((m) => (
              <li key={m.ano}>
                <span className={styles.ano}>{m.ano}</span>
                <h3>{m.titulo}</h3>
                <p>{m.texto}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Missão, Visão e Valores — mesma secção da página inicial */}
      <div id="missao" className={styles.missao}>
        <MissaoVisaoValores />
      </div>

      {/* Estrutura */}
      <section id="estrutura" className={`${pagina.secao} ${pagina.secaoAlt}`}>
        <div className={pagina.container}>
          <span className={pagina.etiqueta}>Organização e Estrutura</span>
          <h2 className={pagina.tituloSecao}>Como a Escola está organizada.</h2>
          <p className={pagina.introSecao}>
            Sob a direção do Comando da Escola, cada órgão tem uma missão própria na formação, na investigação e no apoio à atividade académica.
          </p>

          <div className={styles.organograma}>
            <div className={styles.topoOrganograma}>
              <span className={pagina.etiqueta}>Órgão de direção</span>
              <h3>Comando da Escola</h3>
              <p>Dirige a Escola e define as orientações estratégicas de ensino, investigação e cooperação.</p>
            </div>
            <div className={styles.orgaos}>
              {orgaos.map((o) => (
                <div key={o.nome} className={styles.orgao}>
                  <span className={styles.orgaoIcone} aria-hidden="true">{o.icone}</span>
                  <h3>{o.nome}</h3>
                  <p>{o.texto}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Comando */}
      <section id="comando" className={pagina.secao}>
        <div className={pagina.container}>
          <div className={styles.mensagem}>
            <figure className={styles.mensagemFoto}>
              {comandante.foto ? <img src={comandante.foto} alt={comandante.nome} /> : <span>{iniciais(comandante.nome)}</span>}
            </figure>
            <div>
              <span className={pagina.etiqueta}>Mensagem do Comandante</span>
              <blockquote className={styles.citacao}>
                “Formar quem comanda é formar quem decide. Cada oficial que passa por esta Escola leva consigo a
                responsabilidade de servir Angola com competência e integridade.”
              </blockquote>
              <p className={styles.texto}>
                Na Escola Superior de Guerra, acreditamos que a qualidade das nossas Forças Armadas começa na
                qualidade dos seus quadros. É esse o compromisso que renovamos em cada ano académico.
              </p>
              <div className={styles.assinatura}>
                <strong>{comandante.nome}</strong>
                <span>{comandante.cargo}</span>
              </div>
            </div>
          </div>

          <h3 className={styles.direcaoTitulo}>Equipa de direção</h3>
          <div className={styles.direcao}>
            {direcao.map((p) => (
              <div key={p.id} className={styles.pessoa}>
                <span className={`${pagina.avatar} ${styles.avatarPessoa}`}>
                  {p.foto ? <img src={p.foto} alt="" /> : iniciais(p.nome)}
                </span>
                <h4>{p.nome}</h4>
                <span className={styles.cargo}>{p.cargo}</span>
                <p>{p.destaque}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <CtaBanner />
    </main>
  )
}

export default Institucional
