import { useMemo } from 'react'
import { useDados } from './useDados'

/*
  A orgânica da Escola é uma árvore (unidades, subunidades, secções). Este gancho dá-a já pronta a usar:
  lista (pela ordem da árvore, com o nível), opcoes (para as listas de escolha, com recuo e o tipo),
  descendentes(id) (a unidade e todas as subunidades) e caminho(id) («DE › Secção de Estratégia»).
*/
export function useArvore() {
  const { dados } = useDados('/organica')
  return useMemo(() => {
    const lista = []
    const pais = new Map()
    const andar = (n, nivel) => {
      if (n.id) { lista.push({ ...n, nivel }); pais.set(n.id, n.paiId ?? null) }
      for (const f of n.filhos) andar(f, nivel + 1)
    }
    if (dados) andar(dados.escola, 0)
    const porId = new Map(lista.map((u) => [u.id, u]))
    const descendentes = (id) => {
      const r = new Set([id])
      for (const u of lista) for (let x = u.paiId; x; x = pais.get(x)) if (r.has(x)) { r.add(u.id); break }
      return r
    }
    const caminho = (id) => { const c = []; for (let x = porId.get(id); x; x = porId.get(x.paiId)) c.unshift(x.sigla || x.nome); return c.join(' › ') }
    const opcoes = lista.map((u) => [u.id, `${'   '.repeat(u.nivel - 1)}${u.nivel > 1 ? '└ ' : ''}${u.sigla ? `${u.sigla} — ` : ''}${u.nome}`])
    return { escola: dados?.escola ?? null, colunas: dados?.colunas ?? [], lista, porId, opcoes, descendentes, caminho, pronta: Boolean(dados) }
  }, [dados])
}

export const ICONE_UNIDADE = { comando: 'fa-star', direccao: 'fa-landmark', gabinete: 'fa-user-tie', departamento: 'fa-building', reparticao: 'fa-briefcase', seccao: 'fa-folder', servico: 'fa-concierge-bell', batalhao: 'fa-flag', companhia: 'fa-shield-alt', pelotao: 'fa-users', curso: 'fa-user-graduate', outro: 'fa-building' }
