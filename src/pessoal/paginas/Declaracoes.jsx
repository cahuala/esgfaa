import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useDados } from '../useDados'
import { useSessao } from '../sessao'
import Foto from '../componentes/Foto'
import { Cabecalho, Carregando, Erro } from '../componentes/Ui'
import { CATALOGO, documentosPara, gerarLote, vencimentoDaTabela } from '../docPessoal'
import { kwanzas } from '../docPessoal/base'
import { documentoPdf, exportarExcel } from '../exportar'
import { dataPt } from '../formatar'

const FINALIDADES = ['Efeito de Actualização de Conta Bancária', 'Abertura de Conta Bancária', 'Crédito Pessoal', 'Crédito Bancário', 'Adiantamento Salarial', 'Obtenção de Visto', 'Emissão de Passaporte', 'Arrendamento / Habitação', 'Matrícula Escolar', 'Efeitos Administrativos']
const hojeIso = () => new Date().toISOString().slice(0, 10)
const inicioMes = () => `${hojeIso().slice(0, 8)}01`
const quemE = (p) => [p.tipo === 'militar' ? p.postoNome : 'Civil', p.nip || p.numeroAgente].filter(Boolean).join(' · ')

/*
  Declarações (como no SIGP): pedir uma nova (procura-se o militar ou o funcionário, escolhe-se o tipo e a
  finalidade), e o controlo de todas as emitidas: número, finalidade, quem emitiu e quantas vezes se
  imprimiu. Reimprime-se com o mesmo número e a data da emissão; imprimem-se várias de uma vez; tira-se
  a relação das emitidas num período.
*/
export default function Declaracoes() {
  const { pode, avisar } = useSessao()
  const [filtros, setFiltros] = useState({ q: '', tipo: '', de: inicioMes(), ate: hojeIso() })
  const { dados, erro, recarregar } = useDados('/declaracoes', filtros)
  const [marcadas, setMarcadas] = useState(new Set())
  const [aImprimir, setAImprimir] = useState(false)
  const editar = pode('editar')

  // reimprime (o mesmo número, a data da emissão); várias pessoas saem num só PDF
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

  const colunas = [
    { titulo: 'Nº', valor: (x) => x.referencia, alinhar: 'center' }, { titulo: 'Tipo', valor: (x) => x.nome.replace('Declaração de ', '') },
    { titulo: 'Militar / Funcionário', valor: (x) => `${quemE(x.pessoa)} — ${x.pessoa.nome}` }, { titulo: 'Finalidade', valor: (x) => x.finalidade },
    { titulo: 'Data', valor: (x) => dataPt(x.criadoEm), alinhar: 'center' }, { titulo: 'Impressões', valor: (x) => x.impressoes, alinhar: 'center' }, { titulo: 'Emitida por', valor: (x) => x.emitidoPor },
  ]
  const relacao = () => documentoPdf({ titulo: 'Relação das declarações emitidas', subtitulo: `Período: ${dataPt(filtros.de)} a ${dataPt(filtros.ate)}`, orientacao: 'landscape', seccoes: [{ colunas: [{ titulo: 'N/O', valor: (_, i) => String(i + 1).padStart(2, '0'), alinhar: 'center', largura: 11 }, ...colunas], linhas: [...(dados ?? [])].reverse() }] })
  const todas = dados?.length > 0 && dados.every((x) => marcadas.has(x.id))

  return (
    <>
      <Cabecalho titulo={<><i className="fa fa-file-signature me-2 pes-ouro" />Declarações</>} subtitulo={`solicitar, listar e imprimir declarações — ${dados?.length ?? 0} registos`} migalhas={[['Documentos'], ['Declarações']]} />
      {editar && <NovaDeclaracao aoEmitir={recarregar} />}

      <div className="pes-bloco">
        <div className="pes-bloco-t">
          <span><i className="fa fa-list me-2" />Declarações registadas</span>
          <div className="d-flex gap-2 flex-wrap">
            <button type="button" className="btn btn-xs btn-white" disabled={!marcadas.size || aImprimir} onClick={() => imprimir(dados.filter((x) => marcadas.has(x.id)))}><i className={`fa ${aImprimir ? 'fa-spinner fa-spin' : 'fa-print'} me-1`} />Imprimir seleccionadas {marcadas.size ? `(${marcadas.size})` : ''}</button>
            <button type="button" className="btn btn-xs btn-white" disabled={!dados?.length} onClick={relacao} title="A relação das declarações emitidas no período"><i className="fa fa-print me-1" />Relação</button>
            <button type="button" className="btn btn-xs btn-white" disabled={!dados?.length} onClick={() => exportarExcel('Declarações emitidas', colunas, dados)}><i className="fa fa-file-excel me-1 text-success" />Excel</button>
          </div>
        </div>
        <div className="pes-bloco-c d-flex flex-wrap gap-2 align-items-end border-bottom">
          <div className="pes-pesquisa flex-grow-1"><i className="fa fa-search" /><input className="form-control form-control-sm" value={filtros.q} onChange={(e) => setFiltros({ ...filtros, q: e.target.value })} placeholder="Pesquisar por NIP, nome, tipo ou nº da declaração…" aria-label="Pesquisar declarações" /></div>
          <select className="form-select form-select-sm w-auto" value={filtros.tipo} onChange={(e) => setFiltros({ ...filtros, tipo: e.target.value })} aria-label="Tipo"><option value="">Todos os tipos</option>{CATALOGO.filter((c) => c.grupo === 'declaracoes').map((c) => <option key={c.tipo} value={c.tipo}>{c.nome}</option>)}</select>
          <span className="small text-muted">Emitidas de</span>
          <input type="date" className="form-control form-control-sm w-auto" value={filtros.de} onChange={(e) => setFiltros({ ...filtros, de: e.target.value })} aria-label="De" />
          <span className="small text-muted">a</span>
          <input type="date" className="form-control form-control-sm w-auto" value={filtros.ate} onChange={(e) => setFiltros({ ...filtros, ate: e.target.value })} aria-label="Até" />
        </div>
        {erro ? <div className="p-3"><Erro texto={erro} aoRepetir={recarregar} /></div> : !dados ? <Carregando /> : (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead><tr>
                <th style={{ width: 34 }}><input type="checkbox" className="form-check-input" checked={todas} onChange={() => setMarcadas(todas ? new Set() : new Set(dados.map((x) => x.id)))} aria-label="Todas" /></th>
                <th>Nº</th><th>Militar / Funcionário</th><th>Tipo</th><th>Finalidade</th><th>Emitida</th><th className="text-center">Impressões</th><th className="text-end">Acções</th>
              </tr></thead>
              <tbody>
                {!dados.length && <tr><td colSpan={8} className="text-center text-muted py-4"><i className="fa fa-search d-block mb-2 opacity-50" />Sem declarações neste período{filtros.q ? ` para «${filtros.q}»` : ''}.</td></tr>}
                {dados.map((x) => (
                  <tr key={x.id}>
                    <td><input type="checkbox" className="form-check-input" checked={marcadas.has(x.id)} onChange={() => setMarcadas((m) => { const n = new Set(m); if (n.has(x.id)) n.delete(x.id); else n.add(x.id); return n })} aria-label={`Seleccionar ${x.referencia}`} /></td>
                    <td className="fw-bold text-nowrap">{x.referencia}</td>
                    <td><Link to={`/pessoas/${x.pessoa.id}?aba=emitidos`} className="pes-pessoa"><Foto pessoaId={x.pessoa.id} fotoId={x.pessoa.fotoId} nome={x.pessoa.nome} tamanho={32} /><span><span className="small fw-semibold pes-ouro">{quemE(x.pessoa)} {x.pessoa.tipo === 'civil' && <span className="badge bg-light text-dark border">CIVIL</span>}</span><br /><span className="fw-semibold">{x.pessoa.nome}</span>{x.pessoa.cargoNome && <span className="small text-muted"> · {x.pessoa.cargoNome}</span>}</span></Link></td>
                    <td className="small">{x.nome.replace('Declaração de ', '')}</td>
                    <td className="small">{x.finalidade || <span className="text-muted">—</span>}{x.dados?.valor ? <div className="text-muted">{kwanzas(x.dados.valor)} KZ</div> : null}</td>
                    <td className="small text-nowrap">{dataPt(x.criadoEm)}<div className="text-muted">{x.emitidoPor}</div></td>
                    <td className="text-center small">{x.impressoes ? <><span className="badge bg-secondary">{x.impressoes}</span><div className="text-muted">{dataPt(x.ultimaImpressao)}</div></> : <span className="badge bg-warning text-dark">Por imprimir</span>}</td>
                    <td className="text-end"><button type="button" className="btn btn-xs btn-theme" disabled={aImprimir} onClick={() => imprimir([x])}><i className="fa fa-print me-1" />Imprimir</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}

// pedir uma declaração: procurar a pessoa, escolher o tipo, a finalidade e o vencimento
function NovaDeclaracao({ aoEmitir }) {
  const { avisar } = useSessao()
  const { dados: pessoas } = useDados('/pessoas')
  const [q, setQ] = useState('')
  const [p, setP] = useState(null)
  const [f, setF] = useState({ tipo: '', finalidade: '', comVencimento: 'Sim', valor: '', curso: '' })
  const [aEmitir, setAEmitir] = useState(false)
  const termo = q.trim().toLowerCase()
  const encontrados = useMemo(() => (termo.length < 2 || !pessoas ? [] : pessoas.filter((x) => [x.nome, x.nip, x.numeroAgente, x.bi].some((v) => String(v ?? '').toLowerCase().includes(termo))).slice(0, 8)), [termo, pessoas])
  const tipos = p ? documentosPara(p).filter((c) => c.grupo === 'declaracoes') : []

  async function escolher(x) {
    setQ('')
    try {
      const ficha = await api(`/pessoas/${x.id}`)
      setP(ficha)
      const t = documentosPara(ficha).find((c) => c.grupo === 'declaracoes')
      setF({ tipo: t?.tipo ?? '', finalidade: '', comVencimento: 'Sim', valor: ficha.vencimento ?? '', curso: (ficha.cursos ?? []).find((c) => !c.fim)?.nome || (ficha.vinculo === 'estudante' ? ficha.unidadeNome : '') || '' })
    } catch (e) {
      avisar(e.message, 'erro')
    }
  }
  async function emitir() {
    if (!f.tipo) { avisar('Escolha o tipo de declaração.', 'erro'); return }
    setAEmitir(true)
    try {
      const dadosDoc = { finalidade: f.finalidade.trim(), comVencimento: f.tipo === 'declaracao_salario' ? 'Sim' : f.comVencimento, ...(f.valor !== '' ? { valor: Number(f.valor) } : {}), ...(f.curso && f.tipo === 'declaracao_efectividade' ? { curso: f.curso } : {}) }
      const [emitidos, quem] = await Promise.all([api(`/pessoas/${p.id}/documentos-emitidos`, { metodo: 'POST', corpo: { documentos: [{ tipo: f.tipo, dados: dadosDoc }] } }), api('/definicoes/assinaturas')])
      await gerarLote([{ p, escolha: { tipo: f.tipo, dados: dadosDoc }, emitido: emitidos[0] }], quem, `declaracao-${emitidos[0].numero}-${emitidos[0].ano}.pdf`)
      await api('/declaracoes/impressoes', { metodo: 'POST', corpo: { ids: [emitidos[0].id] } })
      avisar(`Declaração Nº${String(emitidos[0].numero).padStart(3, '0')}/${String(emitidos[0].ano).slice(-2)} registada e impressa.`)
      setP(null)
      aoEmitir()
    } catch (e) {
      avisar(e.message, 'erro')
    } finally {
      setAEmitir(false)
    }
  }
  const tabela = p ? vencimentoDaTabela(p) : null

  return (
    <div className="pes-bloco">
      <div className="pes-bloco-t"><span><i className="fa fa-plus-circle me-2" />Solicitar nova declaração</span></div>
      <div className="pes-bloco-c">
        <div className="row g-3">
          <div className="col-lg-5 position-relative">
            <label className="form-label small fw-bold mb-1" htmlFor="dec-q">Pesquisar militar ou funcionário (NIP, n.º de agente, BI ou nome)</label>
            <input id="dec-q" className="form-control" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Escreva o NIP ou o nome…" autoComplete="off" />
            {encontrados.length > 0 && (
              <div className="list-group position-absolute w-100 shadow pes-sugestoes" style={{ zIndex: 20 }}>
                {encontrados.map((x) => <button key={x.id} type="button" className="list-group-item list-group-item-action d-flex align-items-center gap-2" onClick={() => escolher(x)}><Foto pessoaId={x.id} fotoId={x.fotoId} nome={x.nome} tamanho={28} /><span><span className="fw-semibold">{x.nome}</span><br /><small className="text-muted">{quemE(x)} · {x.vinculoNome}</small></span></button>)}
              </div>
            )}
          </div>
          {p && <>
            <div className="col-lg-3">
              <label className="form-label small fw-bold mb-1" htmlFor="dec-tipo">Tipo de declaração</label>
              <select id="dec-tipo" className="form-select" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>{tipos.map((c) => <option key={c.tipo} value={c.tipo}>{c.nome}</option>)}</select>
            </div>
            <div className="col-lg-4">
              <label className="form-label small fw-bold mb-1" htmlFor="dec-fin">Finalidade</label>
              <input id="dec-fin" className="form-control" list="dec-finalidades" value={f.finalidade} onChange={(e) => setF({ ...f, finalidade: e.target.value })} placeholder="Ex.: Efeito de Actualização de Conta Bancária" />
              <datalist id="dec-finalidades">{FINALIDADES.map((x) => <option key={x} value={x} />)}</datalist>
            </div>
          </>}
        </div>
        {p && (
          <>
            <div className="pes-dec-pessoa my-3">
              <Foto pessoaId={p.id} fotoId={p.fotoId} nome={p.nome} tamanho={50} />
              <div className="flex-grow-1"><div className="fw-bold pes-ouro-escuro">{p.nome}</div><div className="small text-muted">{quemE(p)} · {p.vinculoNome}{p.cargo?.nome ? ` · ${p.cargo.nome}` : ''}</div></div>
              <div className="text-end small text-muted font-monospace">{p.iban || ''}<div>{p.banco || ''}</div></div>
            </div>
            <div className="row g-3 align-items-end">
              {f.tipo !== 'declaracao_salario' && <div className="col-md-3"><label className="form-label small fw-bold mb-1" htmlFor="dec-cv">Fala do vencimento?</label><select id="dec-cv" className="form-select" value={f.comVencimento} onChange={(e) => setF({ ...f, comVencimento: e.target.value })}><option>Sim</option><option>Não</option></select></div>}
              {(f.comVencimento === 'Sim' || f.tipo === 'declaracao_salario') && <div className="col-md-3"><label className="form-label small fw-bold mb-1" htmlFor="dec-v">Salário líquido (KZ)</label><input id="dec-v" type="number" step="0.01" min="0" className="form-control" value={f.valor} onChange={(e) => setF({ ...f, valor: e.target.value })} placeholder={tabela ? kwanzas(tabela) : ''} /><div className="form-text small">{f.valor === '' ? (tabela ? `Vazio = o da tabela salarial (${kwanzas(tabela)} KZ).` : 'Sem tabela: escreva o vencimento.') : 'Vai o que escreveu.'}</div></div>}
              {f.tipo === 'declaracao_efectividade' && (p.discente || p.vinculo === 'estudante') && <div className="col-md-4"><label className="form-label small fw-bold mb-1" htmlFor="dec-c">Discente do (curso)</label><input id="dec-c" className="form-control" value={f.curso} onChange={(e) => setF({ ...f, curso: e.target.value })} /></div>}
              <div className="col-md-auto ms-auto d-flex gap-2">
                <button type="button" className="btn btn-white" onClick={() => setP(null)}><i className="fa fa-times me-1" />Limpar</button>
                <button type="button" className="btn btn-theme" disabled={aEmitir} onClick={emitir}><i className={`fa ${aEmitir ? 'fa-spinner fa-spin' : 'fa-save'} me-1`} />Registar e imprimir</button>
              </div>
            </div>
          </>
        )}
        {!p && <p className="small text-muted mb-0 mt-2">A declaração recebe o número seguinte do ano (a série é a mesma para todas as declarações) e fica registada aqui e na ficha da pessoa.</p>}
      </div>
    </div>
  )
}
