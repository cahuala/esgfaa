import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../api'
import { useSessao } from '../sessaoContexto'
import { Aviso, Confirmar, Erro } from '../componentes/Ui'
import { localAtual, t as tx } from '../../i18n/linguas'
import './centroSeguranca.css'

const ATUALIZAR_MS = 10_000
const NIVEIS = {
  normal: { cor: 'verde', icone: 'fa-shield-alt', titulo: tx('Tudo normal'), texto: tx('Não há sinais de ataque nos últimos 5 minutos.') },
  atencao: { cor: 'amarelo', icone: 'fa-exclamation-triangle', titulo: tx('Atenção'), texto: tx('Há atividade suspeita nos últimos 5 minutos. Veja quem é, em baixo.') },
  ataque: { cor: 'vermelho', icone: 'fa-radiation', titulo: tx('Possível ataque'), texto: tx('Muita atividade hostil nos últimos 5 minutos. Os bloqueios estão a funcionar; veja os endereços e bloqueie se for preciso.') },
}
const GRAVES = ['injecao', 'injecao_corpo', 'sondagem', 'conta_bloqueada', 'ip_bloqueado', 'phishing', 'ferramenta_ataque', 'injecao_ia']
const TIPOS_GRAFICO = ['login_falhado', 'limite', 'acesso_negado', 'sondagem', 'injecao', 'injecao_corpo', 'phishing', 'ferramenta_ataque', 'robo_ia', 'injecao_ia', 'erro_interno']

const bytes = (n) => (n >= 1e9 ? `${(n / 1e9).toFixed(1)} GB` : `${Math.round(n / 1e6)} MB`)
const hora = (iso) => new Date(iso).toLocaleTimeString(localAtual(), { hour: '2-digit', minute: '2-digit', second: '2-digit' })
function duracao(desde) {
  const s = Math.floor((Date.now() - new Date(desde).getTime()) / 1000)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  return d ? tx('{0} d {1} h', { 0: d, 1: h }) : h ? tx('{0} h {1} min', { 0: h, 1: m }) : tx('{0} min', { 0: m })
}

// um apito curto (Web Audio), para o modo de vigilância chamar a atenção
function apitar() {
  try {
    const c = new (window.AudioContext || window.webkitAudioContext)()
    const o = c.createOscillator()
    const g = c.createGain()
    o.type = 'square'
    o.frequency.value = 880
    g.gain.value = 0.08
    o.connect(g).connect(c.destination)
    o.start()
    o.stop(c.currentTime + 0.35)
  } catch { /* sem som neste navegador */ }
}

function Barra({ valor, maximo = 100, alto = 80, muitoAlto = 92 }) {
  const p = Math.min(100, Math.round((valor / maximo) * 100))
  return <div className="cs-barra"><span className={p >= muitoAlto ? 'mau' : p >= alto ? 'medio' : ''} style={{ width: `${p}%` }} /></div>
}

// pedidos por minuto (barras) e eventos suspeitos (em cima, a vermelho) na última hora
function GraficoHora({ serie }) {
  const max = Math.max(1, ...serie.map((s) => s.pedidos))
  const maxEv = Math.max(1, ...serie.map((s) => s.eventos))
  const L = 600
  const A = 120
  const w = L / serie.length
  return (
    <svg className="cs-grafico" viewBox={`0 0 ${L} ${A + 20}`} role="img" aria-label={tx('Pedidos e eventos suspeitos por minuto, na última hora')}>
      {serie.map((s, i) => {
        const h = (s.pedidos / max) * A
        const he = (s.eventos / maxEv) * (A * 0.5)
        return (
          <g key={s.minuto}>
            <rect x={i * w + 1} y={A - h} width={w - 2} height={h} className="cs-g-pedidos"><title>{`${hora(s.minuto).slice(0, 5)} · ${s.pedidos} ${tx('pedidos')} · ${s.mediaMs} ms`}</title></rect>
            {s.eventos > 0 && <rect x={i * w + 1} y={A - he} width={w - 2} height={he} className="cs-g-eventos"><title>{`${hora(s.minuto).slice(0, 5)} · ${s.eventos} ${tx('eventos suspeitos')}`}</title></rect>}
          </g>
        )
      })}
      <text x="0" y={A + 16} className="cs-g-rotulo">{tx('há 60 min')}</text>
      <text x={L} y={A + 16} textAnchor="end" className="cs-g-rotulo">{tx('agora')}</text>
    </svg>
  )
}

