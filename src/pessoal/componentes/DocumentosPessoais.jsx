import { useState } from 'react'
import { api } from '../api'
import { sinteseBiografica } from '../documentos'
import { CATALOGO, GRUPOS_DOC, documentosPara, gerarDocumentosPessoais, registarEmissao } from '../docPessoal'
import { Modal } from './Ui'

/*
  Documentos pessoais da ficha: escolhem-se os que se querem (declarações, guias de marcha, fichas), cada um
  com as suas opções, e saem todos num PDF (Times 14, dados em maiúsculas). As declarações são numeradas e
  cada emissão fica registada no histórico de documentos emitidos e na auditoria.
*/
function Opcao({ o, valor, valores, aoMudar }) {
  const id = `op-${o.campo}`
  // calculado (ex.: o fim das férias) e aviso: só se mostram, não se escrevem
  if (o.tipo === 'aviso') { const t = o.texto(valores); return t ? <div className="alert alert-warning py-1 px-2 small mb-2"><i className="fa fa-info-circle me-1" />{t}</div> : null }
  if (o.tipo === 'calculado') return <div className="mb-2"><div className="form-label small mb-0">{o.rotulo}</div><div className="form-control form-control-sm bg-light fw-bold">{o.calcular(valores) || '—'}</div></div>
  const comum = { id, className: 'form-control form-control-sm', value: valor ?? '', onChange: (e) => aoMudar(e.target.value), required: o.obrigatorio }
  return (
    <div className="mb-2">
      <label className="form-label small mb-0" htmlFor={id}>{o.rotulo}{o.obrigatorio && <span className="text-danger"> *</span>}</label>
      {o.tipo === 'escolha'
        ? <select {...comum} className="form-select form-select-sm">{o.valores.map((v) => <option key={v}>{v}</option>)}</select>
        : <input {...comum} type={o.tipo === 'numero' ? 'number' : o.tipo === 'data' ? 'date' : 'text'} step={o.tipo === 'numero' ? '0.01' : undefined} min={o.tipo === 'numero' ? 0 : undefined} />}
      {o.ajuda && <div className="form-text small">{o.ajuda}</div>}
    </div>
  )
}

