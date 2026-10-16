import { Link } from 'react-router-dom'
import CabecalhoEditorial from '../../components/CabecalhoEditorial/CabecalhoEditorial'
import { totalHoras } from '../../data/cursos'
import { useConteudo } from '../../conteudo/contexto'
import { TituloSeccao } from '../../components/Corporativo/Corporativo'
import ed from '../../styles/editorial.module.css'
import styles from './Cursos.module.css'
import { t } from '../../i18n/linguas'

function Cursos() {
  const { cursos, paginas, pessoaPorId } = useConteudo()
  const pagina = paginas.cursos
  const calendarioAdmissao = pagina.calendario || []
  const processoAdmissao = pagina.processo || []
  const prazo = pagina.prazo || calendarioAdmissao[1]?.periodo

  return (
    <main className={ed.pagina}>
      <CabecalhoEditorial
        migalhas={[{ label: t('Cursos') }]}
        sobretitulo={t('Formação')}
        titulo={t('Cursos')}
        entrada={pagina.entrada}
      />

      {/* Faixa de candidaturas */}
      {pagina.candidaturasAbertas && (
      <div className={`contentor ${styles.faixa}`}>
        <div className={styles.faixaInterior}>
          <span className={styles.faixaSelo}>{t('Candidaturas abertas')}</span>
          <p>
            {t('Ano académico {ano}', { ano: pagina.anoAcademico })}{prazo && <> · {t('prazo até')} <strong>{prazo}</strong></>}
          </p>
          <a href="#calendario" className={styles.faixaLigacao}>{t('Ver calendário')}</a>
        </div>
      </div>
      )}

      {/* Os cursos */}
      <section className={`contentor ${styles.lista}`} aria-label={t('Cursos disponíveis')}>
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
                <div><dt>{t('Duração')}</dt><dd>{c.duracao}</dd></div>
                <div><dt>{t('Regime')}</dt><dd>{c.regime}</dd></div>
                <div><dt>{t('Vagas')}</dt><dd>{c.vagas}</dd></div>
                <div><dt>{t('Destinatários')}</dt><dd>{c.destinatarios}</dd></div>
              </dl>

              <Link to={`/Cursos/${c.id}`} className={ed.ligacao}>{t('Conhecer o curso')}</Link>
            </div>
          </article>
        ))}
      </section>

      {/* Comparação */}
      <section className={`contentor ${styles.bloco}`}>
        <TituloSeccao rotulo={t('Comparar')} titulo={t('Os cursos lado a lado')} />

        <div className={styles.tabelaRolavel}>
          <table className={`${ed.tabela} ${styles.comparacao}`}>
            <thead>
              <tr>
                <th scope="col"><span className="sr-only">{t('Característica')}</span></th>
                {cursos.map((c) => (
                  <th key={c.id} scope="col">
                    <Link to={`/Cursos/${c.id}`}>{c.sigla}</Link>
                    <span>{c.nome}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr><th scope="row">{t('Duração')}</th>{cursos.map((c) => <td key={c.id}>{c.duracao}</td>)}</tr>
              <tr><th scope="row">{t('Regime')}</th>{cursos.map((c) => <td key={c.id}>{c.regime}</td>)}</tr>
              <tr><th scope="row">{t('Vagas')}</th>{cursos.map((c) => <td key={c.id}>{c.vagas}</td>)}</tr>
              <tr><th scope="row">{t('Destinatários')}</th>{cursos.map((c) => <td key={c.id}>{c.destinatarios}</td>)}</tr>
              <tr><th scope="row">{t('Carga horária')}</th>{cursos.map((c) => <td key={c.id}>{t('{n} horas', { n: totalHoras(c) })}</td>)}</tr>
              <tr><th scope="row">{t('Coordenação')}</th>{cursos.map((c) => <td key={c.id}>{pessoaPorId(c.coordenador)?.nome}</td>)}</tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Admissão */}
      <section id="admissao" className={`contentor ${styles.bloco}`}>
        <TituloSeccao rotulo={t('Admissão')} titulo={t('Como se candidatar')} />
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
          {t('Os requisitos específicos de cada curso estão na respetiva página.')}
        </p>
      </section>

      {/* Calendário */}
      <section id="calendario" className={`contentor ${styles.bloco}`}>
        <TituloSeccao rotulo={t('Calendário académico')} titulo={t('Datas da admissão {ano}', { ano: pagina.anoAcademico })} />
        <div className={styles.calendario}>
          <table className={ed.tabela}>
            <thead>
              <tr><th scope="col">{t('Fase')}</th><th scope="col">{t('Data')}</th></tr>
            </thead>
            <tbody>
              {calendarioAdmissao.map((f) => (
                <tr key={f.fase}><th scope="row">{f.fase}</th><td>{f.periodo}</td></tr>
              ))}
            </tbody>
          </table>
          <aside className={styles.candidatar}>
            <h3>{t('Pronto para avançar?')}</h3>
            <p>{t('Preencha o formulário e a Secretaria Académica entra em contacto com os próximos passos.')}</p>
            <Link to="/Candidatura" className={ed.botao}>{t('Candidatar-me')}</Link>
            <Link to="/Contactos#formulario" className={`${ed.botao} ${ed.botaoContorno}`}>{t('Pedir informações')}</Link>
          </aside>
        </div>
      </section>
    </main>
  )
}

export default Cursos
