// cadeiras abertas recentemente (como o bloco "Acedidas recentemente" do Moodle), guardadas no navegador
const CHAVE = 'esg_portal_recentes'

export function lerRecentes(conta) {
  try {
    const todas = JSON.parse(localStorage.getItem(CHAVE) || '{}')
    return Array.isArray(todas[conta]) ? todas[conta] : []
  } catch {
    return []
  }
}

export function registarRecente(conta, cadeiraId) {
  try {
    const todas = JSON.parse(localStorage.getItem(CHAVE) || '{}')
    todas[conta] = [cadeiraId, ...(todas[conta] || []).filter((x) => x !== cadeiraId)].slice(0, 6)
    localStorage.setItem(CHAVE, JSON.stringify(todas))
  } catch { /* armazenamento indisponível */ }
}

// última atividade aberta na sala de aula ("Continuar onde parou" na página da turma)
const CHAVE_CONTINUAR = 'esg_portal_continuar'

export function lerContinuar(conta) {
  try {
    return JSON.parse(localStorage.getItem(CHAVE_CONTINUAR) || '{}')[conta] || null
  } catch {
    return null
  }
}

export function registarContinuar(conta, { cadeiraId, cadeira, chave, titulo }) {
  try {
    const todas = JSON.parse(localStorage.getItem(CHAVE_CONTINUAR) || '{}')
    todas[conta] = { cadeiraId, cadeira, chave, titulo, quando: new Date().toISOString() }
    localStorage.setItem(CHAVE_CONTINUAR, JSON.stringify(todas))
  } catch { /* armazenamento indisponível */ }
}
