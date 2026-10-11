import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { FaArrowLeft, FaArrowRight, FaCheck, FaPen, FaRegFileAlt } from 'react-icons/fa'
import CabecalhoEditorial from '../../components/CabecalhoEditorial/CabecalhoEditorial'
import { useConteudo } from '../../conteudo/contexto'
import { API_URL, pedido } from '../../conteudo/api'
import { HABILITACOES, PASSOS, POSTOS, RAMOS, VAZIA, errosDoPasso, paraEnvio, passoDoCampo } from './passos'
import ed from '../../styles/editorial.module.css'
import styles from './Candidatura.module.css'

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
      <label htmlFor={id}>{rotulo}{opcional && <em> (opcional)</em>}</label>
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
        setErroGeral(API_URL ? falha.message : 'As candidaturas online estão temporariamente indisponíveis. Contacte a Secretaria Académica.')
      }
    } finally {
      setEnviando(false)
    }
  }

  if (resultado) {
    return (
      <main className={ed.pagina}>
        <CabecalhoEditorial migalhas={[{ label: 'Cursos', to: '/Cursos' }, { label: 'Candidatura' }]} sobretitulo="Admissão" titulo="Candidatura recebida" />
        <div className={`contentor ${styles.sucesso}`}>
          <span className={styles.sucessoIcone}><FaCheck aria-hidden="true" /></span>
          <h2 ref={titulo} tabIndex={-1}>Obrigado, {f.nome.split(' ')[0]}.</h2>
          <p>A sua candidatura ao <strong>{curso?.nome || 'curso'}</strong> foi registada. A Secretaria Académica vai analisá-la e responder para <strong>{f.email}</strong>.</p>
          {resultado.codigo && (
            <div className={styles.codigo}>
              <span>Código da candidatura</span>
              <strong>{resultado.codigo}</strong>
              <small>Guarde este código para acompanhar o processo.</small>
            </div>
          )}
          <div className={styles.proximos}>
            <h3>Próximos passos</h3>
            <ol className={ed.listaNumerada}>
              <li>Prepare os documentos indicados abaixo para entregar na Secretaria Académica.</li>
              <li>Aguarde o contacto com a data das provas escritas e da entrevista.</li>
              <li>Consulte o calendário de admissão na página de Cursos.</li>
            </ol>
          </div>
          <div className={`${styles.caixa} ${styles.documentosSucesso}`}>
            <h3><FaRegFileAlt aria-hidden="true" /> Documentos a apresentar</h3>
            <ul>
              {DOCUMENTOS.map((d) => <li key={d}>{d}</li>)}
            </ul>
          </div>
          <div className={styles.acoesSucesso}>
            <Link to="/Cursos#calendario" className={ed.botao}>Ver calendário</Link>
            <Link to="/" className={`${ed.botao} ${ed.botaoContorno}`}>Voltar ao início</Link>
          </div>
        </div>
      </main>
    )
  }

  const ultimo = passo === PASSOS.length - 1

  return (
    <main className={ed.pagina}>
      <CabecalhoEditorial
        migalhas={[{ label: 'Cursos', to: '/Cursos' }, { label: 'Candidatura' }]}
        sobretitulo="Admissão"
        titulo="Candidatura aos cursos"
        entrada={pagina.anoAcademico ? `Ano académico ${pagina.anoAcademico}${pagina.prazo ? ` · candidaturas até ${pagina.prazo}` : ''}. Quatro passos, cerca de 5 minutos.` : 'Quatro passos, cerca de 5 minutos.'}
      />

      <div className={`contentor ${styles.grelha}`}>
        <div>
          {/* passos (como o "nav-wizards-1" do Color Admin) */}
          <nav className={styles.passos} aria-label="Passos da candidatura">
            <ol>
              {PASSOS.map((p, i) => {
                const estado = i < passo ? styles.concluido : i === passo ? styles.ativo : ''
                return (
                  <li key={p.id} className={estado}>
                    <button type="button" onClick={() => irPara(i)} disabled={i > passo} aria-current={i === passo ? 'step' : undefined}>
                      <span className={styles.numero}>{i < passo ? <FaCheck aria-hidden="true" /> : i + 1}</span>
                      <span className={styles.nome}>{p.titulo}</span>
                    </button>
                  </li>
                )
              })}
            </ol>
          </nav>

          <form className={styles.cartao} onSubmit={ultimo ? submeter : (e) => { e.preventDefault(); seguinte() }} noValidate>
            <h2 ref={titulo} tabIndex={-1} className={styles.tituloPasso}>
              <span>Passo {passo + 1} de {PASSOS.length}</span>
              {PASSOS[passo].titulo}
            </h2>

            {/* armadilha para robôs */}
            <label className={styles.armadilha} aria-hidden="true">
              Website <input tabIndex={-1} autoComplete="off" value={f.website} onChange={definir('website')} />
            </label>

            {passo === 0 && (
              <fieldset className={styles.cursos}>
                <legend className="sr-only">Curso pretendido</legend>
                {cursos.map((c) => (
                  <label key={c.id} className={`${styles.opcaoCurso} ${f.curso === c.id ? styles.opcaoAtiva : ''}`}>
                    <input type="radio" name="curso" id={c.id === cursos[0]?.id ? 'c-curso' : undefined} value={c.id} checked={f.curso === c.id} onChange={definir('curso')} />
                    {c.imagem && <img src={c.imagem} alt="" />}
                    <span className={styles.opcaoTexto}>
                      <strong>{c.nome}</strong>
                      <span>{[c.duracao, c.regime, c.vagas && `${c.vagas} vagas`].filter(Boolean).join(' · ')}</span>
                      {c.destinatarios && <small>Para: {c.destinatarios}</small>}
                    </span>
                    <span className={styles.marca} aria-hidden="true"><FaCheck /></span>
                  </label>
                ))}
                {erros.curso && <span className={styles.erro} role="alert">{erros.curso}</span>}
              </fieldset>
            )}

            {passo === 1 && (
              <div className={styles.campos}>
                <Campo id="c-nome" rotulo="Nome completo" erro={erros.nome} largo>
                  <input type="text" autoComplete="name" maxLength={150} {...props('nome')} />
                </Campo>
                <Campo id="c-dataNascimento" rotulo="Data de nascimento" erro={erros.dataNascimento}>
                  <input type="date" autoComplete="bday" {...props('dataNascimento')} />
                </Campo>
                <Campo id="c-bi" rotulo="N.º do bilhete de identidade" erro={erros.bi} ajuda="Ex.: 004512345LA041">
                  <input type="text" maxLength={20} {...props('bi')} />
                </Campo>
                <Campo id="c-email" rotulo="E-mail" erro={erros.email} ajuda="É para aqui que enviamos as respostas.">
                  <input type="email" autoComplete="email" maxLength={254} {...props('email')} />
                </Campo>
                <Campo id="c-telefone" rotulo="Telefone" erro={erros.telefone}>
                  <input type="tel" autoComplete="tel" maxLength={20} {...props('telefone')} />
                </Campo>
                <Campo id="c-provincia" rotulo="Província" erro={erros.provincia}>
                  <input type="text" autoComplete="address-level1" maxLength={60} {...props('provincia')} />
                </Campo>
                <Campo id="c-morada" rotulo="Morada" erro={erros.morada} opcional>
                  <input type="text" autoComplete="street-address" maxLength={200} {...props('morada')} />
                </Campo>
              </div>
            )}

            {passo === 2 && (
              <div className={styles.campos}>
                <Campo id="c-ramo" rotulo="Ramo" erro={erros.ramo}>
                  <select {...props('ramo')}>
                    <option value="" disabled>Escolha…</option>
                    {RAMOS.map((r) => <option key={r}>{r}</option>)}
                  </select>
                </Campo>
                <Campo id="c-posto" rotulo="Posto" erro={erros.posto}>
                  <select {...props('posto')}>
                    <option value="" disabled>Escolha…</option>
                    {POSTOS.map((p) => <option key={p}>{p}</option>)}
                  </select>
                </Campo>
                <Campo id="c-nip" rotulo="NIP (n.º de identificação militar)" erro={erros.nip}>
                  <input type="text" maxLength={20} {...props('nip')} />
                </Campo>
                <Campo id="c-anosServico" rotulo="Anos de serviço" erro={erros.anosServico}>
                  <input type="number" min={0} max={45} inputMode="numeric" {...props('anosServico')} />
                </Campo>
                <Campo id="c-unidade" rotulo="Unidade / órgão onde presta serviço" erro={erros.unidade} largo>
                  <input type="text" maxLength={150} {...props('unidade')} />
                </Campo>
                <Campo id="c-habilitacoes" rotulo="Habilitações académicas" erro={erros.habilitacoes}>
                  <select {...props('habilitacoes')}>
                    <option value="" disabled>Escolha…</option>
                    {HABILITACOES.map((h) => <option key={h}>{h}</option>)}
                  </select>
                </Campo>
                <Campo id="c-areaFormacao" rotulo="Área de formação" erro={erros.areaFormacao} opcional>
                  <input type="text" maxLength={120} {...props('areaFormacao')} />
                </Campo>
                <Campo id="c-motivacao" rotulo="Porque se candidata a este curso?" erro={erros.motivacao} ajuda={`${f.motivacao.trim().length} / 2000 caracteres (mínimo 30)`} largo>
                  <textarea rows={5} maxLength={2000} {...props('motivacao')} />
                </Campo>
              </div>
            )}

            {passo === 3 && (
              <div className={styles.revisao}>
                <Resumo titulo="Curso" onEditar={() => irPara(0)}>
                  <Linha rotulo="Curso" valor={curso?.nome} />
                </Resumo>
                <Resumo titulo="Dados pessoais" onEditar={() => irPara(1)}>
                  <Linha rotulo="Nome" valor={f.nome} />
                  <Linha rotulo="Nascimento" valor={f.dataNascimento} />
                  <Linha rotulo="Bilhete de identidade" valor={f.bi} />
                  <Linha rotulo="E-mail" valor={f.email} />
                  <Linha rotulo="Telefone" valor={f.telefone} />
                  <Linha rotulo="Província" valor={f.provincia} />
                  {f.morada && <Linha rotulo="Morada" valor={f.morada} />}
                </Resumo>
                <Resumo titulo="Situação militar" onEditar={() => irPara(2)}>
                  <Linha rotulo="Ramo e posto" valor={`${f.ramo} · ${f.posto}`} />
                  <Linha rotulo="NIP" valor={f.nip} />
                  <Linha rotulo="Unidade" valor={f.unidade} />
                  <Linha rotulo="Anos de serviço" valor={f.anosServico} />
                  <Linha rotulo="Habilitações" valor={[f.habilitacoes, f.areaFormacao].filter(Boolean).join(' · ')} />
                </Resumo>

                <label className={`${styles.declaracao} ${erros.declaracao ? styles.comErro : ''}`}>
                  <input type="checkbox" id="c-declaracao" checked={f.declaracao} onChange={definir('declaracao')} />
                  <span>Declaro, sob compromisso de honra, que as informações prestadas são verdadeiras.</span>
                </label>
                {erros.declaracao && <span className={styles.erro} role="alert">{erros.declaracao}</span>}
                <label className={`${styles.declaracao} ${erros.consentimento ? styles.comErro : ''}`}>
                  <input type="checkbox" id="c-consentimento" checked={f.consentimento} onChange={definir('consentimento')} />
                  <span>Autorizo a Escola Superior de Guerra a tratar estes dados apenas para o processo de admissão.</span>
                </label>
                {erros.consentimento && <span className={styles.erro} role="alert">{erros.consentimento}</span>}
              </div>
            )}

            {erroGeral && <p className={styles.erroGeral} role="alert">{erroGeral}</p>}

            <div className={styles.navegacao}>
              {passo > 0 ? (
                <button type="button" className={`${ed.botao} ${ed.botaoContorno}`} onClick={() => { setErros({}); setPasso(passo - 1) }}>
                  <FaArrowLeft aria-hidden="true" /> Anterior
                </button>
              ) : <span />}
              <button type="submit" className={ed.botao} disabled={enviando}>
                {ultimo ? (enviando ? 'A enviar…' : 'Submeter candidatura') : <>Seguinte <FaArrowRight aria-hidden="true" /></>}
              </button>
            </div>
          </form>
        </div>

        <aside className={styles.lateral}>
          <div className={styles.caixa}>
            <h3><FaRegFileAlt aria-hidden="true" /> Documentos a apresentar</h3>
            <p>Não precisa de os enviar agora: entrega-os na Secretaria Académica depois de a candidatura ser aceite para análise.</p>
            <ul>
              {DOCUMENTOS.map((d) => <li key={d}>{d}</li>)}
            </ul>
          </div>
          {curso?.requisitos?.length > 0 && (
            <div className={styles.caixa}>
              <h3>Requisitos do {curso.sigla || 'curso'}</h3>
              <ul>
                {curso.requisitos.map((r) => <li key={r}>{r}</li>)}
              </ul>
            </div>
          )}
          <p className={styles.duvidas}>Dúvidas? <Link to="/Contactos#formulario">Contacte a Secretaria Académica</Link>.</p>
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
        <button type="button" onClick={onEditar}><FaPen aria-hidden="true" /> Editar</button>
      </header>
      <dl>{children}</dl>
    </section>
  )
}

function Linha({ rotulo, valor }) {
  return <div><dt>{rotulo}</dt><dd>{valor || '—'}</dd></div>
}

export default Candidatura
