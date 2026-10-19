import { useState } from 'react'
import { api } from '../api'
import { useDados } from '../useDados'
import { useSessao } from '../sessao'
import { Cabecalho, Carregando, Erro } from '../componentes/Ui'
import { exportarExcel, exportarPdf } from '../exportar'

// como no SIGP: «1 234 567,89»
const KZ = (v) => { const [i, d] = Number(v || 0).toFixed(2).split('.'); return `${i.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')},${d}` }
const numero = (t) => Number(String(t).replace(/\s/g, '').replace(',', '.')) || 0

/*
  Tabela salarial dos civis (como no SIGP): por categoria, o vencimento base, os subsídios e os descontos
  até ao líquido. É o líquido que vai nas declarações de serviço quando não se escreve o vencimento.
*/
export default function TabelaSalarialCivis() {
  const { pode, avisar } = useSessao()
  const { dados, erro, recarregar } = useDados('/tabela-salarial-civis')
  const [q, setQ] = useState('')
  const [bases, setBases] = useState({})
  const [aGuardar, setAGuardar] = useState(null)
  const alterar = pode('administrar')
  if (erro) return <Erro texto={erro} aoRepetir={recarregar} />
  if (!dados) return <Carregando />

  const termo = q.trim().toLowerCase()
  const linhas = dados.filter((l) => !termo || `${l.nome} ${l.classes.join(' ')}`.toLowerCase().includes(termo))

  async function guardar(l) {
    const base = numero(bases[l.categoria])
    if (!base) { avisar('Escreva o vencimento base.', 'erro'); return }
    setAGuardar(l.categoria)
    try {
      await api(`/tabela-salarial-civis/${l.categoria}`, { metodo: 'PUT', corpo: { base } })
      setBases(({ [l.categoria]: _, ...r }) => { void _; return r })
      avisar(`Vencimento base de ${l.nome} actualizado.`)
      recarregar()
    } catch (e) {
      avisar(e.message, 'erro')
    } finally {
      setAGuardar(null)
    }
  }

  const colunas = [
    { titulo: 'Categoria', valor: (l) => `${l.nivel}. ${l.nome}` }, { titulo: 'Venc. Base', valor: (l) => KZ(l.vencimentoBase), alinhar: 'right' },
    { titulo: 'Sub. Alimentação', valor: (l) => KZ(l.subsidioAlimentacao), alinhar: 'right' }, { titulo: 'Sub. Transporte', valor: (l) => KZ(l.subsidioTransporte), alinhar: 'right' },
    { titulo: 'Total Ilíq.', valor: (l) => KZ(l.bruto), alinhar: 'right' }, { titulo: 'Seg. Social', valor: (l) => KZ(l.segSocial), alinhar: 'right' },
    { titulo: 'IRT', valor: (l) => KZ(l.irt), alinhar: 'right' }, { titulo: 'Total Líquido', valor: (l) => KZ(l.liquido), alinhar: 'right' },
  ]

  return (
    <>
      <Cabecalho titulo={<><i className="fa fa-table me-2 pes-ouro" />Tabela Salarial dos Civis por Categoria</>} subtitulo={`${dados.length} categorias`} migalhas={[['Carreiras'], ['Tabela salarial (civis)']]}>
        <button type="button" className="btn btn-white" onClick={() => exportarExcel('Tabela Salarial dos Civis', colunas, linhas)}><i className="fa fa-file-excel me-1 text-success" />Excel</button>
        <button type="button" className="btn btn-white" onClick={() => exportarPdf('Tabela Salarial dos Civis', colunas, linhas)}><i className="fa fa-file-pdf me-1 text-danger" />PDF</button>
      </Cabecalho>
      <div className="pes-info mb-3">
        <i className="fa fa-info-circle me-1" />
        Ordem do salário que vai na Declaração de serviço: <b>o vencimento escrito ao emitir</b> → <b>o vencimento da ficha do funcionário</b> → <b>o líquido da categoria</b> (esta tabela).
        Descontos: Segurança Social {dados[0]?.percSegSocial ?? 3}% e IRT {dados[0]?.percIrt ?? 7}% do vencimento base.{alterar && <> <b>Altere apenas o Vencimento Base</b> e clique <i className="fa fa-save" /> para guardar.</>}
      </div>
      <div className="card mb-3"><div className="card-body py-2">
        <div className="pes-pesquisa"><i className="fa fa-search" /><input className="form-control form-control-sm" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pesquisar por categoria ou classe…" aria-label="Pesquisar por categoria" /></div>
      </div></div>
      <div className="card">
        <div className="pes-sal-corpo">
          <table className="pes-sal">
            <thead><tr>{colunas.map((c) => <th key={c.titulo}>{c.titulo}</th>)}{alterar && <th style={{ width: 50 }} />}</tr></thead>
            <tbody>
              {!linhas.length && <tr><td colSpan={9} className="text-center text-muted py-5">Nada para «{q}».</td></tr>}
              {linhas.map((l) => {
                const editado = bases[l.categoria] !== undefined
                const b = editado ? numero(bases[l.categoria]) : l.vencimentoBase
                const bruto = b + l.subsidioAlimentacao + l.subsidioTransporte
                const ss = (b * l.percSegSocial) / 100
                const irt = (b * l.percIrt) / 100
                return (
                  <tr key={l.categoria}>
                    <td title={`${l.descricao} — classes: ${l.classes.join(' · ')}`}><strong>{l.nivel}. {l.nome}</strong></td>
                    <td>{alterar ? <input className="pes-sal-base" value={editado ? bases[l.categoria] : KZ(l.vencimentoBase)} aria-label={`Vencimento base de ${l.nome}`} onChange={(e) => setBases({ ...bases, [l.categoria]: e.target.value.replace(/[^0-9.,\s]/g, '') })} onKeyDown={(e) => { if (e.key === 'Enter') guardar(l) }} /> : KZ(l.vencimentoBase)}</td>
                    <td className="pes-sal-auto">{KZ(l.subsidioAlimentacao)}</td>
                    <td className="pes-sal-auto">{KZ(l.subsidioTransporte)}</td>
                    <td>{KZ(bruto)}</td>
                    <td className="pes-sal-auto">{KZ(ss)}</td>
                    <td className="pes-sal-auto">{KZ(irt)}</td>
                    <td className="pes-sal-total">{KZ(bruto - ss - irt)}</td>
                    {alterar && <td><button type="button" className="pes-sal-calc" onClick={() => guardar(l)} disabled={aGuardar === l.categoria} title="Guardar"><i className={`fa ${aGuardar === l.categoria ? 'fa-spinner fa-spin' : 'fa-save'}`} /></button></td>}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
