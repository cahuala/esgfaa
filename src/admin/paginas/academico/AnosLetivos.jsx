import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import { useSessao } from '../../sessaoContexto'
import { Aviso, CabecalhoPagina, Carregando, Confirmar, Erro, Painel } from '../../componentes/Ui'
import { dataCurta as data } from '../../formatar'
import { t as tx } from '../../../i18n/linguas'

const CAMPOS = [
  ['inicio', tx('Início do ano')], ['fim', tx('Fim do ano')],
  ['semestre1Inicio', tx('1.º semestre: início')], ['semestre1Fim', tx('1.º semestre: fim')],
  ['semestre2Inicio', tx('2.º semestre: início')], ['semestre2Fim', tx('2.º semestre: fim')],
]
const seguinte = (lista) => {
  const ultimo = lista?.[0]?.id
  const a = ultimo ? Number(ultimo.slice(5)) : new Date().getFullYear()
  return `${a}/${a + 1}`
}
const padrao = (id) => {
  const [a, b] = id.split('/').map(Number)
  return { inicio: `${a}-10-01`, fim: `${b}-07-31`, semestre1Inicio: `${a}-10-01`, semestre1Fim: `${b}-02-15`, semestre2Inicio: `${b}-02-16`, semestre2Fim: `${b}-07-31` }
}

