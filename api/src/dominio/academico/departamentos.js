/*
  Os departamentos de ensino da Escola Superior de Guerra (Quadro Orgânico › Direcção de Ensino): cada cadeira
  pertence a um. Aparecem também os que vierem das cadeiras ou das contas (do Pessoal) com outro nome.
*/
export const DEPARTAMENTOS_ENSINO = [
  'Departamento de Estratégia', 'Departamento de Administração', 'Departamento de Forças Terrestres', 'Departamento de Táctica e Arte Operativa',
  'Departamento de Força Aérea Nacional', 'Departamento de Força Naval', 'Departamento de Ciências Sociais e Humanas', 'Departamento de Operações de Paz',
  'Departamento de Investigação e Doutrina', 'Departamento de Ensino de Línguas', 'Departamento de Educação Moral e Cívica', 'Departamento de Educação Física e Desporto',
]
const simples = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
export const mesmoDepartamento = (a, b) => Boolean(a) && simples(a) === simples(b)
