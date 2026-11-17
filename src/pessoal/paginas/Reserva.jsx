import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useDados } from '../useDados'
import Tabela from '../componentes/Tabela'
import Foto from '../componentes/Foto'
import { Cabecalho, Carregando, Escolha, Painel } from '../componentes/Ui'
import { dataPt } from '../formatar'
import { documentoPdf } from '../exportar'
import { useSessao } from '../sessao'

const PERIODOS = [['1', 'Até ao fim do próximo ano'], ['3', 'Próximos 3 anos'], ['5', 'Próximos 5 anos'], ['10', 'Próximos 10 anos']]

/*
  Reserva e reforma (arts. 111.º e 114.º), sempre pela ordem hierárquica:
  1. os militares que JÁ ESTÃO em idade de reforma (ou com os 35 anos de serviço) — em destaque, para tratar já;
  2. os que já passaram o limite de idade da reserva e continuam no activo;
  3. quem passa à reforma e à reserva no período escolhido.
  Tudo se imprime num só documento (o modelo das listas da Escola).
*/
function Bloco({ titulo, cor, icone, lista, explicacao, vazio, colunas, aoClicar }) {
  return (
    <Painel>
      <h5 className={`mb-1 text-${cor}`}><i className={`fa ${icone} me-2`} />{titulo} <span className={`badge bg-${cor} ms-1`}>{lista.length}</span></h5>
      <p className="small text-muted mb-2">{explicacao}</p>
      <Tabela titulo={titulo} colunas={colunas} linhas={lista.map((x, i) => ({ ...x, n: String(i + 1).padStart(2, '0') }))} chave={(l) => `${l.id}-${l.passagem}`} aoClicar={aoClicar} vazio={vazio} porPagina={50} />
    </Painel>
  )
}

