import { Link } from 'react-router-dom'
import { FaArrowRight, FaBuilding, FaBullhorn, FaBullseye, FaChalkboardTeacher, FaCogs, FaEye, FaFileAlt, FaFlask, FaGlobeAfrica, FaGraduationCap, FaHandshake, FaShieldAlt, FaSitemap, FaStar, FaTools } from 'react-icons/fa'
import CabecalhoEditorial from '../../components/CabecalhoEditorial/CabecalhoEditorial'
import CtaBanner from '../../components/CTABanner/CtaBanner'
import { useConteudo } from '../../conteudo/contexto'
import useSeccaoAtiva from '../../hooks/useSeccaoAtiva'
import { iniciais } from '../../utils/texto'
import Organograma from '../../components/Organograma/Organograma'
import { orgaosDe } from '../../components/Organograma/orgaos'
import { mensagensDosComandantes, nomeCompleto, paragrafos } from '../../components/MensagemComandante/comandantes'
import styles from './Institucional.module.css'
import { t } from '../../i18n/linguas'

const seccoes = [
  { id: 'historia', label: 'História' },
  { id: 'missao', label: 'Missão, Visão e Valores' },
  { id: 'estrutura', label: 'Organização e Estrutura' },
  { id: 'comando', label: 'Direção / Comando' },
]

const idsSeccoes = seccoes.map((s) => s.id)

