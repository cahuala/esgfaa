import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import Historias from '../Historias/Historias'
import { useConteudo } from '../../conteudo/contexto'
import { gruposDoSite } from '../../utils/videosDoSite'
import { t } from '../../i18n/linguas'
import css from './ActividadesEmVideo.module.css'

// site: os destaques (notícias e actividades realizadas, com vídeos curtos ou fotografias) como os estados do WhatsApp: página inicial, Notícias e Eventos
function ActividadesEmVideo() {
  const { eventos, noticias } = useConteudo()
  const navegar = useNavigate()
  const grupos = useMemo(() => gruposDoSite({ eventos, noticias }), [eventos, noticias])
  if (!grupos.length) return null
  return (
    <div className={`contentor ${css.bloco}`}>
      <Historias grupos={grupos} titulo={t('Destaques')} verMais={(g) => navegar(g.ligacao)} />
    </div>
  )
}

export default ActividadesEmVideo
