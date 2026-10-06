
import { useState } from 'react'
import styles from './Faq.module.css'

const perguntas = [
  {
    id: 1,
    pergunta: 'Como posso candidatar-me a um curso?',
    resposta: 'As candidaturas são feitas através do formulário disponível na página inicial ou na secção de Cursos, durante o período de admissões anunciado no calendário académico. Após o envio, a nossa equipa entra em contacto com os próximos passos.',
  },
  {
    id: 2,
    pergunta: 'Quais são os requisitos de admissão?',
    resposta: 'Os requisitos variam consoante o curso pretendido — normalmente incluem posto militar mínimo, habilitações académicas e tempo de serviço. Consulte a página de cada curso, na secção "Requisitos de admissão", para os critérios específicos.',
  },
  {
    id: 3,
    pergunta: 'Como aceder a documentos públicos da Escola?',
    resposta: 'Todos os documentos de acesso público — regulamentos, editais, relatórios e publicações — estão disponíveis na secção "Publicações e Documentos", com pesquisa por categoria, ano e tipo de documento.',
  },
  {
    id: 4,
    pergunta: 'Como contactar um departamento específico?',
    resposta: 'Na página de Contactos encontra os meios de contacto gerais da Escola. Para departamentos específicos, consulte a secção "Organização e Estrutura" em Institucional, onde estão listados os responsáveis de cada área.',
  },
  {
    id: 5,
    pergunta: 'A Escola oferece programas de cooperação internacional?',
    resposta: 'Sim. A Escola mantém acordos de cooperação com instituições militares parceiras, incluindo intercâmbio de docentes, alunos e projetos conjuntos de investigação. Mais informação na secção de Cooperação Internacional.',
  },
  {
    id: 6,
    pergunta: 'Onde posso consultar o calendário académico?',
    resposta: 'O calendário com o início e fim dos cursos, períodos letivos, exames e outros eventos institucionais está disponível na Agenda Académica, acessível a partir do menu principal.',
  },
]

function Faq() {
  const [abertaId, setAbertaId] = useState(null)

  function alternar(id) {
    setAbertaId((atual) => (atual === id ? null : id))
  }

  return (
    <section className={styles.secao}>
      <div className={styles.container}>
        <div className={styles.cabecalho}>
          <span className={styles.etiqueta}>Dúvidas frequentes</span>
          <h2>Perguntas frequentes</h2>
        </div>

        <div className={styles.lista}>
          {perguntas.map((p) => {
            const aberta = abertaId === p.id
            return (
              <div className={`${styles.item} ${aberta ? styles.itemAberto : ''}`} key={p.id}>
                <button
                  className={styles.pergunta}
                  onClick={() => alternar(p.id)}
                  aria-expanded={aberta}
                >
                  <span>{p.pergunta}</span>
                  <span className={styles.icone} aria-hidden="true">
                    <span className={styles.linhaH} />
                    <span className={styles.linhaV} />
                  </span>
                </button>

                <div className={styles.respostaWrapper}>
                  <p className={styles.resposta}>{p.resposta}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export default Faq