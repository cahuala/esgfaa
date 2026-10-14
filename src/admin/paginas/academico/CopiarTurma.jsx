import { useEffect, useState } from 'react'
import { api } from '../../api'

/*
  Novo ano letivo: copiar as cadeiras e os seus conteúdos de outra turma (normalmente a do ano anterior).
  As datas avançam os anos que separam os anos letivos; entregas, notas e fórum não se copiam.
*/
function CopiarTurma({ turma, fechar, concluido }) {
  const [turmas, setTurmas] = useState([])
  const [origem, setOrigem] = useState('')
  const [docentes, setDocentes] = useState(true)
  const [resultado, setResultado] = useState(null)
  const [erro, setErro] = useState('')
  const [aCopiar, setACopiar] = useState(false)
  useEffect(() => {
    api('/academico/turmas').then((l) => {
      const outras = l.filter((x) => x.id !== turma.id && x.cadeiras > 0)
      setTurmas(outras)
      // por omissão, a turma do mesmo curso do ano letivo anterior
      const anterior = outras.find((x) => x.curso === turma.curso && Number(x.anoLetivo.slice(0, 4)) === Number(turma.anoLetivo.slice(0, 4)) - 1)
      setOrigem(String((anterior || outras[0])?.id || ''))
    }).catch((e) => setErro(e.message))
  }, [turma])

  async function copiar() {
    setErro('')
    setACopiar(true)
    try {
      setResultado(await api(`/academico/turmas/${turma.id}/copiar`, { metodo: 'POST', corpo: { origemTurmaId: Number(origem), docentes } }))
      concluido()
    } catch (e) {
      setErro(e.message)
    } finally {
      setACopiar(false)
    }
  }

  return (
    <>
      <div className="modal d-block" tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="copiar-turma" onClick={() => !aCopiar && fechar()}>
        <div className="modal-dialog modal-lg modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title" id="copiar-turma"><i className="fa fa-copy me-2" />Copiar cadeiras para {turma.nome}</h4>
              <button type="button" className="btn-close" onClick={fechar} disabled={aCopiar} aria-label="Fechar" />
            </div>
            <div className="modal-body">
              {erro && <div className="alert alert-danger py-2">{erro}</div>}
              {!resultado ? (
                <>
                  <p className="text-muted">
                    Cria nesta turma as cadeiras da turma de origem (com o mesmo código) e copia os capítulos, materiais e ficheiros, trabalhos,
                    questionários, datas das provas, programa e composição das notas. As datas avançam os anos que separam os anos letivos.
                    Não se copiam entregas, notas, fórum nem presenças. Cadeiras que já tenham conteúdos ficam como estão.
                  </p>
                  <label className="form-label fw-bold" htmlFor="ct-origem">Copiar de</label>
                  <select id="ct-origem" className="form-select mb-3" value={origem} onChange={(e) => setOrigem(e.target.value)}>
                    {turmas.length === 0 && <option value="">Não há outras turmas com cadeiras</option>}
                    {turmas.map((x) => <option key={x.id} value={x.id}>{x.nome} — {x.anoLetivo} ({x.cadeiras} cadeiras)</option>)}
                  </select>
                  <div className="form-check">
                    <input id="ct-docentes" type="checkbox" className="form-check-input" checked={docentes} onChange={(e) => setDocentes(e.target.checked)} />
                    <label className="form-check-label" htmlFor="ct-docentes">Copiar também a alocação de docentes (regentes, assistentes e horas)</label>
                  </div>
                </>
              ) : (
                <>
                  <div className="alert alert-success py-2"><i className="fa fa-check-circle me-1" /> Cópia feita de {resultado.origem.nome} para {resultado.turma.nome}.</div>
                  <table className="table table-bordered align-middle mb-0">
                    <thead><tr><th>Cadeira</th><th className="text-center">Capítulos</th><th className="text-center">Materiais</th><th className="text-center">Trabalhos</th><th className="text-center">Questionários</th><th className="text-center">Datas</th><th>Estado</th></tr></thead>
                    <tbody>
                      {resultado.cadeiras.map((c) => (
                        <tr key={c.codigo}>
                          <td><b>{c.codigo}</b> {c.nome}</td>
                          {c.copiada
                            ? <>{['capitulos', 'materiais', 'trabalhos', 'questionarios', 'datas'].map((k) => <td key={k} className="text-center">{c[k]}</td>)}<td><span className="badge bg-success">{c.criada ? 'Criada e copiada' : 'Copiada'}</span></td></>
                            : <><td colSpan={5} className="text-muted small">—</td><td><span className="badge bg-gray-500">{c.motivo}</span></td></>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>
            <div className="modal-footer">
              {!resultado
                ? <><button type="button" className="btn btn-white" onClick={fechar} disabled={aCopiar}>Cancelar</button><button type="button" className="btn btn-theme" onClick={copiar} disabled={aCopiar || !origem}>{aCopiar ? <><span className="spinner-border spinner-border-sm me-1" />A copiar…</> : <><i className="fa fa-copy me-1" />Copiar</>}</button></>
                : <button type="button" className="btn btn-theme" onClick={fechar}>Fechar</button>}
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" />
    </>
  )
}

export default CopiarTurma
