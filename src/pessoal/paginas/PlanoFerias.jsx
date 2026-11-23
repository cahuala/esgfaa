import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useArvore } from '../arvore'
import { useDados } from '../useDados'
import { useSessao } from '../sessao'
import Carregar from '../componentes/Carregar'
import Foto from '../componentes/Foto'
import { Cabecalho, Carregando, Erro, Escolha, Modal } from '../componentes/Ui'
import { documentoPdf, exportarExcel } from '../exportar'
import { lerCsv, lerXlsx } from '../../admin/paginas/academico/lerFolha'
import { gerarLote } from '../docPessoal'

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const MESES_LONGOS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

/*
  Plano de férias (como no SIGP): escolhe-se a unidade e o ano e marca-se o mês de férias de cada militar
  e funcionário civil (clicar no mês; clicar outra vez tira). Pode carregar-se de um Excel (colunas «nip» ou
  «agente» e «mes»), exportar e imprimir. As guias de férias de cada um saem da ficha, a partir deste plano.
*/
export default function PlanoFerias() {
  const { pode, avisar } = useSessao()
  const arvore = useArvore()
  const [ano, setAno] = useState(new Date().getFullYear())
  const [unidadeId, setUnidadeId] = useState('')
  const [tipo, setTipo] = useState('')
  const [carregar, setCarregar] = useState(false)
  const consulta = { ano, ...(unidadeId ? { unidadeId } : {}), ...(tipo ? { tipo } : {}) }
  const q = JSON.stringify(consulta)
  const { dados: recebidos, erro, recarregar } = useDados('/plano-ferias', consulta)
  // o que se marcou no ecrã aparece logo (a resposta nova chega depois)
  const [marcados, setMarcados] = useState({})
  const dados = recebidos && { ...recebidos, linhas: recebidos.linhas.map((l) => (`${q}:${l.id}` in marcados ? { ...l, mes: marcados[`${q}:${l.id}`] } : l)) }
  const editar = pode('editar')
  const unidade = arvore.lista.find((u) => String(u.id) === String(unidadeId))

  async function marcar(l, m) {
    if (!editar) return
    const mes = l.mes === m ? null : m
    try {
      setMarcados((x) => ({ ...x, [`${q}:${l.id}`]: mes }))
      await api('/plano-ferias', { metodo: 'PUT', corpo: { ano, pessoaId: l.id, mes } })
    } catch (e) {
      setMarcados((x) => { const { [`${q}:${l.id}`]: _, ...r } = x; void _; return r })
      avisar(e.message, 'erro')
    }
  }

  const ident = (l) => (l.tipo === 'militar' ? l.nip : l.numeroAgente) || ''
  const colunas = [
    { titulo: 'Nº', valor: (_, i) => String(i + 1).padStart(2, '0'), alinhar: 'center', largura: 10 },
    { titulo: 'Posto/Categoria', valor: (l) => (l.tipo === 'militar' ? l.postoNome : l.categoriaCivil || 'Civil') },
    { titulo: 'Nome', valor: (l) => l.nome },
    { titulo: 'NIP / N.º agente', valor: ident },
    { titulo: 'Mês de férias', valor: (l) => (l.mes ? MESES_LONGOS[l.mes - 1] : '') },
    { titulo: 'Dias', valor: (l) => (l.adicionais ? `${l.dias} + ${l.adicionais}` : l.dias), alinhar: 'center' },
  ]
  const titulo = `Plano de Férias — ${unidade?.nome ?? 'Escola Superior de Guerra'} — ${ano}`
  function imprimir() {
    const linhas = dados.linhas
    const seccao = (t, ls) => ({ titulo: t, colunas: [colunas[0], colunas[1], colunas[2], colunas[3], ...MESES.map((m, i) => ({ titulo: m, valor: (l) => (l.mes === i + 1 ? 'X' : ''), alinhar: 'center', largura: 9 }))], linhas: ls })
    documentoPdf({ titulo: `PLANO DE FÉRIAS — ${(unidade?.nome ?? 'ESCOLA SUPERIOR DE GUERRA').toLocaleUpperCase('pt')}`, subtitulo: `Ano de ${ano}`, orientacao: 'landscape', seccoes: [seccao('Militares', linhas.filter((l) => l.tipo === 'militar')), seccao('Pessoal civil', linhas.filter((l) => l.tipo === 'civil'))].filter((s) => s.linhas.length) })
  }

  return (
    <>
      <Cabecalho titulo={<><i className="fa fa-umbrella-beach me-2" style={{ color: '#e65100' }} />Plano de Férias por Unidade</>} subtitulo={`seleccione a unidade e o ano — ${ano}`} migalhas={[['Carreiras'], ['Plano de férias']]}>
        {dados && <>
          <button type="button" className="btn btn-white" onClick={() => exportarExcel(titulo, colunas, dados.linhas)}><i className="fa fa-file-download me-1" />Exportar</button>
          <button type="button" className="btn btn-white" onClick={imprimir}><i className="fa fa-print me-1" />Imprimir</button>
          {editar && <button type="button" className="btn btn-theme" onClick={() => setCarregar(true)}><i className="fa fa-file-excel me-1" />Carregar Excel</button>}
        </>}
      </Cabecalho>

      <GuiasDoMes />

      <div className="card mb-3"><div className="card-body d-flex flex-wrap gap-3 align-items-end">
        <div style={{ minWidth: 280 }}><label className="form-label small fw-bold mb-1" htmlFor="pf-unidade">Unidade</label><Escolha id="pf-unidade" valor={unidadeId} aoMudar={setUnidadeId} opcoes={arvore.opcoes} vazio="Toda a Escola" /></div>
        <div><label className="form-label small fw-bold mb-1" htmlFor="pf-ano">Ano</label><input id="pf-ano" type="number" className="form-control form-control-sm" style={{ width: 100 }} value={ano} min={2000} max={2100} onChange={(e) => setAno(Number(e.target.value) || new Date().getFullYear())} /></div>
        <div><label className="form-label small fw-bold mb-1" htmlFor="pf-tipo">Pessoal</label><Escolha id="pf-tipo" valor={tipo} aoMudar={setTipo} opcoes={[['militar', 'Militares'], ['civil', 'Civis']]} vazio="Militares e civis" /></div>
        {dados && <div className="ms-auto small text-muted">{dados.planeados} de {dados.linhas.length} com férias marcadas</div>}
      </div></div>

      {erro && <Erro texto={erro} aoRepetir={recarregar} />}
      {!dados && !erro && <Carregando />}
      {dados && (
        <div className="card">
          <div className="table-responsive">
            <table className="pes-pf">
              <thead><tr><th className="text-start">{tipo === 'civil' ? 'Funcionário' : tipo === 'militar' ? 'Militar' : 'Militar / funcionário'}</th>{MESES.map((m) => <th key={m}>{m}</th>)}</tr></thead>
              <tbody>
                {!dados.linhas.length && <tr><td colSpan={13} className="text-muted py-4">Ninguém nesta unidade.</td></tr>}
                {dados.linhas.map((l) => (
                  <tr key={l.id}>
                    <td className="pes-pf-nome"><Link to={`/pessoas/${l.id}`} className="pes-pessoa"><Foto pessoaId={l.id} fotoId={l.fotoId} nome={l.nome} tamanho={24} /><span>{l.nome} <small className="text-muted">({l.tipo === 'militar' ? l.postoAbreviatura : 'Civil'} · {ident(l) || '—'})</small></span></Link></td>
                    {MESES.map((m, i) => (
                      <td key={m} className={editar ? 'pes-pf-mes' : ''} onClick={() => marcar(l, i + 1)} title={editar ? (l.mes === i + 1 ? `Tirar as férias de ${MESES_LONGOS[i]}` : `Férias em ${MESES_LONGOS[i]} (${l.dias}${l.adicionais ? ` + ${l.adicionais}` : ''} dias)`) : ''}>
                        {l.mes === i + 1 && <span className="pes-pf-on">{i + 1}</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <p className="small text-muted mt-2">Férias: 30 dias por ano (Lei n.º 13/18, art. 32.º), mais 15 dias para os militares com mais de 20 anos de serviço. A guia de férias de cada um sai da ficha («Documentos»): o início é o dia 1 do mês planeado; fora do plano escreve-se o início e o fim conta-se sozinho.</p>
      {carregar && <CarregarPlano ano={ano} linhas={dados?.linhas ?? []} unidade={unidade} aoFechar={() => setCarregar(false)} aoCarregar={(r) => { setCarregar(false); avisar(`${r.feitos} pessoa(s) actualizada(s) no plano de férias.${r.avisos.length ? ` Avisos: ${r.avisos.slice(0, 5).join(' | ')}` : ''}`, r.avisos.length ? 'erro' : undefined); recarregar() }} />}
    </>
  )
}

const semAcento = (t) => String(t ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
// «Julho», «jul», «7» → 7
function mesDe(t) {
  const x = semAcento(t)
  if (/^\d{1,2}$/.test(x)) return Number(x) >= 1 && Number(x) <= 12 ? Number(x) : null
  const i = MESES_LONGOS.findIndex((m) => x.length >= 3 && semAcento(m).startsWith(x.slice(0, 3)))
  return i >= 0 ? i + 1 : null
}

/*
  Carregar o plano de um Excel: lê-se o ficheiro (NIP ou n.º de agente e o mês), mostra-se o que se
  encontrou, já seleccionado (quem não está registado ou tem o mês errado fica de fora), e aplica-se.
*/
function CarregarPlano({ ano, linhas, unidade, aoFechar, aoCarregar }) {
  const [erro, setErro] = useState('')
  const [lidas, setLidas] = useState(null)
  const [sel, setSel] = useState(new Set())
  const [aTrabalhar, setATrabalhar] = useState(false)
  const porIdent = new Map(linhas.flatMap((l) => [[String(l.nip ?? ''), l], [String(l.numeroAgente ?? ''), l]]).filter(([k]) => k))

  async function escolher(f) {
    setErro('')
    try {
      const tabela = /\.xlsx$/i.test(f.name) ? await lerXlsx(await f.arrayBuffer()) : /\.(csv|txt)$/i.test(f.name) ? lerCsv(await f.text()) : null
      if (!tabela?.length) throw new Error('Use um Excel (.xlsx) ou CSV com as colunas «nip» (ou «agente») e «mes».')
      const [cab, ...corpo] = tabela
      const col = (re) => cab.findIndex((c) => re.test(semAcento(c)))
      const ci = col(/^(nip|n\.?º? ?agente|agente|identifica)/)
      const cm = col(/^mes/)
      if (ci < 0 || cm < 0) throw new Error('Faltam as colunas «nip» (ou «agente») e «mes» na primeira linha.')
      const l = corpo.filter((r) => String(r[ci] ?? '').trim()).map((r, i) => {
        const ident = String(r[ci]).trim()
        const pessoa = porIdent.get(ident)
        const mes = mesDe(r[cm])
        return { n: i + 2, ident, mesTexto: String(r[cm] ?? ''), mes, pessoa, problema: !pessoa ? (unidade ? 'Não está nesta unidade (ou não está registado)' : 'Não está registado') : !mes ? 'Mês inválido' : '' }
      })
      setLidas(l)
      setSel(new Set(l.filter((x) => !x.problema).map((x) => x.n)))
    } catch (e) {
      setErro(e.message)
    }
  }
  async function aplicar() {
    setATrabalhar(true)
    try {
      const escolhidas = lidas.filter((x) => sel.has(x.n))
      aoCarregar(await api('/plano-ferias/importar', { metodo: 'POST', corpo: { ano, linhas: escolhidas.map((x) => ({ identificador: x.ident, mes: String(x.mes) })) } }))
    } catch (e) {
      setErro(e.message)
      setATrabalhar(false)
    }
  }
  async function modelo() {
    const { default: writeXlsxFile } = await import('write-excel-file/browser')
    const cab = ['nip', 'nome', 'mes'].map((t) => ({ value: t, fontWeight: 'bold' }))
    const corpo = linhas.map((l) => [{ value: String((l.tipo === 'militar' ? l.nip : l.numeroAgente) ?? ''), type: String }, { value: l.nome, type: String }, l.mes ? { value: MESES_LONGOS[l.mes - 1], type: String } : null])
    await writeXlsxFile([cab, ...corpo], { columns: [{ width: 14 }, { width: 40 }, { width: 14 }], sheet: `Plano ${ano}` }).toFile(`plano-ferias-${ano}${unidade ? `-${unidade.sigla || unidade.nome}` : ''}.xlsx`.replace(/\s+/g, '-'))
  }
  const validas = lidas?.filter((x) => !x.problema) ?? []
  return (
    <Modal titulo={`Carregar o plano de férias — ${ano}${unidade ? ` — ${unidade.nome}` : ''}`} aoFechar={aoFechar} largo
      rodape={<>
        <button type="button" className="btn btn-white me-auto" onClick={modelo}><i className="fa fa-file-download me-1" />Descarregar o modelo ({linhas.length} pessoas)</button>
        <button type="button" className="btn btn-white" onClick={aoFechar}>Fechar</button>
        {lidas && <button type="button" className="btn btn-theme" disabled={!sel.size || aTrabalhar} onClick={aplicar}><i className={`fa ${aTrabalhar ? 'fa-spinner fa-spin' : 'fa-check'} me-1`} />Marcar as férias de {sel.size} pessoa(s)</button>}
      </>}>
      {erro && <div className="alert alert-danger py-2">{erro}</div>}
      {!lidas ? <>
        <p className="small text-muted">O ficheiro tem, na primeira linha, as colunas <b>nip</b> (ou <b>agente</b>, para os civis) e <b>mes</b> (o nome do mês ou o número de 1 a 12). Pode descarregar o modelo já com as pessoas{unidade ? ' desta unidade' : ''}, escrever o mês de cada uma e carregá-lo aqui.</p>
        <table className="table table-sm table-bordered w-auto small"><thead><tr><th>nip</th><th>nome</th><th>mes</th></tr></thead><tbody><tr><td>100253568</td><td>(opcional)</td><td>Julho</td></tr><tr><td>22589632</td><td /><td>8</td></tr></tbody></table>
        <Carregar aceitar=".xlsx,.csv,.txt" maxMb={10} compacto icone="fa-file-excel" titulo="Arraste o Excel para aqui" ajuda="Excel (.xlsx) ou CSV" aoEscolher={escolher} />
      </> : <>
        <div className="d-flex align-items-center gap-2 mb-2">
          <span className="small">{lidas.length} linha(s) lidas · <b className="text-success">{validas.length} encontradas</b>{lidas.length > validas.length && <> · <b className="text-danger">{lidas.length - validas.length} com problemas</b></>}</span>
          <button type="button" className="btn btn-link btn-sm ms-auto p-0" onClick={() => setSel(sel.size === validas.length ? new Set() : new Set(validas.map((x) => x.n)))}>{sel.size === validas.length ? 'Nenhuma' : 'Todas'}</button>
          <button type="button" className="btn btn-link btn-sm p-0" onClick={() => setLidas(null)}>Outro ficheiro</button>
        </div>
        <div className="table-responsive" style={{ maxHeight: 400 }}>
          <table className="table table-sm align-middle mb-0">
            <thead><tr><th /><th>Linha</th><th>NIP / agente</th><th>Nome</th><th>Mês</th><th>Agora</th></tr></thead>
            <tbody>{lidas.map((x) => (
              <tr key={x.n} className={x.problema ? 'table-danger' : ''}>
                <td><input type="checkbox" className="form-check-input" disabled={Boolean(x.problema)} checked={sel.has(x.n)} onChange={() => setSel((s) => { const n = new Set(s); if (n.has(x.n)) n.delete(x.n); else n.add(x.n); return n })} aria-label={`Linha ${x.n}`} /></td>
                <td className="small text-muted">{x.n}</td><td className="font-monospace small">{x.ident}</td>
                <td>{x.pessoa ? x.pessoa.nome : <span className="small text-danger">{x.problema}</span>}</td>
                <td>{x.mes ? <span className="pes-pf-on" style={{ width: 'auto', padding: '0 8px' }}>{MESES_LONGOS[x.mes - 1]}</span> : <span className="small text-danger">{x.mesTexto || '—'} (mês inválido)</span>}</td>
                <td className="small text-muted">{x.pessoa?.mes ? MESES_LONGOS[x.pessoa.mes - 1] : '—'}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </>}
    </Modal>
  )
}

/*
  Guias de férias do mês, prontas a imprimir: quando o mês chega, o sistema emite sozinho a guia de cada pessoa do
  plano desse mês (os dias a que tem direito) e regista a licença e a saída no expediente. Quem vem levantar: selecciona-se
  a guia (uma, várias ou todas) e imprime-se; o dia da impressão fica a data da guia, o levantamento e o início das
  férias, e o fim recalcula-se sozinho. Para um mês que ainda não chegou, «Preparar já» emite-as antes.
*/
function GuiasDoMes() {
  const { pode, avisar } = useSessao()
  const h = new Date()
  const [mesAno, setMesAno] = useState(`${h.getFullYear()}-${h.getMonth() + 1}`)
  const [ano, mes] = mesAno.split('-').map(Number)
  const { dados, erro, recarregar } = useDados('/plano-ferias/guias', { ano, mes })
  const [aFazer, setAFazer] = useState(false)
  const opcoes = [-1, 0, 1, 2].map((d) => new Date(h.getFullYear(), h.getMonth() + d, 1)).map((x) => [`${x.getFullYear()}-${x.getMonth() + 1}`, `${MESES_LONGOS[x.getMonth()]} de ${x.getFullYear()}`])
  const linhas = dados?.linhas ?? []
  const prontas = linhas.filter((l) => l.guia)
  const porImprimir = prontas.filter((l) => !l.guia.impressoes)
  const semGuia = linhas.filter((l) => !l.guia)

  async function preparar() {
    setAFazer(true)
    try {
      const r = await api('/plano-ferias/guias', { metodo: 'POST', corpo: { ano, mes } })
      avisar(`${r.preparadas} guia(s) preparada(s).${r.erros.length ? ` Não foi possível: ${r.erros.join('; ')}` : ''}`, r.erros.length ? 'erro' : undefined)
      recarregar()
    } catch (e) {
      avisar(e.message, 'erro')
    } finally {
      setAFazer(false)
    }
  }

  const levantadas = prontas.filter((l) => l.guia.levantadaEm).length
  const [marcadas, setMarcadas] = useState(() => new Set())
  const escolhidas = prontas.filter((l) => marcadas.has(l.guia.id))
  const todasMarcadas = prontas.length > 0 && escolhidas.length === prontas.length
  const marcar = (id) => setMarcadas((m) => { const n = new Set(m); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const marcarTodas = () => setMarcadas(todasMarcadas ? new Set() : new Set(prontas.map((l) => l.guia.id)))
  const dia = (iso) => String(iso ?? '').split('-').reverse().join('/')

  /*
    Imprimir as guias de quem veio levantar: na primeira impressão o sistema regista o dia de hoje (data da guia e
    levantamento), as férias começam hoje e o fim recalcula-se pelos dias a que tem direito. Reimprimir não muda as datas.
  */
  async function imprimir(lista) {
    if (!lista.length) return
    setAFazer(true)
    try {
      const novos = new Map((await api('/plano-ferias/guias/imprimir', { metodo: 'POST', corpo: { ids: lista.map((l) => l.guia.id) } })).map((g) => [g.id, g.dados]))
      const [quem, ...fichas] = await Promise.all([api('/definicoes/assinaturas'), ...lista.map((l) => api(`/pessoas/${l.pessoa.id}`))])
      const porId = new Map(fichas.map((p) => [p.id, p]))
      await gerarLote(lista.map((l) => ({ p: porId.get(l.pessoa.id), escolha: { tipo: 'guia_ferias', dados: novos.get(l.guia.id) ?? l.guia.dados }, emitido: {} })), quem, `guias-de-ferias-${MESES_LONGOS[mes - 1].toLowerCase()}-${ano}.pdf`)
      setMarcadas(new Set())
      recarregar()
    } catch (e) {
      avisar(`Não foi possível fazer as guias: ${e.message}`, 'erro')
      recarregar()
    } finally {
      setAFazer(false)
    }
  }

  return (
    <div className="card mb-3">
      <div className="card-header d-flex flex-wrap gap-2 align-items-center">
        <span className="fw-bold flex-grow-1"><i className="fa fa-file-signature me-2" style={{ color: '#e65100' }} />Guias de férias do mês</span>
        <select className="form-select form-select-sm w-auto" value={mesAno} onChange={(e) => setMesAno(e.target.value)} aria-label="Mês das guias">
          {opcoes.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
        </select>
      </div>
      <div className="card-body">
        {erro && <Erro texto={erro} />}
        {!dados && !erro && <Carregando />}
        {dados && !linhas.length && <div className="text-muted">Ninguém no plano de férias de {MESES_LONGOS[mes - 1]} de {ano}.</div>}
        {dados && linhas.length > 0 && <>
          <div className="d-flex flex-wrap gap-2 align-items-center mb-2">
            <span>{linhas.length} pessoa(s) de férias em {MESES_LONGOS[mes - 1]}: <b>{prontas.length} guia(s) pronta(s)</b>{porImprimir.length ? `, ${porImprimir.length} por imprimir` : ''}{semGuia.length ? `, ${semGuia.length} por preparar` : ''}{prontas.length ? `; ${levantadas} levantada(s)` : ''}.</span>
            <span className="flex-grow-1" />
            {pode('editar') && semGuia.length > 0 && <button type="button" className="btn btn-sm btn-white" disabled={aFazer} onClick={preparar}><i className="fa fa-magic me-1" />Preparar já ({semGuia.length})</button>}
            {pode('emitir') && prontas.length > 0 && <button type="button" className="btn btn-sm btn-theme" disabled={aFazer || !escolhidas.length} onClick={() => imprimir(escolhidas)}><i className="fa fa-print me-1" />Imprimir as seleccionadas ({escolhidas.length})</button>}
          </div>
          <div className="table-responsive">
            <table className="table table-sm align-middle mb-0">
              <thead><tr>{pode('emitir') && <th style={{ width: 32 }}><input type="checkbox" className="form-check-input" checked={todasMarcadas} disabled={!prontas.length} onChange={marcarTodas} aria-label="Seleccionar todas as guias" title="Seleccionar todas" /></th>}<th>Nome</th><th>Posto / categoria</th><th>Unidade</th><th>Guia</th><th>Levantou em</th>{pode('emitir') && <th />}</tr></thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={l.pessoa.id} className={l.guia && marcadas.has(l.guia.id) ? 'table-active' : undefined}>
                    {pode('emitir') && <td>{l.guia && <input type="checkbox" className="form-check-input" checked={marcadas.has(l.guia.id)} onChange={() => marcar(l.guia.id)} aria-label={`Seleccionar a guia de ${l.pessoa.nome}`} />}</td>}
                    <td><Link to={`/pessoas/${l.pessoa.id}?aba=emitidos`}>{l.pessoa.nome}</Link><div className="small text-muted">{l.pessoa.nip ? `NIP ${l.pessoa.nip}` : l.pessoa.numeroAgente ? `Agente ${l.pessoa.numeroAgente}` : ''}</div></td>
                    <td className="small">{l.pessoa.postoNome}</td>
                    <td className="small">{l.pessoa.unidadeNome}</td>
                    <td className="small">
                      {!l.guia && <span className="badge bg-warning text-dark">Por preparar</span>}
                      {l.guia && (l.guia.impressoes ? <span className="badge bg-success">Impressa</span> : <span className="badge bg-info">Pronta, por imprimir</span>)}
                      {l.guia && (l.guia.impressoes && l.guia.dados?.fim
                        ? <div className="text-muted">de {dia(l.guia.dados.inicio)} a {dia(l.guia.dados.fim)} ({l.guia.dados.dias} dias)</div>
                        : <div className="text-muted">{l.guia.dados?.dias} dias; começam no dia em que imprimir</div>)}
                    </td>
                    <td className="small">
                      {l.guia?.levantadaEm ? dia(l.guia.levantadaEm) : <span className="text-muted">—</span>}
                    </td>
                    {pode('emitir') && <td className="text-end">{l.guia && <button type="button" className="btn btn-xs btn-white" disabled={aFazer} onClick={() => imprimir([l])} title={l.guia.impressoes ? 'Imprimir outra cópia (as datas não mudam)' : 'Imprimir: as férias começam hoje'}><i className="fa fa-print me-1" />{l.guia.impressoes ? 'Cópia' : 'Imprimir'}</button>}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>}
        <div className="small text-muted mt-2">Quando o mês chega, as guias de quem está no plano preparam-se sozinhas (com a licença de férias e a saída no expediente). Quando o militar vem levantar, seleccione a guia (ou várias, ou todas) e clique em imprimir: o sistema regista o dia, as férias começam nesse dia e o fim conta-se sozinho pelos dias a que tem direito. Uma cópia depois não muda as datas. As férias adicionais (15 dias) continuam a fazer-se na ficha.</div>
      </div>
    </div>
  )
}
