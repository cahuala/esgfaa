import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { API_URL } from '../../conteudo/api'
import { DocumentoCertificado } from '../cadeira/Certificado'

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
        .then(async (x) => { const corpo = await x.json().catch(() => ({})); return x.ok ? { cert: corpo } : { erro: corpo.erro || 'Não foi possível verificar.' } })
        .catch(() => ({ erro: 'Sem ligação ao servidor.' }))
      : Promise.resolve({ erro: 'O portal não está ligado ao servidor.' })
    pedido.then((x) => setResposta({ ...x, codigo }))
  }, [codigo])
  const r = resposta?.codigo === codigo ? resposta : null

  return (
    <div className="p-verificar">
      <div className="p-verificar-caixa">
        <h1 className="h4 mb-1"><i className="fa fa-shield-alt me-2 text-theme" />Verificar certificado</h1>
        <p className="text-muted">Escola Superior de Guerra — confirme a autenticidade de um certificado de conclusão pelo código impresso.</p>
        <form className="d-flex gap-2 mb-4" onSubmit={(e) => { e.preventDefault(); if (campo.trim()) navegar(`/verificar/${campo.trim()}`) }}>
          <input className="form-control font-monospace" value={campo} onChange={(e) => setCampo(e.target.value)} placeholder="XXXX-XXXX-XXXX" aria-label="Código de verificação" />
          <button type="submit" className="btn btn-theme">Verificar</button>
        </form>
        {codigo && !r && <p className="text-muted">A verificar…</p>}
        {r?.erro && <div className="alert alert-danger"><i className="fa fa-times-circle me-1" />{r.erro}</div>}
        {r?.cert && (
          <>
            <div className="alert alert-success"><i className="fa fa-check-circle me-1" />Certificado válido, emitido pela Escola Superior de Guerra.</div>
            {r.cert.tipo === 'curso' ? (
              <div className="p-certificado">
                <div className="p-certificado-escola">Forças Armadas Angolanas · Escola Superior de Guerra</div>
                <h1 className="p-certificado-titulo">Certificado de conclusão do curso</h1>
                <p className="p-certificado-nome">{r.cert.estudante}</p>
                <p className="small text-muted">Estudante n.º {r.cert.numero}</p>
                <p className="mb-1">concluiu o</p>
                <p className="p-certificado-cadeira">{r.cert.curso}</p>
                <p>com a classificação final de <b>{String(r.cert.media).replace('.', ',')} valores</b> · ano letivo {r.cert.anoLetivo}</p>
                <div className="small text-muted">Emitido em {new Date(r.cert.emitidoEm).toLocaleDateString('pt-PT')} · código {r.cert.codigo}</div>
              </div>
            ) : <DocumentoCertificado cert={r.cert} />}
          </>
        )}
      </div>
    </div>
  )
}

export default Verificar
