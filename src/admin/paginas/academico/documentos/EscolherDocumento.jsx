import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../../api'
import { useAnoTrabalho } from '../../../anoTrabalho'
import { DOCUMENTOS_ANO, DOCUMENTOS_TURMA } from './tiposDocumentosAno'
import { t as tx } from '../../../../i18n/linguas'

/*
  Os documentos de qualquer ano lectivo (também os anteriores, para a 2.ª via): escolhe-se o ano lectivo, o
  documento e, se for de uma turma, a turma; os estudantes escolhem-se na página do documento.
*/
function EscolherDocumento({ fechar, documento = '', gerir = true }) {
  const navegar = useNavigate()
  const { ano: anoTrabalho, anos } = useAnoTrabalho()
  const [anoEscolhido, setAno] = useState('')
  const [doc, setDoc] = useState(documento)
  const [turma, setTurma] = useState('')
  const [turmas, setTurmas] = useState(null)
  const [erro, setErro] = useState('')
  useEffect(() => { api('/academico/turmas').then(setTurmas).catch((e) => setErro(e.message)) }, [])
  // por omissão o ano anterior mais recente (é para isso que se abre); escolhe-se qualquer outro
  const ano = anoEscolhido || ([...anos].sort((a, b) => b.id.localeCompare(a.id)).find((a) => a.id < anoTrabalho)?.id ?? anoTrabalho)
  const doAno = (turmas ?? []).filter((t) => t.anoLetivo === ano)
  const deTurma = Boolean(DOCUMENTOS_TURMA[doc])
  const fechado = anos.find((a) => a.id === ano)?.fechado
  const pronto = ano && doc && (!deTurma || turma)
  function abrir(e) {
    e.preventDefault()
    if (!pronto) return
    fechar()
    navegar(deTurma ? DOCUMENTOS_TURMA[doc].ligacao(turma) : `/academico/documentos/ano/${doc}?ano=${encodeURIComponent(ano)}`)
  }
  return (
    <>
      <div className="modal d-block" tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="escolher-doc" onClick={fechar}>
        <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
          <form className="modal-content" onSubmit={abrir}>
            <div className="modal-header">
              <h5 className="modal-title" id="escolher-doc"><i className="fa fa-print me-2" />{tx('Documentos de um ano lectivo')}</h5>
              <button type="button" className="btn-close" onClick={fechar} aria-label={tx('Fechar')} />
            </div>
            <div className="modal-body">
              {erro && <div className="alert alert-danger py-2">{erro}</div>}
              <label className="form-label fw-bold" htmlFor="ed-ano">{tx('1. Ano lectivo')}</label>
              <select id="ed-ano" className="form-select mb-3" value={ano} onChange={(e) => { setAno(e.target.value); setTurma('') }} autoFocus>
                {anos.map((a) => <option key={a.id} value={a.id}>{a.id}{a.atual ? ` — ${tx('actual')}` : ''}{a.fechado ? ` — ${tx('fechado')}` : ''}</option>)}
              </select>
              <label className="form-label fw-bold" htmlFor="ed-doc">{tx('2. Documento')}</label>
              <select id="ed-doc" className="form-select mb-3" value={doc} onChange={(e) => setDoc(e.target.value)}>
                <option value="">{tx('— escolha o documento —')}</option>
                <optgroup label={tx('De uma turma')}>
                  {Object.entries(DOCUMENTOS_TURMA).filter(([, x]) => gerir || !x.gerir).map(([k, x]) => <option key={k} value={k}>{tx(x.nome)}</option>)}
                </optgroup>
                <optgroup label={tx('De todo o ano lectivo')}>
                  {Object.entries(DOCUMENTOS_ANO).map(([k, x]) => <option key={k} value={k}>{tx(x)}</option>)}
                </optgroup>
              </select>
              {deTurma && <>
                <label className="form-label fw-bold" htmlFor="ed-turma">{tx('3. Turma')}</label>
                <select id="ed-turma" className="form-select" value={turma} onChange={(e) => setTurma(e.target.value)} disabled={!turmas}>
                  <option value="">{turmas ? (doAno.length ? tx('— escolha a turma —') : tx('Não há turmas neste ano lectivo')) : tx('A carregar…')}</option>
                  {doAno.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
                </select>
                {doc === 'diplomas' && <div className="small text-muted mt-1">{tx('Na página seguinte escolhem-se os estudantes.')}</div>}
              </>}
              {fechado && <div className="alert alert-secondary small mt-3 mb-0"><i className="fa fa-lock me-1" />{tx('O ano lectivo {0} está fechado: consulta-se e reimprimem-se os diplomas e certificados já aprovados (2.ª via); para emitir outros documentos desse ano, o Comandante tem de o reabrir.', { 0: ano })}</div>}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-white" onClick={fechar}>{tx('Cancelar')}</button>
              <button type="submit" className="btn btn-theme" disabled={!pronto}><i className="fa fa-arrow-right me-1" />{tx('Abrir')}</button>
            </div>
          </form>
        </div>
      </div>
      <div className="modal-backdrop show" />
    </>
  )
}

export default EscolherDocumento
