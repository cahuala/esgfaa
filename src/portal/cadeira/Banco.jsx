import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import { Aviso, Cartao, Carregando, Titulo, Vazio } from '../componentes'
import { nota } from '../formatar'
import FormPergunta, { SolucaoPergunta } from './FormPergunta'
import { TIPOS_PERGUNTA } from './tiposPergunta'
import { confirmar } from '../dialogos'

// agrupa as perguntas do banco por categoria
const porCategoria = (lista) => lista.reduce((m, p) => ((m[p.categoria] ||= []).push(p), m), {})

// janela para escolher perguntas do banco e juntá-las a um questionário
export function BancoJanela({ fechar, juntar }) {
  const [lista, setLista] = useState(null)
  const [escolhidas, setEscolhidas] = useState(new Set())
  const [filtro, setFiltro] = useState('')
  const [erro, setErro] = useState('')
  useEffect(() => { api('/banco').then(setLista).catch((e) => setErro(e.message)) }, [])
  const alternar = (id) => setEscolhidas((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const visiveis = (lista || []).filter((p) => !filtro || `${p.categoria} ${p.enunciado}`.toLowerCase().includes(filtro.toLowerCase()))

  return (
    <>
      <div className="modal d-block" tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="banco-t" onClick={fechar}>
        <div className="modal-dialog modal-lg modal-dialog-scrollable" onClick={(e) => e.stopPropagation()}>
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title" id="banco-t"><i className="fa fa-archive me-2" />Juntar do banco de perguntas</h4>
              <button type="button" className="btn-close" onClick={fechar} aria-label="Fechar" />
            </div>
            <div className="modal-body">
              {erro && <div className="alert alert-danger py-2">{erro}</div>}
              <input className="form-control mb-3" placeholder="Procurar por categoria ou enunciado" value={filtro} onChange={(e) => setFiltro(e.target.value)} aria-label="Procurar no banco" />
              {!lista ? <Carregando /> : !lista.length ? <Vazio>O seu banco está vazio. Guarde perguntas a partir de um questionário (botão <i className="fa fa-archive" />) ou na página "Banco de perguntas".</Vazio> : (
                Object.entries(porCategoria(visiveis)).map(([cat, ps]) => (
                  <div key={cat} className="mb-3">
                    <div className="p-dia-titulo px-2 py-1 rounded mb-1">{cat} ({ps.length})</div>
                    {ps.map((p) => (
                      <label key={p.id} className="d-flex gap-2 align-items-start py-1 border-bottom">
                        <input type="checkbox" className="form-check-input mt-1" checked={escolhidas.has(p.id)} onChange={() => alternar(p.id)} />
                        <span><b>{p.enunciado}</b> <span className="small text-muted">· {TIPOS_PERGUNTA[p.tipo]} · {nota(p.pontos)} pt</span></span>
                      </label>
                    ))}
                  </div>
                ))
              )}
            </div>
            <div className="modal-footer">
              <span className="me-auto small text-muted">{escolhidas.size} escolhida(s)</span>
              <button type="button" className="btn btn-white" onClick={fechar}>Cancelar</button>
              <button type="button" className="btn btn-theme" disabled={!escolhidas.size} onClick={() => juntar([...escolhidas]).catch((e) => setErro(e.message))}><i className="fa fa-plus me-1" />Juntar ao questionário</button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" />
    </>
  )
}

// página do banco de perguntas do docente (como o "Question bank" do Moodle)
function Banco() {
  const [lista, setLista] = useState(null)
  const [aviso, setAviso] = useState(null)
  const [categoria, setCategoria] = useState('')
  const carregar = useCallback(() => api('/banco').then(setLista).catch((e) => setAviso({ tipo: 'erro', texto: e.message })), [])
  useEffect(() => { carregar() }, [carregar])
  if (!lista) return <Carregando />
  const grupos = porCategoria(lista)
  const visiveis = categoria ? { [categoria]: grupos[categoria] || [] } : grupos

  return (
    <>
      <Titulo rotulo="Banco de perguntas" titulo="Banco de perguntas" sub={`${lista.length} pergunta(s) em ${Object.keys(grupos).length} categoria(s)`} />
      <div className="row">
        <div className="col-xl-7">
          <div className="d-flex gap-2 mb-3 flex-wrap">
            <button type="button" className={`btn btn-sm ${!categoria ? 'btn-dark' : 'btn-white'}`} onClick={() => setCategoria('')}>Todas</button>
            {Object.keys(grupos).map((c) => <button key={c} type="button" className={`btn btn-sm ${categoria === c ? 'btn-dark' : 'btn-white'}`} onClick={() => setCategoria(c)}>{c} <span className="badge bg-gray-500 ms-1">{grupos[c].length}</span></button>)}
          </div>
          {!lista.length && <Vazio>Ainda não guardou perguntas. Crie-as aqui ou guarde-as a partir dos seus questionários.</Vazio>}
          {Object.entries(visiveis).map(([cat, ps]) => (
            <Cartao key={cat} titulo={<><i className="fa fa-folder-open me-2" />{cat}</>} corpo={false}>
              <div className="list-group list-group-flush">
                {ps.map((p) => (
                  <div key={p.id} className="list-group-item">
                    <div className="d-flex justify-content-between gap-2">
                      <span><b>{p.enunciado}</b> <span className="small text-muted">· {TIPOS_PERGUNTA[p.tipo]} · {nota(p.pontos)} pt</span></span>
                      <button type="button" className="btn btn-xs btn-white text-danger" aria-label="Apagar do banco" onClick={async () => (await confirmar('Apagar esta pergunta do banco? (Os questionários que já a usam ficam como estão.)', { titulo: 'Apagar pergunta', botao: 'Apagar', perigo: true })) && api(`/banco/${p.id}`, { metodo: 'DELETE' }).then(carregar).catch((e) => setAviso({ tipo: 'erro', texto: e.message }))}><i className="fa fa-trash-alt" /></button>
                    </div>
                    <SolucaoPergunta p={p} />
                  </div>
                ))}
              </div>
            </Cartao>
          ))}
        </div>
        <div className="col-xl-5">
          <Cartao titulo={<><i className="fa fa-plus me-2" />Nova pergunta no banco</>}>
            <FormPergunta comCategoria botao="Guardar no banco" guardar={async (corpo) => { await api('/banco', { metodo: 'POST', corpo }); setAviso({ texto: 'Pergunta guardada no banco.' }); carregar() }} />
          </Cartao>
        </div>
      </div>
      <Aviso aviso={aviso} onFechar={() => setAviso(null)} />
    </>
  )
}

export default Banco
