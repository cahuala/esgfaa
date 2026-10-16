import { useState } from 'react'
import { api } from '../../api'
import { lerFolha } from './lerFolha'
import { t as tx } from '../../../i18n/linguas'

const ACOES = {
  matricular: ['bg-primary', tx('Matricular')],
  ja_matriculado: ['bg-gray-500', tx('Já matriculado')],
  erro: ['bg-danger', tx('Erro')],
}

/*
  Matricular estudantes de uma folha Excel (.xlsx) ou CSV: só quem já está registado pelo Pessoal e Quadros,
  encontrado pelo e-mail ou pelo número de estudante. Pré-visualização na API antes de matricular.
*/
function ImportarEstudantes({ turma, fechar, concluido }) {
  const [folha, setFolha] = useState(null) // { nome, linhas, colunas, faltam }
  const [previa, setPrevia] = useState(null)
  const [feito, setFeito] = useState(null)
  const [erro, setErro] = useState('')
  const [aTrabalhar, setATrabalhar] = useState(false)

  async function escolher(ficheiro) {
    setErro('')
    setPrevia(null)
    setFolha(null)
    if (!ficheiro) return
    setATrabalhar(true)
    try {
      const f = await lerFolha(ficheiro)
      setFolha({ nome: ficheiro.name, ...f })
      if (f.colunas.email === undefined && f.colunas.numero === undefined) throw new Error(tx('A folha precisa de uma coluna E-mail ou Número (na primeira linha).'))
      if (!f.linhas.length) throw new Error(tx('A folha não tem estudantes por baixo do cabeçalho.'))
      setPrevia(await api(`/academico/turmas/${turma.id}/importar`, { metodo: 'POST', corpo: { linhas: f.linhas, simular: true } }))
    } catch (e) {
      setErro(e.message)
    } finally {
      setATrabalhar(false)
    }
  }

  async function importar() {
    setATrabalhar(true)
    try {
      const r = await api(`/academico/turmas/${turma.id}/importar`, { metodo: 'POST', corpo: { linhas: folha.linhas, simular: false } })
      setFeito(r)
      setPrevia(r)
      concluido()
    } catch (e) {
      setErro(e.message)
    } finally {
      setATrabalhar(false)
    }
  }

  const aGravar = previa && !feito ? previa.resumo.matricular : 0
  return (
    <>
      <div className="modal d-block" tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="imp-titulo" onClick={() => !aTrabalhar && fechar()}>
        <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable" onClick={(e) => e.stopPropagation()}>
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title" id="imp-titulo"><i className="fa fa-file-excel me-2" />{tx('Matricular a partir de uma folha —')} {turma.nome}</h4>
              <button type="button" className="btn-close" onClick={fechar} disabled={aTrabalhar} aria-label={tx('Fechar')} />
            </div>
            <div className="modal-body">
              <p className="text-muted small mb-2">
                {tx('Excel (.xlsx) ou CSV com uma linha de cabeçalho e uma coluna')} <b>{tx('E-mail')}</b> {tx('ou')} <b>{tx('Número')}</b> {tx('(de estudante). Só se matricula quem já está registado pela Repartição de Pessoal e Quadros; ninguém novo é registado aqui.')}
              </p>
              {!feito && (
                <label className="d-block border border-2 border-dashed rounded p-4 text-center" style={{ cursor: 'pointer' }}>
                  <span className="d-block mb-2"><i className="fa fa-cloud-upload-alt fa-2x text-muted" /></span>
                  <span className="fw-bold">{folha ? folha.nome : tx('Escolher a folha')}</span>
                  <input type="file" accept=".xlsx,.csv,.txt" className="d-none" onChange={(e) => escolher(e.target.files[0])} disabled={aTrabalhar} aria-label={tx('Folha de estudantes')} />
                </label>
              )}
              {aTrabalhar && <p className="text-muted mt-3 mb-0"><span className="spinner-border spinner-border-sm me-2" />{tx('A tratar a folha…')}</p>}
              {erro && <div className="alert alert-danger mt-3 mb-0">{erro}</div>}
              {feito && <div className="alert alert-success">{tx('Matrícula concluída:')} {feito.resumo.matricular} {tx('estudante(s) matriculado(s)')}{feito.resumo.erro ? tx(', {0} linha(s) com erro', { 0: feito.resumo.erro }) : ''}.</div>}
              {previa && (
                <>
                  <div className="d-flex flex-wrap gap-2 my-3">
                    {Object.entries(ACOES).map(([k, [cor, texto]]) => previa.resumo[k] ? <span key={k} className={`badge ${cor} fs-12px`}>{texto}: {previa.resumo[k]}</span> : null)}
                  </div>
                  <div className="table-responsive">
                    <table className="table table-sm table-striped align-middle mb-0">
                      <thead><tr><th>{tx('Linha')}</th><th>{tx('Nome')}</th><th>{tx('E-mail / número')}</th><th>{tx('Resultado')}</th></tr></thead>
                      <tbody>
                        {previa.linhas.map((l) => (
                          <tr key={l.linha} className={l.acao === 'erro' ? 'text-danger' : ''}>
                            <td className="text-muted">{l.linha + 1}</td>
                            <td>{l.nome}</td>
                            <td className="small">{l.email || l.numero}</td>
                            <td><span className={`badge ${ACOES[l.acao][0]}`}>{ACOES[l.acao][1]}</span>{l.erro && <span className="small ms-2">{l.erro}</span>}{l.numero && feito && <span className="small text-muted ms-2 font-monospace">{l.numero}</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-white" onClick={fechar} disabled={aTrabalhar}>{feito ? tx('Fechar') : tx('Cancelar')}</button>
              {!feito && <button type="button" className="btn btn-theme" onClick={importar} disabled={aTrabalhar || !aGravar}><i className="fa fa-check me-1" />{aGravar ? tx('Matricular {0} estudante(s)', { 0: aGravar }) : tx('Matricular')}</button>}
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" />
    </>
  )
}

export default ImportarEstudantes
