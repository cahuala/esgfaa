import { useEffect, useState } from 'react'
import { api } from '../api'
import { useSessao } from '../sessaoContexto'
import { Carregando, Erro, Titulo } from '../componentes'
import VisaoCadeiras from '../VisaoCadeiras'
import { t as tx } from '../../i18n/linguas'

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
      <Titulo rotulo={tx('As minhas cadeiras')} titulo={tx('As minhas cadeiras')} sub={eDocente ? tx('onde é regente ou assistente') : tx('do ano letivo em curso')} />
      {erro && <Erro texto={erro} />}
      {!lista && !erro ? <Carregando /> : lista && <div className="panel panel-body"><VisaoCadeiras cadeiras={lista} progresso={progresso} /></div>}
    </>
  )
}

export default Cadeiras
