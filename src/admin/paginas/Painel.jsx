import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useSessao } from '../sessaoContexto'
import { COLECOES, NOMES_ACOES } from '../esquemas'
import { Carregando, Erro, Painel as Caixa } from '../componentes/Ui'
import { dataHora } from '../formatar'

const NOMES_COLECOES = { noticias: 'Notícia', eventos: 'Evento', artigos: 'Artigo', cursos: 'Curso', pessoas: 'Pessoa', publicidade: 'Banner' }

// últimos 14 dias, com zero nos dias sem registos
function serie14(linhas = []) {
  const porDia = Object.fromEntries(linhas.map((l) => [l.dia, l.n]))
  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (13 - i))
    const dia = d.toISOString().slice(0, 10)
    return { dia, n: porDia[dia] || 0 }
  })
}

// gráfico de barras simples (sem bibliotecas)
function Grafico({ series }) {
  const max = Math.max(1, ...series.flatMap((s) => s.dados.map((d) => d.n)))
  const dias = series[0].dados
  return (
    <div>
      <div className="grafico-barras">
        {dias.map((d, i) => (
          <div key={d.dia} className="grafico-coluna" title={d.dia}>
            <div className="grafico-pilha">
              {series.map((s) => (
                <div
                  key={s.nome}
                  className="grafico-barra"
                  style={{ height: `${(s.dados[i].n / max) * 100}%`, background: s.cor }}
                  title={`${s.nome}: ${s.dados[i].n}`}
                />
              ))}
            </div>
            <span className="grafico-rotulo">{d.dia.slice(8)}/{d.dia.slice(5, 7)}</span>
          </div>
        ))}
      </div>
      <div className="d-flex gap-3 mt-2 small">
        {series.map((s) => (
          <span key={s.nome}><i className="fa fa-square me-1" style={{ color: s.cor }} />{s.nome}</span>
        ))}
      </div>
    </div>
  )
}

const DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

function saudacao() {
  const h = new Date().getHours()
  return h < 12 ? 'Bom dia' : h < 19 ? 'Boa tarde' : 'Boa noite'
}

function hojePorExtenso() {
  const d = new Date()
  return `${DIAS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`
}

// atalhos do topo, conforme as permissões
const ATALHOS = [
  { perm: 'noticias.criar', para: '/colecao/noticias/novo', icone: 'fa-pen-nib', texto: 'Nova notícia', principal: true },
  { perm: 'eventos.criar', para: '/colecao/eventos/novo', icone: 'fa-calendar-plus', texto: 'Novo evento' },
  { perm: 'artigos.criar', para: '/colecao/artigos/novo', icone: 'fa-book-open', texto: 'Novo artigo' },
  { perm: 'publicidade.criar', para: '/colecao/publicidade/novo', icone: 'fa-bullhorn', texto: 'Novo banner' },
  { perm: 'estatisticas.ver', para: '/estatisticas', icone: 'fa-chart-line', texto: 'Estatísticas' },
]

