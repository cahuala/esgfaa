import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { Bloqueio, Vazio } from '../componentes'
import { dataHora, estadoSessao, faltam, nota } from '../formatar'
import NovaAtividade from './NovaAtividade'
import Importar from './Importar'
import Restricoes from './Restricoes'
import Conclusao from './Conclusao'
import { confirmar, pedir } from '../dialogos'
import { listarAtividades, tipoVisual } from './atividades'
import { t as tx, localAtual } from '../../i18n/linguas'

// tipos de dados do arrasto (atividade para outro capítulo, capítulo para outra posição)
const MIME = { atividade: 'application/x-esg-atividade', capitulo: 'application/x-esg-capitulo' }
const SESSAO = { em_breve: ['bg-light text-dark border', tx('Em breve')], abre: ['bg-success', tx('Abre já')], a_decorrer: ['bg-danger', tx('A decorrer')], terminou: ['bg-gray-500', tx('Terminou')] }

/*
  Página da cadeira como no Moodle: secção geral (avisos, fórum, programa) e os capítulos com
  os materiais, trabalhos e questionários. À direita: índice dos capítulos e blocos
  (progresso, próximas datas, docentes, fórum). O docente organiza no "modo de edição".
*/
function Curso({ c, eDocente, recarregar, avisar, progresso, setProgresso, irPara }) {
  const [edicao, setEdicao] = useState(false)
  const [nova, setNova] = useState(null) // capítulo onde se junta uma atividade (null = geral)
  const [importar, setImportar] = useState(false)
  const [restringir, setRestringir] = useState(null) // { alvo } ou { secao }
  const [fechados, setFechados] = useState(() => new Set())
  // arrastar e largar no modo de edição: { tipo: 'atividade', chave } ou { tipo: 'capitulo', id }; alvo = onde se vai largar
  const [arrasto, setArrasto] = useState(null)
  const [alvo, setAlvo] = useState(null)
  const falhou = (e) => avisar({ tipo: 'erro', texto: e.message })

  // atividades de cada capítulo, por ordem de publicação
  const atividades = listarAtividades(c)
  const condicoes = new Set(atividades.flatMap((a) => (a.requisitos || []).map((r) => `${r.tipo}-${r.id}`)))
  const doCapitulo = (id) => atividades.filter((a) => (a.secaoId ?? null) === id)
  const feita = (a) => progresso?.itens.find((i) => i.tipo === a.especie && i.id === a.id)?.feita

  // concluir uma atividade pode abrir outras (restrições): nesse caso recarrega a cadeira
  const marcar = (a, concluido) => api(`/materiais/${a.id}/conclusao`, { metodo: 'PUT', corpo: { concluido } }).then((p) => { setProgresso(p); if (atividades.some((x) => x.bloqueio)) recarregar() }).catch(falhou)
  function abrir(a) {
    if (a.bloqueio) return
    // ligações e videoconferências abrem à parte; ficheiros (PDF, vídeo…) e vídeos veem-se dentro do portal
    if (a.especie === 'material' && ['ligacao', 'videoconferencia'].includes(a.tipo)) {
      if (a.tipo === 'videoconferencia' && !eDocente && !['abre', 'a_decorrer'].includes(estadoSessao(a))) return irPara({ atividade: a.chave })
      if (!eDocente && !feita(a)) marcar(a, true)
      window.open(a.url, '_blank', 'noopener')
    } else irPara({ atividade: a.chave })
  }

  // ---------- ações do modo de edição ----------
  const secao = (id, corpo) => api(`/secoes/${id}`, { metodo: 'PUT', corpo }).then(recarregar).catch(falhou)
  async function moverCapitulo(i, d) {
    const ids = c.secoes.map((x) => x.id)
    ;[ids[i], ids[i + d]] = [ids[i + d], ids[i]]
    await api(`/cadeiras/${c.id}/secoes/ordem`, { metodo: 'PUT', corpo: { ids } }).then(recarregar).catch(falhou)
  }
  async function editarCapitulo(s) {
    const titulo = await pedir(tx('Título do capítulo'), s.titulo)
    if (titulo === null) return
    const resumo = await pedir(tx('Resumo do capítulo (opcional)'), s.resumo, { multilinha: true, obrigatorio: false })
    await secao(s.id, { titulo, ...(resumo !== null ? { resumo } : {}) })
  }
  async function apagarCapitulo(s) {
    if (!(await confirmar(tx('Apagar o capítulo "{0}"? As atividades passam para a secção geral.', { 0: s.titulo }), { titulo: tx('Apagar capítulo'), botao: tx('Apagar'), perigo: true }))) return
    await api(`/secoes/${s.id}`, { metodo: 'DELETE' }).then(recarregar).catch(falhou)
  }
  async function novoCapitulo() {
    const titulo = await pedir(tx('Título do novo capítulo'), tx('Capítulo {0}', { 0: c.secoes.length + 1 }), { botao: tx('Criar') })
    if (!titulo) return
    await api(`/cadeiras/${c.id}/secoes`, { metodo: 'POST', corpo: { titulo } }).then(() => { avisar({ texto: tx('Capítulo criado.') }); recarregar() }).catch(falhou)
  }
  const restricao = (a, corpo) => api('/atividades/restricoes', { metodo: 'PUT', corpo: { tipo: a.especie, id: a.id, ...corpo } }).then(recarregar).catch(falhou)
  // capítulo arrastado para a posição de outro
  async function largarCapitulo(arrastado, destinoId) {
    const ids = c.secoes.map((x) => x.id)
    const de = ids.indexOf(arrastado.id)
    const para = ids.indexOf(destinoId)
    if (de < 0 || para < 0 || de === para) return
    ids.splice(para, 0, ids.splice(de, 1)[0])
    await api(`/cadeiras/${c.id}/secoes/ordem`, { metodo: 'PUT', corpo: { ids } }).then(() => { avisar({ texto: tx('Capítulos reordenados.') }); recarregar() }).catch(falhou)
  }
  // atividade largada num capítulo (null = secção geral)
  function largarAtividade(arrastado, secaoId) {
    const a = atividades.find((x) => x.chave === arrastado.chave)
    if (a && (a.secaoId ?? null) !== secaoId) moverAtividade(a, secaoId).then(() => avisar({ texto: tx('"{0}" mudou de capítulo.', { 0: a.titulo }) }))
  }
  // propriedades de uma zona onde se larga (lista de atividades ou capítulo)
  const zona = (secaoId) => (edicao ? {
    // o tipo vem no próprio arrasto (o estado do React pode ainda não estar atualizado)
    onDragOver: (e) => {
      const tipos = e.dataTransfer.types
      if (!tipos.includes(MIME.atividade) && !(tipos.includes(MIME.capitulo) && secaoId)) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      setAlvo(secaoId ?? 'geral')
    },
    onDragLeave: (e) => { if (!e.currentTarget.contains(e.relatedTarget)) setAlvo(null) },
    onDrop: (e) => {
      e.preventDefault()
      const tipo = Object.keys(MIME).find((k) => e.dataTransfer.types.includes(MIME[k]))
      const x = tipo ? { tipo, ...JSON.parse(e.dataTransfer.getData(MIME[tipo]) || '{}') } : null
      if (x?.tipo === 'atividade') largarAtividade(x, secaoId)
      else if (x?.tipo === 'capitulo' && secaoId) largarCapitulo(x, secaoId)
      setArrasto(null)
      setAlvo(null)
    },
  } : {})
  const arrastavel = (dados) => (edicao ? {
    draggable: true,
    onDragStart: (e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData(MIME[dados.tipo], JSON.stringify(dados)); e.stopPropagation(); setArrasto(dados) },
    onDragEnd: () => { setArrasto(null); setAlvo(null) },
  } : {})
  const moverAtividade = (a, secaoId) => api('/atividades/capitulo', { metodo: 'PUT', corpo: { tipo: a.especie, id: a.id, secaoId: secaoId || null } }).then(recarregar).catch(falhou)
  async function apagarAtividade(a) {
    if (!(await confirmar(tx('Apagar "{0}"? Não se pode desfazer.', { 0: a.titulo }), { titulo: tx('Apagar atividade'), botao: tx('Apagar'), perigo: true }))) return
    const url = { material: `/materiais/${a.id}`, trabalho: `/trabalhos/${a.id}`, questionario: `/questionarios/${a.id}`, inquerito: `/inqueritos/${a.id}`, workshop: `/workshops/${a.id}` }[a.especie]
    await api(url, { metodo: 'DELETE' }).then(() => { avisar({ texto: tx('Atividade apagada.') }); recarregar() }).catch(falhou)
  }

  const alternar = (id) => setFechados((f) => { const n = new Set(f); if (n.has(id)) n.delete(id); else n.add(id); return n })

  // ---------- desenho ----------
  const linhaAtividade = (a) => {
    const t = tipoVisual(a)
    let meta = t.nome
    let estado = null
    if (a.tipo === 'pasta') meta = tx('Pasta · {0} ficheiro(s)', { 0: a.ficheiros.length })
    if (a.especie === 'trabalho') {
      meta = tx('Trabalho · entrega até {0} ({1})', { 0: dataHora(a.prazo), 1: faltam(a.prazo) })
      if (eDocente) estado = <span className="badge bg-gray-500">{a.entregas} {tx('entrega(s)')}</span>
      else if (a.entrega) estado = a.entrega.nota !== null ? <span className="badge bg-success">{tx('Nota')} {nota(a.entrega.nota)}</span> : <span className="badge bg-success"><i className="fa fa-check me-1" />{tx('Entregue')}</span>
      else estado = a.estado === 'fechado' ? <span className="badge bg-danger">{tx('Não entregue')}</span> : <span className="badge bg-warning text-dark">{tx('Por entregar')}</span>
    } else if (a.especie === 'questionario') {
      meta = tx('Questionário · {0} pergunta(s){1}{2}', { 0: a.numeroPerguntas, 1: a.duracao ? ` · ${a.duracao} min` : '', 2: a.fecha ? ` · fecha ${dataHora(a.fecha)}` : '' })
      if (eDocente) estado = a.publicado ? <span className="badge bg-success">{tx('Publicado')}</span> : <span className="badge bg-gray-500">{tx('Rascunho')}</span>
      else estado = feita(a) ? <span className="badge bg-success"><i className="fa fa-check me-1" />{tx('Feito')}</span> : <span className="badge bg-light text-dark border">{a.estado === 'fechado' ? tx('Fechado') : tx('Por fazer')}</span>
    } else if (a.especie === 'inquerito') {
      meta = a.tipo === 'avaliacao' ? tx('Inquérito anónimo · {0} perguntas', { 0: a.numeroPerguntas }) : `Sondagem${a.anonimo ? tx(' anónima') : ''}`
      if (a.fecha) meta += ` · ${a.fechado ? tx('fechou') : tx('fecha')} ${dataHora(a.fecha)}`
      if (eDocente) estado = <span className="badge bg-gray-500">{a.respostas} {tx('resposta(s)')}</span>
      else estado = a.respondido ? <span className="badge bg-success"><i className="fa fa-check me-1" />{tx('Respondido')}</span> : <span className="badge bg-light text-dark border">{a.fechado ? tx('Fechado') : tx('Por responder')}</span>
    } else if (a.especie === 'workshop') {
      meta = a.fase === 'submissao' ? tx('Avaliação por pares · entrega até {0}', { 0: dataHora(a.fimSubmissao) }) : a.fase === 'avaliacao' ? tx('Avaliação por pares · avaliar colegas até {0}', { 0: dataHora(a.fimAvaliacao) }) : tx('Avaliação por pares · encerrada')
      if (eDocente) estado = <span className="badge bg-gray-500">{a.submissoes} {tx('entrega(s)')}</span>
      else estado = a.entregue ? <span className="badge bg-success"><i className="fa fa-check me-1" />{tx('Entregue')}</span> : <span className="badge bg-light text-dark border">{a.fase === 'submissao' ? tx('Por entregar') : tx('Não entregou')}</span>
    } else if (a.tipo === 'videoconferencia') {
      const e = estadoSessao(a)
      meta = tx('Videoconferência · {0} · {1} min', { 0: dataHora(a.inicio), 1: a.duracao })
      estado = <span className={`badge ${SESSAO[e][0]}`}>{SESSAO[e][1]}</span>
    } else if (!eDocente && progresso) {
      estado = feita(a)
        ? <button type="button" className="btn btn-xs btn-success" onClick={() => marcar(a, false)} title={tx('Desmarcar')}><i className="fa fa-check me-1" />{tx('Concluído')}</button>
        : <button type="button" className="btn btn-xs btn-white" onClick={() => marcar(a, true)}>{tx('Marcar como feito')}</button>
    }
    if (a.bloqueio) estado = <span className="badge bg-light text-dark border"><i className="fa fa-lock me-1" />{tx('Fechada')}</span>
    // o docente vê as restrições de cada atividade
    const marcas = eDocente && (
      <div className="d-flex flex-wrap gap-1 mt-1">
        {a.visivel === false && <span className="badge bg-warning text-dark"><i className="fa fa-eye-slash me-1" />{tx('Escondida')}</span>}
        {a.disponivelDe && <span className="badge bg-light text-dark border"><i className="far fa-clock me-1" />{tx('Abre')} {dataHora(a.disponivelDe)}</span>}
        {a.requisitos?.length > 0 && <span className="badge bg-light text-dark border" title={a.requisitos.map((r) => atividades.find((x) => x.chave === `${r.tipo}-${r.id}`)?.titulo).filter(Boolean).join(' · ')}><i className="fa fa-lock me-1" />{a.requisitos.length} {tx('condição(ões)')}</span>}
        {condicoes.has(a.chave) && <span className="badge bg-light text-muted border"><i className="fa fa-key me-1" />{tx('Abre outras')}</span>}
      </div>
    )
    return (
      <div key={a.chave} {...(a.tipo === 'avaliacao' ? {} : arrastavel({ tipo: 'atividade', chave: a.chave }))}
        className={`list-group-item d-flex align-items-center gap-3 py-3 ${a.bloqueio ? 'p-atividade-fechada' : ''} ${a.visivel === false ? 'p-atividade-escondida' : ''} ${edicao && a.tipo !== 'avaliacao' ? 'p-arrastavel' : ''} ${arrasto?.chave === a.chave ? 'p-a-arrastar' : ''}`}>
        {edicao && a.tipo !== 'avaliacao' && <i className="fa fa-grip-vertical text-muted p-pega" title={tx('Arraste para outro capítulo')} aria-hidden="true" />}
        <span className={`p-atividade-icone ${a.bloqueio ? 'bg-gray-400' : t.cor}`}><i className={`fa ${a.bloqueio ? 'fa-lock' : t.icone}`} /></span>
        <div className="flex-grow-1 min-w-0">
          {a.bloqueio
            ? <span className="fw-bold text-muted">{a.titulo}</span>
            : <button type="button" className="btn btn-link p-0 fw-bold text-start text-decoration-none text-body" onClick={() => abrir(a)}>{a.titulo}</button>}
          <div className="small text-muted">{meta}</div>
          <Bloqueio motivos={a.bloqueio} compacto />
          {a.descricao && !a.bloqueio && a.tipo !== 'avaliacao' && <div className="small p-recorte">{a.descricao}</div>}
          {marcas}
        </div>
        {edicao && a.tipo === 'avaliacao' ? <span className="small text-muted flex-shrink-0">{tx('Gerida pela Administração Escolar')}</span> : edicao ? (
          <div className="d-flex gap-1 align-items-center flex-shrink-0">
            <select className="form-select form-select-sm" style={{ width: 170 }} value={a.secaoId ?? ''} onChange={(e) => moverAtividade(a, e.target.value)} aria-label={tx('Capítulo de {0}', { 0: a.titulo })}>
              <option value="">{tx('Geral')}</option>
              {c.secoes.map((s) => <option key={s.id} value={s.id}>{s.titulo}</option>)}
            </select>
            <button type="button" className="btn btn-xs btn-white" onClick={() => restricao(a, { visivel: a.visivel === false })} aria-label={a.visivel === false ? tx('Mostrar {0}', { 0: a.titulo }) : tx('Esconder {0}', { 0: a.titulo })} title={a.visivel === false ? tx('Mostrar') : tx('Esconder')}><i className={`fa ${a.visivel === false ? 'fa-eye-slash text-warning' : 'fa-eye'}`} /></button>
            <button type="button" className="btn btn-xs btn-white" onClick={() => setRestringir({ alvo: a })} aria-label={tx('Restrições de {0}', { 0: a.titulo })} title={tx('Restrições de acesso')}><i className="fa fa-lock" /></button>
            <button type="button" className="btn btn-xs btn-white text-danger" onClick={() => apagarAtividade(a)} aria-label={tx('Apagar {0}', { 0: a.titulo })}><i className="fa fa-trash-alt" /></button>
          </div>
        ) : estado && <div className="flex-shrink-0">{estado}</div>}
      </div>
    )
  }

  const botaoNova = (secaoId) => edicao && (
    <div className="list-group-item text-center py-2">
      <button type="button" className="btn btn-sm btn-white" onClick={() => setNova({ secaoId })}><i className="fa fa-plus me-1 text-theme" /> {tx('Adicionar atividade ou recurso')}</button>
    </div>
  )

  const capitulos = c.secoes
  const contagem = (id) => {
    const l = doCapitulo(id).filter((a) => a.especie !== 'questionario' || a.publicado !== false)
    const feitas = l.filter((a) => feita(a)).length
    return { feitas, total: l.length }
  }
  const hoje = new Date().toISOString()
  const proximas = [
    ...c.eventos.filter((e) => e.data >= hoje.slice(0, 10)).map((e) => ({ id: `e${e.id}`, quando: `${e.data}T${e.inicio || '00:00'}`, titulo: e.titulo, tipo: e.tipo, sub: [e.inicio, e.local].filter(Boolean).join(' · ') })),
    ...c.trabalhos.filter((t) => t.prazo >= hoje).map((t) => ({ id: `t${t.id}`, quando: t.prazo, titulo: tx('Entrega: {0}', { 0: t.titulo }), tipo: 'prazo', sub: faltam(t.prazo) })),
    ...c.materiais.filter((m) => m.tipo === 'videoconferencia' && estadoSessao(m) !== 'terminou' && !m.bloqueio).map((m) => ({ id: `v${m.id}`, quando: m.inicio, titulo: tx('Videoconferência: {0}', { 0: m.titulo }), tipo: 'sessao', sub: tx('{0} · {1} min', { 0: new Date(m.inicio).toLocaleTimeString(localAtual(), { hour: '2-digit', minute: '2-digit' }), 1: m.duracao }) })),
  ].sort((a, b) => a.quando.localeCompare(b.quando)).slice(0, 5)

  return (
    <div className="row">
      <div className="col-xl-9">
        {eDocente && (
          <div className="d-flex align-items-center gap-2 mb-3">
            <div className="form-check form-switch mb-0">
              <input id="modo-edicao" className="form-check-input" type="checkbox" checked={edicao} onChange={(e) => setEdicao(e.target.checked)} />
              <label className="form-check-label fw-bold" htmlFor="modo-edicao">{tx('Modo de edição')}</label>
            </div>
            {edicao && <span className="small text-muted d-none d-xl-inline"><i className="fa fa-grip-vertical me-1" />{tx('Arraste as atividades entre capítulos e os capítulos para mudar a ordem.')}</span>}
            <div className="ms-auto d-flex gap-2">
              {edicao && <button type="button" className="btn btn-sm btn-white" onClick={() => setImportar(true)}><i className="fa fa-file-import me-1" />{tx('Importar de outra cadeira')}</button>}
              <button type="button" className="btn btn-sm btn-white" onClick={() => irPara({ ver: 'estudante' })}><i className="fa fa-user-graduate me-1" />{tx('Ver como estudante')}</button>
            </div>
          </div>
        )}

        {/* secção geral */}
        <div className={`panel panel-inverse ${alvo === 'geral' && arrasto?.tipo === 'atividade' ? 'p-alvo' : ''}`} id="cap-geral" {...zona(null)}>
          <div className="panel-heading"><h2 className="panel-title"><i className="fa fa-home me-2" />{tx('Geral')}</h2></div>
          <div className="list-group list-group-flush">
            <div className="list-group-item d-flex align-items-center gap-3 py-3">
              <span className="p-atividade-icone bg-dark"><i className="fa fa-bullhorn" /></span>
              <div className="flex-grow-1">
                <button type="button" className="btn btn-link p-0 fw-bold text-decoration-none text-body" onClick={() => irPara({ separador: 'avisos' })}>{tx('Avisos')}</button>
                <div className="small text-muted">{c.avisos.length ? `Último: ${c.avisos[0].titulo} · ${dataHora(c.avisos[0].criadoEm)}` : tx('Sem avisos')}</div>
              </div>
            </div>
            <div className="list-group-item d-flex align-items-center gap-3 py-3">
              <span className="p-atividade-icone bg-teal"><i className="fa fa-comments" /></span>
              <div className="flex-grow-1">
                <button type="button" className="btn btn-link p-0 fw-bold text-decoration-none text-body" onClick={() => irPara({ separador: 'forum' })}>{tx('Fórum da cadeira')}</button>
                <div className="small text-muted">{c.forum.topicos} {tx('tópico(s) de discussão')}</div>
              </div>
            </div>
            {(c.programa || c.programaFicheiroId) && (
              <div className="list-group-item d-flex align-items-center gap-3 py-3">
                <span className="p-atividade-icone bg-gray-600"><i className="fa fa-book-open" /></span>
                <div className="flex-grow-1">
                  <button type="button" className="btn btn-link p-0 fw-bold text-decoration-none text-body" onClick={() => irPara({ separador: 'programa' })}>{tx('Programa da cadeira')}</button>
                  <div className="small text-muted">{tx('Objetivos, conteúdos, avaliação e bibliografia')}</div>
                </div>
              </div>
            )}
            {doCapitulo(null).map(linhaAtividade)}
            {botaoNova(null)}
          </div>
        </div>

        {/* capítulos */}
        {capitulos.length === 0 && !edicao && <Vazio>{eDocente ? tx('Ainda não há capítulos. Ligue o modo de edição para organizar a cadeira.') : tx('O docente ainda não organizou a matéria em capítulos.')}</Vazio>}
        {capitulos.map((s, i) => {
          const lista = doCapitulo(s.id)
          const n = contagem(s.id)
          const fechado = fechados.has(s.id)
          return (
            <div key={s.id} className={`panel panel-inverse ${!s.visivel ? 'p-capitulo-escondido' : ''} ${alvo === s.id ? 'p-alvo' : ''} ${arrasto?.id === s.id ? 'p-a-arrastar' : ''}`} id={`cap-${s.id}`} {...zona(s.id)}>
              <div className={`panel-heading ${edicao ? 'p-arrastavel' : ''}`} {...arrastavel({ tipo: 'capitulo', id: s.id })} title={edicao ? tx('Arraste para mudar a ordem dos capítulos') : undefined}>
                <h2 className="panel-title">
                  <button type="button" className="btn btn-link p-0 text-white text-decoration-none fw-bold" onClick={() => alternar(s.id)} aria-expanded={!fechado}>
                    <i className={`fa fa-chevron-${fechado ? 'right' : 'down'} me-2 fs-11px`} />{s.titulo}
                  </button>
                  {!s.visivel && <span className="badge bg-warning text-dark ms-2">{tx('Escondido dos estudantes')}</span>}
                  {s.disponivelDe && (eDocente || s.fechado) && <span className="badge bg-light text-dark ms-2"><i className="far fa-clock me-1" />{tx('Abre')} {dataHora(s.disponivelDe)}</span>}
                </h2>
                <div className="panel-heading-btn">
                  {edicao ? (
                    <>
                      <button type="button" className="btn btn-xs btn-icon btn-white me-1" disabled={i === 0} onClick={() => moverCapitulo(i, -1)} aria-label={tx('Subir capítulo')}><i className="fa fa-arrow-up" /></button>
                      <button type="button" className="btn btn-xs btn-icon btn-white me-1" disabled={i === capitulos.length - 1} onClick={() => moverCapitulo(i, 1)} aria-label={tx('Descer capítulo')}><i className="fa fa-arrow-down" /></button>
                      <button type="button" className="btn btn-xs btn-icon btn-white me-1" onClick={() => secao(s.id, { visivel: !s.visivel })} aria-label={s.visivel ? tx('Esconder capítulo') : tx('Mostrar capítulo')}><i className={`fa ${s.visivel ? 'fa-eye' : 'fa-eye-slash'}`} /></button>
                      <button type="button" className="btn btn-xs btn-icon btn-white me-1" onClick={() => setRestringir({ secao: s })} aria-label={tx('Acesso ao capítulo')} title={tx('Data de abertura')}><i className="fa fa-lock" /></button>
                      <button type="button" className="btn btn-xs btn-icon btn-white me-1" onClick={() => editarCapitulo(s)} aria-label={tx('Editar capítulo')}><i className="fa fa-pen" /></button>
                      <button type="button" className="btn btn-xs btn-icon btn-danger" onClick={() => apagarCapitulo(s)} aria-label={tx('Apagar capítulo')}><i className="fa fa-trash-alt" /></button>
                    </>
                  ) : !eDocente && n.total > 0 && <span className="text-white small">{n.feitas}/{n.total} {tx('concluídas')}</span>}
                </div>
              </div>
              {!fechado && (
                <>
                  {s.resumo && <div className="panel-body pb-0 text-muted">{s.resumo}</div>}
                  <div className="list-group list-group-flush">
                    {lista.length === 0 && !edicao && <div className="list-group-item text-muted small py-3">{tx('Sem atividades neste capítulo.')}</div>}
                    {lista.map(linhaAtividade)}
                    {botaoNova(s.id)}
                  </div>
                </>
              )}
            </div>
          )
        })}
        {edicao && <button type="button" className="btn btn-theme mb-4" onClick={novoCapitulo}><i className="fa fa-plus me-1" /> {tx('Novo capítulo')}</button>}
      </div>

      {/* coluna direita: índice e blocos */}
      <div className="col-xl-3">
        <div className="p-coluna-direita">
          <div className="panel panel-inverse">
            <div className="panel-heading"><h2 className="panel-title"><i className="fa fa-list-ol me-2" />{tx('Índice da cadeira')}</h2></div>
            <div className="list-group list-group-flush p-indice">
              <a href="#cap-geral" className="list-group-item list-group-item-action"><i className="fa fa-home me-2 text-muted" />{tx('Geral')}</a>
              {capitulos.map((s) => {
                const n = contagem(s.id)
                const completo = !eDocente && n.total > 0 && n.feitas === n.total
                return (
                  <a key={s.id} href={`#cap-${s.id}`} className="list-group-item list-group-item-action d-flex gap-2 align-items-start" onClick={() => setFechados((f) => { const x = new Set(f); x.delete(s.id); return x })}>
                    <i className={`fa ${completo ? 'fa-check-circle text-success' : 'fa-circle text-gray-300'} mt-1 fs-11px`} />
                    <span className="flex-grow-1">{s.titulo}{!s.visivel && <i className="fa fa-eye-slash text-warning ms-1" />}</span>
                    {!eDocente && n.total > 0 && <span className="small text-muted">{n.feitas}/{n.total}</span>}
                  </a>
                )
              })}
            </div>
          </div>

          {!eDocente && progresso?.total > 0 && <Conclusao c={c} progresso={progresso} avisar={avisar} />}

          <div className="panel panel-inverse">
            <div className="panel-heading"><h2 className="panel-title"><i className="fa fa-calendar-alt me-2" />{tx('Próximas datas')}</h2></div>
            <div className="list-group list-group-flush">
              {proximas.length === 0 && <div className="list-group-item small text-muted">{tx('Nada marcado.')}</div>}
              {proximas.map((p) => (
                <div key={p.id} className="list-group-item d-flex gap-2">
                  <div className="text-center flex-shrink-0" style={{ width: 40 }}>
                    <div className="fw-bold lh-1">{new Date(p.quando).getDate()}</div>
                    <div className="small text-uppercase text-muted">{new Date(p.quando).toLocaleDateString(localAtual(), { month: 'short' })}</div>
                  </div>
                  <div className="min-w-0"><div className="fw-bold small">{p.titulo}</div><div className="small text-muted">{p.sub}</div></div>
                </div>
              ))}
              <Link to="/calendario" className="list-group-item list-group-item-action small text-center">{tx('Abrir o calendário')}</Link>
            </div>
          </div>

          <div className="panel panel-inverse">
            <div className="panel-heading"><h2 className="panel-title"><i className="fa fa-chalkboard-teacher me-2" />{tx('Docentes')}</h2></div>
            <div className="list-group list-group-flush">
              {c.docentes.length === 0 && <div className="list-group-item small text-muted">{tx('Por alocar.')}</div>}
              {c.docentes.map((d) => (
                <div key={d.id} className="list-group-item d-flex gap-2 align-items-center">
                  <span className="admin-avatar flex-shrink-0">{d.nome.split(/\s+/).filter((x) => !x.includes('.')).map((x) => x[0]).slice(0, 2).join('')}</span>
                  <div className="min-w-0"><div className="fw-bold small text-truncate">{d.nome}</div><div className="small text-muted">{d.papel === 'regente' ? tx('Regente') : tx('Assistente')} · <a href={`mailto:${d.email}`}>{d.email}</a></div></div>
                </div>
              ))}
            </div>
          </div>

          {c.forum.recentes.length > 0 && (
            <div className="panel panel-inverse">
              <div className="panel-heading"><h2 className="panel-title"><i className="fa fa-comments me-2" />{tx('Fórum: recentes')}</h2></div>
              <div className="list-group list-group-flush">
                {c.forum.recentes.map((t) => (
                  <button key={t.id} type="button" className="list-group-item list-group-item-action text-start" onClick={() => irPara({ separador: 'forum', topico: String(t.id) })}>
                    <div className="fw-bold small">{t.titulo}</div><div className="small text-muted">{t.autor} · {dataHora(t.atividadeEm)}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {restringir && <Restricoes {...restringir} atividades={atividades} fechar={() => setRestringir(null)} avisar={avisar} guardado={() => { setRestringir(null); recarregar() }} />}
      {importar && <Importar c={c} fechar={() => setImportar(false)} avisar={avisar} concluido={recarregar} />}
      {nova && <NovaAtividade c={c} secaoId={nova.secaoId} fechar={() => setNova(null)} avisar={avisar} criada={(destino) => { setNova(null); recarregar(); if (destino) irPara(destino) }} />}
    </div>
  )
}

export default Curso
