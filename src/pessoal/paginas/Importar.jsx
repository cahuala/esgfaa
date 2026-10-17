import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useSessao } from '../sessao'
import { lerCsv, lerXlsx } from '../../admin/paginas/academico/lerFolha'
import { reduzirFoto } from '../fotos'
import Tabela from '../componentes/Tabela'
import Carregar from '../componentes/Carregar'
import { Cabecalho, Escolha, Painel } from '../componentes/Ui'

// colunas reconhecidas na folha (pelo título, sem acentos nem maiúsculas) → campo da ficha
const COLUNAS = [
  ['nip', 'NIP', ['nip', 'n ip', 'numero de identificacao']], ['numeroAgente', 'N.º de agente', ['n de agente', 'numero de agente', 'agente', 'n agente']],
  ['nome', 'Nome completo', ['nome', 'nome completo']], ['nomeGuerra', 'Nome de guerra', ['nome de guerra']], ['tipo', 'Tipo (militar/civil)', ['tipo']],
  ['ramo', 'Ramo', ['ramo']], ['posto', 'Posto', ['posto', 'patente']], ['fps', 'Forma de serviço (QP/SMC/SMO)', ['fps', 'forma de servico', 'forma de prestacao de servico']],
  ['quadroEspecial', 'Quadro especial', ['quadro especial', 'quadro', 'arma', 'arma servico']], ['especialidade', 'Especialidade', ['especialidade']],
  ['situacao', 'Situação', ['situacao']], ['unidade', 'Unidade', ['unidade', 'u e o', 'ueo', 'orgao']], ['cargo', 'Cargo', ['cargo', 'funcao']],
  ['vinculo', 'Vínculo (docente/estudante/funcionário)', ['vinculo']], ['bi', 'BI', ['bi', 'b i', 'bilhete de identidade', 'n bi']],
  ['dataNascimento', 'Data de nascimento', ['data de nascimento', 'nascimento', 'data nascimento']], ['genero', 'Género', ['genero', 'sexo']],
  ['estadoCivil', 'Estado civil', ['estado civil']], ['naturalidade', 'Naturalidade', ['naturalidade', 'municipio']], ['provincia', 'Província', ['provincia']],
  ['pai', 'Pai', ['pai', 'nome do pai']], ['mae', 'Mãe', ['mae', 'nome da mae']], ['telefone', 'Telefone', ['telefone', 'telemovel', 'contacto']],
  ['email', 'E-mail', ['email', 'e mail']], ['morada', 'Morada', ['morada', 'residencia', 'endereco']], ['habilitacao', 'Habilitações', ['habilitacoes', 'habilitacao', 'habilitacoes literarias']],
  ['areaFormacao', 'Área de formação', ['area de formacao', 'formacao']], ['dataIngresso', 'Data de ingresso', ['data de ingresso', 'ingresso', 'incorporacao']],
  ['dataIngressoQP', 'Ingresso no QP', ['ingresso no qp', 'data de ingresso no qp']], ['dataAntiguidadePosto', 'Antiguidade no posto', ['antiguidade no posto', 'data do posto', 'data de promocao', 'antiguidade']],
  ['dataCargo', 'No cargo desde', ['no cargo desde', 'data do cargo', 'data de nomeacao']],
  ['carreiraCivil', 'Categoria (civis, como no SIGP)', ['categoria', 'carreira', 'categoria civil']], ['categoriaCivil', 'Classe (civis)', ['classe', 'categoria e classe']], ['vinculoCivil', 'Vínculo (civis)', ['vinculo civil']], ['dataAdmissao', 'Admissão (civis)', ['admissao', 'data de admissao']],
]
const sem = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

function mapear(tabela) {
  const [cab = [], ...resto] = tabela
  const idx = {}
  cab.forEach((h, i) => {
    const c = COLUNAS.find(([, , nomes]) => nomes.includes(sem(h)))
    if (c && idx[c[0]] === undefined) idx[c[0]] = i
  })
  return { campos: Object.keys(idx), ignoradas: cab.filter((h) => h && !COLUNAS.some(([, , n]) => n.includes(sem(h)))), linhas: resto.map((l) => Object.fromEntries(Object.entries(idx).map(([k, i]) => [k, String(l[i] ?? '').trim()]))) }
}

