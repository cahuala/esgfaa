// "Zé Grande.jpg" -> "ze-grande.jpg" (nomes seguros para URLs)
export function nomeSemente(ficheiro) {
  const ext = ficheiro.slice(ficheiro.lastIndexOf('.')).toLowerCase()
  const base = ficheiro.slice(0, ficheiro.lastIndexOf('.'))
  return base.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + ext
}
