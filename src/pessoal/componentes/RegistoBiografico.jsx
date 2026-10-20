import { useState } from 'react'
import { api } from '../api'
import { useSessao } from '../sessao'

const SITUACOES_MILITARES = [['adiado', 'Adiado'], ['disponibilidade', 'Disponibilidade'], ['isento', 'Isento'], ['nao_apto', 'Não apto'], ['refratario', 'Refratário'], ['militar', 'Militar']]
const NIVEIS = [['MB', 'Muito bem'], ['B', 'Bem'], ['R', 'Razoável']]
const vazio = (n, f) => Array.from({ length: n }, (_, i) => f(i))
const completar = (l, n, f) => [...(l ?? []), ...vazio(Math.max(0, n - (l ?? []).length), f)].slice(0, n)

/*
  Registo biográfico (os pontos da ficha de registo biográfico que o resto da ficha não tem): estudos (classes
  e anos), línguas, os três últimos locais de trabalho, as colocações, a situação militar (dos civis), a
  situação médica e outras informações relevantes. Edita-se tudo de uma vez e vai para a ficha impressa.
*/
export default function RegistoBiografico({ p, editar, aoMudar }) {
  const { avisar } = useSessao()
  const base = p.registo ?? {}
  const novo = () => ({
    estudos: completar(base.estudos, 6, () => ({ classe: '', ano: '' })),
    linguas: completar(base.linguas, 4, (i) => ({ lingua: ['Inglês', 'Francês', '', ''][i], nivel: '' })),
    locaisAnteriores: completar(base.locaisAnteriores, 3, () => ({ local: '', de: '', ate: '', profissao: '' })),
    colocacoes: completar(base.colocacoes, 6, () => ({ categoria: '', despacho: '', data: '', dr: '', inicio: '', situacao: '', colocacao: '', responsabilidade: '' })),
    situacaoMilitar: { tipo: '', desde: '', reiniciou: '', ...(base.situacaoMilitar ?? {}) },
    saude: { dador: null, defeitoFisico: '', doencas: '', ...(base.saude ?? {}) },
    outrasInformacoes: base.outrasInformacoes ?? '',
  })
  const [r, setR] = useState(null)
  const [aGravar, setAGravar] = useState(false)
  const v = r ?? novo()
  const em = Boolean(r)
  const lista = (k, i, campo) => (e) => setR({ ...v, [k]: v[k].map((x, j) => (j === i ? { ...x, [campo]: e.target.value } : x)) })
  const obj = (k, campo, val) => setR({ ...v, [k]: { ...v[k], [campo]: val } })
  const cheio = (x) => Object.values(x).some((y) => y !== '' && y !== null && y !== undefined)

  async function guardar() {
    setAGravar(true)
    try {
      const registo = { ...base, ...v, estudos: v.estudos.filter(cheio), linguas: v.linguas.filter((x) => x.lingua), locaisAnteriores: v.locaisAnteriores.filter(cheio), colocacoes: v.colocacoes.filter(cheio) }
      await api(`/pessoas/${p.id}`, { metodo: 'PUT', corpo: { registo } })
      avisar('Registo biográfico guardado.')
      setR(null)
      aoMudar()
    } catch (e) {
      avisar(e.message, 'erro')
    } finally {
      setAGravar(false)
    }
  }
  const inp = (val, aoMudarV, extra = {}) => (em ? <input className="form-control form-control-sm" value={val ?? ''} onChange={aoMudarV} {...extra} /> : <span>{val || '—'}</span>)
  const data = (val, aoMudarV, rot) => inp(val, aoMudarV, { type: 'date', 'aria-label': rot })

  return (
    <>
      <div className="d-flex justify-content-end gap-2 mb-2">
        {editar && (em
          ? <><button type="button" className="btn btn-white" onClick={() => setR(null)}>Cancelar</button><button type="button" className="btn btn-theme" disabled={aGravar} onClick={guardar}><i className={`fa ${aGravar ? 'fa-spinner fa-spin' : 'fa-save'} me-1`} />Guardar</button></>
          : <button type="button" className="btn btn-theme" onClick={() => setR(novo())}><i className="fa fa-pen me-1" />Editar o registo biográfico</button>)}
      </div>
      <div className="row">
        <div className="col-xl-6">
          <div className="pes-bloco">
            <div className="pes-bloco-t"><span><i className="fa fa-school me-2" />Estudos realizados (classes)</span></div>
            <table className="table table-sm mb-0"><thead><tr><th>Classe</th><th>Data / ano</th></tr></thead>
              <tbody>{v.estudos.map((x, i) => (em || cheio(x)) && <tr key={i}><td>{inp(x.classe, lista('estudos', i, 'classe'), { placeholder: 'Ex.: 12.ª', 'aria-label': 'Classe' })}</td><td>{inp(x.ano, lista('estudos', i, 'ano'), { placeholder: 'Ex.: 2005', 'aria-label': 'Ano' })}</td></tr>)}
                {!em && !v.estudos.some(cheio) && <tr><td colSpan={2} className="text-muted small">Nada registado. Os cursos e a formação superior estão em «Formação».</td></tr>}</tbody></table>
          </div>
          <div className="pes-bloco">
            <div className="pes-bloco-t"><span><i className="fa fa-language me-2" />Conhecimento de línguas internacionais</span></div>
            <table className="table table-sm mb-0"><thead><tr><th>Língua</th><th>Nível</th></tr></thead>
              <tbody>{v.linguas.map((x, i) => (em || x.nivel) && (
                <tr key={i}><td>{i < 2 ? x.lingua : inp(x.lingua, lista('linguas', i, 'lingua'), { placeholder: 'Ex.: Espanhol', 'aria-label': 'Língua' })}</td>
                  <td>{em ? <select className="form-select form-select-sm" value={x.nivel} onChange={lista('linguas', i, 'nivel')} aria-label={`Nível de ${x.lingua || 'língua'}`}><option value="">—</option>{NIVEIS.map(([k, t]) => <option key={k} value={k}>{k} — {t}</option>)}</select> : NIVEIS.find(([k]) => k === x.nivel)?.[1] ?? '—'}</td></tr>
              ))}{!em && !v.linguas.some((x) => x.nivel) && <tr><td colSpan={2} className="text-muted small">Nada registado.</td></tr>}</tbody></table>
          </div>
          <div className="pes-bloco">
            <div className="pes-bloco-t"><span><i className="fa fa-heartbeat me-2" />Situação médica</span></div>
            <div className="pes-bloco-c">
              <div className="row g-2">
                <div className="col-md-4"><div className="pes-campo-r">Grupo sanguíneo</div><div>{p.grupoSanguineo || '—'}</div></div>
                <div className="col-md-8"><div className="pes-campo-r">Dador</div>{em ? <div className="d-flex gap-3">{[[true, 'Sim'], [false, 'Não'], [null, 'Por saber']].map(([k, t]) => <label key={t} className="form-check mb-0"><input type="radio" className="form-check-input" checked={v.saude.dador === k} onChange={() => obj('saude', 'dador', k)} /> <span className="form-check-label">{t}</span></label>)}</div> : <div>{v.saude.dador === true ? 'Sim' : v.saude.dador === false ? 'Não' : '—'}</div>}</div>
                <div className="col-12"><div className="pes-campo-r">Defeito físico</div>{inp(v.saude.defeitoFisico, (e) => obj('saude', 'defeitoFisico', e.target.value), { maxLength: 200 })}</div>
                <div className="col-12"><div className="pes-campo-r">Doenças / alergias de que sofre</div>{inp(v.saude.doencas, (e) => obj('saude', 'doencas', e.target.value), { maxLength: 300 })}</div>
              </div>
              <div className="form-text small mt-2"><i className="fa fa-lock me-1" />Fica cifrado na base de dados.</div>
            </div>
          </div>
        </div>
        <div className="col-xl-6">
          {p.tipo === 'civil' && (
            <div className="pes-bloco">
              <div className="pes-bloco-t"><span><i className="fa fa-shield-alt me-2" />Situação militar (do civil)</span></div>
              <div className="pes-bloco-c">
                {em ? <div className="d-flex flex-wrap gap-3 mb-2">{SITUACOES_MILITARES.map(([k, t]) => <label key={k} className="form-check mb-0"><input type="radio" className="form-check-input" checked={v.situacaoMilitar.tipo === k} onChange={() => obj('situacaoMilitar', 'tipo', k)} /> <span className="form-check-label">{t}</span></label>)}<label className="form-check mb-0"><input type="radio" className="form-check-input" checked={!v.situacaoMilitar.tipo} onChange={() => obj('situacaoMilitar', 'tipo', '')} /> <span className="form-check-label">Por indicar</span></label></div>
                  : <div className="mb-2 fw-semibold">{SITUACOES_MILITARES.find(([k]) => k === v.situacaoMilitar.tipo)?.[1] ?? '—'}</div>}
                <div className="row g-2">
                  <div className="col-6"><div className="pes-campo-r">Desde</div>{data(v.situacaoMilitar.desde, (e) => obj('situacaoMilitar', 'desde', e.target.value), 'Desde')}</div>
                  <div className="col-6"><div className="pes-campo-r">Reiniciou a função a</div>{data(v.situacaoMilitar.reiniciou, (e) => obj('situacaoMilitar', 'reiniciou', e.target.value), 'Reiniciou a função a')}</div>
                </div>
              </div>
            </div>
          )}
          <div className="pes-bloco">
            <div className="pes-bloco-t"><span><i className="fa fa-briefcase me-2" />Os 3 últimos locais de trabalho antes de entrar na Escola</span></div>
            <div className="table-responsive"><table className="table table-sm mb-0"><thead><tr><th>Local</th><th>De</th><th>A</th><th>Profissão</th></tr></thead>
              <tbody>{v.locaisAnteriores.map((x, i) => (em || cheio(x)) && <tr key={i}><td>{inp(x.local, lista('locaisAnteriores', i, 'local'), { 'aria-label': 'Local' })}</td><td>{data(x.de, lista('locaisAnteriores', i, 'de'), 'De')}</td><td>{data(x.ate, lista('locaisAnteriores', i, 'ate'), 'A')}</td><td>{inp(x.profissao, lista('locaisAnteriores', i, 'profissao'), { 'aria-label': 'Profissão' })}</td></tr>)}
                {!em && !v.locaisAnteriores.some(cheio) && <tr><td colSpan={4} className="text-muted small">Nada registado.</td></tr>}</tbody></table></div>
          </div>
          <div className="pes-bloco">
            <div className="pes-bloco-t"><span><i className="fa fa-info-circle me-2" />Outras informações relevantes</span></div>
            <div className="pes-bloco-c">{em ? <textarea className="form-control form-control-sm" rows={4} maxLength={4000} value={v.outrasInformacoes} onChange={(e) => setR({ ...v, outrasInformacoes: e.target.value })} /> : <div style={{ whiteSpace: 'pre-wrap' }}>{v.outrasInformacoes || <span className="text-muted small">Nada registado.</span>}</div>}</div>
          </div>
        </div>
      </div>
      <div className="pes-bloco">
        <div className="pes-bloco-t"><span><i className="fa fa-map-signs me-2" />Colocações (começar pelo cargo actual)</span></div>
        <div className="table-responsive"><table className="table table-sm mb-0">
          <thead><tr><th>Categoria ocupacional</th><th>Despacho n.º</th><th>Data</th><th>D.R. n.º</th><th>Início de função</th><th>Situação na função pública</th><th>Colocação</th><th>Responsabilidade / funções esp. / comissões</th></tr></thead>
          <tbody>{v.colocacoes.map((x, i) => (em || cheio(x)) && (
            <tr key={i}>{[['categoria'], ['despacho'], ['data', 'date'], ['dr'], ['inicio', 'date'], ['situacao'], ['colocacao'], ['responsabilidade']].map(([k, tipo]) => <td key={k}>{tipo ? data(x[k], lista('colocacoes', i, k), k) : inp(x[k], lista('colocacoes', i, k), { 'aria-label': k })}</td>)}</tr>
          ))}{!em && !v.colocacoes.some(cheio) && <tr><td colSpan={8} className="text-muted small">Nada registado: a ficha impressa põe a categoria e a colocação actuais.</td></tr>}</tbody>
        </table></div>
      </div>
    </>
  )
}
