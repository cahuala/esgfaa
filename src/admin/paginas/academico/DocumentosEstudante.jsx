import { useEffect, useState } from 'react'
import { api } from '../../api'
import { MODELOS_CERTIFICADO, MODELOS_DIPLOMA, gerarDiplomas, modelosDoCurso } from './documentos/diplomas'
import { t as tx } from '../../../i18n/linguas'

/*
  Documentos de conclusão de um estudante (só a Administração Escolar, só para quem concluiu o curso):
  certificado (com as disciplinas e notas) e diploma. Aqui também se acertam quem assina e, para a turma,
  a edição do curso e as datas em que decorreu; ficam guardados para os seguintes.
*/
function DocumentosEstudante({ turma, estudante, fechar }) {
  const [cfg, setCfg] = useState(null)
  const [docs, setDocs] = useState({ certificado: true, diploma: true })
  const [erro, setErro] = useState('')
  const [aGerar, setAGerar] = useState(false)
  useEffect(() => { api('/academico/documentos-academicos').then(setCfg).catch((e) => setErro(e.message)) }, [])

  // os modelos do curso (Estratégia e Arte Operativa: certificado com tabela e diploma decorado; os outros: lista e «Atesta-se»)
  const padrao = modelosDoCurso(String(turma.curso ?? '').replace(/-/g, ' '))
  const daTurma = { edicao: '', inicio: '', fim: '', modeloCertificado: padrao.certificado, modeloDiploma: padrao.diploma, ...(cfg?.turmas?.[turma.id] ?? {}) }
  const mudarTurma = (campo, v) => setCfg({ ...cfg, turmas: { ...cfg.turmas, [turma.id]: { ...daTurma, [campo]: v } } })
  const mudarQuem = (quem, campo, v) => setCfg({ ...cfg, [quem]: { ...cfg[quem], [campo]: v } })
  const escolhidos = Object.keys(docs).filter((k) => docs[k])

  async function gerar(e) {
    e.preventDefault()
    setErro('')
    setAGerar(true)
    try {
      await api('/academico/documentos-academicos', { metodo: 'PUT', corpo: { directorEnsino: cfg.directorEnsino, comandante: cfg.comandante, turmas: { [turma.id]: daTurma } } })
      const c = await api(`/academico/turmas/${turma.id}/certificados/${estudante.id}`, { metodo: 'POST' })
      await gerarDiplomas(c, { ...daTurma, anoLetivo: turma.anoLetivo, directorEnsino: cfg.directorEnsino, comandante: cfg.comandante }, escolhidos)
    } catch (falha) {
      setErro(falha.message)
    } finally {
      setAGerar(false)
    }
  }

  const assinante = (quem, rotulo) => (
    <fieldset className="col-md-6">
      <legend className="fs-6 fw-bold">{rotulo}</legend>
      {[['cargo', tx('Cargo')], ['nome', tx('Nome')], ['posto', tx('Posto')]].map(([campo, r]) => (
        <div key={campo} className="mb-2">
          <label className="form-label small mb-0" htmlFor={`${quem}-${campo}`}>{r}</label>
          <input id={`${quem}-${campo}`} className="form-control form-control-sm" value={cfg[quem]?.[campo] ?? ''} maxLength={120} onChange={(e) => mudarQuem(quem, campo, e.target.value)} />
        </div>
      ))}
    </fieldset>
  )

  return (
    <>
    <div className="modal d-block" tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="docs-estudante" onClick={() => !aGerar && fechar()}>
      <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable" onClick={(e) => e.stopPropagation()}>
        <form className="modal-content" onSubmit={gerar}>
          <div className="modal-header">
            <h4 className="modal-title" id="docs-estudante"><i className="fa fa-award me-2" />{tx('Documentos')} — {[estudante.dados?.posto, estudante.nome].filter(Boolean).join(' ')}</h4>
            <button type="button" className="btn-close" onClick={fechar} disabled={aGerar} aria-label={tx('Fechar')} />
          </div>
          <div className="modal-body">
            {erro && <div className="alert alert-danger py-2">{erro}</div>}
            {!cfg ? <p className="text-muted">{tx('A carregar…')}</p> : (
              <>
                <div className="d-flex gap-4 mb-3">
                  <label className="form-check"><input type="checkbox" className="form-check-input" checked={docs.certificado} onChange={(e) => setDocs({ ...docs, certificado: e.target.checked })} /> <span className="form-check-label">{tx('Certificado (disciplinas e notas)')}</span></label>
                  <label className="form-check"><input type="checkbox" className="form-check-input" checked={docs.diploma} onChange={(e) => setDocs({ ...docs, diploma: e.target.checked })} /> <span className="form-check-label">{tx('Diploma')}</span></label>
                </div>
                <h6 className="fw-bold">{tx('Curso desta turma')}</h6>
                <div className="row g-2 mb-3">
                  <div className="col-md-4"><label className="form-label small mb-0" htmlFor="de-edicao">{tx('Edição (ex.: 17.º)')}</label><input id="de-edicao" className="form-control form-control-sm" value={daTurma.edicao} maxLength={20} onChange={(e) => mudarTurma('edicao', e.target.value)} /></div>
                  <div className="col-md-4"><label className="form-label small mb-0" htmlFor="de-inicio">{tx('Início do curso')}</label><input id="de-inicio" type="date" className="form-control form-control-sm" value={daTurma.inicio} onChange={(e) => mudarTurma('inicio', e.target.value)} required /></div>
                  <div className="col-md-4"><label className="form-label small mb-0" htmlFor="de-fim">{tx('Fim do curso (data do documento)')}</label><input id="de-fim" type="date" className="form-control form-control-sm" value={daTurma.fim} onChange={(e) => mudarTurma('fim', e.target.value)} required /></div>
                </div>
                <h6 className="fw-bold">{tx('Modelos')}</h6>
                <div className="row g-2 mb-3">
                  <div className="col-md-6"><label className="form-label small mb-0" htmlFor="de-mc">{tx('Certificado')}</label><select id="de-mc" className="form-select form-select-sm" value={daTurma.modeloCertificado} onChange={(e) => mudarTurma('modeloCertificado', e.target.value)}>{Object.entries(MODELOS_CERTIFICADO).map(([k, v]) => <option key={k} value={k}>{tx(v)}</option>)}</select></div>
                  <div className="col-md-6"><label className="form-label small mb-0" htmlFor="de-md">{tx('Diploma')}</label><select id="de-md" className="form-select form-select-sm" value={daTurma.modeloDiploma} onChange={(e) => mudarTurma('modeloDiploma', e.target.value)}>{Object.entries(MODELOS_DIPLOMA).map(([k, v]) => <option key={k} value={k}>{tx(v)}</option>)}</select></div>
                </div>
                <div className="row">
                  {assinante('directorEnsino', tx('Assina à esquerda'))}
                  {assinante('comandante', tx('Assina à direita'))}
                </div>
                <p className="small text-muted mb-0">{tx('Ao gerar, o certificado de conclusão fica registado (com código de verificação) e estes dados ficam guardados para os outros estudantes.')}</p>
              </>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-white" onClick={fechar} disabled={aGerar}>{tx('Fechar')}</button>
            <button type="submit" className="btn btn-theme" disabled={!cfg || !escolhidos.length || aGerar}><i className={`fa ${aGerar ? 'fa-spinner fa-spin' : 'fa-file-pdf'} me-1`} />{tx('Gerar PDF')}</button>
          </div>
        </form>
      </div>
    </div>
    <div className="modal-backdrop fade show" />
    </>
  )
}

export default DocumentosEstudante
