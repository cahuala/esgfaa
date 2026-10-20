import { Fragment, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useDados } from '../useDados'
import { useSessao } from '../sessao'
import Foto from '../componentes/Foto'
import { Cabecalho, Carregando, Erro, Modal } from '../componentes/Ui'
import { gerarLote, vencimentoDaTabela } from '../docPessoal'
import { kwanzas } from '../docPessoal/base'
import { brasaoPng, emblema } from '../documentos'
import { documentoPdf, exportarExcel } from '../exportar'
import { dataPt } from '../formatar'

/*
  Os modelos de declaração da ESG (a caixa do canto de cada modelo diz para quem é) e as finalidades que
  vão na «OBS». Cada finalidade escolhida dá uma declaração (como no SIGP). Os modelos dos bancos (do SIGP)
  têm o texto próprio e não levam OBS.
*/
const militar = (p) => p.tipo === 'militar'
const modelosPara = (p) => (p.vinculo === 'domiciliar'
  ? [{ id: 'domiciliar', nome: 'Para empregada(o) domiciliar (civil)', tipo: 'declaracao_servico', dados: { comVencimento: 'Sim' } }]
  : militar(p)
    ? [
        { id: 'efectividade', nome: 'Para efectivo militar — efectividade', tipo: 'declaracao_efectividade', dados: { comVencimento: 'Não' } },
        { id: 'efectividade_venc', nome: 'Para efectivo militar — com o vencimento', tipo: 'declaracao_efectividade', dados: { comVencimento: 'Sim' } },
        ...(p.discente || p.vinculo === 'estudante' ? [{ id: 'discente', nome: 'Para discentes', tipo: 'declaracao_efectividade', dados: { comVencimento: 'Sim' }, discente: true }] : []),
        { id: 'salario', nome: 'Declaração de salário', tipo: 'declaracao_salario', dados: { comVencimento: 'Sim' } },
      ]
    : [
        { id: 'servico_venc', nome: 'Para civil — com o vencimento', tipo: 'declaracao_servico', dados: { comVencimento: 'Sim' } },
        { id: 'servico', nome: 'Para civil — para confirmar a efectividade', tipo: 'declaracao_servico', dados: { comVencimento: 'Não' } },
      ])
const FINALIDADES = [
  ['Finalidades da ESG (OBS)', [
    { id: 'conta', nome: 'Efeito de Actualização de Conta Bancária', obs: () => 'Efeito de Actualização de Conta Bancária' },
    { id: 'visto', nome: 'Efeito de obtenção de Visto para…', obs: (x) => `efeito de obtenção de Visto para ${x.pais || '________'}`, pais: true },
    { id: 'devidos', nome: 'Para os devidos efeitos (sem OBS)', obs: () => '' },
    { id: 'outra', nome: 'Outra finalidade (escrever)', obs: (x) => x.outra, escrever: true },
  ]],
  ['Bancos (modelos do SIGP)', [
    { id: 'credito_pessoal', nome: 'Crédito Pessoal (BFA)', tipo: 'declaracao_bfa_credito', banco: true },
    { id: 'adiantamento', nome: 'Adiantamento Salarial (BFA)', tipo: 'declaracao_bfa_adiantamento', banco: true },
    { id: 'bpc_salario', nome: 'BPC Salário', tipo: 'declaracao_bpc_salario', banco: true },
    { id: 'bpc_credito', nome: 'Crédito Bancário (BPC)', tipo: 'declaracao_bpc_credito', banco: true },
  ]],
]
const TODAS = FINALIDADES.flatMap(([, l]) => l)
const hojeIso = () => new Date().toISOString().slice(0, 10)
const inicioMes = () => `${hojeIso().slice(0, 8)}01`
const quemE = (p) => [militar(p) ? p.postoNome : 'Civil', p.nip || p.numeroAgente].filter(Boolean).join(' · ')
const iniciais = (n) => n.trim().split(/\s+/).filter((_, i, a) => i === 0 || i === a.length - 1).map((x) => x[0]).join('').toUpperCase()

