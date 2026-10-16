import { useMemo, useState } from 'react'
import { IdiomaContexto } from './contexto'
import { definirLingua, linguaInicial } from './linguas'

/*
  Língua escolhida no site. Ao mudar, a aplicação volta a ser desenhada (App usa a língua como "key"),
  para que textos, datas e conteúdos traduzidos mudem todos de uma vez.
*/
function IdiomaProvider({ children }) {
  const [lingua, setLingua] = useState(() => {
    const l = linguaInicial()
    definirLingua(l)
    return l
  })
  const valor = useMemo(() => ({
    lingua,
    mudar: (l) => { definirLingua(l); setLingua(l) },
  }), [lingua])
  return <IdiomaContexto.Provider value={valor}>{children}</IdiomaContexto.Provider>
}

export default IdiomaProvider
