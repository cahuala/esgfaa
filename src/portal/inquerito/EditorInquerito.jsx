import { useState } from 'react'
import FormularioInquerito from './FormularioInquerito'
import { TIPOS_EDITOR, eObrigatoria, escalaDe, mudarTipo, tipoEditor } from './tipos'
import { t as tx } from '../../i18n/linguas'
import './formulario.css'

const MAX_ITENS = 60

/*
  Editor de um inquérito com o aspeto do Google Forms: o cabeçalho com o título e a apresentação, um cartão
  por pergunta (texto, descrição, tipo, opções, "Obrigatória"), as secções (cada uma é uma página para quem
  responde) e "Pré-visualizar" mostra o inquérito como o vai ver quem responde.
  Serve a Administração Escolar (inquéritos institucionais: publicos e turmas dizem para quem é) e o docente
  (inquérito da cadeira, para os seus estudantes: anonimoEditavel). guardar(corpo, id) grava; feito() fecha.
*/
function EditorInquerito({ f, setF, publicos = null, turmas = [], guardar: gravar, feito, falhou, anonimoEditavel = false, cancelar = null, textoGuardar = null }) {
  const [aGuardar, setAGuardar] = useState(false)
  const [ver, setVer] = useState(false)
  const [ativa, setAtiva] = useState(0)
  const [respostasTeste, setRespostasTeste] = useState({})
  const perguntas = f.perguntas
  const mudarPerguntas = (l) => setF({ ...f, perguntas: l })
  const pergunta = (k, mud) => mudarPerguntas(perguntas.map((p, j) => (j === k ? { ...p, ...mud } : p)))
  const mover = (k, d) => { const l = [...perguntas]; [l[k], l[k + d]] = [l[k + d], l[k]]; mudarPerguntas(l); setAtiva(k + d) }
  const acrescentar = (depois, nova = { tipo: 'escolha', texto: '', opcoes: [''], obrigatoria: true }) => {
    const l = [...perguntas]
    l.splice(depois + 1, 0, nova)
    mudarPerguntas(l)
    setAtiva(depois + 1)
  }
  const duplicar = (k) => { const l = [...perguntas]; l.splice(k + 1, 0, structuredClone(perguntas[k])); mudarPerguntas(l); setAtiva(k + 1) }
  const retirar = (k) => { mudarPerguntas(perguntas.filter((_, j) => j !== k)); setAtiva(Math.max(0, k - 1)) }
  const nPerguntas = perguntas.filter((p) => p.tipo !== 'seccao').length

  async function guardar(e) {
    e.preventDefault()
    setAGuardar(true)
    try {
      const corpo = {
        titulo: f.titulo, descricao: f.descricao, fecha: f.fecha ? new Date(f.fecha).toISOString() : (publicos ? '' : null), perguntas,
        ...(publicos ? { publico: f.publico, turmaIds: f.publico === 'docentes' ? [] : f.turmaIds } : {}),
        ...(anonimoEditavel ? { anonimo: f.anonimo !== false } : {}),
      }
      await gravar(corpo, f.id)
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
            perguntas={perguntas.filter((p) => p.texto.trim()).map(paraVer)} respostas={respostasTeste}
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
              {publicos && (
              <label>
                <span>{tx('Para')}</span>
                <select className="form-select form-select-sm" value={f.publico} onChange={(e) => setF({ ...f, publico: e.target.value })}>{Object.entries(publicos).map(([k, v]) => <option key={k} value={k}>{tx(v)}</option>)}</select>
              </label>
              )}
              <label>
                <span>{tx('Responder até')}</span>
                <input type="datetime-local" className="form-control form-control-sm" value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} required={Boolean(publicos)} />
              </label>
            </div>
            {anonimoEditavel && (
              <div className="gf-definicoes">
                <label className="form-check form-switch mb-0">
                  <input className="form-check-input" type="checkbox" checked={f.anonimo !== false} onChange={(e) => setF({ ...f, anonimo: e.target.checked })} />
                  <span className="form-check-label">{tx('Respostas anónimas (não fica registado quem respondeu o quê)')}</span>
                </label>
              </div>
            )}
            {publicos && f.publico !== 'docentes' && turmas.length > 0 && (
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

          {perguntas.map((p, k) => (p.tipo === 'seccao' ? (
            <div key={k} className={`gf-cartao gf-seccao gf-seccao-editar ${ativa === k ? 'gf-ativa' : ''}`} onFocus={() => setAtiva(k)} onClick={() => setAtiva(k)} role="group" aria-label={tx('Secção')}>
              <div className="gf-seccao-n">{tx('Secção (nova página para quem responde)')}</div>
              <input className="gf-campo gf-campo-seccao" value={p.texto} onChange={(e) => pergunta(k, { texto: e.target.value })} required maxLength={200} placeholder={tx('Título da secção')} aria-label={tx('Título da secção')} />
              <textarea className="gf-campo" rows={1} value={p.descricao || ''} onChange={(e) => pergunta(k, { descricao: e.target.value })} maxLength={1000} placeholder={tx('Descrição (opcional)')} aria-label={tx('Descrição da secção')} />
              <div className="gf-rodape-pergunta">
                <span className="gf-tipo-legenda"><i className="fa fa-grip-lines-vertical me-1" />{tx('Secção')}</span>
                <Botoes k={k} total={perguntas.length} mover={mover} duplicar={duplicar} retirar={retirar} podeDuplicar={perguntas.length < MAX_ITENS} podeRetirar={nPerguntas > 0} />
              </div>
            </div>
          ) : (
            <div key={k} className={`gf-cartao gf-pergunta ${ativa === k ? 'gf-ativa' : ''}`} onFocus={() => setAtiva(k)} onClick={() => setAtiva(k)} role="group" aria-label={tx('Pergunta {0}', { 0: k + 1 })}>
              <div className="gf-editor-linha">
                <input className="gf-campo gf-campo-pergunta" value={p.texto} onChange={(e) => pergunta(k, { texto: e.target.value })} required maxLength={500}
                  placeholder={p.tipo === 'escala' && escalaDe(p).nome(1) !== '1' ? tx('Afirmação (de discordo totalmente a concordo totalmente)') : tx('Pergunta')} aria-label={tx('Texto da pergunta {0}', { 0: k + 1 })} />
                <select className="form-select gf-tipo" value={tipoEditor(p)} aria-label={tx('Tipo da pergunta {0}', { 0: k + 1 })}
                  onChange={(e) => mudarPerguntas(perguntas.map((x, j) => (j === k ? mudarTipo(x, e.target.value) : x)))}>
                  {Object.entries(TIPOS_EDITOR).map(([t, x]) => <option key={t} value={t}>{x.nome}</option>)}
                </select>
              </div>
              {p.descricao !== undefined && (
                <textarea className="gf-campo gf-campo-descricao" rows={1} value={p.descricao} onChange={(e) => pergunta(k, { descricao: e.target.value })} maxLength={1000} placeholder={tx('Descrição')} aria-label={tx('Descrição da pergunta {0}', { 0: k + 1 })} />
              )}
              <EditarResposta p={p} k={k} mudar={(m) => pergunta(k, m)} />
              <div className="gf-rodape-pergunta">
                <span className="gf-tipo-legenda"><i className={`fa ${TIPOS_EDITOR[tipoEditor(p)]?.icone} me-1`} />{TIPOS_EDITOR[tipoEditor(p)]?.nome}</span>
                <button type="button" className="gf-icone" onClick={() => pergunta(k, { descricao: p.descricao === undefined ? '' : undefined })} aria-label={tx('Descrição')} title={p.descricao === undefined ? tx('Juntar descrição') : tx('Tirar descrição')}><i className="fa fa-paragraph" /></button>
                <Botoes k={k} total={perguntas.length} mover={mover} duplicar={duplicar} retirar={retirar} podeDuplicar={perguntas.length < MAX_ITENS} podeRetirar={nPerguntas > 1} />
                <span className="gf-separador" />
                <label className="form-check form-switch mb-0 small gf-obrigatoria-interruptor">
                  <span className="form-check-label me-2">{tx('Obrigatória')}</span>
                  <input className="form-check-input" type="checkbox" checked={eObrigatoria(p)} onChange={(e) => pergunta(k, { obrigatoria: e.target.checked })} />
                </label>
              </div>
            </div>
          )))}

          {perguntas.length < MAX_ITENS && (
            <div className="gf-novos">
              <button type="button" className="gf-cartao gf-nova" onClick={() => acrescentar(ativa >= 0 ? ativa : perguntas.length - 1)}>
                <i className="fa fa-plus-circle me-2" />{tx('Adicionar pergunta')}
              </button>
              <button type="button" className="gf-cartao gf-nova" onClick={() => acrescentar(ativa >= 0 ? ativa : perguntas.length - 1, { tipo: 'seccao', texto: '', descricao: '' })}>
                <i className="fa fa-grip-lines me-2" />{tx('Adicionar secção')}
              </button>
            </div>
          )}
          <div className="gf-acoes">
            <button type="submit" className="btn btn-theme gf-enviar" disabled={aGuardar}>{aGuardar ? tx('A guardar…') : textoGuardar ?? tx('Guardar rascunho')}</button>
            <button type="button" className="gf-limpar" onClick={() => (cancelar ? cancelar() : setF(null))}>{tx('Cancelar')}</button>
          </div>
        </form>
      )}
    </div>
  )
}

