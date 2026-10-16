import { useEffect, useMemo, useRef, useState } from 'react'
import { useSessao } from '../sessaoContexto'
import { Bloqueio, Vazio } from '../componentes'
import { dataHora, estadoSessao, faltam, nota, primeiroNome } from '../formatar'
import { lerContinuar, registarContinuar } from '../recentes'
import { concluida, listarAtividades, tipoVisual } from './atividades'
import VerMaterial from './VerMaterial'
import Trabalhos from './Trabalhos'
import Questionarios from './Questionarios'
import Inquerito from './Inquerito'
import Workshop from './Workshop'
import { t as tx } from '../../i18n/linguas'

/*
  Sala de aula do estudante: os capítulos à direita (cada um abre a lista dos seus itens)
  e, ao meio, o que se escolheu — a entrada da sala, um capítulo ou a aula aberta
  (PDF no leitor, vídeo, página, pasta, trabalho, questionário…), com "anterior / seguinte".
  Endereços: ?capitulo=ID (ou "geral") e ?atividade=material-5, como na página da cadeira.
  O docente pode pré-visualizá-la (?ver=estudante): vê o que os estudantes veem, sem entregar nem responder.
*/
const chaveGrupo = (g) => (g.id === null ? 'geral' : String(g.id))

function SalaAula(props) {
  const { c, progresso, irPara, especie, atividadeId, capitulo, previsualizar } = props
  const { conta } = useSessao()
  const topo = useRef(null)
  const [alternados, setAlternados] = useState({}) // capítulos abertos/fechados à mão no índice

  // só o que o estudante pode ver (os questionários por publicar não contam)
  // (na pré-visualização do docente tiram-se também as atividades e os capítulos escondidos)
  const atividades = useMemo(() => listarAtividades(c).filter((a) => !(a.especie === 'questionario' && a.publicado === false) && !(previsualizar && a.visivel === false)), [c, previsualizar])
  const grupos = useMemo(() => [
    { id: null, titulo: tx('Geral'), resumo: '', itens: atividades.filter((a) => (a.secaoId ?? null) === null) },
    ...c.secoes.filter((s) => !previsualizar || s.visivel !== false).map((s) => ({ ...s, itens: atividades.filter((a) => a.secaoId === s.id) })),
  ].filter((g) => g.id !== null || g.itens.length > 0), [c.secoes, atividades, previsualizar])
  const ordem = grupos.flatMap((g) => g.itens)
  const atual = especie ? ordem.find((a) => a.chave === `${especie}-${atividadeId}`) : null
  const grupoAtual = atual ? grupos.find((g) => g.itens.includes(atual)) : capitulo ? grupos.find((g) => chaveGrupo(g) === capitulo) : null
  const feita = (a) => concluida(a, progresso)
  const feitas = ordem.filter(feita).length
  // "continuar": a última aula aberta nesta cadeira; senão a primeira por fazer dos capítulos (a secção geral fica para o fim)
  const ultima = lerContinuar(conta.id)
  const daUltima = ultima?.cadeiraId === c.id ? ordem.find((a) => a.chave === ultima.chave && !a.bloqueio) : null
  const proxima = daUltima || [...ordem.filter((a) => a.secaoId), ...ordem.filter((a) => !a.secaoId)].find((a) => !a.bloqueio && !feita(a))

  // "Continuar onde parou" na página da turma
  useEffect(() => {
    if (atual && !previsualizar) registarContinuar(conta.id, { cadeiraId: c.id, cadeira: c.nome, chave: atual.chave, titulo: atual.titulo })
  }, [atual, conta.id, c.id, c.nome, previsualizar])

  // ir para outro sítio da sala e mostrar o topo da sala (não o da página)
  function ir(destino) {
    irPara(previsualizar ? { ...destino, ver: 'estudante' } : destino)
    requestAnimationFrame(() => {
      const y = (topo.current?.getBoundingClientRect().top || 0) + window.scrollY - 80
      window.scrollTo({ top: Math.max(0, y) })
    })
  }
  const abrirItem = (a) => ir({ atividade: a.chave })
  const abrirGrupo = (g) => ir({ capitulo: chaveGrupo(g) })

  // um capítulo está aberto no índice se foi aberto à mão, ou se é o da aula/capítulo à vista (ou o primeiro, à entrada)
  const primeiro = grupos.find((g) => g.id !== null) || grupos[0]
  const aberto = (g) => (chaveGrupo(g) in alternados ? alternados[chaveGrupo(g)] : g === (grupoAtual || primeiro))
  function clicarCapitulo(g) {
    const k = chaveGrupo(g)
    if (aberto(g)) { setAlternados((x) => ({ ...x, [k]: false })); return }
    setAlternados((x) => ({ ...x, [k]: true }))
    abrirGrupo(g)
  }

  let meio
  if (atual) meio = <Aula {...props} irPara={ir} abrirComoDocente={(a) => irPara({ atividade: a.chave })} a={atual} grupo={grupoAtual} ordem={ordem} feita={feita} abrirItem={abrirItem} abrirGrupo={abrirGrupo} />
  else if (grupoAtual) meio = <Capitulo g={grupoAtual} feita={feita} abrirItem={abrirItem} />
  else if (capitulo || especie) meio = <Vazio>{tx('Este conteúdo já não está disponível.')}</Vazio>
  else meio = <Entrada c={c} grupos={grupos} feita={feita} feitas={feitas} total={ordem.length} proxima={proxima} abrirItem={abrirItem} abrirGrupo={abrirGrupo} conta={conta} />

  return (
    <div className="row p-sala" ref={topo}>
      {previsualizar && (
        <div className="col-12">
          <div className="alert alert-info d-flex flex-wrap align-items-center gap-2 p-sala-previa">
            <i className="fa fa-user-graduate fa-lg" />
            <span className="flex-grow-1">{tx('Está a ver a sala de aula como os estudantes a veem. Não aparecem as atividades escondidas; as datas de abertura e as condições não se aplicam a si.')}</span>
            <button type="button" className="btn btn-sm btn-white" onClick={() => irPara({})}><i className="fa fa-pen me-1" />{tx('Voltar ao modo de docente')}</button>
          </div>
        </div>
      )}
      <div className="col-lg-8 col-xxl-9 p-sala-meio">{meio}</div>
      <aside className="col-lg-4 col-xxl-3" aria-label={tx('Capítulos da cadeira')}>
        <div className="p-sala-indice">
          <div className="p-sala-indice-topo">
            <button type="button" className={`p-sala-inicio ${!atual && !grupoAtual ? 'ativo' : ''}`} onClick={() => ir({})}>
              <i className="fa fa-chalkboard me-2" />{tx('Sala de aula')}
            </button>
            {ordem.length > 0 && (
              <div className="p-sala-progresso" title={tx('{0} de {1} atividades concluídas', { 0: feitas, 1: ordem.length })}>
                <div className="progress"><div className="progress-bar bg-success" style={{ width: `${Math.round((feitas / ordem.length) * 100)}%` }} /></div>
                <span>{feitas}/{ordem.length}</span>
              </div>
            )}
          </div>
          {grupos.length === 0 && <div className="p-3 small text-muted">{tx('O docente ainda não organizou a matéria em capítulos.')}</div>}
          <ol className="p-sala-capitulos">
            {grupos.map((g, i) => {
              const k = chaveGrupo(g)
              const n = g.itens.filter(feita).length
              const estaAberto = aberto(g)
              const completo = g.itens.length > 0 && n === g.itens.length
              return (
                <li key={k} className={`p-sala-capitulo ${g === grupoAtual ? 'atual' : ''}`}>
                  <button type="button" className="p-sala-capitulo-cab" onClick={() => clicarCapitulo(g)} aria-expanded={estaAberto} aria-controls={`sala-cap-${k}`}>
                    <span className={`p-sala-num ${completo ? 'completo' : ''}`}>{completo ? <i className="fa fa-check" /> : g.id === null ? <i className="fa fa-home" /> : (grupos[0].id === null ? i : i + 1)}</span>
                    <span className="p-sala-capitulo-titulo">
                      <span>{g.titulo}</span>
                      <small>{g.fechado ? <><i className="fa fa-lock me-1" />{tx('Abre')} {dataHora(g.disponivelDe)}</> : tx('{0} de {1} concluídas', { 0: n, 1: g.itens.length })}</small>
                    </span>
                    <i className={`fa fa-chevron-${estaAberto ? 'up' : 'down'} p-sala-seta`} aria-hidden="true" />
                  </button>
                  {estaAberto && (
                    <ul id={`sala-cap-${k}`} className="p-sala-itens">
                      {g.itens.length === 0 && <li className="p-sala-item vazio">{tx('Sem atividades neste capítulo.')}</li>}
                      {g.itens.map((a) => {
                        const t = tipoVisual(a)
                        return (
                          <li key={a.chave}>
                            <button type="button" className={`p-sala-item ${a === atual ? 'ativo' : ''} ${a.bloqueio ? 'fechado' : ''}`} onClick={() => abrirItem(a)} aria-current={a === atual ? 'page' : undefined}>
                              <span className={`p-sala-item-icone ${a.bloqueio ? 'bg-gray-400' : t.cor}`}><i className={`fa ${a.bloqueio ? 'fa-lock' : t.icone}`} /></span>
                              <span className="p-sala-item-titulo">{a.titulo}</span>
                              <Marca a={a} feita={feita(a)} />
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </li>
              )
            })}
          </ol>
        </div>
      </aside>
    </div>
  )
}

// marca à direita de cada item no índice: feito, fechado ou por fazer
function Marca({ a, feita }) {
  if (a.bloqueio) return <i className="fa fa-lock text-muted p-sala-marca" title={tx('Fechada')} />
  if (feita) return <i className="fa fa-check-circle text-success p-sala-marca" title={tx('Concluído')} />
  if (a.especie === 'trabalho' && a.estado !== 'fechado') return <span className="badge bg-warning text-dark p-sala-marca" title={tx('Por entregar')}>{faltam(a.prazo)}</span>
  return <i className="far fa-circle text-gray-400 p-sala-marca" title={tx('Por fazer')} />
}

// uma linha de texto sobre a atividade (tipo, prazo, duração…)
function meta(a) {
  const t = tipoVisual(a)
  if (a.especie === 'trabalho') return tx('Trabalho · entrega até {0}', { 0: dataHora(a.prazo) })
  if (a.especie === 'questionario') return tx('Questionário · {0} pergunta(s){1}', { 0: a.numeroPerguntas, 1: a.fecha ? ` · ${tx('fecha')} ${dataHora(a.fecha)}` : '' })
  if (a.tipo === 'videoconferencia') return tx('Videoconferência · {0} · {1} min', { 0: dataHora(a.inicio), 1: a.duracao })
  if (a.tipo === 'pasta') return tx('Pasta · {0} ficheiro(s)', { 0: a.ficheiros.length })
  return t.nome
}

function estado(a, feita) {
  if (a.bloqueio) return <span className="badge bg-light text-dark border"><i className="fa fa-lock me-1" />{tx('Fechada')}</span>
  if (a.especie === 'trabalho' && a.entrega) return a.entrega.nota !== null ? <span className="badge bg-success">{tx('Nota')} {nota(a.entrega.nota)}</span> : <span className="badge bg-success"><i className="fa fa-check me-1" />{tx('Entregue')}</span>
  if (a.tipo === 'videoconferencia') {
    const e = estadoSessao(a)
    if (e === 'a_decorrer' || e === 'abre') return <span className="badge bg-danger">{tx('A decorrer')}</span>
  }
  if (feita) return <span className="badge bg-success"><i className="fa fa-check me-1" />{tx('Concluído')}</span>
  if (a.especie === 'trabalho') return a.estado === 'fechado' ? <span className="badge bg-danger">{tx('Não entregue')}</span> : <span className="badge bg-warning text-dark">{tx('Por entregar')}</span>
  return null
}

// lista grande das atividades (entrada de um capítulo)
function ListaItens({ itens, feita, abrirItem }) {
  if (!itens.length) return <Vazio>{tx('Sem atividades neste capítulo.')}</Vazio>
  return (
    <div className="list-group list-group-flush p-sala-lista">
      {itens.map((a, i) => {
        const t = tipoVisual(a)
        return (
          <button key={a.chave} type="button" className={`list-group-item list-group-item-action d-flex align-items-center gap-3 py-3 ${a.bloqueio ? 'p-atividade-fechada' : ''}`} onClick={() => abrirItem(a)}>
            <span className="p-sala-ordem">{i + 1}</span>
            <span className={`p-atividade-icone ${a.bloqueio ? 'bg-gray-400' : t.cor}`}><i className={`fa ${a.bloqueio ? 'fa-lock' : t.icone}`} /></span>
            <span className="flex-grow-1 min-w-0 text-start">
              <span className="d-block fw-bold text-body">{a.titulo}</span>
              <span className="d-block small text-muted">{meta(a)}</span>
              {a.bloqueio ? <Bloqueio motivos={a.bloqueio} compacto /> : a.descricao && <span className="d-block small p-recorte">{a.descricao}</span>}
            </span>
            <span className="flex-shrink-0">{estado(a, feita(a))}</span>
            <i className="fa fa-chevron-right text-muted flex-shrink-0" aria-hidden="true" />
          </button>
        )
      })}
    </div>
  )
}

// entrada da sala: boas-vindas, continuar, e os capítulos em cartões
function Entrada({ c, grupos, feita, feitas, total, proxima, abrirItem, abrirGrupo, conta }) {
  const pct = total ? Math.round((feitas / total) * 100) : 0
  const prazos = c.trabalhos.filter((t) => !t.entrega && t.estado !== 'fechado' && t.prazo).sort((a, b) => a.prazo.localeCompare(b.prazo)).slice(0, 3)
  return (
    <>
      <div className="panel p-sala-boasvindas">
        <div className="panel-body">
          <div className="d-flex flex-wrap align-items-center gap-3">
            <div className="flex-grow-1 min-w-0">
              <div className="small text-uppercase fw-bold text-muted">{tx('Sala de aula')}</div>
              <h2 className="h4 mt-1 mb-1">{tx('Bem-vindo, {0}', { 0: primeiroNome(conta.nome) })}</h2>
              <p className="text-muted mb-0">{total ? tx('Escolha um capítulo à direita ou continue onde ficou. Concluiu {0} de {1} atividades.', { 0: feitas, 1: total }) : tx('O docente ainda não publicou atividades nesta cadeira.')}</p>
            </div>
            {total > 0 && (
              <div className="p-sala-anel" aria-label={tx('{0}% concluído', { 0: pct })}>
                <svg viewBox="0 0 80 80" width="80" height="80" aria-hidden="true">
                  <circle cx="40" cy="40" r="32" fill="none" strokeWidth="8" className="p-anel-fundo" />
                  <circle cx="40" cy="40" r="32" fill="none" strokeWidth="8" stroke="#1e7d4b" strokeLinecap="round" strokeDasharray={`${(pct / 100) * 201} 201`} transform="rotate(-90 40 40)" />
                </svg>
                <strong>{pct}%</strong>
              </div>
            )}
          </div>
          {proxima && (
            <button type="button" className="p-sala-continuar mt-3" onClick={() => abrirItem(proxima)}>
              <span className={`p-atividade-icone ${tipoVisual(proxima).cor}`}><i className={`fa ${tipoVisual(proxima).icone}`} /></span>
              <span className="flex-grow-1 min-w-0 text-start">
                <span className="d-block small text-muted">{feitas ? tx('Continuar') : tx('Começar')}</span>
                <span className="d-block fw-bold text-truncate">{proxima.titulo}</span>
              </span>
              <span className="btn btn-theme btn-sm">{feitas ? tx('Continuar') : tx('Começar')} <i className="fa fa-arrow-right ms-1" /></span>
            </button>
          )}
        </div>
      </div>

      {prazos.length > 0 && (
        <div className="alert alert-warning d-flex flex-column gap-1">
          <strong><i className="fa fa-hourglass-half me-1" />{tx('Trabalhos por entregar')}</strong>
          {prazos.map((t) => (
            <button key={t.id} type="button" className="btn btn-link p-0 text-start text-body" onClick={() => abrirItem({ chave: `trabalho-${t.id}` })}>
              {t.titulo} — {tx('até {0} ({1})', { 0: dataHora(t.prazo), 1: faltam(t.prazo) })}
            </button>
          ))}
        </div>
      )}

      <h3 className="h5 mb-3">{tx('Capítulos')}</h3>
      {grupos.length === 0 && <Vazio>{tx('O docente ainda não organizou a matéria em capítulos.')}</Vazio>}
      <div className="row g-3 mb-4">
        {grupos.map((g, i) => {
          const n = g.itens.filter(feita).length
          return (
            <div key={chaveGrupo(g)} className="col-md-6">
              <button type="button" className="p-sala-cartao" onClick={() => abrirGrupo(g)}>
                <span className="p-sala-cartao-num">{g.id === null ? <i className="fa fa-home" /> : (grupos[0].id === null ? i : i + 1)}</span>
                <span className="flex-grow-1 min-w-0 text-start">
                  <span className="d-block fw-bold text-body">{g.titulo}</span>
                  {g.resumo && <span className="d-block small text-muted p-recorte">{g.resumo}</span>}
                  <span className="d-flex align-items-center gap-2 small mt-2">
                    <span className="progress flex-grow-1" style={{ height: 6 }}><span className="progress-bar bg-success" style={{ width: `${g.itens.length ? (n / g.itens.length) * 100 : 0}%` }} /></span>
                    <span className="text-muted text-nowrap">{g.fechado ? <><i className="fa fa-lock me-1" />{tx('Fechado')}</> : tx('{0}/{1}', { 0: n, 1: g.itens.length })}</span>
                  </span>
                </span>
              </button>
            </div>
          )
        })}
      </div>
    </>
  )
}

// um capítulo aberto ao meio: o resumo e os itens, por ordem
function Capitulo({ g, feita, abrirItem }) {
  const n = g.itens.filter(feita).length
  const proxima = g.itens.find((a) => !a.bloqueio && !feita(a)) || g.itens.find((a) => !a.bloqueio)
  return (
    <div className="panel panel-inverse">
      <div className="panel-heading">
        <h2 className="panel-title"><i className="fa fa-folder-open me-2" />{g.titulo}</h2>
        <div className="panel-heading-btn text-white small">{tx('{0} de {1} concluídas', { 0: n, 1: g.itens.length })}</div>
      </div>
      {(g.resumo || g.fechado || proxima) && (
        <div className="panel-body d-flex flex-wrap align-items-center gap-3 border-bottom">
          <div className="flex-grow-1 text-muted">{g.resumo}{g.fechado && <div><i className="fa fa-lock me-1" />{tx('Este capítulo abre a {0}.', { 0: dataHora(g.disponivelDe) })}</div>}</div>
          {proxima && <button type="button" className="btn btn-theme" onClick={() => abrirItem(proxima)}>{n ? tx('Continuar') : tx('Começar o capítulo')} <i className="fa fa-arrow-right ms-1" /></button>}
        </div>
      )}
      <ListaItens itens={g.itens} feita={feita} abrirItem={abrirItem} />
    </div>
  )
}

// pré-visualização: trabalhos, questionários e inquéritos respondem-se só como estudante
function Previa({ a, abrirComoDocente }) {
  const t = tipoVisual(a)
  return (
    <div className="panel panel-inverse">
      <div className="panel-heading"><h2 className="panel-title"><i className={`fa ${t.icone} me-2`} />{a.titulo}</h2></div>
      <div className="panel-body">
        <p className="text-muted mb-2">{meta(a)}</p>
        {a.descricao && <p>{a.descricao}</p>}
        <div className="alert alert-light border d-flex flex-wrap align-items-center gap-2 mb-0">
          <span className="flex-grow-1">{tx('Aqui o estudante entrega ou responde. Na pré-visualização não se entrega nem se responde.')}</span>
          <button type="button" className="btn btn-sm btn-theme" onClick={() => abrirComoDocente(a)}><i className="fa fa-pen me-1" />{tx('Abrir como docente')}</button>
        </div>
      </div>
    </div>
  )
}

// a aula aberta: o conteúdo do item e a navegação para o anterior e o seguinte
function Aula(props) {
  const { a, grupo, ordem, abrirItem, abrirGrupo, irPara } = props
  const i = ordem.indexOf(a)
  const anterior = ordem[i - 1]
  const seguinte = ordem[i + 1]
  return (
    <>
      <nav className="p-sala-migalhas" aria-label={tx('Localização na sala')}>
        <button type="button" onClick={() => irPara({})}>{tx('Sala de aula')}</button>
        <i className="fa fa-chevron-right" aria-hidden="true" />
        {grupo && <button type="button" onClick={() => abrirGrupo(grupo)}>{grupo.titulo}</button>}
        <i className="fa fa-chevron-right" aria-hidden="true" />
        <span aria-current="page">{a.titulo}</span>
      </nav>

      {a.especie === 'material' && <VerMaterial {...props} so={a.id} />}
      {props.previsualizar && a.especie !== 'material' ? <Previa a={a} abrirComoDocente={props.abrirComoDocente} /> : (
        <>
          {a.especie === 'trabalho' && <Trabalhos {...props} so={a.id} />}
          {a.especie === 'questionario' && <Questionarios {...props} so={a.id} semVoltar voltar={() => (grupo ? abrirGrupo(grupo) : irPara({}))} />}
          {a.especie === 'inquerito' && <Inquerito {...props} so={a.id} />}
          {a.especie === 'workshop' && <Workshop {...props} so={a.id} />}
        </>
      )}

      <div className="p-sala-navegar">
        {anterior ? (
          <button type="button" className="btn btn-white" onClick={() => abrirItem(anterior)}>
            <i className="fa fa-arrow-left me-2" /><span className="text-start"><small className="d-block text-muted">{tx('Anterior')}</small><span className="d-block text-truncate">{anterior.titulo}</span></span>
          </button>
        ) : <span />}
        {seguinte && (
          <button type="button" className="btn btn-theme" onClick={() => abrirItem(seguinte)}>
            <span className="text-end"><small className="d-block opacity-75">{tx('Seguinte')}</small><span className="d-block text-truncate">{seguinte.titulo}</span></span><i className="fa fa-arrow-right ms-2" />
          </button>
        )}
      </div>
    </>
  )
}

export default SalaAula
