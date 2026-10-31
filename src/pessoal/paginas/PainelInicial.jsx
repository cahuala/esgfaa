import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useDados } from '../useDados'
import Grafico from '../componentes/Grafico'
import { Cabecalho, Carregando, Erro, Painel } from '../componentes/Ui'
import { dataHoraPt, dataPt } from '../formatar'

const lista = (filtro) => `/pessoas?${new URLSearchParams(filtro)}`

function Cartao({ cor, icone, titulo, valor, detalhe, para }) {
  return (
    <div className="col-xl-3 col-md-6">
      <Link to={para} className={`widget widget-stats bg-${cor} pes-cartao`}>
        <div className="stats-icon"><i className={`fa ${icone}`} /></div>
        <div className="stats-info">
          <h4>{titulo}</h4>
          <p>{valor}</p>
        </div>
        <div className="stats-link"><span>{detalhe} <i className="fa fa-arrow-alt-circle-right" /></span></div>
      </Link>
    </div>
  )
}

// gráfico de um agrupamento do servidor ([{ chave, rotulo, valor, filtro }]); clicar abre a lista com o filtro
function GraficoGrupo({ titulo, icone, dados, tipo = 'bar', para = lista, altura, col = 'col-xl-4 col-md-6', rotuloSerie = 'Pessoas' }) {
  const navegar = useNavigate()
  const rotulos = useMemo(() => dados.map((d) => d.rotulo), [dados])
  const series = useMemo(() => [{ rotulo: rotuloSerie, valores: dados.map((d) => d.valor) }], [dados, rotuloSerie])
  return (
    <div className={col}>
      <Painel titulo={titulo} icone={icone}>
        {dados.length ? <Grafico tipo={tipo} rotulos={rotulos} series={series} altura={altura} aoClicar={(i) => navegar(para(dados[i].filtro, dados[i]))} /> : <p className="text-muted text-center py-5 mb-0">Sem dados.</p>}
      </Painel>
    </div>
  )
}

