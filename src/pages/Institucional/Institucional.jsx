import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FaArrowRight } from 'react-icons/fa'
import CabecalhoEditorial from '../../components/CabecalhoEditorial/CabecalhoEditorial'
import CtaBanner from '../../components/CTABanner/CtaBanner'
import pessoas from '../../data/pessoas'
import contactos from '../../data/contactos'
import { iniciais } from '../../utils/texto'
import ImagemSede from '../../assets/Escola De Guerra.png'
import ImagemHistoria from '../../assets/Escola2.jpeg'
import Brasao from '../../assets/Logo.png'
import styles from './Institucional.module.css'

const seccoes = [
  { id: 'historia', numero: 'I', label: 'História' },
  { id: 'missao', numero: 'II', label: 'Missão, Visão e Valores' },
  { id: 'estrutura', numero: 'III', label: 'Organização e Estrutura' },
  { id: 'comando', numero: 'IV', label: 'Direção / Comando' },
]

const numeros = [
  { valor: '+10', legenda: 'Anos de existência' },
  { valor: '+500', legenda: 'Oficiais formados' },
  { valor: '03', legenda: 'Cursos de formação superior' },
  { valor: '+20', legenda: 'Acordos de cooperação' },
]

// ATENÇÃO: conteúdo provisório — substituir pelos marcos oficiais da história da Escola.
const marcos = [
  { ano: '2014', titulo: 'Criação da Escola', texto: 'Instituída como estabelecimento de ensino superior militar das Forças Armadas Angolanas.' },
  { ano: '2015', titulo: 'Primeiro Curso de Estado-Maior', texto: 'Arranque da formação de oficiais para funções de estado-maior.' },
  { ano: '2018', titulo: 'Abertura internacional', texto: 'Assinatura dos primeiros protocolos de cooperação com escolas militares parceiras.' },
  { ano: '2021', titulo: 'Novo ciclo de comando', texto: 'Início de um programa de modernização curricular e pedagógica.' },
  { ano: '2026', titulo: 'Reforço da investigação', texto: 'Seminários de investigação obrigatórios em todos os cursos e nova revista científica.' },
]

const valores = [
  { nome: 'Disciplina', texto: 'Cumprimento rigoroso do dever, das normas e da palavra dada.' },
  { nome: 'Integridade', texto: 'Coerência entre o que se pensa, o que se diz e o que se faz.' },
  { nome: 'Lealdade', texto: 'Para com a Nação, as Forças Armadas, os superiores e os subordinados.' },
  { nome: 'Espírito de serviço', texto: 'Colocar o interesse nacional acima do interesse pessoal.' },
]

const ramos = [
  {
    titulo: 'Ensino',
    orgaos: [
      { nome: 'Direção de Ensino', texto: 'Planeia os cursos, os planos curriculares e a avaliação.' },
      { nome: 'Corpo Docente', texto: 'Docentes militares e civis responsáveis pela formação.' },
      { nome: 'Secretaria Académica', texto: 'Candidaturas, matrículas, certificados e calendário.' },
    ],
  },
  {
    titulo: 'Investigação e Cooperação',
    orgaos: [
      { nome: 'Departamento de Investigação', texto: 'Investigação científica em estratégia, segurança e defesa.' },
      { nome: 'Cooperação Internacional', texto: 'Protocolos e intercâmbio com instituições parceiras.' },
    ],
  },
  {
    titulo: 'Apoio',
    orgaos: [
      { nome: 'Gabinete de Comunicação', texto: 'Imprensa, eventos, publicações e redes sociais.' },
      { nome: 'Serviços de Apoio', texto: 'Logística, instalações e recursos administrativos.' },
    ],
  },
]

