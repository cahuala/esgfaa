import { ARVORE_SITUACOES, CATEGORIAS, EFECTIVIDADES, ESTADOS, FORMAS_SERVICO, FUNCOES, GRUPOS, RAMOS, SITUACOES, postosDoRamo, quadrosDoRamo } from './hierarquia.js'
import { CURSOS_PROMOCAO, MODALIDADES } from './carreira.js'
import { CARREIRAS_CIVIS, VINCULOS_CIVIS } from './civis.js'
import { CATEGORIAS_DOCENTE, ESTADOS_CIVIS, GENEROS, HABILITACOES, PROVINCIAS, TIPOS, TIPOS_DOCENTE, VINCULOS } from './ficha.js'

// tabelas que o navegador usa nos formulários e filtros (tudo o que vem da lei e das listas fixas)
export const referencias = () => ({
  ramos: RAMOS, categorias: CATEGORIAS, grupos: GRUPOS, formasServico: FORMAS_SERVICO, situacoes: SITUACOES, efectividades: EFECTIVIDADES, arvoreSituacoes: ARVORE_SITUACOES, estados: ESTADOS, funcoes: FUNCOES,
  postos: Object.fromEntries(Object.keys(RAMOS).map((r) => [r, postosDoRamo(r)])),
  quadros: Object.fromEntries(Object.keys(RAMOS).map((r) => [r, quadrosDoRamo(r)])),
  cursosPromocao: CURSOS_PROMOCAO, modalidades: MODALIDADES,
  tiposDocente: TIPOS_DOCENTE, categoriasDocente: CATEGORIAS_DOCENTE,
  carreirasCivis: CARREIRAS_CIVIS, vinculosCivis: VINCULOS_CIVIS,
  tipos: TIPOS, vinculos: VINCULOS, generos: GENEROS, estadosCivis: ESTADOS_CIVIS, habilitacoes: HABILITACOES, provincias: PROVINCIAS,
})
