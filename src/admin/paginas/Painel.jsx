import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useSessao } from '../sessaoContexto'
import { COLECOES, NOMES_ACOES } from '../esquemas'
import { CabecalhoPagina, Carregando, Erro, Painel as Caixa } from '../componentes/Ui'
import { dataHora } from '../formatar'

const NOMES_COLECOES = { noticias: 'Notícia', eventos: 'Evento', artigos: 'Artigo' }

// últimos 14 dias, com zero nos dias sem registos
function serie14(linhas) {
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

function Painel() {
  const { utilizador, eAdministrador } = useSessao()
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState('')

  const carregar = useCallback(() => {
    api('/painel').then((r) => { setErro(''); setDados(r) }).catch((e) => setErro(e.message))
  }, [])
  useEffect(carregar, [carregar])

  const widgets = dados && [
    { cor: 'bg-teal', icone: 'fa-newspaper', titulo: 'NOTÍCIAS', valor: dados.totais.noticias, para: '/colecao/noticias' },
    { cor: 'bg-blue', icone: 'fa-calendar-alt', titulo: 'EVENTOS', valor: dados.totais.eventos, para: '/colecao/eventos' },
    { cor: 'bg-indigo', icone: 'fa-eye', titulo: 'VISUALIZAÇÕES', valor: dados.interacoes.visualizacoes, para: null },
    { cor: 'bg-red', icone: 'fa-comments', titulo: 'COMENTÁRIOS', valor: dados.interacoes.comentarios, extra: `${dados.interacoes.comentariosHoje} hoje`, para: '/comentarios' },
  ]

  return (
    <>
      <CabecalhoPagina titulo={`Olá, ${utilizador.nome.split(' ')[0]}`} subtitulo="resumo do site" />

      {erro && <Erro texto={erro} onRepetir={() => { setErro(''); carregar() }} />}
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
                    {w.para ? <Link to={w.para}>{w.extra || 'Ver detalhes'} <i className="fa fa-arrow-alt-circle-right" /></Link> : <span className="px-3">{dados.interacoes.gostos} gostos no total</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="row">
            <div className="col-xl-8">
              <Caixa titulo="Atividade dos últimos 14 dias">
                <Grafico
                  series={[
                    { nome: 'Ações no painel', cor: '#00acac', dados: serie14(dados.atividadeDias) },
                    { nome: 'Comentários', cor: '#ff5b57', dados: serie14(dados.comentariosDias) },
                  ]}
                />
              </Caixa>

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
            </div>

            <div className="col-xl-4">
              <Caixa titulo="Conteúdos publicados" corpo={false}>
                <div className="list-group list-group-flush rounded-bottom">
                  {Object.entries(COLECOES).map(([chave, c]) => (
                    <Link key={chave} to={`/colecao/${chave}`} className="list-group-item list-group-item-action d-flex align-items-center">
                      <i className={`fa ${c.icone} fa-fw text-gray-500 me-2`} /> {c.titulo}
                      <span className="badge bg-teal rounded-pill ms-auto">{dados.totais[chave]}</span>
                    </Link>
                  ))}
                </div>
              </Caixa>

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

              <Caixa
                titulo={eAdministrador ? 'Atividade recente' : 'A minha atividade'}
                acoes={eAdministrador && <Link to="/atividades" className="btn btn-xs btn-default">Registo</Link>}
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
