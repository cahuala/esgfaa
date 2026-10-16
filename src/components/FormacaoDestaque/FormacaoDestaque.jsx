import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useConteudo } from '../../conteudo/contexto'
import { Etiqueta, TituloSeccao } from '../Corporativo/Corporativo'
import styles from './FormacaoDestaque.module.css'
import { t } from '../../i18n/linguas'

const INTERVALO_MS = 7000

/*
  Cursos da Escola em separadores que avançam sozinhos (a barra mostra o tempo até ao seguinte).
  Um clique escolhe o curso e recomeça a contagem.
*/
function FormacaoDestaque() {
  const { cursos, paginas } = useConteudo()
  const textos = paginas.home.formacao
  const [ativo, setAtivo] = useState(0)
  const [ciclo, setCiclo] = useState(0) // muda a cada troca: reinicia a barra de progresso
  const total = useRef(cursos.length)

  useEffect(() => {
    total.current = cursos.length
  }, [cursos.length])

  useEffect(() => {
    if (cursos.length < 2) return undefined
    const id = setTimeout(() => {
      setAtivo((a) => (a + 1) % Math.max(1, total.current))
      setCiclo((c) => c + 1)
    }, INTERVALO_MS)
    return () => clearTimeout(id)
  }, [ativo, ciclo, cursos.length])

  function escolher(i) {
    setAtivo(i)
    setCiclo((c) => c + 1)
  }

  const curso = cursos[ativo % Math.max(1, cursos.length)]
  if (!curso) return null
  const unidades = (curso.plano || []).flatMap((p) => p.unidades).slice(0, 4)

  return (
    <section className="seccao">
      <div className="contentor">
        <TituloSeccao titulo={textos.titulo} texto={textos.texto} centrada />

        <div className={styles.corpo}>
          <div className={styles.abas} role="tablist" aria-label={t('Cursos')}>
            {cursos.map((c, i) => (
              <button
                key={c.id}
                role="tab"
                id={`aba-${c.id}`}
                aria-selected={i === ativo}
                aria-controls="painel-curso"
                className={`${styles.aba} ${i === ativo ? styles.abaAtiva : ''}`}
                onClick={() => escolher(i)}
              >
                <strong>{c.nome}</strong>
                <span>{[c.duracao, c.regime].filter(Boolean).join(' · ')}</span>
                {i === ativo && cursos.length > 1 && (
                  <span className={styles.progresso} aria-hidden="true">
                    <span
                      key={ciclo}
                      className={styles.progressoBarra}
                      style={{ animationDuration: `${INTERVALO_MS}ms` }}
                    />
                  </span>
                )}
              </button>
            ))}
          </div>

          <article id="painel-curso" role="tabpanel" aria-labelledby={`aba-${curso.id}`} className={styles.painel} key={curso.id}>
            <div className={styles.imagem}>{curso.imagem && <img src={curso.imagem} alt="" />}</div>
            <div className={styles.texto}>
              <div className={styles.etiquetas}>
                {curso.sigla && <Etiqueta cor="vermelho">{curso.sigla}</Etiqueta>}
                {curso.duracao && <Etiqueta cor="cinzento">{curso.duracao}</Etiqueta>}
                {curso.vagas && <Etiqueta cor="azul">{t('{n} vagas', { n: curso.vagas })}</Etiqueta>}
              </div>
              <h3>{curso.nome}</h3>
              <p>{curso.resumo}</p>
              {unidades.length > 0 && (
                <>
                  <span className={styles.subtitulo}>{t('Plano curricular')}</span>
                  <ul className={styles.plano}>
                    {unidades.map((u) => <li key={u.nome}>{u.nome}</li>)}
                  </ul>
                </>
              )}
              <Link to={`/Cursos/${curso.id}`} className={styles.ligacao}>{t('Conhecer o curso')} →</Link>
            </div>
          </article>
        </div>
      </div>
    </section>
  )
}

export default FormacaoDestaque
