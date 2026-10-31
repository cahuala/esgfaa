import { useState } from 'react'
import { api } from '../api'
import { useDados } from '../useDados'
import { useSessao } from '../sessao'
import Foto from '../componentes/Foto'
import Tabela from '../componentes/Tabela'
import { Cabecalho, Campo, Carregando, Erro, Escolha, Modal, Painel } from '../componentes/Ui'
import { documentoPdf } from '../exportar'

const hojeLuanda = () => new Date(Date.now() + 3_600_000).toISOString().slice(0, 10)
const dataPt = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const horas = (min) => (min ? `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}` : '')
const ESTADOS = {
  dentro: ['Na unidade', 'bg-success'], saiu: ['Saiu', 'bg-secondary'], sem_marcacao: ['Sem marcação', 'bg-warning text-dark'],
  licenca: ['Licença / ausência', 'bg-info'], falta: ['Falta', 'bg-danger'], descanso: ['Fim de semana', 'bg-light text-dark border'],
}
const DEDOS = ['Mínimo esquerdo', 'Anelar esquerdo', 'Médio esquerdo', 'Indicador esquerdo', 'Polegar esquerdo', 'Polegar direito', 'Indicador direito', 'Médio direito', 'Anelar direito', 'Mínimo direito']

/*
  Livro de ponto digital do pessoal civil: as entradas e saídas da unidade chegam dos aparelhos de impressão
  digital, sozinhas e na hora. O dia (quem está, quem chegou atrasado, quem não marcou), o mês e os aparelhos.
*/
export default function LivroPonto() {
  const [aba, setAba] = useState('dia')
  return (
    <>
      <Cabecalho titulo="Livro de ponto" subtitulo="entradas e saídas do pessoal civil, com impressão digital" migalhas={[['Livro de ponto']]} />
      <ul className="nav nav-tabs mb-3">
        {[['dia', 'O dia', 'fa-calendar-day'], ['mes', 'O mês', 'fa-calendar-alt'], ['aparelhos', 'Aparelhos e horário', 'fa-fingerprint']].map(([k, t, i]) => (
          <li key={k} className="nav-item"><button type="button" className={`nav-link ${aba === k ? 'active' : ''}`} onClick={() => setAba(k)}><i className={`fa ${i} me-1`} />{t}</button></li>
        ))}
      </ul>
      {aba === 'dia' && <Dia />}
      {aba === 'mes' && <Mes />}
      {aba === 'aparelhos' && <Aparelhos />}
    </>
  )
}

