import FotoCarlosVieira from '../assets/Comandante3.png'

// Sem `foto`, os componentes mostram as iniciais num círculo.
const pessoas = [
  {
    id: 'carlos-vieira',
    nome: 'Gen. Carlos Vieira',
    cargo: 'Comandante da Escola',
    destaque: 'Mais de 30 anos de carreira militar, à frente da Escola desde 2021',
    foto: FotoCarlosVieira,
  },
  {
    id: 'ana-baptista',
    nome: 'Cor. Ana Baptista',
    cargo: 'Subdiretora Académica',
    destaque: 'Responsável pela coordenação de todos os programas de formação',
  },
  {
    id: 'miguel-santos',
    nome: 'Cor. Miguel Santos',
    cargo: 'Diretor do Departamento de Investigação',
    destaque: 'Autor de mais de 15 publicações em estratégia e defesa',
  },
  {
    id: 'isabel-fortunato',
    nome: 'Ten-Cor. Isabel Fortunato',
    cargo: 'Chefe do Corpo Docente',
    destaque: 'Doutorada em Relações Internacionais, docente há 12 anos',
  },
  {
    id: 'jose-manuel',
    nome: 'Cor. José Manuel',
    cargo: 'Diretor de Cooperação Internacional',
    destaque: 'Responsável por mais de 20 acordos de cooperação com escolas parceiras',
  },
  {
    id: 'teresa-lopes',
    nome: 'Maj. Teresa Lopes',
    cargo: 'Coordenadora do Curso de Estado-Maior',
    destaque: 'Formou mais de 300 oficiais ao longo da carreira docente',
  },
]

export function pessoaPorId(id) {
  return pessoas.find((p) => p.id === id)
}

export default pessoas