/*
  Configuração do ano: o ano letivo e as datas dos dois semestres (e qual é o atual). Depois, por esta ordem:
  cursos, turmas do ano, cadeiras de cada turma (com o semestre) e a alocação dos docentes.
*/
function AnosLetivos() {
  const { pode } = useSessao()
  const gerir = pode('academico.gerir')
  const [lista, setLista] = useState(null)
  const [erro, setErro] = useState('')
  const [f, setF] = useState(null) // { id, novo, ...datas }
  const [erroForm, setErroForm] = useState('')
  const [aviso, setAviso] = useState(null)
  const [confirmar, setConfirmar] = useState(null)
  const carregar = useCallback(() => api('/academico/anos-letivos').then((r) => { setErro(''); setLista(r) }).catch((e) => setErro(e.message)), [])
  useEffect(() => { carregar() }, [carregar])

  const atual = lista?.find((a) => a.atual)
  const caminho = (id) => id.replace('/', '-')
  async function guardar(e) {
    e.preventDefault()
    setErroForm('')
    const { novo, id, ...datas } = f
    try {
      if (novo) await api('/academico/anos-letivos', { metodo: 'POST', corpo: { id, ...datas } })
      else await api(`/academico/anos-letivos/${caminho(id)}`, { metodo: 'PUT', corpo: datas })
      setAviso({ texto: novo ? tx('Ano letivo {0} criado.', { 0: id }) : tx('Datas de {0} guardadas.', { 0: id }) })
      setF(null)
      carregar()
    } catch (falha) {
      setErroForm(falha.message)
    }
  }
  const tornarAtual = (a) => api(`/academico/anos-letivos/${caminho(a.id)}/atual`, { metodo: 'POST' }).then((r) => { setLista(r); setAviso({ texto: tx('{0} é agora o ano letivo atual.', { 0: a.id }) }) }).catch((e) => setAviso({ tipo: 'erro', texto: e.message }))
  const apagar = (a) => setConfirmar({
    titulo: tx('Apagar ano letivo'), texto: tx('Apagar o ano letivo {0}?', { 0: a.id }), botao: tx('Apagar'), perigo: true,
    confirmar: async () => {
      setConfirmar(null)
      try { await api(`/academico/anos-letivos/${caminho(a.id)}`, { metodo: 'DELETE' }); carregar() } catch (e) { setAviso({ tipo: 'erro', texto: e.message }) }
    },
  })

  const passos = [
    [tx('Ano letivo e semestres'), 'fa-calendar', null, atual ? tx('atual: {0}', { 0: atual.id }) : tx('por configurar')],
    [tx('Cursos'), 'fa-graduation-cap', '/colecao/cursos', tx('os cursos da Escola')],
    [tx('Turmas'), 'fa-users', '/academico/turmas', tx('de cada curso e ano letivo')],
    [tx('Cadeiras e semestre'), 'fa-book', '/academico/turmas', tx('em cada turma: 1.º, 2.º semestre ou anual')],
    [tx('Alocar docentes'), 'fa-chalkboard-teacher', '/academico/alocacao', tx('regente e assistentes de cada cadeira')],
  ]

  return (
    <>
      <CabecalhoPagina titulo={tx('Ano letivo e semestres')} subtitulo={tx('as datas do ano; depois os cursos, as turmas, as cadeiras e a alocação dos docentes')} migalhas={[{ rotulo: tx('Administração Escolar') }, { rotulo: tx('Ano letivo') }]}>
        {gerir && <button type="button" className="btn btn-theme" onClick={() => { const id = seguinte(lista); setErroForm(''); setF({ novo: true, id, ...padrao(id) }) }}><i className="fa fa-plus me-1" />{tx('Novo ano letivo')}</button>}
      </CabecalhoPagina>

      <div className="row g-2 mb-3">
        {passos.map(([titulo, icone, para, nota], i) => {
          const corpo = (
            <div className="d-flex align-items-center gap-2 p-2 border rounded bg-white h-100">
              <span className="badge rounded-pill bg-dark">{i + 1}</span>
              <i className={`fa ${icone} text-muted`} />
              <span className="min-w-0"><span className="d-block fw-bold small">{titulo}</span><span className="d-block small text-muted text-truncate">{nota}</span></span>
            </div>
          )
          return <div key={titulo} className="col-md">{para ? <Link to={para} className="text-decoration-none text-body d-block h-100">{corpo}</Link> : corpo}</div>
        })}
      </div>

      {erro && <Erro texto={erro} onRepetir={carregar} />}
      {!lista && !erro && <Carregando />}
      {lista?.length === 0 && <div className="alert alert-warning">{tx('Ainda não há anos letivos. Crie o primeiro com «Novo ano letivo».')}</div>}

      {f && (
        <Painel titulo={f.novo ? tx('Novo ano letivo') : tx('Datas de {0}', { 0: f.id })}>
          <form onSubmit={guardar}>
            {erroForm && <div className="alert alert-danger py-2">{erroForm}</div>}
            <div className="row g-2">
              {f.novo && (
                <div className="col-md-3">
                  <label className="form-label fw-bold" htmlFor="ano-id">{tx('Ano letivo')}</label>
                  <input id="ano-id" className="form-control" value={f.id} placeholder="2026/2027" onChange={(e) => { const id = e.target.value; setF({ ...f, id, ...(/^\d{4}\/\d{4}$/.test(id) ? padrao(id) : {}) }) }} required />
                </div>
              )}
              {CAMPOS.map(([k, rotulo]) => (
                <div key={k} className="col-md-3 col-6">
                  <label className="form-label" htmlFor={`ano-${k}`}>{rotulo}</label>
                  <input id={`ano-${k}`} type="date" className="form-control" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} required />
                </div>
              ))}
            </div>
            <div className="d-flex gap-2 mt-3">
              <button type="submit" className="btn btn-theme"><i className="fa fa-save me-1" />{f.novo ? tx('Criar ano letivo') : tx('Guardar')}</button>
              <button type="button" className="btn btn-white" onClick={() => setF(null)}>{tx('Cancelar')}</button>
            </div>
          </form>
        </Painel>
      )}

      <div className="row">
        {lista?.map((a) => (
          <div key={a.id} className="col-xl-4 col-md-6">
            <Painel titulo={<>{tx('Ano letivo {0}', { 0: a.id })}{a.atual && <span className="badge bg-success ms-2">{tx('Atual')}</span>}</>}>
              <div className="small text-muted mb-2">{data(a.inicio)} – {data(a.fim)} · {tx('{0} turma(s)', { 0: a.turmas })}</div>
              {[['1', a.semestre1Inicio, a.semestre1Fim], ['2', a.semestre2Inicio, a.semestre2Fim]].map(([n, de, ate]) => (
                <div key={n} className={`d-flex align-items-center gap-2 p-2 rounded mb-1 ${a.semestreAtual === n ? 'bg-success bg-opacity-10 border border-success' : 'bg-light'}`}>
                  <span className="fw-bold">{n === '1' ? tx('1.º semestre') : tx('2.º semestre')}</span>
                  <span className="small text-muted ms-auto">{data(de)} – {data(ate)}</span>
                  {a.semestreAtual === n && <span className="badge bg-success">{tx('Em curso')}</span>}
                </div>
              ))}
              {gerir && (
                <div className="d-flex flex-wrap gap-1 mt-2">
                  <button type="button" className="btn btn-xs btn-white" onClick={() => { setErroForm(''); setF({ id: a.id, inicio: a.inicio, fim: a.fim, semestre1Inicio: a.semestre1Inicio, semestre1Fim: a.semestre1Fim, semestre2Inicio: a.semestre2Inicio, semestre2Fim: a.semestre2Fim }) }}><i className="fa fa-pen me-1" />{tx('Datas')}</button>
                  {!a.atual && <button type="button" className="btn btn-xs btn-white" onClick={() => tornarAtual(a)}><i className="fa fa-star me-1" />{tx('Tornar atual')}</button>}
                  <Link to="/academico/turmas" className="btn btn-xs btn-white"><i className="fa fa-users me-1" />{tx('Turmas')}</Link>
                  {a.turmas === 0 && <button type="button" className="btn btn-xs btn-white text-danger ms-auto" onClick={() => apagar(a)} aria-label={tx('Apagar o ano letivo {0}', { 0: a.id })}><i className="fa fa-trash-alt" /></button>}
                </div>
              )}
            </Painel>
          </div>
        ))}
      </div>
      <Confirmar pedido={confirmar} onCancelar={() => setConfirmar(null)} />
      <Aviso aviso={aviso} onFechar={() => setAviso(null)} />
    </>
  )
}

export default AnosLetivos
