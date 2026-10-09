import { useState } from 'react'
import { FaFacebookF, FaInstagram, FaLinkedinIn, FaYoutube, FaCheck, FaMapMarkerAlt } from 'react-icons/fa'
import CabecalhoEditorial from '../../components/CabecalhoEditorial/CabecalhoEditorial'
import FAQ from '../../components/FAQ/Faq'
import { useConteudo } from '../../conteudo/contexto'
import ed from '../../styles/editorial.module.css'
import styles from './Contactos.module.css'

const VAZIO = { nome: '', email: '', telefone: '', assunto: '', mensagem: '', consentimento: false }

function Contactos() {
  const contactos = useConteudo().paginas.contactos
  const [form, setForm] = useState(VAZIO)
  const [enviado, setEnviado] = useState(false)

  function handleChange(e) {
    const { name, value, type, checked } = e.target
    setForm({ ...form, [name]: type === 'checkbox' ? checked : value })
  }

  function handleSubmit(e) {
    e.preventDefault()
    // TODO: ligar a um serviço de envio (backend próprio, Formspree, EmailJS…)
    console.log(form)
    setEnviado(true)
  }

  function novaMensagem() {
    setForm(VAZIO)
    setEnviado(false)
  }

  return (
    <main className={ed.pagina}>
      <CabecalhoEditorial
        sobretitulo="Contactos"
        titulo="Fale connosco"
        entrada="Candidaturas, pedidos de informação, imprensa ou cooperação — a nossa equipa responde no prazo de dois dias úteis."
      />

      <dl className={ed.factos}>
        <div>
          <dt>Telefone</dt>
          <dd>{contactos.telefones.map((t) => <a key={t} href={`tel:${t.replace(/\s/g, '')}`} className={styles.factoLigacao}>{t}</a>)}</dd>
        </div>
        <div>
          <dt>E-mail geral</dt>
          <dd><a href={`mailto:${contactos.email}`} className={styles.factoLigacao}>{contactos.email}</a></dd>
        </div>
        <div>
          <dt>Atendimento</dt>
          <dd>{contactos.horario.map((h) => <span key={h.dias} className={styles.factoLinha}>{h.dias} <small>{h.horas}</small></span>)}</dd>
        </div>
        <div>
          <dt>Morada</dt>
          <dd>{contactos.morada.map((l) => <span key={l} className={styles.factoLinha}>{l}</span>)}</dd>
        </div>
      </dl>

      <div className={styles.grelha}>
        {/* Formulário */}
        <section id="formulario" className={styles.formularioCaixa}>
          <div className={ed.tituloSeccao}>
            <span className={ed.numeroSeccao} aria-hidden="true">01</span>
            <div>
              <span className={ed.rotulo}>Formulário de contacto</span>
              <h2>Envie-nos uma mensagem.</h2>
            </div>
          </div>

          {enviado ? (
            <div className={styles.sucesso} role="status">
              <span className={styles.sucessoIcone}><FaCheck /></span>
              <h3>Mensagem enviada</h3>
              <p>
                Obrigado, {form.nome.split(' ')[0]}. Vamos responder para <strong>{form.email}</strong> sobre
                “{form.assunto}” com a maior brevidade possível.
              </p>
              <button className={`${ed.botao} ${ed.botaoContorno}`} onClick={novaMensagem}>Enviar outra mensagem</button>
            </div>
          ) : (
            <form className={styles.formulario} onSubmit={handleSubmit}>
              <fieldset className={styles.assuntos}>
                <legend><span>A</span> Assunto</legend>
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
                  <span><b>B</b> Nome completo</span>
                  <input type="text" name="nome" value={form.nome} onChange={handleChange} autoComplete="name" required />
                </label>
                <label className={styles.campo}>
                  <span><b>C</b> E-mail</span>
                  <input type="email" name="email" value={form.email} onChange={handleChange} autoComplete="email" required />
                </label>
                <label className={styles.campo}>
                  <span><b>D</b> Telefone <em>(opcional)</em></span>
                  <input type="tel" name="telefone" value={form.telefone} onChange={handleChange} autoComplete="tel" />
                </label>
              </div>

              <label className={`${styles.campo} ${styles.campoMensagem}`}>
                <span><b>E</b> Mensagem</span>
                <textarea name="mensagem" rows={6} value={form.mensagem} onChange={handleChange} required />
              </label>

              <div className={styles.enviarLinha}>
                <label className={styles.consentimento}>
                  <input type="checkbox" name="consentimento" checked={form.consentimento} onChange={handleChange} required />
                  <span>Autorizo a utilização dos meus dados apenas para responder a este pedido.</span>
                </label>
                <button type="submit" className={ed.botao}>Enviar mensagem</button>
              </div>
            </form>
          )}
        </section>

        {/* Diretório */}
        <section className={styles.diretorio}>
          <div className={ed.tituloSeccao}>
            <span className={ed.numeroSeccao} aria-hidden="true">02</span>
            <div>
              <span className={ed.rotulo}>Diretório</span>
              <h2>Contactos por área.</h2>
            </div>
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
            <span className={ed.rotulo}>Redes sociais</span>
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
      <section className={styles.mapa} aria-label="Localização">
        <iframe
          title="Localização da Escola Superior de Guerra"
          src={`https://maps.google.com/maps?q=${encodeURIComponent(contactos.mapa)}&z=15&output=embed`}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
        <div className={styles.mapaCartao}>
          <span className={ed.rotulo}><FaMapMarkerAlt aria-hidden="true" /> Como chegar</span>
          {contactos.morada.map((l) => <p key={l}>{l}</p>)}
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(contactos.mapa)}`}
            target="_blank"
            rel="noopener noreferrer"
            className={ed.ligacao}
          >
            Abrir no Google Maps
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
