import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { API_URL } from '../../conteudo/api'
import { DocumentoCertificado } from '../cadeira/Certificado'
import { t as tx, localAtual } from '../../i18n/linguas'

// verificação pública de um certificado pelo código (qualquer pessoa, sem entrar no portal)
function Verificar() {
  const { codigo = '' } = useParams()
  const navegar = useNavigate()
  const [campo, setCampo] = useState(codigo)
  const [resposta, setResposta] = useState(null) // { codigo, cert } | { codigo, erro }
  useEffect(() => {
    if (!codigo) return
    const pedido = API_URL
      ? fetch(`${API_URL}/api/publico/certificados/${encodeURIComponent(codigo)}`)
        .then(async (x) => { const corpo = await x.json().catch(() => ({})); return x.ok ? { cert: corpo } : { erro: corpo.erro || tx('Não foi possível verificar.') } })
        .catch(() => ({ erro: tx('Sem ligação ao servidor.') }))
      : Promise.resolve({ erro: tx('O portal não está ligado ao servidor.') })
    pedido.then((x) => setResposta({ ...x, codigo }))
  }, [codigo])
  const r = resposta?.codigo === codigo ? resposta : null

  return (
    <div className="p-verificar">
      <div className="p-verificar-caixa">
        <h1 className="h4 mb-1"><i className="fa fa-shield-alt me-2 text-theme" />{tx('Verificar certificado')}</h1>
        <p className="text-muted">{tx('Escola Superior de Guerra — confirme a autenticidade de um certificado de conclusão pelo código impresso.')}</p>
        <form className="d-flex gap-2 mb-4" onSubmit={(e) => { e.preventDefault(); if (campo.trim()) navegar(`/verificar/${campo.trim()}`) }}>
          <input className="form-control font-monospace" value={campo} onChange={(e) => setCampo(e.target.value)} placeholder={tx('XXXX-XXXX-XXXX')} aria-label={tx('Código de verificação')} />
          <button type="submit" className="btn btn-theme">{tx('Verificar')}</button>
        </form>
        {codigo && !r && <p className="text-muted">{tx('A verificar…')}</p>}
        {r?.erro && <div className="alert alert-danger"><i className="fa fa-times-circle me-1" />{r.erro}</div>}
        {r?.cert && (
          <>
            <div className="alert alert-success"><i className="fa fa-check-circle me-1" />{tx('Certificado válido, emitido pela Escola Superior de Guerra.')}</div>
            {r.cert.tipo === 'curso' ? (
              <div className="p-certificado">
                <div className="p-certificado-escola">{tx('Forças Armadas Angolanas · Escola Superior de Guerra')}</div>
                <h1 className="p-certificado-titulo">{tx('Certificado de conclusão do curso')}</h1>
                <p className="p-certificado-nome">{r.cert.estudante}</p>
                <p className="small text-muted">{tx('Estudante n.º')} {r.cert.numero}</p>
                <p className="mb-1">{tx('concluiu o')}</p>
                <p className="p-certificado-cadeira">{r.cert.curso}</p>
                <p>{tx('com a classificação final de')} <b>{String(r.cert.media).replace('.', ',')} {tx('valores')}</b> {tx('· ano letivo')} {r.cert.anoLetivo}</p>
                <div className="small text-muted">{tx('Emitido em')} {new Date(r.cert.emitidoEm).toLocaleDateString(localAtual())} {tx('· código')} {r.cert.codigo}</div>
              </div>
            ) : <DocumentoCertificado cert={r.cert} />}
          </>
        )}
      </div>
    </div>
  )
}

export default Verificar
