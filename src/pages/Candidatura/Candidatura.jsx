import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { FaArrowLeft, FaArrowRight, FaCheck, FaPen, FaRegFileAlt } from 'react-icons/fa'
import CabecalhoEditorial from '../../components/CabecalhoEditorial/CabecalhoEditorial'
import { useConteudo } from '../../conteudo/contexto'
import { API_URL, pedido } from '../../conteudo/api'
import { HABILITACOES, PASSOS, POSTOS, RAMOS, VAZIA, errosDoPasso, paraEnvio, passoDoCampo } from './passos'
import ed from '../../styles/editorial.module.css'
import styles from './Candidatura.module.css'
import { t } from '../../i18n/linguas'

const RASCUNHO = 'esgfaa-candidatura'

const DOCUMENTOS = [
  'Bilhete de identidade e cartão militar',
  'Certificado de habilitações académicas',
  'Folha de serviço atualizada',
  'Parecer favorável do ramo de origem',
  'Atestado médico de aptidão física',
]

function lerRascunho() {
  try {
    return JSON.parse(sessionStorage.getItem(RASCUNHO)) || {}
  } catch {
    return {}
  }
}

// Campo com rótulo, mensagem de erro e ajuda
function Campo({ id, rotulo, erro, ajuda, opcional, largo, children }) {
  return (
    <div className={`${styles.campo} ${largo ? styles.largo : ''} ${erro ? styles.comErro : ''}`}>
      <label htmlFor={id}>{rotulo}{opcional && <em> ({t('opcional')})</em>}</label>
      {children}
      {erro ? <span className={styles.erro} id={`${id}-erro`} role="alert">{erro}</span> : ajuda && <span className={styles.ajuda}>{ajuda}</span>}
    </div>
  )
}