// a cor de cada área (vermelho da Escola, verde militar, dourado) e os ícones, pelo nome (com um de reserva)
const CORES_AREA = ['var(--marca)', '#3d6b3a', 'var(--dourado)']
const semAcento = (x) => String(x ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const pelo = (lista, reserva) => (nome) => (lista.find(([re]) => re.test(semAcento(nome)))?.[1] ?? reserva)
const iconeDaArea = pelo([[/ensino|formac/, FaGraduationCap], [/investig|cooper/, FaGlobeAfrica], [/apoio|servic|logist/, FaCogs]], FaSitemap)
const iconeDoOrgao = pelo([
  [/direc|direç/, FaSitemap], [/docente|professor/, FaChalkboardTeacher], [/secretar|matricul/, FaFileAlt], [/investig|pesquis/, FaFlask],
  [/cooper|internac/, FaHandshake], [/comunic|imprensa/, FaBullhorn], [/apoio|logist|servic/, FaTools],
], FaBuilding)

function Institucional() {
  const { pessoas, paginas } = useConteudo()
  const pagina = paginas.institucional
  const contactos = paginas.contactos
  const { numeros, valores } = pagina
  const { marcos } = pagina.historia
  const { ramos } = pagina.estrutura
  const ativa = useSeccaoAtiva(idsSeccoes)
  const comandante = pessoas[0] || { nome: '', cargo: '' }
  const direcao = pessoas.slice(1)
  const msg = mensagensDosComandantes(paginas)
  const paragrafosMsg = msg.actual ? paragrafos(msg.actual.mensagem) : []

  return (
    <main className={styles.pagina}>
      <CabecalhoEditorial
        migalhas={[{ label: t('Institucional') }]}
        sobretitulo={t('Institucional')}
        titulo={t('A Escola')}
        entrada={pagina.entrada}
      />

      <figure className={`contentor ${styles.sede}`}>
        <img src={pagina.imagemSede} alt={t('Fachada da Escola Superior de Guerra')} />
        <figcaption>
          <span>{t('Sede')}</span> {pagina.legendaSede}
        </figcaption>
      </figure>

      <dl className={`contentor ${styles.numeros}`}>
        {numeros.map((n, iN) => (
          <div key={`${n.legenda}-${iN}`}>
            <dd>{n.valor}</dd>
            <dt>{n.legenda}</dt>
          </div>
        ))}
      </dl>

      <div className={`contentor ${styles.grelha}`}>
        {/* Índice */}
        <aside className={styles.indice}>
          <h2 className={styles.indiceTitulo}>{t('Nesta página')}</h2>
          <nav aria-label={t('Secções da página')}>
            <ol>
              {seccoes.map((s) => (
                <li key={s.id}>
                  <Link
                    to={{ hash: `#${s.id}` }}
                    className={ativa === s.id ? styles.indiceAtivo : ''}
                    aria-current={ativa === s.id ? 'true' : undefined}
                  >
                    {t(s.label)}
                  </Link>
                </li>
              ))}
            </ol>
          </nav>

          <div className={styles.contactoInstitucional}>
            <h3>{t('Contacto institucional')}</h3>
            <p>{contactos.morada.join(', ')}</p>
            <a href={`mailto:${contactos.email}`}>{contactos.email}</a>
          </div>
        </aside>

        <div className={styles.conteudo}>
          {/* I. História */}
          <section id="historia" className={styles.seccao}>
            <TituloSeccao rotulo={t('História')}>{pagina.historia.titulo}</TituloSeccao>

            <div className={styles.textoColunas}>
              {pagina.historia.imagem && (
                <figure className={styles.figuraTexto}>
                  <img loading="lazy" decoding="async" src={pagina.historia.imagem} alt={pagina.historia.legenda || ''} />
                  {pagina.historia.legenda && <figcaption><span>{t('Figura {n}', { n: 1 })}</span> {pagina.historia.legenda}</figcaption>}
                </figure>
              )}
              {pagina.historia.paragrafos.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>

            <table className={styles.cronologia}>
              <caption>{t('Cronologia')}</caption>
              <tbody>
                {marcos.map((m, iM) => (
                  <tr key={`${m.ano}-${iM}`}>
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
            <TituloSeccao rotulo={t('Missão, Visão e Valores')}>{t('O que nos orienta')}</TituloSeccao>

            {/* a missão e a visão em destaque; os valores numerados, numa grelha com as colunas certas para quantos forem */}
            <div className={styles.declaracoes}>
              {[['missao', t('Missão'), FaBullseye], ['visao', t('Visão'), FaEye]].map(([k, rotulo, Icone]) => (
                <article key={k}>
                  <span className={styles.declaracaoIcone}><Icone aria-hidden="true" /></span>
                  <div>
                    <h3>{rotulo}</h3>
                    <p>{pagina[k]}</p>
                  </div>
                </article>
              ))}
            </div>

            <div className={styles.valores}>
              <h3 className={styles.valoresTitulo}><FaShieldAlt aria-hidden="true" /> {t('Valores')}</h3>
              <ol style={{ '--colunas': Math.min(Math.max(valores.length, 1), 4) }}>
                {valores.map((v, iV) => (
                  <li key={`${v.nome}-${iV}`}>
                    <span className={styles.valorNumero}>{String(iV + 1).padStart(2, '0')}</span>
                    <h4>{v.nome}</h4>
                    <p>{v.texto}</p>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          {/* III. Organização e Estrutura */}
          <section id="estrutura" className={styles.seccao}>
            <TituloSeccao rotulo={t('Organização e Estrutura')}>{t('Como a Escola está organizada')}</TituloSeccao>
            <p className={styles.introducao}>{pagina.estrutura.introducao}</p>

            {/* como um organograma: o Comando no topo e, ligadas a ele, as áreas (painéis com a lista dos órgãos) */}
            <div className={styles.comandoTopo}>
              <span className={styles.comandoIcone}><FaStar aria-hidden="true" /></span>
              <div>
                <strong>{t('Comando da Escola')}</strong>
                <span>{t('Comandante e 2.º Comandante')}</span>
              </div>
            </div>
            <div className={styles.ramos} style={{ '--areas': Math.min(Math.max(ramos.length, 1), 3) }}>
              {ramos.map((r, iR) => {
                const IconeArea = iconeDaArea(r.titulo)
                return (
                  <article key={`${r.titulo}-${iR}`} className={styles.ramo} style={{ '--cor-area': CORES_AREA[iR % CORES_AREA.length] }}>
                    <header className={styles.ramoCabeca}>
                      <IconeArea aria-hidden="true" />
                      <h4>{r.titulo}</h4>
                      <span className={styles.ramoConta}>{r.orgaos.length}</span>
                    </header>
                    <ul>
                      {r.orgaos.map((o, iO) => {
                        const Icone = iconeDoOrgao(o.nome)
                        return (
                          <li key={`${o.nome}-${iO}`}>
                            <span className={styles.orgaoIcone}><Icone aria-hidden="true" /></span>
                            <div>
                              <strong>{o.nome}</strong>
                              <span>{o.texto}</span>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  </article>
                )
              })}
            </div>
          </section>

          {/* IV. Direção / Comando */}
          <section id="comando" className={styles.seccao}>
            <TituloSeccao rotulo={t('Direção / Comando')}>{t('Mensagem do Comandante')}</TituloSeccao>

            {/* a mesma mensagem da página inicial (Páginas › Página inicial › Mensagem do Comandante); sem ela, a antiga desta página */}
            {msg.actual ? (
              <div className={styles.mensagem}>
                <figure className={styles.retrato}>
                  {msg.actual.foto ? <img loading="lazy" decoding="async" src={msg.actual.foto} alt={nomeCompleto(msg.actual)} /> : <span>{iniciais(msg.actual.nome)}</span>}
                </figure>
                <div>
                  <blockquote className={styles.citacao}>{paragrafosMsg[0]}</blockquote>
                  {paragrafosMsg.slice(1).map((x) => <p key={x.slice(0, 40)} className={styles.mensagemTexto}>{x}</p>)}
                  <div className={styles.assinatura}>
                    <strong>{nomeCompleto(msg.actual)}</strong>
                    <span>{t('Comandante da Escola Superior de Guerra')}{msg.actual.periodo ? ` · ${msg.actual.periodo}` : ''}</span>
                  </div>
                  {msg.anteriores.length > 0 && (
                    <Link to="/Comandantes" className={styles.ligacao}>
                      {t('Mensagens dos comandantes anteriores')} <FaArrowRight aria-hidden="true" />
                    </Link>
                  )}
                </div>
              </div>
            ) : (
              <div className={styles.mensagem}>
                <figure className={styles.retrato}>
                  {comandante.foto ? <img loading="lazy" decoding="async" src={comandante.foto} alt={comandante.nome} /> : <span>{iniciais(comandante.nome)}</span>}
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
            )}

            <div className={styles.organogramaBloco}>
              <h3 className={styles.subtitulo}>{t('Organograma da Escola')}</h3>
              <Organograma orgaos={orgaosDe(pagina.estrutura, t('Comando da Escola'))} pessoas={pessoas} />
            </div>

            <div className={styles.diretorio}>
              <h3 className={styles.subtitulo}>{t('Equipa de direção')}</h3>
              <ul>
                {direcao.map((p) => (
                  <li key={p.id}>
                    <span className={styles.avatar}>{p.foto ? <img loading="lazy" decoding="async" src={p.foto} alt="" /> : iniciais(p.nome)}</span>
                    <strong>{p.nome}</strong>
                    <span className={styles.cargo}>{p.cargo}</span>
                    <span className={styles.descricao}>{p.destaque}</span>
                  </li>
                ))}
              </ul>
            </div>

            <Link to="/Contactos#formulario" className={styles.ligacao}>
              {t('Contactar a Escola')} <FaArrowRight aria-hidden="true" />
            </Link>
          </section>
        </div>
      </div>

      <CtaBanner />
    </main>
  )
}

function TituloSeccao({ rotulo, children }) {
  return (
    <div className={styles.tituloSeccao}>
      <span className={styles.rotulo}>{rotulo}</span>
      <h2>{children}</h2>
    </div>
  )
}

export default Institucional
