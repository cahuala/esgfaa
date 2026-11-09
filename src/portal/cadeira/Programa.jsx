import { useState } from 'react'
import { FaFileDownload, FaFileUpload } from 'react-icons/fa'
import DOMPurify from 'dompurify'
import { abrirFicheiro, api } from '../api'
import { Cartao, Vazio } from '../componentes'
import { t as tx } from '../../i18n/linguas'

// programa da cadeira, escrito pela Administração Escolar e/ou em documento (o PDF também o envia o docente)
function Programa({ c, avisar, eDocente, recarregar }) {
  const [aEnviar, setAEnviar] = useState(false)
  async function enviar(formulario, texto) {
    setAEnviar(true)
    try {
      await api(`/cadeiras/${c.id}/programa`, { metodo: 'PUT', formulario })
      avisar({ texto })
      recarregar()
    } catch (e) {
      avisar({ tipo: 'erro', texto: e.message })
    } finally {
      setAEnviar(false)
    }
  }
  const escolher = (e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    const dados = new FormData()
    dados.append('ficheiro', f)
    enviar(dados, tx('Programa enviado.'))
  }
  const remover = () => {
    const dados = new FormData()
    dados.append('removerFicheiro', 'true')
    enviar(dados, tx('Documento retirado.'))
  }
  const acoes = (
    <div className="d-flex flex-wrap gap-2">
      {c.programaFicheiroId && (
        <button type="button" className="btn btn-theme btn-sm" onClick={() => abrirFicheiro(c.programaFicheiroId, { nome: `Programa ${c.codigo}`, ver: true }).catch((e) => avisar({ tipo: 'erro', texto: e.message }))}>
          <FaFileDownload aria-hidden="true" /> {tx('Descarregar documento')}
        </button>
      )}
      {eDocente && (
        <label className={`btn btn-white btn-sm mb-0 ${aEnviar ? 'disabled' : ''}`}>
          <FaFileUpload aria-hidden="true" /> {c.programaFicheiroId ? tx('Substituir o PDF') : tx('Enviar o programa (PDF)')}
          <input type="file" accept="application/pdf" className="d-none" onChange={escolher} disabled={aEnviar} />
        </label>
      )}
      {eDocente && c.programaFicheiroId && <button type="button" className="btn btn-white btn-sm" onClick={remover} disabled={aEnviar}>{tx('Retirar')}</button>}
    </div>
  )
  if (!c.programa && !c.programaFicheiroId) return eDocente ? <Cartao titulo={tx('Programa da cadeira')} acoes={acoes}><p className="p-texto-suave mb-0">{tx('Ainda não há programa. Envie o PDF da disciplina.')}</p></Cartao> : <Vazio>{tx('O programa desta cadeira ainda não foi publicado.')}</Vazio>
  return (
    <Cartao titulo={tx('Programa da cadeira')} acoes={acoes}>
      {c.programa
        ? <div className="p-programa" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(c.programa) }} />
        : <p className="p-texto-suave">{tx('O programa está no documento anexo.')}</p>}
    </Cartao>
  )
}

export default Programa
