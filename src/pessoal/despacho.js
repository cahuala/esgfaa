// o que ficou à espera do despacho do Comandante, para dizer a quem gravou
const NOMES = { docente_novo: 'o novo docente', docente_categoria: 'a mudança de categoria', docente_saida: 'a saída da lista dos docentes', utilizador_novo: 'a conta nova', utilizador_papel: 'a mudança de papel' }
export const textoDespacho = (r) => (r?.aDespacho?.length ? `Enviado a despacho do Comandante: ${r.aDespacho.map((k) => NOMES[k] ?? k).join(', ')} só vale depois de deferido.` : '')