function Dia() {
  const { pode, avisar } = useSessao()
  const [data, setData] = useState(hojeLuanda)
  const { dados: l, erro, recarregar } = useDados('/ponto/livro', { data }, { tempoReal: true })
  const [manual, setManual] = useState(null) // pessoa (ou {} para escolher)
  const [ver, setVer] = useState(null)
  const [aFechar, setAFechar] = useState(false)
  if (erro) return <Erro texto={erro} aoRepetir={recarregar} />
  if (!l) return <Carregando />
  const passado = l.data < l.hoje

  async function fecharDia() {
    if (!window.confirm(`Marcar falta aos ${l.resumo.semMarcacao} que não marcaram o ponto em ${dataPt(l.data)}? (quem estava de licença ou já tinha falta fica como está)`)) return
    setAFechar(true)
    try {
      const r = await api('/ponto/faltas', { metodo: 'POST', corpo: { data: l.data } })
      avisar(`${r.faltas} falta(s) registada(s). Aparecem também no Controlo de faltas (civis).`)
      recarregar()
    } catch (e) {
      avisar(e.message, 'erro')
    } finally {
      setAFechar(false)
    }
  }

  function imprimir() {
    documentoPdf({
      titulo: 'Livro de ponto do pessoal civil',
      subtitulo: `${dataPt(l.data)} · horário ${l.horario.entrada}–${l.horario.saida} (tolerância ${l.horario.tolerancia} min)`,
      orientacao: 'portrait',
      seccoes: [{
        colunas: [
          { titulo: 'N/O', valor: (p, i) => String(i + 1).padStart(2, '0'), alinhar: 'center', largura: 9 },
          { titulo: 'Nome completo', valor: (p) => p.nome, largura: 58 },
          { titulo: 'Entrada', valor: (p) => p.entrada ?? '', alinhar: 'center', largura: 16 },
          { titulo: 'Saída', valor: (p) => p.saida ?? '', alinhar: 'center', largura: 16 },
          { titulo: 'Horas', valor: (p) => horas(p.minutosTrabalho), alinhar: 'center', largura: 14 },
          { titulo: 'Observações', valor: (p) => observacoes(p), largura: 40 },
          { titulo: 'Rubrica', valor: () => '', largura: 29 },
        ],
        linhas: l.pessoas,
      }],
      nota: 'Marcações com impressão digital; «manual» = registada na Repartição, com justificação.',
    })
  }

  const colunas = [
    { chave: 'nome', titulo: 'Nome', valor: (p) => p.nome, mostrar: (p) => <span className="pes-pessoa"><Foto pessoaId={p.id} fotoId={p.fotoId} nome={p.nome} /><span><strong>{p.nome}</strong><div className="small text-muted">{p.categoria || '—'}</div></span></span> },
    { chave: 'numero', titulo: 'N.º no aparelho', valor: (p) => p.numeroAparelho, alinhar: 'center' },
    { chave: 'entrada', titulo: 'Entrada', valor: (p) => p.entrada ?? '', mostrar: (p) => (p.entrada ? <span className={p.atraso ? 'text-danger fw-bold' : 'fw-semibold'}>{p.entrada}{p.atraso ? <small className="ms-1">(+{p.atraso} min)</small> : null}</span> : '—'), alinhar: 'center' },
    { chave: 'saida', titulo: 'Saída', valor: (p) => p.saida ?? '', mostrar: (p) => (p.saida ? <span className={p.saidaAntecipada ? 'text-warning fw-bold' : 'fw-semibold'}>{p.saida}</span> : '—'), alinhar: 'center' },
    { chave: 'horas', titulo: 'Horas', valor: (p) => horas(p.minutosTrabalho), alinhar: 'center' },
    { chave: 'estado', titulo: 'Estado', valor: (p) => ESTADOS[p.estado][0], mostrar: (p) => <span className={`badge ${ESTADOS[p.estado][1]}`}>{ESTADOS[p.estado][0]}</span> },
    { chave: 'marcacoes', titulo: 'Marcações', valor: (p) => p.marcacoes.map((m) => m.hora).join(' '), mostrar: (p) => <span className="d-flex flex-wrap gap-1">{p.marcacoes.map((m) => <span key={m.id} className={`badge border ${m.origem === 'manual' ? 'bg-warning-subtle text-dark' : 'bg-light text-dark'}`} title={m.origem === 'manual' ? `Manual: ${m.justificacao}` : `${m.verificacao === 'digital' ? 'Impressão digital' : m.verificacao} · ${m.aparelho}`}><i className={`fa ${m.origem === 'manual' ? 'fa-pen' : m.tipo === 'entrada' ? 'fa-sign-in-alt' : 'fa-sign-out-alt'} me-1`} />{m.hora}</span>)}</span> },
    { chave: 'digitais', titulo: 'Digitais', valor: (p) => p.digitais, alinhar: 'center', mostrar: (p) => (p.digitais ? <span className="text-success"><i className="fa fa-fingerprint me-1" />{p.digitais}</span> : <span className="badge bg-light text-danger border" title="Ainda sem impressão digital no aparelho">por registar</span>) },
    { chave: 'categoria', titulo: 'Categoria', valor: (p) => p.categoria, oculta: true },
    { chave: 'unidade', titulo: 'Unidade', valor: (p) => p.unidadeNome, oculta: true },
  ]

  const r = l.resumo
  return (
    <>
      <div className="pes-filtros bg-white rounded mb-3 border">
        <div className="input-group input-group-sm" style={{ width: 'auto' }}>
          <button type="button" className="btn btn-white" aria-label="Dia anterior" onClick={() => setData(new Date(new Date(`${data}T12:00:00Z`).getTime() - 86_400_000).toISOString().slice(0, 10))}><i className="fa fa-chevron-left" /></button>
          <input type="date" className="form-control form-control-sm" value={data} max={l.hoje} onChange={(e) => e.target.value && setData(e.target.value)} aria-label="Dia" />
          <button type="button" className="btn btn-white" aria-label="Dia seguinte" disabled={data >= l.hoje} onClick={() => setData(new Date(new Date(`${data}T12:00:00Z`).getTime() + 86_400_000).toISOString().slice(0, 10))}><i className="fa fa-chevron-right" /></button>
        </div>
        {data !== l.hoje && <button type="button" className="btn btn-sm btn-link text-decoration-none" onClick={() => setData(l.hoje)}>Hoje</button>}
        <span className="text-muted small text-capitalize">{dataPt(l.data)}</span>
        <span className={`badge ${l.aparelhos.ligados ? 'bg-success' : 'bg-secondary'} ms-auto`} title="Aparelhos aprovados com contacto nos últimos 5 minutos">
          <i className="fa fa-fingerprint me-1" />{l.aparelhos.aprovados ? `${l.aparelhos.ligados} de ${l.aparelhos.aprovados} aparelho(s) ligado(s)` : 'Sem aparelhos'}
        </span>
        {pode('editar') && <button type="button" className="btn btn-sm btn-white" onClick={() => setManual({})}><i className="fa fa-pen me-1" />Marcação manual</button>}
        {pode('editar') && passado && !l.descanso && r.semMarcacao > 0 && <button type="button" className="btn btn-sm btn-outline-danger" disabled={aFechar} onClick={fecharDia}><i className="fa fa-lock me-1" />Fechar o dia ({r.semMarcacao} falta{r.semMarcacao === 1 ? '' : 's'})</button>}
        <button type="button" className="btn btn-sm btn-theme" onClick={imprimir}><i className="fa fa-print me-1" />Imprimir o livro</button>
      </div>

      <div className="row g-3 mb-3">
        {[['Na unidade agora', r.dentro, 'fa-building', 'success'], ['Vieram', `${r.vieram} de ${r.total}`, 'fa-user-check', 'primary'], ['Atrasos', r.atrasos, 'fa-clock', 'danger'], ['Sem marcação', l.descanso ? '—' : r.semMarcacao, 'fa-user-times', 'warning'], ['Licença ou falta', r.ausentes, 'fa-user-clock', 'info']].map(([t, v, i, c]) => (
          <div key={t} className="col-6 col-md">
            <div className={`pes-ponto-cartao border-${c}`}><i className={`fa ${i} text-${c}`} /><div><div className="pes-ponto-numero">{v}</div><div className="small text-muted">{t}</div></div></div>
          </div>
        ))}
      </div>

      {!l.aparelhos.aprovados && <div className="alert alert-info py-2"><i className="fa fa-info-circle me-2" />Ainda não há aparelhos de impressão digital. Quando chegarem, veja em <b>Aparelhos e horário</b> como os ligar; até lá, as marcações podem fazer-se à mão.</div>}

      <Painel titulo={`Pessoal civil (${r.total})`} icone="fa-fingerprint" corpo={false}>
        <div className="pes-filtros-tabela">
          <Tabela titulo={`Livro de ponto ${l.data}`} colunas={colunas} linhas={l.pessoas} aoClicar={setVer} dica="Pesquisar: nome, n.º, categoria, estado…" vazio="Não há pessoal civil no activo." />
        </div>
      </Painel>
      {ver && <VerPessoa p={l.pessoas.find((x) => x.id === ver.id) ?? ver} data={l.data} aoFechar={() => setVer(null)} aoMarcar={() => { setManual(ver); setVer(null) }} recarregar={recarregar} />}
      {manual && <MarcacaoManual pessoas={l.pessoas} pessoa={manual.id ? manual : null} data={l.data} hoje={l.hoje} aoFechar={() => setManual(null)} aoGuardar={() => { setManual(null); recarregar() }} />}
    </>
  )
}