// como fica para quem responde (opções por escrever com o nome provisório)
function paraVer(p) {
  const nomes = (l, rot) => (l || []).map((o, j) => o.trim() || tx(rot, { 0: j + 1 }))
  if (p.tipo === 'escolha') return { ...p, opcoes: nomes(p.opcoes, 'Opção {0}') }
  if (p.tipo === 'grelha') return { ...p, linhas: nomes(p.linhas, 'Linha {0}'), colunas: nomes(p.colunas, 'Coluna {0}') }
  return p
}

function Botoes({ k, total, mover, duplicar, retirar, podeDuplicar, podeRetirar }) {
  return (
    <>
      <span className="gf-separador" />
      <button type="button" className="gf-icone" disabled={k === 0} onClick={() => mover(k, -1)} aria-label={tx('Subir')} title={tx('Subir')}><i className="fa fa-arrow-up" /></button>
      <button type="button" className="gf-icone" disabled={k === total - 1} onClick={() => mover(k, 1)} aria-label={tx('Descer')} title={tx('Descer')}><i className="fa fa-arrow-down" /></button>
      <button type="button" className="gf-icone" disabled={!podeDuplicar} onClick={() => duplicar(k)} aria-label={tx('Duplicar')} title={tx('Duplicar')}><i className="far fa-copy" /></button>
      <button type="button" className="gf-icone" disabled={!podeRetirar} onClick={() => retirar(k)} aria-label={tx('Retirar')} title={tx('Retirar')}><i className="far fa-trash-alt" /></button>
    </>
  )
}

