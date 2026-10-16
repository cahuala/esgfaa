import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Brasao from '../../assets/Logo.png'
import { api } from '../api'
import { Carregando, Erro } from '../componentes'
import { data } from '../formatar'
import { t as tx } from '../../i18n/linguas'

// endereço público de verificação do certificado (sem sessão)
const enderecoVerificacao = (codigo) => `${window.location.origin}${window.location.pathname}#/verificar/${codigo}`
const agrupado = (codigo) => codigo.match(/.{1,4}/g).join('-')

// o documento do certificado (ecrã e impressão)
export function DocumentoCertificado({ cert }) {
  return (
    <div className="p-certificado">
      <img src={Brasao} alt="" className="p-certificado-brasao" />
      <div className="p-certificado-escola">{tx('Forças Armadas Angolanas · Escola Superior de Guerra')}</div>
      <h1 className="p-certificado-titulo">{tx('Certificado de conclusão')}</h1>
      <p className="mb-1">{tx('Certifica-se que')}</p>
      <p className="p-certificado-nome">{cert.estudante}</p>
      {cert.numero && <p className="small text-muted">{tx('Estudante n.º')} {cert.numero}</p>}
      <p className="mb-1">{tx('concluiu todas as atividades da unidade curricular')}</p>
      <p className="p-certificado-cadeira">{cert.cadeira} <span className="text-muted">({cert.codigoCadeira})</span></p>
      <p className="mb-0">{[cert.turma, cert.anoLetivo && tx('ano letivo {0}', { 0: cert.anoLetivo }), cert.horas && tx('{0} horas', { 0: cert.horas })].filter(Boolean).join(' · ')}</p>
      <div className="p-certificado-rodape">
        <div><span className="text-muted small d-block">{tx('Emitido em')}</span><b>{data(cert.emitidoEm)}</b></div>
        <div className="text-end"><span className="text-muted small d-block">{tx('Código de verificação')}</span><b className="font-monospace">{agrupado(cert.codigo)}</b></div>
      </div>
      <div className="small text-muted mt-2">{tx('Verifique em')} {enderecoVerificacao(cert.codigo)}</div>
    </div>
  )
}

// página do estudante com o seu certificado de uma cadeira, pronta a imprimir
function Certificado() {
  const { id } = useParams()
  const [r, setR] = useState(null)
  const [erro, setErro] = useState('')
  useEffect(() => { api(`/cadeiras/${id}/conclusao`).then(setR).catch((e) => setErro(e.message)) }, [id])
  if (erro) return <Erro texto={erro} />
  if (!r) return <Carregando />
  if (!r.certificado) return <Erro texto={tx('Ainda não tem certificado desta cadeira: conclua todas as atividades e peça-o na página da cadeira.')} />
  return (
    <>
      <div className="d-flex gap-2 mb-3 p-sem-impressao">
        <Link to={`/cadeiras/${id}`} className="btn btn-white"><i className="fa fa-arrow-left me-1" />{tx('Voltar à cadeira')}</Link>
        <button type="button" className="btn btn-theme ms-auto" onClick={() => window.print()}><i className="fa fa-print me-1" />{tx('Imprimir ou guardar em PDF')}</button>
      </div>
      <DocumentoCertificado cert={r.certificado} />
    </>
  )
}

export default Certificado
