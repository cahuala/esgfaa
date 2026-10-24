import Brasao from '../../assets/Logo-ecra.webp'
import { t as tx } from '../../i18n/linguas'

/*
  À espera dos dados (Portal, painel e Pessoal): o brasão dentro de um anel que roda, com as cores da
  Escola, ao centro da área do conteúdo. compacta: dentro de um cartão ou de uma tabela.
  Os estilos estão em admin/identidade.css (.esg-espera), que as três aplicações carregam.
*/
export default function Espera({ texto, compacta = false }) {
  return (
    <div className={`esg-espera${compacta ? ' esg-espera-compacta' : ''}`} role="status" aria-live="polite">
      <span className="esg-espera-anel" aria-hidden="true"><img src={Brasao} alt="" /></span>
      <span className="esg-espera-texto">{texto ?? tx('A carregar…')}</span>
    </div>
  )
}
