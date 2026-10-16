import { linguaAtual, t } from './linguas'

// Listas de rótulos que a API envia em português ({ chave: 'Rótulo' }) e o nível da originalidade
const MAPAS = new Set(['tipos', 'estados', 'acessos', 'idiomas', 'origens'])

const traduzirMapa = (m) => (m && typeof m === 'object' && !Array.isArray(m) && Object.values(m).every((v) => typeof v === 'string')
  ? Object.fromEntries(Object.entries(m).map(([k, v]) => [k, t(v)]))
  : m)

// percorre a resposta e traduz só esses campos; o resto (conteúdo, nomes) fica como veio
export function traduzirRotulos(dados) {
  if (linguaAtual() === 'pt' || !dados || typeof dados !== 'object') return dados
  const andar = (v, fundo) => {
    if (fundo > 6 || !v || typeof v !== 'object') return v
    if (Array.isArray(v)) { v.forEach((x) => andar(x, fundo + 1)); return v }
    for (const [k, x] of Object.entries(v)) {
      if (MAPAS.has(k)) v[k] = traduzirMapa(x)
      else if (k === 'nivel' && x && typeof x.rotulo === 'string') x.rotulo = t(x.rotulo)
      else andar(x, fundo + 1)
    }
    return v
  }
  return andar(dados, 0)
}
