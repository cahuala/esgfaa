import { useState } from 'react'
import { api } from '../api'
import { exportarTabela } from '../../utils/exportarTabela'
import { t as tx } from '../../i18n/linguas'

/*
  Botões «Excel» e «PDF» de uma tabela do painel: exportam o que a pesquisa e os filtros deixaram (todas as
  páginas). filtro: o que está aplicado, por escrito («pesquisa: Silva · estado: por tratar»).
  obterLinhas(): para as listas paginadas no servidor (o registo de atividades), vai buscar todas.
  Cada exportação fica no registo de atividades (quem levou que lista, com quantas linhas).
*/
export default function Exportar({ titulo, colunas, linhas = [], filtro = '', obterLinhas = null, className = '' }) {
  const [aExportar, setAExportar] = useState('')
  const [erro, setErro] = useState('')
  async function exportar(formato) {
    setAExportar(formato)
    setErro('')
    try {
      const todas = obterLinhas ? await obterLinhas() : linhas
      await exportarTabela(formato, { titulo, colunas, linhas: todas, filtro })
      api('/exportacao', { metodo: 'POST', corpo: { tabela: titulo.slice(0, 120), formato, linhas: todas.length, filtro: filtro.slice(0, 300) } }).catch(() => {})
    } catch (e) {
      setErro(e.message)
    } finally {
      setAExportar('')
    }
  }
  const vazio = !obterLinhas && !linhas.length
  return (
    <div className={`btn-group ${className}`} role="group" aria-label={tx('Exportar')} title={erro || (filtro ? tx('Exporta só o que a pesquisa encontrou') : tx('Exportar a lista'))}>
      <button type="button" className="btn btn-white btn-sm" disabled={vazio || Boolean(aExportar)} onClick={() => exportar('excel')}>
        <i className={`fa ${aExportar === 'excel' ? 'fa-spinner fa-spin' : 'fa-file-excel'} me-1 text-success`} />Excel
      </button>
      <button type="button" className="btn btn-white btn-sm" disabled={vazio || Boolean(aExportar)} onClick={() => exportar('pdf')}>
        <i className={`fa ${aExportar === 'pdf' ? 'fa-spinner fa-spin' : 'fa-file-pdf'} me-1 text-danger`} />PDF
      </button>
    </div>
  )
}
