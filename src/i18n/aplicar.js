// cópia dos dados com os textos traduzidos ("titulo", "conteudo.3.texto", …) nos seus lugares
export function aplicarTextos(dados, textos) {
  if (!textos) return dados
  const copia = structuredClone(dados)
  for (const [caminho, texto] of Object.entries(textos)) {
    if (typeof texto !== 'string' || !texto.trim()) continue
    const partes = caminho.split('.')
    let alvo = copia
    for (const p of partes.slice(0, -1)) {
      if (alvo === null || typeof alvo !== 'object' || !(p in alvo)) { alvo = null; break }
      alvo = alvo[p]
    }
    const ultima = partes.at(-1)
    if (alvo && typeof alvo === 'object' && typeof alvo[ultima] === 'string') alvo[ultima] = texto
  }
  return copia
}
