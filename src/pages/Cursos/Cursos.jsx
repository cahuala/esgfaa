import { Link } from 'react-router-dom'
import CabecalhoEditorial from '../../components/CabecalhoEditorial/CabecalhoEditorial'
import { totalHoras } from '../../data/cursos'
import { useConteudo } from '../../conteudo/contexto'
import { TituloSeccao } from '../../components/Corporativo/Corporativo'
import ed from '../../styles/editorial.module.css'
import styles from './Cursos.module.css'

function Cursos() {
  const { cursos, paginas, pessoaPorId } = useConteudo()
  const pagina = paginas.cursos
  const calendarioAdmissao = pagina.calendario || []
  const processoAdmissao = pagina.processo || []
  const prazo = pagina.prazo || calendarioAdmissao[1]?.periodo

  return (
    <main className={ed.pagina}>
      <CabecalhoEditorial
        migalhas={[{ label: 'Cursos' }]}
        sobretitulo="Formação"
        titulo="Cursos"
        entrada={pagina.entrada}
      />

      {/* Faixa de candidaturas */}
      {pagina.candidaturasAbertas && (
      <div className={`contentor ${styles.faixa}`}>
        <div className={styles.faixaInterior}>
          <span className={styles.faixaSelo}>Candidaturas abertas</span>
          <p>
            Ano académico {pagina.anoAcademico}{prazo && <> · prazo até <strong>{prazo}</strong></>}
          </p>
          <a href="#calendario" className={styles.faixaLigacao}>Ver calendário</a>
        </div>
      </div>
      )}

      {/* Os cursos */}
      <section className={`contentor ${styles.lista}`} aria-label="Cursos disponíveis">
        {cursos.map((c, i) => (
          <article key={c.id} className={`${styles.curso} ${i % 2 ? styles.cursoInvertido : ''}`}>
            <Link to={`/Cursos/${c.id}`} className={styles.cursoFoto} tabIndex={-1} aria-hidden="true">
              <img src={c.imagem} alt="" />
              <span className={styles.cursoSigla}>{c.sigla}</span>
            </Link>

            <div className={styles.cursoTexto}>
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
      <section className={`contentor ${styles.bloco}`}>
        <TituloSeccao rotulo="Comparar" titulo="Os cursos lado a lado" />

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
      <section id="admissao" className={`contentor ${styles.bloco}`}>
        <TituloSeccao rotulo="Admissão" titulo="Como se candidatar" />
        <ol className={ed.passos} style={{ '--colunas': processoAdmissao.length }}>
          {processoAdmissao.map((p, i) => (
            <li key={p.titulo}>
              <span className={ed.passoNumero}>{i + 1}</span>
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
      <section id="calendario" className={`contentor ${styles.bloco}`}>
        <TituloSeccao rotulo="Calendário académico" titulo={`Datas da admissão ${pagina.anoAcademico}`} />
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
            <h3>Faça já a sua pré-candidatura</h3>
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