// lista editável (opções, linhas, colunas), com o símbolo de cada uma e "Adicionar"
function ListaEditavel({ itens, mudar, simbolo, rotulo, adicionar, max, min = 1, depois }) {
  return (
    <div className="gf-opcoes">
      {itens.map((o, j) => (
        <div key={j} className="gf-opcao gf-opcao-editar">
          {simbolo(j)}
          <input className="gf-campo" value={o} onChange={(e) => mudar(itens.map((x, n) => (n === j ? e.target.value : x)))} maxLength={200}
            placeholder={tx(rotulo, { 0: j + 1 })} aria-label={tx(rotulo, { 0: j + 1 })}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (itens.length < max) mudar([...itens, '']) } }} />
          {itens.length > min && <button type="button" className="gf-icone" onClick={() => mudar(itens.filter((_, n) => n !== j))} aria-label={tx('Retirar')} title={tx('Retirar')}><i className="fa fa-times" /></button>}
        </div>
      ))}
      {depois}
      {itens.length < max && (
        <div className="gf-opcao gf-opcao-editar">
          {simbolo(itens.length)}
          <button type="button" className="gf-acrescentar-opcao" onClick={() => mudar([...itens, ''])}>{adicionar}</button>
        </div>
      )}
    </div>
  )
}

// a parte da resposta de cada tipo, como no Google Forms
function EditarResposta({ p, mudar }) {
  if (p.tipo === 'escolha') {
    const simbolo = (j) => (p.lista ? <span className="gf-numero">{j + 1}.</span> : <i className={p.multipla ? 'gf-quadrado' : 'gf-circulo'} aria-hidden="true" />)
    return (
      <ListaEditavel itens={p.opcoes || ['']} mudar={(opcoes) => mudar({ opcoes })} simbolo={simbolo} rotulo="Opção {0}" max={20}
        adicionar={<>{tx('Adicionar opção')}{!p.lista && !p.outra && <> {tx('ou')} <span className="gf-ligacao" role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); mudar({ outra: true }) }} onKeyDown={(e) => { if (e.key === 'Enter') mudar({ outra: true }) }}>{tx('adicionar «Outra»')}</span></>}</>}
        depois={p.outra && !p.lista && (
          <div className="gf-opcao gf-opcao-editar">
            {simbolo(0)}<span className="gf-modelo-texto flex-grow-1">{tx('Outra…')}</span>
            <button type="button" className="gf-icone" onClick={() => mudar({ outra: false })} aria-label={tx('Retirar «Outra»')} title={tx('Retirar «Outra»')}><i className="fa fa-times" /></button>
          </div>
        )} />
    )
  }
  if (p.tipo === 'escala') {
    const e = escalaDe(p)
    return (
      <div className="d-flex flex-column gap-2">
        <div className="d-flex align-items-center gap-2 small">
          <select className="form-select form-select-sm w-auto" value={e.min} onChange={(x) => mudar({ min: Number(x.target.value) })} aria-label={tx('Início da escala')}>{[0, 1].map((n) => <option key={n} value={n}>{n}</option>)}</select>
          <span>{tx('a')}</span>
          <select className="form-select form-select-sm w-auto" value={e.max} onChange={(x) => mudar({ max: Number(x.target.value) })} aria-label={tx('Fim da escala')}>{[2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => <option key={n} value={n}>{n}</option>)}</select>
        </div>
        {[['rotuloMin', e.min, e.min === 1 && e.max === 5 ? 'Discordo totalmente' : ''], ['rotuloMax', e.max, e.min === 1 && e.max === 5 ? 'Concordo totalmente' : '']].map(([campo, n, sugestao]) => (
          <div key={campo} className="d-flex align-items-center gap-3 small">
            <span className="text-muted" style={{ width: 18 }}>{n}</span>
            <input className="gf-campo" style={{ maxWidth: 320 }} value={p[campo] || ''} maxLength={60} placeholder={sugestao ? tx(sugestao) : tx('Rótulo (opcional)')} onChange={(x) => mudar({ [campo]: x.target.value })} aria-label={tx('Rótulo de {0}', { 0: n })} />
          </div>
        ))}
        <div className="gf-escala gf-escala-modelo" aria-hidden="true" style={{ '--gf-n': e.valores.length }}>
          <span className="gf-escala-ponta">{e.rotuloMin}</span>
          {e.valores.map((n) => <span key={n} className="gf-escala-opcao"><span>{n}</span><i className="gf-circulo" /></span>)}
          <span className="gf-escala-ponta">{e.rotuloMax}</span>
        </div>
      </div>
    )
  }
  if (p.tipo === 'grelha') {
    const simbolo = () => <i className={p.multipla ? 'gf-quadrado' : 'gf-circulo'} aria-hidden="true" />
    return (
      <div className="row g-3">
        <div className="col-md-6"><div className="small fw-bold mb-1">{tx('Linhas')}</div><ListaEditavel itens={p.linhas || ['']} mudar={(linhas) => mudar({ linhas })} simbolo={(j) => <span className="gf-numero">{j + 1}.</span>} rotulo="Linha {0}" adicionar={tx('Adicionar linha')} max={15} /></div>
        <div className="col-md-6"><div className="small fw-bold mb-1">{tx('Colunas')}</div><ListaEditavel itens={p.colunas || ['', '']} mudar={(colunas) => mudar({ colunas })} simbolo={simbolo} rotulo="Coluna {0}" adicionar={tx('Adicionar coluna')} max={10} min={2} /></div>
      </div>
    )
  }
  const modelo = { curta: tx('Texto de resposta curta'), aberta: tx('Texto de resposta longa'), data: tx('Dia, mês e ano'), hora: tx('Hora') }[p.tipo]
  return <div className={`gf-modelo-texto ${p.tipo === 'aberta' ? '' : 'gf-modelo-curto'}`}>{p.tipo === 'data' && <i className="far fa-calendar-alt me-2" />}{p.tipo === 'hora' && <i className="far fa-clock me-2" />}{modelo}</div>
}

export default EditorInquerito
