import { useCallback, useEffect, useState } from 'react'
import { api } from '../../api'
import { Carregando, Painel } from '../../componentes/Ui'
import ConselhoCurso from './ConselhoCurso'
import { t as tx, localAtual } from '../../../i18n/linguas'

const nota = (v) => (v === null || v === undefined ? '—' : Number(v).toLocaleString(localAtual(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
const FORMULAS = { ponderada: 'Média dos blocos ponderada pelos coeficientes', percentagem: 'Média dos blocos com pesos em percentagem', media: 'Média das unidades curriculares (ponderada pelos créditos)' }

/*
  Plano de curso da ESG de uma turma (Administração Escolar): carregar o modelo do plano 2026/2027 (cria o
  plano e as UC com blocos, horas e créditos), ver e ajustar os blocos e os coeficientes, as UC (bloco,
  UCréd, horas de contacto e de não contacto), os avisos da carga horária e a pauta geral pelo plano.
*/
export default function PlanoCursoTurma({ turma, gerir, avisar, aoMudar }) {
  const [d, setD] = useState(null)
  const [pauta, setPauta] = useState(null)
  const [plano, setPlano] = useState(null) // em edição
  const [modelo, setModelo] = useState('')
  const [ucEdicao, setUcEdicao] = useState({})
  const falhou = useCallback((e) => avisar({ tipo: 'erro', texto: e.message }), [avisar])
  const carregar = useCallback(() => {
    api(`/academico/turmas/${turma.id}/plano-curso`).then((r) => {
      setD(r)
      setUcEdicao(Object.fromEntries(r.ucs.map((u) => [u.id, { bloco: u.bloco, creditos: u.creditos, horasContacto: u.horasContacto, horasNaoContacto: u.horasNaoContacto, tii: u.tii }])))
      if (r.plano) api(`/academico/turmas/${turma.id}/pauta-plano`).then(setPauta).catch(() => setPauta(null))
      else setPauta(null)
    }).catch(falhou)
  }, [turma.id, falhou])
  useEffect(() => { carregar() }, [carregar])
  if (!d) return <Carregando />

  async function carregarModelo() {
    try {
      const r = await api(`/academico/turmas/${turma.id}/plano-curso`, { metodo: 'POST', corpo: { modelo } })
      avisar({ texto: tx('Plano carregado: {0} UC criada(s), {1} actualizada(s).', { 0: r.criadas, 1: r.atualizadas }) })
      carregar()
      aoMudar?.()
    } catch (e) { falhou(e) }
  }
  async function guardarPlano(e) {
    e.preventDefault()
    try {
      const corpo = { ...plano, curso: turma.curso, anoLetivo: turma.anoLetivo, ajusteMaximo: String(plano.ajusteMaximo ?? 0), blocos: plano.blocos.map((b) => ({ ...b, coeficiente: String(b.coeficiente) })) }
      await api(plano.id ? `/academico/planos-curso/${plano.id}` : '/academico/planos-curso', { metodo: plano.id ? 'PUT' : 'POST', corpo })
      setPlano(null)
      avisar({ texto: tx('Plano de curso guardado.') })
      carregar()
    } catch (x) { falhou(x) }
  }
  async function guardarUc(u) {
    try {
      const e = ucEdicao[u.id]
      await api(`/academico/cadeiras/${u.id}`, { metodo: 'PUT', corpo: { bloco: e.bloco, creditos: String(e.creditos || 0), horasContacto: String(e.horasContacto || 0), horasNaoContacto: String(e.horasNaoContacto || 0), tii: Boolean(e.tii) } })
      avisar({ texto: tx('{0}: guardada.', { 0: u.codigo }) })
      carregar()
    } catch (x) { falhou(x) }
  }
  const mudarUc = (id, k, v) => setUcEdicao({ ...ucEdicao, [id]: { ...ucEdicao[id], [k]: v } })
  const p = d.plano
  const totais = d.ucs.reduce((s, u) => ({ hc: s.hc + u.horasContacto, hnc: s.hnc + u.horasNaoContacto, cr: s.cr + u.creditos }), { hc: 0, hnc: 0, cr: 0 })

  return (
    <>
      <Painel titulo={<><i className="fa fa-clipboard-list me-2" />{tx('Plano de curso da ESG')}</>}>
        {!p ? (
          <>
            <p>{tx('Esta turma ainda não tem plano de curso da ESG: as cadeiras usam a pauta clássica (1.ª e 2.ª prova, exame e recurso). Com o plano, passam a ser avaliadas por TAI e TAG, com blocos, coeficientes e a menção da ESG.')}</p>
            {gerir && (
              <div className="d-flex flex-wrap gap-2 align-items-center">
                <select className="form-select w-auto" value={modelo} onChange={(e) => setModelo(e.target.value)} aria-label={tx('Modelo de plano')}>
                  <option value="">{tx('Escolher o modelo do plano 2026/2027…')}</option>
                  {Object.entries(d.modelos).map(([k, n]) => <option key={k} value={k}>{n}</option>)}
                </select>
                <button type="button" className="btn btn-theme" disabled={!modelo} onClick={carregarModelo}><i className="fa fa-file-import me-1" />{tx('Carregar o plano')}</button>
                <button type="button" className="btn btn-white" onClick={() => setPlano({ nome: '', termo: 'discente', formula: 'ponderada', blocos: [{ sigla: '', nome: '', coeficiente: 1 }], ajusteMaximo: 0, exigirBlocos: true, exigirTesteEscrito: true, exigirUcs: true, exigirTii: true, duracaoMeses: 10 })}>{tx('Criar um plano à mão')}</button>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="d-flex flex-wrap justify-content-between gap-2 mb-2">
              <div>
                <div className="fw-bold">{p.nome}</div>
                <div className="small text-muted">{tx(FORMULAS[p.formula])}{p.ajusteMaximo ? ` · ${tx('ajuste do Comandante até ±{0}', { 0: String(p.ajusteMaximo).replace('.', ',') })}` : ''} · {p.termo === 'auditor' ? tx('auditores') : tx('discentes')} · {tx('faltas justificadas até {0} %', { 0: p.faltasMaximas })} · {tx('duração normal: {0} meses', { 0: p.duracaoMeses ?? 10 })}{p.exigirUcs === false ? ` · ${tx('sem mínimo de 10 por UC')}` : ''}</div>
              </div>
              {gerir && <div className="d-flex gap-2">
                <button type="button" className="btn btn-sm btn-white" onClick={() => setPlano({ ...p })}><i className="fa fa-pen me-1" />{tx('Editar o plano')}</button>
                {Object.keys(d.modelos).length > 0 && <><select className="form-select form-select-sm w-auto" value={modelo} onChange={(e) => setModelo(e.target.value)} aria-label={tx('Modelo de plano')}><option value="">{tx('Completar UC a partir do modelo…')}</option>{Object.entries(d.modelos).map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select>
                <button type="button" className="btn btn-sm btn-white" disabled={!modelo} onClick={carregarModelo}>{tx('Aplicar')}</button></>}
              </div>}
            </div>
            {p.blocos.length > 0 && (
              <table className="table table-sm w-auto mb-2">
                <thead><tr><th>{tx('Bloco')}</th><th>{tx('Nome')}</th><th className="text-center">{tx('Coeficiente')}</th></tr></thead>
                <tbody>{p.blocos.map((b) => <tr key={b.sigla}><td><b>{b.sigla}</b></td><td>{b.nome}</td><td className="text-center">{String(b.coeficiente).replace('.', ',')}</td></tr>)}</tbody>
              </table>
            )}
          </>
        )}

        {plano && (
          <form className="border rounded p-3 mt-2" onSubmit={guardarPlano}>
            <div className="row g-2">
              <div className="col-md-6"><label className="form-label small fw-bold" htmlFor="pl-nome">{tx('Nome do plano')}</label><input id="pl-nome" className="form-control form-control-sm" required minLength={3} value={plano.nome} onChange={(e) => setPlano({ ...plano, nome: e.target.value })} /></div>
              <div className="col-md-3"><label className="form-label small fw-bold" htmlFor="pl-formula">{tx('Nota final')}</label><select id="pl-formula" className="form-select form-select-sm" value={plano.formula} onChange={(e) => setPlano({ ...plano, formula: e.target.value })}>{Object.entries(FORMULAS).map(([k, t]) => <option key={k} value={k}>{tx(t)}</option>)}</select></div>
              <div className="col-md-3"><label className="form-label small fw-bold" htmlFor="pl-termo">{tx('Quem frequenta')}</label><select id="pl-termo" className="form-select form-select-sm" value={plano.termo} onChange={(e) => setPlano({ ...plano, termo: e.target.value })}><option value="auditor">{tx('Auditores')}</option><option value="discente">{tx('Discentes')}</option></select></div>
              <div className="col-md-3"><label className="form-label small fw-bold" htmlFor="pl-aj">{tx('Ajuste do Comandante (±)')}</label><input id="pl-aj" className="form-control form-control-sm" inputMode="decimal" value={plano.ajusteMaximo} onChange={(e) => setPlano({ ...plano, ajusteMaximo: e.target.value })} /></div>
              <div className="col-md-3"><label className="form-label small fw-bold" htmlFor="pl-fal">{tx('Faltas justificadas (máx. %)')}</label><input id="pl-fal" className="form-control form-control-sm" inputMode="numeric" value={plano.faltasMaximas ?? 10} onChange={(e) => setPlano({ ...plano, faltasMaximas: e.target.value })} /></div>
              <div className="col-md-3"><label className="form-label small fw-bold" htmlFor="pl-dur">{tx('Duração normal (meses)')}</label><input id="pl-dur" className="form-control form-control-sm" inputMode="numeric" value={plano.duracaoMeses ?? 10} onChange={(e) => setPlano({ ...plano, duracaoMeses: e.target.value })} /></div>
              <div className="col-12 d-flex flex-wrap gap-3 align-items-end">
                <label className="form-check mb-1"><input type="checkbox" className="form-check-input" checked={plano.exigirUcs !== false} onChange={(e) => setPlano({ ...plano, exigirUcs: e.target.checked })} /> <span className="form-check-label small">{tx('Exigir 10 em cada UC')}</span></label>
                <label className="form-check mb-1"><input type="checkbox" className="form-check-input" checked={plano.exigirTii !== false} onChange={(e) => setPlano({ ...plano, exigirTii: e.target.checked })} /> <span className="form-check-label small">{tx('Exigir 10 no TII/TFC')}</span></label>
                <label className="form-check mb-1"><input type="checkbox" className="form-check-input" checked={plano.exigirBlocos !== false} onChange={(e) => setPlano({ ...plano, exigirBlocos: e.target.checked })} /> <span className="form-check-label small">{tx('Exigir 10 em cada bloco')}</span></label>
                <label className="form-check mb-1"><input type="checkbox" className="form-check-input" checked={plano.exigirTesteEscrito !== false} onChange={(e) => setPlano({ ...plano, exigirTesteEscrito: e.target.checked })} /> <span className="form-check-label small">{tx('Exigir 10 em cada TAI de teste escrito')}</span></label>
              </div>
            </div>
            <div className="small fw-bold mt-3 mb-1">{tx('Blocos de unidades curriculares')}</div>
            {plano.blocos.map((b, i) => (
              <div key={i} className="d-flex gap-2 mb-1">
                <input className="form-control form-control-sm" style={{ maxWidth: 110 }} placeholder={tx('Sigla')} value={b.sigla} onChange={(e) => setPlano({ ...plano, blocos: plano.blocos.map((x, j) => (j === i ? { ...x, sigla: e.target.value } : x)) })} aria-label={tx('Sigla do bloco')} />
                <input className="form-control form-control-sm" placeholder={tx('Nome do bloco')} value={b.nome} onChange={(e) => setPlano({ ...plano, blocos: plano.blocos.map((x, j) => (j === i ? { ...x, nome: e.target.value } : x)) })} aria-label={tx('Nome do bloco')} />
                <input className="form-control form-control-sm" style={{ maxWidth: 110 }} inputMode="decimal" placeholder={tx('Coef.')} value={b.coeficiente} onChange={(e) => setPlano({ ...plano, blocos: plano.blocos.map((x, j) => (j === i ? { ...x, coeficiente: e.target.value } : x)) })} aria-label={tx('Coeficiente')} />
                <button type="button" className="btn btn-sm btn-white" onClick={() => setPlano({ ...plano, blocos: plano.blocos.filter((_, j) => j !== i) })} aria-label={tx('Retirar bloco')}><i className="fa fa-times" /></button>
              </div>
            ))}
            <button type="button" className="btn btn-sm btn-link px-0" onClick={() => setPlano({ ...plano, blocos: [...plano.blocos, { sigla: '', nome: '', coeficiente: 1 }] })}><i className="fa fa-plus me-1" />{tx('Juntar bloco')}</button>
            <div className="d-flex gap-2 mt-2"><button type="submit" className="btn btn-sm btn-theme">{tx('Guardar o plano')}</button><button type="button" className="btn btn-sm btn-white" onClick={() => setPlano(null)}>{tx('Cancelar')}</button></div>
          </form>
        )}
      </Painel>

      {p && (
        <Painel titulo={<><i className="fa fa-book me-2" />{tx('Unidades curriculares, horas e créditos')}</>} corpo={false}>
          {d.avisos.length > 0 && <div className="alert alert-warning m-2 py-2 small"><b>{tx('Carga horária (Decreto Presidencial n.º 193/18):')}</b><ul className="mb-0">{d.avisos.map((a, i) => <li key={i}>{a}</li>)}</ul></div>}
          <div className="table-responsive">
            <table className="table table-sm align-middle mb-0">
              <thead><tr><th>{tx('UC')}</th><th>{tx('Bloco')}</th><th className="text-center">{tx('HC')}</th><th className="text-center">{tx('HNC')}</th><th className="text-center">{tx('Total')}</th><th className="text-center">{tx('UCréd')}</th><th className="text-center">{tx('TII')}</th>{gerir && <th />}</tr></thead>
              <tbody>{d.ucs.map((u) => {
                const e = ucEdicao[u.id] ?? {}
                const mudou = ['bloco', 'creditos', 'horasContacto', 'horasNaoContacto', 'tii'].some((k) => String(e[k] ?? '') !== String(u[k] ?? ''))
                const campo = (k, w = 70) => (gerir ? <input className="form-control form-control-sm text-center" style={{ width: w }} value={e[k] ?? ''} onChange={(x) => mudarUc(u.id, k, x.target.value)} aria-label={`${u.codigo} ${k}`} /> : u[k])
                return (
                  <tr key={u.id}>
                    <td><b>{u.codigo}</b> {u.nome}<div className="small text-muted">{u.periodo === 'anual' ? tx('Anual') : tx('{0}.º semestre', { 0: u.periodo })}</div></td>
                    <td>{gerir ? <select className="form-select form-select-sm" style={{ width: 110 }} value={e.bloco ?? ''} onChange={(x) => mudarUc(u.id, 'bloco', x.target.value)} aria-label={`${u.codigo} bloco`}><option value="">—</option>{p.blocos.map((b) => <option key={b.sigla} value={b.sigla}>{b.sigla}</option>)}</select> : u.bloco}</td>
                    <td className="text-center">{campo('horasContacto')}</td>
                    <td className="text-center">{campo('horasNaoContacto')}</td>
                    <td className="text-center">{(Number(e.horasContacto) || 0) + (Number(e.horasNaoContacto) || 0)}</td>
                    <td className="text-center">{campo('creditos', 60)}</td>
                    <td className="text-center">{gerir ? <input type="checkbox" className="form-check-input" checked={Boolean(e.tii)} onChange={(x) => mudarUc(u.id, 'tii', x.target.checked)} aria-label={`${u.codigo} TII`} /> : u.tii ? '✓' : ''}</td>
                    {gerir && <td className="text-end">{mudou && <button type="button" className="btn btn-xs btn-theme" onClick={() => guardarUc(u)}>{tx('Guardar')}</button>}</td>}
                  </tr>
                )
              })}</tbody>
              <tfoot><tr className="fw-bold"><td colSpan={2}>{tx('Total')}</td><td className="text-center">{totais.hc}</td><td className="text-center">{totais.hnc}</td><td className="text-center">{totais.hc + totais.hnc}</td><td className="text-center">{totais.cr}</td><td colSpan={gerir ? 2 : 1} /></tr></tfoot>
            </table>
          </div>
        </Painel>
      )}

      {p && pauta && (
        <Painel titulo={<><i className="fa fa-table me-2" />{tx('Pauta geral pelo plano de curso')}</>} corpo={false}>
          <div className="table-responsive">
            <table className="table table-sm table-bordered align-middle text-center mb-0">
              <thead><tr><th className="text-start">{p.termo === 'auditor' ? tx('Auditor') : tx('Discente')}</th>{pauta.plano.blocos.map((b) => <th key={b.sigla} title={b.nome}>{b.sigla}<div className="small fw-normal text-muted">×{String(b.coeficiente).replace('.', ',')}</div></th>)}<th>{tx('Nota final')}</th><th>{tx('Menção')}</th><th title={tx('Faltas justificadas / limite do plano')}>{tx('Faltas just.')}</th><th className="text-start">{tx('Em falta')}</th></tr></thead>
              <tbody>{pauta.linhas.map((l) => (
                <tr key={l.estudante.id}>
                  <td className="text-start"><b>{l.estudante.nome}</b><div className="small text-muted">{l.estudante.numero}</div></td>
                  {l.blocos.map((b) => <td key={b.sigla} className={b.nota !== null && b.nota < 10 ? 'text-danger fw-bold' : ''}>{nota(b.nota)}</td>)}
                  <td className="fw-bold">{nota(l.final)}</td>
                  <td>{l.mencao ? <span className={`badge ${l.mencao === 'Reprovado' ? 'bg-danger' : 'bg-success'}`}>{l.mencao}</span> : '—'}</td>
                  <td className={l.faltas?.excedido ? 'text-danger fw-bold' : ''}>{l.faltas ? `${l.faltas.justificadas} / ${l.faltas.limite}` : '—'}</td>
                  <td className="text-start small">{l.concluido ? <span className="text-success"><i className="fa fa-check me-1" />{tx('Concluiu')}</span> : l.emFalta.slice(0, 3).join(' · ')}{!l.concluido && l.emFalta.length > 3 ? ` (+${l.emFalta.length - 3})` : ''}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <div className="small text-muted p-2">{tx('A nota de cada bloco é a média das UC ponderada pelas unidades de crédito. Menção: Muito Bom 18–20, Bom 14–17,99, Regular 10–13,99.')}</div>
        </Painel>
      )}
      {p && <ConselhoCurso turma={turma} avisar={avisar} />}
    </>
  )
}
