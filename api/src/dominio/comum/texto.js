// "Formatura 2026: Estado-Maior" -> "formatura-2026-estado-maior"
export function slugificar(texto) {
  return String(texto ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    .slice(0, 80) || 'item'
}

// retira caracteres de controlo (exceto mudança de linha e tabulação) e espaços nas pontas
export function limparTexto(texto) {
  // eslint-disable-next-line no-control-regex
  return String(texto ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim()
}

export const ID_VALIDO = /^[a-z0-9][a-z0-9-]{0,99}$/
