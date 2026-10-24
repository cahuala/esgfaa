import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import Historias from '../Historias/Historias'
import { useConteudo } from '../../conteudo/contexto'
import { gruposDoSite } from '../../utils/videosDoSite'
import { t } from '../../i18n/linguas'
import css from './ActividadesEmVideo.module.css'

// site: as actividades realizadas em vídeos curtos (como os estados do WhatsApp), na página inicial e em Eventos
function ActividadesEmVideo() {
  const { eventos, noticias } = useConteudo()
  const navegar = useNavigate()
  const grupos = useMemo(() => gruposDoSite({ eventos, noticias }), [eventos, noticias])
  if (!grupos.length) return null
  return (
    <div className={`contentor ${css.bloco}`}>
      <Historias grupos={grupos} titulo={t('Actividades realizadas em vídeo')} verMais={(g) => navegar(g.ligacao)} />
    </div>
  )
}

export default ActividadesEmVideo
