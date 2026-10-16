import { useState } from 'react'
import { api } from '../../api'
import FormularioInquerito from '../../../portal/inquerito/FormularioInquerito'
import { ESCALA } from '../../../portal/cadeira/escala'
import { t as tx } from '../../../i18n/linguas'
import '../../../portal/inquerito/formulario.css'

const TIPOS = {
  escala: { nome: tx('Escala linear (1 a 5)'), icone: 'fa-ellipsis-h' },
  escolha: { nome: tx('Escolha múltipla'), icone: 'fa-dot-circle' },
  aberta: { nome: tx('Resposta aberta'), icone: 'fa-align-left' },
}

/*
  Editor de um inquérito institucional com o aspeto do Google Forms: o cabeçalho com o título e a
  apresentação, um cartão por pergunta (texto, tipo, opções), e "Pré-visualizar" mostra o inquérito
  como o vai ver quem responde.
*/
function EditorInquerito({ f, setF, publicos, turmas, feito, falhou }) {
  const [aGuardar, setAGuardar] = useState(false)
  const [ver, setVer] = useState(false)
  const [ativa, setAtiva] = useState(0)
  const [respostasTeste, setRespostasTeste] = useState({})
  const perguntas = f.perguntas
  const mudarPerguntas = (l) => setF({ ...f, perguntas: l })
  const pergunta = (k, mud) => mudarPerguntas(perguntas.map((p, j) => (j === k ? { ...p, ...mud } : p)))
  const mover = (k, d) => { const l = [...perguntas]; [l[k], l[k + d]] = [l[k + d], l[k]]; mudarPerguntas(l); setAtiva(k + d) }
  const acrescentar = (depois) => {
    const l = [...perguntas]
    l.splice(depois + 1, 0, { tipo: 'escala', texto: '' })
    mudarPerguntas(l)
    setAtiva(depois + 1)
  }
  const duplicar = (k) => { const l = [...perguntas]; l.splice(k + 1, 0, structuredClone(perguntas[k])); mudarPerguntas(l); setAtiva(k + 1) }
  const retirar = (k) => { mudarPerguntas(perguntas.filter((_, j) => j !== k)); setAtiva(Math.max(0, k - 1)) }

  async function guardar(e) {
    e.preventDefault()
    setAGuardar(true)
    try {
      const corpo = { titulo: f.titulo, descricao: f.descricao, publico: f.publico, turmaIds: f.publico === 'docentes' ? [] : f.turmaIds, fecha: f.fecha ? new Date(f.fecha).toISOString() : '', perguntas }
      if (f.id) await api(`/academico/satisfacao/${f.id}`, { metodo: 'PUT', corpo })
      else await api('/academico/satisfacao', { metodo: 'POST', corpo })
      feito()
    } catch (falha) {
      falhou(falha)
    } finally {
      setAGuardar(false)
    }
  }

  return (
    <div className="gf-editor mb-4">
      <div className="gf-editor-barra">
        <b className="me-auto">{f.id ? tx('Editar inquérito') : tx('Novo inquérito')}</b>
        <div className="btn-group" role="tablist">
          <button type="button" role="tab" aria-selected={!ver} className={`btn btn-sm ${!ver ? 'btn-dark' : 'btn-white'}`} onClick={() => setVer(false)}><i className="fa fa-pen me-1" />{tx('Perguntas')}</button>
          <button type="button" role="tab" aria-selected={ver} className={`btn btn-sm ${ver ? 'btn-dark' : 'btn-white'}`} onClick={() => setVer(true)}><i className="fa fa-eye me-1" />{tx('Pré-visualizar')}</button>
        </div>
      </div>

      {ver ? (
        <>
          <div className="gf mb-2"><div className="alert alert-info mb-0 py-2 small"><i className="fa fa-eye me-1" />{tx('Assim vê o inquérito quem responde. As respostas daqui não são guardadas.')}</div></div>
          <FormularioInquerito
            titulo={f.titulo || tx('Inquérito sem título')} descricao={f.descricao} anonimo
            perguntas={perguntas.filter((p) => p.texto.trim()).map((p) => (p.tipo === 'escolha' ? { ...p, opcoes: p.opcoes.map((o, j) => o.trim() || tx('Opção {0}', { 0: j + 1 })) } : p))} respostas={respostasTeste}
            definir={(k, v) => setRespostasTeste((r) => ({ ...r, [k]: v }))} limpar={() => setRespostasTeste({})}
            aoEnviar={() => setVer(false)} textoEnviar={tx('Enviar (teste)')}
          />
        </>
      ) : (
        <form className="gf" onSubmit={guardar}>
          <div className={`gf-cartao gf-topo ${ativa === -1 ? 'gf-ativa' : ''}`} onFocus={() => setAtiva(-1)}>
            <input className="gf-campo gf-campo-titulo" value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} placeholder={tx('Título do inquérito')} aria-label={tx('Título')} required maxLength={200} />
            <textarea className="gf-campo" rows={2} value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} placeholder={tx('Texto de apresentação')} aria-label={tx('Texto de apresentação')} maxLength={2000} />
            <div className="gf-definicoes">
              <label>
                <span>{tx('Para')}</span>
                <select className="form-select form-select-sm" value={f.publico} onChange={(e) => setF({ ...f, publico: e.target.value })}>{Object.entries(publicos).map(([k, v]) => <option key={k} value={k}>{tx(v)}</option>)}</select>
              </label>
              <label>
                <span>{tx('Responder até')}</span>
                <input type="datetime-local" className="form-control form-control-sm" value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} required />
              </label>
            </div>
            {f.publico !== 'docentes' && turmas.length > 0 && (
              <div className="gf-definicoes d-block">
                <span className="d-block mb-1">{tx('Turmas (nenhuma marcada = todos os estudantes)')}</span>
                <div className="d-flex flex-wrap gap-2">
                  {turmas.map((t) => (
                    <label key={t.id} className={`btn btn-sm ${f.turmaIds.includes(t.id) ? 'btn-theme' : 'btn-white'}`}>
                      <input type="checkbox" className="d-none" checked={f.turmaIds.includes(t.id)} onChange={(e) => setF({ ...f, turmaIds: e.target.checked ? [...f.turmaIds, t.id] : f.turmaIds.filter((x) => x !== t.id) })} />{t.nome}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {perguntas.map((p, k) => (
            <div key={k} className={`gf-cartao gf-pergunta ${ativa === k ? 'gf-ativa' : ''}`} onFocus={() => setAtiva(k)} onClick={() => setAtiva(k)} role="group" aria-label={tx('Pergunta {0}', { 0: k + 1 })}>
              <div className="gf-editor-linha">
                <input className="gf-campo gf-campo-pergunta" value={p.texto} onChange={(e) => pergunta(k, { texto: e.target.value })} required maxLength={300}
                  placeholder={p.tipo === 'escala' ? tx('Afirmação (de discordo totalmente a concordo totalmente)') : tx('Pergunta')} aria-label={tx('Texto da pergunta {0}', { 0: k + 1 })} />
                <select className="form-select gf-tipo" value={p.tipo} aria-label={tx('Tipo da pergunta {0}', { 0: k + 1 })}
                  onChange={(e) => pergunta(k, { tipo: e.target.value, ...(e.target.value === 'escolha' && !p.opcoes ? { opcoes: ['', ''] } : {}) })}>
                  {Object.entries(TIPOS).map(([t, x]) => <option key={t} value={t}>{x.nome}</option>)}
                </select>
              </div>

              {p.tipo === 'escala' && (
                <div className="gf-escala gf-escala-modelo" aria-hidden="true">
                  <span className="gf-escala-ponta">{ESCALA[0]}</span>
                  {ESCALA.map((_, j) => <span key={j} className="gf-escala-opcao"><span>{j + 1}</span><i className="gf-circulo" /></span>)}
                  <span className="gf-escala-ponta">{ESCALA[4]}</span>
                </div>
              )}
              {p.tipo === 'aberta' && <div className="gf-modelo-texto">{tx('Texto da resposta (opcional para quem responde)')}</div>}
              {p.tipo === 'escolha' && (
                <div className="gf-opcoes">
                  {(p.opcoes || []).map((o, j) => (
                    <div key={j} className="gf-opcao gf-opcao-editar">
                      <i className={p.multipla ? 'gf-quadrado' : 'gf-circulo'} aria-hidden="true" />
                      <input className="gf-campo" value={o} onChange={(e) => pergunta(k, { opcoes: p.opcoes.map((x, n) => (n === j ? e.target.value : x)) })} required maxLength={200}
                        placeholder={tx('Opção {0}', { 0: j + 1 })} aria-label={tx('Opção {0} da pergunta {1}', { 0: j + 1, 1: k + 1 })} />
                      {p.opcoes.length > 2 && <button type="button" className="gf-icone" onClick={() => pergunta(k, { opcoes: p.opcoes.filter((_, n) => n !== j) })} aria-label={tx('Retirar opção')} title={tx('Retirar opção')}><i className="fa fa-times" /></button>}
                    </div>
                  ))}
                  {p.opcoes?.length < 10 && (
                    <div className="gf-opcao gf-opcao-editar">
                      <i className={p.multipla ? 'gf-quadrado' : 'gf-circulo'} aria-hidden="true" />
                      <button type="button" className="gf-acrescentar-opcao" onClick={() => pergunta(k, { opcoes: [...p.opcoes, ''] })}>{tx('Adicionar opção')}</button>
                    </div>
                  )}
                </div>
              )}

              <div className="gf-rodape-pergunta">
                <span className="gf-tipo-legenda"><i className={`fa ${TIPOS[p.tipo].icone} me-1`} />{TIPOS[p.tipo].nome}{p.tipo !== 'aberta' && <span className="gf-obrigatoria ms-2">* {tx('obrigatória')}</span>}</span>
                {p.tipo === 'escolha' && (
                  <label className="form-check form-switch mb-0 small">
                    <input className="form-check-input" type="checkbox" checked={Boolean(p.multipla)} onChange={(e) => pergunta(k, { multipla: e.target.checked })} />
                    <span className="form-check-label">{tx('Várias respostas')}</span>
                  </label>
                )}
                <span className="gf-separador" />
                <button type="button" className="gf-icone" disabled={k === 0} onClick={() => mover(k, -1)} aria-label={tx('Subir')} title={tx('Subir')}><i className="fa fa-arrow-up" /></button>
                <button type="button" className="gf-icone" disabled={k === perguntas.length - 1} onClick={() => mover(k, 1)} aria-label={tx('Descer')} title={tx('Descer')}><i className="fa fa-arrow-down" /></button>
                <button type="button" className="gf-icone" disabled={perguntas.length >= 30} onClick={() => duplicar(k)} aria-label={tx('Duplicar')} title={tx('Duplicar')}><i className="far fa-copy" /></button>
                <button type="button" className="gf-icone" disabled={perguntas.length === 1} onClick={() => retirar(k)} aria-label={tx('Retirar pergunta')} title={tx('Retirar pergunta')}><i className="far fa-trash-alt" /></button>
              </div>
            </div>
          ))}

          {perguntas.length < 30 && (
            <button type="button" className="gf-cartao gf-nova" onClick={() => acrescentar(ativa >= 0 ? ativa : perguntas.length - 1)}>
              <i className="fa fa-plus-circle me-2" />{tx('Adicionar pergunta')}
            </button>
          )}

          <div className="gf-acoes">
            <button type="submit" className="btn btn-theme gf-enviar" disabled={aGuardar}>{aGuardar ? tx('A guardar…') : tx('Guardar rascunho')}</button>
            <button type="button" className="gf-limpar" onClick={() => setF(null)}>{tx('Cancelar')}</button>
          </div>
        </form>
      )}
    </div>
  )
}

export default EditorInquerito
