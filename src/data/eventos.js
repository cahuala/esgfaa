import Auditorio from '../assets/Auditorio.png'
import Curso1 from '../assets/Curso1.png'
import Curso2 from '../assets/Curso2.png'
import Curso3 from '../assets/Curso3.png'
import Escola2 from '../assets/Escola2.jpeg'
import EscolaDeGuerra from '../assets/Escola De Guerra.png'

// `conteudo` usa os mesmos blocos das notícias (ver data/noticias.js)
const eventos = [
  {
    id: 'conferencia-seguranca-defesa-regional',
    data: '2026-10-08',
    horaInicio: '09:00',
    horaFim: '17:00',
    categoria: 'Conferência',
    titulo: 'Conferência sobre Segurança e Defesa Regional',
    local: 'Auditório principal da Escola',
    resumo: 'Um dia de painéis com especialistas nacionais e convidados de escolas militares parceiras.',
    capa: Auditorio,
    inscricoes: true,
    programa: [
      { hora: '09:00', atividade: 'Sessão de abertura' },
      { hora: '09:30', atividade: 'Painel 1 — Segurança marítima' },
      { hora: '11:30', atividade: 'Painel 2 — Cooperação em operações de paz' },
      { hora: '14:30', atividade: 'Painel 3 — Ameaças transnacionais' },
      { hora: '16:30', atividade: 'Conclusões e encerramento' },
    ],
    conteudo: [
      { tipo: 'paragrafo', texto: 'A conferência reúne especialistas em segurança e defesa para debater os principais desafios da região, com foco na cooperação entre forças armadas.' },
      { tipo: 'paragrafo', texto: 'A participação é aberta a oficiais, docentes, investigadores e convidados institucionais, mediante inscrição prévia.' },
    ],
  },
  {
    id: 'entrega-diplomas-estado-maior',
    data: '2026-10-15',
    horaInicio: '10:30',
    horaFim: '12:30',
    categoria: 'Cerimónia',
    titulo: 'Cerimónia de entrega de diplomas do Curso de Estado-Maior',
    local: 'Praça de armas da Escola',
    resumo: 'Entrega solene dos diplomas aos oficiais que concluíram o Curso de Estado-Maior.',
    capa: Curso2,
    programa: [
      { hora: '10:30', atividade: 'Chegada das entidades convidadas' },
      { hora: '11:00', atividade: 'Cerimónia militar e entrega de diplomas' },
      { hora: '12:00', atividade: 'Mensagem do Comandante da Escola' },
    ],
    conteudo: [
      { tipo: 'paragrafo', texto: 'A cerimónia assinala a conclusão do Curso de Estado-Maior e inclui a entrega de diplomas e a distinção dos melhores alunos.' },
      { tipo: 'destaque', texto: 'Os familiares dos formandos devem apresentar-se na entrada principal até às 10:15.' },
    ],
  },
  {
    id: 'seminario-investigacao-estrategia',
    data: '2026-10-22',
    horaInicio: '14:00',
    horaFim: '17:30',
    categoria: 'Seminário',
    titulo: 'Seminário de Investigação Científica em Estratégia Militar',
    local: 'Sala de conferências, Bloco B',
    resumo: 'Apresentação e discussão de projetos de investigação em curso no Departamento de Investigação.',
    capa: Curso3,
    inscricoes: true,
    conteudo: [
      { tipo: 'paragrafo', texto: 'O seminário apresenta os projetos de investigação em curso e abre espaço de debate entre investigadores, docentes e alunos.' },
    ],
  },
  {
    id: 'visita-delegacao-parceira',
    data: '2026-11-05',
    horaInicio: '09:30',
    horaFim: '13:00',
    categoria: 'Visita oficial',
    titulo: 'Visita de delegação de escola militar parceira',
    local: 'Instalações da Escola',
    resumo: 'Programa de trabalho com a direção e visita às instalações académicas.',
    capa: EscolaDeGuerra,
    conteudo: [
      { tipo: 'paragrafo', texto: 'A visita enquadra-se no protocolo de cooperação em vigor e prevê reuniões de trabalho e uma visita às salas de aula e à biblioteca.' },
    ],
  },
  {
    id: 'palestra-geopolitica-africa-austral',
    data: '2026-11-19',
    horaInicio: '15:00',
    horaFim: '17:00',
    categoria: 'Palestra',
    titulo: 'Palestra: Geopolítica da África Austral',
    local: 'Auditório principal da Escola',
    resumo: 'Palestra aberta sobre as dinâmicas políticas e de segurança na região da SADC.',
    capa: Curso1,
    inscricoes: true,
    conteudo: [
      { tipo: 'paragrafo', texto: 'A palestra analisa as dinâmicas políticas, económicas e de segurança na África Austral e o papel de Angola na região.' },
    ],
  },
  {
    id: 'encerramento-ano-academico',
    data: '2026-12-11',
    horaInicio: '10:00',
    horaFim: '12:00',
    categoria: 'Cerimónia',
    titulo: 'Cerimónia de encerramento do ano académico',
    local: 'Praça de armas da Escola',
    resumo: 'Balanço do ano académico e homenagem aos docentes e funcionários.',
    capa: Escola2,
    conteudo: [
      { tipo: 'paragrafo', texto: 'A cerimónia encerra oficialmente o ano académico, com o balanço das atividades e uma homenagem aos docentes e funcionários da Escola.' },
    ],
  },
  {
    id: 'jornadas-cientificas-2026',
    data: '2026-09-24',
    horaInicio: '09:00',
    horaFim: '18:00',
    categoria: 'Seminário',
    titulo: 'Jornadas Científicas 2026',
    local: 'Auditório principal da Escola',
    resumo: 'Dois dias de comunicações científicas de docentes, investigadores e alunos.',
    capa: Curso3,
    conteudo: [
      { tipo: 'paragrafo', texto: 'As Jornadas Científicas reuniram mais de 30 comunicações em estratégia, liderança, direito internacional e cooperação.' },
    ],
  },
  {
    id: 'abertura-ano-academico-2026',
    data: '2026-09-12',
    horaInicio: '10:00',
    horaFim: '12:00',
    categoria: 'Cerimónia',
    titulo: 'Cerimónia de abertura do ano académico 2026',
    local: 'Auditório principal da Escola',
    resumo: 'Sessão solene de abertura do ano letivo com os novos alunos.',
    capa: Auditorio,
    conteudo: [
      { tipo: 'paragrafo', texto: 'A sessão solene de abertura do ano académico recebeu mais de 200 novos alunos.' },
    ],
  },
]

eventos.sort((a, b) => a.data.localeCompare(b.data))

export function eventoPorId(id) {
  return eventos.find((e) => e.id === id)
}

export default eventos
