import Brasao from '../assets/brasao-documentos.png'
import './cabecalhoImpressao.css'

/*
  Cabeçalho institucional dos documentos impressos (boletim, percurso, pauta, relatórios…):
  brasão da Escola e a cadeia hierárquica. No ecrã não aparece; só no papel / PDF.
*/
export default function CabecalhoImpressao({ titulo, subtitulo, area }) {
  return (
    <header className="imp-cabecalho" translate="no">
      <img src={Brasao} alt="" />
      <div>
        <div>República de Angola</div>
        <div>Forças Armadas Angolanas</div>
        <div className="imp-escola">Escola Superior de Guerra</div>
        {area && <div className="imp-area">{area}</div>}
      </div>
      {titulo && <div className="imp-titulo">{titulo}{subtitulo && <small>{subtitulo}</small>}</div>}
    </header>
  )
}