// eventos por hora nas últimas 24 horas, por tipo
function Grafico24h({ porHora, tipos }) {
  const horas = []
  const agora = new Date()
  agora.setMinutes(0, 0, 0)
  for (let i = 23; i >= 0; i--) horas.push(new Date(agora.getTime() - i * 3_600_000).toISOString())
  const de = {}
  for (const x of porHora) (de[x.hora] ||= {})[x.tipo] = x.n
  const totais = horas.map((h) => TIPOS_GRAFICO.reduce((a, t) => a + (de[h]?.[t] || 0), 0))
  const max = Math.max(1, ...totais)
  const L = 600
  const A = 120
  const w = L / 24
  return (
    <>
      <svg className="cs-grafico" viewBox={`0 0 ${L} ${A + 20}`} role="img" aria-label={tx('Eventos suspeitos por hora, nas últimas 24 horas')}>
        {horas.map((h, i) => {
          let y = A
          return (
            <g key={h}>
              {TIPOS_GRAFICO.map((t) => {
                const n = de[h]?.[t] || 0
                if (!n) return null
                const alt = (n / max) * A
                y -= alt
                return <rect key={t} x={i * w + 2} y={y} width={w - 4} height={alt} className={`cs-t-${t}`}><title>{`${new Date(h).getHours()}h · ${tipos[t]}: ${n}`}</title></rect>
              })}
            </g>
          )
        })}
        <text x="0" y={A + 16} className="cs-g-rotulo">{tx('há 24 h')}</text>
        <text x={L} y={A + 16} textAnchor="end" className="cs-g-rotulo">{tx('agora')}</text>
      </svg>
      <div className="cs-legenda">{TIPOS_GRAFICO.map((t) => <span key={t}><i className={`cs-t-${t}`} />{tipos[t]}</span>)}</div>
    </>
  )
}

const COR_NIVEL = { normal: 'success', reforcado: 'warning', emergencia: 'danger', isolamento: 'dark' }
const ICONE_NIVEL = { normal: 'fa-shield-alt', reforcado: 'fa-user-shield', emergencia: 'fa-exclamation-triangle', isolamento: 'fa-power-off' }

