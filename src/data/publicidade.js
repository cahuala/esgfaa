import Curso2 from '../assets/Curso2.webp'
import Auditorio from '../assets/Auditorio.webp'

/*
  Banners de publicidade. Editam-se no painel (Publicidade).
  tipo: 'composto' — imagem de fundo com título, texto e botão (feito no painel)
        'imagem'   — só a imagem enviada pelo anunciante (ex.: 728×90, 300×250)
  posicao: home-topo | home-meio | noticias-lateral | noticia-fim | rodape
  Os dois banners iniciais são anúncios internos da própria Escola.
*/
const publicidade = [
  {
    id: 'revista-n2',
    titulo: 'Revista da Escola — N.º 2 já disponível',
    anunciante: 'Escola Superior de Guerra',
    tipo: 'composto',
    texto: 'Segurança marítima e cooperação regional. Leitura livre no site, sem registo.',
    botao: 'Ler a revista',
    imagem: Curso2,
    ligacao: '/Revista',
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