// comprovante de emissão (como no SIGP): meia folha por declaração, para quem a levanta assinar
async function comprovantes(lista, utilizador) {
  const [{ jsPDF }, brasao] = await Promise.all([import('jspdf'), brasaoPng()])
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  lista.forEach((x, i) => {
    if (i && i % 2 === 0) doc.addPage()
    const y0 = i % 2 ? 150 : 12
    doc.setDrawColor(150).setLineWidth(0.3).roundedRect(15, y0, 180, 128, 3, 3)
    emblema(doc, brasao, 30, y0 + 6, 18)
    doc.setFont('helvetica', 'bold').setFontSize(11).text('ESCOLA SUPERIOR DE GUERRA', 45, y0 + 13)
    doc.setFont('helvetica', 'normal').setFontSize(9).text('Repartição de Pessoal e Quadros', 45, y0 + 18.5)
    doc.setFont('helvetica', 'bold').setFontSize(9).text(['Comprovante Nº', x.referencia], 188, y0 + 12, { align: 'right' })
    doc.setFontSize(12).text('COMPROVANTE DE EMISSÃO DE DECLARAÇÃO', 105, y0 + 36, { align: 'center' })
    const L = (r, v, xx, y, w = 80) => { doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(110).text(r.toUpperCase(), xx, y).setTextColor(0); doc.setFont('helvetica', 'bold').setFontSize(10.5).text(doc.splitTextToSize(String(v || '—'), w)[0], xx, y + 5.5) }
    L(militar(x.pessoa) ? 'NIP' : 'N.º de agente', x.pessoa.nip || x.pessoa.numeroAgente, 25, y0 + 50); L(militar(x.pessoa) ? 'Posto' : 'Categoria', militar(x.pessoa) ? x.pessoa.postoNome : 'Civil', 110, y0 + 50)
    L('Nome', x.pessoa.nome, 25, y0 + 64, 160)
    L('Declaração', x.nome.replace('Declaração — ', ''), 25, y0 + 78); L('Finalidade', x.finalidade || '—', 110, y0 + 78)
    L('Data de emissão', dataPt(x.criadoEm), 25, y0 + 92); L('Emitida por', x.emitidoPor, 110, y0 + 92)
    doc.setLineWidth(0.25).line(25, y0 + 116, 95, y0 + 116).line(115, y0 + 116, 185, y0 + 116)
    doc.setFont('helvetica', 'normal').setFontSize(8).text('Assinatura de quem tratou', 60, y0 + 120, { align: 'center' }).text('Assinatura de quem levantou', 150, y0 + 120, { align: 'center' })
    doc.setFont('helvetica', 'bold').text(utilizador || '', 60, y0 + 124.5, { align: 'center' })
  })
  doc.save(`comprovantes-${hojeIso()}.pdf`)
}

