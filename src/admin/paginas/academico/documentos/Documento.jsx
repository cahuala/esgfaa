import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import Brasao from '../../../../assets/Logo.png'
import { t as tx } from '../../../../i18n/linguas'

/*
  Moldura dos documentos oficiais da Administração Escolar (pautas, listas, histórico, certificado):
  cabeçalho institucional, título, conteúdo, assinaturas e data. A barra de ações não sai na impressão.
  paisagem: imprime na horizontal (tabelas largas).
*/
function Documento({ titulo, subtitulo, voltar, acoes, paisagem = false, assinaturas = [], children, rodape = true }) {
  // folha na horizontal só enquanto este documento está aberto
  useEffect(() => {
    if (!paisagem) return undefined
    const estilo = document.createElement('style')
    estilo.textContent = '@media print { @page { size: A4 landscape; margin: 10mm; } }'
    document.head.appendChild(estilo)
    return () => estilo.remove()
  }, [paisagem])
  return (
    <div className="of-pagina">
      <div className="of-acoes d-flex flex-wrap gap-2 mb-3">
        {voltar && <Link to={voltar} className="btn btn-white"><i className="fa fa-arrow-left me-1" />{tx('Voltar')}</Link>}
        <div className="ms-auto d-flex flex-wrap gap-2 align-items-center">
          {acoes}
          <button type="button" className="btn btn-theme" onClick={() => window.print()}><i className="fa fa-print me-1" />{tx('Imprimir / guardar em PDF')}</button>
        </div>
      </div>
      <article className={`of-folha ${paisagem ? 'of-folha-larga' : ''}`}>
        <header className="of-cabecalho">
          <img src={Brasao} alt="" />
          <div>
            <div>República de Angola</div>
            <div>Forças Armadas Angolanas</div>
            <div className="of-escola">Escola Superior de Guerra</div>
            <div className="of-repar">Administração Escolar</div>
          </div>
        </header>
        <h1 className="of-titulo">{titulo}</h1>
        {subtitulo && <div className="of-subtitulo">{subtitulo}</div>}
        {children}
        {assinaturas.length > 0 && (
          <div className="of-assinaturas">
            {assinaturas.map((a) => (
              <div key={a} className="of-assinatura"><div className="of-linha" /><div>{a}</div></div>
            ))}
          </div>
        )}
        {rodape && <footer className="of-rodape">Luanda, {new Date().toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' })}</footer>}
      </article>
    </div>
  )
}

export default Documento
