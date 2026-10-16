import { FaFileDownload } from 'react-icons/fa'
import DOMPurify from 'dompurify'
import { abrirFicheiro } from '../api'
import { Cartao, Vazio } from '../componentes'
import { t as tx } from '../../i18n/linguas'

// programa da cadeira, escrito pela Administração Escolar e/ou em documento
function Programa({ c, avisar }) {
  if (!c.programa && !c.programaFicheiroId) return <Vazio>{tx('O programa desta cadeira ainda não foi publicado pela Administração Escolar.')}</Vazio>
  return (
    <Cartao
      titulo={tx('Programa da cadeira')}
      acoes={c.programaFicheiroId && (
        <button type="button" className="btn btn-theme btn-sm" onClick={() => abrirFicheiro(c.programaFicheiroId, { nome: `Programa ${c.codigo}`, ver: true }).catch((e) => avisar({ tipo: 'erro', texto: e.message }))}>
          <FaFileDownload aria-hidden="true" /> {tx('Descarregar documento')}
        </button>
      )}
    >
      {c.programa
        ? <div className="p-programa" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(c.programa) }} />
        : <p className="p-texto-suave">{tx('O programa está no documento anexo.')}</p>}
    </Cartao>
  )
}

export default Programa
