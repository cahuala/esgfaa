import { useState } from 'react'
import { api } from '../api'
import { useDados } from '../useDados'
import { useSessao } from '../sessao'
import { Cabecalho, Carregando, Erro } from '../componentes/Ui'
import { exportarExcel, exportarPdf } from '../exportar'

// como no SIGP: «1 234 567,89» (milhares separados por espaço, também com 4 algarismos)
const KZ = (v) => { const [i, d] = Number(v || 0).toFixed(2).split('.'); return `${i.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')},${d}` }
const numero = (t) => Number(String(t).replace(/\s/g, '').replace(',', '.')) || 0

/*
  Tabela salarial por posto (a mesma do SIGP): por forma de prestação de serviço, o vencimento base e as
  componentes até ao líquido. O administrador altera, em cada posto e forma de serviço, o vencimento base e, se for preciso, a condição
  militar, a representação e o comando/chefia (vazio = calculado); guarda com a calculadora.
*/
const ROTULOS = { base: 'Vencimento base', condicaoMilitar: 'Condição militar', representacao: 'Representação', comandoChefia: 'Comando/chefia' }
export default function TabelaSalarial() {
  const { ref, pode, avisar } = useSessao()
  const { dados, erro, recarregar } = useDados('/tabela-salarial')
  const [q, setQ] = useState('')
  // o que se está a escrever, por forma de serviço e posto («QP:major»): { base, condicaoMilitar, … } (texto)
  const [ed, setEd] = useState({})
  const [aGuardar, setAGuardar] = useState(null)
  const [ramo, setRamo] = useState('')
  const alterar = pode('administrar')
  if (erro) return <Erro texto={erro} aoRepetir={recarregar} />
  if (!dados) return <Carregando />

  // os postos com o nome de cada ramo (Exército, Força Aérea Nacional, Marinha de Guerra Angolana)
  const nome = (id, r = 'EXE') => ref.postos[r].find((x) => x.id === id)?.nome ?? ''
  const abrev = (id, r = 'EXE') => ref.postos[r].find((x) => x.id === id)?.abreviatura
  const termo = q.trim().toLowerCase()
  const grupos = (ramo ? [ramo] : Object.keys(ref.ramos)).flatMap((r) => dados.grupos.map((g) => ({ ...g, ramo: r, linhas: g.linhas.filter((l) => !termo || nome(l.posto, r).toLowerCase().includes(termo)).map((l) => ({ ...l, ramo: r })) })))
    .filter((g) => g.linhas.length)
  const total = grupos.reduce((s, g) => s + g.linhas.length, 0)
  const pc = dados.percentagens

  async function guardar(fps, posto) {
    const chave = `${fps}:${posto}`
    const e = ed[chave] ?? {}
    if (!Object.keys(e).length) { avisar('Altere primeiro um valor deste posto.', 'erro'); return }
    if (e.base !== undefined && !numero(e.base)) { avisar('Escreva o vencimento base.', 'erro'); return }
    // a base escreve-se sempre; uma componente vazia volta a ser calculada
    const corpo = { fps, ...Object.fromEntries(Object.entries(e).map(([k, v]) => [k, k !== 'base' && String(v).trim() === '' ? null : numero(v)])) }
    setAGuardar(posto)
    try {
      await api(`/tabela-salarial/${posto}`, { metodo: 'PUT', corpo })
      setEd(({ [chave]: _, ...r }) => { void _; return r })
      avisar(`${Object.keys(corpo).filter((k) => k !== 'fps').map((k) => ROTULOS[k]).join(', ')} de ${nome(posto)} (${fps}) actualizado(s).`)
      recarregar()
    } catch (e) {
      avisar(e.message, 'erro')
    } finally {
      setAGuardar(null)
    }
  }

  const colunas = [
    { titulo: 'Ramo', valor: (l) => l.ramo }, { titulo: 'Posto', valor: (l) => nome(l.posto, l.ramo) }, { titulo: 'FPS', valor: (l) => l.fps },
    { titulo: 'Venc. Base', valor: (l) => KZ(l.base), alinhar: 'right' }, { titulo: 'Cond. Militar', valor: (l) => KZ(l.condicaoMilitar), alinhar: 'right' },
    { titulo: 'Representação', valor: (l) => KZ(l.representacao), alinhar: 'right' }, { titulo: 'Cmdo/Chefia', valor: (l) => KZ(l.comandoChefia), alinhar: 'right' },
    { titulo: 'Total Ilíq.', valor: (l) => KZ(l.iliquido), alinhar: 'right' }, { titulo: 'Seg. Social', valor: (l) => KZ(l.caixaSS), alinhar: 'right' },
    { titulo: 'Total Líquido', valor: (l) => KZ(l.liquido), alinhar: 'right' },
  ]
  const todas = grupos.flatMap((g) => g.linhas.map((l) => ({ ...l, fps: g.fps })))

  return (
    <>
      <Cabecalho titulo={<><i className="fa fa-table me-2 pes-ouro" />Tabela Salarial por Posto</>} subtitulo={`${total} registos${alterar ? ' · altere o vencimento base e, se for preciso, as outras componentes (vazio = calculado)' : ''}`} migalhas={[['Carreiras'], ['Tabela salarial']]}>
        <button type="button" className="btn btn-white" onClick={() => exportarExcel('Tabela Salarial por Posto', colunas, todas)}><i className="fa fa-file-excel me-1 text-success" />Excel</button>
        <button type="button" className="btn btn-white" onClick={() => exportarPdf('Tabela Salarial por Posto', colunas, todas)}><i className="fa fa-file-pdf me-1 text-danger" />PDF</button>
      </Cabecalho>

      <div className="pes-info mb-3">
        <i className="fa fa-info-circle me-1" />
        <b>Fórmulas:</b> Condição Militar = Base × {pc.condicaoMilitar}% ·
        Subsídio de Representação: só de Coronel a General no Quadro Permanente ({Object.entries(dados.representacao).reverse().map(([p, v]) => `${nome(p)} ${KZ(v)}`).join(', ')}); do Tenente-Coronel para baixo é <b>0,00</b> ·
        Comando/Direcção/Chefia = Base × {pc.comandoChefia}% (Coronel para baixo); Oficiais Generais e o SMO não têm ·
        Caixa de Segurança Social (desconto) = Total Ilíquido × {pc.caixaSS}%
        {alterar && <> · Como no SIGP, a <b>condição militar, a representação e o comando/chefia</b> podem escrever-se à mão (em negrito); apague o valor para voltar à fórmula. Clique <i className="fa fa-calculator" /> para guardar.</>}
      </div>

      <div className="card mb-3"><div className="card-body py-2 d-flex flex-wrap gap-2 align-items-center">
        <div className="btn-group btn-group-sm" role="group" aria-label="Ramo">
          {[['', 'Todos os ramos'], ...Object.entries(ref.ramos).map(([k, v]) => [k, v.nome])].map(([k, t]) => <button key={k} type="button" className={`btn ${ramo === k ? 'btn-theme' : 'btn-white'}`} onClick={() => setRamo(k)}>{t}</button>)}
        </div>
        <div className="pes-pesquisa"><i className="fa fa-search" /><input className="form-control form-control-sm" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pesquisar por posto…" aria-label="Pesquisar por posto" /></div>
      </div></div>

      <div className="card">
        <div className="pes-sal-corpo">
          {!total ? <div className="text-center text-muted py-5">Tabela salarial vazia para «{q}».</div> : (
            <table className="pes-sal">
              <thead><tr>{colunas.slice(1).map((c) => <th key={c.titulo}>{c.titulo}</th>)}{alterar && <th style={{ width: 50 }} />}</tr></thead>
              <tbody>
                {grupos.map((g) => [
                  <tr key={`${g.ramo}-${g.fps}`} className="pes-sal-fps"><td colSpan={alterar ? 10 : 9}><i className="fa fa-layer-group me-1" />{ref.ramos[g.ramo].nome} — {g.nome} ({g.fps})</td></tr>,
                  ...g.linhas.map((l) => {
                    const chave = `${g.fps}:${l.posto}`
                    const e = ed[chave] ?? {}
                    const b = e.base !== undefined ? numero(e.base) : l.base
                    // ao escrever, as outras colunas acompanham (as mesmas regras do servidor): a componente
                    // escrita fica; a vazia ou calculada segue a fórmula
                    const general = ref.postos.EXE.find((x) => x.id === l.posto)?.categoria === 'oficial_general'
                    const auto = { condicaoMilitar: (b * pc.condicaoMilitar) / 100, representacao: dados.representacao[l.posto] ?? 0, comandoChefia: general ? 0 : (b * pc.comandoChefia) / 100 }
                    const valor = (k) => (e[k] !== undefined ? (String(e[k]).trim() === '' ? auto[k] : numero(e[k])) : l.manual?.includes(k) ? l[k] : auto[k])
                    const cm = valor('condicaoMilitar')
                    const rp = g.fps === 'QP' ? valor('representacao') : 0
                    const cc = g.fps === 'SMO' ? 0 : valor('comandoChefia')
                    const ili = b + cm + rp + cc
                    const ss = (ili * pc.caixaSS) / 100
                    const caixa = (k, v, pode = true) => {
                      const manual = e[k] !== undefined ? String(e[k]).trim() !== '' : l.manual?.includes(k)
                      if (!alterar || !pode) return <td className={manual && pode ? 'fw-bold' : 'pes-sal-auto'}>{KZ(v)}</td>
                      return <td><input className={`pes-sal-base ${k === 'base' || manual ? '' : 'pes-sal-auto fw-normal'}`} value={e[k] !== undefined ? e[k] : KZ(v)} title={k === 'base' || manual ? '' : 'Calculado; escreva para fixar o valor'} aria-label={`${ROTULOS[k]} de ${nome(l.posto, g.ramo)} (${g.ramo}, ${g.fps})`} onChange={(ev) => setEd({ ...ed, [chave]: { ...e, [k]: ev.target.value.replace(/[^0-9.,\s]/g, '') } })} onKeyDown={(ev) => { if (ev.key === 'Enter') guardar(g.fps, l.posto) }} /></td>
                    }
                    return (
                      <tr key={`${g.ramo}-${g.fps}-${l.posto}`}>
                        <td><strong>{nome(l.posto, g.ramo)}</strong> <small className="text-muted">({abrev(l.posto, g.ramo)})</small></td>
                        <td className="small text-muted">{g.fps}</td>
                        {caixa('base', b)}
                        {caixa('condicaoMilitar', cm)}
                        {caixa('representacao', rp, g.fps === 'QP')}
                        {caixa('comandoChefia', cc, g.fps !== 'SMO')}
                        <td>{KZ(ili)}</td>
                        <td className="pes-sal-auto">{KZ(ss)}</td>
                        <td className="pes-sal-total">{KZ(ili - ss)}</td>
                        {alterar && <td><button type="button" className="pes-sal-calc" onClick={() => guardar(g.fps, l.posto)} disabled={aGuardar === l.posto} title="Recalcular e guardar"><i className={`fa ${aGuardar === l.posto ? 'fa-spinner fa-spin' : 'fa-calculator'}`} /></button></td>}
                      </tr>
                    )
                  }),
                ])}
              </tbody>
            </table>
          )}
        </div>
      </div>
      <p className="small text-muted mt-2">Os valores de um posto são os mesmos nos três ramos (os postos equivalem-se: Coronel = Capitão-de-Mar-e-Guerra), mas cada forma de prestação de serviço (QP, SMC, SMO, SMR) tem os seus: alterar o 2.º Sargento no SMC não muda o do QP. A representação só existe no QP e o SMO não tem comando/chefia. Nas declarações, o vencimento escreve-se ao emitir; se ficar vazio, vai o líquido desta tabela.</p>
    </>
  )
}
