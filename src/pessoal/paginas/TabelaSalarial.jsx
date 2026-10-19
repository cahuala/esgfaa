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
  componentes calculadas até ao líquido. O administrador altera só o vencimento base (com a calculadora).
*/
export default function TabelaSalarial() {
  const { ref, pode, avisar } = useSessao()
  const { dados, erro, recarregar } = useDados('/tabela-salarial')
  const [q, setQ] = useState('')
  const [bases, setBases] = useState({})
  const [aGuardar, setAGuardar] = useState(null)
  const alterar = pode('administrar')
  if (erro) return <Erro texto={erro} aoRepetir={recarregar} />
  if (!dados) return <Carregando />

  const nome = (id) => [...new Set(['EXE', 'FAN', 'MGA'].map((r) => ref.postos[r].find((x) => x.id === id)?.nome).filter(Boolean))].join(' / ')
  const abrev = (id) => ref.postos.EXE.find((x) => x.id === id)?.abreviatura
  const termo = q.trim().toLowerCase()
  const grupos = dados.grupos.map((g) => ({ ...g, linhas: g.linhas.filter((l) => !termo || nome(l.posto).toLowerCase().includes(termo)) })).filter((g) => g.linhas.length)
  const total = grupos.reduce((s, g) => s + g.linhas.length, 0)
  const pc = dados.percentagens

  async function guardar(posto) {
    const base = numero(bases[posto])
    if (!base) { avisar('Escreva o vencimento base.', 'erro'); return }
    setAGuardar(posto)
    try {
      await api(`/tabela-salarial/${posto}`, { metodo: 'PUT', corpo: { base } })
      setBases(({ [posto]: _, ...r }) => { void _; return r })
      avisar(`Vencimento base de ${nome(posto)} actualizado.`)
      recarregar()
    } catch (e) {
      avisar(e.message, 'erro')
    } finally {
      setAGuardar(null)
    }
  }

  const colunas = [
    { titulo: 'Posto', valor: (l) => nome(l.posto) }, { titulo: 'FPS', valor: (l) => l.fps },
    { titulo: 'Venc. Base', valor: (l) => KZ(l.base), alinhar: 'right' }, { titulo: 'Cond. Militar', valor: (l) => KZ(l.condicaoMilitar), alinhar: 'right' },
    { titulo: 'Representação', valor: (l) => KZ(l.representacao), alinhar: 'right' }, { titulo: 'Cmdo/Chefia', valor: (l) => KZ(l.comandoChefia), alinhar: 'right' },
    { titulo: 'Total Ilíq.', valor: (l) => KZ(l.iliquido), alinhar: 'right' }, { titulo: 'Seg. Social', valor: (l) => KZ(l.caixaSS), alinhar: 'right' },
    { titulo: 'Total Líquido', valor: (l) => KZ(l.liquido), alinhar: 'right' },
  ]
  const todas = grupos.flatMap((g) => g.linhas.map((l) => ({ ...l, fps: g.fps })))

  return (
    <>
      <Cabecalho titulo={<><i className="fa fa-table me-2 pes-ouro" />Tabela Salarial por Posto</>} subtitulo={`${total} registos${alterar ? ' · altere o Vencimento Base — os outros valores são calculados automaticamente' : ''}`} migalhas={[['Carreiras'], ['Tabela salarial']]}>
        <button type="button" className="btn btn-white" onClick={() => exportarExcel('Tabela Salarial por Posto', colunas, todas)}><i className="fa fa-file-excel me-1 text-success" />Excel</button>
        <button type="button" className="btn btn-white" onClick={() => exportarPdf('Tabela Salarial por Posto', colunas, todas)}><i className="fa fa-file-pdf me-1 text-danger" />PDF</button>
      </Cabecalho>

      <div className="pes-info mb-3">
        <i className="fa fa-info-circle me-1" />
        <b>Fórmulas:</b> Condição Militar = Base × {pc.condicaoMilitar}% ·
        Subsídio de Representação: só de Coronel a General no Quadro Permanente ({Object.entries(dados.representacao).reverse().map(([p, v]) => `${nome(p).split(' / ')[0]} ${KZ(v)}`).join(', ')}); do Tenente-Coronel para baixo é <b>0,00</b> ·
        Comando/Direcção/Chefia = Base × {pc.comandoChefia}% (Coronel para baixo); Oficiais Generais e o SMO não têm ·
        Caixa de Segurança Social (desconto) = Total Ilíquido × {pc.caixaSS}%
        {alterar && <> · <b>Altere apenas o Vencimento Base</b> e clique <i className="fa fa-calculator" /> para recalcular e guardar.</>}
      </div>

      <div className="card mb-3"><div className="card-body py-2">
        <div className="pes-pesquisa"><i className="fa fa-search" /><input className="form-control form-control-sm" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pesquisar por posto…" aria-label="Pesquisar por posto" /></div>
      </div></div>

      <div className="card">
        <div className="pes-sal-corpo">
          {!total ? <div className="text-center text-muted py-5">Tabela salarial vazia para «{q}».</div> : (
            <table className="pes-sal">
              <thead><tr>{colunas.map((c) => <th key={c.titulo}>{c.titulo}</th>)}{alterar && <th style={{ width: 50 }} />}</tr></thead>
              <tbody>
                {grupos.map((g) => [
                  <tr key={g.fps} className="pes-sal-fps"><td colSpan={alterar ? 10 : 9}><i className="fa fa-layer-group me-1" />{g.nome} ({g.fps})</td></tr>,
                  ...g.linhas.map((l) => {
                    const editado = bases[l.posto] !== undefined
                    const b = editado ? numero(bases[l.posto]) : l.base
                    // ao escrever, as outras colunas acompanham (as mesmas regras do servidor)
                    const temCmdo = g.fps !== 'SMO' && ref.postos.EXE.find((x) => x.id === l.posto)?.categoria !== 'oficial_general'
                    const cm = editado ? (b * pc.condicaoMilitar) / 100 : l.condicaoMilitar
                    const cc = editado ? (temCmdo ? (b * pc.comandoChefia) / 100 : 0) : l.comandoChefia
                    const ili = editado ? b + cm + l.representacao + cc : l.iliquido
                    const ss = editado ? (ili * pc.caixaSS) / 100 : l.caixaSS
                    return (
                      <tr key={`${g.fps}-${l.posto}`}>
                        <td title={nome(l.posto)}><strong>{nome(l.posto).split(' / ')[0]}</strong> <small className="text-muted">({abrev(l.posto)})</small></td>
                        <td className="small text-muted">{g.fps}</td>
                        <td>{alterar
                          ? <input className="pes-sal-base" value={editado ? bases[l.posto] : KZ(l.base)} aria-label={`Vencimento base de ${nome(l.posto)}`} onChange={(e) => setBases({ ...bases, [l.posto]: e.target.value.replace(/[^0-9.,\s]/g, '') })} onKeyDown={(e) => { if (e.key === 'Enter') guardar(l.posto) }} />
                          : KZ(l.base)}</td>
                        <td className="pes-sal-auto">{KZ(cm)}</td>
                        <td className="pes-sal-auto">{KZ(l.representacao)}</td>
                        <td className="pes-sal-auto">{KZ(cc)}</td>
                        <td>{KZ(ili)}</td>
                        <td className="pes-sal-auto">{KZ(ss)}</td>
                        <td className="pes-sal-total">{KZ(ili - ss)}</td>
                        {alterar && <td><button type="button" className="pes-sal-calc" onClick={() => guardar(l.posto)} disabled={aGuardar === l.posto} title="Recalcular e guardar"><i className={`fa ${aGuardar === l.posto ? 'fa-spinner fa-spin' : 'fa-calculator'}`} /></button></td>}
                      </tr>
                    )
                  }),
                ])}
              </tbody>
            </table>
          )}
        </div>
      </div>
      <p className="small text-muted mt-2">O vencimento base é igual em todas as formas de prestação de serviço e nos três ramos: alterá-lo num posto altera-o em todas. O vencimento real de cada militar escreve-se na ficha (é o que vai nas declarações); sem ele, as declarações propõem o ilíquido desta tabela.</p>
    </>
  )
}
