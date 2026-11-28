import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import { CabecalhoPagina, Carregando, Erro, Painel } from '../../componentes/Ui'
import { descarregarCsv } from './documentos/csv'
import { t as tx } from '../../../i18n/linguas'

const sem = (v) => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/*
  Antigos alunos: quem concluiu cursos na Escola, com os cursos feitos e o posto, a função e a unidade de hoje (do
  Sistema de Pessoal), para os relatórios ao Estado-Maior. Filtra-se por curso, ano e Ramo e exporta-se para o Excel.
*/
export default function AntigosAlunos() {
  const [d, setD] = useState(null)
  const [erro, setErro] = useState('')
  const [f, setF] = useState({ curso: '', ano: '', ramo: '', q: '' })
  useEffect(() => { api('/academico/antigos-alunos').then(setD).catch((e) => setErro(e.message)) }, [])
  if (erro) return <Erro texto={erro} />
  if (!d) return <Carregando />

  const cursos = [...new Set(d.lista.flatMap((l) => l.cursos.map((c) => c.curso)))].sort()
  const termos = sem(f.q).split(/\s+/).filter(Boolean)
  const vistos = d.lista.filter((l) => (!f.ramo || l.ramo === f.ramo)
    && (!f.curso && !f.ano ? true : l.cursos.some((c) => (!f.curso || c.curso === f.curso) && (!f.ano || c.anoLetivo === f.ano)))
    && termos.every((t) => sem([l.nome, l.nip, l.posto, l.funcao, l.unidade].join(' ')).includes(t)))
  const cursosDe = (l) => l.cursos.map((c) => `${c.turma} (${c.anoLetivo})`).join('; ')
  const exportar = () => descarregarCsv(`antigos-alunos${f.curso ? `-${f.curso}` : ''}${f.ano ? `-${f.ano}` : ''}`, [
    ['ESCOLA SUPERIOR DE GUERRA'], ['DIRECÇÃO DE ENSINO'], ['RELAÇÃO DOS ANTIGOS ALUNOS'], [[f.curso, f.ano, f.ramo].filter(Boolean).join(' — ').toUpperCase() || 'TODOS OS CURSOS'], [],
    ['Nº', 'NIP', 'POSTO', 'NOME COMPLETO', 'RAMO', 'CURSOS FEITOS NA ESG', 'FUNÇÃO ACTUAL', 'UNIDADE ACTUAL', 'TELEFONE'],
    ...vistos.map((l, i) => [String(i + 1).padStart(2, '0'), l.nip, l.posto, l.nome, l.ramo, cursosDe(l), l.funcao, l.unidade, l.telefone]),
  ])

  return (
    <>
      <CabecalhoPagina titulo={tx('Antigos alunos')} subtitulo={tx('{0} pessoa(s) que concluíram cursos na Escola — o posto, a função e a unidade vêm do Sistema de Pessoal', { 0: d.total })} migalhas={[{ rotulo: tx('Administração Escolar') }, { rotulo: tx('Antigos alunos') }]}>
        <button type="button" className="btn btn-white" onClick={exportar}><i className="fa fa-file-excel me-1 text-success" />{tx('Exportar Excel')}</button>
      </CabecalhoPagina>
      <div className="row">
        <div className="col-xl-9">
          <Painel titulo={tx('Relação ({0})', { 0: vistos.length })} corpo={false}>
            <div className="d-flex flex-wrap gap-2 p-2 border-bottom">
              <select className="form-select form-select-sm w-auto" value={f.curso} onChange={(e) => setF({ ...f, curso: e.target.value })} aria-label={tx('Curso')}><option value="">{tx('Todos os cursos')}</option>{cursos.map((c) => <option key={c} value={c}>{c}</option>)}</select>
              <select className="form-select form-select-sm w-auto" value={f.ano} onChange={(e) => setF({ ...f, ano: e.target.value })} aria-label={tx('Ano lectivo')}><option value="">{tx('Todos os anos')}</option>{d.anos.map((a) => <option key={a} value={a}>{a}</option>)}</select>
              <select className="form-select form-select-sm w-auto" value={f.ramo} onChange={(e) => setF({ ...f, ramo: e.target.value })} aria-label={tx('Ramo')}><option value="">{tx('Todos os Ramos')}</option>{d.porRamo.map(([r]) => <option key={r} value={r === '—' ? '' : r}>{r}</option>)}</select>
              <input className="form-control form-control-sm" style={{ maxWidth: 260 }} placeholder={tx('Procurar (nome, NIP, função, unidade)')} value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
            </div>
            <div className="table-responsive" style={{ maxHeight: 640 }}>
              <table className="table table-sm table-striped align-middle mb-0">
                <thead><tr><th>{tx('Nº')}</th><th>{tx('Nome')}</th><th>{tx('Ramo')}</th><th>{tx('Cursos na ESG')}</th><th>{tx('Função actual')}</th><th>{tx('Unidade actual')}</th></tr></thead>
                <tbody>
                  {vistos.length === 0 && <tr><td colSpan={6} className="text-center text-muted py-4">{tx('Ninguém com estes filtros.')}</td></tr>}
                  {vistos.map((l, i) => (
                    <tr key={l.id}>
                      <td className="text-muted small">{i + 1}</td>
                      <td><Link to={`/pessoal/registo/${l.id}/ficha`} className="fw-bold text-body text-decoration-none">{[l.posto, l.nome].filter(Boolean).join(' ')}</Link><div className="small text-muted">{l.nip && `NIP ${l.nip}`}{!l.ativo && <span className="badge bg-secondary ms-1">{tx('saiu')}</span>}</div></td>
                      <td>{l.ramo || '—'}</td>
                      <td className="small">{l.cursos.map((c, k) => <div key={k}>{c.turma} <span className="text-muted">{c.anoLetivo}</span></div>)}</td>
                      <td className="small">{l.funcao || '—'}</td>
                      <td className="small">{l.unidade || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Painel>
        </div>
        <div className="col-xl-3">
          <Painel titulo={tx('Por Ramo')} corpo={false}>
            <ul className="list-group list-group-flush">{d.porRamo.map(([r, n]) => <li key={r} className="list-group-item d-flex justify-content-between"><span>{r}</span><b>{n}</b></li>)}</ul>
          </Painel>
          <Painel titulo={tx('Por posto (hoje)')} corpo={false}>
            <ul className="list-group list-group-flush" style={{ maxHeight: 360, overflowY: 'auto' }}>{d.porPosto.map(([p, n]) => <li key={p} className="list-group-item d-flex justify-content-between"><span>{p}</span><b>{n}</b></li>)}</ul>
          </Painel>
        </div>
      </div>
    </>
  )
}
