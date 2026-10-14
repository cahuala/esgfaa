import { useEffect, useState } from 'react'
import { api } from '../api'
import { useSessao } from '../sessaoContexto'
import { Carregando, Erro, Titulo } from '../componentes'
import { ListaCadeiras } from './Inicio'

function Cadeiras() {
  const { eDocente } = useSessao()
  const [lista, setLista] = useState(null)
  const [progresso, setProgresso] = useState(null)
  const [erro, setErro] = useState('')
  useEffect(() => {
    api('/cadeiras').then(setLista).catch((e) => setErro(e.message))
    if (!eDocente) api('/progresso').then(setProgresso).catch(() => {})
  }, [eDocente])
  return (
    <>
      <Titulo rotulo={eDocente ? 'Docência' : 'Plano de estudos'} titulo={eDocente ? 'As minhas cadeiras' : 'Cadeiras'} />
      {erro && <Erro texto={erro} />}
      {!lista && !erro ? <Carregando /> : lista && <ListaCadeiras cadeiras={lista} progresso={progresso} />}
    </>
  )
}

export default Cadeiras
