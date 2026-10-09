import { Link } from 'react-router-dom'
import { FaArrowRight } from 'react-icons/fa'
import CabecalhoEditorial from '../../components/CabecalhoEditorial/CabecalhoEditorial'
import CtaBanner from '../../components/CTABanner/CtaBanner'
import { useConteudo } from '../../conteudo/contexto'
import useSeccaoAtiva from '../../hooks/useSeccaoAtiva'
import { iniciais } from '../../utils/texto'
import Brasao from '../../assets/Logo.png'
import styles from './Institucional.module.css'

const seccoes = [
  { id: 'historia', numero: 'I', label: 'História' },
  { id: 'missao', numero: 'II', label: 'Missão, Visão e Valores' },
  { id: 'estrutura', numero: 'III', label: 'Organização e Estrutura' },
  { id: 'comando', numero: 'IV', label: 'Direção / Comando' },
]

const idsSeccoes = seccoes.map((s) => s.id)

function Institucional() {
  const { pessoas, paginas } = useConteudo()
  const pagina = paginas.institucional
  const contactos = paginas.contactos
  const { numeros, valores } = pagina
  const { marcos } = pagina.historia
  const { ramos } = pagina.estrutura
  const ativa = useSeccaoAtiva(idsSeccoes)
  const comandante = pessoas[0] || { nome: '', cargo: '' }
  const subdiretora = pessoas.find((p) => p.cargo?.startsWith('Subdiretora'))
  const direcao = pessoas.slice(1)

  return (
    <main className={styles.pagina}>
      <CabecalhoEditorial
        sobretitulo="Institucional"
        titulo="A Escola"
        entrada={pagina.entrada}
      />

      <figure className={styles.sede}>
        <img src={pagina.imagemSede} alt="Fachada da Escola Superior de Guerra" />
        <figcaption>
          <span>Sede</span> {pagina.legendaSede}
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
            <TituloSeccao numero="I" rotulo="História">{pagina.historia.titulo}</TituloSeccao>

            <div className={styles.textoColunas}>
              {pagina.historia.imagem && (
                <figure className={styles.figuraTexto}>
                  <img src={pagina.historia.imagem} alt={pagina.historia.legenda || ''} />
                  {pagina.historia.legenda && <figcaption><span>Figura 1</span> {pagina.historia.legenda}</figcaption>}
                </figure>
              )}
              {pagina.historia.paragrafos.map((t, i) => (
                <p key={i} className={i === 0 ? styles.capitular : undefined}>{t}</p>
              ))}
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
                <p>{pagina.missao}</p>
              </article>
              <article>
                <span className={styles.rotulo}>Visão</span>
                <p>{pagina.visao}</p>
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
            <p className={styles.introducao}>{pagina.estrutura.introducao}</p>

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
                <blockquote className={styles.citacao}>{pagina.mensagem.citacao}</blockquote>
                <p className={styles.mensagemTexto}>{pagina.mensagem.texto}</p>
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
