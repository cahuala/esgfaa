
import { useState, useEffect, useRef } from 'react'
import styles from './FormacaoDestaque.module.css'
import Curso1 from '../../assets/Curso1.png'
import Curso2 from '../../assets/Curso2.png'
import Curso3 from '../../assets/Curso3.png'

const cursos = [
  {
    id: 'estado-maior',
    nome: 'Curso de Estado-Maior',
    duracao: '2 anos',
    modalidade: 'Presencial',
    resumo: 'Prepara oficiais para funções de planeamento, comando e assessoria em estados-maiores das Forças Armadas.',
    plano: [
      'Estratégia e Planeamento Militar',
      'Liderança e Gestão de Recursos',
      'Direito Internacional e Humanitário',
      'Estágio prático em unidade operacional',
    ],
    midia: { tipo: 'imagem', src: Curso1 },
  },
  {
    id: 'oficial-general',
    nome: 'Curso de Promoção a Oficial General',
    duracao: '1 ano',
    modalidade: 'Presencial',
    resumo: 'Forma oficiais superiores para o exercício de funções de comando e direção ao mais alto nível.',
    plano: [
      'Segurança e Defesa Nacional',
      'Geopolítica e Relações Internacionais',
      'Gestão Estratégica de Instituições Militares',
      'Trabalho final de curso',
    ],
    midia: { tipo: 'imagem', src: Curso2 },
  },
  {
    id: 'altos-estudos',
    nome: 'Curso de Altos Estudos Militares',
    duracao: '18 meses',
    modalidade: 'Presencial',
    resumo: 'Aprofunda a formação doutrinária e científica de quadros destinados a funções de topo institucional.',
    plano: [
      'Doutrina Militar Avançada',
      'Investigação Científica Aplicada',
      'Cooperação e Diplomacia de Defesa',
      'Dissertação final',
    ],
    midia: { tipo: 'imagem', src: Curso3 },
  },
]

const INTERVALO_MS = 7000

function FormacaoDestaque() {
  const [indiceAtivo, setIndiceAtivo] = useState(0)
  const timerRef = useRef(null)
  const curso = cursos[indiceAtivo]

  function iniciarAutoRotacao() {
    clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setIndiceAtivo((atual) => (atual + 1) % cursos.length)
    }, INTERVALO_MS)
  }

  useEffect(() => {
    iniciarAutoRotacao()
    return () => clearInterval(timerRef.current)
  }, [])

  function handleClickAba(index) {
    setIndiceAtivo(index)
    iniciarAutoRotacao() // reinicia a contagem para não trocar logo a seguir ao clique manual
  }

  return (
    <section className={styles.secao}>
      <div className={styles.cabecalho}>
        <span className={styles.etiqueta}>Formação e Cursos</span>
        <h2>Da admissão à graduação, formamos quem vai comandar.</h2>
        <p>Programas académicos estruturados para cada etapa da carreira militar — do planeamento estratégico à liderança institucional.</p>
      </div>

      <div className={styles.corpo}>
        <div className={styles.listaAbas}>
          {cursos.map((c, index) => (
            <button
              key={c.id}
              className={`${styles.aba} ${indiceAtivo === index ? styles.abaAtiva : ''}`}
              onClick={() => handleClickAba(index)}
            >
              {c.nome}
              {indiceAtivo === index && (
                <span className={styles.progresso} key={indiceAtivo}>
                  <span className={styles.progressoBarra} />
                </span>
              )}
            </button>
          ))}
        </div>

        <div className={styles.painel}>
          <div className={styles.painelMidia}>
            {curso.midia.tipo === 'video' ? (
              <video
                key={curso.id}
                src={curso.midia.src}
                autoPlay
                muted
                loop
                playsInline
                className={styles.midiaFundo}
              />
            ) : (
              <img
                key={curso.id}
                src={curso.midia.src}
                alt={curso.nome}
                className={styles.midiaFundo}
              />
            )}
            <div className={styles.painelOverlay} />
          </div>

          <div className={styles.painelConteudo}>
            <div className={styles.painelInfo}>
              <span className={styles.tagInfo}>{curso.duracao}</span>
              <span className={styles.tagInfo}>{curso.modalidade}</span>
            </div>

            <h3>{curso.nome}</h3>
            <p className={styles.resumo}>{curso.resumo}</p>

            <span className={styles.subtitulo}>Plano curricular</span>
            <ul className={styles.plano}>
              {curso.plano.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>

            <button className={styles.cta}>Candidatar-me a este curso</button>
          </div>
        </div>
      </div>
    </section>
  )
}

export default FormacaoDestaque