const observacoes = (p) => [
  p.atraso && `atraso ${p.atraso} min`, p.saidaAntecipada && `saída ${p.saidaAntecipada} min antes`,
  p.marcacoes.some((m) => m.origem === 'manual') && 'manual', ['licenca', 'falta', 'sem_marcacao'].includes(p.estado) && ESTADOS[p.estado][0],
].filter(Boolean).join('; ')

function VerPessoa({ p, data, aoFechar, aoMarcar, recarregar }) {
  const { pode, avisar } = useSessao()
  const { dados: aparelhos } = useDados('/ponto/aparelhos')
  const aprovados = (aparelhos ?? []).filter((a) => a.aprovado)
  const [aparelho, setAparelho] = useState('')
  const [dedo, setDedo] = useState('6')
  async function apagar(m) {
    if (!window.confirm(`Apagar a marcação manual das ${m.hora}?`)) return
    try { await api(`/ponto/marcacoes/${m.id}`, { metodo: 'DELETE' }); recarregar() } catch (e) { avisar(e.message, 'erro') }
  }
  async function registarDigital() {
    try {
      await api(`/ponto/aparelhos/${aparelho || aprovados[0].id}/digital`, { metodo: 'POST', corpo: { pessoaId: p.id, dedo: Number(dedo) } })
      avisar(`Pedido enviado ao aparelho: ${p.nome} põe o dedo (${DEDOS[dedo].toLowerCase()}) no aparelho, três vezes.`)
    } catch (e) {
      avisar(e.message, 'erro')
    }
  }
  return (
    <Modal titulo={p.nome} aoFechar={aoFechar} rodape={<>{pode('editar') && <button type="button" className="btn btn-white" onClick={aoMarcar}><i className="fa fa-pen me-1" />Marcação manual</button>}<button type="button" className="btn btn-theme" onClick={aoFechar}>Fechar</button></>}>
      <div className="d-flex gap-3 align-items-center mb-3">
        <Foto pessoaId={p.id} fotoId={p.fotoId} nome={p.nome} />
        <div><div className="fw-bold">{p.categoria || '—'}</div><div className="small text-muted">N.º no aparelho: <b>{p.numeroAparelho}</b>{p.numeroAgente ? ` · agente ${p.numeroAgente}` : ''}</div></div>
        <span className={`badge ms-auto ${ESTADOS[p.estado][1]}`}>{ESTADOS[p.estado][0]}</span>
      </div>
      <h6 className="text-capitalize">{dataPt(data)}</h6>
      {p.marcacoes.length ? (
        <ul className="list-group mb-3">
          {p.marcacoes.map((m) => (
            <li key={m.id} className="list-group-item d-flex align-items-center gap-2">
              <i className={`fa ${m.tipo === 'entrada' ? 'fa-sign-in-alt text-success' : 'fa-sign-out-alt text-secondary'}`} />
              <strong>{m.hora}</strong><span>{m.tipo === 'entrada' ? 'Entrada' : 'Saída'}</span>
              <span className="small text-muted ms-2">{m.origem === 'manual' ? `manual (${m.criadoPor}): ${m.justificacao}` : `${m.verificacao === 'digital' ? 'impressão digital' : m.verificacao} · ${m.aparelho}`}</span>
              {m.origem === 'manual' && pode('administrar') && <button type="button" className="btn btn-xs btn-outline-danger ms-auto" onClick={() => apagar(m)} aria-label="Apagar"><i className="fa fa-trash" /></button>}
            </li>
          ))}
        </ul>
      ) : <p className="text-muted">Sem marcações neste dia.</p>}
      <h6><i className="fa fa-fingerprint me-1" />Impressões digitais: {p.digitais || 'nenhuma'}</h6>
      {pode('editar') && (aprovados.length ? (
        <div className="d-flex flex-wrap gap-2 align-items-end">
          {aprovados.length > 1 && <Campo rotulo="Aparelho" col=""><Escolha valor={aparelho} aoMudar={setAparelho} opcoes={aprovados.map((a) => [String(a.id), a.nome])} vazio={null} /></Campo>}
          <Campo rotulo="Dedo" col=""><Escolha valor={dedo} aoMudar={setDedo} opcoes={DEDOS.map((d, i) => [String(i), d])} vazio={null} /></Campo>
          <button type="button" className="btn btn-sm btn-outline-theme mb-2" onClick={registarDigital}><i className="fa fa-fingerprint me-1" />Registar digital no aparelho</button>
          <div className="small text-muted w-100">Também se regista no próprio aparelho: Menu › Utilizadores › n.º {p.numeroAparelho} › Impressão digital.</div>
        </div>
      ) : <p className="small text-muted mb-0">Ligue e aprove um aparelho para registar as digitais.</p>)}
    </Modal>
  )
}

