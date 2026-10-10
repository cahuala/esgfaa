import { useState } from 'react'
import { FaArrowRight } from 'react-icons/fa'
import { useConteudo } from '../../conteudo/contexto'
import styles from './HeroSection.module.css'

// Abertura da página inicial: fotografia escura, título, números e pedido de informação
function HeroSection() {
  const { cursos, paginas } = useConteudo()
  const hero = paginas.home.hero
  const [form, setForm] = useState({ nome: '', email: '', telefone: '', curso: '' })

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  function handleSubmit(e) {
    e.preventDefault()
  }

  return (
    <section className={styles.hero} style={hero.imagem ? { backgroundImage: `url("${hero.imagem}")` } : undefined}>
      <div className={styles.sombra} />
      <div className={`contentor ${styles.grelha}`}>
        <div className={styles.texto}>
          <h1>{hero.titulo}</h1>
          <p>{hero.texto}</p>

          <div className={styles.metricas}>
            {hero.metricas.map((m) => (
              <div className={styles.metrica} key={m.legenda}>
                <strong>{m.valor}</strong>
                <span>{m.legenda}</span>
              </div>
            ))}
          </div>

          <a href="#candidatura" className={styles.mais}>
            <span><FaArrowRight size={12} aria-hidden="true" /></span>
            Candidatar-me a um curso
          </a>
        </div>

        <div className={styles.formulario} id="candidatura">
          <h2>{hero.formularioTitulo}</h2>
          <p>{hero.formularioTexto}</p>
          <form onSubmit={handleSubmit}>
            <label>
              <span>Nome completo</span>
              <input type="text" name="nome" value={form.nome} onChange={handleChange} autoComplete="name" required />
            </label>
            <label>
              <span>E-mail</span>
              <input type="email" name="email" value={form.email} onChange={handleChange} autoComplete="email" required />
            </label>
            <label>
              <span>Telefone</span>
              <input type="tel" name="telefone" value={form.telefone} onChange={handleChange} autoComplete="tel" required />
            </label>
            <label>
              <span>Curso pretendido</span>
              <select name="curso" value={form.curso} onChange={handleChange} required>
                <option value="" disabled>Escolha um curso</option>
                {cursos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </label>
            <button type="submit">Enviar pedido</button>
          </form>
        </div>
      </div>
    </section>
  )
}

export default HeroSection
