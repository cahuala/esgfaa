import { useState } from 'react'
import { FaMapMarkerAlt, FaPhoneAlt, FaEnvelope, FaRegClock, FaFacebookF, FaInstagram, FaLinkedinIn, FaYoutube, FaCheck } from 'react-icons/fa'
import CabecalhoPagina from '../../components/CabecalhoPagina/CabecalhoPagina'
import FAQ from '../../components/FAQ/Faq'
import contactos from '../../data/contactos'
import Imagem from '../../assets/Curso1.png'
import pagina from '../../styles/pagina.module.css'
import styles from './Contactos.module.css'

const VAZIO = { nome: '', email: '', telefone: '', assunto: '', mensagem: '', consentimento: false }

function Contactos() {
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

  const cartoes = [
    { icone: <FaMapMarkerAlt />, titulo: 'Morada', linhas: contactos.morada },
    {
      icone: <FaPhoneAlt />,
      titulo: 'Telefone',
      linhas: contactos.telefones.map((t) => <a key={t} href={`tel:${t.replace(/\s/g, '')}`}>{t}</a>),
    },
    {
      icone: <FaEnvelope />,
      titulo: 'E-mail',
      linhas: [<a key="email" href={`mailto:${contactos.email}`}>{contactos.email}</a>],
    },
    {
      icone: <FaRegClock />,
      titulo: 'Horário de atendimento',
      linhas: contactos.horario.map((h) => <span key={h.dias}>{h.dias}: <strong>{h.horas}</strong></span>),
    },
  ]

  return (
    <main>
      <CabecalhoPagina
        etiqueta="Contactos"
        titulo="Fale connosco."
        descricao="Candidaturas, pedidos de informação, imprensa ou cooperação — a nossa equipa responde no prazo de dois dias úteis."
        imagem={Imagem}
        migalhas={[{ label: 'Contactos' }]}
      />

      <section className={pagina.secao}>
        <div className={pagina.container}>
          <ul className={styles.cartoes}>
            {cartoes.map((c) => (
              <li key={c.titulo} className={styles.cartao}>
                <span className={styles.icone} aria-hidden="true">{c.icone}</span>
                <h3>{c.titulo}</h3>
                {c.linhas.map((l, i) => <p key={i}>{l}</p>)}
              </li>
            ))}
          </ul>

          <div className={styles.grelha}>
            <div id="formulario" className={styles.formularioCaixa}>
              <span className={pagina.etiqueta}>Formulário de contacto</span>
              <h2 className={pagina.tituloSecao}>Envie-nos uma mensagem</h2>

              {enviado ? (
                <div className={styles.sucesso} role="status">
                  <span className={styles.sucessoIcone}><FaCheck /></span>
                  <h3>Mensagem enviada</h3>
                  <p>Obrigado, {form.nome.split(' ')[0]}. Vamos responder para <strong>{form.email}</strong> com a maior brevidade possível.</p>
                  <button className={`${pagina.botao} ${pagina.botaoSecundario}`} onClick={novaMensagem}>
                    Enviar outra mensagem
                  </button>
                </div>
              ) : (
                <form className={styles.formulario} onSubmit={handleSubmit}>
                  <div className={styles.linhaCampos}>
                    <label className={styles.campo}>
                      <span>Nome completo</span>
                      <input type="text" name="nome" value={form.nome} onChange={handleChange} autoComplete="name" required />
                    </label>
                    <label className={styles.campo}>
                      <span>E-mail</span>
                      <input type="email" name="email" value={form.email} onChange={handleChange} autoComplete="email" required />
                    </label>
                  </div>

                  <div className={styles.linhaCampos}>
                    <label className={styles.campo}>
                      <span>Telefone <em>(opcional)</em></span>
                      <input type="tel" name="telefone" value={form.telefone} onChange={handleChange} autoComplete="tel" />
                    </label>
                    <label className={styles.campo}>
                      <span>Assunto</span>
                      <select name="assunto" value={form.assunto} onChange={handleChange} required>
                        <option value="" disabled>Escolha um assunto</option>
                        {contactos.assuntos.map((a) => <option key={a} value={a}>{a}</option>)}
                      </select>
                    </label>
                  </div>

                  <label className={styles.campo}>
                    <span>Mensagem</span>
                    <textarea name="mensagem" rows={6} value={form.mensagem} onChange={handleChange} required />
                  </label>

                  <label className={styles.consentimento}>
                    <input type="checkbox" name="consentimento" checked={form.consentimento} onChange={handleChange} required />
                    <span>Autorizo a utilização dos meus dados apenas para responder a este pedido.</span>
                  </label>

                  <button type="submit" className={`${pagina.botao} ${styles.enviar}`}>Enviar mensagem</button>
                </form>
              )}
            </div>

            <div className={styles.lateral}>
              <div className={styles.mapa}>
                <iframe
                  title="Localização da Escola Superior de Guerra"
                  src={`https://maps.google.com/maps?q=${encodeURIComponent(contactos.mapa)}&z=15&output=embed`}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>

              <div className={pagina.cartaoLateral}>
                <h4>Contactos por área</h4>
                <ul className={styles.departamentos}>
                  {contactos.departamentos.map((d) => (
                    <li key={d.nome}>
                      <strong>{d.nome}</strong>
                      <span>{d.descricao}</span>
                      <a href={`mailto:${d.email}`}>{d.email}</a>
                    </li>
                  ))}
                </ul>
              </div>

              <div className={`${pagina.cartaoLateral} ${styles.redesCaixa}`}>
                <h4>Siga a Escola</h4>
                <div className={styles.redes}>
                  <a href="#" aria-label="Facebook"><FaFacebookF /></a>
                  <a href="#" aria-label="Instagram"><FaInstagram /></a>
                  <a href="#" aria-label="LinkedIn"><FaLinkedinIn /></a>
                  <a href="#" aria-label="YouTube"><FaYoutube /></a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div id="faq" className={styles.faq}>
        <FAQ />
      </div>
    </main>
  )
}

export default Contactos