export default function Importar() {
  const { avisar } = useSessao()
  const navegar = useNavigate()
  const [aba, setAba] = useState('excel')
  const [modo, setModo] = useState('novos')
  const [folha, setFolha] = useState(null)
  const [resultado, setResultado] = useState(null)
  const [aTrabalhar, setATrabalhar] = useState(false)
  const [fotos, setFotos] = useState(null)

  async function escolher(f) {
    if (!f) return
    setResultado(null)
    try {
      const tabela = /\.xlsx$/i.test(f.name) ? await lerXlsx(await f.arrayBuffer()) : /\.(csv|txt)$/i.test(f.name) ? lerCsv(await f.text()) : null
      if (!tabela) throw new Error('Use um Excel (.xlsx) ou CSV. Os .xls antigos: grave primeiro como .xlsx.')
      const m = mapear(tabela)
      if (!m.campos.includes('nip') && !m.campos.includes('numeroAgente')) throw new Error('A folha tem de ter a coluna NIP (ou N.º de agente, para civis).')
      setFolha({ nome: f.name, ...m })
      await simular({ ...m }, modo)
    } catch (e) {
      avisar(e.message, 'erro')
    }
  }

  async function simular(f = folha, m = modo, gravar = false) {
    setATrabalhar(true)
    try {
      const r = await api('/pessoas/importar', { metodo: 'POST', corpo: { modo: m, simular: !gravar, linhas: f.linhas } })
      setResultado(r)
      if (gravar) avisar(`${r.resumo.validas} ficha(s) ${m === 'novos' ? 'criadas' : 'actualizadas'}; ${r.resumo.erros} linha(s) com erro.`)
    } catch (e) {
      avisar(e.message, 'erro')
    } finally {
      setATrabalhar(false)
    }
  }

  async function modelo() {
    const { default: writeXlsxFile } = await import('write-excel-file/browser')
    const exemplo = { nip: '123456', nome: 'António Manuel Kiala', ramo: 'EXE', posto: 'Coronel', fps: 'QP', quadroEspecial: 'INF', unidade: 'DE', cargo: 'Professor de Estratégia', vinculo: 'Docente', bi: '001234567LA041', dataNascimento: '12/04/1972', genero: 'M', provincia: 'Huíla', telefone: '+244 923 000 000', email: 'a.kiala@esgfaa.gov.ao', dataIngresso: '01/02/1992', dataAntiguidadePosto: '15/06/2019' }
    await writeXlsxFile([COLUNAS.map(([, t]) => ({ value: t, fontWeight: 'bold', backgroundColor: '#1f3a2d', textColor: '#ffffff' })), COLUNAS.map(([k]) => (exemplo[k] ? { value: exemplo[k], type: String } : null))], { columns: COLUNAS.map(([, t]) => ({ width: Math.max(14, t.length + 2) })), sheet: 'Militares' }).toFile('modelo-importacao-pessoal.xlsx')
  }

  async function enviarFotos(lista) {
    const ficheiros = [...lista].filter((f) => /^image\//.test(f.type))
    if (!ficheiros.length) return
    setFotos({ total: ficheiros.length, feitos: 0, resultados: [] })
    const todos = []
    for (let i = 0; i < ficheiros.length; i += 20) {
      const fd = new FormData()
      for (const f of ficheiros.slice(i, i + 20)) {
        try { fd.append('fotos', await reduzirFoto(f), f.name.replace(/\.[^.]+$/, '') + '.jpg') } catch (e) { todos.push({ ficheiro: f.name, ok: false, erro: e.message }) }
      }
      try {
        const r = await api('/fotos/lote', { metodo: 'POST', formulario: fd })
        todos.push(...r.resultados)
      } catch (e) {
        avisar(e.message, 'erro')
        break
      }
      setFotos({ total: ficheiros.length, feitos: Math.min(ficheiros.length, i + 20), resultados: [...todos] })
    }
    window.dispatchEvent(new Event('pes-fotos'))
  }

  const colunasResultado = useMemo(() => [
    { chave: 'linha', titulo: 'Linha', valor: (l) => l.linha, alinhar: 'end' },
    { chave: 'ident', titulo: 'NIP / N.º', valor: (l) => l.identificacao },
    { chave: 'nome', titulo: 'Nome', valor: (l) => l.nome },
    { chave: 'acao', titulo: 'Resultado', valor: (l) => l.acao, mostrar: (l) => (l.acao === 'erro' ? <span className="text-danger"><i className="fa fa-times-circle me-1" />{l.erro}</span> : <span className="text-success"><i className="fa fa-check-circle me-1" />{{ criar: 'Vai ser criado', actualizar: 'Vai ser actualizado', criado: 'Criado', actualizado: 'Actualizado' }[l.acao]}{l.campos?.length ? <span className="text-muted small"> ({l.campos.length} campo(s))</span> : ''}</span>) },
  ], [])

  return (
    <>
      <Cabecalho titulo="Importar Excel e fotografias" subtitulo="carregar os militares e civis de uma vez" migalhas={[['Pessoal', '/pessoas'], ['Importar']]} />
      <ul className="nav nav-tabs mb-3">
        <li className="nav-item"><button type="button" className={`nav-link ${aba === 'excel' ? 'active' : ''}`} onClick={() => setAba('excel')}><i className="fa fa-file-excel me-1" />Folha Excel</button></li>
        <li className="nav-item"><button type="button" className={`nav-link ${aba === 'fotos' ? 'active' : ''}`} onClick={() => setAba('fotos')}><i className="fa fa-images me-1" />Fotografias em lote</button></li>
      </ul>
      {aba === 'excel' && (
        <>
          <Painel titulo="1. Escolher a folha" icone="fa-file-excel">
            <div className="row align-items-end">
              <div className="col-md-4 mb-2">
                <label className="form-label small fw-semibold">O que fazer</label>
                <Escolha valor={modo} aoMudar={(m) => { setModo(m); if (folha) simular(folha, m) }} opcoes={[['novos', 'Inserir novos (cria fichas)'], ['actualizar', 'Actualizar por NIP (só as colunas preenchidas)']]} vazio={null} />
              </div>
              <div className="col-md-5 mb-2">
                <label className="form-label small fw-semibold">Folha Excel</label>
                <Carregar aceitar=".xlsx,.csv,.txt" maxMb={20} compacto icone="fa-file-excel" titulo={folha ? `Outra folha (actual: ${folha.nome})` : 'Arraste a folha para aqui'} ajuda="Excel (.xlsx) ou CSV · até 20 MB" aoEscolher={escolher} desativado={aTrabalhar} />
              </div>
              <div className="col-md-3 mb-2"><button type="button" className="btn btn-sm btn-outline-success w-100" onClick={modelo}><i className="fa fa-download me-1" />Descarregar o modelo</button></div>
            </div>
            <p className="small text-muted mb-0">A primeira linha tem os títulos das colunas (como no modelo). As correspondências são <strong>exactas</strong>, como no SIGP: posto, ramo, forma de serviço, quadro especial, unidade (nome ou sigla) e cargo têm de existir; o que não corresponder fica a vermelho e não é gravado. Os nomes ficam em «Primeira Letra Maiúscula». Datas em dd/mm/aaaa. Primeiro o sistema simula; só grava quando confirmar.</p>
            {folha && <div className="small mt-2"><strong>{folha.nome}</strong>: {folha.linhas.length} linha(s) · colunas reconhecidas: {folha.campos.map((c) => COLUNAS.find((x) => x[0] === c)[1]).join(', ')}{folha.ignoradas.length > 0 && <span className="text-warning"> · ignoradas: {folha.ignoradas.join(', ')}</span>}</div>}
          </Painel>
          {resultado && (
            <Painel titulo={resultado.simulacao ? '2. Verificação (nada foi gravado ainda)' : 'Resultado'} icone="fa-clipboard-check" acoes={resultado.simulacao && resultado.resumo.validas > 0 && <button type="button" className="btn btn-xs btn-theme" disabled={aTrabalhar} onClick={() => simular(folha, modo, true)}><i className="fa fa-check me-1" />{modo === 'novos' ? 'Criar' : 'Actualizar'} {resultado.resumo.validas} ficha(s)</button>}>
              <div className="d-flex gap-2 mb-2"><span className="badge bg-success fs-6">{resultado.resumo.validas} válida(s)</span><span className="badge bg-danger fs-6">{resultado.resumo.erros} com erro</span>{!resultado.simulacao && <button type="button" className="btn btn-sm btn-link" onClick={() => navegar('/pessoas')}>Ver o pessoal</button>}</div>
              <Tabela titulo="Importação de pessoal" colunas={colunasResultado} linhas={resultado.linhas} chave={(l) => l.linha} porPagina={50} aoClicar={(l) => l.id && navegar(`/pessoas/${l.id}`)} />
            </Painel>
          )}
        </>
      )}
      {aba === 'fotos' && (
        <Painel titulo="Fotografias em lote" icone="fa-images">
          <p className="small">Escolha a pasta (ou várias fotografias). O <strong>nome de cada ficheiro tem de ser o NIP</strong> (ou o n.º de agente, para civis), por exemplo <code>123456.jpg</code>. As fotografias são reduzidas antes de enviar.</p>
          <Carregar aceitar="image/*" multiplo pasta maxMb={30} icone="fa-images" titulo="Arraste a pasta ou as fotografias para aqui" ajuda="JPG, PNG ou WEBP · nome do ficheiro = NIP ou n.º de agente · reduzidas antes de enviar" aoEscolher={enviarFotos} progresso={fotos && fotos.feitos < fotos.total ? (fotos.feitos / fotos.total) * 100 : null} />
          {fotos && (
            <div className="mt-3">
              <div className="progress mb-2" style={{ height: 8 }}><div className="progress-bar bg-success" style={{ width: `${(fotos.feitos / fotos.total) * 100}%` }} /></div>
              <p className="small">{fotos.feitos} de {fotos.total} · <span className="text-success">{fotos.resultados.filter((r) => r.ok).length} associadas</span> · <span className="text-danger">{fotos.resultados.filter((r) => !r.ok).length} sem correspondência</span></p>
              <ul className="small mb-0" style={{ maxHeight: 260, overflow: 'auto' }}>{fotos.resultados.filter((r) => !r.ok).map((r) => <li key={r.ficheiro} className="text-danger">{r.ficheiro}: {r.erro}</li>)}</ul>
            </div>
          )}
        </Painel>
      )}
    </>
  )
}
