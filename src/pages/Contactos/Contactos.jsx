import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FaFacebookF, FaInstagram, FaLinkedinIn, FaYoutube, FaCheck, FaMapMarkerAlt } from 'react-icons/fa'
import CabecalhoEditorial from '../../components/CabecalhoEditorial/CabecalhoEditorial'
import FAQ from '../../components/FAQ/Faq'
import { useConteudo } from '../../conteudo/contexto'
import ed from '../../styles/editorial.module.css'
import styles from './Contactos.module.css'
import { t } from '../../i18n/linguas'
import { API_URL, pedido } from '../../conteudo/api'

const VAZIO = { nome: '', email: '', telefone: '', assunto: '', mensagem: '', consentimento: false, website: '' }

function Contactos() {
  const contactos = useConteudo().paginas.contactos
  const [form, setForm] = useState(VAZIO)
  const [enviado, setEnviado] = useState(false) // false | 'servidor' | 'email'
  const [aEnviar, setAEnviar] = useState(false)
  const [erro, setErro] = useState('')

  function handleChange(e) {
    const { name, value, type, checked } = e.target
    setForm({ ...form, [name]: type === 'checkbox' ? checked : value })
  }

  // a mensagem vai para o painel (Mensagens do site); sem servidor, abre o programa de e-mail com ela escrita
  async function handleSubmit(e) {
    e.preventDefault()
    setErro('')
    if (!API_URL) {
      const corpo = `${form.mensagem}\n\n${form.nome}${form.telefone ? ` · ${form.telefone}` : ''}\n${form.email}`
      window.location.href = `mailto:${contactos.email}?subject=${encodeURIComponent(form.assunto)}&body=${encodeURIComponent(corpo)}`
      setEnviado('email')
      return
    }
    setAEnviar(true)
    try {
      await pedido('/api/publico/contactos', { method: 'POST', body: JSON.stringify(form) })
      setEnviado('servidor')
    } catch (falha) {
      setErro(falha.estado ? t(falha.message) : t('Não foi possível enviar agora. Tente de novo ou escreva para {email}.', { email: contactos.email }))
    } finally {
      setAEnviar(false)
    }
  }

  function novaMensagem() {
    setForm(VAZIO)
    setEnviado(false)
  }

  return (
    <main className={ed.pagina}>
      <CabecalhoEditorial
        migalhas={[{ label: t('Contactos') }]}
        sobretitulo={t('Contactos')}
        titulo={t('Fale connosco')}
        entrada={t('Pedidos de informação, imprensa ou cooperação — a nossa equipa responde no prazo de dois dias úteis.')}
      />

      <dl className={ed.factos}>
        <div>
          <dt>{t('Telefone')}</dt>
          <dd>{contactos.telefones.map((tel) => <a key={tel} href={`tel:${tel.replace(/\s/g, '')}`} className={styles.factoLigacao}>{tel}</a>)}</dd>
        </div>
        <div>
          <dt>{t('E-mail geral')}</dt>
          <dd><a href={`mailto:${contactos.email}`} className={styles.factoLigacao}>{contactos.email}</a></dd>
        </div>
        <div>
          <dt>{t('Atendimento')}</dt>
          <dd>{contactos.horario.map((h) => <span key={h.dias} className={styles.factoLinha}>{h.dias} <small>{h.horas}</small></span>)}</dd>
        </div>
        <div>
          <dt>{t('Morada')}</dt>
          <dd>{contactos.morada.map((l) => <span key={l} className={styles.factoLinha}>{l}</span>)}</dd>
        </div>
      </dl>

      <div className={`contentor ${styles.grelha}`}>
        {/* Formulário */}
        <section id="formulario" className={styles.formularioCaixa}>
          <div className={ed.tituloSeccao}>
            <span className={ed.rotulo}>{t('Formulário de contacto')}</span>
            <h2>{t('Envie-nos uma mensagem')}</h2>
          </div>

          {enviado ? (
            <div className={styles.sucesso} role="status">
              <span className={styles.sucessoIcone}><FaCheck /></span>
              <h3>{t('Mensagem enviada')}</h3>
              <p>{enviado === 'email'
                ? t('Abrimos o seu programa de e-mail com a mensagem já escrita: só falta carregar em Enviar.')
                : t('Obrigado, {nome}. Vamos responder para {email} sobre “{assunto}” com a maior brevidade possível.', { nome: form.nome.split(' ')[0], email: form.email, assunto: form.assunto })}</p>
              <button className={`${ed.botao} ${ed.botaoContorno}`} onClick={novaMensagem}>{t('Enviar outra mensagem')}</button>
            </div>
          ) : (
            <form className={styles.formulario} onSubmit={handleSubmit}>
              <fieldset className={styles.assuntos}>
                <legend>{t('Assunto')}</legend>
                <div>
                  {contactos.assuntos.map((a) => (
                    <label key={a} className={form.assunto === a ? styles.assuntoAtivo : ''}>
                      <input type="radio" name="assunto" value={a} checked={form.assunto === a} onChange={handleChange} required />
                      {a}
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className={styles.campos}>
                <label className={styles.campo}>
                  <span>{t('Nome completo')}</span>
                  <input type="text" name="nome" value={form.nome} onChange={handleChange} autoComplete="name" required />
                </label>
                <label className={styles.campo}>
                  <span>{t('E-mail')}</span>
                  <input type="email" name="email" value={form.email} onChange={handleChange} autoComplete="email" required />
                </label>
                <label className={styles.campo}>
                  <span>{t('Telefone')} <em>({t('opcional')})</em></span>
                  <input type="tel" name="telefone" value={form.telefone} onChange={handleChange} autoComplete="tel" />
                </label>
              </div>

              <label className={`${styles.campo} ${styles.campoMensagem}`}>
                <span>{t('Mensagem')}</span>
                <textarea name="mensagem" rows={6} value={form.mensagem} onChange={handleChange} required />
              </label>

              {/* campo escondido: as pessoas não o veem; os robôs preenchem-no */}
              <input type="text" name="website" value={form.website} onChange={handleChange} tabIndex={-1} autoComplete="off" aria-hidden="true" className={styles.escondido} />
              {erro && <p className={styles.erro} role="alert">{erro}</p>}

              <div className={styles.enviarLinha}>
                <label className={styles.consentimento}>
                  <input type="checkbox" name="consentimento" checked={form.consentimento} onChange={handleChange} required />
                  <span>{t('Autorizo a utilização dos meus dados apenas para responder a este pedido.')} <Link to="/Privacidade">{t('Política de privacidade')}</Link></span>
                </label>
                <button type="submit" className={ed.botao} disabled={aEnviar}>{aEnviar ? t('A enviar…') : t('Enviar mensagem')}</button>
              </div>
            </form>
          )}
        </section>

        {/* Diretório */}
        <section className={styles.diretorio}>
          <div className={ed.tituloSeccao}>
            <span className={ed.rotulo}>{t('Diretório')}</span>
            <h2>{t('Contactos por área')}</h2>
          </div>

          <ul className={styles.areas}>
            {contactos.departamentos.map((d) => (
              <li key={d.nome}>
                <strong>{d.nome}</strong>
                <span>{d.descricao}</span>
                <a href={`mailto:${d.email}`}>{d.email}</a>
              </li>
            ))}
          </ul>

          <div className={styles.redes}>
            <h3>{t('Redes sociais')}</h3>
            <div>
              <a href="#" aria-label="Facebook"><FaFacebookF /></a>
              <a href="#" aria-label="Instagram"><FaInstagram /></a>
              <a href="#" aria-label="LinkedIn"><FaLinkedinIn /></a>
              <a href="#" aria-label="YouTube"><FaYoutube /></a>
            </div>
          </div>
        </section>
      </div>

      {/* Mapa */}
      <section className={`contentor ${styles.mapa}`} aria-label={t('Localização')}>
        <iframe
          title={t('Localização da Escola Superior de Guerra')}
          src={`https://maps.google.com/maps?q=${encodeURIComponent(contactos.mapa)}&z=15&output=embed`}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
        <div className={styles.mapaCartao}>
          <h3><FaMapMarkerAlt aria-hidden="true" /> {t('Como chegar')}</h3>
          {contactos.morada.map((l) => <p key={l}>{l}</p>)}
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(contactos.mapa)}`}
            target="_blank"
            rel="noopener noreferrer"
            className={ed.ligacao}
          >
            {t('Abrir no Google Maps')}
          </a>
        </div>
      </section>

      <div id="faq" className={styles.faq}>
        <FAQ />
      </div>
    </main>
  )
}

export default Contactos