function Institucional() {
  const [ativa, setAtiva] = useState(seccoes[0].id)
  const comandante = pessoas[0]
  const subdiretora = pessoas.find((p) => p.cargo.startsWith('Subdiretora'))
  const direcao = pessoas.slice(1)

  // marca no índice a última secção cujo topo já passou o meio do ecrã
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

  return (
    <main className={styles.pagina}>
      <CabecalhoEditorial
        topo={['Forças Armadas Angolanas', 'Estabelecimento de Ensino Superior Militar']}
        sobretitulo="Institucional"
        titulo="A Escola"
        entrada="A Escola Superior de Guerra forma os oficiais que planeiam, comandam e dirigem as Forças Armadas Angolanas — e produz o pensamento estratégico que os acompanha."
      />

      <figure className={styles.sede}>
        <img src={ImagemSede} alt="Fachada da Escola Superior de Guerra" />
        <figcaption>
          <span>Sede</span> Escola Superior de Guerra das Forças Armadas Angolanas, Luanda.
        </figcaption>
      </figure>

      <dl className={styles.numeros}>
        {numeros.map((n) => (
          <div key={n.legenda}>
            <dd>{n.valor}</dd>
            <dt>{n.legenda}</dt>
          </div>
        ))}
      </dl>

      <div className={styles.grelha}>
        {/* Índice */}
        <aside className={styles.indice}>
          <span className={styles.rotulo}>Índice</span>
          <nav aria-label="Secções da página">
            <ol>
              {seccoes.map((s) => (
                <li key={s.id}>
                  <Link
                    to={{ hash: `#${s.id}` }}
                    className={ativa === s.id ? styles.indiceAtivo : ''}
                    aria-current={ativa === s.id ? 'true' : undefined}
                  >
                    <span className={styles.indiceNumero}>{s.numero}</span>
                    {s.label}
                  </Link>
                </li>
              ))}
            </ol>
          </nav>

          <div className={styles.contactoInstitucional}>
            <span className={styles.rotulo}>Contacto institucional</span>
            <p>{contactos.morada.join(', ')}</p>
            <a href={`mailto:${contactos.email}`}>{contactos.email}</a>
          </div>
        </aside>

        <div className={styles.conteudo}>
          {/* I. História */}
          <section id="historia" className={styles.seccao}>
            <TituloSeccao numero="I" rotulo="História">Mais de uma década a formar quem comanda.</TituloSeccao>

            <div className={styles.textoColunas}>
              <figure className={styles.figuraTexto}>
                <img src={ImagemHistoria} alt="Oficiais numa sessão no auditório da Escola" />
                <figcaption><span>Figura 1</span> Sessão solene no auditório principal.</figcaption>
              </figure>
              <p className={styles.capitular}>
                A Escola Superior de Guerra das Forças Armadas Angolanas nasceu da necessidade de formar, em Angola,
                os oficiais destinados às mais altas funções de comando, direção e estado-maior, reduzindo a
                dependência da formação no estrangeiro e adaptando o ensino à realidade nacional.
              </p>
              <p>
                Desde então, a Escola consolidou-se como o principal estabelecimento de ensino superior militar do
                país. O seu modelo combina a formação doutrinária com a investigação científica e a cooperação com
                instituições congéneres, num ambiente em que oficiais dos três ramos aprendem a planear e a decidir
                em conjunto.
              </p>
              <p>
                Ao longo dos anos, os cursos foram sendo revistos para acompanhar a evolução das ameaças, da
                tecnologia e das missões das Forças Armadas, mantendo como referência os valores que definem a
                condição militar.
              </p>
            </div>

            <table className={styles.cronologia}>
              <caption>Cronologia</caption>
              <tbody>
                {marcos.map((m) => (
                  <tr key={m.ano}>
                    <th scope="row">{m.ano}</th>
                    <td className={styles.cronologiaTitulo}>{m.titulo}</td>
                    <td>{m.texto}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* II. Missão, Visão e Valores */}
          <section id="missao" className={styles.seccao}>
            <TituloSeccao numero="II" rotulo="Missão, Visão e Valores">O que nos orienta.</TituloSeccao>

            <div className={styles.declaracoes}>
              <article>
                <span className={styles.rotulo}>Missão</span>
                <p>
                  Formar oficiais com competência técnica, ética e capacidade de comando ao serviço da defesa de Angola.
                </p>
              </article>
              <article>
                <span className={styles.rotulo}>Visão</span>
                <p>
                  Ser referência regional na formação de quadros militares e na investigação em estratégia e defesa.
                </p>
              </article>
            </div>

            <div className={styles.valores}>
              <span className={styles.rotulo}>Valores</span>
              <ol>
                {valores.map((v, i) => (
                  <li key={v.nome}>
                    <span className={styles.valorNumero}>{String(i + 1).padStart(2, '0')}</span>
                    <h3>{v.nome}</h3>
                    <p>{v.texto}</p>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          {/* III. Organização e Estrutura */}
          <section id="estrutura" className={styles.seccao}>
            <TituloSeccao numero="III" rotulo="Organização e Estrutura">Como a Escola está organizada.</TituloSeccao>
            <p className={styles.introducao}>
              Sob a direção do Comando, a Escola organiza-se em três áreas — ensino, investigação e cooperação, e
              apoio — cada uma com órgãos de missão própria.
            </p>

            <div className={styles.organograma}>
              <div className={styles.topo}>
                <img src={Brasao} alt="" className={styles.topoBrasao} />
                <div>
                  <span className={styles.rotulo}>Órgão de direção</span>
                  <h3>Comando da Escola</h3>
                  <p>
                    {comandante.nome} · {comandante.cargo}
                    {subdiretora && <><br />{subdiretora.nome} · {subdiretora.cargo}</>}
                  </p>
                </div>
              </div>

              <div className={styles.ramos}>
                {ramos.map((r) => (
                  <div key={r.titulo} className={styles.ramo}>
                    <h4>{r.titulo}</h4>
                    <ul>
                      {r.orgaos.map((o) => (
                        <li key={o.nome}>
                          <strong>{o.nome}</strong>
                          <span>{o.texto}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* IV. Direção / Comando */}
          <section id="comando" className={styles.seccao}>
            <TituloSeccao numero="IV" rotulo="Direção / Comando">Mensagem do Comandante.</TituloSeccao>

            <div className={styles.mensagem}>
              <figure className={styles.retrato}>
                {comandante.foto ? <img src={comandante.foto} alt={comandante.nome} /> : <span>{iniciais(comandante.nome)}</span>}
              </figure>
              <div>
                <blockquote className={styles.citacao}>
                  Formar quem comanda é formar quem decide. Cada oficial que passa por esta Escola leva consigo a
                  responsabilidade de servir Angola com competência e integridade.
                </blockquote>
                <p className={styles.mensagemTexto}>
                  Na Escola Superior de Guerra, acreditamos que a qualidade das nossas Forças Armadas começa na
                  qualidade dos seus quadros. É esse o compromisso que renovamos em cada ano académico: exigência no
                  ensino, rigor na investigação e abertura ao mundo.
                </p>
                <div className={styles.assinatura}>
                  <strong>{comandante.nome}</strong>
                  <span>{comandante.cargo}</span>
                </div>
              </div>
            </div>

            <div className={styles.diretorio}>
              <span className={styles.rotulo}>Equipa de direção</span>
              <ul>
                {direcao.map((p) => (
                  <li key={p.id}>
                    <span className={styles.avatar}>{p.foto ? <img src={p.foto} alt="" /> : iniciais(p.nome)}</span>
                    <strong>{p.nome}</strong>
                    <span className={styles.cargo}>{p.cargo}</span>
                    <span className={styles.descricao}>{p.destaque}</span>
                  </li>
                ))}
              </ul>
            </div>

            <Link to="/Contactos#formulario" className={styles.ligacao}>
              Contactar a Escola <FaArrowRight aria-hidden="true" />
            </Link>
          </section>
        </div>
      </div>

      <CtaBanner />
    </main>
  )
}

function TituloSeccao({ numero, rotulo, children }) {
  return (
    <div className={styles.tituloSeccao}>
      <span className={styles.numeroSeccao} aria-hidden="true">{numero}</span>
      <div>
        <span className={styles.rotulo}>{rotulo}</span>
        <h2>{children}</h2>
      </div>
    </div>
  )
}

export default Institucional
