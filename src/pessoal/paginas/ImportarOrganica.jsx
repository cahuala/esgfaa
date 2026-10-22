import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useSessao } from '../sessao'
import { lerCsv, lerXlsx } from '../../admin/paginas/academico/lerFolha'
import Tabela from '../componentes/Tabela'
import Carregar from '../componentes/Carregar'
import { Cabecalho, Painel } from '../componentes/Ui'

/*
  Carregar o quadro orgânico da Escola de uma folha de Excel (como no SIGP): cada linha é uma unidade e,
  se tiver cargo, um cargo dela, com o posto (ou a categoria civil) e os lugares. As unidades novas ficam
  dentro da «unidade superior», que tem de vir antes na folha ou já existir. Primeiro simula; nada se apaga.
*/
const COLUNAS = [
  ['unidade', 'Unidade', ['unidade', 'u e o', 'ueo', 'orgao', 'nome da unidade'], 'Departamento de Ensino'],
  ['sigla', 'Sigla', ['sigla'], 'DE'],
  ['tipo', 'Tipo de unidade', ['tipo', 'tipo de unidade'], 'Departamento'],
  ['superior', 'Unidade superior', ['unidade superior', 'superior', 'subordinada a', 'pertence a'], 'Direcção de Ensino'],
  ['cargo', 'Cargo', ['cargo', 'funcao do cargo', 'designacao do cargo'], 'Chefe do Departamento de Ensino'],
  ['funcao', 'Função (Comando, Direcção e Chefia, Estado Maior, Execução)', ['funcao', 'tipo de funcao'], 'Direcção e Chefia'],
  ['posto', 'Posto', ['posto', 'patente', 'posto requerido'], 'Coronel'],
  ['categoriaCivil', 'Categoria civil', ['categoria civil', 'categoria'], ''],
  ['lugares', 'Lugares', ['lugares', 'vagas', 'efectivo', 'efectivo previsto', 'quantidade', 'n de lugares'], '1'],
]
const sem = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

function mapear(tabela) {
  const [cab = [], ...resto] = tabela
  const idx = {}
  cab.forEach((h, i) => {
    const c = COLUNAS.find(([, , nomes]) => nomes.includes(sem(h)))
    if (c && idx[c[0]] === undefined) idx[c[0]] = i
  })
  const linhas = resto.map((l) => Object.fromEntries(Object.entries(idx).map(([k, i]) => [k, String(l[i] ?? '').trim()]))).filter((l) => Object.values(l).some(Boolean))
  return { campos: Object.keys(idx), ignoradas: cab.filter((h) => h && !COLUNAS.some(([, , n]) => n.includes(sem(h)))), linhas }
}

