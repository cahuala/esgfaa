import { useState } from 'react'
import { api } from '../api'
import { dataPt } from '../formatar'

const PARENTESCOS = [['Cônjuge', 'Cônjuge'], ['Filho(a)', 'Filho(a)'], ['Pai', 'Pai'], ['Mãe', 'Mãe'], ['Irmão/Irmã', 'Irmão/Irmã'], ['Neto(a)', 'Neto(a)'], ['Outro', 'Outro']]
const VAZIO = { nome: '', parentesco: '', dataNascimento: '', bi: '', genero: '', nacionalidade: 'Angolana', profissao: '' }
const idade = (iso) => { if (!iso) return ''; const n = new Date(iso); const h = new Date(); let a = h.getFullYear() - n.getFullYear(); if (h < new Date(h.getFullYear(), n.getMonth(), n.getDate())) a--; return `${a} anos` }

/*
  Familiares / dependentes (como no SIGP): formulário em cima (nome, parentesco, data de nascimento, BI
  opcional e género) e a lista dos registados em baixo, com editar e retirar. Ao escrever o BI, verifica-se
  se o familiar também tem ficha no sistema. lista = o agregado; aoMudar(lista) grava (ou guarda no formulário).
*/
export default function Familiares({ lista = [], aoMudar, editar = true, aGravar = false }) {
  const [f, setF] = useState(VAZIO)
  const [emEdicao, setEmEdicao] = useState(null)
  const [erro, setErro] = useState('')
  const [biInfo, setBiInfo] = useState(null)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  async function verificarBi(bi) {
    setBiInfo(null)
    const b = bi.trim().toUpperCase()
    if (b.length < 9) return
    try {
      const l = await api('/pessoas', { consulta: { ativo: 'todos' } })
      const x = l.find((p) => String(p.bi ?? '').toUpperCase() === b)
      setBiInfo(x ? { texto: `Tem ficha no sistema: ${[x.postoNome, x.nome].filter(Boolean).join(' ')}`, ok: true } : { texto: 'Não tem ficha no sistema.', ok: false })
    } catch {
      setBiInfo(null)
    }
  }
  function guardar() {
    if (f.nome.trim().length < 3) { setErro('Escreva o nome completo do familiar.'); return }
    if (!f.parentesco) { setErro('Escolha o parentesco.'); return }
    setErro('')
    const item = Object.fromEntries(Object.entries({ ...f, nome: f.nome.trim(), bi: f.bi.trim().toUpperCase() }).filter(([, v]) => v !== ''))
    aoMudar(emEdicao === null ? [...lista, item] : lista.map((x, i) => (i === emEdicao ? item : x)))
    setF(VAZIO)
    setEmEdicao(null)
    setBiInfo(null)
  }
  const editarLinha = (i) => { setEmEdicao(i); setF({ ...VAZIO, ...lista[i] }); setErro(''); setBiInfo(null) }
  const cancelar = () => { setEmEdicao(null); setF(VAZIO); setErro(''); setBiInfo(null) }

  return (
    <>
      {editar && (
        <div className="pes-fam-form">
          <div className="pes-fam-t"><i className={`fa ${emEdicao === null ? 'fa-user-plus' : 'fa-user-edit'} me-2`} />{emEdicao === null ? 'Adicionar Familiar / Dependente' : 'Editar familiar'}</div>
          <div className="p-3">
            {erro && <div className="alert alert-danger py-1 small">{erro}</div>}
            <div className="row g-2 align-items-end">
              <div className="col-md-5"><label className="form-label small fw-bold mb-1" htmlFor="fam-nome">Nome completo *</label><input id="fam-nome" className="form-control form-control-sm" value={f.nome} onChange={set('nome')} placeholder="Nome do familiar" /></div>
              <div className="col-md-3"><label className="form-label small fw-bold mb-1" htmlFor="fam-par">Parentesco *</label><select id="fam-par" className="form-select form-select-sm" value={f.parentesco} onChange={set('parentesco')}><option value="">Seleccione…</option>{PARENTESCOS.map(([k, t]) => <option key={k} value={k}>{t}</option>)}{f.parentesco && !PARENTESCOS.some(([k]) => k === f.parentesco) && <option value={f.parentesco}>{f.parentesco}</option>}</select></div>
              <div className="col-md-2"><label className="form-label small fw-bold mb-1" htmlFor="fam-nasc">Data de nascimento</label><input id="fam-nasc" type="date" className="form-control form-control-sm" value={f.dataNascimento} onChange={set('dataNascimento')} /></div>
              <div className="col-md-2 d-flex gap-1">
                <button type="button" className="btn btn-sm btn-theme flex-grow-1" disabled={aGravar} onClick={guardar}><i className={`fa ${aGravar ? 'fa-spinner fa-spin' : emEdicao === null ? 'fa-plus' : 'fa-save'} me-1`} />{emEdicao === null ? 'Adicionar' : 'Guardar'}</button>
                {emEdicao !== null && <button type="button" className="btn btn-sm btn-white" onClick={cancelar}>Cancelar</button>}
              </div>
              <div className="col-md-5"><label className="form-label small fw-bold mb-1" htmlFor="fam-bi">BI do familiar (opcional)</label><input id="fam-bi" className="form-control form-control-sm" value={f.bi} onChange={set('bi')} onBlur={(e) => verificarBi(e.target.value)} placeholder="Número do Bilhete de Identidade" />{biInfo && <div className={`small mt-1 ${biInfo.ok ? 'text-success' : 'text-muted'}`}><i className={`fa ${biInfo.ok ? 'fa-check-circle' : 'fa-info-circle'} me-1`} />{biInfo.texto}</div>}</div>
              <div className="col-md-3"><label className="form-label small fw-bold mb-1" htmlFor="fam-gen">Género</label><select id="fam-gen" className="form-select form-select-sm" value={f.genero} onChange={set('genero')}><option value="">Seleccione…</option><option value="M">Masculino</option><option value="F">Feminino</option></select></div>
              <div className="col-md-2"><label className="form-label small fw-bold mb-1" htmlFor="fam-nac">Nacionalidade</label><input id="fam-nac" className="form-control form-control-sm" value={f.nacionalidade} onChange={set('nacionalidade')} /></div>
              <div className="col-md-2"><label className="form-label small fw-bold mb-1" htmlFor="fam-prof">Profissão</label><input id="fam-prof" className="form-control form-control-sm" value={f.profissao} onChange={set('profissao')} /></div>
            </div>
          </div>
        </div>
      )}
      <div className="pes-bloco">
        <div className="pes-bloco-t"><span><i className="fa fa-users me-2" />Familiares registados</span><span className="pes-ftab-n">{lista.length}</span></div>
        {lista.length ? (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead><tr><th>Nome</th><th>Parentesco</th><th>Nascimento</th><th>BI</th><th>Género</th><th>Profissão</th>{editar && <th />}</tr></thead>
              <tbody>{lista.map((a, i) => (
                <tr key={i} className={emEdicao === i ? 'table-warning' : ''}>
                  <td className="fw-semibold">{a.nome}</td><td>{a.parentesco}</td><td>{a.dataNascimento ? `${dataPt(a.dataNascimento)} (${idade(a.dataNascimento)})` : '—'}</td>
                  <td className="font-monospace small">{a.bi || '—'}</td><td>{{ M: 'Masculino', F: 'Feminino' }[a.genero] ?? '—'}</td><td>{a.profissao || '—'}</td>
                  {editar && <td className="text-end text-nowrap">
                    <button type="button" className="btn btn-xs btn-white me-1" onClick={() => editarLinha(i)} title="Editar"><i className="fa fa-pen" /></button>
                    <button type="button" className="btn btn-xs btn-outline-danger" disabled={aGravar} onClick={() => { aoMudar(lista.filter((_, j) => j !== i)); if (emEdicao === i) cancelar() }} title="Retirar"><i className="fa fa-trash" /></button>
                  </td>}
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <div className="pes-vazio"><i className="fa fa-users" /><p>Nenhum familiar registado.{editar && ' Use o formulário acima para adicionar.'}</p></div>}
      </div>
    </>
  )
}
