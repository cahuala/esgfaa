import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../../../api'
import { Carregando, Erro } from '../../../componentes/Ui'
import Documento from './Documento'
import { dataPt, valor } from './csv'

const agrupado = (codigo) => codigo.match(/.{1,4}/g).join('-')
const EXTENSO = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'catorze', 'quinze', 'dezasseis', 'dezassete', 'dezoito', 'dezanove', 'vinte']

// certificado de conclusão do curso (documento final): emite-se se o curso estiver concluído
function CertificadoCurso() {
  const { turmaId, estudanteId } = useParams()
  const [c, setC] = useState(null)
  const [erro, setErro] = useState('')
  useEffect(() => { api(`/academico/turmas/${turmaId}/certificados/${estudanteId}`, { metodo: 'POST' }).then(setC).catch((e) => setErro(e.message)) }, [turmaId, estudanteId])
  if (erro) return <Erro texto={erro} />
  if (!c) return <Carregando />
  const e = c.estudante
  const verificar = `${window.location.origin}/portal/#/verificar/${c.codigo}`
  return (
    <Documento titulo="Certificado de conclusão do curso" voltar={`/academico/turmas/${turmaId}`} assinaturas={['O Chefe da Repartição de Administração Escolar', 'O Diretor da Escola']} rodape={false}>
      <div className="of-certificado">
        <p className="mb-1">Certifica-se que</p>
        <p className="of-nome mb-1">{e.nome}</p>
        <p className="mb-2">estudante n.º {e.numero}{e.dados?.nip ? `, NIP ${e.dados.nip}` : ''},</p>
        <p className="mb-2">concluiu o <b>{c.curso}</b>, tendo obtido aprovação em todas as unidades curriculares do plano de estudos e no trabalho de fim de curso{c.percurso?.tfc?.tema ? <>, subordinado ao tema <i>«{c.percurso.tfc.tema}»</i></> : ''},</p>
        <p className="mb-3">com a classificação final de <b>{valor(c.media)} ({EXTENSO[Math.round(c.media)]}) valores</b>{c.percurso?.conclusao?.classificacaoFinal ? `, ${c.percurso.conclusao.classificacaoFinal}` : ''}.</p>
        <p className="small mb-0">Ano letivo de conclusão: {c.turma?.anoLetivo || c.percurso?.anos?.at(-1)?.turma?.anoLetivo} · Emitido em {dataPt(c.emitidoEm)}</p>
        <p className="small mb-0">Código de verificação: <b className="font-monospace">{agrupado(c.codigo)}</b> — {verificar}</p>
      </div>
    </Documento>
  )
}

export default CertificadoCurso
