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
