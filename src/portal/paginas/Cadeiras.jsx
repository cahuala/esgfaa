import { useEffect, useState } from 'react'
import { api } from '../api'
import { useSessao } from '../sessaoContexto'
import { Carregando, Erro, Titulo } from '../componentes'
import VisaoCadeiras from '../VisaoCadeiras'

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
      <Titulo rotulo="As minhas cadeiras" titulo="As minhas cadeiras" sub={eDocente ? 'onde é regente ou assistente' : 'do ano letivo em curso'} />
      {erro && <Erro texto={erro} />}
      {!lista && !erro ? <Carregando /> : lista && <div className="panel panel-body"><VisaoCadeiras cadeiras={lista} progresso={progresso} /></div>}
    </>
  )
}

export default Cadeiras
