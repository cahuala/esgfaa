
import styles from './HeroSection.module.css'
import { useState } from 'react'
import { useConteudo } from '../../conteudo/contexto'




function HeroSection(){
    const { cursos, paginas } = useConteudo()
    const hero = paginas.home.hero
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
      
         <section
           className={styles.heroSection}
           style={hero.imagem ? { backgroundImage: `linear-gradient(to top, rgba(10, 5, 3, 0.97) 0%, rgba(10, 5, 3, 0.8) 45%, rgba(10, 5, 3, 0.55) 100%), url("${hero.imagem}")` } : undefined}
         >
      <div className={styles.container}>

        <div className={styles.conteudoTexto}>
          <h1>{hero.titulo}</h1>
          <p>{hero.texto}</p>
          <a href="#candidatura" className={styles.ctaMobile}>Candidatar-me agora</a>
          <div className={styles.metricas}>
            {hero.metricas.map((m) => (
              <div className={styles.item} key={m.legenda}>
                <span>{m.valor}</span>
                <small>{m.legenda}</small>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.candidaturaCard} id="candidatura">
          <h3>{hero.formularioTitulo}</h3>
          <p>{hero.formularioTexto}</p>

          <form onSubmit={handleSubmit}>
            <input type="text" name="nome" placeholder="Nome completo" value={form.nome} onChange={handleChange} required />
            <input type="email" name="email" placeholder="Seu e-mail" value={form.email} onChange={handleChange} required />
            <input type="tel" name="telefone" placeholder="Telefone / contacto" value={form.telefone} onChange={handleChange} required />
            <select name="curso" value={form.curso} onChange={handleChange} required>
              <option value="" disabled>Curso pretendido</option>
              {cursos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
            <button type="submit">Enviar candidatura</button>
          </form>
        </div>

      </div>
    </section>
     
     )
}

export default HeroSection