function Candidatura() {
  const { cursos, paginas } = useConteudo()
  const pagina = paginas.cursos || {}
  const [params] = useSearchParams()
  const { state } = useLocation()
  const idsCursos = cursos.map((c) => c.id)

  // rascunho deste separador + dados vindos do formulário da página inicial ou do endereço (?curso=)
  const [f, setF] = useState(() => {
    const inicial = { ...VAZIA, ...lerRascunho(), ...(state || {}) }
    if (params.get('curso')) inicial.curso = params.get('curso')
    return inicial
  })
  const [passo, setPasso] = useState(() => (errosDoPasso(0, f, { cursos: idsCursos }).curso ? 0 : 1))
  const [erros, setErros] = useState({})
  const [erroGeral, setErroGeral] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState(null)
  const titulo = useRef(null)

  useEffect(() => {
    if (resultado) return
    try {
      const { declaracao, consentimento, website, ...guardar } = f
      void declaracao, void consentimento, void website
      sessionStorage.setItem(RASCUNHO, JSON.stringify(guardar))
    } catch { /* armazenamento indisponível */ }
  }, [f, resultado])

  // ao mudar de passo, o leitor de ecrã e o teclado vão para o título do passo
  useEffect(() => {
    titulo.current?.focus()
  }, [passo, resultado])

  const curso = cursos.find((c) => c.id === f.curso)
  const definir = (campo) => (e) => {
    const valor = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setF((atual) => ({ ...atual, [campo]: valor }))
    if (erros[campo]) setErros((atual) => ({ ...atual, [campo]: undefined }))
  }
  const props = (campo) => ({
    id: `c-${campo}`, name: campo, value: f[campo], onChange: definir(campo),
    'aria-invalid': Boolean(erros[campo]) || undefined,
    'aria-describedby': erros[campo] ? `c-${campo}-erro` : undefined,
  })

  function validar(indice) {
    const e = errosDoPasso(indice, f, { cursos: idsCursos })
    setErros(e)
    if (Object.keys(e).length) {
      document.getElementById(`c-${Object.keys(e)[0]}`)?.focus()
      return false
    }
    return true
  }

  function seguinte() {
    if (validar(passo)) setPasso((p) => Math.min(PASSOS.length - 1, p + 1))
  }

  function irPara(indice) {
    // só se pode saltar para passos anteriores ou já validados
    for (let i = 0; i < indice; i++) {
      if (Object.keys(errosDoPasso(i, f, { cursos: idsCursos })).length) return setPasso(i)
    }
    setErros({})
    setPasso(indice)
  }

  async function submeter(e) {
    e.preventDefault()
    if (!validar(passo)) return
    setErroGeral('')
    setEnviando(true)
    try {
      const r = await pedido('/api/publico/candidaturas', { method: 'POST', body: JSON.stringify(paraEnvio(f)) })
      setResultado(r || { codigo: null })
      try { sessionStorage.removeItem(RASCUNHO) } catch { /* sem armazenamento */ }
    } catch (falha) {
      if (falha.campo) {
        setPasso(passoDoCampo(falha.campo))
        setErros({ [falha.campo]: falha.message })
      } else {
        setErroGeral(API_URL ? falha.message : t('As candidaturas online estão temporariamente indisponíveis. Contacte a Secretaria Académica.'))
      }
    } finally {
      setEnviando(false)
    }
  }

  if (resultado) {
    return (
      <main className={ed.pagina}>
        <CabecalhoEditorial migalhas={[{ label: t('Cursos'), to: '/Cursos' }, { label: t('Candidatura') }]} sobretitulo={t('Admissão')} titulo={t('Candidatura recebida')} />
        <div className={`contentor ${styles.sucesso}`}>
          <span className={styles.sucessoIcone}><FaCheck aria-hidden="true" /></span>
          <h2 ref={titulo} tabIndex={-1}>{t('Obrigado, {nome}.', { nome: f.nome.split(' ')[0] })}</h2>
          <p>{t('A sua candidatura ao {curso} foi registada. A Secretaria Académica vai analisá-la e responder para {email}.', { curso: curso?.nome || t('curso'), email: f.email })}</p>
          {resultado.codigo && (
            <div className={styles.codigo}>
              <span>{t('Código da candidatura')}</span>
              <strong>{resultado.codigo}</strong>
              <small>{t('Guarde este código para acompanhar o processo.')}</small>
            </div>
          )}
          <div className={styles.proximos}>
            <h3>{t('Próximos passos')}</h3>
            <ol className={ed.listaNumerada}>
              <li>{t('Prepare os documentos indicados abaixo para entregar na Secretaria Académica.')}</li>
              <li>{t('Aguarde o contacto com a data das provas escritas e da entrevista.')}</li>
              <li>{t('Consulte o calendário de admissão na página de Cursos.')}</li>
            </ol>
          </div>
          <div className={`${styles.caixa} ${styles.documentosSucesso}`}>
            <h3><FaRegFileAlt aria-hidden="true" /> {t('Documentos a apresentar')}</h3>
            <ul>
              {DOCUMENTOS.map((d) => <li key={d}>{t(d)}</li>)}
            </ul>
          </div>
          <div className={styles.acoesSucesso}>
            <Link to="/Cursos#calendario" className={ed.botao}>{t('Ver calendário')}</Link>
            <Link to="/" className={`${ed.botao} ${ed.botaoContorno}`}>{t('Voltar ao início')}</Link>
          </div>
        </div>
      </main>
    )
  }

  const ultimo = passo === PASSOS.length - 1

  return (
    <main className={ed.pagina}>
      <CabecalhoEditorial
        migalhas={[{ label: t('Cursos'), to: '/Cursos' }, { label: t('Candidatura') }]}
        sobretitulo={t('Admissão')}
        titulo={t('Candidatura aos cursos')}
        entrada={pagina.anoAcademico ? `${t('Ano académico {ano}', { ano: pagina.anoAcademico })}${pagina.prazo ? ` · ${t('candidaturas até {prazo}', { prazo: pagina.prazo })}` : ''}. ${t('Quatro passos, cerca de 5 minutos.')}` : t('Quatro passos, cerca de 5 minutos.')}
      />

      <div className={`contentor ${styles.grelha}`}>
        <div>
          {/* passos (como o "nav-wizards-1" do Color Admin) */}
          <nav className={styles.passos} aria-label={t('Passos da candidatura')}>
            <ol>
              {PASSOS.map((p, i) => {
                const estado = i < passo ? styles.concluido : i === passo ? styles.ativo : ''
                return (
                  <li key={p.id} className={estado}>
                    <button type="button" onClick={() => irPara(i)} disabled={i > passo} aria-current={i === passo ? 'step' : undefined}>
                      <span className={styles.numero}>{i < passo ? <FaCheck aria-hidden="true" /> : i + 1}</span>
                      <span className={styles.nome}>{t(p.titulo)}</span>
                    </button>
                  </li>
                )
              })}
            </ol>
          </nav>

          <form className={styles.cartao} onSubmit={ultimo ? submeter : (e) => { e.preventDefault(); seguinte() }} noValidate>
            <h2 ref={titulo} tabIndex={-1} className={styles.tituloPasso}>
              <span>{t('Passo {n} de {total}', { n: passo + 1, total: PASSOS.length })}</span>
              {t(PASSOS[passo].titulo)}
            </h2>

            {/* armadilha para robôs */}
            <label className={styles.armadilha} aria-hidden="true">
              Website <input tabIndex={-1} autoComplete="off" value={f.website} onChange={definir('website')} />
            </label>

            {passo === 0 && (
              <fieldset className={styles.cursos}>
                <legend className="sr-only">{t('Curso pretendido')}</legend>
                {cursos.map((c) => (
                  <label key={c.id} className={`${styles.opcaoCurso} ${f.curso === c.id ? styles.opcaoAtiva : ''}`}>
                    <input type="radio" name="curso" id={c.id === cursos[0]?.id ? 'c-curso' : undefined} value={c.id} checked={f.curso === c.id} onChange={definir('curso')} />
                    {c.imagem && <img src={c.imagem} alt="" />}
                    <span className={styles.opcaoTexto}>
                      <strong>{c.nome}</strong>
                      <span>{[c.duracao, c.regime, c.vagas && t('{n} vagas', { n: c.vagas })].filter(Boolean).join(' · ')}</span>
                      {c.destinatarios && <small>{t('Para:')} {c.destinatarios}</small>}
                    </span>
                    <span className={styles.marca} aria-hidden="true"><FaCheck /></span>
                  </label>
                ))}
                {erros.curso && <span className={styles.erro} role="alert">{erros.curso}</span>}
              </fieldset>
            )}

            {passo === 1 && (
              <div className={styles.campos}>
                <Campo id="c-nome" rotulo={t('Nome completo')} erro={erros.nome} largo>
                  <input type="text" autoComplete="name" maxLength={150} {...props('nome')} />
                </Campo>
                <Campo id="c-dataNascimento" rotulo={t('Data de nascimento')} erro={erros.dataNascimento}>
                  <input type="date" autoComplete="bday" {...props('dataNascimento')} />
                </Campo>
                <Campo id="c-bi" rotulo={t('N.º do bilhete de identidade')} erro={erros.bi} ajuda={t('Ex.: 004512345LA041')}>
                  <input type="text" maxLength={20} {...props('bi')} />
                </Campo>
                <Campo id="c-email" rotulo={t('E-mail')} erro={erros.email} ajuda={t('É para aqui que enviamos as respostas.')}>
                  <input type="email" autoComplete="email" maxLength={254} {...props('email')} />
                </Campo>
                <Campo id="c-telefone" rotulo={t('Telefone')} erro={erros.telefone}>
                  <input type="tel" autoComplete="tel" maxLength={20} {...props('telefone')} />
                </Campo>
                <Campo id="c-provincia" rotulo={t('Província')} erro={erros.provincia}>
                  <input type="text" autoComplete="address-level1" maxLength={60} {...props('provincia')} />
                </Campo>
                <Campo id="c-morada" rotulo={t('Morada')} erro={erros.morada} opcional>
                  <input type="text" autoComplete="street-address" maxLength={200} {...props('morada')} />
                </Campo>
              </div>
            )}

            {passo === 2 && (
              <div className={styles.campos}>
                <Campo id="c-ramo" rotulo={t('Ramo')} erro={erros.ramo}>
                  <select {...props('ramo')}>
                    <option value="" disabled>{t('Escolha…')}</option>
                    {RAMOS.map((r) => <option key={r} value={r}>{t(r)}</option>)}
                  </select>
                </Campo>
                <Campo id="c-posto" rotulo={t('Posto')} erro={erros.posto}>
                  <select {...props('posto')}>
                    <option value="" disabled>{t('Escolha…')}</option>
                    {POSTOS.map((p) => <option key={p} value={p}>{t(p)}</option>)}
                  </select>
                </Campo>
                <Campo id="c-nip" rotulo={t('NIP (n.º de identificação militar)')} erro={erros.nip}>
                  <input type="text" maxLength={20} {...props('nip')} />
                </Campo>
                <Campo id="c-anosServico" rotulo={t('Anos de serviço')} erro={erros.anosServico}>
                  <input type="number" min={0} max={45} inputMode="numeric" {...props('anosServico')} />
                </Campo>
                <Campo id="c-unidade" rotulo={t('Unidade / órgão onde presta serviço')} erro={erros.unidade} largo>
                  <input type="text" maxLength={150} {...props('unidade')} />
                </Campo>
                <Campo id="c-habilitacoes" rotulo={t('Habilitações académicas')} erro={erros.habilitacoes}>
                  <select {...props('habilitacoes')}>
                    <option value="" disabled>{t('Escolha…')}</option>
                    {HABILITACOES.map((h) => <option key={h} value={h}>{t(h)}</option>)}
                  </select>
                </Campo>
                <Campo id="c-areaFormacao" rotulo={t('Área de formação')} erro={erros.areaFormacao} opcional>
                  <input type="text" maxLength={120} {...props('areaFormacao')} />
                </Campo>
                <Campo id="c-motivacao" rotulo={t('Porque se candidata a este curso?')} erro={erros.motivacao} ajuda={t('{n} / 2000 caracteres (mínimo 30)', { n: f.motivacao.trim().length })} largo>
                  <textarea rows={5} maxLength={2000} {...props('motivacao')} />
                </Campo>
              </div>
            )}

            {passo === 3 && (
              <div className={styles.revisao}>
                <Resumo titulo={t('Curso')} onEditar={() => irPara(0)}>
                  <Linha rotulo={t('Curso')} valor={curso?.nome} />
                </Resumo>
                <Resumo titulo={t('Dados pessoais')} onEditar={() => irPara(1)}>
                  <Linha rotulo={t('Nome')} valor={f.nome} />
                  <Linha rotulo={t('Nascimento')} valor={f.dataNascimento} />
                  <Linha rotulo={t('Bilhete de identidade')} valor={f.bi} />
                  <Linha rotulo={t('E-mail')} valor={f.email} />
                  <Linha rotulo={t('Telefone')} valor={f.telefone} />
                  <Linha rotulo={t('Província')} valor={f.provincia} />
                  {f.morada && <Linha rotulo={t('Morada')} valor={f.morada} />}
                </Resumo>
                <Resumo titulo={t('Situação militar')} onEditar={() => irPara(2)}>
                  <Linha rotulo={t('Ramo e posto')} valor={`${t(f.ramo)} · ${t(f.posto)}`} />
                  <Linha rotulo={t('NIP')} valor={f.nip} />
                  <Linha rotulo={t('Unidade')} valor={f.unidade} />
                  <Linha rotulo={t('Anos de serviço')} valor={f.anosServico} />
                  <Linha rotulo={t('Habilitações')} valor={[t(f.habilitacoes), f.areaFormacao].filter(Boolean).join(' · ')} />
                </Resumo>

                <label className={`${styles.declaracao} ${erros.declaracao ? styles.comErro : ''}`}>
                  <input type="checkbox" id="c-declaracao" checked={f.declaracao} onChange={definir('declaracao')} />
                  <span>{t('Declaro, sob compromisso de honra, que as informações prestadas são verdadeiras.')}</span>
                </label>
                {erros.declaracao && <span className={styles.erro} role="alert">{erros.declaracao}</span>}
                <label className={`${styles.declaracao} ${erros.consentimento ? styles.comErro : ''}`}>
                  <input type="checkbox" id="c-consentimento" checked={f.consentimento} onChange={definir('consentimento')} />
                  <span>{t('Autorizo a Escola Superior de Guerra a tratar estes dados apenas para o processo de admissão.')}</span>
                </label>
                {erros.consentimento && <span className={styles.erro} role="alert">{erros.consentimento}</span>}
              </div>
            )}

            {erroGeral && <p className={styles.erroGeral} role="alert">{erroGeral}</p>}

            <div className={styles.navegacao}>
              {passo > 0 ? (
                <button type="button" className={`${ed.botao} ${ed.botaoContorno}`} onClick={() => { setErros({}); setPasso(passo - 1) }}>
                  <FaArrowLeft aria-hidden="true" /> {t('Anterior')}
                </button>
              ) : <span />}
              <button type="submit" className={ed.botao} disabled={enviando}>
                {ultimo ? (enviando ? t('A enviar…') : t('Submeter candidatura')) : <>{t('Seguinte')} <FaArrowRight aria-hidden="true" /></>}
              </button>
            </div>
          </form>
        </div>

        <aside className={styles.lateral}>
          <div className={styles.caixa}>
            <h3><FaRegFileAlt aria-hidden="true" /> {t('Documentos a apresentar')}</h3>
            <p>{t('Não precisa de os enviar agora: entrega-os na Secretaria Académica depois de a candidatura ser aceite para análise.')}</p>
            <ul>
              {DOCUMENTOS.map((d) => <li key={d}>{t(d)}</li>)}
            </ul>
          </div>
          {curso?.requisitos?.length > 0 && (
            <div className={styles.caixa}>
              <h3>{t('Requisitos do {sigla}', { sigla: curso.sigla || t('curso') })}</h3>
              <ul>
                {curso.requisitos.map((r) => <li key={r}>{r}</li>)}
              </ul>
            </div>
          )}
          <p className={styles.duvidas}>{t('Dúvidas?')} <Link to="/Contactos#formulario">{t('Contacte a Secretaria Académica')}</Link>.</p>
        </aside>
      </div>
    </main>
  )
}

function Resumo({ titulo, onEditar, children }) {
  return (
    <section className={styles.resumo}>
      <header>
        <h3>{titulo}</h3>
        <button type="button" onClick={onEditar}><FaPen aria-hidden="true" /> {t('Editar')}</button>
      </header>
      <dl>{children}</dl>
    </section>
  )
}

function Linha({ rotulo, valor }) {
  return <div><dt>{rotulo}</dt><dd>{valor || '—'}</dd></div>
}

export default Candidatura
