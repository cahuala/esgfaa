import { useMemo, useState } from 'react'
import { IdiomaContexto } from './contexto'
import { linguaAtual, mudarLingua } from './linguas'

/*
  Língua escolhida no site. Ao mudar, a aplicação volta a ser desenhada (App usa a língua como "key"),
  para que textos, datas e conteúdos traduzidos mudem todos de uma vez.
*/
function IdiomaProvider({ children }) {
  const [lingua] = useState(linguaAtual)
  const valor = useMemo(() => ({ lingua, mudar: mudarLingua }), [lingua])
  return <IdiomaContexto.Provider value={valor}>{children}</IdiomaContexto.Provider>
}

export default IdiomaProvider
