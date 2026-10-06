
import styles from './HeroSection.module.css'
import { useState } from 'react'




function HeroSection(){
    const [form, setForm] = useState({
    nome: '', email: '', telefone: '', curso: ''
  })

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  function handleSubmit(e) {
    e.preventDefault()
    console.log(form)
  }

   
     return (
      
         <section className={styles.heroSection}>
      <div className={styles.container}>

        <div className={styles.conteudoTexto}>
          <h1>Formar quem defende Angola, desde o primeiro dia.</h1>
          <p>Conheça os cursos e programas da Escola Superior de Guerra e candidate-se ao próximo ano letivo.</p>
          <a href="#candidatura" className={styles.ctaMobile}>Candidatar-me agora</a>
          <div className={styles.metricas}>
            <div className={styles.item}>
              <span>+10 anos</span>
              <small>De existência</small>
            </div>
            <div className={styles.item}>
              <span>+500</span>
              <small>Oficiais formados</small>
            </div>
          </div>
        </div>

        <div className={styles.candidaturaCard} id="candidatura">
          <h3>Candidate-se a um curso</h3>
          <p>Preencha os seus dados e entraremos em contacto.</p>

          <form onSubmit={handleSubmit}>
            <input type="text" name="nome" placeholder="Nome completo" value={form.nome} onChange={handleChange} required />
            <input type="email" name="email" placeholder="Seu e-mail" value={form.email} onChange={handleChange} required />
            <input type="tel" name="telefone" placeholder="Telefone / contacto" value={form.telefone} onChange={handleChange} required />
            <select name="curso" value={form.curso} onChange={handleChange} required>
              <option value="" disabled>Curso pretendido</option>
              <option value="curso-1">Curso de Estado-Maior</option>
              <option value="curso-2">Curso de Promoção a Oficial General</option>
              <option value="curso-3">Curso de Altos Estudos Militares</option>
            </select>
            <button type="submit">Enviar candidatura</button>
          </form>
        </div>

      </div>
    </section>
     
     )
}

export default HeroSection