/*
  Defesa activa: o nível de protecção (normal, reforçado, emergência, isolamento), os serviços que se
  desligam um a um, a defesa automática (sobe de nível sozinha durante um ataque e volta ao normal) e a
  lista de endereços de confiança (a rede da Escola: nunca bloqueada nem fechada).
*/
function DefesaActiva({ p, regras, gerir, aoMudar, pedirConfirmacao }) {
  const [confianca, setConfianca] = useState(p.confianca.join('\n'))
  const [motivo, setMotivo] = useState('')
  const mudar = (corpo, ok) => aoMudar({ ...corpo, motivo }, ok)
  const escolherNivel = (k) => {
    if (k === p.nivel) return
    const grave = k === 'emergencia' || k === 'isolamento'
    const fazer = () => mudar({ nivel: k }, tx('Nível de protecção: {0}.', { 0: p.niveis[k].nome }))
    if (!grave) return fazer()
    pedirConfirmacao({ titulo: tx('Mudar para {0}', { 0: p.niveis[k].nome }), texto: `${p.niveis[k].descricao} ${tx('Pode voltar ao normal aqui mesmo, a qualquer momento.')}`, botao: tx('Mudar agora'), perigo: true, confirmar: fazer })
  }
  const r = regras.porNivel[p.nivel]
  return (
    <div className={`cs-cartao cs-defesa border-${COR_NIVEL[p.nivel]}`}>
      <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
        <span className="cs-rotulo mb-0"><i className="fa fa-shield-virus me-1" />{tx('Defesa activa')}</span>
        <span className={`badge bg-${COR_NIVEL[p.nivel]} fs-6`}><i className={`fa ${ICONE_NIVEL[p.nivel]} me-1`} />{p.niveis[p.nivel].nome}</span>
        {p.automaticoDesde && <span className="badge bg-light text-dark border">{tx('subido pela defesa automática')}</span>}
        {gerir && p.nivel !== 'isolamento' && <button type="button" className="btn btn-sm btn-danger ms-auto" onClick={() => escolherNivel('isolamento')}><i className="fa fa-power-off me-1" />{tx('Desligar tudo agora')}</button>}
        {gerir && p.nivel !== 'normal' && <button type="button" className={`btn btn-sm btn-success ${p.nivel === 'isolamento' ? 'ms-auto' : ''}`} onClick={() => escolherNivel('normal')}><i className="fa fa-undo me-1" />{tx('Voltar ao normal')}</button>}
      </div>
      <p className="small mb-2">{p.niveis[p.nivel].descricao}{p.alteradoEm && <span className="cs-nota" translate="no"> · {tx('mudado por {0} às {1}', { 0: p.alteradoPor || '—', 1: new Date(p.alteradoEm).toLocaleString(localAtual(), { dateStyle: 'short', timeStyle: 'short' }) })}{p.motivo && ` · ${p.motivo}`}</span>}</p>
      <div className="cs-niveis">
        {Object.entries(p.niveis).map(([k, v]) => (
          <button key={k} type="button" disabled={!gerir} className={`btn btn-sm ${k === p.nivel ? `btn-${COR_NIVEL[k]}` : `btn-outline-${COR_NIVEL[k]}`}`} onClick={() => escolherNivel(k)} title={v.descricao} aria-pressed={k === p.nivel}>
            <i className={`fa ${ICONE_NIVEL[k]} me-1`} />{v.nome}
          </button>
        ))}
      </div>
      {/* já traduzido aqui (com os números): a tradução automática dos dados não lhe toca */}
      <p className="small cs-nota mt-2 mb-2" translate="no">{tx('Bloqueio automático neste nível, por endereço em 5 minutos: {0} procuras de falhas, {1} injeção(ões){2}; bloqueado {3} horas.', { 0: r.sondagem, 1: r.injecao, 2: r.login_falhado ? tx(' ou {0} palavras-passe erradas', { 0: r.login_falhado }) : '', 3: r.horas })}</p>
      <div className="form-check form-switch mb-1">
        <input className="form-check-input" type="checkbox" id="cs-robos" checked={Boolean(p.bloquearRobosIA)} disabled={!gerir} onChange={(e) => mudar({ bloquearRobosIA: e.target.checked }, e.target.checked ? tx('Robôs de IA bloqueados no site.') : tx('Robôs de IA deixados ler o site.'))} />
        <label className="form-check-label small" htmlFor="cs-robos"><b>{tx('Bloquear robôs de IA no site')}</b> — {tx('GPTBot, ClaudeBot, PerplexityBot, Bytespider… (no painel e no portal já estão sempre bloqueados).')}</label>
      </div>
      <div className="form-check form-switch mb-2">
        <input className="form-check-input" type="checkbox" id="cs-auto" checked={p.automatico} disabled={!gerir} onChange={(e) => mudar({ automatico: e.target.checked }, e.target.checked ? tx('Defesa automática ligada.') : tx('Defesa automática desligada.'))} />
        <label className="form-check-label small" htmlFor="cs-auto"><b>{tx('Defesa automática')}</b> — {tx('num ataque sobe para «Reforçado»; se continuar mais de 10 minutos, para «Emergência»; volta ao normal após 30 minutos sem ataque (com aviso por e-mail).')}</label>
      </div>
      <span className="cs-rotulo">{tx('Serviços')}</span>
      <table className="cs-tabela mb-2">
        <tbody>
          {Object.entries(p.servicos).map(([k, v]) => {
            const peloNivel = p.niveis[p.nivel].desliga.includes(k)
            const fechado = p.fechados.includes(k)
            return (
              <tr key={k}>
                <td><b>{v.nome}</b><div className="cs-nota">{v.descricao}</div></td>
                <td className="text-nowrap text-end">
                  <span className={`badge ${fechado ? 'bg-danger' : 'bg-success'} me-2`}>{fechado ? (peloNivel ? tx('fechado pelo nível') : tx('desligado')) : tx('ligado')}</span>
                  {gerir && !peloNivel && <button type="button" className={`btn btn-xs ${fechado ? 'btn-success' : 'btn-outline-danger'}`} onClick={() => mudar({ desligados: fechado ? p.desligados.filter((x) => x !== k) : [...p.desligados, k] }, fechado ? tx('{0} ligado.', { 0: v.nome }) : tx('{0} desligado.', { 0: v.nome }))}>{fechado ? tx('Ligar') : tx('Desligar')}</button>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="small cs-nota">{tx('Ficam sempre abertos: a entrada no painel e este Centro de segurança (para poder voltar a ligar tudo). Com os conteúdos fechados, o site mostra os que traz consigo.')}</p>
      {gerir && (
        <div className="row g-2">
          <div className="col-md-7">
            <label className="cs-rotulo" htmlFor="cs-confianca">{tx('Endereços de confiança (um por linha)')}</label>
            <textarea id="cs-confianca" className="form-control form-control-sm font-monospace" rows={3} value={confianca} onChange={(e) => setConfianca(e.target.value)} placeholder={'10.0.0.0/8\n192.168.1.0/24'} />
            <div className="cs-nota small">{tx('A rede da Escola (IP ou rede /8, /16, /24): nunca é bloqueada nem fechada, mesmo no isolamento.')}</div>
            <button type="button" className="btn btn-sm btn-white mt-1" onClick={() => mudar({ confianca: confianca.split(/\s+/).filter(Boolean) }, tx('Lista de confiança guardada.'))}><i className="fa fa-save me-1" />{tx('Guardar lista')}</button>
          </div>
          <div className="col-md-5">
            <label className="cs-rotulo" htmlFor="cs-motivo">{tx('Motivo da mudança (fica no registo)')}</label>
            <input id="cs-motivo" className="form-control form-control-sm" maxLength={300} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder={tx('Ex.: ataque ao portal a partir de vários endereços')} />
          </div>
        </div>
      )}
    </div>
  )
}

/*
  Centro de segurança: a saúde do servidor, o tráfego, os ataques ao vivo e os bloqueios, atualizado de
  10 em 10 segundos. O "modo vigilância" ocupa o ecrã inteiro (para um ecrã de parede) e pode apitar
  quando o nível passa a "possível ataque".
*/
function CentroSeguranca() {
  const { pode } = useSessao()
  const gerir = pode('seguranca.gerir')
  const [d, setD] = useState(null)
  const [erro, setErro] = useState('')
  const [vigilancia, setVigilancia] = useState(false)
  const [som, setSom] = useState(false)
  const [aviso, setAviso] = useState(null)
  const [confirmar, setConfirmar] = useState(null)
  const [novoIp, setNovoIp] = useState({ ip: '', horas: 24, motivo: '' })
  const raiz = useRef(null)
  const nivelAnterior = useRef('normal')

  // os nomes dos tipos de evento vêm do servidor em português: passam pelo dicionário da interface
  const carregar = useCallback(() => api('/seguranca').then((r) => { setErro(''); setD({ ...r, tipos: Object.fromEntries(Object.entries(r.tipos || {}).map(([k, v]) => [k, tx(v)])) }) }).catch((e) => setErro(e.message)), [])
  useEffect(() => {
    carregar()
    const id = setInterval(carregar, ATUALIZAR_MS)
    return () => clearInterval(id)
  }, [carregar])

  // apita ao passar para "possível ataque" (só com o som ligado)
  useEffect(() => {
    if (!d) return
    if (som && d.alerta.nivel === 'ataque' && nivelAnterior.current !== 'ataque') { apitar(); setTimeout(apitar, 500) }
    nivelAnterior.current = d.alerta.nivel
  }, [d, som])

  useEffect(() => {
    const sair = () => { if (!document.fullscreenElement) setVigilancia(false) }
    document.addEventListener('fullscreenchange', sair)
    return () => document.removeEventListener('fullscreenchange', sair)
  }, [])

  function alternarVigilancia() {
    if (!vigilancia) { raiz.current?.requestFullscreen?.().catch(() => {}); setVigilancia(true) } else { if (document.fullscreenElement) document.exitFullscreen(); setVigilancia(false) }
  }

  async function bloquear(ip, horas = 24, motivo = '') {
    try {
      await api('/seguranca/bloqueios', { metodo: 'POST', corpo: { ip, horas: Number(horas), motivo } })
      setAviso({ texto: tx('{0} bloqueado.', { 0: ip }) })
      setNovoIp({ ip: '', horas: 24, motivo: '' })
      carregar()
    } catch (e) {
      setAviso({ tipo: 'erro', texto: e.message })
    }
  }
  const pedirBloqueio = (ip) => setConfirmar({
    titulo: tx('Bloquear endereço'), texto: tx('Bloquear {0} durante 24 horas? Deixa de conseguir usar o site, o portal e o painel. (Atenção: numa rede partilhada, como a da Escola, bloqueia todos os que a usam.)', { 0: ip }),
    botao: tx('Bloquear'), perigo: true, confirmar: () => { setConfirmar(null); bloquear(ip) },
  })
  async function mudarProtecao(corpo, ok) {
    try {
      await api('/seguranca/protecao', { metodo: 'PUT', corpo })
      setAviso({ texto: ok })
      carregar()
    } catch (e) {
      setAviso({ tipo: 'erro', texto: e.message })
    }
  }
  const pedirConfirmacao = ({ confirmar: fazer, ...resto }) => setConfirmar({ ...resto, confirmar: () => { setConfirmar(null); fazer() } })
  async function desbloquear(ip) {
    try { await api(`/seguranca/bloqueios/${encodeURIComponent(ip)}`, { metodo: 'DELETE' }); carregar() } catch (e) { setAviso({ tipo: 'erro', texto: e.message }) }
  }

  if (erro && !d) return <Erro texto={erro} onRepetir={carregar} />
  if (!d) return <div className="p-4 text-muted">{tx('A ligar ao servidor…')}</div>
  const n = NIVEIS[d.alerta.nivel]
  // os nomes e as descrições dos níveis e dos serviços vêm do servidor, em português: traduzem-se aqui
  const traduzir = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, { ...v, nome: tx(v.nome), descricao: tx(v.descricao) }]))
  const protecao = d.protecao && { ...d.protecao, niveis: traduzir(d.protecao.niveis), servicos: traduzir(d.protecao.servicos) }
  const s = d.saude
  // as sessões expiradas são normais: contam no resumo, mas não enchem o fluxo ao vivo
  const recentes = d.recentes.filter((e) => e.tipo !== 'sessao_invalida')
  const totalDia = Object.entries(d.dia).filter(([k]) => k !== 'sessao_invalida').reduce((a, [, v]) => a + v, 0)

  return (
    <div ref={raiz} className={`cs ${vigilancia ? 'cs-vigilancia' : ''}`}>
      <div className="cs-topo">
        <div>
          <h1 className="cs-titulo"><i className="fa fa-user-shield me-2" />{tx('Centro de segurança')}</h1>
          <span className="cs-sub">{erro ? <span className="text-danger"><i className="fa fa-plug me-1" />{tx('Sem ligação ao servidor desde {0}', { 0: hora(d.geradoEm) })}</span> : <><span className="cs-pulso" />{tx('Ao vivo · atualizado às {0}', { 0: hora(d.geradoEm) })}</>}</span>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          {gerir && !vigilancia && <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => setConfirmar({ titulo: tx('Simular um ataque'), texto: tx('Envia ataques inventados (força bruta, procura de falhas, injeções de SQL e XSS, phishing, uma ferramenta de ataque e robôs de IA) a partir de endereços de documentação, que não existem na internet. Vê o painel a encher-se e os bloqueios a funcionar; a defesa automática não muda o nível durante 5 minutos.'), botao: tx('Simular'), perigo: true, confirmar: () => { setConfirmar(null); api('/seguranca/simular', { metodo: 'POST' }).then(() => { setAviso({ texto: tx('Simulação feita: veja os eventos e os bloqueios.') }); carregar() }).catch((e) => setAviso({ tipo: 'erro', texto: e.message })) } })}><i className="fa fa-bug me-1" />{tx('Simular ataque')}</button>}
          <button type="button" className={`btn btn-sm ${som ? 'btn-warning' : 'btn-white'}`} onClick={() => { setSom(!som); if (!som) apitar() }} aria-pressed={som}><i className={`fa ${som ? 'fa-volume-up' : 'fa-volume-mute'} me-1`} />{som ? tx('Alarme sonoro ligado') : tx('Alarme sonoro')}</button>
          <button type="button" className="btn btn-sm btn-dark" onClick={alternarVigilancia}><i className={`fa ${vigilancia ? 'fa-compress' : 'fa-tv'} me-1`} />{vigilancia ? tx('Sair do modo vigilância') : tx('Modo vigilância (ecrã inteiro)')}</button>
        </div>
      </div>

      <div className={`cs-estado cs-${n.cor}`} role="status">
        <i className={`fa ${n.icone}`} />
        <div className="flex-grow-1">
          <b>{n.titulo}</b>
          <span>{n.texto}</span>
          {d.alerta.motivos.length > 0 && <div className="cs-motivos">{d.alerta.motivos.map((m) => <span key={m.tipo}>{d.tipos[m.tipo]}: <b>{m.n}</b></span>)}</div>}
        </div>
        <div className="cs-estado-lado small">
          {d.alerta.emailConfigurado ? <><i className="fa fa-envelope me-1" />{tx('Alertas por e-mail ligados')}</> : <><i className="fa fa-envelope-open me-1" />{tx('Alertas por e-mail desligados (defina SEGURANCA_EMAIL e SMTP_URL)')}</>}
          {d.alerta.ultimoAlerta && <div>{tx('Último alerta: {0}', { 0: hora(d.alerta.ultimoAlerta) })}</div>}
        </div>
      </div>

      {protecao && !vigilancia && <DefesaActiva key={protecao.confianca.join(',')} p={protecao} regras={d.regras} gerir={gerir} aoMudar={mudarProtecao} pedirConfirmacao={pedirConfirmacao} />}
      {protecao && vigilancia && protecao.nivel !== 'normal' && <div className={`alert alert-${COR_NIVEL[protecao.nivel]} mb-3`}><i className={`fa ${ICONE_NIVEL[protecao.nivel]} me-2`} /><b>{protecao.niveis[protecao.nivel].nome}</b> — {protecao.niveis[protecao.nivel].descricao}</div>}

      <div className="cs-grelha cs-4">
        <div className="cs-cartao">
          <span className="cs-rotulo"><i className="fa fa-server me-1" />{tx('Servidor')}</span>
          <b className="cs-valor text-success">{tx('Ligado')}</b>
          <small>{tx('há {0} · Node {1}', { 0: duracao(s.ligadoDesde), 1: s.versaoNode })}</small>
          <small>{tx('Atraso do processo: {0} ms', { 0: s.atrasoMs })}</small>
        </div>
        <div className="cs-cartao">
          <span className="cs-rotulo"><i className="fa fa-database me-1" />{tx('Base de dados')}</span>
          <b className={`cs-valor ${s.baseDados.ligada ? 'text-success' : 'text-danger'}`}>{s.baseDados.ligada ? tx('Ligada') : tx('Sem ligação')}</b>
          <small>{s.baseDados.ligada ? tx('responde em {0} ms', { 0: s.baseDados.ms }) : tx('o sistema não está a conseguir guardar nem ler dados')}</small>
        </div>
        <div className="cs-cartao">
          <span className="cs-rotulo"><i className="fa fa-exchange-alt me-1" />{tx('Tráfego (5 min)')}</span>
          <b className="cs-valor">{tx('{0} pedidos/min', { 0: d.trafego.porMinuto })}</b>
          <small>{tx('resposta média {0} ms · 95 % abaixo de {1} ms', { 0: d.trafego.mediaMs, 1: d.trafego.p95Ms })}</small>
          <small className={d.trafego.erros ? 'text-danger' : ''}>{tx('{0} erro(s) do servidor', { 0: d.trafego.erros })}</small>
        </div>
        <div className="cs-cartao">
          <span className="cs-rotulo"><i className="fa fa-microchip me-1" />{tx('Recursos')}</span>
          <small>{tx('Processador {0} %', { 0: s.processador.carga })}</small><Barra valor={s.processador.carga} />
          <small>{tx('Memória da API {0} (dados {1} de {2})', { 0: bytes(s.memoria.processo), 1: bytes(s.memoria.heap), 2: bytes(s.memoria.limite) })}</small><Barra valor={s.memoria.heap} maximo={s.memoria.limite} alto={75} muitoAlto={90} />
          <small>{tx('Livre no computador: {0} de {1}', { 0: bytes(s.memoria.livre), 1: bytes(s.memoria.total) })}</small>
          {s.disco && <><small>{tx('Disco: {0} livres de {1}', { 0: bytes(s.disco.livre), 1: bytes(s.disco.total) })}</small><Barra valor={s.disco.total - s.disco.livre} maximo={s.disco.total} alto={85} muitoAlto={95} /></>}
        </div>
      </div>

      <div className="cs-grelha cs-2">
        <div className="cs-cartao">
          <span className="cs-rotulo">{tx('Última hora: pedidos por minuto (cinzento) e eventos suspeitos (vermelho)')}</span>
          <GraficoHora serie={d.serie} />
        </div>
        <div className="cs-cartao">
          <span className="cs-rotulo">{tx('Últimas 24 horas: eventos suspeitos por hora ({0})', { 0: totalDia })}</span>
          <Grafico24h porHora={d.porHora} tipos={d.tipos} />
        </div>
      </div>

      <div className="cs-grelha cs-2">
        <div className="cs-cartao cs-lista">
          <span className="cs-rotulo"><span className="cs-pulso" />{tx('Ao vivo: últimos eventos')}</span>
          {recentes.length === 0 ? <div className="cs-vazio">{tx('Sem eventos desde que o servidor arrancou.')}</div> : (
            <table className="cs-tabela">
              <tbody>
                {recentes.slice(0, vigilancia ? 18 : 12).map((e, i) => (
                  <tr key={`${e.quando}-${i}`} className={GRAVES.includes(e.tipo) ? 'grave' : ''}>
                    <td className="cs-hora">{hora(e.quando)}</td>
                    <td><span className={`cs-tipo cs-t-${e.tipo}`}>{d.tipos[e.tipo]}</span></td>
                    <td className="cs-ip">{e.ip}</td>
                    <td className="cs-exemplo">{e.exemplo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="cs-cartao cs-lista">
          <span className="cs-rotulo">{tx('Endereços mais ativos (15 min)')}</span>
          {d.ipsAtivos.length === 0 ? <div className="cs-vazio">{tx('Sem tráfego.')}</div> : (
            <table className="cs-tabela">
              <thead><tr><th>{tx('Endereço')}</th><th className="text-end">{tx('Pedidos')}</th><th className="text-end">{tx('Suspeitos')}</th><th /></tr></thead>
              <tbody>
                {d.ipsAtivos.map((x) => (
                  <tr key={x.ip} className={x.suspeitos >= 10 ? 'grave' : ''}>
                    <td className="cs-ip">{x.ip}</td>
                    <td className="text-end">{x.pedidos}</td>
                    <td className="text-end" title={Object.entries(x.eventos).map(([k, v]) => `${d.tipos[k]}: ${v}`).join('\n')}>{x.suspeitos}</td>
                    <td className="text-end">{gerir && x.suspeitos > 0 && !d.bloqueios.some((b) => b.ip === x.ip) && <button type="button" className="btn btn-xs btn-danger" onClick={() => pedirBloqueio(x.ip)}><i className="fa fa-ban me-1" />{tx('Bloquear')}</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="cs-grelha cs-2">
        <div className="cs-cartao">
          <span className="cs-rotulo">{tx('Resumo')}</span>
          <table className="cs-tabela">
            <thead><tr><th>{tx('Evento')}</th><th className="text-end">{tx('5 min')}</th><th className="text-end">{tx('24 h')}</th><th className="text-end">{tx('7 dias')}</th></tr></thead>
            <tbody>
              {Object.keys(d.tipos).map((k) => (
                <tr key={k}><td><span className={`cs-tipo cs-t-${k}`}>{d.tipos[k]}</span></td><td className="text-end">{d.ultimos5[k] || 0}</td><td className="text-end">{d.dia[k] || 0}</td><td className="text-end">{d.semana[k] || 0}</td></tr>
              ))}
            </tbody>
          </table>
          {d.suspeitos.length > 0 && <div className="small mt-2"><b>{tx('Mais suspeitos em 24 h:')}</b> {d.suspeitos.slice(0, 6).map((x) => `${x.ip} (${x.eventos})`).join(' · ')}</div>}
        </div>
        <div className="cs-cartao">
          <span className="cs-rotulo"><i className="fa fa-ban me-1" />{tx('Endereços bloqueados ({0})', { 0: d.bloqueios.length })}</span>
          <p className="small cs-nota" translate="no">{tx('Os robôs que procuram falhas ({0} procuras em 5 min) ou tentam injeções ({1}) ficam bloqueados {2} horas, sozinhos.', { 0: d.regras.bloqueioAutomatico.sondagem, 1: d.regras.bloqueioAutomatico.injecao, 2: d.regras.bloqueioAutomatico.horas })}{d.regras.bloqueioAutomatico.login_falhado ? ` ${tx('Também quem erra a palavra-passe {0} vezes.', { 0: d.regras.bloqueioAutomatico.login_falhado })}` : ''}</p>
          {d.bloqueios.length === 0 ? <div className="cs-vazio">{tx('Nenhum endereço bloqueado.')}</div> : (
            <table className="cs-tabela">
              <tbody>
                {d.bloqueios.map((b) => (
                  <tr key={b.ip}>
                    <td className="cs-ip">{b.ip}</td>
                    <td className="small">{b.automatico ? <span className="badge bg-dark">{tx('automático')}</span> : b.criadoPor}{b.motivo && <div className="cs-nota">{b.motivo}</div>}</td>
                    <td className="small text-nowrap">{tx('até {0}', { 0: new Date(b.ate).toLocaleString(localAtual(), { dateStyle: 'short', timeStyle: 'short' }) })}</td>
                    <td className="text-end">{gerir && <button type="button" className="btn btn-xs btn-white" onClick={() => desbloquear(b.ip)}>{tx('Desbloquear')}</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {gerir && !vigilancia && (
            <form className="d-flex gap-2 mt-3 flex-wrap" onSubmit={(e) => { e.preventDefault(); bloquear(novoIp.ip.trim(), novoIp.horas, novoIp.motivo) }}>
              <input className="form-control form-control-sm" style={{ maxWidth: 170 }} placeholder={tx('Endereço IP')} value={novoIp.ip} onChange={(e) => setNovoIp({ ...novoIp, ip: e.target.value })} required aria-label={tx('Endereço IP')} />
              <select className="form-select form-select-sm" style={{ maxWidth: 120 }} value={novoIp.horas} onChange={(e) => setNovoIp({ ...novoIp, horas: e.target.value })} aria-label={tx('Duração')}>
                <option value={1}>{tx('1 hora')}</option><option value={24}>{tx('24 horas')}</option><option value={168}>{tx('7 dias')}</option><option value={720}>{tx('30 dias')}</option>
              </select>
              <input className="form-control form-control-sm flex-grow-1" style={{ minWidth: 140 }} placeholder={tx('Motivo (opcional)')} value={novoIp.motivo} onChange={(e) => setNovoIp({ ...novoIp, motivo: e.target.value })} maxLength={300} aria-label={tx('Motivo')} />
              <button type="submit" className="btn btn-sm btn-danger"><i className="fa fa-ban me-1" />{tx('Bloquear')}</button>
            </form>
          )}
        </div>
      </div>
      <Confirmar pedido={confirmar} onCancelar={() => setConfirmar(null)} />
      <Aviso aviso={aviso} onFechar={() => setAviso(null)} />
    </div>
  )
}

export default CentroSeguranca