function MarcacaoManual({ pessoas, pessoa, data, hoje, aoFechar, aoGuardar }) {
  const { avisar } = useSessao()
  const [d, setD] = useState(() => ({ pessoaId: pessoa ? String(pessoa.id) : '', data, hora: data === hoje ? new Date(Date.now() + 3_600_000).toISOString().slice(11, 16) : '08:00', justificacao: '' }))
  const [erro, setErro] = useState('')
  async function guardar(e) {
    e.preventDefault()
    try {
      await api('/ponto/marcacoes', { metodo: 'POST', corpo: { ...d, pessoaId: Number(d.pessoaId) } })
      avisar('Marcação registada.')
      aoGuardar()
    } catch (x) {
      setErro(x.message)
    }
  }
  return (
    <Modal titulo="Marcação manual" aoFechar={aoFechar} rodape={<><button type="button" className="btn btn-white" onClick={aoFechar}>Cancelar</button><button type="submit" form="marcacao-manual" className="btn btn-theme"><i className="fa fa-save me-1" />Registar</button></>}>
      <form id="marcacao-manual" onSubmit={guardar}>
        {erro && <div className="alert alert-danger py-2">{erro}</div>}
        <p className="small text-muted">Para quando o aparelho não leu o dedo ou estava desligado. Fica com o seu nome e a justificação, na auditoria.</p>
        <div className="row gx-3">
          <Campo rotulo="Pessoa" obrigatorio col="col-12"><Escolha valor={d.pessoaId} aoMudar={(v) => setD({ ...d, pessoaId: v })} opcoes={pessoas.map((p) => [String(p.id), `${p.nome} (n.º ${p.numeroAparelho})`])} vazio="Escolha" required aria-label="Pessoa" /></Campo>
          <Campo rotulo="Dia" obrigatorio col="col-6"><input type="date" className="form-control form-control-sm" max={hoje} value={d.data} onChange={(e) => setD({ ...d, data: e.target.value })} required /></Campo>
          <Campo rotulo="Hora" obrigatorio col="col-6"><input type="time" className="form-control form-control-sm" value={d.hora} onChange={(e) => setD({ ...d, hora: e.target.value })} required /></Campo>
          <Campo rotulo="Justificação" obrigatorio col="col-12"><input className="form-control form-control-sm" value={d.justificacao} onChange={(e) => setD({ ...d, justificacao: e.target.value })} minLength={5} maxLength={300} required placeholder="ex.: o aparelho não leu o dedo" /></Campo>
        </div>
      </form>
    </Modal>
  )
}