/*
  Declarações (como no SIGP): solicitar uma nova (a pessoa e as finalidades, várias de uma vez), confirmar
  os dados (salário, IBAN, banco) e registar; em baixo, as registadas agrupadas por pessoa, com quantas e
  quantas impressas, a última impressão, reimprimir, imprimir e tirar comprovantes das seleccionadas e a
  relação das emitidas num período.
*/
export default function Declaracoes() {
  const { pode, avisar, utilizador } = useSessao()
  const [filtros, setFiltros] = useState({ q: '', de: inicioMes(), ate: hojeIso() })
  const { dados, erro, recarregar } = useDados('/declaracoes', filtros)
  const [marcadas, setMarcadas] = useState(new Set())
  const [aberto, setAberto] = useState(null)
  const [aba, setAba] = useState('por_imprimir')
  const [aImprimir, setAImprimir] = useState(false)
  const editar = pode('editar')

  // as declarações de cada pessoa juntas (como no SIGP)
  const grupos = useMemo(() => {
    const m = new Map()
    for (const x of (dados ?? []).filter((d) => (aba === 'todas' ? true : aba === 'impressas' ? d.impressoes > 0 : !d.impressoes))) {
      const g = m.get(x.pessoa.id) ?? { pessoa: x.pessoa, itens: [] }
      g.itens.push(x)
      m.set(x.pessoa.id, g)
    }
    return [...m.values()]
  }, [dados, aba])
  const nPor = (dados ?? []).filter((x) => !x.impressoes).length

  async function imprimir(lista) {
    setAImprimir(true)
    try {
      const [quem, ...fichas] = await Promise.all([api('/definicoes/assinaturas'), ...[...new Set(lista.map((x) => x.pessoa.id))].map((id) => api(`/pessoas/${id}`))])
      const porId = new Map(fichas.map((p) => [p.id, p]))
      await gerarLote(lista.map((x) => ({ p: porId.get(x.pessoa.id), escolha: { tipo: x.tipo, dados: { ...x.dados, data: String(x.criadoEm).slice(0, 10) } }, emitido: { numero: x.numero, ano: x.ano } })), quem, `declaracoes-${hojeIso()}.pdf`)
      await api('/declaracoes/impressoes', { metodo: 'POST', corpo: { ids: lista.map((x) => x.id) } })
      setMarcadas(new Set())
      recarregar()
    } catch (e) {
      avisar(e.message, 'erro')
    } finally {
      setAImprimir(false)
    }
  }
  const seleccionadas = (dados ?? []).filter((x) => marcadas.has(x.id))
  const alternarGrupo = (g) => setMarcadas((m) => { const n = new Set(m); const todas = g.itens.every((x) => n.has(x.id)); g.itens.forEach((x) => (todas ? n.delete(x.id) : n.add(x.id))); return n })

  const colunas = [
    { titulo: 'Nº', valor: (x) => x.referencia, alinhar: 'center' }, { titulo: 'Tipo', valor: (x) => x.nome.replace('Declaração — ', '') },
    { titulo: 'Militar / Funcionário', valor: (x) => `${quemE(x.pessoa)} — ${x.pessoa.nome}` }, { titulo: 'Finalidade', valor: (x) => x.finalidade },
    { titulo: 'Estado', valor: (x) => (x.impressoes ? 'Impressa' : 'Por imprimir'), alinhar: 'center' }, { titulo: 'Data', valor: (x) => String(x.criadoEm).slice(0, 10), data: true }, { titulo: 'Emitida por', valor: (x) => x.emitidoPor },
  ]
  const relacao = () => documentoPdf({ titulo: 'Relação das declarações emitidas', subtitulo: `Período: ${dataPt(filtros.de)} a ${dataPt(filtros.ate)}`, orientacao: 'landscape', seccoes: [{ colunas: [{ titulo: 'N/O', valor: (_, i) => String(i + 1).padStart(2, '0'), alinhar: 'center', largura: 11 }, ...colunas], linhas: [...(dados ?? [])].reverse() }] })

  return (
    <>
      <Cabecalho titulo={<><i className="fa fa-file-signature me-2 pes-ouro" />Declarações</>} subtitulo={`solicitar, listar e imprimir declarações — ${dados?.length ?? 0} registos`} migalhas={[['Documentos'], ['Declarações']]}>
        {editar && <button type="button" className="btn btn-theme" onClick={() => document.getElementById('nova-declaracao')?.scrollIntoView({ behavior: 'smooth' })}><i className="fa fa-plus me-1" />Nova declaração</button>}
      </Cabecalho>
      {editar && <NovaDeclaracao aoEmitir={recarregar} />}

      <div className="pes-bloco">
        <div className="pes-bloco-t">
          <span><i className="fa fa-list me-2" />Declarações registadas</span>
          <div className="d-flex gap-2 flex-wrap align-items-center">
            <span className="small text-muted fw-normal">{dados?.length ?? 0} registo(s)</span>
            <button type="button" className="btn btn-xs btn-white" disabled={!seleccionadas.length} onClick={() => comprovantes(seleccionadas, utilizador?.nome)}><i className="fa fa-receipt me-1" />Comprovantes seleccionados {seleccionadas.length ? `(${seleccionadas.length})` : ''}</button>
            <button type="button" className="btn btn-xs btn-white" disabled={!seleccionadas.length || aImprimir} onClick={() => imprimir(seleccionadas)}><i className={`fa ${aImprimir ? 'fa-spinner fa-spin' : 'fa-print'} me-1`} />Imprimir seleccionadas {seleccionadas.length ? `(${seleccionadas.length})` : ''}</button>
          </div>
        </div>
        <div className="pes-ficha-tabs mb-0 px-3 pt-2" role="tablist">
          {[['por_imprimir', 'Por imprimir', 'fa-hourglass-half', nPor], ['impressas', 'Impressas', 'fa-check-circle', (dados?.length ?? 0) - nPor], ['todas', 'Todas', 'fa-list', dados?.length ?? 0]].map(([k, t, ic, n]) => <button key={k} type="button" role="tab" aria-selected={aba === k} className={`pes-ftab ${aba === k ? 'active' : ''}`} onClick={() => { setAba(k); setMarcadas(new Set()) }}><i className={`fa ${ic}`} />{t} <span className="pes-ftab-n">{n}</span></button>)}
        </div>
        <div className="pes-bloco-c d-flex flex-wrap gap-2 align-items-center border-bottom">
          <div className="pes-pesquisa flex-grow-1"><i className="fa fa-search" /><input className="form-control form-control-sm" value={filtros.q} onChange={(e) => setFiltros({ ...filtros, q: e.target.value })} placeholder="Pesquisar por NIP, nome, tipo ou nº de documento…" aria-label="Pesquisar declarações" /></div>
          <div className="d-flex gap-1 align-items-center px-2 py-1 rounded" style={{ background: '#faf8f2' }}>
            <span className="small fw-semibold text-muted">Emitidas de</span>
            <input type="date" className="form-control form-control-sm w-auto" value={filtros.de} onChange={(e) => setFiltros({ ...filtros, de: e.target.value })} aria-label="De" />
            <span className="small text-muted">a</span>
            <input type="date" className="form-control form-control-sm w-auto" value={filtros.ate} onChange={(e) => setFiltros({ ...filtros, ate: e.target.value })} aria-label="Até" />
            <button type="button" className="btn btn-xs btn-white" disabled={!dados?.length} onClick={relacao} title="Imprimir a relação das declarações emitidas no período"><i className="fa fa-print me-1" />Relação</button>
          </div>
          <button type="button" className="btn btn-xs btn-white" disabled={!dados?.length} onClick={() => exportarExcel('Declarações emitidas', colunas, dados)}><i className="fa fa-file-excel me-1 text-success" />Excel</button>
        </div>
        {erro ? <div className="p-3"><Erro texto={erro} aoRepetir={recarregar} /></div> : !dados ? <Carregando /> : (
          <div className="table-responsive">
            <table className="table align-middle mb-0 pes-dec">
              <thead><tr><th style={{ width: 70 }} /><th>Solicitante</th><th>Cargo</th><th style={{ width: 170 }}>Declarações</th><th style={{ width: 160 }}>Última impressão</th><th style={{ width: 150 }} className="text-end">Acções</th></tr></thead>
              <tbody>
                {!grupos.length && <tr><td colSpan={6} className="text-center text-muted py-4"><i className="fa fa-search d-block mb-2 opacity-50" />Sem declarações registadas{filtros.q ? ` para «${filtros.q}»` : ' neste período'}.</td></tr>}
                {grupos.map((g) => {
                  const imp = g.itens.filter((x) => x.impressoes)
                  const ult = imp.map((x) => x.ultimaImpressao).sort().at(-1)
                  const aberta = aberto === g.pessoa.id
                  return (
                    <Fragment key={g.pessoa.id}>
                      <tr className="pes-dec-grp" onClick={() => setAberto(aberta ? null : g.pessoa.id)}>
                        <td onClick={(e) => e.stopPropagation()}><div className="d-flex align-items-center gap-2"><input type="checkbox" className="form-check-input" checked={g.itens.every((x) => marcadas.has(x.id))} onChange={() => alternarGrupo(g)} aria-label={`Seleccionar as de ${g.pessoa.nome}`} /><Foto pessoaId={g.pessoa.id} fotoId={g.pessoa.fotoId} nome={g.pessoa.nome} tamanho={34} /></div></td>
                        <td><span className="small fw-semibold pes-ouro">{quemE(g.pessoa)} <span className={`badge ${militar(g.pessoa) ? 'pes-badge-mil' : 'pes-badge-civ'}`}>{militar(g.pessoa) ? 'MILITAR' : 'CIVIL'}</span></span><br /><span className="fw-semibold">{g.pessoa.nome}</span></td>
                        <td className="small text-muted">{g.pessoa.cargoNome || '—'}</td>
                        <td><span className="pes-dec-n">{g.itens.length} declaraç{g.itens.length === 1 ? 'ão' : 'ões'}</span>{imp.length > 0 && <span className="small text-muted"> · {imp.length} impressa(s)</span>} <i className={`fa fa-chevron-${aberta ? 'up' : 'down'} small text-muted ms-1`} /></td>
                        <td className="small text-muted">{ult ? dataPt(ult) : 'Nunca'}</td>
                        <td className="text-end text-nowrap" onClick={(e) => e.stopPropagation()}>
                          <button type="button" className="btn btn-xs btn-theme me-1" disabled={aImprimir} onClick={() => imprimir(g.itens)} title="Imprimir todas as declarações desta pessoa"><i className="fa fa-print" /></button>
                          <button type="button" className="btn btn-xs btn-white me-1" onClick={() => comprovantes(g.itens, utilizador?.nome)} title="Comprovantes de emissão"><i className="fa fa-receipt" /></button>
                          <Link to={`/pessoas/${g.pessoa.id}?aba=emitidos`} className="btn btn-xs btn-white" title="Ficha"><i className="fa fa-id-card" /></Link>
                        </td>
                      </tr>
                      {aberta && (
                        <tr className="pes-dec-det"><td colSpan={6}>
                          <table className="table table-sm mb-0">
                            <thead><tr><th style={{ width: 34 }} /><th>Nº</th><th>Declaração</th><th>Finalidade</th><th>Salário</th><th>Emitida</th><th>Impressões</th><th /></tr></thead>
                            <tbody>{g.itens.map((x) => (
                              <tr key={x.id}>
                                <td><input type="checkbox" className="form-check-input" checked={marcadas.has(x.id)} onChange={() => setMarcadas((m) => { const n = new Set(m); if (n.has(x.id)) n.delete(x.id); else n.add(x.id); return n })} aria-label={`Seleccionar ${x.referencia}`} /></td>
                                <td className="fw-bold text-nowrap">{x.referencia}</td>
                                <td>{x.nome.replace('Declaração — ', '')}</td>
                                <td>{x.finalidade || '—'}</td>
                                <td className="text-nowrap">{x.dados?.valor ? `${kwanzas(x.dados.valor)} Kz` : '—'}</td>
                                <td className="text-nowrap">{dataPt(x.criadoEm)} <span className="text-muted">· {x.emitidoPor}</span></td>
                                <td>{x.impressoes ? `${x.impressoes}× (última ${dataPt(x.ultimaImpressao)})` : <span className="badge bg-warning text-dark">Por imprimir</span>}</td>
                                <td className="text-end text-nowrap">
                                  <button type="button" className="btn btn-xs btn-theme me-1" disabled={aImprimir} onClick={() => imprimir([x])}><i className="fa fa-print me-1" />Imprimir</button>
                                  <button type="button" className="btn btn-xs btn-white" onClick={() => comprovantes([x], utilizador?.nome)} title="Comprovante"><i className="fa fa-receipt" /></button>
                                </td>
                              </tr>
                            ))}</tbody>
                          </table>
                        </td></tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}

// solicitar uma declaração (como no SIGP): procurar a pessoa e escolher as finalidades; confirmar e registar
function NovaDeclaracao({ aoEmitir }) {
  const { avisar } = useSessao()
  const { dados: pessoas } = useDados('/pessoas')
  const [q, setQ] = useState('')
  const [p, setP] = useState(null)
  const [fins, setFins] = useState([])
  const [modelo, setModelo] = useState('')
  const [pais, setPais] = useState('Portugal')
  const [imprimirLogo, setImprimirLogo] = useState(false)
  const [outra, setOutra] = useState('')
  const [valor, setValor] = useState('')
  const [curso, setCurso] = useState('')
  const [confirmar, setConfirmar] = useState(false)
  const [aEmitir, setAEmitir] = useState(false)
  const termo = q.trim().toLowerCase()
  const encontrados = useMemo(() => (termo.length < 2 || !pessoas ? [] : pessoas.filter((x) => [x.nome, x.nip, x.numeroAgente, x.bi].some((v) => String(v ?? '').toLowerCase().includes(termo))).slice(0, 8)), [termo, pessoas])
  const tabela = p ? vencimentoDaTabela(p) : null
  const salario = valor !== '' ? Number(valor) : p?.vencimento || tabela

  async function escolher(x) {
    setQ('')
    try {
      const ficha = await api(`/pessoas/${x.id}`)
      setP(ficha)
      setModelo(modelosPara(ficha)[0]?.id ?? '')
      setValor(ficha.vencimento ?? '')
      setCurso((ficha.cursos ?? []).find((c) => !c.fim)?.nome || (ficha.vinculo === 'estudante' ? ficha.unidadeNome : '') || '')
    } catch (e) {
      avisar(e.message, 'erro')
    }
  }
  const limpar = () => { setP(null); setFins([]); setOutra(''); setValor(''); setModelo(''); setConfirmar(false) }
  function abrir() {
    if (!p) { avisar('Pesquise e seleccione um militar ou funcionário.', 'erro'); return }
    if (!fins.length) { avisar('Seleccione pelo menos uma finalidade.', 'erro'); return }
    if (fins.includes('outra') && !outra.trim()) { avisar('Escreva a outra finalidade.', 'erro'); return }
    setConfirmar(true)
  }
  async function emitir() {
    setAEmitir(true)
    try {
      const m = modelosPara(p).find((x) => x.id === modelo) ?? modelosPara(p)[0]
      const escolhas = fins.map((id) => {
        const f = TODAS.find((x) => x.id === id)
        const venc = valor !== '' ? { valor: Number(valor) } : {}
        // os modelos dos bancos têm o texto próprio; os da ESG levam a finalidade na OBS
        if (f.banco) return { tipo: f.tipo, dados: { finalidade: f.nome, ...venc } }
        const obs = f.obs({ pais, outra: outra.trim() })
        return { tipo: m.tipo, dados: { ...m.dados, finalidade: obs, ...(obs ? {} : { semObs: true }), ...venc, ...(m.discente && curso ? { curso } : {}) } }
      })
      const [emitidos, quem] = await Promise.all([api(`/pessoas/${p.id}/documentos-emitidos`, { metodo: 'POST', corpo: { documentos: escolhas } }), api('/definicoes/assinaturas')])
      // como no SIGP: regista-se o pedido; imprime-se logo, ou depois (fica em «Por imprimir»)
      if (imprimirLogo) {
        await gerarLote(escolhas.map((escolha, i) => ({ p, escolha, emitido: emitidos[i] })), quem, `declaracoes-${p.nome.split(' ')[0].toLowerCase()}-${hojeIso()}.pdf`)
        await api('/declaracoes/impressoes', { metodo: 'POST', corpo: { ids: emitidos.map((x) => x.id) } })
      }
      avisar(`${emitidos.length} declaração(ões) registada(s): ${emitidos.map((x) => `Nº${String(x.numero).padStart(3, '0')}/${String(x.ano).slice(-2)}`).join(', ')}${imprimirLogo ? ' e impressa(s)' : ' — em «Por imprimir»'}.`)
      limpar()
      aoEmitir()
    } catch (e) {
      avisar(e.message, 'erro')
    } finally {
      setAEmitir(false)
    }
  }
  const nomesFins = fins.map((id) => (id === 'outra' ? outra.trim() || 'Outra' : id === 'visto' ? `Visto para ${pais}` : TODAS.find((x) => x.id === id)?.nome))
  const modeloAtual = p ? modelosPara(p).find((x) => x.id === modelo) : null
  const precisaIban = fins.some((id) => TODAS.find((x) => x.id === id)?.banco)

  return (
    <div className="pes-bloco" id="nova-declaracao">
      <div className="pes-bloco-t"><span><i className="fa fa-plus-circle me-2" />Solicitar nova declaração</span></div>
      <div className="pes-bloco-c">
        <div className="row g-3">
          <div className="col-lg-5 position-relative">
            <label className="form-label small fw-bold mb-1" htmlFor="dec-q">Pesquisar militar ou funcionário (NIP ou nome)</label>
            <input id="dec-q" className="form-control" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Digite o NIP ou nome…" autoComplete="off" />
            {encontrados.length > 0 && (
              <div className="list-group position-absolute w-100 shadow pes-sugestoes" style={{ zIndex: 20 }}>
                {encontrados.map((x) => <button key={x.id} type="button" className="list-group-item list-group-item-action d-flex align-items-center gap-2" onClick={() => escolher(x)}><Foto pessoaId={x.id} fotoId={x.fotoId} nome={x.nome} tamanho={28} /><span><span className="fw-semibold">{x.nome}</span><br /><small className="text-muted">{quemE(x)} · {x.vinculoNome}</small></span></button>)}
              </div>
            )}
            {p && (
              <div className="pes-dec-pessoa mt-3">
                <div className="pes-dec-av">{iniciais(p.nome)}</div>
                <div className="flex-grow-1"><div className="fw-bold pes-ouro-escuro">{p.nome}</div><div className="small text-muted">{quemE(p)} · {p.vinculoNome}{p.cargo?.nome ? ` · ${p.cargo.nome}` : ''}</div></div>
                <div className="text-end small text-muted"><div className="font-monospace">{p.iban || 'Sem IBAN na ficha'}</div><div>{p.banco || ''}</div></div>
              </div>
            )}
          </div>
          <div className="col-lg-7">
            {p && <>
              <label className="form-label small fw-bold mb-1">Modelo de declaração</label>
              <div className="d-flex flex-wrap gap-2 mb-3">
                {modelosPara(p).map((m) => <label key={m.id} className={`pes-modelo ${modelo === m.id ? 'activo' : ''}`}><input type="radio" name="modelo-dec" className="form-check-input me-1" checked={modelo === m.id} onChange={() => setModelo(m.id)} />{m.nome}</label>)}
              </div>
            </>}
            <label className="form-label small fw-bold mb-1">Finalidade(s) da declaração <span className="fw-normal text-muted">(pode seleccionar várias)</span></label>
            <div className="pes-fins">
              {FINALIDADES.map(([g, l]) => (
                <div key={g} className="pes-fins-g">
                  <div className="pes-fins-t">── {g} ──</div>
                  {l.map((f) => (
                    <label key={f.id} className="form-check mb-1">
                      <input type="checkbox" className="form-check-input" checked={fins.includes(f.id)} onChange={() => setFins((x) => (x.includes(f.id) ? x.filter((y) => y !== f.id) : [...x, f.id]))} />
                      <span className="form-check-label">{f.nome}</span>
                    </label>
                  ))}
                </div>
              ))}
            </div>
            {fins.includes('visto') && <input className="form-control form-control-sm mt-2" value={pais} onChange={(e) => setPais(e.target.value)} placeholder="País do visto" aria-label="País do visto" />}
            {fins.includes('outra') && <input className="form-control form-control-sm mt-2" value={outra} onChange={(e) => setOutra(e.target.value)} placeholder="Ex.: efeito de Arrendamento" aria-label="Outra finalidade" />}
            <div className="form-text small">Cada finalidade dá uma declaração. As da ESG saem no modelo escolhido, com a finalidade na OBS.</div>
          </div>
        </div>
        <div className="d-flex gap-2 mt-3">
          <button type="button" className="btn btn-theme" onClick={abrir}><i className="fa fa-save me-1" />Registar declaração</button>
          <button type="button" className="btn btn-white" onClick={limpar}><i className="fa fa-times me-1" />Limpar</button>
          <label className="form-check ms-2 align-self-center mb-0"><input type="checkbox" className="form-check-input" checked={imprimirLogo} onChange={(e) => setImprimirLogo(e.target.checked)} /> <span className="form-check-label small">Imprimir logo (senão fica em «Por imprimir»)</span></label>
        </div>
      </div>
      {confirmar && p && (
        <Modal titulo="Confirmar dados" aoFechar={() => setConfirmar(false)} rodape={<>
          <button type="button" className="btn btn-white" onClick={() => setConfirmar(false)}><i className="fa fa-times me-1" />Cancelar</button>
          <button type="button" className="btn btn-theme" disabled={aEmitir} onClick={emitir}><i className={`fa ${aEmitir ? 'fa-spinner fa-spin' : 'fa-check'} me-1`} />Confirmar e registar</button>
        </>}>
          <div className="pes-dec-pessoa mb-3"><Foto pessoaId={p.id} fotoId={p.fotoId} nome={p.nome} tamanho={50} /><div><div className="fw-bold pes-ouro-escuro">{p.nome}</div><div className="small text-muted">{quemE(p)} · {p.vinculoNome}</div></div></div>
          <div className="pes-grelha">
            <div className="pes-campo pes-campo-cheio"><div className="pes-campo-r">Modelo</div><div className="pes-campo-v">{modeloAtual?.nome}</div></div>
            <div className="pes-campo pes-campo-cheio"><div className="pes-campo-r">Finalidade(s)</div><div className="pes-campo-v fw-semibold">{nomesFins.join('  ·  ')}</div></div>
            <div className="pes-campo"><div className="pes-campo-r">Salário líquido (KZ)</div><input type="number" step="0.01" min="0" className="form-control" value={valor} onChange={(e) => setValor(e.target.value)} placeholder={tabela ? kwanzas(tabela) : ''} /><div className="form-text small">{valor === '' ? (salario ? `Vai ${kwanzas(salario)} Kz (${p.vencimento ? 'da ficha' : 'da tabela salarial'}).` : 'Sem tabela: escreva o salário.') : 'Vai o que escreveu.'}</div></div>
            <div className="pes-campo"><div className="pes-campo-r">IBAN</div><div className={`pes-campo-v font-monospace ${p.iban ? '' : 'pes-campo-vazio'}`}>{p.iban || 'Sem IBAN registado na ficha'}</div></div>
            <div className="pes-campo pes-campo-cheio"><div className="pes-campo-r">Banco</div><div className={`pes-campo-v ${p.banco ? '' : 'pes-campo-vazio'}`}>{p.banco || '—'}</div></div>
            {modeloAtual?.discente && <div className="pes-campo pes-campo-cheio"><div className="pes-campo-r">Discente do (curso)</div><input className="form-control" value={curso} onChange={(e) => setCurso(e.target.value)} /></div>}
          </div>
          {precisaIban && !p.iban && <div className="alert alert-warning py-2 small mt-3 mb-0"><i className="fa fa-exclamation-triangle me-1" />As declarações para o banco levam o IBAN: escreva-o primeiro na ficha (Família e banco), ou a declaração sai com o espaço em branco.</div>}
          <div className="pes-info small mt-3 mb-0"><i className="fa fa-info-circle me-1" />Verifique os dados acima antes de confirmar o registo da declaração. Cada finalidade dá uma declaração com o número seguinte do ano.</div>
        </Modal>
      )}
    </div>
  )
}
