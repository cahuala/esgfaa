import { useCallback, useEffect, useState } from 'react'
import { FaEye, FaEyeSlash, FaPrint, FaSave } from 'react-icons/fa'
import { Cartao, Vazio } from '../componentes'
import { Nota, Situacao } from '../avaliacao'
import { dataHora } from '../formatar'
import { FORMAS_AVALIACAO, NOTA_MAXIMA_RECUPERACAO, REGRA_ESG, SITUACOES, TIPOS_AVALIACAO, resultadoUc } from '../regraAvaliacao'
import { t as tx } from '../../i18n/linguas'
import CabecalhoImpressao from '../../components/CabecalhoImpressao'

const paraTexto = (v) => (v === null || v === undefined ? '' : String(v).replace('.', ','))
const paraNumero = (v) => {
  const t = String(v ?? '').trim().replace(',', '.')
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) && n >= 0 && n <= 20 ? n : undefined
}
const VAZIA = { tipo: 'TAI', forma: 'teste', titulo: '', data: '' }

/*
  Pauta pelo plano de curso da ESG (docente no portal e Administração Escolar no painel): as provas da UC
  (TAI e TAG) em colunas, a nota de cada auditor/discente e, nos TAI negativos, o teste de recuperação; a nota
  da UC, a situação e a menção calculam-se enquanto se escreve. Cada prova publica-se à parte: a publicação
  abre o prazo de pedido de recuperação (até às 17h do dia útil seguinte).
  pedir(caminho, opções): a função da API (portal ou painel); base: «/cadeiras/:id».
*/
export function PautaEsg({ c, avisar, pedir, base }) {
  const [p, setP] = useState(null)
  const [edicao, setEdicao] = useState({}) // { provaId: { estudanteId: { nota, recuperacao } } }
  const [mudadas, setMudadas] = useState(new Set())
  const [aGuardar, setAGuardar] = useState(false)
  const [nova, setNova] = useState(null)

  const aplicar = useCallback((r) => {
    setP(r)
    setEdicao(Object.fromEntries(r.avaliacoes.map((a) => [a.id, Object.fromEntries(r.linhas.map((l) => [l.estudante.id, { nota: paraTexto(l.notas[a.id]?.nota), recuperacao: paraTexto(l.notas[a.id]?.recuperacao) }]))])))
    setMudadas(new Set())
  }, [])
  const falhou = useCallback((e) => avisar({ tipo: 'erro', texto: e.message }), [avisar])
  useEffect(() => { pedir(`${base}/pauta`).then(aplicar).catch(falhou) }, [base, pedir, aplicar, falhou])

  if (!p) return <p className="p-texto-suave">{tx('A carregar a pauta…')}</p>
  const termo = p.plano?.termo === 'auditor' ? tx('Auditor') : tx('Discente')
  if (p.linhas.length === 0) return <Vazio>{tx('A turma não tem estudantes matriculados.')}</Vazio>

  const mudar = (provaId, estudanteId, k, v) => {
    setEdicao({ ...edicao, [provaId]: { ...edicao[provaId], [estudanteId]: { ...edicao[provaId][estudanteId], [k]: v } } })
    setMudadas(new Set([...mudadas, provaId]))
  }
  // o resultado de cada linha com o que está escrito (a mesma regra da API)
  const resultado = (l) => {
    if (c.tii) return { final: l.final, situacao: l.situacao, mencao: l.mencao, invalidas: [] }
    const invalidas = []
    const notas = Object.fromEntries(p.avaliacoes.map((a) => {
      const e = edicao[a.id]?.[l.estudante.id] ?? {}
      const nota = paraNumero(e.nota)
      const rec = paraNumero(e.recuperacao)
      if (nota === undefined) invalidas.push(`${a.id}-nota`)
      if (rec === undefined) invalidas.push(`${a.id}-rec`)
      return [a.id, { nota: nota ?? null, recuperacao: rec ?? null, recuperacaoPedidaEm: l.notas[a.id]?.recuperacaoPedidaEm }]
    }))
    return { ...resultadoUc(p.avaliacoes, notas, { exigirTesteEscrito: p.plano?.exigirTesteEscrito !== false }), invalidas }
  }
  const resultados = Object.fromEntries(p.linhas.map((l) => [l.estudante.id, resultado(l)]))
  const temInvalidas = Object.values(resultados).some((r) => r.invalidas.length)
  const contagem = Object.values(resultados).reduce((s, r) => ({ ...s, [r.situacao]: (s[r.situacao] || 0) + 1 }), {})

  async function guardar() {
    setAGuardar(true)
    try {
      let r = p
      for (const id of mudadas) {
        const linhas = p.linhas.map((l) => ({ estudanteId: l.estudante.id, nota: paraNumero(edicao[id][l.estudante.id].nota), recuperacao: paraNumero(edicao[id][l.estudante.id].recuperacao) }))
        r = await pedir(`${base}/provas/${id}/notas`, { metodo: 'PUT', corpo: { linhas } })
      }
      aplicar(r)
      avisar({ texto: tx('Pauta guardada.') })
    } catch (e) {
      falhou(e)
    } finally {
      setAGuardar(false)
    }
  }
  const publicar = (a) => pedir(`${base}/provas/${a.id}/publicacao`, { metodo: 'PUT', corpo: { publicar: !a.publicadaEm } })
    .then((r) => { aplicar(r); avisar({ texto: a.publicadaEm ? tx('{0}: escondida.', { 0: a.titulo }) : tx('{0}: publicada. Abriu o prazo de pedido de recuperação.', { 0: a.titulo }) }) }).catch(falhou)
  const apagar = (a) => pedir(`${base}/provas/${a.id}`, { metodo: 'DELETE' }).then(aplicar).catch(falhou)
  async function criar(e) {
    e.preventDefault()
    try {
      aplicar(await pedir(`${base}/provas`, { metodo: 'POST', corpo: { ...nova, data: nova.data || null } }))
      setNova(null)
    } catch (x) {
      falhou(x)
    }
  }

  return (
    <div className="p-coluna">
      <div className="p-pauta-barra">
        <div className="p-pauta-contagem">
          <span className="badge bg-dark me-1" title={p.plano?.nome}><i className="fa fa-clipboard-list me-1" />{tx('Plano de curso da ESG')}</span>
          {Object.entries(SITUACOES).filter(([k]) => contagem[k]).map(([k, s]) => <span key={k} className={`badge ${{ cinzento: 'bg-gray-400', verde: 'bg-success', azul: 'bg-primary', dourado: 'bg-warning text-dark', vermelho: 'bg-danger' }[s.cor]}`}>{s.texto}: {contagem[k]}</span>)}
        </div>
        <div className="p-acoes-linha p-sem-impressao">
          {mudadas.size > 0 && <span className="p-por-guardar">{tx('Alterações por guardar')}</span>}
          {!c.tii && <button type="button" className="btn btn-white" onClick={() => setNova(nova ? null : VAZIA)}><i className="fa fa-plus me-1" />{tx('Nova prova')}</button>}
          <button type="button" className="btn btn-white" onClick={() => window.print()}><FaPrint aria-hidden="true" /> {tx('Imprimir')}</button>
          {!c.tii && <button type="button" className="btn btn-theme" onClick={guardar} disabled={!mudadas.size || aGuardar || temInvalidas}><FaSave aria-hidden="true" /> {aGuardar ? tx('A guardar…') : tx('Guardar pauta')}</button>}
        </div>
      </div>

      {nova && (
        <form className="panel p-3 mb-2 p-sem-impressao" onSubmit={criar}>
          <div className="row g-2 align-items-end">
            <div className="col-md-2"><label className="form-label small fw-bold" htmlFor="pr-tipo">{tx('Tipo')}</label><select id="pr-tipo" className="form-select form-select-sm" value={nova.tipo} onChange={(e) => setNova({ ...nova, tipo: e.target.value, forma: e.target.value === 'TAG' ? 'trabalho' : 'teste' })}>{Object.entries(TIPOS_AVALIACAO).map(([k, t]) => <option key={k} value={k} title={t}>{k} — {tx(t)}</option>)}</select></div>
            <div className="col-md-2"><label className="form-label small fw-bold" htmlFor="pr-forma">{tx('Forma')}</label><select id="pr-forma" className="form-select form-select-sm" value={nova.forma} onChange={(e) => setNova({ ...nova, forma: e.target.value })}>{Object.entries(FORMAS_AVALIACAO).map(([k, t]) => <option key={k} value={k}>{tx(t)}</option>)}</select></div>
            <div className="col-md-4"><label className="form-label small fw-bold" htmlFor="pr-tit">{tx('Título')}</label><input id="pr-tit" className="form-control form-control-sm" required minLength={2} maxLength={150} value={nova.titulo} onChange={(e) => setNova({ ...nova, titulo: e.target.value })} placeholder={tx('Ex.: Teste escrito 1')} /></div>
            <div className="col-md-2"><label className="form-label small fw-bold" htmlFor="pr-data">{tx('Data')}</label><input id="pr-data" type="date" className="form-control form-control-sm" value={nova.data} onChange={(e) => setNova({ ...nova, data: e.target.value })} /></div>
            <div className="col-md-2"><button type="submit" className="btn btn-sm btn-theme w-100"><i className="fa fa-plus me-1" />{tx('Criar')}</button></div>
          </div>
          {nova.forma === 'relatorio' && <div className="small text-muted mt-2">{tx('Relatório individual: mínimo de 1600 e máximo de 2000 palavras (plano de curso).')}</div>}
        </form>
      )}

      {c.tii && <div className="alert alert-info py-2"><i className="fa fa-info-circle me-1" />{tx('A nota desta UC é a do Trabalho de Investigação Individual, lançada pela Administração Escolar (turma → TFC/TII).')}</div>}
      {!c.tii && p.avaliacoes.length === 0 && <Vazio>{tx('Ainda não há provas. Crie os TAI e os TAG da UC em «Nova prova».')}</Vazio>}

      {(c.tii || p.avaliacoes.length > 0) && (
        <div className="panel mb-2 overflow-hidden">
          <CabecalhoImpressao titulo="Pauta" subtitulo={`${c.codigo} ${c.nome} · ${c.turma?.nome ?? ''}`} area="Administração Escolar" />
          <div className="table-responsive">
            <table className="table table-bordered table-hover align-middle text-center mb-0 p-matriz p-matriz-pauta">
              <thead>
                <tr>
                  <th scope="col" className="p-matriz-num">{tx('N.º')}</th>
                  <th scope="col" className="p-matriz-nome">{termo}</th>
                  {p.avaliacoes.map((a) => (
                    <th scope="col" key={a.id}>
                      <span className={`badge ${a.tipo === 'TAI' ? 'bg-primary' : 'bg-teal'} me-1`}>{a.tipo}</span>{a.titulo}
                      <div className="small fw-normal text-muted">{tx(FORMAS_AVALIACAO[a.forma])}{a.data ? ` · ${a.data.split('-').reverse().join('/')}` : ''}</div>
                      {a.pedidos > 0 && <div className="small text-warning fw-normal"><i className="fa fa-redo me-1" />{tx('{0} pedido(s) de recuperação', { 0: a.pedidos })}</div>}
                      <div className="p-sem-impressao mt-1">
                        <button type="button" className={`p-publicar ${a.publicadaEm ? 'p-publicada' : ''}`} onClick={() => publicar(a)} aria-pressed={Boolean(a.publicadaEm)} title={a.publicadaEm ? tx('Publicada em {0}. Clique para esconder.', { 0: dataHora(a.publicadaEm) }) : tx('Ainda escondida. Clique para publicar.')}>
                          {a.publicadaEm ? <FaEye aria-hidden="true" /> : <FaEyeSlash aria-hidden="true" />} {a.publicadaEm ? tx('Publicada') : tx('Por publicar')}
                        </button>
                        {!a.publicadaEm && <button type="button" className="btn btn-xs btn-white ms-1" onClick={() => apagar(a)} title={tx('Apagar a prova')} aria-label={tx('Apagar a prova')}><i className="fa fa-trash" /></button>}
                      </div>
                    </th>
                  ))}
                  <th scope="col" className="p-matriz-final">{tx('Nota da UC')}</th>
                  <th scope="col">{tx('Situação')}</th>
                </tr>
              </thead>
              <tbody>
                {p.linhas.map((l, i) => {
                  const r = resultados[l.estudante.id]
                  return (
                    <tr key={l.estudante.id}>
                      <td className="p-matriz-num">{i + 1}</td>
                      <th scope="row" className="p-matriz-nome">{l.estudante.nome}<small>{l.estudante.numero}</small></th>
                      {p.avaliacoes.map((a) => {
                        const e = edicao[a.id]?.[l.estudante.id] ?? {}
                        const n = paraNumero(e.nota)
                        const negativa = a.tipo === 'TAI' && n !== null && n !== undefined && n < 10
                        const pedida = l.notas[a.id]?.recuperacaoPedidaEm
                        return (
                          <td key={a.id}>
                            <input className={`form-control form-control-sm p-nota ${r.invalidas.includes(`${a.id}-nota`) ? 'p-nota-invalida' : ''}`} inputMode="decimal" value={e.nota ?? ''} placeholder="—" aria-label={tx('{0} de {1}', { 0: a.titulo, 1: l.estudante.nome })} onChange={(x) => mudar(a.id, l.estudante.id, 'nota', x.target.value)} />
                            {(negativa || e.recuperacao) && (
                              <div className="mt-1" title={tx('Teste de recuperação: conta no máximo {0}', { 0: NOTA_MAXIMA_RECUPERACAO })}>
                                <input className={`form-control form-control-sm p-nota ${r.invalidas.includes(`${a.id}-rec`) ? 'p-nota-invalida' : ''}`} inputMode="decimal" value={e.recuperacao ?? ''} placeholder={tx('Rec.')} aria-label={tx('Recuperação de {0}', { 0: l.estudante.nome })} onChange={(x) => mudar(a.id, l.estudante.id, 'recuperacao', x.target.value)} />
                                {pedida && <small className="text-warning d-block">{tx('pedida')}</small>}
                              </div>
                            )}
                          </td>
                        )
                      })}
                      <td className="p-matriz-final"><Nota valor={r.final} forte /></td>
                      <td><Situacao situacao={r.situacao} />{r.mencao && r.situacao === 'aprovado' && <small className="p-classificacao">{r.mencao}</small>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <p className="p-legenda">{REGRA_ESG}</p>
    </div>
  )
}

// o auditor/discente: as suas provas publicadas, a nota da UC e o pedido de teste de recuperação
export function MinhasNotasEsg({ c, n, pedir, avisar, aoMudar }) {
  const [aPedir, setAPedir] = useState(null)
  async function recuperacao(prova) {
    setAPedir(prova.id)
    try {
      aoMudar(await pedir(`/cadeiras/${c.id}/provas/${prova.id}/recuperacao`, { metodo: 'POST' }))
      avisar({ texto: tx('Pedido de teste de recuperação enviado ao docente.') })
    } catch (e) {
      avisar({ tipo: 'erro', texto: e.message })
    } finally {
      setAPedir(null)
    }
  }
  return (
    <Cartao titulo={tx('As minhas notas')} acoes={<Situacao situacao={n.situacao} />}>
      {c.tii ? <p className="mb-2">{tx('A nota desta UC é a do Trabalho de Investigação Individual (dissertação e defesa pública).')}</p> : !n.provas.length ? <p className="p-texto-suave mb-2">{tx('Ainda não há notas publicadas.')}</p> : (
        <div className="table-responsive">
          <table className="table table-sm align-middle mb-2">
            <thead><tr><th>{tx('Prova')}</th><th>{tx('Forma')}</th><th className="text-center">{tx('Nota')}</th><th className="text-center">{tx('Recuperação')}</th><th /></tr></thead>
            <tbody>{n.provas.map((pr) => (
              <tr key={pr.id}>
                <td><span className={`badge ${pr.tipo === 'TAI' ? 'bg-primary' : 'bg-teal'} me-1`}>{pr.tipo}</span>{pr.titulo}</td>
                <td className="small">{tx(FORMAS_AVALIACAO[pr.forma])}</td>
                <td className="text-center"><Nota valor={pr.nota} /></td>
                <td className="text-center">{pr.recuperacao !== null ? <><Nota valor={pr.recuperacao} />{pr.recuperacao > NOTA_MAXIMA_RECUPERACAO && <small className="d-block text-muted">{tx('conta {0}', { 0: NOTA_MAXIMA_RECUPERACAO })}</small>}</> : pr.recuperacaoPedidaEm ? <span className="badge bg-warning text-dark">{tx('Pedida')}</span> : '—'}</td>
                <td className="text-end">
                  {pr.podePedirRecuperacao && <button type="button" className="btn btn-xs btn-warning" disabled={aPedir === pr.id} onClick={() => recuperacao(pr)} title={tx('Até {0}', { 0: dataHora(pr.prazoRecuperacao) })}><i className="fa fa-redo me-1" />{tx('Pedir recuperação')}</button>}
                  {pr.podePedirRecuperacao && <small className="d-block text-muted">{tx('até {0}', { 0: dataHora(pr.prazoRecuperacao) })}</small>}
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      <div className="p-notas-linha">
        <div className="p-notas-final"><span>{tx('Nota da UC')}</span><Nota valor={n.final} forte />{n.mencao && n.situacao === 'aprovado' && <small>{n.mencao}</small>}</div>
      </div>
      <p className="p-legenda">{REGRA_ESG} {tx('A nota da UC só aparece quando todas as provas estiverem publicadas.')}</p>
    </Cartao>
  )
}
