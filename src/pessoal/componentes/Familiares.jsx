import { useState } from 'react'
import { api } from '../api'
import { useSessao } from '../sessao'
import { dataPt } from '../formatar'

const PARENTESCOS = [['Cônjuge', 'Cônjuge'], ['Filho(a)', 'Filho(a)'], ['Pai', 'Pai'], ['Mãe', 'Mãe'], ['Irmão/Irmã', 'Irmão/Irmã'], ['Neto(a)', 'Neto(a)'], ['Outro', 'Outro']]
const ESTADOS = [['solteiro', 'Solteiro(a)'], ['casado', 'Casado(a)'], ['uniao_facto', 'União de facto'], ['divorciado', 'Divorciado(a)'], ['viuvo', 'Viúvo(a)']]
const VAZIO = { bi: '', nome: '', parentesco: '', dataNascimento: '', genero: '', estadoCivil: '', nacionalidade: 'Angolana', naturalidade: '', provincia: '', pai: '', mae: '', profissao: '', localTrabalho: '', telefone: '' }
const idade = (iso) => { if (!iso) return ''; const n = new Date(iso); const h = new Date(); let a = h.getFullYear() - n.getFullYear(); if (h < new Date(h.getFullYear(), n.getMonth(), n.getDate())) a--; return `${a} anos` }
const BI = /^[0-9]{9}[A-Z]{2}[0-9]{3}$/

