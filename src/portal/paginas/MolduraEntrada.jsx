import Brasao from '../../assets/Logo.png'
import Sede from '../../assets/Escola De Guerra.png'
import { t as tx } from '../../i18n/linguas'
import LinguasEntrada from '../../i18n/LinguasEntrada'

// ecrã de entrada no estilo do painel (login com fotografia, do Color Admin)
function MolduraEntrada({ sobretitulo, titulo, subtitulo, children }) {
  return (
    <div id="app" className="app">
      <div className="login login-with-news-feed entrada-esg">
        <div className="news-feed">
          <div className="news-image" style={{ backgroundImage: `url("${Sede}")` }} />
          <div className="news-caption entrada-legenda">
            <span className="entrada-sobretitulo">{tx('Forças Armadas Angolanas')}</span>
            <h4 className="caption-title">{tx('Escola Superior de Guerra')}</h4>
            <p>{tx('Cadeiras, materiais, trabalhos, notas, percurso académico e horários num só lugar.')}</p>
            <span className="entrada-bandeira" aria-hidden="true"><i /><i /><i /></span>
          </div>
        </div>
        <div className="login-container entrada-painel">
          <LinguasEntrada />
          <div className="entrada-cabecalho">
            <img src={Brasao} alt={tx('Brasão da Escola Superior de Guerra')} className="entrada-brasao" />
            <div>
              <span className="entrada-sobretitulo">{sobretitulo}</span>
              <h1>{titulo}</h1>
              <p>{subtitulo}</p>
            </div>
          </div>
          <div className="login-content">{children}</div>
        </div>
      </div>
    </div>
  )
}

export default MolduraEntrada