export default function Reserva() {
  const navegar = useNavigate()
  const avisar = useSessao()?.avisar
  const [params] = useSearchParams()
  // vindo do gráfico do painel (?ano=2029): o período chega a esse ano
  const [ano, setAno] = useState(() => params.get('ano') ?? '')
  const [anos, setAnos] = useState(() => { const d = Number(params.get('ano')) - new Date().getFullYear(); return d > 5 ? 10 : 5 })
  const consulta = useMemo(() => ({ anos }), [anos])
  const { dados: linhas, erro } = useDados('/carreira/reserva', consulta)
  const atual = new Date().getFullYear()

  const grupos = useMemo(() => {
    const l = linhas ?? []
    const doAno = (x) => !ano || x.data.startsWith(ano)
    return {
      reformaJa: l.filter((x) => x.passagem === 'reforma' && x.atrasado),
      reservaJa: l.filter((x) => x.passagem === 'reserva' && x.atrasado),
      reforma: l.filter((x) => x.passagem === 'reforma' && !x.atrasado && doAno(x)),
      reserva: l.filter((x) => x.passagem === 'reserva' && !x.atrasado && doAno(x)),
    }
  }, [linhas, ano])

  const colunas = useMemo(() => [
    { chave: 'n', titulo: 'N/O', valor: (l) => l.n, alinhar: 'center' },
    { chave: 'posto', titulo: 'Posto', valor: (l) => l.postoNome },
    { chave: 'nip', titulo: 'NIP', valor: (l) => l.nip },
    { chave: 'nome', titulo: 'Nome', valor: (l) => l.nome, mostrar: (l) => <span className="pes-pessoa"><Foto pessoaId={l.id} fotoId={l.fotoId} nome={l.nome} /><strong>{l.nome}</strong></span> },
    { chave: 'ramo', titulo: 'Ramo', valor: (l) => l.ramo, oculta: true },
    { chave: 'nascimento', titulo: 'Nascimento', valor: (l) => l.dataNascimento, mostrar: (l) => dataPt(l.dataNascimento) },
    { chave: 'idade', titulo: 'Idade', valor: (l) => l.idade, mostrar: (l) => (l.idade === null || l.idade === undefined ? '—' : `${l.idade} anos`), alinhar: 'end' },
    { chave: 'servico', titulo: 'Tempo de serviço', valor: (l) => l.tempoServico, mostrar: (l) => (l.tempoServico === null || l.tempoServico === undefined ? '—' : `${l.tempoServico} anos`), alinhar: 'end' },
    { chave: 'motivo', titulo: 'Motivo', valor: (l) => l.motivo },
    { chave: 'data', titulo: 'Data', valor: (l) => l.data, mostrar: (l) => <strong className={l.atrasado ? 'text-danger' : ''}>{dataPt(l.data)}</strong> },
    { chave: 'cargo', titulo: 'Cargo', valor: (l) => l.cargoNome },
    { chave: 'unidade', titulo: 'Unidade', valor: (l) => l.unidadeNome },
    { chave: 'artigo', titulo: 'Fundamento', valor: (l) => l.artigo, oculta: true },
  ], [])

  const abrir = (l) => navegar(`/pessoas/${l.id}`)

  async function imprimir() {
    const col = (titulo, valor, extra = {}) => ({ titulo, valor, ...extra })
    const cols = (rotuloData) => [
      col('N/O', (l, i) => String(i + 1).padStart(2, '0'), { alinhar: 'center', largura: 9 }),
      col('Posto', (l) => l.postoNome, { largura: 30 }),
      col('NIP', (l) => l.nip ?? '', { largura: 18 }),
      col('Nome completo', (l) => l.nome, { largura: 62 }),
      col('Idade', (l) => (l.idade ?? ''), { alinhar: 'center', largura: 11 }),
      col('Anos de serviço', (l) => (l.tempoServico ?? ''), { alinhar: 'center', largura: 14 }),
      col('Motivo', (l) => l.motivo ?? '', { largura: 36 }),
      col(rotuloData, (l) => l.data, { data: true }),
      col('Cargo / unidade', (l) => [l.cargoNome, l.unidadeNome].filter(Boolean).join(' — '), { largura: 60 }),
    ]
    const periodo = ano ? `em ${ano}` : PERIODOS.find(([k]) => k === String(anos))?.[1].toLowerCase()
    const seccoes = [
      { titulo: `Militares em idade de reforma (${grupos.reformaJa.length})`, colunas: cols('Atingiu em'), linhas: grupos.reformaJa },
      { titulo: `Militares que já passaram o limite de idade da reserva (${grupos.reservaJa.length})`, colunas: cols('Atingiu em'), linhas: grupos.reservaJa },
      { titulo: `Passam à reforma — ${periodo} (${grupos.reforma.length})`, colunas: cols('Data da reforma'), linhas: grupos.reforma },
      { titulo: `Passam à reserva — ${periodo} (${grupos.reserva.length})`, colunas: cols('Data da reserva'), linhas: grupos.reserva },
    ].filter((s) => s.linhas.length)
    if (!seccoes.length) return avisar?.('Não há militares para imprimir.', 'erro')
    try {
      await documentoPdf({
        titulo: 'Relação dos militares em idade de reserva e de reforma',
        subtitulo: `Situação em ${new Date().toLocaleDateString('pt-PT')} · pela ordem hierárquica`,
        orientacao: 'landscape',
        seccoes,
        nota: 'Reforma aos 60 anos de idade (65 para os oficiais generais) ou com 35 anos de serviço, o que chegar primeiro (art. 114.º). Reserva pelo limite de idade do posto no Quadro Permanente (art. 111.º).',
      })
    } catch (e) {
      avisar?.(`Não foi possível fazer o documento: ${e.message}`, 'erro')
    }
  }

  return (
    <>
      <Cabecalho titulo="Reserva e reforma" subtitulo="militares em idade de reforma e quem sai do activo, pela ordem hierárquica" migalhas={[['Carreiras'], ['Reserva e reforma']]}>
        <button type="button" className="btn btn-danger" disabled={!linhas} onClick={imprimir}><i className="fa fa-print me-1" />Imprimir relação</button>
      </Cabecalho>
      {erro ? <div className="alert alert-danger">{erro}</div> : !linhas ? <Carregando /> : (
        <>
          <div className="row g-3 mb-3">
            {[
              ['danger', 'fa-user-clock', grupos.reformaJa.length, 'Já em idade de reforma'],
              ['warning', 'fa-hourglass-end', grupos.reservaJa.length, 'Passaram o limite da reserva'],
              ['primary', 'fa-calendar-alt', grupos.reforma.length, ano ? `Passam à reforma em ${ano}` : 'Passam à reforma no período'],
              ['secondary', 'fa-calendar-check', grupos.reserva.length, ano ? `Passam à reserva em ${ano}` : 'Passam à reserva no período'],
            ].map(([cor, ic, n, t]) => (
              <div key={t} className="col-6 col-md-3">
                <div className={`card border-${cor} h-100`}><div className="card-body py-2">
                  <div className={`fs-3 fw-bold text-${cor}`}><i className={`fa ${ic} me-2`} />{n}</div>
                  <div className="small">{t}</div>
                </div></div>
              </div>
            ))}
          </div>

          <div className="alert alert-danger d-flex align-items-start">
            <i className="fa fa-exclamation-triangle fa-lg me-2 mt-1" />
            <div><strong>{grupos.reformaJa.length} militar(es) já atingiram a idade de reforma</strong> (60 anos; 65 os oficiais generais) ou os 35 anos de serviço (art. 114.º) e continuam no activo ou na reserva. Prepare a passagem à reforma e a substituição de quem ocupa cargos; depois mude a situação na ficha.</div>
          </div>
          <Bloco colunas={colunas} aoClicar={abrir} titulo="Militares em idade de reforma" cor="danger" icone="fa-user-clock" lista={grupos.reformaJa} vazio="Nenhum militar em idade de reforma." explicacao="Já atingiram o limite de idade ou os 35 anos de serviço. A data é o dia em que o atingiram." />
          {grupos.reservaJa.length > 0 && <Bloco colunas={colunas} aoClicar={abrir} titulo="Passaram o limite de idade da reserva" cor="warning" icone="fa-hourglass-end" lista={grupos.reservaJa} vazio="" explicacao="Militares do Quadro Permanente que já passaram o limite de idade do posto (art. 111.º) e continuam no activo." />}

          <Painel>
            <div className="row g-2 align-items-center">
              <div className="col-auto fw-bold">Próximas passagens:</div>
              <div className="col-md-3"><Escolha valor={String(anos)} aoMudar={(v) => { setAnos(Number(v)); setAno('') }} opcoes={PERIODOS} vazio={null} aria-label="Período" /></div>
              <div className="col-md-3"><Escolha valor={ano} aoMudar={setAno} opcoes={Array.from({ length: anos + 1 }, (_, i) => String(atual + i))} vazio="Todos os anos do período" aria-label="Ano" /></div>
            </div>
          </Painel>
          <Bloco colunas={colunas} aoClicar={abrir} titulo="Passam à reforma" cor="primary" icone="fa-calendar-alt" lista={grupos.reforma} vazio="Ninguém passa à reforma neste período." explicacao="Reforma aos 60 anos de idade (65 os oficiais generais) ou com 35 anos de serviço, o que chegar primeiro (art. 114.º)." />
          <Bloco colunas={colunas} aoClicar={abrir} titulo="Passam à reserva" cor="secondary" icone="fa-calendar-check" lista={grupos.reserva} vazio="Ninguém passa à reserva neste período." explicacao="Pelo limite de idade do posto no Quadro Permanente (art. 111.º)." />
        </>
      )}
    </>
  )
}
