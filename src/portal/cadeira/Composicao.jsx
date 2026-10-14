import { useState } from 'react'
import { NOMES_COMPONENTES } from '../regraAvaliacao'

/*
  Janela "Como se calcula a componente" (livro de notas): escolher trabalhos e questionários
  e os seus pesos; ou voltar a lançar à mão. guardar(itens | null) devolve uma promessa.
  Usada no portal (docente) e no painel (Administração Escolar).
*/
function Composicao({ componente, atividades, atual, guardar, fechar }) {
  const [itens, setItens] = useState(() => Object.fromEntries((atual || []).map((i) => [`${i.tipo}-${i.id}`, String(i.peso)])))
  const [erro, setErro] = useState('')
  const [aGuardar, setAGuardar] = useState(false)
  const escolhidas = Object.keys(itens)
  const total = escolhidas.reduce((s, k) => s + (Number(itens[k]) || 0), 0)

  async function submeter(valor) {
    setErro('')
    setAGuardar(true)
    try {
      await guardar(valor)
      fechar()
    } catch (e) {
      setErro(e.message)
    } finally {
      setAGuardar(false)
    }
  }

  const alternar = (k) => setItens((x) => { const n = { ...x }; if (n[k] !== undefined) delete n[k]; else n[k] = '1'; return n })

  return (
    <>
      <div className="modal d-block" tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="composicao-titulo" onClick={() => !aGuardar && fechar()}>
        <div className="modal-dialog modal-lg modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title" id="composicao-titulo"><i className="fa fa-calculator me-2" />Como se calcula: {NOMES_COMPONENTES[componente]}</h4>
              <button type="button" className="btn-close" onClick={fechar} disabled={aGuardar} aria-label="Fechar" />
            </div>
            <div className="modal-body">
              {erro && <div className="alert alert-danger py-2">{erro}</div>}
              <p className="text-muted small">
                Escolha os trabalhos e questionários que contam e o peso de cada um. A nota é a média ponderada (0 a 20).
                Quem não entregar depois do prazo, ou não fizer o questionário até fechar, fica com 0. Enquanto faltar a correção de alguma atividade, a nota fica por calcular.
              </p>
              {atividades.length === 0 ? <div className="alert alert-info mb-0">Esta cadeira ainda não tem trabalhos nem questionários.</div> : (
                <table className="table table-hover align-middle mb-0">
                  <thead><tr><th style={{ width: 40 }} /><th>Atividade</th><th style={{ width: 130 }}>Peso</th><th className="text-end" style={{ width: 80 }}>%</th></tr></thead>
                  <tbody>
                    {atividades.map((a) => {
                      const k = `${a.tipo}-${a.id}`
                      const marcado = itens[k] !== undefined
                      return (
                        <tr key={k} className={marcado ? '' : 'text-muted'}>
                          <td><input type="checkbox" className="form-check-input" checked={marcado} onChange={() => alternar(k)} aria-label={`Contar ${a.titulo}`} /></td>
                          <td><i className={`fa ${a.tipo === 'trabalho' ? 'fa-file-signature text-orange' : 'fa-question-circle text-purple'} me-2`} />{a.titulo}</td>
                          <td><input type="number" min={1} max={100} className="form-control form-control-sm" disabled={!marcado} value={itens[k] ?? ''} onChange={(e) => setItens({ ...itens, [k]: e.target.value })} aria-label={`Peso de ${a.titulo}`} /></td>
                          <td className="text-end">{marcado && total ? `${Math.round(((Number(itens[k]) || 0) / total) * 100)} %` : ''}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
            <div className="modal-footer">
              {atual && <button type="button" className="btn btn-white me-auto" disabled={aGuardar} onClick={() => submeter(null)}><i className="fa fa-pen me-1" />Voltar a lançar à mão</button>}
              <button type="button" className="btn btn-white" onClick={fechar} disabled={aGuardar}>Cancelar</button>
              <button type="button" className="btn btn-theme" disabled={aGuardar || !escolhidas.length} onClick={() => submeter(escolhidas.map((k) => { const [tipo, id] = k.split('-'); return { tipo, id: Number(id), peso: Number(itens[k]) || 1 } }))}>
                <i className="fa fa-calculator me-1" />Calcular a partir destas atividades
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" />
    </>
  )
}

export default Composicao
