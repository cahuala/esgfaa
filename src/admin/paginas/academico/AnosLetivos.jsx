import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import { useSessao } from '../../sessaoContexto'
import { Aviso, CabecalhoPagina, Carregando, Confirmar, Erro, Janela, Painel } from '../../componentes/Ui'
import { dataCurta as data } from '../../formatar'
import { t as tx } from '../../../i18n/linguas'
import { avisarAnosMudaram } from '../../anoTrabalho'

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
  // o Comandante reabre directamente; a Administração Escolar pede
  const comandante = pode('academico.homologar')
  const [reabrir, setReabrir] = useState(null) // { id, motivo, finalidade, documento }
  const [lista, setLista] = useState(null)
  const [erro, setErro] = useState('')
  const [f, setF] = useState(null) // { id, novo, ...datas }
  const [erroForm, setErroForm] = useState('')
  const [aviso, setAviso] = useState(null)
  const [confirmar, setConfirmar] = useState(null)
  const carregar = useCallback(() => api('/academico/anos-letivos').then((r) => { setErro(''); setLista(r); avisarAnosMudaram() }).catch((e) => setErro(e.message)), [])
  useEffect(() => { carregar() }, [carregar])

  const atual = lista?.find((a) => a.atual)
  // fechar é por ordem do Comandante: ele fecha logo; a Administração Escolar pede e fecha quando ele aprovar
  const fechar = (a) => setConfirmar({
    titulo: comandante ? tx('Fechar o ano lectivo') : tx('Pedir ao Comandante o fecho do ano lectivo'),
    texto: `${comandante ? tx('Fechar o ano lectivo {0}?', { 0: a.id }) : tx('Pedir ao Comandante o fecho do ano lectivo {0}?', { 0: a.id })} ${tx('Fechado, já não se poderão alterar as turmas, cadeiras, matrículas, notas e actividades desse ano, nem emitir documentos dele. Só o Comandante o pode reabrir.')} ${tx('Antes de fechar, imprima todos os diplomas, certificados e declarações desse ano.')}`,
    botao: comandante ? tx('Fechar o ano') : tx('Enviar ao Comandante'), perigo: true,
    confirmar: async () => {
      setConfirmar(null)
      try {
        const r = await api(`/academico/anos-letivos/${caminho(a.id)}/fechar`, { metodo: 'POST', corpo: {} })
        setLista(r.anos)
        avisarAnosMudaram()
        setAviso({ texto: r.fechado ? tx('Ano lectivo {0} fechado.', { 0: a.id }) : tx('Pedido enviado ao Comandante: o ano fecha quando ele aprovar.') })
      } catch (e) { setAviso({ tipo: 'erro', texto: e.message }) }
    },
  })
  async function pedirReabertura(e) {
    e.preventDefault()
    try {
      const r = await api(`/academico/anos-letivos/${caminho(reabrir.id)}/reabrir`, { metodo: 'POST', corpo: { motivo: reabrir.motivo, finalidade: reabrir.finalidade, ...(reabrir.finalidade === 'documento' ? { documento: reabrir.documento } : {}) } })
      setLista(r.anos)
      avisarAnosMudaram()
      setAviso({ texto: r.reaberto ? tx('Ano lectivo {0} reaberto.', { 0: reabrir.id }) : tx('Pedido enviado ao Comandante: o ano reabre quando ele aprovar.') })
      setReabrir(null)
    } catch (falha) {
      setAviso({ tipo: 'erro', texto: falha.message })
    }
  }
  const caminho = (id) => id.replace('/', '-')
  async function guardar(e) {
    e.preventDefault()
    setErroForm('')
    const { novo, id, ...datas } = f
    try {
      if (novo) await api('/academico/anos-letivos', { metodo: 'POST', corpo: { id, ...datas } })
      else await api(`/academico/anos-letivos/${caminho(id)}`, { metodo: 'PUT', corpo: datas })
      setAviso({ texto: novo ? tx('Ano lectivo {0} criado.', { 0: id }) : tx('Datas de {0} guardadas.', { 0: id }) })
      setF(null)
      carregar()
    } catch (falha) {
      setErroForm(falha.message)
    }
  }
  const tornarAtual = (a) => api(`/academico/anos-letivos/${caminho(a.id)}/atual`, { metodo: 'POST' }).then((r) => { setLista(r); avisarAnosMudaram(); setAviso({ texto: tx('{0} é agora o ano lectivo actual.', { 0: a.id }) }) }).catch((e) => setAviso({ tipo: 'erro', texto: e.message }))
  const apagar = (a) => setConfirmar({
    titulo: tx('Apagar ano lectivo'), texto: tx('Apagar o ano lectivo {0}?', { 0: a.id }), botao: tx('Apagar'), perigo: true,
    confirmar: async () => {
      setConfirmar(null)
      try { await api(`/academico/anos-letivos/${caminho(a.id)}`, { metodo: 'DELETE' }); carregar() } catch (e) { setAviso({ tipo: 'erro', texto: e.message }) }
    },
  })

  const passos = [
    [tx('Ano lectivo e semestres'), 'fa-calendar', null, atual ? tx('actual: {0}', { 0: atual.id }) : tx('por configurar')],
    [tx('Cursos'), 'fa-graduation-cap', '/colecao/cursos', tx('os cursos da Escola')],
    [tx('Turmas'), 'fa-users', '/academico/turmas', tx('de cada curso e ano lectivo')],
    [tx('Cadeiras e semestre'), 'fa-book', '/academico/turmas', tx('em cada turma: 1.º, 2.º semestre ou anual')],
    [tx('Alocar docentes'), 'fa-chalkboard-teacher', '/academico/alocacao', tx('regente e assistentes de cada cadeira')],
  ]

  return (
    <>
      <CabecalhoPagina titulo={tx('Ano lectivo e semestres')} subtitulo={tx('as datas do ano; depois os cursos, as turmas, as cadeiras e a alocação dos docentes')} migalhas={[{ rotulo: tx('Administração Escolar') }, { rotulo: tx('Ano lectivo') }]}>
        {gerir && <button type="button" className="btn btn-theme" onClick={() => { const id = seguinte(lista); setErroForm(''); setF({ novo: true, id, ...padrao(id) }) }}><i className="fa fa-plus me-1" />{tx('Novo ano lectivo')}</button>}
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
      {lista?.length === 0 && <div className="alert alert-warning">{tx('Ainda não há anos lectivos. Crie o primeiro com «Novo ano lectivo».')}</div>}

      {f && (
        <Janela titulo={f.novo ? tx('Novo ano lectivo') : tx('Datas de {0}', { 0: f.id })} onFechar={() => setF(null)} larga>
          <form onSubmit={guardar}>
            {erroForm && <div className="alert alert-danger py-2">{erroForm}</div>}
            <div className="row g-2">
              {f.novo && (
                <div className="col-md-3">
                  <label className="form-label fw-bold" htmlFor="ano-id">{tx('Ano lectivo')}</label>
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
              <button type="submit" className="btn btn-theme"><i className="fa fa-save me-1" />{f.novo ? tx('Criar ano lectivo') : tx('Guardar')}</button>
              <button type="button" className="btn btn-white" onClick={() => setF(null)}>{tx('Cancelar')}</button>
            </div>
          </form>
        </Janela>
      )}

      {reabrir && (
        <Janela titulo={comandante ? tx('Reabrir o ano lectivo {0}', { 0: reabrir.id }) : tx('Pedir ao Comandante a reabertura de {0}', { 0: reabrir.id })} onFechar={() => setReabrir(null)} larga>
          <form onSubmit={pedirReabertura}>
            <div className="row g-2">
              <div className="col-md-4">
                <label className="form-label fw-bold" htmlFor="re-fim">{tx('Para quê')}</label>
                <select id="re-fim" className="form-select" value={reabrir.finalidade} onChange={(e) => setReabrir({ ...reabrir, finalidade: e.target.value })}>
                  <option value="actividades">{tx('Lançar notas ou outras actividades')}</option>
                  <option value="documento">{tx('Emitir um documento')}</option>
                </select>
              </div>
              {reabrir.finalidade === 'documento' && (
                <div className="col-md-8">
                  <label className="form-label fw-bold" htmlFor="re-doc">{tx('Documento a emitir')}</label>
                  <input id="re-doc" className="form-control" value={reabrir.documento} onChange={(e) => setReabrir({ ...reabrir, documento: e.target.value })} placeholder={tx('ex.: certificado de curso, declaração de frequência, pauta…')} required minLength={3} />
                </div>
              )}
              <div className="col-12">
                <label className="form-label fw-bold" htmlFor="re-motivo">{tx('Motivo')}</label>
                <textarea id="re-motivo" className="form-control" rows={2} value={reabrir.motivo} onChange={(e) => setReabrir({ ...reabrir, motivo: e.target.value })} required minLength={3} placeholder={tx('ex.: pedido do estudante (nome), nota em falta da cadeira…')} />
              </div>
            </div>
            <div className="d-flex gap-2 mt-3">
              <button type="submit" className="btn btn-theme"><i className="fa fa-lock-open me-1" />{comandante ? tx('Reabrir') : tx('Enviar ao Comandante')}</button>
              <button type="button" className="btn btn-white" onClick={() => setReabrir(null)}>{tx('Cancelar')}</button>
            </div>
          </form>
        </Janela>
      )}

      <div className="row">
        {lista?.map((a) => (
          <div key={a.id} className="col-xl-4 col-md-6">
            <Painel titulo={<>{tx('Ano lectivo {0}', { 0: a.id })}{a.atual && <span className="badge bg-success ms-2">{tx('Actual')}</span>}{a.fechado ? <span className="badge bg-dark ms-2"><i className="fa fa-lock me-1" />{tx('Fechado')}</span> : <span className="badge bg-light text-dark border ms-2"><i className="fa fa-lock-open me-1" />{tx('Aberto')}</span>}</>}>
              {a.fechado && <div className="small mb-2"><i className="fa fa-lock me-1 text-muted" />{tx('Fechado em {0}{1}: só se consulta. Para lançar notas, actividades ou emitir documentos, o Comandante tem de o reabrir.', { 0: data(a.fechadoEm), 1: a.fechadoPor ? tx(' por {0}', { 0: a.fechadoPor }) : '' })}</div>}
              {a.pedidoFecho && <div className="alert alert-info py-1 px-2 small mb-2"><i className="fa fa-hourglass-half me-1" />{tx('À espera do Comandante: fechar o ano (pedido por {0}).', { 0: a.pedidoFecho.pedidoPor })}</div>}
              {a.recusaFecho && !a.pedidoFecho && !a.fechado && <div className="small text-danger mb-2"><i className="fa fa-times-circle me-1" />{tx('O Comandante recusou o fecho: {0}', { 0: a.recusaFecho.motivoRecusa })}</div>}
              {a.pedidoReabertura && <div className="alert alert-info py-1 px-2 small mb-2"><i className="fa fa-hourglass-half me-1" />{tx('À espera do Comandante: reabrir {0} — {1}', { 0: a.pedidoReabertura.finalidade === 'documento' ? tx('para emitir «{0}»', { 0: a.pedidoReabertura.documento }) : tx('para notas e actividades'), 1: a.pedidoReabertura.motivo })}</div>}
              {a.recusaReabertura && !a.pedidoReabertura && <div className="small text-danger mb-2"><i className="fa fa-times-circle me-1" />{tx('O Comandante recusou a reabertura: {0}', { 0: a.recusaReabertura.motivoRecusa })}</div>}
              {!a.fechado && a.reabertura && <div className="small text-muted mb-2"><i className="fa fa-unlock me-1" />{tx('Reaberto por ordem de {0}: {1}. Feche-o outra vez quando terminar.', { 0: a.reabertura.autorizadoPor, 1: a.reabertura.documento ? `${a.reabertura.documento} — ${a.reabertura.motivo}` : a.reabertura.motivo })}</div>}
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
                  {!a.atual && <button type="button" className="btn btn-xs btn-white" onClick={() => tornarAtual(a)}><i className="fa fa-star me-1" />{tx('Tornar actual')}</button>}
                  <Link to="/academico/turmas" className="btn btn-xs btn-white"><i className="fa fa-users me-1" />{tx('Turmas')}</Link>
                  {!a.fechado && !a.pedidoFecho && <button type="button" className="btn btn-xs btn-white" onClick={() => fechar(a)}><i className="fa fa-lock me-1" />{comandante ? tx('Fechar o ano') : tx('Pedir o fecho ao Comandante')}</button>}
                  {a.fechado && !a.pedidoReabertura && <button type="button" className="btn btn-xs btn-white" onClick={() => setReabrir({ id: a.id, motivo: '', finalidade: 'actividades', documento: '' })}><i className="fa fa-lock-open me-1" />{comandante ? tx('Reabrir') : tx('Pedir reabertura ao Comandante')}</button>}
                  {a.turmas === 0 && <button type="button" className="btn btn-xs btn-white text-danger ms-auto" onClick={() => apagar(a)} aria-label={tx('Apagar o ano lectivo {0}', { 0: a.id })}><i className="fa fa-trash-alt" /></button>}
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
