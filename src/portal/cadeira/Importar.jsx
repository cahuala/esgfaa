import { useEffect, useState } from 'react'
import { api } from '../api'
import { PERIODOS } from '../regraAvaliacao'

// importar conteúdos de outra cadeira do docente (de outro ano ou turma), como o "Importar" do Moodle
function Importar({ c, fechar, avisar, concluido }) {
  const [lista, setLista] = useState(null)
  const [origem, setOrigem] = useState('')
  const [aImportar, setAImportar] = useState(false)
  useEffect(() => {
    api('/cadeiras').then((l) => {
      const outras = l.filter((x) => x.id !== c.id)
      setLista(outras)
      setOrigem(String(outras.find((x) => x.codigo === c.codigo)?.id || ''))
    }).catch(() => setLista([]))
  }, [c.id, c.codigo])

  async function importar() {
    setAImportar(true)
    try {
      const r = await api(`/cadeiras/${c.id}/importar`, { metodo: 'POST', corpo: { origemId: Number(origem) } })
      avisar({ texto: `Importados: ${r.capitulos} capítulos, ${r.materiais} materiais, ${r.trabalhos} trabalhos, ${r.questionarios} questionários.` })
      concluido()
      fechar()
    } catch (e) {
      avisar({ tipo: 'erro', texto: e.message })
      setAImportar(false)
    }
  }

  return (
    <>
      <div className="modal d-block" tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="importar-titulo" onClick={() => !aImportar && fechar()}>
        <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title" id="importar-titulo"><i className="fa fa-file-import me-2" />Importar de outra cadeira</h4>
              <button type="button" className="btn-close" onClick={fechar} disabled={aImportar} aria-label="Fechar" />
            </div>
            <div className="modal-body">
              <p className="small text-muted">Copia para esta cadeira os capítulos, materiais e ficheiros, trabalhos, questionários, datas, programa e composição das notas de outra cadeira sua (por exemplo, a do ano passado). As datas avançam os anos que separam os anos letivos. Não se copiam entregas, notas nem fórum.</p>
              {!lista ? <div className="text-muted">A carregar…</div> : lista.length === 0 ? <div className="alert alert-info mb-0">Não tem outras cadeiras de onde importar.</div> : (
                <div className="list-group">
                  {lista.map((x) => (
                    <label key={x.id} className={`list-group-item list-group-item-action d-flex gap-2 align-items-center ${origem === String(x.id) ? 'active' : ''}`}>
                      <input type="radio" name="origem" className="form-check-input mt-0" checked={origem === String(x.id)} onChange={() => setOrigem(String(x.id))} />
                      <span><b>{x.codigo}</b> · {x.nome}<span className="d-block small opacity-75">{x.turma?.nome} · {PERIODOS[x.periodo]}</span></span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-white" onClick={fechar} disabled={aImportar}>Cancelar</button>
              <button type="button" className="btn btn-theme" onClick={importar} disabled={!origem || aImportar}>{aImportar ? 'A importar…' : 'Importar'}</button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" />
    </>
  )
}

export default Importar
