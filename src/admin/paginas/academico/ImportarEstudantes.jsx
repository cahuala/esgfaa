import { useState } from 'react'
import { api } from '../../api'
import { lerFolha } from './lerFolha'

const ACOES = {
  criar: ['bg-success', 'Conta nova + matrícula'],
  matricular: ['bg-primary', 'Matricular (conta já existe)'],
  ja_matriculado: ['bg-gray-500', 'Já matriculado'],
  erro: ['bg-danger', 'Erro'],
}
const NOMES = { nome: 'Nome', email: 'E-mail', posto: 'Posto', ramo: 'Ramo', nip: 'NIP', telefone: 'Telefone' }

/*
  Importar estudantes de uma folha Excel (.xlsx) ou CSV: lê no navegador, mostra o que vai
  acontecer a cada linha (pré-visualização na API) e só depois cria as contas e matricula.
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
      if (f.faltam.length) throw new Error(`A folha precisa das colunas: ${f.faltam.map((k) => NOMES[k]).join(' e ')} (na primeira linha).`)
      if (!f.linhas.length) throw new Error('A folha não tem estudantes por baixo do cabeçalho.')
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

  const aGravar = previa ? previa.resumo.criar + previa.resumo.matricular : 0
  return (
    <>
      <div className="modal d-block" tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="imp-titulo" onClick={() => !aTrabalhar && fechar()}>
        <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable" onClick={(e) => e.stopPropagation()}>
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title" id="imp-titulo"><i className="fa fa-file-excel me-2" />Importar estudantes para {turma.nome}</h4>
              <button type="button" className="btn-close" onClick={fechar} disabled={aTrabalhar} aria-label="Fechar" />
            </div>
            <div className="modal-body">
              <p className="text-muted small mb-2">
                Excel (.xlsx) ou CSV com uma linha de cabeçalho. Colunas obrigatórias: <b>Nome</b> e <b>E-mail</b> (da Escola); opcionais: Posto, Ramo, NIP, Telefone.
                Quem ainda não tem conta recebe uma (a palavra-passe inicial é o e-mail); quem já tem é só matriculado.
              </p>
              {!feito && (
                <label className="d-block border border-2 border-dashed rounded p-4 text-center" style={{ cursor: 'pointer' }}>
                  <span className="d-block mb-2"><i className="fa fa-cloud-upload-alt fa-2x text-muted" /></span>
                  <span className="fw-bold">{folha ? folha.nome : 'Escolher a folha'}</span>
                  <input type="file" accept=".xlsx,.csv,.txt" className="d-none" onChange={(e) => escolher(e.target.files[0])} disabled={aTrabalhar} aria-label="Folha de estudantes" />
                </label>
              )}
              {aTrabalhar && <p className="text-muted mt-3 mb-0"><span className="spinner-border spinner-border-sm me-2" />A tratar a folha…</p>}
              {erro && <div className="alert alert-danger mt-3 mb-0">{erro}</div>}
              {feito && <div className="alert alert-success">Importação concluída: {feito.resumo.criar} conta(s) nova(s), {feito.resumo.criar + feito.resumo.matricular} matrícula(s){feito.resumo.erro ? `, ${feito.resumo.erro} linha(s) com erro` : ''}.</div>}
              {previa && (
                <>
                  <div className="d-flex flex-wrap gap-2 my-3">
                    {Object.entries(ACOES).map(([k, [cor, texto]]) => previa.resumo[k] ? <span key={k} className={`badge ${cor} fs-12px`}>{texto}: {previa.resumo[k]}</span> : null)}
                  </div>
                  <div className="table-responsive">
                    <table className="table table-sm table-striped align-middle mb-0">
                      <thead><tr><th>Linha</th><th>Nome</th><th>E-mail</th><th>Resultado</th></tr></thead>
                      <tbody>
                        {previa.linhas.map((l) => (
                          <tr key={l.linha} className={l.acao === 'erro' ? 'text-danger' : ''}>
                            <td className="text-muted">{l.linha + 1}</td>
                            <td>{l.nome}</td>
                            <td className="small">{l.email}</td>
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
              <button type="button" className="btn btn-white" onClick={fechar} disabled={aTrabalhar}>{feito ? 'Fechar' : 'Cancelar'}</button>
              {!feito && <button type="button" className="btn btn-theme" onClick={importar} disabled={aTrabalhar || !aGravar}><i className="fa fa-check me-1" />{aGravar ? `Importar ${aGravar} estudante(s)` : 'Importar'}</button>}
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" />
    </>
  )
}

export default ImportarEstudantes
