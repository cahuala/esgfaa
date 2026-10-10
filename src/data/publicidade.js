import Curso2 from '../assets/Curso2.png'
import Auditorio from '../assets/Auditorio.png'

/*
  Banners de publicidade. Editam-se no painel (Publicidade).
  tipo: 'composto' — imagem de fundo com título, texto e botão (feito no painel)
        'imagem'   — só a imagem enviada pelo anunciante (ex.: 728×90, 300×250)
  posicao: home-topo | home-meio | noticias-lateral | noticia-fim | rodape
  Os dois banners iniciais são anúncios internos da própria Escola.
*/
const publicidade = [
  {
    id: 'candidaturas-2027',
    titulo: 'Candidaturas abertas — ano académico 2027',
    anunciante: 'Escola Superior de Guerra',
    tipo: 'composto',
    texto: 'Curso de Estado-Maior, Promoção a Oficial General e Altos Estudos Militares. Prazo até 30 de novembro.',
    botao: 'Candidatar-me',
    imagem: Curso2,
    ligacao: '/Cursos',
    posicao: 'home-meio',
    inicio: '',
    fim: '',
    ativo: true,
  },
  {
    id: 'conferencia-seguranca-2026',
    titulo: 'Conferência sobre Segurança e Defesa Regional',
    anunciante: 'Escola Superior de Guerra',
    tipo: 'composto',
    texto: 'Inscrições abertas. Auditório principal da Escola.',
    botao: 'Ver programa',
    imagem: Auditorio,
    ligacao: '/Eventos',
    posicao: 'noticias-lateral',
    inicio: '',
    fim: '',
    ativo: true,
  },
]

export default publicidade