export default function ImportarOrganica() {
  const { avisar } = useSessao()
  const navegar = useNavigate()
  const [folha, setFolha] = useState(null)
  const [resultado, setResultado] = useState(null)
  const [aTrabalhar, setATrabalhar] = useState(false)

  async function escolher(f) {
    if (!f) return
    setResultado(null)
    try {
      const tabela = /\.xlsx$/i.test(f.name) ? await lerXlsx(await f.arrayBuffer()) : /\.(csv|txt)$/i.test(f.name) ? lerCsv(await f.text()) : null
      if (!tabela) throw new Error('Use um Excel (.xlsx) ou CSV. Os .xls antigos: grave primeiro como .xlsx.')
      const m = mapear(tabela)
      if (!m.campos.includes('unidade')) throw new Error('A folha tem de ter a coluna «Unidade».')
      setFolha({ nome: f.name, ...m })
      await enviar(m, false)
    } catch (e) {
      avisar(e.message, 'erro')
    }
  }

  async function enviar(f = folha, gravar = false) {
    setATrabalhar(true)
    try {
      const r = await api('/organica/importar', { metodo: 'POST', corpo: { simular: !gravar, linhas: f.linhas } })
      setResultado(r)
      if (gravar) avisar(`Quadro orgânico carregado: ${r.resumo.unidades} unidade(s) e ${r.resumo.cargos} cargo(s) novos, ${r.resumo.actualizados} actualização(ões).`)
    } catch (e) {
      avisar(e.message, 'erro')
    } finally {
      setATrabalhar(false)
    }
  }

  async function modelo() {
    const { default: writeXlsxFile } = await import('write-excel-file/browser')
    const exemplos = [
      { unidade: 'Direcção de Ensino', sigla: 'DIRE', tipo: 'Direcção', cargo: 'Director de Ensino', funcao: 'Direcção e Chefia', posto: 'Brigadeiro', lugares: '1' },
      { unidade: 'Departamento de Ensino', sigla: 'DE', tipo: 'Departamento', superior: 'DIRE', cargo: 'Chefe do Departamento de Ensino', funcao: 'Direcção e Chefia', posto: 'Coronel', lugares: '1' },
      { unidade: 'DE', cargo: 'Professor de Estratégia', funcao: 'Execução', posto: 'Coronel', lugares: '4' },
      { unidade: 'DE', cargo: 'Técnico Administrativo', funcao: 'Execução', categoriaCivil: 'Administrativo', lugares: '2' },
    ]
    const cab = COLUNAS.map(([, t]) => ({ value: t, fontWeight: 'bold', backgroundColor: '#1f3a2d', textColor: '#ffffff' }))
    await writeXlsxFile([cab, ...exemplos.map((e) => COLUNAS.map(([k]) => (e[k] ? { value: e[k], type: String } : null)))], { columns: COLUNAS.map(([, t]) => ({ width: Math.min(40, Math.max(14, t.length + 2)) })), sheet: 'Quadro orgânico' }).toFile('modelo-quadro-organico.xlsx')
  }

  const colunas = useMemo(() => [
    { chave: 'linha', titulo: 'Linha', valor: (l) => l.linha, alinhar: 'end' },
    { chave: 'unidade', titulo: 'Unidade', valor: (l) => l.unidade },
    { chave: 'cargo', titulo: 'Cargo', valor: (l) => l.cargo },
    { chave: 'acao', titulo: 'Resultado', valor: (l) => l.erro || l.acoes.join('; ') || 'Sem alterações', mostrar: (l) => (l.acao === 'erro'
      ? <span className="text-danger"><i className="fa fa-times-circle me-1" />{l.erro}</span>
      : l.acao === 'igual' ? <span className="text-muted"><i className="fa fa-equals me-1" />Já está assim</span>
        : <span className="text-success"><i className="fa fa-check-circle me-1" />{l.acoes.join('; ')}</span>) },
  ], [])

  const r = resultado?.resumo
  return (
    <>
      <Cabecalho titulo="Carregar o quadro orgânico" subtitulo="unidades e cargos de uma folha Excel" migalhas={[['Orgânica', '/organica'], ['Carregar o quadro orgânico']]} />
      <Painel titulo="1. Escolher a folha" icone="fa-file-excel">
        <div className="row align-items-end">
          <div className="col-md-8 mb-2">
            <Carregar aceitar=".xlsx,.csv,.txt" maxMb={20} compacto icone="fa-file-excel" titulo={folha ? `Outra folha (actual: ${folha.nome})` : 'Arraste a folha para aqui'} ajuda="Excel (.xlsx) ou CSV · até 20 MB" aoEscolher={escolher} desativado={aTrabalhar} />
          </div>
          <div className="col-md-4 mb-2"><button type="button" className="btn btn-sm btn-outline-success w-100" onClick={modelo}><i className="fa fa-download me-1" />Descarregar o modelo</button></div>
        </div>
        <ul className="small text-muted mb-0">
          <li>Uma linha por cargo (ou só a unidade, sem cargo). A unidade encontra-se pelo <b>nome ou pela sigla</b>; se não existir, cria-se dentro da <b>unidade superior</b>, que tem de vir numa linha antes ou já existir.</li>
          <li>O cargo encontra-se pelo nome dentro da unidade: se existir, ficam os lugares, o posto e a função da folha; se não, cria-se. <b>Nada se apaga.</b></li>
          <li>Posto (cargo militar) ou categoria civil (cargo civil) e função têm de corresponder exactamente às listas do sistema. Lugares: de 1 a 500.</li>
          <li>Primeiro o sistema simula. Só grava quando confirmar, e só se nenhuma linha tiver erro.</li>
        </ul>
        {folha && <div className="small mt-2"><strong>{folha.nome}</strong>: {folha.linhas.length} linha(s) · colunas reconhecidas: {folha.campos.map((c) => COLUNAS.find((x) => x[0] === c)[1].replace(/ \(.*\)$/, '')).join(', ')}{folha.ignoradas.length > 0 && <span className="text-warning"> · ignoradas: {folha.ignoradas.join(', ')}</span>}</div>}
      </Painel>
      {resultado && (
        <Painel titulo={resultado.simulacao ? '2. Verificação (nada foi gravado ainda)' : 'Resultado'} icone="fa-clipboard-check"
          acoes={resultado.simulacao && !r.erros && (r.unidades || r.cargos || r.actualizados) > 0 && <button type="button" className="btn btn-xs btn-theme" disabled={aTrabalhar} onClick={() => enviar(folha, true)}><i className="fa fa-check me-1" />Gravar o quadro orgânico</button>}>
          <div className="d-flex flex-wrap gap-2 mb-2">
            <span className="badge bg-success fs-6">{r.unidades} unidade(s) nova(s)</span>
            <span className="badge bg-success fs-6">{r.cargos} cargo(s) novo(s) · {r.lugares} lugar(es)</span>
            <span className="badge bg-info fs-6">{r.actualizados} actualização(ões)</span>
            <span className={`badge fs-6 ${r.erros ? 'bg-danger' : 'bg-light text-dark border'}`}>{r.erros} com erro</span>
            {!resultado.simulacao && <button type="button" className="btn btn-sm btn-link" onClick={() => navegar('/organica')}>Ver a orgânica</button>}
          </div>
          {resultado.simulacao && r.erros > 0 && <div className="alert alert-danger py-2 small">Corrija as linhas a vermelho na folha e carregue-a outra vez: com erros, nada se grava.</div>}
          <Tabela titulo="Quadro orgânico" colunas={colunas} linhas={resultado.linhas} chave={(l) => l.linha} porPagina={50} />
        </Painel>
      )}
    </>
  )
}
