import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import { CabecalhoPagina, Carregando, Erro, Painel } from '../componentes/Ui'
import { t as tx, localAtual } from '../../i18n/linguas'

const PERIODOS = [[7, tx('7 dias')], [30, tx('30 dias')], [90, tx('90 dias')], [365, tx('12 meses')]]

// série com zero nos dias sem visitas
function preencherDias(linhas, dias) {
  const porDia = Object.fromEntries(linhas.map((l) => [l.dia, l]))
  return Array.from({ length: dias }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (dias - 1 - i))
    const dia = d.toISOString().slice(0, 10)
    return { dia, visitantes: porDia[dia]?.visitantes || 0, paginas: porDia[dia]?.paginas || 0 }
  })
}

// gráfico de área em SVG (sem bibliotecas externas)
function GraficoLinha({ dados }) {
  const L = 1000
  const A = 240
  const max = Math.max(1, ...dados.map((d) => d.paginas))
  const x = (i) => (dados.length === 1 ? L / 2 : (i / (dados.length - 1)) * L)
  const y = (v) => A - (v / max) * (A - 20)
  const linha = (campo) => dados.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d[campo]).toFixed(1)}`).join(' ')
  const passo = Math.ceil(dados.length / 10)
  return (
    <div>
      <svg viewBox={`0 0 ${L} ${A + 24}`} className="grafico-linha" role="img" aria-label={tx('Visitantes e páginas vistas por dia')}>
        {[0.25, 0.5, 0.75, 1].map((f) => <line key={f} x1="0" x2={L} y1={y(max * f)} y2={y(max * f)} className="grafico-grelha" />)}
        <path d={`${linha('paginas')} L${L},${A} L0,${A} Z`} fill="rgba(201, 162, 39, 0.15)" />
        <path d={linha('paginas')} fill="none" stroke="#c9a227" strokeWidth="2.5" />
        <path d={linha('visitantes')} fill="none" stroke="#e53917" strokeWidth="2.5" />
        {dados.map((d, i) => i % passo === 0 && (
          <text key={d.dia} x={x(i)} y={A + 18} textAnchor="middle" className="grafico-texto">{d.dia.slice(8)}/{d.dia.slice(5, 7)}</text>
        ))}
      </svg>
      <div className="d-flex gap-3 small">
        <span><i className="fa fa-square me-1" style={{ color: '#e53917' }} />{tx('Visitantes')}</span>
        <span><i className="fa fa-square me-1" style={{ color: '#c9a227' }} />{tx('Páginas vistas')}</span>
      </div>
    </div>
  )
}

function Barras({ linhas, rotulo = (v) => v, vazio = tx('Sem dados no período.') }) {
  const max = Math.max(1, ...linhas.map((l) => l.paginas))
  if (!linhas.length) return <p className="text-muted mb-0">{vazio}</p>
  return linhas.map((l) => (
    <div key={l.valor} className="mb-2">
      <div className="d-flex justify-content-between small mb-1">
        <span className="text-truncate me-2">{rotulo(l.valor)}</span>
        <span className="text-nowrap fw-bold">{l.paginas.toLocaleString(localAtual())}</span>
      </div>
      <div className="progress h-5px"><div className="progress-bar esg-barra" style={{ width: `${(l.paginas / max) * 100}%` }} /></div>
    </div>
  ))
}

const NOMES_PAGINAS = { '/': tx('Página inicial') }

function Estatisticas() {
  const [dias, setDias] = useState(30)
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState('')

  const carregar = useCallback(() => {
    api(`/estatisticas?dias=${dias}`).then((r) => { setErro(''); setDados(r) }).catch((e) => setErro(e.message))
  }, [dias])
  useEffect(carregar, [carregar])

  const widgets = dados && [
    { cor: 'esg-w-vermelho', icone: 'fa-users', titulo: 'VISITANTES', valor: dados.totais.visitantes, nota: tx('{0} já tinham visitado', { 0: dados.totais.recorrentes }) },
    { cor: 'esg-w-preto', icone: 'fa-file-alt', titulo: tx('PÁGINAS VISTAS'), valor: dados.totais.paginas, nota: tx('{0} por visita', { 0: dados.totais.paginasPorVisita }) },
    { cor: 'esg-w-dourado', icone: 'fa-door-open', titulo: 'VISITAS', valor: dados.totais.sessoes, nota: tx('um visitante por dia = uma visita') },
    { cor: 'esg-w-cinza', icone: 'fa-signal', titulo: tx('ONLINE AGORA'), valor: dados.online, nota: tx('últimos 5 minutos') },
  ]

  return (
    <>
      <CabecalhoPagina titulo={tx('Estatísticas')} subtitulo={tx('quem visita o site')} migalhas={[{ rotulo: tx('Estatísticas') }]}>
        <div className="btn-group">
          {PERIODOS.map(([d, r]) => (
            <button key={d} type="button" className={`btn ${dias === d ? 'btn-theme' : 'btn-white'}`} onClick={() => setDias(d)}>{r}</button>
          ))}
        </div>
      </CabecalhoPagina>

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
                    <p>{w.valor.toLocaleString(localAtual())}</p>
                  </div>
                  <div className="stats-link"><span className="d-block px-3 py-2 small">{w.nota}</span></div>
                </div>
              </div>
            ))}
          </div>

          <Painel titulo={tx('Evolução — últimos {0}', { 0: PERIODOS.find(([d]) => d === dias)[1] })}>
            {dados.totais.paginas === 0
              ? <p className="text-muted mb-0">{tx('Ainda não há visitas registadas neste período. As visitas contam a partir do momento em que o site está ligado à API.')}</p>
              : <GraficoLinha dados={preencherDias(dados.porDia, Math.min(dias, 90))} />}
          </Painel>

          <div className="row">
            <div className="col-xl-6">
              <Painel titulo={tx('Páginas mais vistas')}>
                <Barras linhas={dados.paginas} rotulo={(v) => NOMES_PAGINAS[v] || decodeURIComponent(v)} />
              </Painel>
            </div>
            <div className="col-xl-6">
              <Painel titulo={tx('De onde vêm os visitantes')}>
                <Barras linhas={dados.origens} vazio={tx('Só acessos diretos (endereço escrito ou favoritos).')} />
              </Painel>
            </div>
            <div className="col-xl-4">
              <Painel titulo={tx('Dispositivos')}><Barras linhas={dados.dispositivos} /></Painel>
            </div>
            <div className="col-xl-4">
              <Painel titulo={tx('Navegadores')}><Barras linhas={dados.navegadores} /></Painel>
            </div>
            <div className="col-xl-4">
              <Painel titulo={tx('Horas de maior movimento')}>
                <div className="grafico-horas">
                  {Array.from({ length: 24 }, (_, h) => {
                    const v = dados.porHora.find((x) => x.hora === h)?.paginas || 0
                    const max = Math.max(1, ...dados.porHora.map((x) => x.paginas))
                    return <span key={h} title={tx('{0}h: {1} páginas', { 0: h, 1: v })} style={{ height: `${Math.max(4, (v / max) * 100)}%` }} />
                  })}
                </div>
                <div className="d-flex justify-content-between small text-muted mt-1"><span>{tx('0h')}</span><span>{tx('12h')}</span><span>{tx('23h')}</span></div>
              </Painel>
            </div>
          </div>

          <p className="small text-muted">
            <i className="fa fa-user-shield me-1" />{tx('As estatísticas não usam cookies nem guardam o endereço IP dos visitantes: cada navegador recebe um identificador anónimo.')}
          </p>
        </>
      )}
    </>
  )
}

export default Estatisticas
