import { useState } from 'react'
import { api } from '../api'
import { Campo } from '../componentes'
import { localParaIso, paraLocal } from '../formatar'

const NOMES = { material: 'Material', trabalho: 'Trabalho', questionario: 'Questionário', inquerito: 'Inquérito' }

/*
  Restringir o acesso a uma atividade (como o "Restrict access" do Moodle): visível ou escondida,
  data a partir da qual abre e condições — "só abre depois de concluir X", com nota mínima opcional.
  Para um capítulo (secao) há só a visibilidade e a data de abertura.
  atividades: todas as da cadeira [{ especie, id, titulo }], para escolher as condições.
*/
function Restricoes({ alvo, secao, atividades = [], fechar, avisar, guardado }) {
  const [f, setF] = useState({
    visivel: (secao || alvo).visivel !== false,
    disponivelDe: paraLocal((secao || alvo).disponivelDe),
    requisitos: (alvo?.requisitos || []).map((r) => ({ chave: `${r.tipo}-${r.id}`, notaMinima: r.notaMinima ?? '' })),
  })
  const [erro, setErro] = useState('')
  const [aGuardar, setAGuardar] = useState(false)
  const opcoes = atividades.filter((a) => !alvo || a.chave !== alvo.chave)
  const daChave = (k) => opcoes.find((a) => a.chave === k)
  const requisito = (i, campo, v) => setF({ ...f, requisitos: f.requisitos.map((r, j) => (i === j ? { ...r, [campo]: v } : r)) })
  const livres = opcoes.filter((a) => !f.requisitos.some((r) => r.chave === a.chave))

  async function guardar(e) {
    e.preventDefault()
    setErro('')
    setAGuardar(true)
    const disponivelDe = f.disponivelDe ? localParaIso(f.disponivelDe) : null
    try {
      if (secao) await api(`/secoes/${secao.id}`, { metodo: 'PUT', corpo: { visivel: f.visivel, disponivelDe } })
      else {
        const requisitos = f.requisitos.map((r) => {
          const a = daChave(r.chave)
          return { tipo: a.especie, id: a.id, ...(r.notaMinima !== '' && !['material', 'inquerito'].includes(a.especie) ? { notaMinima: r.notaMinima } : {}) }
        })
        await api('/atividades/restricoes', { metodo: 'PUT', corpo: { tipo: alvo.especie, id: alvo.id, visivel: f.visivel, disponivelDe, requisitos } })
      }
      avisar({ texto: 'Restrições guardadas.' })
      guardado()
    } catch (falha) {
      setErro(falha.message)
      setAGuardar(false)
    }
  }

  return (
    <>
      <div className="modal d-block" tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="restricoes-titulo" onClick={() => !aGuardar && fechar()}>
        <div className="modal-dialog modal-lg modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
          <form className="modal-content" onSubmit={guardar}>
            <div className="modal-header">
              <h4 className="modal-title" id="restricoes-titulo"><i className="fa fa-lock me-2" />Acesso: {(secao || alvo).titulo}</h4>
              <button type="button" className="btn-close" onClick={fechar} disabled={aGuardar} aria-label="Fechar" />
            </div>
            <div className="modal-body p-formulario">
              {erro && <p className="p-erro" role="alert">{erro}</p>}
              <div className="form-check form-switch">
                <input id="r-visivel" className="form-check-input" type="checkbox" checked={f.visivel} onChange={(e) => setF({ ...f, visivel: e.target.checked })} />
                <label className="form-check-label fw-bold" htmlFor="r-visivel">Visível para os estudantes</label>
                <div className="small text-muted">{secao ? 'Um capítulo escondido esconde todas as suas atividades.' : 'Escondida, a atividade não aparece nem conta para o progresso.'}</div>
              </div>
              <Campo id="r-data" rotulo="Disponível a partir de (opcional)" ajuda={secao ? 'Até lá, as atividades do capítulo aparecem fechadas.' : 'Até lá aparece fechada, com a data de abertura.'}>
                <input id="r-data" type="datetime-local" value={f.disponivelDe} onChange={(e) => setF({ ...f, disponivelDe: e.target.value })} />
              </Campo>

              {!secao && (
                <div>
                  <span className="form-label fw-bold d-block mb-1">Só abre depois de concluir</span>
                  <p className="small text-muted mb-2">Material: marcado como feito. Trabalho: entregue. Questionário: feito. Inquérito: respondido. Com nota mínima, conta a nota do trabalho ou a melhor do questionário.</p>
                  {f.requisitos.length === 0 && <div className="small text-muted mb-2">Sem condições.</div>}
                  {f.requisitos.map((r, i) => {
                    const a = daChave(r.chave)
                    return (
                      <div key={i} className="d-flex gap-2 align-items-center mb-2">
                        <select className="form-select form-select-sm" value={r.chave} onChange={(e) => requisito(i, 'chave', e.target.value)} aria-label={`Condição ${i + 1}`}>
                          {a && <option value={a.chave}>{NOMES[a.especie]}: {a.titulo}</option>}
                          {livres.map((x) => <option key={x.chave} value={x.chave}>{NOMES[x.especie]}: {x.titulo}</option>)}
                        </select>
                        {a && !['material', 'inquerito'].includes(a.especie) && (
                          <input className="form-control form-control-sm" style={{ width: 130 }} inputMode="decimal" value={r.notaMinima} onChange={(e) => requisito(i, 'notaMinima', e.target.value)} placeholder="Nota mínima" aria-label={`Nota mínima da condição ${i + 1}`} />
                        )}
                        <button type="button" className="btn btn-xs btn-white" onClick={() => setF({ ...f, requisitos: f.requisitos.filter((_, j) => j !== i) })} aria-label="Retirar condição"><i className="fa fa-times" /></button>
                      </div>
                    )
                  })}
                  {livres.length > 0 && f.requisitos.length < 10 && (
                    <button type="button" className="btn btn-xs btn-white" onClick={() => setF({ ...f, requisitos: [...f.requisitos, { chave: livres[0].chave, notaMinima: '' }] })}><i className="fa fa-plus me-1" />Condição</button>
                  )}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-white" onClick={fechar} disabled={aGuardar}>Cancelar</button>
              <button type="submit" className="btn btn-theme" disabled={aGuardar}>{aGuardar ? 'A guardar…' : 'Guardar'}</button>
            </div>
          </form>
        </div>
      </div>
      <div className="modal-backdrop fade show" />
    </>
  )
}

export default Restricoes