export default function PainelInicial() {
  const navegar = useNavigate()
  const { dados: d, erro, recarregar: carregar } = useDados('/painel', undefined, { tempoReal: true })

  const g = d?.graficos
  const categoriasRamo = useMemo(() => g && ({ rotulos: g.categorias.map((c) => c.rotulo), series: g.postoPorRamo.map((r) => ({ rotulo: r.rotulo, valores: r.valores })) }), [g])
  const movimentos = useMemo(() => g && ({ rotulos: g.movimentos.meses.map((m) => new Date(`${m}-15`).toLocaleDateString('pt-PT', { month: 'short', year: '2-digit' })), series: g.movimentos.series.map((s) => ({ rotulo: s.rotulo, valores: s.valores })) }), [g])
  const reserva = useMemo(() => g && ({ rotulos: g.reserva.map((r) => r.rotulo), series: [{ rotulo: 'Passam à reserva', valores: g.reserva.map((r) => r.reserva), cor: '#c9a227' }, { rotulo: 'Passam à reforma', valores: g.reserva.map((r) => r.reforma), cor: '#8c3b2e' }] }), [g])
  const generoRamo = useMemo(() => g && ({ rotulos: g.generoPorRamo.map((r) => r.rotulo), series: [{ rotulo: 'Homens', valores: g.generoPorRamo.map((r) => r.homens), cor: '#1f3b73' }, { rotulo: 'Mulheres', valores: g.generoPorRamo.map((r) => r.mulheres), cor: '#c2185b' }] }), [g])
  const ocupacao = useMemo(() => g && ({ rotulos: g.ocupacao.map((o) => o.rotulo), series: [{ rotulo: 'Ocupados', valores: g.ocupacao.map((o) => o.ocupados), cor: '#2d5a3d' }, { rotulo: 'Livres', valores: g.ocupacao.map((o) => o.livres), cor: '#d9d9d9' }] }), [g])

  if (erro) return <Erro texto={erro} aoRepetir={carregar} />
  if (!d) return <Carregando />
  const t = d.totais
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0)

  return (
    <>
      <Cabecalho titulo="Painel do pessoal" subtitulo="militares dos três ramos e pessoal civil da Escola" />
      <div className="row">
        <Cartao cor="teal" icone="fa-users" titulo="Efectivo total" valor={t.total} detalhe={`${t.militares} militares · ${t.civis} civis`} para="/pessoas" />
        <Cartao cor="blue" icone="fa-chalkboard-teacher" titulo="Docentes" valor={t.docentes} detalhe={`${t.estudantes} estudantes · ${t.funcionarios} funcionários`} para={lista({ vinculo: 'docente' })} />
        <Cartao cor="indigo" icone="fa-star" titulo="Oficiais" valor={t.oficiais} detalhe={`${t.sargentos} sargentos · ${t.pracas} praças`} para={lista({ tipo: 'militar', grupo: 'oficiais' })} />
        <Cartao cor="orange" icone="fa-medal" titulo="Em condições de promoção" valor={t.elegiveis} detalhe="Ver quem cumpre a lei" para="/elegiveis" />
        <Cartao cor="red" icone="fa-file-signature" titulo="Propostas enviadas" valor={t.propostasDespacho} detalhe={`${t.propostasPreparacao} em preparação`} para="/propostas?estado=enviada" />
        <Cartao cor="purple" icone="fa-plane-departure" titulo="De licença hoje" valor={t.emLicenca} detalhe="Ver licenças em curso" para="/licencas?estado=em_curso" />
        <Cartao cor="yellow" icone="fa-hourglass-half" titulo={`Reserva em ${new Date().getFullYear()}`} valor={t.reservaEsteAno} detalhe="Projeção de reserva e reforma" para="/reserva" />
        <Cartao cor="dark" icone="fa-sitemap" titulo="Cargos ocupados" valor={`${t.lugaresOcupados}/${t.lugares}`} detalhe={`${pct(t.lugaresOcupados, t.lugares)}% do quadro orgânico`} para="/organica" />
        <Cartao cor="pink" icone="fa-venus" titulo="Mulheres" valor={t.mulheres} detalhe={`${t.mulheresMilitares} militares · ${t.mulheresOficiais} oficiais (${pct(t.mulheres, t.total)}%)`} para={lista({ genero: 'F' })} />
        <Cartao cor="lime" icone="fa-house-user" titulo="Empregados domiciliares" valor={t.domiciliares} detalhe="Não contam como civis" para="/domiciliares" />
      </div>

      <div className="row">
        <GraficoGrupo titulo="Militares por ramo" icone="fa-flag" dados={g.ramo} tipo="doughnut" />
        <GraficoGrupo titulo="Militares por categoria" icone="fa-layer-group" dados={g.grupo} tipo="pie" />
        <GraficoGrupo titulo="Militares e civis" icone="fa-user-friends" dados={g.tipo} tipo="doughnut" />
      </div>
      <div className="row">
        <div className="col-xl-8">
          <Painel titulo="Efectivo por posto" icone="fa-chevron-up">
            <Grafico tipo="barH" altura={Math.max(260, g.posto.length * 24)} rotulos={g.posto.map((p) => p.rotulo)} series={[{ rotulo: 'Militares', valores: g.posto.map((p) => p.valor) }]} aoClicar={(i) => navegar(lista(g.posto[i].filtro))} />
          </Painel>
        </div>
        <div className="col-xl-4">
          <Painel titulo="Escalões e categorias por ramo" icone="fa-chart-bar">
            <Grafico tipo="bar" altura={Math.max(260, g.posto.length * 24)} empilhado rotulos={categoriasRamo.rotulos} series={categoriasRamo.series} aoClicar={(i, s) => navegar(lista({ tipo: 'militar', ramo: g.postoPorRamo[s].ramo, categoria: g.categorias[i].chave }))} />
          </Painel>
        </div>
      </div>
      <div className="row">
        <GraficoGrupo titulo="Forma de prestação de serviço" icone="fa-id-badge" dados={g.fps} tipo="pie" />
        <GraficoGrupo titulo="Situação (Lei n.º 13/18)" icone="fa-user-clock" dados={g.situacao} tipo="doughnut" />
        <GraficoGrupo titulo="Vínculo à Escola" icone="fa-school" dados={g.vinculo} tipo="polarArea" />
      </div>
      <div className="row">
        <GraficoGrupo titulo="No activo: efectividade de serviço (art. 11.º)" icone="fa-sitemap" dados={g.efectividade} tipo="bar" />
        {g.estado?.length > 0 && <GraficoGrupo titulo="Estado (destacados, em missão, em formação…)" icone="fa-route" dados={g.estado} tipo="bar" />}
      </div>
      <div className="row">
        <div className="col-xl-8">
          <Painel titulo="Movimentos na carreira (últimos 12 meses)" icone="fa-chart-line">
            <Grafico tipo="line" altura={280} rotulos={movimentos.rotulos} series={movimentos.series} aoClicar={(i, s) => navegar(`/propostas?${new URLSearchParams({ tipo: g.movimentos.series[s].tipo, estado: 'aprovada' })}`)} />
          </Painel>
        </div>
        <GraficoGrupo titulo="Faixa etária" icone="fa-birthday-cake" dados={g.faixaEtaria} altura={280} />
      </div>
      <div className="row">
        <GraficoGrupo titulo="Habilitações literárias" icone="fa-graduation-cap" dados={g.habilitacao} tipo="barH" />
        <GraficoGrupo titulo="Género" icone="fa-venus-mars" dados={g.genero} tipo="pie" />
        <GraficoGrupo titulo="Quadros especiais (armas e serviços)" icone="fa-shield-alt" dados={g.quadro} tipo="barH" />
      </div>
      <div className="row">
        <GraficoGrupo titulo="Mulheres militares por ramo" icone="fa-venus" dados={g.mulheresRamo} tipo="doughnut" rotuloSerie="Mulheres" />
        <GraficoGrupo titulo="Mulheres militares por categoria" icone="fa-venus" dados={g.mulheresCategoria} tipo="bar" rotuloSerie="Mulheres" />
        <div className="col-xl-4 col-md-6">
          <Painel titulo="Homens e mulheres em cada ramo" icone="fa-venus-mars">
            <Grafico tipo="bar" empilhado rotulos={generoRamo.rotulos} series={generoRamo.series} aoClicar={(i, s) => navegar(lista({ tipo: 'militar', ramo: g.generoPorRamo[i].ramo, ...(s === 1 ? { genero: 'F' } : { genero: 'M' }) }))} />
          </Painel>
        </div>
      </div>
      <div className="row">
        <GraficoGrupo titulo="Mulheres por posto" icone="fa-venus" dados={g.mulheresPosto} tipo="barH" col="col-xl-6" rotuloSerie="Mulheres" />
        <GraficoGrupo titulo="Mulheres por vínculo" icone="fa-venus" dados={g.mulheresVinculo} tipo="pie" col="col-xl-6" rotuloSerie="Mulheres" />
      </div>
      <div className="row">
        <GraficoGrupo titulo="Pessoas por unidade" icone="fa-building" dados={g.unidade} tipo="barH" col="col-xl-6" altura={Math.max(260, g.unidade.length * 26)} />
        <GraficoGrupo titulo="Naturalidade (província)" icone="fa-map-marker-alt" dados={g.provincia} tipo="bar" col="col-xl-6" altura={Math.max(260, g.unidade.length * 26)} />
      </div>
      <div className="row">
        <div className="col-xl-4 col-md-6">
          <Painel titulo="Reserva e reforma (próximos anos)" icone="fa-hourglass-half">
            <Grafico tipo="bar" rotulos={reserva.rotulos} series={reserva.series} aoClicar={(i) => navegar(`/reserva?ano=${g.reserva[i].chave}`)} />
          </Painel>
        </div>
        <div className="col-xl-4 col-md-6">
          <Painel titulo="Ocupação do quadro orgânico" icone="fa-sitemap">
            <Grafico tipo="bar" empilhado rotulos={ocupacao.rotulos} series={ocupacao.series} aoClicar={() => navegar('/organica')} />
          </Painel>
        </div>
        <GraficoGrupo titulo="Pessoal civil por carreira" icone="fa-briefcase" dados={g.carreiraCivil} tipo="doughnut" />
      </div>
      <div className="row">
        <GraficoGrupo titulo={`Licenças em ${new Date().getFullYear()}`} icone="fa-plane-departure" dados={g.licencas} tipo="bar" para={(f) => `/licencas?${new URLSearchParams({ ...f, ano: new Date().getFullYear() })}`} rotuloSerie="Licenças" />
        <GraficoGrupo titulo="Propostas por estado" icone="fa-file-signature" dados={g.propostas} tipo="doughnut" para={(f) => `/propostas?${new URLSearchParams(f)}`} rotuloSerie="Propostas" />
        <GraficoGrupo titulo="Propostas por tipo" icone="fa-tasks" dados={g.propostasTipo} tipo="pie" para={(f) => `/propostas?${new URLSearchParams(f)}`} rotuloSerie="Propostas" />
      </div>

      <div className="row">
        <div className="col-xl-4">
          <Painel titulo="À espera do extracto" icone="fa-hourglass-half" corpo={false}>
            <div className="list-group list-group-flush">
              {d.listas.despacho.map((p) => (
                <Link key={p.id} to={`/propostas/${p.id}`} className="list-group-item list-group-item-action">
                  <strong>{p.titulo}</strong>
                  <div className="small text-muted">{p.tipoNome} · {p.pessoas} pessoa(s) · enviada {dataHoraPt(p.submetidaEm)}</div>
                </Link>
              ))}
              {!d.listas.despacho.length && <div className="list-group-item text-muted">Nenhuma proposta enviada à espera de resposta.</div>}
            </div>
          </Painel>
        </div>
        <div className="col-xl-4">
          <Painel titulo="Próximas passagens à reserva e reforma" icone="fa-hourglass-end" corpo={false}>
            <div className="list-group list-group-flush">
              {d.listas.reserva.map((p) => (
                <Link key={`${p.id}-${p.passagem}`} to={`/pessoas/${p.id}`} className="list-group-item list-group-item-action d-flex">
                  <span className="me-auto"><strong>{p.postoAbreviatura} {p.nome}</strong><div className="small text-muted">{p.passagem === 'reserva' ? 'Reserva' : 'Reforma'} · {p.artigo}</div></span>
                  <span className={`badge align-self-center ${p.atrasado ? 'bg-danger' : 'bg-warning text-dark'}`} title={p.atrasado ? 'Data já passou: atualize a situação na ficha' : ''}>{p.atrasado ? 'em atraso · ' : ''}{dataPt(p.data)}</span>
                </Link>
              ))}
              {!d.listas.reserva.length && <div className="list-group-item text-muted">Ninguém nos próximos 5 anos.</div>}
            </div>
          </Painel>
        </div>
        <div className="col-xl-4">
          <Painel titulo="Aniversários deste mês" icone="fa-birthday-cake" corpo={false}>
            <div className="list-group list-group-flush">
              {d.listas.aniversarios.map((p) => (
                <Link key={p.id} to={`/pessoas/${p.id}`} className="list-group-item list-group-item-action d-flex">
                  <span className="me-auto"><strong>{p.nome}</strong><div className="small text-muted">{p.descricao} · faz {p.idade} anos</div></span>
                  <span className="badge bg-info align-self-center">dia {Number(p.dia)}</span>
                </Link>
              ))}
              {!d.listas.aniversarios.length && <div className="list-group-item text-muted">Nenhum aniversário este mês.</div>}
            </div>
          </Painel>
        </div>
      </div>
    </>
  )
}