function Mes() {
  const [mes, setMes] = useState(() => hojeLuanda().slice(0, 7))
  const { dados: m, erro, recarregar } = useDados('/ponto/mes', { mes }, { tempoReal: true })
  if (erro) return <Erro texto={erro} aoRepetir={recarregar} />
  const colunas = [
    { chave: 'nome', titulo: 'Nome', valor: (p) => p.nome, mostrar: (p) => <span><strong>{p.nome}</strong><div className="small text-muted">{p.categoria || '—'}</div></span> },
    { chave: 'dias', titulo: 'Dias presente', valor: (p) => p.diasPresente, alinhar: 'center' },
    { chave: 'atrasos', titulo: 'Atrasos', valor: (p) => p.atrasos, alinhar: 'center', mostrar: (p) => (p.atrasos ? <span className="text-danger fw-bold">{p.atrasos} <small>({p.minutosAtraso} min)</small></span> : 0) },
    { chave: 'horas', titulo: 'Horas', valor: (p) => p.horas, alinhar: 'center' },
    { chave: 'sem', titulo: 'Dias sem marcação', valor: (p) => p.semMarcacao, alinhar: 'center', mostrar: (p) => (p.semMarcacao ? <span className="badge bg-warning text-dark">{p.semMarcacao}</span> : 0) },
    { chave: 'ausencias', titulo: 'Licença ou falta', valor: (p) => p.ausencias, alinhar: 'center' },
    { chave: 'categoria', titulo: 'Categoria', valor: (p) => p.categoria, oculta: true },
  ]
  return (
    <Painel titulo={m ? `Resumo do mês (${m.diasUteis} dia(s) úteis até hoje · horário ${m.horario.entrada}–${m.horario.saida})` : 'Resumo do mês'} icone="fa-calendar-alt" corpo={false}>
      <div className="pes-filtros">
        <input type="month" className="form-control form-control-sm" style={{ width: 'auto' }} value={mes} onChange={(e) => e.target.value && setMes(e.target.value)} aria-label="Mês" />
        <span className="small text-muted">«Dias sem marcação»: dias úteis sem entrada no aparelho nem licença ou falta registada.</span>
      </div>
      <div className="pes-filtros-tabela">
        {!m ? <Carregando /> : <Tabela titulo={`Ponto ${mes}`} colunas={colunas} linhas={m.pessoas} vazio="Não há pessoal civil no activo." />}
      </div>
    </Painel>
  )
}

