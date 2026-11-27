import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { api } from '../../../api'
import { Carregando, Erro } from '../../../componentes/Ui'
import { useAnoTrabalho } from '../../../anoTrabalho'
import Documento from './Documento'

/*
  Declarações individuais da Administração Escolar (como os documentos individuais do Pessoal): de matrícula e de
  frequência (discente) e de serviço docente (docente). O texto preenche-se com a ficha (posto, nome, NIP, turma,
  curso, ano lectivo, cadeiras); o fim a que se destina escreve-se antes de imprimir.
*/
const TIPOS_DECLARACAO = {
  matricula: { titulo: 'DECLARAÇÃO DE MATRÍCULA', para: 'estudante' },
  frequencia: { titulo: 'DECLARAÇÃO DE FREQUÊNCIA', para: 'estudante' },
  docente: { titulo: 'DECLARAÇÃO DE SERVIÇO DOCENTE', para: 'docente' },
}

function Declaracao() {
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const tipo = TIPOS_DECLARACAO[params.get('tipo')] ? params.get('tipo') : 'matricula'
  const { ano } = useAnoTrabalho()
  const [c, setC] = useState(null)
  const [quem, setQuem] = useState({})
  const [fim, setFim] = useState('efeitos legais')
  const [erro, setErro] = useState('')
  useEffect(() => {
    api(`/academico/contas/${id}/ficha`).then(setC).catch((e) => setErro(e.message))
    api('/academico/documentos-academicos').then(setQuem).catch(() => {})
  }, [id])
  if (erro) return <Erro texto={erro} />
  if (!c) return <Carregando />
  const d = c.dados ?? {}
  const pessoa = [d.posto, c.nome].filter(Boolean).join(' ')
  const nip = d.nip ? `, NIP ${d.nip}` : ''
  // a turma do ano de trabalho (ou a mais recente)
  const turmas = [...(c.turmas ?? [])].sort((a, b) => String(b.anoLetivo).localeCompare(String(a.anoLetivo)))
  const t = turmas.find((x) => x.anoLetivo === ano) ?? turmas[0]
  const cadeiras = (c.cadeiras ?? []).filter((x) => !ano || x.anoLetivo === ano)
  const director = quem.directorEnsino?.nome ? { cargo: quem.directorEnsino.cargo || 'O Director de Ensino', nome: quem.directorEnsino.nome, posto: quem.directorEnsino.posto } : 'O Director de Ensino'
  const texto = {
    matricula: t ? `Para os devidos efeitos se declara que ${pessoa}${nip}, se encontra matriculado(a) no ${t.nome}, no ano lectivo ${t.anoLetivo}, na Escola Superior de Guerra.` : `${pessoa}${nip} não tem matrícula registada.`,
    frequencia: t ? `Para os devidos efeitos se declara que ${pessoa}${nip}, frequenta${t.estado === 'concluida' ? 'u' : ''} o ${t.nome}, no ano lectivo ${t.anoLetivo}, na Escola Superior de Guerra${t.estado === 'concluida' ? ', que concluiu' : ', com assiduidade'}.` : `${pessoa}${nip} não tem matrícula registada.`,
    docente: `Para os devidos efeitos se declara que ${pessoa}${nip}, presta serviço docente na Escola Superior de Guerra${cadeiras.length ? `, no ano lectivo ${ano}, nas unidades curriculares: ${cadeiras.map((x) => `${x.nome} (${x.turma})`).join('; ')}` : ''}.`,
  }[tipo]
  const opcoes = Object.entries(TIPOS_DECLARACAO).filter(([, x]) => x.para === c.tipo)
  return (
    <Documento
      titulo={TIPOS_DECLARACAO[tipo].titulo} voltar={`/pessoal/registo/${c.id}/ficha`} anoLetivo={t?.anoLetivo ?? ''}
      acoes={<>
        {opcoes.length > 1 && <select className="form-select w-auto" value={tipo} onChange={(e) => setParams({ tipo: e.target.value })} aria-label="Declaração">{opcoes.map(([k, x]) => <option key={k} value={k}>{x.titulo}</option>)}</select>}
        <input className="form-control w-auto" value={fim} onChange={(e) => setFim(e.target.value)} maxLength={120} aria-label="Fim a que se destina" placeholder="Fim a que se destina" />
      </>}
      assinaturas={[director]}
    >
      <p style={{ textAlign: 'justify', lineHeight: 2, fontSize: '1.05em', marginTop: '2.5em' }}>{texto}</p>
      <p style={{ textAlign: 'justify', lineHeight: 2, fontSize: '1.05em' }}>Por ser verdade e me ter sido solicitada, passa-se a presente declaração, que vai assinada e autenticada com o carimbo a óleo em uso nesta Escola, para {fim || 'efeitos legais'}.</p>
    </Documento>
  )
}

export default Declaracao