export default function DocumentosPessoais({ p, aoFechar, aoEmitir }) {
  const lista = documentosPara(p)
  const [sel, setSel] = useState(() => ({}))
  const [comSintese, setComSintese] = useState(false)
  const [erro, setErro] = useState('')
  const [aGerar, setAGerar] = useState(false)
  const escolhidos = lista.filter((c) => sel[c.tipo])

  const alternar = (c) => setSel((s) => {
    if (s[c.tipo]) { const { [c.tipo]: _, ...r } = s; void _; return r }
    return { ...s, [c.tipo]: Object.fromEntries(c.opcoes(p).map((o) => [o.campo, o.inicial ?? ''])) }
  })
  const mudar = (tipo, campo, v) => setSel((s) => ({ ...s, [tipo]: { ...s[tipo], [campo]: v } }))
  const todos = (grupo, marcar) => setSel((s) => {
    const r = { ...s }
    for (const c of lista.filter((x) => x.grupo === grupo)) {
      if (marcar && !r[c.tipo]) r[c.tipo] = Object.fromEntries(c.opcoes(p).map((o) => [o.campo, o.inicial ?? '']))
      if (!marcar) delete r[c.tipo]
    }
    return r
  })

  async function gerar() {
    setErro('')
    for (const c of escolhidos) {
      const falta = c.opcoes(p).find((o) => o.obrigatorio && !String(sel[c.tipo][o.campo] ?? '').trim())
      if (falta) { setErro(`${c.nome}: falta «${falta.rotulo}».`); return }
    }
    setAGerar(true)
    try {
      const escolhas = escolhidos.map((c) => {
        const ops = c.opcoes(p)
        const tipoDe = (k) => ops.find((o) => o.campo === k)?.tipo
        return { tipo: c.tipo, dados: Object.fromEntries(Object.entries(sel[c.tipo]).filter(([k]) => !['aviso', 'calculado'].includes(tipoDe(k))).map(([k, v]) => [k, tipoDe(k) === 'numero' && v !== '' ? Number(v) : v])) }
      })
      if (escolhas.length) {
        const [emitidos, quem] = await Promise.all([registarEmissao(api, p.id, escolhas), api('/definicoes/assinaturas')])
        await gerarDocumentosPessoais(p, escolhas, emitidos, quem)
      }
      if (comSintese) await sinteseBiografica(p)
      aoEmitir?.(escolhas.length + (comSintese ? 1 : 0))
    } catch (e) {
      setErro(e.message)
    } finally {
      setAGerar(false)
    }
  }

  const n = escolhidos.length + (comSintese ? 1 : 0)
  return (
    <Modal titulo={`Documentos — ${p.tipo === 'militar' ? `${p.postoNome} ` : ''}${p.nome}`} aoFechar={aoFechar} largo
      rodape={<>
        <span className="me-auto small text-muted">Times 14 · dados em maiúsculas · as declarações são numeradas e ficam registadas</span>
        <button type="button" className="btn btn-outline-secondary" onClick={aoFechar}>Fechar</button>
        <button type="button" className="btn btn-theme" disabled={!n || aGerar} onClick={gerar}><i className={`fa ${aGerar ? 'fa-spinner fa-spin' : 'fa-file-pdf'} me-1`} />Gerar {n || ''} documento(s)</button>
      </>}>
      {erro && <div className="alert alert-danger py-2">{erro}</div>}
      <div className="row">
        {GRUPOS_DOC.map(([g, nome]) => {
          const doGrupo = lista.filter((c) => c.grupo === g)
          if (!doGrupo.length) return null
          const tudo = doGrupo.every((c) => sel[c.tipo])
          return (
            <div key={g} className="col-lg-4 mb-3">
              <div className="d-flex align-items-center mb-2">
                <h6 className="mb-0 me-auto fw-bold">{nome}</h6>
                <button type="button" className="btn btn-link btn-sm p-0" onClick={() => todos(g, !tudo)}>{tudo ? 'Nenhum' : 'Todos'}</button>
              </div>
              {doGrupo.map((c) => (
                <div key={c.tipo} className={`border rounded p-2 mb-2 ${sel[c.tipo] ? 'border-theme bg-light' : ''}`}>
                  <label className="form-check mb-0">
                    <input type="checkbox" className="form-check-input" checked={Boolean(sel[c.tipo])} onChange={() => alternar(c)} />
                    <span className="form-check-label">{c.nome}</span>
                  </label>
                  {sel[c.tipo] && c.opcoes(p).length > 0 && <div className="mt-2 ps-4">{c.opcoes(p).map((o) => <Opcao key={o.campo} o={o} valor={sel[c.tipo][o.campo]} valores={sel[c.tipo]} aoMudar={(v) => mudar(c.tipo, o.campo, v)} />)}</div>}
                </div>
              ))}
              {g === 'fichas' && (
                <div className={`border rounded p-2 mb-2 ${comSintese ? 'border-theme bg-light' : ''}`}>
                  <label className="form-check mb-0"><input type="checkbox" className="form-check-input" checked={comSintese} onChange={(e) => setComSintese(e.target.checked)} /> <span className="form-check-label">Síntese biográfica <small className="text-muted">(PDF à parte)</small></span></label>
                </div>
              )}
            </div>
          )
        })}
      </div>
      {CATALOGO.length > lista.length && <p className="small text-muted mb-0">Só aparecem os documentos que servem a {p.tipo === 'militar' ? 'um militar' : p.vinculo === 'domiciliar' ? 'uma empregada(o) domiciliar' : 'um funcionário civil'}.</p>}
    </Modal>
  )
}
