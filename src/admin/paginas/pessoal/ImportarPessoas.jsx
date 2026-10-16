import { useState } from 'react'
import { api } from '../../api'
import { lerFolha } from '../academico/lerFolha'
import { t as tx } from '../../../i18n/linguas'

const ACOES = {
  registar: ['bg-success', tx('Registar')],
  registado: ['bg-success', tx('Registado')],
  ja_registado: ['bg-gray-500', tx('Já registado')],
  erro: ['bg-danger', tx('Erro')],
}
const NOMES = { nome: 'Nome', email: 'E-mail', posto: tx('Posto'), ramo: tx('Ramo'), nip: 'NIP', telefone: tx('Telefone') }

/*
  Registar estudantes ou docentes de uma folha Excel (.xlsx) ou CSV (Pessoal e Quadros): lê no navegador,
  mostra o que vai acontecer a cada linha (pré-visualização na API) e só depois regista.
  A matrícula nas turmas é da Administração Escolar.
*/
function ImportarPessoas({ fechar, concluido }) {
  const [tipo, setTipo] = useState('estudante')
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
      if (f.faltam.length) throw new Error(tx('A folha precisa das colunas: {0} (na primeira linha).', { 0: f.faltam.map((k) => NOMES[k]).join(' e ') }))
      if (!f.linhas.length) throw new Error(tx('A folha não tem estudantes por baixo do cabeçalho.'))
      setPrevia(await api('/academico/contas/importar', { metodo: 'POST', corpo: { tipo, linhas: f.linhas, simular: true } }))
    } catch (e) {
      setErro(e.message)
    } finally {
      setATrabalhar(false)
    }
  }

  async function importar() {
    setATrabalhar(true)
    try {
      const r = await api('/academico/contas/importar', { metodo: 'POST', corpo: { tipo, linhas: folha.linhas, simular: false } })
      setFeito(r)
      setPrevia(r)
      concluido()
    } catch (e) {
      setErro(e.message)
    } finally {
      setATrabalhar(false)
    }
  }

  const aGravar = previa && !feito ? previa.resumo.registar : 0
  return (
    <>
      <div className="modal d-block" tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="imp-titulo" onClick={() => !aTrabalhar && fechar()}>
        <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable" onClick={(e) => e.stopPropagation()}>
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title" id="imp-titulo"><i className="fa fa-file-excel me-2" />{tx('Registar a partir de uma folha')}</h4>
              <button type="button" className="btn-close" onClick={fechar} disabled={aTrabalhar} aria-label={tx('Fechar')} />
            </div>
            <div className="modal-body">
              <p className="text-muted small mb-2">
                {tx('Excel (.xlsx) ou CSV com uma linha de cabeçalho. Colunas obrigatórias:')} <b>{tx('Nome')}</b> {tx('e')} <b>{tx('E-mail')}</b> {tx('(da Escola); opcionais: Posto, Ramo, NIP, Telefone. Cada pessoa nova recebe a conta do portal (a palavra-passe inicial é o e-mail); quem já está registado não se repete.')}
              </p>
              {!feito && (
                <div className="btn-group mb-2" role="group" aria-label={tx('Tipo de pessoa')}>
                  {[['estudante', tx('Estudantes')], ['docente', tx('Docentes')]].map(([k, t]) => <button key={k} type="button" className={`btn btn-sm ${tipo === k ? 'btn-theme' : 'btn-white'}`} onClick={() => { setTipo(k); setPrevia(null); setFolha(null) }}>{t}</button>)}
                </div>
              )}
              {!feito && (
                <label className="d-block border border-2 border-dashed rounded p-4 text-center" style={{ cursor: 'pointer' }}>
                  <span className="d-block mb-2"><i className="fa fa-cloud-upload-alt fa-2x text-muted" /></span>
                  <span className="fw-bold">{folha ? folha.nome : tx('Escolher a folha')}</span>
                  <input type="file" accept=".xlsx,.csv,.txt" className="d-none" onChange={(e) => escolher(e.target.files[0])} disabled={aTrabalhar} aria-label={tx('Folha de estudantes')} />
                </label>
              )}
              {aTrabalhar && <p className="text-muted mt-3 mb-0"><span className="spinner-border spinner-border-sm me-2" />{tx('A tratar a folha…')}</p>}
              {erro && <div className="alert alert-danger mt-3 mb-0">{erro}</div>}
              {feito && <div className="alert alert-success">{tx('Registo concluído:')} {feito.resumo.registar} {tx('pessoa(s) registada(s)')}{feito.resumo.ja_registado ? tx(', {0} já estava(m) registada(s)', { 0: feito.resumo.ja_registado }) : ''}{feito.resumo.erro ? tx(', {0} linha(s) com erro', { 0: feito.resumo.erro }) : ''}.</div>}
              {previa && (
                <>
                  <div className="d-flex flex-wrap gap-2 my-3">
                    {Object.entries(ACOES).map(([k, [cor, texto]]) => previa.resumo[k] ? <span key={k} className={`badge ${cor} fs-12px`}>{texto}: {previa.resumo[k]}</span> : null)}
                  </div>
                  <div className="table-responsive">
                    <table className="table table-sm table-striped align-middle mb-0">
                      <thead><tr><th>{tx('Linha')}</th><th>{tx('Nome')}</th><th>{tx('E-mail')}</th><th>{tx('Resultado')}</th></tr></thead>
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
              <button type="button" className="btn btn-white" onClick={fechar} disabled={aTrabalhar}>{feito ? tx('Fechar') : tx('Cancelar')}</button>
              {!feito && <button type="button" className="btn btn-theme" onClick={importar} disabled={aTrabalhar || !aGravar}><i className="fa fa-check me-1" />{aGravar ? tx('Registar {0} {1}', { 0: aGravar, 1: tipo === 'docente' ? 'docente(s)' : 'estudante(s)' }) : tx('Registar')}</button>}
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" />
    </>
  )
}

export default ImportarPessoas
