import EscolaDeGuerra from '../../assets/topo/escola-de-guerra.webp'
import Escola2 from '../../assets/topo/escola2.webp'
import Auditorio from '../../assets/topo/auditorio.webp'
import Curso1 from '../../assets/topo/curso1.webp'
import Curso2 from '../../assets/topo/curso2.webp'
import Curso3 from '../../assets/topo/curso3.webp'

// fotografia do topo de cada secção do site (a primeira parte do endereço); muda-se no painel, em «Imagens do topo»
export const SECCOES_TOPO = ['institucional', 'cursos', 'noticias', 'artigos', 'eventos', 'revista', 'contactos', 'privacidade']
export const IMAGENS_TOPO = {
  geral: EscolaDeGuerra,
  institucional: Escola2,
  cursos: Curso3,
  noticias: Curso2,
  artigos: Curso1,
  eventos: Auditorio,
  revista: Curso1,
  contactos: EscolaDeGuerra,
  privacidade: EscolaDeGuerra,
}

export function imagemTopo(caminho, escolhidas = {}) {
  const seccao = String(caminho || '').split('/').filter(Boolean)[0]?.toLowerCase() || 'geral'
  return escolhidas?.[seccao] || IMAGENS_TOPO[seccao] || escolhidas?.geral || IMAGENS_TOPO.geral
}
