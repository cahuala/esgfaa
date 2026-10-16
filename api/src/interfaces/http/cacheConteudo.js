/*
  Memória curta da resposta "todo o conteúdo do site": com muitos visitantes ao mesmo tempo, a resposta
  monta-se uma só vez (os pedidos que chegam entretanto esperam por essa) e serve-se pronta durante
  alguns segundos. Qualquer alteração feita no painel apaga-a, para o site mostrar logo o que mudou.
*/
export function criarCacheConteudo({ duracaoMs = 10_000, agora = () => Date.now() } = {}) {
  const guardados = new Map() // chave -> { ate, promessa }
  return {
    async obter(chave, montar) {
      const g = guardados.get(chave)
      if (g && g.ate > agora()) return g.promessa
      const promessa = montar()
      guardados.set(chave, { ate: agora() + duracaoMs, promessa })
      promessa.catch(() => guardados.delete(chave)) // um erro não fica guardado
      return promessa
    },
    limpar() {
      guardados.clear()
    },
  }
}