function Aparelhos() {
  const { pode, avisar } = useSessao()
  const { dados: l, erro, recarregar } = useDados('/ponto/aparelhos', {}, { tempoReal: true })
  const { dados: h, recarregar: recarregarHorario } = useDados('/ponto/horario')
  const [editar, setEditar] = useState(null)
  const admin = pode('administrar')
  const endereco = window.location.hostname
  const fazer = async (fn, ok) => { try { const r = await fn(); if (ok) avisar(ok(r)); recarregar() } catch (e) { avisar(e.message, 'erro') } }
  if (erro) return <Erro texto={erro} aoRepetir={recarregar} />
  if (!l) return <Carregando />
  return (
    <div className="row g-3">
      <div className="col-lg-8">
        {!l.length && <div className="alert alert-info"><i className="fa fa-plug me-2" />Nenhum aparelho se apresentou ainda. Siga os passos ao lado: assim que o aparelho tiver o endereço do servidor, aparece aqui sozinho para aprovar.</div>}
        {l.map((a) => (
          <div key={a.id} className={`pes-aparelho ${a.aprovado ? '' : 'pes-aparelho-novo'}`}>
            <div className="d-flex flex-wrap align-items-start gap-2">
              <i className="fa fa-fingerprint fa-2x text-theme" />
              <div className="me-auto">
                <div className="fw-bold">{a.nome || a.numeroSerie} {a.local && <span className="text-muted fw-normal">· {a.local}</span>}</div>
                <div className="small text-muted">N.º de série {a.numeroSerie}{a.modelo ? ` · ${a.modelo}` : ''}{a.ip ? ` · ${a.ip}` : ''}</div>
              </div>
              {!a.aprovado ? <span className="badge bg-warning text-dark">Por aprovar</span> : a.ligado ? <span className="badge bg-success">Ligado</span> : <span className="badge bg-secondary">Sem contacto</span>}
            </div>
            <div className="d-flex flex-wrap gap-3 small my-2">
              <span><i className="fa fa-clock me-1 text-muted" />Último contacto: {a.ultimoContacto ? new Date(a.ultimoContacto).toLocaleString('pt-PT') : '—'}</span>
              <span><i className="fa fa-list me-1 text-muted" />{a.marcacoes} marcação(ões)</span>
              <span><i className="fa fa-fingerprint me-1 text-muted" />{a.digitais} digital(is)</span>
              {a.ordensPendentes > 0 && <span className="text-warning"><i className="fa fa-hourglass-half me-1" />{a.ordensPendentes} ordem(ns) à espera do aparelho</span>}
            </div>
            <div className="d-flex flex-wrap gap-2">
              {admin && !a.aprovado && <button type="button" className="btn btn-sm btn-success" onClick={() => fazer(() => api(`/ponto/aparelhos/${a.id}`, { metodo: 'PUT', corpo: { aprovado: true } }), () => 'Aparelho aprovado: vai receber a lista do pessoal civil. Depois, registe as digitais.')}><i className="fa fa-check me-1" />Aprovar</button>}
              {pode('editar') && a.aprovado && <button type="button" className="btn btn-sm btn-white" onClick={() => fazer(() => api(`/ponto/aparelhos/${a.id}/enviar-pessoal`, { metodo: 'POST' }), (r) => `Lista enviada: ${r.pessoas} pessoa(s)${r.removidas ? `; ${r.removidas} que saíram retiradas` : ''}.`)}><i className="fa fa-users me-1" />Enviar a lista do pessoal</button>}
              {admin && <button type="button" className="btn btn-sm btn-white" onClick={() => setEditar(a)}><i className="fa fa-pen me-1" />Nome e local</button>}
              {admin && a.aprovado && <button type="button" className="btn btn-sm btn-white" onClick={() => window.confirm('Suspender este aparelho? As marcações dele deixam de contar até o aprovar de novo.') && fazer(() => api(`/ponto/aparelhos/${a.id}`, { metodo: 'PUT', corpo: { aprovado: false } }))}><i className="fa fa-pause me-1" />Suspender</button>}
              {admin && <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => window.confirm('Retirar este aparelho? As marcações que já enviou ficam no livro.') && fazer(() => api(`/ponto/aparelhos/${a.id}`, { metodo: 'DELETE' }))}><i className="fa fa-trash" /></button>}
            </div>
          </div>
        ))}
      </div>
      <div className="col-lg-4">
        <Painel titulo="Ligar um aparelho" icone="fa-plug">
          <ol className="small ps-3 mb-2">
            <li className="mb-1">Ligue o aparelho à corrente e à rede da Escola (cabo ou Wi-Fi).</li>
            <li className="mb-1">No aparelho: <b>Menu › Comunicação › Servidor na nuvem</b> (ou «ADMS»). Endereço do servidor: <code>{endereco}</code>, porta <code>8085</code>; «Servidor proxy»: não.</li>
            <li className="mb-1">Ponha a <b>data e hora</b> certas (Luanda) e o fuso <b>UTC+1</b>.</li>
            <li className="mb-1">O aparelho aparece aqui «Por aprovar». Carregue em <b>Aprovar</b>: recebe a lista do pessoal civil (cada um com o n.º do aparelho).</li>
            <li>Registe as digitais: no aparelho (Menu › Utilizadores › n.º › Impressão digital) ou aqui, no livro do dia, clicando na pessoa.</li>
          </ol>
          <div className="small text-muted">Funciona com aparelhos ZKTeco e compatíveis com o protocolo «push» (ADMS/iclock). As impressões digitais ficam só no aparelho; o sistema guarda as horas de entrada e saída.</div>
        </Painel>
        {h && <Horario h={h} pode={admin} aoMudar={recarregarHorario} />}
      </div>
      {editar && <EditarAparelho a={editar} aoFechar={() => setEditar(null)} aoGuardar={() => { setEditar(null); recarregar() }} />}
    </div>
  )
}

