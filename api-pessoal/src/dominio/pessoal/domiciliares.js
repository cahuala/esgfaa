import { POSTOS } from './hierarquia.js'

/*
  Empregadas(os) domiciliares afectas(os) aos oficiais superiores e generais. Não contam como trabalhadores
  civis da Escola. Limite por posto: Major e Tenente-Coronel 1, Coronel 2,
  Brigadeiro e Tenente-General 3, General e General de Exército 4.
*/
const LIMITES = { major: 1, tenente_coronel: 1, coronel: 2, brigadeiro: 3, tenente_general: 3, general: 4, general_exercito: 4 }
export const limiteDomiciliares = (posto) => LIMITES[posto] ?? 0
export const temDireitoDomiciliar = (p) => p?.tipo === 'militar' && p.ativo !== false && p.situacao !== 'reforma' && limiteDomiciliares(p.posto) > 0 && POSTOS[p.posto]?.grau >= POSTOS.major.grau