/*
  Familiares / dependentes (como no SIGP e como ao registar o militar): primeiro o BI — «Consultar» vai
  à base de dados do Estado e preenche o nome, a data de nascimento, o género, o estado civil, a
  naturalidade e os pais; se o familiar já tiver ficha no sistema, os dados vêm de lá. Depois confere-se
  e completa-se (parentesco, profissão, local de trabalho, telefone). Sem BI (crianças), preenche-se à mão.
  lista = o agregado; aoMudar(lista) grava (ou guarda no formulário).
*/
export default function Familiares({ lista = [], aoMudar, editar = true, aGravar = false }) {
  const { avisar } = useSessao()
  const [f, setF] = useState(VAZIO)
  const [emEdicao, setEmEdicao] = useState(null)
  const [erro, setErro] = useState('')
  const [biInfo, setBiInfo] = useState(null)
  const [aConsultar, setAConsultar] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  // o BI: primeiro a ficha no sistema; depois a base de dados do Estado
  async function consultarBi() {
    const b = f.bi.trim().toUpperCase().replace(/\s/g, '')
    setErro('')
    setBiInfo(null)
    if (!BI.test(b)) { setErro('Número de BI inválido (ex.: 001234567LA041).'); return }
    setAConsultar(true)
    try {
      const l = await api('/pessoas', { consulta: { ativo: 'todos' } }).catch(() => [])
      const x = l.find((p) => String(p.bi ?? '').toUpperCase() === b)
      if (x) {
        setF((v) => ({ ...v, bi: b, nome: x.nome || v.nome, dataNascimento: x.dataNascimento || v.dataNascimento, genero: x.genero || v.genero, estadoCivil: x.estadoCivil || v.estadoCivil, naturalidade: x.naturalidade || v.naturalidade, provincia: x.provincia || v.provincia, profissao: v.profissao || (x.tipo === 'militar' ? `Militar (${x.postoNome})` : x.categoriaCivil || ''), localTrabalho: v.localTrabalho || 'Escola Superior de Guerra', telefone: x.telefone || v.telefone }))
        setBiInfo({ texto: `Tem ficha no sistema: ${[x.postoNome, x.nome].filter(Boolean).join(' ')}. Dados preenchidos a partir da ficha.`, ok: true })
        return
      }
      const d = await api(`/bi/${encodeURIComponent(b)}`)
      setF((v) => ({ ...v, ...Object.fromEntries(['bi', 'nome', 'dataNascimento', 'genero', 'estadoCivil', 'naturalidade', 'provincia', 'pai', 'mae'].filter((k) => d[k]).map((k) => [k, d[k]])) }))
      setBiInfo({ texto: 'Dados do BI preenchidos. Confira e complete o parentesco.', ok: true })
      avisar('Dados do BI preenchidos.')
    } catch (e) {
      setBiInfo({ texto: `${e.message} Pode preencher à mão.`, ok: false })
    } finally {
      setAConsultar(false)
    }
  }
  function guardar() {
    if (f.nome.trim().length < 3) { setErro('Escreva o nome completo do familiar.'); return }
    if (!f.parentesco) { setErro('Escolha o parentesco.'); return }
    if (f.bi.trim() && !BI.test(f.bi.trim().toUpperCase().replace(/\s/g, ''))) { setErro('Número de BI inválido (ex.: 001234567LA041).'); return }
    setErro('')
    const item = Object.fromEntries(Object.entries({ ...f, nome: f.nome.trim(), bi: f.bi.trim().toUpperCase().replace(/\s/g, '') }).filter(([, v]) => v !== '' && v !== null))
    aoMudar(emEdicao === null ? [...lista, item] : lista.map((x, i) => (i === emEdicao ? item : x)))
    setF(VAZIO)
    setEmEdicao(null)
    setBiInfo(null)
  }
  const editarLinha = (i) => { setEmEdicao(i); setF({ ...VAZIO, ...lista[i] }); setErro(''); setBiInfo(null) }
  const cancelar = () => { setEmEdicao(null); setF(VAZIO); setErro(''); setBiInfo(null) }
  const C = (id, rotulo, el, col = 'col-md-3') => <div className={col}><label className="form-label small fw-bold mb-1" htmlFor={id}>{rotulo}</label>{el}</div>
  const txt = (k, extra = {}) => <input id={`fam-${k}`} className="form-control form-control-sm" value={f[k] ?? ''} onChange={set(k)} {...extra} />

  return (
    <>
      {editar && (
        <div className="pes-fam-form">
          <div className="pes-fam-t"><i className={`fa ${emEdicao === null ? 'fa-user-plus' : 'fa-user-edit'} me-2`} />{emEdicao === null ? 'Adicionar Familiar / Dependente' : 'Editar familiar'}</div>
          <div className="p-3">
            {erro && <div className="alert alert-danger py-1 small">{erro}</div>}
            <div className="row g-2 align-items-end">
              <div className="col-md-5">
                <label className="form-label small fw-bold mb-1" htmlFor="fam-bi">Bilhete de Identidade</label>
                <div className="input-group input-group-sm">
                  <input id="fam-bi" className="form-control font-monospace" value={f.bi} onChange={set('bi')} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); consultarBi() } }} placeholder="Ex.: 001234567LA041" maxLength={20} />
                  <button type="button" className="btn btn-outline-theme" disabled={aConsultar || !f.bi.trim()} onClick={consultarBi} title="Consultar o BI"><i className={`fa ${aConsultar ? 'fa-spinner fa-spin' : 'fa-search'} me-1`} />Consultar</button>
                </div>
                <div className={`small mt-1 ${biInfo ? (biInfo.ok ? 'text-success' : 'text-warning') : 'text-muted'}`}>
                  <i className={`fa ${biInfo ? (biInfo.ok ? 'fa-check-circle' : 'fa-exclamation-triangle') : 'fa-info-circle'} me-1`} />{biInfo ? biInfo.texto : 'Escreva o BI e carregue em Consultar para preencher os dados. Sem BI (crianças), preencha à mão.'}
                </div>
              </div>
              {C('fam-nome', 'Nome completo *', txt('nome', { placeholder: 'Nome do familiar' }), 'col-md-5')}
              {C('fam-par', 'Parentesco *', <select id="fam-par" className="form-select form-select-sm" value={f.parentesco} onChange={set('parentesco')}><option value="">Seleccione…</option>{PARENTESCOS.map(([k, t]) => <option key={k} value={k}>{t}</option>)}{f.parentesco && !PARENTESCOS.some(([k]) => k === f.parentesco) && <option value={f.parentesco}>{f.parentesco}</option>}</select>, 'col-md-2')}
              {C('fam-dataNascimento', 'Data de nascimento', txt('dataNascimento', { type: 'date' }))}
              {C('fam-gen', 'Género', <select id="fam-gen" className="form-select form-select-sm" value={f.genero} onChange={set('genero')}><option value="">Seleccione…</option><option value="M">Masculino</option><option value="F">Feminino</option></select>)}
              {C('fam-ec', 'Estado civil', <select id="fam-ec" className="form-select form-select-sm" value={f.estadoCivil} onChange={set('estadoCivil')}><option value="">Seleccione…</option>{ESTADOS.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select>)}
              {C('fam-nacionalidade', 'Nacionalidade', txt('nacionalidade'))}
              {C('fam-naturalidade', 'Naturalidade', txt('naturalidade'))}
              {C('fam-provincia', 'Província', txt('provincia'))}
              {C('fam-pai', 'Nome do pai', txt('pai'))}
              {C('fam-mae', 'Nome da mãe', txt('mae'))}
              {C('fam-profissao', 'Profissão', txt('profissao'))}
              {C('fam-localTrabalho', 'Local de trabalho / escola', txt('localTrabalho'))}
              {C('fam-telefone', 'Telefone', txt('telefone', { type: 'tel' }))}
              <div className="col-md-3 d-flex gap-1">
                <button type="button" className="btn btn-sm btn-theme flex-grow-1" disabled={aGravar} onClick={guardar}><i className={`fa ${aGravar ? 'fa-spinner fa-spin' : emEdicao === null ? 'fa-plus' : 'fa-save'} me-1`} />{emEdicao === null ? 'Adicionar' : 'Guardar'}</button>
                {emEdicao !== null && <button type="button" className="btn btn-sm btn-white" onClick={cancelar}>Cancelar</button>}
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="pes-bloco">
        <div className="pes-bloco-t"><span><i className="fa fa-users me-2" />Familiares registados</span><span className="pes-ftab-n">{lista.length}</span></div>
        {lista.length ? (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead><tr><th>Nome</th><th>Parentesco</th><th>Nascimento</th><th>BI</th><th>Género</th><th>Profissão / local</th><th>Telefone</th>{editar && <th />}</tr></thead>
              <tbody>{lista.map((a, i) => (
                <tr key={i} className={emEdicao === i ? 'table-warning' : ''}>
                  <td className="fw-semibold">{a.nome}</td><td>{a.parentesco}</td><td>{a.dataNascimento ? `${dataPt(a.dataNascimento)} (${idade(a.dataNascimento)})` : '—'}</td>
                  <td className="font-monospace small">{a.bi || '—'}</td><td>{{ M: 'Masculino', F: 'Feminino' }[a.genero] ?? '—'}</td>
                  <td>{[a.profissao, a.localTrabalho].filter(Boolean).join(' · ') || '—'}</td><td>{a.telefone || '—'}</td>
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
