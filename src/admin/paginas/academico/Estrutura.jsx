import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import { useSessao } from '../../sessaoContexto'
import { Aviso, CabecalhoPagina, Carregando, Erro, Painel } from '../../componentes/Ui'
import { t as tx } from '../../../i18n/linguas'
import { useAnoTrabalho } from '../../anoTrabalho'

/*
  Estrutura do ensino no ano lectivo de trabalho: os cursos (com o Director e as turmas) e os departamentos (com o
  chefe e quem lá trabalha, e as cadeiras de cada um, com os docentes). A Administração Escolar põe cada cadeira no
  seu departamento; o chefe e os professores de um departamento veem aqui o seu, com as pautas e as presenças.
*/
function Tabela({ cadeiras, gerir, nomes, mudar }) {
  return (
    <div className="table-responsive">
      <table className="table table-sm table-striped align-middle mb-0">
        <thead><tr><th>{tx('Cadeira')}</th><th>{tx('Curso / turma')}</th><th>{tx('Docentes')}</th><th className="text-end">{tx('Horas')}</th><th />{gerir && <th>{tx('Departamento')}</th>}</tr></thead>
        <tbody>
          {cadeiras.map((c) => (
            <tr key={c.id}>
              <td><Link to={`/academico/cadeiras/${c.id}`}><b>{c.codigo}</b> — {c.nome}</Link></td>
              <td className="small">{c.curso} · {c.turma}</td>
              <td className="small">{c.docentes.length ? c.docentes.join(', ') : <span className="text-muted">{tx('por alocar')}</span>}{c.propostos > 0 && <span className="badge bg-info text-dark ms-1">{tx('{0} à espera do Comandante', { 0: c.propostos })}</span>}</td>
              <td className="text-end">{c.horas}</td>
              <td className="text-end text-nowrap">
                <Link to={`/academico/documentos/cadeira/${c.id}/pauta`} className="btn btn-xs btn-white me-1"><i className="fa fa-print me-1" />{tx('Pauta')}</Link>
                <Link to={`/academico/documentos/cadeira/${c.id}/presencas`} className="btn btn-xs btn-white"><i className="fa fa-user-check me-1" />{tx('Presenças')}</Link>
                {c.turmaId && <Link to={`/academico/turmas/${c.turmaId}/horario-mensal`} className="btn btn-xs btn-white ms-1"><i className="fa fa-calendar me-1" />{tx('Horário')}</Link>}
              </td>
              {gerir && (
                <td><select className="form-select form-select-sm" value={c.departamento} onChange={(e) => mudar(c, e.target.value)} aria-label={tx('Departamento de {0}', { 0: c.nome })}>
                  <option value="">{tx('— sem departamento —')}</option>
                  {nomes.map((n) => <option key={n} value={n}>{n}</option>)}
                </select></td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Estrutura() {
  const { pode } = useSessao()
  const gerir = pode('academico.gerir')
  const { ano, carregado } = useAnoTrabalho()
  // ao abrir, o ano do menu ainda pode mudar (enquanto chegam os anos lectivos): só vale a resposta do ano actual
  const anoPedido = useRef(ano)
  useEffect(() => { anoPedido.current = ano }, [ano])
  const [r, setR] = useState({ ano: null, d: null })
  const d = r.ano === ano ? r.d : null
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState(null)
  const carregar = useCallback(() => api(`/academico/estrutura${ano ? `?anoLetivo=${encodeURIComponent(ano)}` : ''}`)
    .then((x) => { if (anoPedido.current === ano) { setErro(''); setR({ ano, d: x }) } })
    .catch((e) => { if (anoPedido.current === ano) setErro(e.message) }), [ano])
  useEffect(() => { if (carregado) carregar() }, [carregar, carregado])
  const mudar = (c, departamento) => api(`/academico/cadeiras/${c.id}/departamento`, { metodo: 'PUT', corpo: { departamento } })
    .then(() => { setAviso({ texto: tx('«{0}» passou para {1}.', { 0: c.nome, 1: departamento || tx('sem departamento') }) }); carregar() })
    .catch((e) => setAviso({ tipo: 'erro', texto: e.message }))
  if (erro) return <Erro texto={erro} onRepetir={carregar} />
  if (!d) return <Carregando />
  const nomes = d.departamentos.map((x) => x.nome)

  return (
    <>
      <CabecalhoPagina titulo={d.meuDepartamento || tx('Estrutura do ensino')} subtitulo={tx('ano lectivo {0} — cursos, departamentos e cadeiras', { 0: ano || '—' })} migalhas={[{ rotulo: tx('Administração Escolar') }, { rotulo: tx('Estrutura do ensino') }]} />
      <Aviso aviso={aviso} onFechar={() => setAviso(null)} />

      {d.cursos.length > 0 && (
        <Painel titulo={tx('Cursos e directores')} icone="fa-graduation-cap" corpo={false}>
          <div className="table-responsive">
            <table className="table table-sm align-middle mb-0">
              <thead><tr><th>{tx('Curso')}</th><th>{tx('Director do curso')}</th><th>{tx('Turmas')}</th><th className="text-end">{tx('Estudantes')}</th><th className="text-end">{tx('Cadeiras')}</th></tr></thead>
              <tbody>
                {d.cursos.map((c) => (
                  <tr key={c.id}>
                    <td className="fw-bold">{c.nome}{c.sigla ? ` (${c.sigla})` : ''}</td>
                    <td>{c.director ? <>{c.director.nome}{c.director.cargo && <div className="small text-muted">{c.director.cargo}</div>}</> : <Link to="/academico/turmas" className="text-muted">{tx('por designar')}</Link>}</td>
                    <td className="small">{c.turmas.map((t) => <Link key={t.id} to={`/academico/turmas/${t.id}`} className="me-2">{t.nome}</Link>)}</td>
                    <td className="text-end">{c.turmas.reduce((s, t) => s + t.estudantes, 0)}</td>
                    <td className="text-end">{c.turmas.reduce((s, t) => s + t.cadeiras, 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Painel>
      )}

      {d.semDepartamento.length > 0 && (
        <Painel titulo={tx('Cadeiras sem departamento ({0})', { 0: d.semDepartamento.length })} icone="fa-exclamation-triangle" corpo={false}>
          <p className="small text-muted px-3 pt-2 mb-2">{tx('Escolha o departamento de cada cadeira: o chefe e os professores desse departamento passam a vê-la.')}</p>
          <Tabela cadeiras={d.semDepartamento} gerir={gerir} nomes={nomes} mudar={mudar} />
        </Painel>
      )}

      <div className="row">
        {d.departamentos.map((x) => (
          <div key={x.nome} className="col-12">
            <Painel titulo={<>{x.nome} <span className="badge bg-secondary ms-1">{tx('{0} cadeira(s)', { 0: x.cadeiras.length })}</span></>} icone="fa-sitemap" corpo={false}>
              <div className="px-3 py-2 small border-bottom">
                <i className="fa fa-users me-1 text-muted" />
                {x.pessoas.length ? x.pessoas.map((p) => <span key={p.id} className="me-3"><b>{p.nome}</b>{p.cargo && <span className="text-muted"> — {p.cargo}</span>}</span>) : <span className="text-muted">{tx('Ainda sem contas no painel (vêm do Pessoal, de quem trabalha no departamento).')}</span>}
              </div>
              {x.cadeiras.length ? <Tabela cadeiras={x.cadeiras} gerir={gerir} nomes={nomes} mudar={mudar} /> : <p className="text-muted small p-3 mb-0">{tx('Ainda sem cadeiras neste ano lectivo.')}</p>}
            </Painel>
          </div>
        ))}
      </div>
    </>
  )
}

export default Estrutura
