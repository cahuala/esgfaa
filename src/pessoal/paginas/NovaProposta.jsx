import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { useSessao } from '../sessao'
import { useDados } from '../useDados'
import { ICONE_UNIDADE, useArvore } from '../arvore'
import Foto from '../componentes/Foto'
import { Cabecalho, Carregando, Escolha, Painel } from '../componentes/Ui'

const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const TIPOS = [['promocao', 'Promoção', 'fa-chevron-up'], ['nomeacao', 'Nomeação', 'fa-user-tag'], ['graduacao', 'Graduação', 'fa-star-half-alt'], ['exoneracao', 'Exoneração', 'fa-user-minus'], ['progressao', 'Progressão (civis)', 'fa-briefcase']]

/*
  Nova proposta, como no SIGP: à esquerda o efectivo (com fotografia) para seleccionar; ao meio os seleccionados
  (na promoção o posto seguinte já fica definido); à direita, na nomeação, os cargos com os lugares livres.
  Um cargo ocupado só se pode propor se quem lá está também entrar na proposta, para outro cargo.
*/
export default function NovaProposta() {
  const { ref, avisar } = useSessao()
  const navegar = useNavigate()
  const [params] = useSearchParams()
  const [tipo, setTipo] = useState(params.get('tipo') ?? 'promocao')
  const [titulo, setTitulo] = useState('')
  const [fundamentacao, setFundamentacao] = useState('')
  const [sel, setSel] = useState([]) // [{ pessoa, cargoId, postoProposto, modalidade, inicio, fim, justificacao }]
  const [activo, setActivo] = useState(null)
  const [f, setF] = useState({ q: '', ramo: '', unidade: '', so: true, soLivres: false, qCargo: '' })
  const [aGuardar, setAGuardar] = useState(false)

  const promocao = tipo === 'promocao' || tipo === 'progressao'
  const consulta = useMemo(() => (promocao ? { tipo: tipo === 'progressao' ? 'civil' : 'militar' } : tipo === 'nomeacao' ? {} : { tipo: 'militar' }), [tipo, promocao])
  const { dados: efectivo } = useDados(promocao ? '/carreira/elegiveis' : '/pessoas', consulta)
  const { dados: cargos } = useDados(tipo === 'nomeacao' || tipo === 'exoneracao' ? '/cargos' : null)
  const arvore = useArvore()
  const [abertos, setAbertos] = useState(() => new Set(['raiz']))
  const inicial = params.get('pessoa')

  // vindo do perfil («Propor promoção…»): já entra seleccionado
  const [jaInicial, setJaInicial] = useState(false)
  if (!jaInicial && inicial && efectivo) {
    const p = efectivo.find((x) => String(x.id) === inicial)
    if (p) setSel([{ pessoa: p, cargoId: null, postoProposto: '', modalidade: '', inicio: '', fim: '', justificacao: '' }])
    setActivo(p?.id ?? null)
    setJaInicial(true)
  }

  const mudarTipo = (t) => { setTipo(t); setSel([]); setActivo(null) }
  const escolhido = (id) => sel.some((s) => s.pessoa.id === id)
  const alternar = (p) => {
    if (escolhido(p.id)) { setSel((l) => l.filter((s) => s.pessoa.id !== p.id)); if (activo === p.id) setActivo(null); return }
    setSel((l) => [...l, { pessoa: p, cargoId: null, postoProposto: '', modalidade: '', inicio: '', fim: '', justificacao: '' }])
    setActivo(p.id)
  }
  const mudar = (id, campo, v) => setSel((l) => l.map((s) => (s.pessoa.id === id ? { ...s, [campo]: v } : s)))

  const lista = useMemo(() => {
    let l = efectivo ?? []
    if (tipo === 'exoneracao') l = l.filter((p) => p.cargoId)
    if (promocao && f.so) l = l.filter((p) => p.elegivel && !p.emProposta)
    if (f.ramo) l = l.filter((p) => p.ramo === f.ramo)
    if (f.unidade) { const ids = arvore.descendentes(Number(f.unidade)); l = l.filter((p) => ids.has(p.unidadeId)) }
    const t = norm(f.q).split(/\s+/).filter(Boolean)
    if (t.length) l = l.filter((p) => t.every((x) => norm(`${p.nome} ${p.nip ?? ''} ${p.numeroAgente ?? ''} ${p.postoNome ?? ''} ${p.cargoNome ?? ''}`).includes(x)))
    return l
  }, [efectivo, f, tipo, promocao, arvore])

  // lugares de cada cargo tendo em conta a proposta: quem sai liberta o lugar, quem entra ocupa-o
  const estadoCargo = useMemo(() => {
    const m = new Map()
    for (const c of cargos ?? []) {
      const saem = new Set(sel.filter((s) => s.cargoId && s.cargoId !== c.id).map((s) => s.pessoa.id))
      const ficam = c.ocupantes.filter((o) => !saem.has(o.id))
      const entram = sel.filter((s) => s.cargoId === c.id)
      m.set(c.id, { ficam, entram, livres: c.vagas - ficam.filter((o) => !entram.some((e) => e.pessoa.id === o.id)).length - entram.length })
    }
    return m
  }, [cargos, sel])

  // art. 19.º: ninguém é nomeado para cargo de posto inferior ao seu
  const grauPosto = (id) => ref.postos.EXE.find((x) => x.id === id)?.grau ?? 0
  const pessoaActiva = sel.find((s) => s.pessoa.id === activo)?.pessoa
  const inferior = (c) => Boolean(pessoaActiva?.grau && c.postoRequerido && grauPosto(c.postoRequerido) < pessoaActiva.grau)
  const atribuir = (c) => {
    if (!activo) return avisar('Escolha primeiro, ao meio, a pessoa a nomear.', 'erro')
    if (inferior(c)) return avisar(`${c.nome} é de posto inferior ao de ${pessoaActiva.nome} (art. 19.º).`, 'erro')
    mudar(activo, 'cargoId', c.id)
  }
  // o ocupante do cargo escolhido entra na proposta (para lhe dar outro cargo)
  const juntarOcupante = (o) => {
    const p = (efectivo ?? []).find((x) => x.id === o.id) ?? { id: o.id, nome: o.nome, fotoId: o.fotoId, postoNome: o.descricao, nip: o.nip }
    if (!escolhido(p.id)) setSel((l) => [...l, { pessoa: p, cargoId: null, postoProposto: '', modalidade: '', inicio: '', fim: '', justificacao: '' }])
    setActivo(p.id)
  }

  const problemas = []
  if (tipo === 'nomeacao') {
    for (const s of sel) {
      if (!s.cargoId) problemas.push(`${s.pessoa.nome}: falta escolher o cargo.`)
      else if (estadoCargo.get(s.cargoId)?.livres < 0) {
        const fora = estadoCargo.get(s.cargoId).ficam.filter((o) => !escolhido(o.id))
        problemas.push(`${cargos.find((c) => c.id === s.cargoId).nome}: ocupado por ${fora.map((o) => o.nome).join(', ') || 'outra pessoa da proposta'}${fora.length ? ' — tem de entrar na proposta para outro cargo' : ''}.`)
      }
    }
  }
  if (tipo === 'graduacao') for (const s of sel) if (!s.postoProposto) problemas.push(`${s.pessoa.nome}: escolha o posto da graduação.`)

  async function criar() {
    setAGuardar(true)
    try {
      const r = await api('/propostas', {
        metodo: 'POST',
        corpo: {
          tipo, fundamentacao,
          titulo: titulo || `${ref.tiposProposta[tipo].nome} — ${new Date().toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })}`,
          itens: sel.map((s) => ({ pessoaId: s.pessoa.id, cargoId: s.cargoId ?? undefined, postoProposto: s.postoProposto || undefined, modalidade: s.modalidade || undefined, inicio: s.inicio || null, fim: s.fim || null, justificacao: s.justificacao })),
        },
      })
      avisar('Proposta criada. Confira as condições e imprima os documentos.')
      navegar(`/propostas/${r.id}`)
    } catch (e) {
      avisar(e.message, 'erro')
      setAGuardar(false)
    }
  }

  const nomeacao = tipo === 'nomeacao'
  const ramos = Object.fromEntries(Object.entries(ref.ramos).map(([k, v]) => [k, v.nome]))
  const postosAcima = (p, max = 2) => (ref.postos[p.ramo] ?? ref.postos.EXE).filter((x) => x.grau > (p.grau ?? 0) && x.grau <= (p.grau ?? 0) + max)
  // cargos de cada unidade e, para cada ramo da árvore, quantos lugares livres tem (somando as subunidades)
  const textoCargo = norm(f.qCargo)
  const mostraCargo = (c) => (!f.soLivres || (estadoCargo.get(c.id)?.livres ?? 0) > 0) && (!textoCargo || norm(`${c.nome} ${c.postoRequeridoNome} ${c.unidadeCaminho}`).includes(textoCargo))
  const cargosDe = useMemo(() => {
    const m = new Map()
    for (const c of cargos ?? []) m.set(c.unidadeId ?? 0, [...(m.get(c.unidadeId ?? 0) ?? []), c])
    return m
  }, [cargos])
  const resumoRamo = useMemo(() => {
    const r = new Map()
    const somar = (n) => {
      let livres = 0
      let visiveis = 0
      for (const c of cargosDe.get(n.id ?? 0) ?? []) { livres += Math.max(0, estadoCargo.get(c.id)?.livres ?? 0); if (mostraCargo(c)) visiveis++ }
      for (const x of n.filhos) { const t = somar(x); livres += t.livres; visiveis += t.visiveis }
      r.set(n.id ?? 'raiz', { livres, visiveis })
      return { livres, visiveis }
    }
    if (arvore.escola) somar(arvore.escola)
    return r
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arvore.escola, cargosDe, estadoCargo, f.soLivres, textoCargo])
  const filtrando = f.soLivres || Boolean(textoCargo)
  const alternarNo = (k) => setAbertos((a) => { const n = new Set(a); if (n.has(k)) n.delete(k); else n.add(k); return n })

  const cartaoCargo = (c) => {
    const e = estadoCargo.get(c.id)
    const fora = e.ficam.filter((o) => !escolhido(o.id))
    return (
      <div key={c.id} className="border-bottom px-2 py-2 small bg-white">
        <button type="button" className="btn btn-link p-0 text-start text-decoration-none w-100" onClick={() => atribuir(c)} title={activo ? 'Atribuir à pessoa escolhida' : 'Escolha primeiro a pessoa, ao meio'}>
          <span className="d-flex"><strong className="me-auto text-body"><i className="fa fa-chair me-1 text-muted" />{c.nome}</strong><span className={`badge ${e.livres > 0 ? 'bg-success' : e.livres === 0 ? 'bg-secondary' : 'bg-danger'}`}>{e.livres > 0 ? `${e.livres} vago(s)` : e.livres === 0 ? 'preenchido' : 'ocupado'}</span></span>
          <span className="text-muted d-block">{c.postoRequeridoNome || c.categoriaCivil || 'Civil'} · {c.vagas} lugar(es)</span>
          {inferior(c) && <span className="d-block text-danger"><i className="fa fa-ban me-1" />Posto inferior ao de {pessoaActiva.nome} (art. 19.º)</span>}
        </button>
        {c.ocupantes.map((o) => (
          <div key={o.id} className="d-flex align-items-center gap-1 mt-1">
            <Foto pessoaId={o.id} fotoId={o.fotoId} nome={o.nome} tamanho={24} />
            <span className={`flex-grow-1 ${escolhido(o.id) ? 'text-decoration-line-through text-muted' : ''}`}>{o.descricao} {o.nome}</span>
            {fora.some((x) => x.id === o.id) && e.entram.length > 0 && <button type="button" className="btn btn-xs btn-warning" onClick={() => juntarOcupante(o)} title="O ocupante tem de entrar na proposta para outro cargo">Juntar à proposta</button>}
          </div>
        ))}
        {e.entram.map((x) => <div key={x.pessoa.id} className="text-success mt-1"><i className="fa fa-arrow-right me-1" />{x.pessoa.nome}</div>)}
      </div>
    )
  }

  const noArvore = (n, nivel) => {
    const k = n.id ?? 'raiz'
    const t = resumoRamo.get(k) ?? { livres: 0, visiveis: 0 }
    if (filtrando && !t.visiveis) return null
    const aberto = filtrando || abertos.has(k)
    const proprios = (cargosDe.get(n.id ?? 0) ?? []).filter(mostraCargo)
    return (
      <div key={k}>
        <button type="button" className="w-100 border-0 border-bottom text-start px-2 py-1 d-flex align-items-center gap-1 small" style={{ paddingLeft: `${8 + nivel * 14}px`, background: nivel ? '#f6f7f5' : '#e9ede8' }} onClick={() => alternarNo(k)}>
          <i className={`fa fa-fw ${aberto ? 'fa-caret-down' : 'fa-caret-right'}`} />
          <i className={`fa fa-fw ${n.id ? ICONE_UNIDADE[n.tipo] ?? 'fa-building' : 'fa-landmark'} text-muted`} />
          <span className="me-auto">{n.sigla && n.id && <strong className="me-1">{n.sigla}</strong>}{n.id ? n.nome : <strong>{n.nome}</strong>}</span>
          <span className={`badge ${t.livres ? 'bg-success' : 'bg-light text-dark border'}`} title="Lugares livres neste ramo da orgânica">{t.livres} vago(s)</span>
        </button>
        {aberto && (
          <div style={{ marginLeft: nivel * 14 }}>
            {proprios.map(cartaoCargo)}
            {n.filhos.map((x) => noArvore(x, nivel + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      <Cabecalho titulo="Nova proposta" migalhas={[['Propostas', '/propostas'], ['Nova']]}>
        <button type="button" className="btn btn-outline-secondary" onClick={() => navegar('/propostas')}>Cancelar</button>
        <button type="button" className="btn btn-theme" disabled={!sel.length || aGuardar} onClick={criar}><i className="fa fa-check me-1" />Criar proposta ({sel.length})</button>
      </Cabecalho>
      <Painel>
        <div className="row align-items-end">
          <div className="col-xl-6 mb-2">
            <label className="form-label small fw-semibold">Tipo de proposta</label>
            <div className="btn-group w-100 flex-wrap" role="group">{TIPOS.map(([k, t, ic]) => <button key={k} type="button" className={`btn btn-sm ${tipo === k ? 'btn-theme' : 'btn-outline-secondary'}`} onClick={() => mudarTipo(k)}><i className={`fa ${ic} me-1`} />{t}</button>)}</div>
          </div>
          <div className="col-xl-3 col-md-6 mb-2"><label className="form-label small fw-semibold">Título</label><input className="form-control form-control-sm" placeholder={`${ref.tiposProposta[tipo].nome} — ${new Date().toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })}`} value={titulo} onChange={(e) => setTitulo(e.target.value)} /></div>
          <div className="col-xl-3 col-md-6 mb-2"><label className="form-label small fw-semibold">Fundamentação (vai nas fichas)</label><input className="form-control form-control-sm" value={fundamentacao} onChange={(e) => setFundamentacao(e.target.value)} /></div>
        </div>
      </Painel>

      <div className="row">
        {/* ESQUERDA: efectivo */}
        <div className={nomeacao ? 'col-xl-4' : 'col-xl-5'}>
          <Painel titulo={`Efectivo (${lista.length})`} icone="fa-users" corpo={false}>
            <div className="p-2 border-bottom">
              <input type="search" className="form-control form-control-sm mb-2" placeholder="Nome, NIP, posto ou cargo…" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} aria-label="Pesquisar no efectivo" />
              <div className="d-flex gap-2">
                {tipo !== 'progressao' && <Escolha valor={f.ramo} aoMudar={(v) => setF({ ...f, ramo: v })} opcoes={ramos} vazio="Os três ramos" aria-label="Ramo" />}
                <Escolha valor={f.unidade} aoMudar={(v) => setF({ ...f, unidade: v })} opcoes={arvore.opcoes} vazio="Toda a Escola" aria-label="Unidade (inclui as subunidades)" />
              </div>
              {promocao && <label className="form-check small mt-2 mb-0"><input type="checkbox" className="form-check-input" checked={f.so} onChange={(e) => setF({ ...f, so: e.target.checked })} /> <span className="form-check-label">Só quem está em condições (Lei n.º 13/18)</span></label>}
              <div className="d-flex gap-2 mt-2">
                <button type="button" className="btn btn-xs btn-outline-theme" onClick={() => { const novos = lista.filter((p) => !escolhido(p.id) && (!promocao || (p.elegivel && !p.emProposta))); setSel((l) => [...l, ...novos.map((p) => ({ pessoa: p, cargoId: null, postoProposto: '', modalidade: '', inicio: '', fim: '', justificacao: '' }))]) }}><i className="fa fa-check-double me-1" />Seleccionar todos</button>
                <button type="button" className="btn btn-xs btn-secondary" onClick={() => { setSel([]); setActivo(null) }}>Limpar</button>
              </div>
            </div>
            <div className="list-group list-group-flush" style={{ maxHeight: 620, overflowY: 'auto' }}>
              {!efectivo ? <Carregando /> : lista.map((p) => {
                const bloqueado = promocao && (!p.elegivel || p.emProposta)
                return (
                  <label key={p.id} className={`list-group-item list-group-item-action d-flex gap-2 align-items-center mb-0 ${escolhido(p.id) ? 'list-group-item-success' : ''}`} style={{ cursor: 'pointer', opacity: bloqueado && !escolhido(p.id) ? 0.7 : 1 }} title={bloqueado ? (p.emProposta ? 'Já está noutra proposta em curso' : `Falta: ${p.faltas.join('; ')}`) : ''}>
                    <input type="checkbox" className="form-check-input mt-0" checked={escolhido(p.id)} onChange={() => alternar(p)} />
                    <Foto pessoaId={p.id} fotoId={p.fotoId} nome={p.nome} tamanho={38} />
                    <span className="flex-grow-1 small lh-sm">
                      <strong>{p.nome}</strong>
                      <span className="d-block text-muted">{p.postoNome || p.categoriaCivil || 'Civil'} · {p.nip || p.numeroAgente || '—'}{p.ramo && ` · ${p.ramo}`}</span>
                      <span className="d-block text-muted">{p.unidadeNome}{p.cargoNome && ` · ${p.cargoNome}`}</span>
                      {promocao && (p.elegivel ? (p.emProposta ? <span className="badge bg-info">já em proposta</span> : <span className="text-success fw-semibold"><i className="fa fa-arrow-right me-1" />{p.proposto}</span>) : <span className="text-danger">Falta: {p.faltas.join('; ')}</span>)}
                    </span>
                  </label>
                )
              })}
              {efectivo && !lista.length && <div className="list-group-item text-muted small">Ninguém com estes filtros.</div>}
            </div>
          </Painel>
        </div>

        {/* MEIO: seleccionados */}
        <div className={nomeacao ? 'col-xl-4' : 'col-xl-7'}>
          <Painel titulo={`Seleccionados (${sel.length})`} icone="fa-user-check" corpo={false}>
            {problemas.length > 0 && <div className="alert alert-warning small m-2 mb-0">{problemas.map((x) => <div key={x}><i className="fa fa-exclamation-triangle me-1" />{x}</div>)}</div>}
            <div className="list-group list-group-flush" style={{ maxHeight: 700, overflowY: 'auto' }}>
              {sel.map((s) => {
                const p = s.pessoa
                const cargo = cargos?.find((c) => c.id === s.cargoId)
                const ocupado = cargo && estadoCargo.get(cargo.id)?.livres < 0
                return (
                  <div key={p.id} role="button" tabIndex={0} className={`list-group-item ${activo === p.id ? 'border-start border-4 border-success bg-light' : ''}`} onClick={() => setActivo(p.id)} onKeyDown={(e) => { if (e.key === 'Enter') setActivo(p.id) }}>
                    <div className="d-flex gap-2 align-items-center">
                      <Foto pessoaId={p.id} fotoId={p.fotoId} nome={p.nome} tamanho={42} />
                      <div className="flex-grow-1 small lh-sm">
                        <strong>{p.nome}</strong>
                        <div className="text-muted">{p.postoNome || p.categoriaCivil} · {p.nip || p.numeroAgente}</div>
                        {p.cargoNome && <div className="text-muted">Cargo actual: {p.cargoNome}</div>}
                      </div>
                      <button type="button" className="btn btn-xs btn-outline-danger" onClick={(e) => { e.stopPropagation(); alternar(p) }} title="Retirar"><i className="fa fa-times" /></button>
                    </div>
                    <div className="mt-2 small" onClick={(e) => e.stopPropagation()} role="presentation">
                      {tipo === 'promocao' && <div className="d-flex align-items-center gap-2"><span>{p.postoNome} <i className="fa fa-arrow-right mx-1" /> <strong className="text-success">{p.proposto}</strong></span><Escolha valor={s.modalidade} aoMudar={(v) => mudar(p.id, 'modalidade', v)} opcoes={{ distincao: 'Por distinção (art. 57.º)', excepcional: 'A título excepcional (art. 58.º)' }} vazio={`Modalidade da lei${p.modalidade ? ` (${ref.modalidades[p.modalidade]})` : ''}`} style={{ maxWidth: 220 }} /></div>}
                      {tipo === 'progressao' && <span>{p.categoriaCivil} <i className="fa fa-arrow-right mx-1" /> <strong className="text-success">{p.proposto}</strong></span>}
                      {tipo === 'graduacao' && <div className="d-flex gap-2"><Escolha valor={s.postoProposto} aoMudar={(v) => mudar(p.id, 'postoProposto', v)} opcoes={postosAcima(p).map((x) => [x.id, `Graduado em ${x.nome}`])} vazio="Posto (até 2 graus)" /><input type="date" className="form-control form-control-sm" value={s.inicio} onChange={(e) => mudar(p.id, 'inicio', e.target.value)} title="Início" /><input type="date" className="form-control form-control-sm" value={s.fim} onChange={(e) => mudar(p.id, 'fim', e.target.value)} title="Fim" /></div>}
                      {nomeacao && (cargo
                        ? <div className={ocupado ? 'text-danger' : 'text-success'}><i className="fa fa-chair me-1" /><strong>{cargo.nome}</strong> · {cargo.unidadeCaminho || cargo.unidadeNome}{ocupado && ' — ocupado'}<button type="button" className="btn btn-link btn-sm p-0 ms-2" onClick={() => mudar(p.id, 'cargoId', null)}>mudar</button></div>
                        : <div className="text-warning"><i className="fa fa-hand-point-right me-1" />{activo === p.id ? 'Escolha o cargo à direita.' : 'Clique aqui e depois no cargo à direita.'}</div>)}
                      {tipo === 'exoneracao' && <span>Deixa o cargo: <strong>{p.cargoNome}</strong></span>}
                      <input className="form-control form-control-sm mt-1" placeholder="Justificação (opcional)" value={s.justificacao} onChange={(e) => mudar(p.id, 'justificacao', e.target.value)} />
                    </div>
                  </div>
                )
              })}
              {!sel.length && <div className="list-group-item text-muted small py-4 text-center"><i className="fa fa-arrow-left me-1" />Seleccione no efectivo quem entra na proposta.</div>}
            </div>
          </Painel>
        </div>

        {/* DIREITA: cargos (nomeação) */}
        {nomeacao && (
          <div className="col-xl-4">
            <Painel titulo="Cargos" icone="fa-chair" corpo={false}>
              <div className="p-2 border-bottom">
                <input type="search" className="form-control form-control-sm mb-2" placeholder="Procurar cargo ou unidade…" value={f.qCargo} onChange={(e) => setF({ ...f, qCargo: e.target.value })} aria-label="Procurar cargo" />
                <label className="form-check small mb-0"><input type="checkbox" className="form-check-input" checked={f.soLivres} onChange={(e) => setF({ ...f, soLivres: e.target.checked })} /> <span className="form-check-label">Só os vagos</span></label>
              </div>
              <div style={{ maxHeight: 700, overflowY: 'auto' }}>
                {!cargos || !arvore.escola ? <Carregando /> : noArvore(arvore.escola, 0)}
              </div>
            </Painel>
          </div>
        )}
      </div>
    </>
  )
}
