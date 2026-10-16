import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import { Cartao, Carregando } from '../componentes'
import { dataHora } from '../formatar'
import { t as tx } from '../../i18n/linguas'

const ICONES = { cadeira: 'fa-book-open', material: 'fa-file-alt', trabalho: 'fa-file-signature', questionario: 'fa-question-circle', inquerito: 'fa-poll', forum: 'fa-comments' }
const csv = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`

// "há 3 dias", "hoje", "nunca"
function ultimo(dias) {
  if (dias === null) return <span className="badge bg-danger">{tx('Nunca entrou')}</span>
  if (dias === 0) return 'hoje'
  const t = dias === 1 ? 'ontem' : tx('há {0} dias', { 0: dias })
  return dias >= 7 ? <span className="badge bg-warning text-dark">{t}</span> : t
}

/*
  Relatórios do docente (como os "Reports" do Moodle): participação de cada estudante,
  uso de cada atividade e o registo de acessos (quem abriu o quê e quando).
*/
function Relatorios({ c, avisar }) {
  const [p, setP] = useState(null)
  const [registos, setRegistos] = useState(null)
  const [estudante, setEstudante] = useState('')
  const [mais, setMais] = useState(false)
  const falhou = useCallback((e) => avisar({ tipo: 'erro', texto: e.message }), [avisar])
  useEffect(() => { api(`/cadeiras/${c.id}/relatorios/participacao`).then(setP).catch(falhou) }, [c.id, falhou])
  const carregarRegistos = useCallback((antesDe) => {
    const q = new URLSearchParams({ ...(estudante ? { estudanteId: estudante } : {}), ...(antesDe ? { antesDe } : {}) })
    return api(`/cadeiras/${c.id}/relatorios/registos?${q}`).then((l) => {
      setRegistos((atual) => (antesDe ? [...(atual || []), ...l] : l))
      setMais(l.length === 100)
    }).catch(falhou)
  }, [c.id, estudante, falhou])
  useEffect(() => { carregarRegistos() }, [carregarRegistos])
  if (!p) return <Carregando />

  function exportar() {
    const cab = [tx('Estudante'), tx('Número'), tx('Acessos'), tx('Último acesso'), tx('Atividades abertas'), tx('Entregas'), tx('Questionários'), tx('Fórum')]
    const linhas = p.estudantes.map((e) => [e.estudante.nome, e.estudante.numero, e.acessos, e.ultimoAcesso ? dataHora(e.ultimoAcesso) : tx('Nunca'), e.atividadesVistas, e.entregas, e.questionarios, e.forum])
    const texto = [[tx('Participação — {0} {1}', { 0: c.codigo, 1: c.nome })], [], cab, ...linhas].map((l) => l.map(csv).join(';')).join('\r\n')
    const url = URL.createObjectURL(new Blob(['\uFEFF', texto], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `participacao-${c.codigo}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const semAcesso = p.estudantes.filter((e) => e.diasSemAcesso === null || e.diasSemAcesso >= 7).length
  return (
    <div className="p-coluna">
      <Cartao
        titulo={<><i className="fa fa-chart-line me-2" />{tx('Participação dos estudantes')}</>}
        acoes={<button type="button" className="btn btn-xs btn-white" onClick={exportar}><i className="fa fa-file-excel me-1" />{tx('Exportar para Excel')}</button>}
        corpo={false}
      >
        {semAcesso > 0 && <div className="alert alert-warning rounded-0 mb-0 py-2 small"><i className="fa fa-exclamation-triangle me-1" />{semAcesso} {tx('estudante(s) sem entrar na cadeira há uma semana ou mais.')}</div>}
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead><tr><th>{tx('Estudante')}</th><th className="text-center">{tx('Acessos')}</th><th>{tx('Último acesso')}</th><th className="text-center">{tx('Atividades abertas')}</th><th className="text-center">{tx('Entregas')}</th><th className="text-center">{tx('Questionários')}</th><th className="text-center">{tx('Fórum')}</th><th /></tr></thead>
            <tbody>
              {p.estudantes.map((e) => (
                <tr key={e.estudante.id}>
                  <td><b>{e.estudante.nome}</b><div className="small text-muted">{e.estudante.numero}</div></td>
                  <td className="text-center">{e.acessos}</td>
                  <td className="small">{ultimo(e.diasSemAcesso)}</td>
                  <td className="text-center">{e.atividadesVistas} / {p.atividades.length}</td>
                  <td className="text-center">{e.entregas}</td>
                  <td className="text-center">{e.questionarios}</td>
                  <td className="text-center">{e.forum}</td>
                  <td className="text-end"><button type="button" className="btn btn-xs btn-white" onClick={() => setEstudante(String(e.estudante.id))}>{tx('Registos')}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Cartao>

      <Cartao titulo={<><i className="fa fa-eye me-2" />{tx('Uso das atividades')}</>} corpo={false}>
        <div className="table-responsive">
          <table className="table align-middle mb-0">
            <thead><tr><th>{tx('Atividade')}</th><th className="text-center">{tx('Aberturas')}</th><th style={{ width: '35%' }}>{tx('Estudantes que abriram')}</th></tr></thead>
            <tbody>
              {p.atividades.map((a) => {
                const pc = p.totalEstudantes ? Math.round((a.estudantes / p.totalEstudantes) * 100) : 0
                return (
                  <tr key={`${a.tipo}-${a.id}`}>
                    <td><i className={`fa ${ICONES[a.tipo]} text-muted me-2`} />{a.titulo}</td>
                    <td className="text-center">{a.vistas}</td>
                    <td>
                      <div className="d-flex align-items-center gap-2">
                        <div className="progress flex-grow-1" style={{ height: 8 }}><div className="progress-bar bg-teal" style={{ width: `${pc}%` }} /></div>
                        <span className="small text-nowrap">{a.estudantes} / {p.totalEstudantes}</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Cartao>

      <Cartao
        titulo={<><i className="fa fa-history me-2" />{tx('Registo de acessos')}</>}
        acoes={(
          <select className="form-select form-select-sm" style={{ width: 230 }} value={estudante} onChange={(e) => setEstudante(e.target.value)} aria-label={tx('Filtrar por estudante')}>
            <option value="">{tx('Todos os estudantes')}</option>
            {p.estudantes.map((e) => <option key={e.estudante.id} value={e.estudante.id}>{e.estudante.nome}</option>)}
          </select>
        )}
        corpo={false}
      >
        <div className="list-group list-group-flush">
          {!registos && <div className="list-group-item text-muted small">{tx('A carregar…')}</div>}
          {registos?.length === 0 && <div className="list-group-item text-muted small">{tx('Sem registos.')}</div>}
          {registos?.map((r) => (
            <div key={r.id} className="list-group-item d-flex align-items-center gap-3 small">
              <span className="text-muted text-nowrap" style={{ width: 150 }}>{dataHora(r.em)}</span>
              <span className="fw-bold text-truncate" style={{ width: 220 }}>{r.estudante.nome}</span>
              <span className="text-truncate"><i className={`fa ${ICONES[r.tipo]} text-muted me-2`} />{r.titulo}</span>
            </div>
          ))}
        </div>
        {mais && <div className="panel-body text-center"><button type="button" className="btn btn-sm btn-white" onClick={() => carregarRegistos(registos.at(-1).id)}>{tx('Mostrar mais')}</button></div>}
      </Cartao>
    </div>
  )
}

export default Relatorios
