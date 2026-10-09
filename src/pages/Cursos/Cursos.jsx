import { Link } from 'react-router-dom'
import CabecalhoEditorial from '../../components/CabecalhoEditorial/CabecalhoEditorial'
import cursos, { calendarioAdmissao, processoAdmissao, totalHoras } from '../../data/cursos'
import { pessoaPorId } from '../../data/pessoas'
import ed from '../../styles/editorial.module.css'
import styles from './Cursos.module.css'

function Cursos() {
  return (
    <main className={ed.pagina}>
      <CabecalhoEditorial
        topo={['Formação superior militar', 'Ano académico 2027']}
        sobretitulo="Formação"
        titulo="Cursos"
        entrada="Três programas de formação superior para cada etapa da carreira de oficial — do estado-maior ao comando ao mais alto nível."
      />

      {/* Faixa de candidaturas */}
      <div className={styles.faixa}>
        <div className={styles.faixaInterior}>
          <span className={styles.faixaSelo}>Candidaturas abertas</span>
          <p>
            Ano académico 2027 · prazo até <strong>{calendarioAdmissao[1].periodo}</strong>
          </p>
          <a href="#calendario" className={styles.faixaLigacao}>Ver calendário</a>
        </div>
      </div>

      {/* Os cursos */}
      <section className={ed.largura} aria-label="Cursos disponíveis">
        {cursos.map((c, i) => (
          <article key={c.id} className={`${styles.curso} ${i % 2 ? styles.cursoInvertido : ''}`}>
            <Link to={`/Cursos/${c.id}`} className={styles.cursoFoto} tabIndex={-1} aria-hidden="true">
              <img src={c.imagem} alt="" />
              <span className={styles.cursoSigla}>{c.sigla}</span>
            </Link>

            <div className={styles.cursoTexto}>
              <span className={styles.cursoNumero}>{String(i + 1).padStart(2, '0')}</span>
              <h2><Link to={`/Cursos/${c.id}`}>{c.nome}</Link></h2>
              <p className={styles.cursoResumo}>{c.resumo}</p>

              <dl className={styles.ficha}>
                <div><dt>Duração</dt><dd>{c.duracao}</dd></div>
                <div><dt>Regime</dt><dd>{c.regime}</dd></div>
                <div><dt>Vagas</dt><dd>{c.vagas}</dd></div>
                <div><dt>Destinatários</dt><dd>{c.destinatarios}</dd></div>
              </dl>

              <Link to={`/Cursos/${c.id}`} className={ed.ligacao}>Conhecer o curso</Link>
            </div>
          </article>
        ))}
      </section>

      {/* Comparação */}
      <section className={`${ed.largura} ${styles.bloco}`}>
        <div className={ed.tituloSeccao}>
          <span className={ed.numeroSeccao} aria-hidden="true">A</span>
          <div>
            <span className={ed.rotulo}>Comparar</span>
            <h2>Os três cursos lado a lado.</h2>
          </div>
        </div>

        <div className={styles.tabelaRolavel}>
          <table className={`${ed.tabela} ${styles.comparacao}`}>
            <thead>
              <tr>
                <th scope="col"><span className="sr-only">Característica</span></th>
                {cursos.map((c) => (
                  <th key={c.id} scope="col">
                    <Link to={`/Cursos/${c.id}`}>{c.sigla}</Link>
                    <span>{c.nome}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr><th scope="row">Duração</th>{cursos.map((c) => <td key={c.id}>{c.duracao}</td>)}</tr>
              <tr><th scope="row">Regime</th>{cursos.map((c) => <td key={c.id}>{c.regime}</td>)}</tr>
              <tr><th scope="row">Vagas</th>{cursos.map((c) => <td key={c.id}>{c.vagas}</td>)}</tr>
              <tr><th scope="row">Destinatários</th>{cursos.map((c) => <td key={c.id}>{c.destinatarios}</td>)}</tr>
              <tr><th scope="row">Carga horária</th>{cursos.map((c) => <td key={c.id}>{totalHoras(c)} horas</td>)}</tr>
              <tr><th scope="row">Coordenação</th>{cursos.map((c) => <td key={c.id}>{pessoaPorId(c.coordenador)?.nome}</td>)}</tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Admissão */}
      <section id="admissao" className={`${ed.largura} ${styles.bloco}`}>
        <div className={ed.tituloSeccao}>
          <span className={ed.numeroSeccao} aria-hidden="true">B</span>
          <div>
            <span className={ed.rotulo}>Admissão</span>
            <h2>Como se candidatar.</h2>
          </div>
        </div>
        <ol className={ed.passos} style={{ '--colunas': processoAdmissao.length }}>
          {processoAdmissao.map((p, i) => (
            <li key={p.titulo}>
              <span className={ed.passoNumero}>{String(i + 1).padStart(2, '0')}</span>
              <h3>{p.titulo}</h3>
              <p>{p.texto}</p>
            </li>
          ))}
        </ol>
        <p className={styles.nota}>
          Os requisitos específicos de cada curso estão na respetiva página.
        </p>
      </section>

      {/* Calendário */}
      <section id="calendario" className={`${ed.largura} ${styles.bloco}`}>
        <div className={ed.tituloSeccao}>
          <span className={ed.numeroSeccao} aria-hidden="true">C</span>
          <div>
            <span className={ed.rotulo}>Calendário académico</span>
            <h2>Datas da admissão 2027.</h2>
          </div>
        </div>
        <div className={styles.calendario}>
          <table className={ed.tabela}>
            <thead>
              <tr><th scope="col">Fase</th><th scope="col">Data</th></tr>
            </thead>
            <tbody>
              {calendarioAdmissao.map((f) => (
                <tr key={f.fase}><th scope="row">{f.fase}</th><td>{f.periodo}</td></tr>
              ))}
            </tbody>
          </table>
          <aside className={styles.candidatar}>
            <span className={ed.rotulo}>Pronto para avançar?</span>
            <h3>Faça já a sua pré-candidatura.</h3>
            <p>Preencha o formulário e a Secretaria Académica entra em contacto com os próximos passos.</p>
            <Link to="/#candidatura" className={ed.botao}>Pré-candidatura</Link>
            <Link to="/Contactos#formulario" className={`${ed.botao} ${ed.botaoContorno}`}>Pedir informações</Link>
          </aside>
        </div>
      </section>
    </main>
  )
}

export default Cursos