function Painel() {
  const { utilizador, pode } = useSessao()
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState('')

  const carregar = useCallback(() => {
    api('/painel').then((r) => { setErro(''); setDados(r) }).catch((e) => setErro(e.message))
  }, [])
  useEffect(carregar, [carregar])

  const v = dados?.visitas
  const widgets = dados && [
    v && { cor: 'esg-w-vermelho', icone: 'fa-users', titulo: 'VISITANTES HOJE', valor: v.hoje.visitantes, extra: `${v.online} online agora`, para: '/estatisticas' },
    v && { cor: 'esg-w-preto', icone: 'fa-chart-line', titulo: 'VISITANTES (30 DIAS)', valor: v.mes.visitantes, extra: `${v.mes.paginas.toLocaleString('pt-PT')} páginas vistas`, para: '/estatisticas' },
    dados.totais.noticias !== undefined && { cor: 'esg-w-dourado', icone: 'fa-newspaper', titulo: 'NOTÍCIAS PUBLICADAS', valor: dados.totais.noticias, extra: `${dados.rascunhos.noticias} em rascunho`, para: '/colecao/noticias' },
    pode('comentarios.ver') && { cor: 'esg-w-cinza', icone: 'fa-comments', titulo: 'COMENTÁRIOS', valor: dados.interacoes.comentarios, extra: `${dados.interacoes.comentariosHoje} hoje · ${dados.interacoes.gostos} gostos`, para: '/comentarios' },
    !v && dados.totais.eventos !== undefined && { cor: 'esg-w-preto', icone: 'fa-calendar-alt', titulo: 'EVENTOS', valor: dados.totais.eventos, extra: `${dados.rascunhos.eventos} em rascunho`, para: '/colecao/eventos' },
  ].filter(Boolean).slice(0, 4)

  const series = dados && [
    v && { nome: 'Visitantes', cor: '#e53917', dados: serie14(dados.visitasDias) },
    dados.comentariosDias && { nome: 'Comentários', cor: '#c9a227', dados: serie14(dados.comentariosDias) },
  ].filter(Boolean)

  return (
    <>
      <div className="esg-boas-vindas">
        <div>
          <div className="esg-boas-vindas-data">{hojePorExtenso()}</div>
          <h1>{saudacao()}, {utilizador.nome.split(' ')[0]}.</h1>
          <p>Painel de gestão do site da Escola Superior de Guerra · {utilizador.nomePapel}</p>
        </div>
        <div className="esg-atalhos">
          {ATALHOS.filter((a) => pode(a.perm)).slice(0, 4).map((a) => (
            <Link key={a.para} to={a.para} className={`btn ${a.principal ? 'btn-theme' : 'btn-outline'}`}>
              <i className={`fa ${a.icone} me-2`} />{a.texto}
            </Link>
          ))}
        </div>
      </div>

      {erro && <Erro texto={erro} onRepetir={carregar} />}
      {!dados && !erro && <Carregando />}

      {dados && (
        <>
          <div className="row">
            {widgets.map((w) => (
              <div key={w.titulo} className="col-xl-3 col-md-6">
                <div className={`widget widget-stats ${w.cor}`}>
                  <div className="stats-icon"><i className={`fa ${w.icone}`} /></div>
                  <div className="stats-info">
                    <h4>{w.titulo}</h4>
                    <p>{w.valor.toLocaleString('pt-PT')}</p>
                  </div>
                  <div className="stats-link">
                    <Link to={w.para}>{w.extra} <i className="fa fa-arrow-alt-circle-right" /></Link>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="row">
            <div className="col-xl-8">
              {dados.porPublicar.length > 0 && (
                <Caixa titulo={`Rascunhos à espera de publicação (${dados.porPublicar.length})`} corpo={false}>
                  <div className="list-group list-group-flush rounded-bottom">
                    {dados.porPublicar.map((r) => (
                      <Link key={`${r.colecao}/${r.id}`} to={`/colecao/${r.colecao}/${r.id}`} className="list-group-item list-group-item-action d-flex align-items-center gap-2">
                        <span className="badge bg-warning text-dark">{NOMES_COLECOES[r.colecao]}</span>
                        <span className="flex-grow-1 text-truncate fw-bold">{r.titulo}</span>
                        <small className="text-muted text-nowrap">{r.por ? `${r.por} · ` : ''}{dataHora(r.atualizado)}</small>
                        <i className="fa fa-chevron-right text-muted" />
                      </Link>
                    ))}
                  </div>
                </Caixa>
              )}

              {series.length > 0 && (
                <Caixa titulo="Últimos 14 dias" acoes={v && <Link to="/estatisticas" className="btn btn-xs btn-default">Estatísticas</Link>}>
                  <Grafico series={series} />
                </Caixa>
              )}

              {dados.maisVistos && (
                <Caixa titulo="Conteúdos mais vistos" corpo={false}>
                  <div className="table-responsive">
                    <table className="table table-panel align-middle mb-0">
                      <thead>
                        <tr><th>Conteúdo</th><th className="text-end">Visualizações</th><th className="text-end">Gostos</th><th className="text-end">Comentários</th></tr>
                      </thead>
                      <tbody>
                        {dados.maisVistos.length === 0 && <tr><td colSpan={4} className="text-muted">Ainda sem visualizações registadas.</td></tr>}
                        {dados.maisVistos.map((m) => (
                          <tr key={m.chave}>
                            <td>
                              <span className="badge bg-gray-300 text-gray-800 me-2">{NOMES_COLECOES[m.colecao]}</span>
                              <Link to={`/colecao/${m.colecao}/${m.chave.split('/')[1]}`}>{m.titulo}</Link>
                            </td>
                            <td className="text-end">{m.visualizacoes}</td>
                            <td className="text-end">{m.gostos}</td>
                            <td className="text-end">{m.comentarios}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Caixa>
              )}
            </div>

            <div className="col-xl-4">
              <Caixa titulo="Conteúdos" corpo={false}>
                <div className="list-group list-group-flush rounded-bottom">
                  {Object.entries(COLECOES).filter(([c]) => dados.totais[c] !== undefined).map(([chave, c]) => (
                    <Link key={chave} to={`/colecao/${chave}`} className="list-group-item list-group-item-action d-flex align-items-center">
                      <i className={`fa ${c.icone} fa-fw text-gray-500 me-2`} /> {c.titulo}
                      {dados.rascunhos[chave] > 0 && <span className="badge bg-warning text-dark rounded-pill ms-auto me-1" title="Rascunhos">{dados.rascunhos[chave]}</span>}
                      <span className={`badge bg-teal rounded-pill ${dados.rascunhos[chave] > 0 ? '' : 'ms-auto'}`} title="Publicados">{dados.totais[chave]}</span>
                    </Link>
                  ))}
                </div>
              </Caixa>

              {dados.ultimosComentarios && (
                <Caixa titulo="Últimos comentários" acoes={<Link to="/comentarios" className="btn btn-xs btn-default">Todos</Link>}>
                  {dados.ultimosComentarios.length === 0 && <p className="text-muted mb-0">Ainda não há comentários.</p>}
                  {dados.ultimosComentarios.map((c) => (
                    <div key={c.id} className="d-flex mb-3">
                      <span className="admin-avatar me-2 flex-shrink-0">{c.nome.slice(0, 2).toUpperCase()}</span>
                      <div className="min-w-0">
                        <div className="fw-bold">{c.nome} <span className="text-muted fw-normal small">· {dataHora(c.data)}</span></div>
                        <div className="text-muted small text-truncate">em {c.tituloItem}</div>
                        <div className="text-break">{c.texto.length > 140 ? `${c.texto.slice(0, 140)}…` : c.texto}</div>
                      </div>
                    </div>
                  ))}
                </Caixa>
              )}

              <Caixa
                titulo={pode('atividades.ver') ? 'Atividade recente' : 'A minha atividade'}
                acoes={pode('atividades.ver') && <Link to="/atividades" className="btn btn-xs btn-default">Registo</Link>}
              >
                {dados.ultimasAtividades.map((a) => (
                  <div key={a.id} className="d-flex mb-2 small">
                    <i className="fa fa-circle text-teal fs-8px me-2 mt-2" />
                    <div>
                      <b>{a.utilizador_nome || '—'}</b> {NOMES_ACOES[a.acao]?.toLowerCase() || a.acao}
                      {a.alvo_titulo && <> <i>“{a.alvo_titulo}”</i></>}
                      <div className="text-muted">{dataHora(a.data)}</div>
                    </div>
                  </div>
                ))}
              </Caixa>
            </div>
          </div>
        </>
      )}
    </>
  )
}

export default Painel
