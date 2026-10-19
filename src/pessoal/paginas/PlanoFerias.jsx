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
      {carregar && <CarregarPlano ano={ano} aoFechar={() => setCarregar(false)} aoCarregar={(r) => { setCarregar(false); avisar(`${r.feitos} pessoa(s) actualizada(s) no plano de férias.${r.avisos.length ? ` Avisos: ${r.avisos.slice(0, 5).join(' | ')}` : ''}`, r.avisos.length ? 'erro' : undefined); recarregar() }} />}
    </>
  )
}

function CarregarPlano({ ano, aoFechar, aoCarregar }) {
  const [erro, setErro] = useState('')
  const [aTrabalhar, setATrabalhar] = useState(false)
  async function escolher(f) {
    setErro('')
    setATrabalhar(true)
    try {
      const tabela = /\.xlsx$/i.test(f.name) ? await lerXlsx(await f.arrayBuffer()) : /\.(csv|txt)$/i.test(f.name) ? lerCsv(await f.text()) : null
      if (!tabela?.length) throw new Error('Use um Excel (.xlsx) ou CSV com as colunas «nip» (ou «agente») e «mes».')
      const [cab, ...corpo] = tabela
      const col = (re) => cab.findIndex((c) => re.test(String(c).trim().toLowerCase()))
      const ci = col(/^(nip|n\.?º? ?agente|agente|identifica)/)
      const cm = col(/^m[eê]s/)
      if (ci < 0 || cm < 0) throw new Error('Faltam as colunas «nip» (ou «agente») e «mes» na primeira linha.')
      const linhas = corpo.filter((r) => r[ci]).map((r) => ({ identificador: String(r[ci]), mes: String(r[cm] ?? '') }))
      aoCarregar(await api('/plano-ferias/importar', { metodo: 'POST', corpo: { ano, linhas } }))
    } catch (e) {
      setErro(e.message)
    } finally {
      setATrabalhar(false)
    }
  }
  return (
    <Modal titulo={`Carregar o plano de férias — ${ano}`} aoFechar={aoFechar}>
      {erro && <div className="alert alert-danger py-2">{erro}</div>}
      <p className="small text-muted">O ficheiro tem, na primeira linha, as colunas <b>nip</b> (ou <b>agente</b>, para os civis) e <b>mes</b> (o nome do mês ou o número de 1 a 12). Aplica-se ao ano <b>{ano}</b>.</p>
      <table className="table table-sm table-bordered w-auto small"><thead><tr><th>nip</th><th>mes</th></tr></thead><tbody><tr><td>100253568</td><td>Julho</td></tr><tr><td>22589632</td><td>8</td></tr></tbody></table>
      <Carregar aceitar=".xlsx,.csv,.txt" maxMb={10} compacto icone="fa-file-excel" titulo="Arraste o Excel para aqui" ajuda="Excel (.xlsx) ou CSV" aoEscolher={escolher} desativado={aTrabalhar} />
    </Modal>
  )
}
