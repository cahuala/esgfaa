/** Tema do site (claro ou escuro): escolhido pelo visitante, ou, à primeira visita, o do sistema. */
export const CHAVE_TEMA = 'esg_tema'

/** `guardado` é o que ficou no navegador ('light' | 'dark' | outra coisa); `sistemaEscuro` vem de prefers-color-scheme. */
export function temaInicial(guardado, sistemaEscuro) {
  if (guardado === 'light' || guardado === 'dark') return guardado
  return sistemaEscuro ? 'dark' : 'light'
}

export const outroTema = (tema) => (tema === 'dark' ? 'light' : 'dark')

export function lerTemaGuardado(armazenamento = globalThis.localStorage) {
  try {
    return armazenamento?.getItem(CHAVE_TEMA) ?? null
  } catch {
    return null
  }
}

export function guardarTema(tema, armazenamento = globalThis.localStorage) {
  try {
    armazenamento?.setItem(CHAVE_TEMA, tema)
  } catch {
    // modo privado ou armazenamento bloqueado: o tema só dura nesta visita
  }
}

/** Põe o tema no <html>; as variáveis de cor do site reagem a `data-tema`. */
export function aplicarTema(tema, documento = globalThis.document) {
  documento?.documentElement.setAttribute('data-tema', tema)
}