function Horario({ h, pode, aoMudar }) {
  const { avisar } = useSessao()
  const [d, setD] = useState(h)
  async function guardar(e) {
    e.preventDefault()
    try {
      await api('/ponto/horario', { metodo: 'PUT', corpo: { ...d, tolerancia: Number(d.tolerancia) } })
      avisar('Horário guardado.')
      aoMudar()
    } catch (x) {
      avisar(x.message, 'erro')
    }
  }
  return (
    <Painel titulo="Horário de trabalho" icone="fa-clock">
      <form onSubmit={guardar} className="row gx-2">
        <Campo rotulo="Entrada" col="col-4"><input type="time" className="form-control form-control-sm" value={d.entrada} disabled={!pode} onChange={(e) => setD({ ...d, entrada: e.target.value })} /></Campo>
        <Campo rotulo="Saída" col="col-4"><input type="time" className="form-control form-control-sm" value={d.saida} disabled={!pode} onChange={(e) => setD({ ...d, saida: e.target.value })} /></Campo>
        <Campo rotulo="Tolerância (min)" col="col-4"><input type="number" min={0} max={120} className="form-control form-control-sm" value={d.tolerancia} disabled={!pode} onChange={(e) => setD({ ...d, tolerancia: e.target.value })} /></Campo>
        <div className="col-12 small text-muted mb-2">Atraso: entrada depois da hora de entrada mais a tolerância. De segunda a sexta-feira.</div>
        {pode && <div className="col-12"><button type="submit" className="btn btn-sm btn-theme"><i className="fa fa-save me-1" />Guardar</button></div>}
      </form>
    </Painel>
  )
}

function EditarAparelho({ a, aoFechar, aoGuardar }) {
  const { avisar } = useSessao()
  const [d, setD] = useState({ nome: a.nome, local: a.local })
  async function guardar(e) {
    e.preventDefault()
    try { await api(`/ponto/aparelhos/${a.id}`, { metodo: 'PUT', corpo: d }); aoGuardar() } catch (x) { avisar(x.message, 'erro') }
  }
  return (
    <Modal titulo={`Aparelho ${a.numeroSerie}`} aoFechar={aoFechar} rodape={<><button type="button" className="btn btn-white" onClick={aoFechar}>Cancelar</button><button type="submit" form="editar-aparelho" className="btn btn-theme">Guardar</button></>}>
      <form id="editar-aparelho" onSubmit={guardar} className="row gx-3">
        <Campo rotulo="Nome" col="col-12"><input className="form-control form-control-sm" value={d.nome} maxLength={80} onChange={(e) => setD({ ...d, nome: e.target.value })} placeholder="ex.: Portão principal" /></Campo>
        <Campo rotulo="Local" col="col-12"><input className="form-control form-control-sm" value={d.local} maxLength={120} onChange={(e) => setD({ ...d, local: e.target.value })} placeholder="ex.: Entrada do edifício do Comando" /></Campo>
      </form>
    </Modal>
  )
}
