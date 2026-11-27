import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../../api'
import { CabecalhoPagina, Carregando, Erro, Painel } from '../../../componentes/Ui'
import { useAnoTrabalho } from '../../../anoTrabalho'
import { useSessao } from '../../../sessaoContexto'
import { DOCUMENTOS_ANO, DOCUMENTOS_TURMA } from './tiposDocumentosAno'
import EscolherDocumento from './EscolherDocumento'
import { t as tx } from '../../../../i18n/linguas'

/*
  Todos os documentos num só sítio, para o ano lectivo do menu: os de todo o ano (dados estatísticos, por ramos,
  relação para a entrega dos diplomas…) e os de cada turma (listas, pautas, diplomas e certificados, ofícios…).
  Os dos anos anteriores (2.ª via) pedem o ano lectivo numa janela.
*/
function DocumentosInicio() {
  const { pode } = useSessao()
  const gerir = pode('academico.gerir')
  const { ano } = useAnoTrabalho()
  const [turmas, setTurmas] = useState(null)
  const [turma, setTurma] = useState('')
  const [erro, setErro] = useState('')
  const [escolher, setEscolher] = useState(false)
  useEffect(() => { api('/academico/turmas').then(setTurmas).catch((e) => setErro(e.message)) }, [])
  if (erro) return <Erro texto={erro} />
  if (!turmas) return <Carregando />
  const doAno = turmas.filter((t) => t.anoLetivo === ano).sort((a, b) => a.nome.localeCompare(b.nome))
  const escolhida = doAno.find((t) => String(t.id) === String(turma))
  return (
    <>
      <CabecalhoPagina titulo={tx('Documentos')} subtitulo={tx('ano lectivo {0} (o ano muda-se no menu)', { 0: ano })} migalhas={[{ rotulo: tx('Administração Escolar') }, { rotulo: tx('Documentos') }]}>
        <button type="button" className="btn btn-white" onClick={() => setEscolher(true)}><i className="fa fa-calendar-alt me-1" />{tx('De anos anteriores (2.ª via)…')}</button>
      </CabecalhoPagina>
      <div className="row">
        <div className="col-xl-6">
          <Painel titulo={tx('De uma turma')}>
            <label className="form-label fw-bold" htmlFor="doc-turma">{tx('1. Escolha a turma')}</label>
            <select id="doc-turma" className="form-select mb-3" value={turma} onChange={(e) => setTurma(e.target.value)}>
              <option value="">{doAno.length ? tx('— escolha a turma —') : tx('Não há turmas neste ano lectivo')}</option>
              {doAno.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
            <div className="form-label fw-bold">{tx('2. Escolha o documento')}</div>
            <div className="d-grid gap-2">
              {Object.entries(DOCUMENTOS_TURMA).filter(([, x]) => gerir || !x.gerir).map(([k, x]) => (
                escolhida
                  ? <Link key={k} to={x.ligacao(escolhida.id)} className="btn btn-white text-start"><i className="fa fa-file-alt me-2 text-muted" />{tx(x.nome)}</Link>
                  : <button key={k} type="button" className="btn btn-white text-start" disabled><i className="fa fa-file-alt me-2 text-muted" />{tx(x.nome)}</button>
              ))}
            </div>
          </Painel>
        </div>
        <div className="col-xl-6">
          <Painel titulo={tx('De todo o ano lectivo {0}', { 0: ano })}>
            <div className="d-grid gap-2">
              {Object.entries(DOCUMENTOS_ANO).map(([k, n]) => <Link key={k} to={`/academico/documentos/ano/${k}?ano=${encodeURIComponent(ano)}`} className="btn btn-white text-start"><i className="fa fa-chart-bar me-2 text-muted" />{tx(n)}</Link>)}
            </div>
          </Painel>
        </div>
      </div>
      {escolher && <EscolherDocumento gerir={gerir} fechar={() => setEscolher(false)} />}
    </>
  )
}

export default DocumentosInicio
