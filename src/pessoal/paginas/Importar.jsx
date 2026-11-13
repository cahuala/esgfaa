import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useSessao } from '../sessao'
import { folhasXlsx, lerCsv, lerXlsx } from '../../admin/paginas/academico/lerFolha'
import { reduzirFoto } from '../fotos'
import Tabela from '../componentes/Tabela'
import Carregar from '../componentes/Carregar'
import JuntarDocumentos from '../componentes/JuntarDocumentos'
import { caminhoDe } from '../separar'
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
  ['carreiraCivil', 'Categoria (civis)', ['categoria', 'carreira', 'categoria civil']], ['categoriaCivil', 'Classe (civis)', ['classe', 'categoria e classe']], ['vinculoCivil', 'Vínculo (civis)', ['vinculo civil']], ['dataAdmissao', 'Admissão (civis)', ['admissao', 'data de admissao']],
  // os da ficha de cadastramento
  ['nacionalidade', 'Nacionalidade', ['nacionalidade']], ['paisNascimento', 'País de nascimento', ['pais de nascimento', 'pais']],
  ['biEmitidoEm', 'Data de emissão do BI', ['data de emissao', 'emissao do bi', 'data de emissao do bi']], ['biValidade', 'Validade do BI', ['data de validacao', 'data de validade', 'validade', 'validade do bi']],
  ['biLocalEmissao', 'Local de emissão do BI', ['local de emissao', 'emitido em']], ['grupoSanguineo', 'Grupo sanguíneo', ['grupo sanguineo', 'grupo sangue', 'tipo sanguineo']],
  ['telefoneAlternativo', 'Telefone alternativo', ['tel alternativo', 'telefone alternativo', 'telefone 2', 'outro telefone']], ['emailPessoal', 'E-mail pessoal', ['email pessoal', 'e mail pessoal']],
  ['municipio', 'Município (residência)', ['municipio de residencia']], ['bairro', 'Bairro', ['bairro']],
  ['tipoDocente', 'Tipo de docente (efectivo/colaborador)', ['tipo de docente']], ['categoriaDocente', 'Categoria do docente', ['categoria do docente', 'categoria docente']],
  ['funcaoActual', 'Função ou cargo actual', ['funcao ou cargo actual', 'funcao actual', 'cargo actual', 'funcao ou cargo atual']], ['unidadeOrigem', 'Unidade de origem', ['unidade de origem']],
  ['observacoes', 'Observações', ['observacoes', 'obs']],
]
const sem = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

// a coluna da folha («A», «B»… «AA») pelo índice
const letra = (i) => (i < 26 ? String.fromCharCode(65 + i) : letra(Math.floor(i / 26) - 1) + String.fromCharCode(65 + (i % 26)))
const reconhecer = (h) => COLUNAS.find(([, , nomes]) => nomes.includes(sem(h)))?.[0] ?? ''
// a linha dos títulos: a primeira (das 10 primeiras) com mais colunas reconhecidas
const linhaDosTitulos = (tabela) => tabela.slice(0, 10).map((l, i) => [i, l.filter((h) => reconhecer(h)).length]).sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] ?? 0
// as ligações sugeridas: pelo título; as que a pessoa escolheu da última vez para os mesmos títulos (guardadas no navegador)
const chaveLigacoes = (cab) => `pes-importar:${cab.map(sem).join('|')}`
function sugerir(cab) {
  try {
    const guardadas = JSON.parse(localStorage.getItem(chaveLigacoes(cab)) ?? 'null')
    if (Array.isArray(guardadas) && guardadas.length === cab.length) return guardadas
  } catch { /* sem armazenamento: só as sugestões */ }
  const usados = new Set()
  return cab.map((h) => { const c = reconhecer(h); if (!c || usados.has(c)) return ''; usados.add(c); return c })
}
// as linhas da folha com as colunas ligadas aos campos da ficha
function aplicarLigacoes(tabela, titulos, ligacoes) {
  const linhas = tabela.slice(titulos + 1)
    .map((l) => Object.fromEntries(ligacoes.map((c, i) => (c ? [c, String(l[i] ?? '').trim()] : null)).filter(Boolean)))
    .filter((l) => Object.values(l).some(Boolean))
  return { linhas, campos: ligacoes.filter(Boolean) }
}

export default function Importar() {
  const { avisar, alteraEm } = useSessao()
  const navegar = useNavigate()
  const [aba, setAba] = useState('excel')
  const [modo, setModo] = useState('novos')
  // como no SIGP: cada BI da folha verifica-se na base de dados do Estado (preenche o que falta e avisa das diferenças)
  const [verificarBi, setVerificarBi] = useState(true)
  const [folha, setFolha] = useState(null)
  // a folha aberta, como no Navicat: o livro (as folhas), a linha dos títulos e para onde vai cada coluna
  const [fonte, setFonte] = useState(null) // { nome, ficheiro, folhas, folha, tabela, titulos, ligacoes }
  const [resultado, setResultado] = useState(null)
  const [aTrabalhar, setATrabalhar] = useState(false)
  const [fotos, setFotos] = useState(null)

  async function escolher(f) {
    if (!f) return
    try {
      const xlsx = /\.xlsx$/i.test(f.name)
      if (!xlsx && !/\.(csv|txt)$/i.test(f.name)) throw new Error('Use um Excel (.xlsx) ou CSV. Os .xls antigos: grave primeiro como .xlsx.')
      const folhas = xlsx ? await folhasXlsx(await f.arrayBuffer()) : []
      await abrirFolha({ nome: f.name, ficheiro: f, folhas }, 0)
    } catch (e) {
      avisar(e.message, 'erro')
    }
  }

  // abre uma folha do livro e sugere as ligações das colunas (a pessoa confirma ou muda antes de verificar)
  async function abrirFolha(base, indice) {
    setResultado(null)
    setFolha(null)
    try {
      const f = base.ficheiro
      const tabela = /\.xlsx$/i.test(f.name) ? await lerXlsx(await f.arrayBuffer(), { folha: indice }) : lerCsv(await f.text())
      if (!tabela.length) throw new Error('Essa folha está vazia.')
      const titulos = linhaDosTitulos(tabela)
      setFonte({ ...base, folha: indice, tabela, titulos, ligacoes: sugerir(tabela[titulos] ?? []) })
    } catch (e) {
      avisar(e.message, 'erro')
    }
  }

  function mudarTitulos(t) {
    setResultado(null)
    setFonte((x) => ({ ...x, titulos: t, ligacoes: sugerir(x.tabela[t] ?? []) }))
  }

  // cada campo da ficha só recebe uma coluna: escolhê-lo noutra coluna tira-o da anterior
  function ligar(i, campo) {
    setResultado(null)
    setFonte((x) => ({ ...x, ligacoes: x.ligacoes.map((c, j) => (j === i ? campo : campo && c === campo ? '' : c)) }))
  }

  async function verificar() {
    const m = aplicarLigacoes(fonte.tabela, fonte.titulos, fonte.ligacoes)
    if (!m.campos.includes('nip') && !m.campos.includes('numeroAgente')) return avisar('Ligue a coluna do NIP (ou do N.º de agente, para civis): é por ela que se encontra cada pessoa.', 'erro')
    if (!m.linhas.length) return avisar('Não há linhas com dados nas colunas ligadas.', 'erro')
    try { localStorage.setItem(chaveLigacoes(fonte.tabela[fonte.titulos] ?? []), JSON.stringify(fonte.ligacoes)) } catch { /* sem armazenamento */ }
    // desvio: os títulos podem não estar na primeira linha (o número da linha é o da folha)
    const f = { nome: fonte.nome, desvio: fonte.titulos, ...m }
    setFolha(f)
    await simular(f, modo)
  }

  async function simular(f = folha, m = modo, gravar = false, vb = verificarBi) {
    setATrabalhar(true)
    try {
      const r = await api('/pessoas/importar', { metodo: 'POST', corpo: { modo: m, simular: !gravar, verificarBi: vb, linhas: f.linhas } })
      setResultado({ ...r, linhas: r.linhas.map((l) => ({ ...l, linha: l.linha + (f.desvio ?? 0) })) })
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
    { chave: 'bi', titulo: 'BI (Estado)', valor: (l) => (l.avisos ?? []).join('; '), mostrar: (l) => (l.avisos?.length ? <span className="small text-warning"><i className="fa fa-exclamation-triangle me-1" />{l.avisos.join('; ')}</span> : l.biConfere ? <span className="small text-success"><i className="fa fa-id-card me-1" />Confere{l.doBi?.length ? ` · do BI: ${l.doBi.length} campo(s)` : ''}</span> : null) },
    { chave: 'acao', titulo: 'Resultado', valor: (l) => l.acao, mostrar: (l) => (l.acao === 'erro' ? <span className="text-danger"><i className="fa fa-times-circle me-1" />{l.erro}</span> : <span className="text-success"><i className="fa fa-check-circle me-1" />{{ criar: 'Vai ser criado', actualizar: 'Vai ser actualizado', criado: 'Criado', actualizado: 'Actualizado' }[l.acao]}{l.campos?.length ? <span className="text-muted small"> ({l.campos.length} campo(s))</span> : ''}</span>) },
  ], [])

  return (
    <>
      <Cabecalho titulo="Importar Excel e fotografias" subtitulo="carregar os militares e civis de uma vez" migalhas={[['Pessoal', '/pessoas'], ['Importar']]} />
      <ul className="nav nav-tabs mb-3">
        <li className="nav-item"><button type="button" className={`nav-link ${aba === 'excel' ? 'active' : ''}`} onClick={() => setAba('excel')}><i className="fa fa-file-excel me-1" />Folha Excel</button></li>
        <li className="nav-item"><button type="button" className={`nav-link ${aba === 'fotos' ? 'active' : ''}`} onClick={() => setAba('fotos')}><i className="fa fa-images me-1" />Fotografias em lote</button></li>
        {alteraEm('processos') && <li className="nav-item"><button type="button" className={`nav-link ${aba === 'processos' ? 'active' : ''}`} onClick={() => setAba('processos')}><i className="fa fa-folder-open me-1" />Processos individuais (pastas)</button></li>}
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
              <div className="col-12 mb-2"><label className="form-check mb-0"><input type="checkbox" className="form-check-input" checked={verificarBi} onChange={(e) => { setVerificarBi(e.target.checked); if (folha) simular(folha, modo, false, e.target.checked) }} /> <span className="form-check-label">Verificar cada BI na base de dados do Estado <span className="text-muted small">(preenche o nome, a filiação e o nascimento que faltarem e avisa do que não bater certo)</span></span></label></div>
              <div className="col-md-3 mb-2"><button type="button" className="btn btn-sm btn-outline-success w-100" onClick={modelo}><i className="fa fa-download me-1" />Descarregar o modelo</button></div>
            </div>
            <p className="small text-muted mb-0">Depois de escolher, liga-se cada coluna da folha ao campo da ficha (o sistema sugere pelos títulos; pode mudar). As correspondências são <strong>exactas</strong>: posto, ramo, forma de serviço, quadro especial, unidade (nome ou sigla) e cargo têm de existir; o que não corresponder fica a vermelho e não é gravado. Os nomes ficam em «Primeira Letra Maiúscula». Datas em dd/mm/aaaa. Primeiro o sistema simula; só grava quando confirmar.</p>
          </Painel>
          {fonte && <LigarColunas fonte={fonte} aoMudarFolha={(i) => abrirFolha(fonte, i)} aoMudarTitulos={mudarTitulos} aoLigar={ligar} aoVerificar={verificar} aTrabalhar={aTrabalhar} />}
          {resultado && (
            <Painel titulo={resultado.simulacao ? '3. Verificação (nada foi gravado ainda)' : 'Resultado'} icone="fa-clipboard-check" acoes={resultado.simulacao && resultado.resumo.validas > 0 && <button type="button" className="btn btn-xs btn-theme" disabled={aTrabalhar} onClick={() => simular(folha, modo, true)}><i className="fa fa-check me-1" />{modo === 'novos' ? 'Criar' : 'Actualizar'} {resultado.resumo.validas} ficha(s)</button>}>
              <div className="d-flex gap-2 mb-2"><span className="badge bg-success fs-6">{resultado.resumo.validas} válida(s)</span><span className="badge bg-danger fs-6">{resultado.resumo.erros} com erro</span>{resultado.resumo.avisos > 0 && <span className="badge bg-warning text-dark fs-6">{resultado.resumo.avisos} com aviso do BI</span>}{resultado.resumo.biConferidos > 0 && <span className="badge bg-light text-dark border fs-6">{resultado.resumo.biConferidos} BI conferido(s)</span>}{resultado.resumo.biIndisponivel && <span className="small text-danger align-self-center">O serviço do BI não respondeu: as restantes linhas não foram verificadas.</span>}{!resultado.simulacao && <button type="button" className="btn btn-sm btn-link" onClick={() => navegar('/pessoas')}>Ver o pessoal</button>}</div>
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
      {aba === 'processos' && <ProcessosEmLote />}
    </>
  )
}

const identificacao = (t) => String(t ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
// a pessoa de um ficheiro: a pasta (ou o nome do ficheiro) com o NIP, o n.º de agente ou o nome completo
function pessoaDoCaminho(caminho, porId, porNome) {
  const partes = caminho.split('/')
  for (const parte of [...partes.slice(0, -1).reverse(), partes.at(-1).replace(/\.[^.]+$/, '')]) {
    for (const palavra of parte.split(/[^A-Za-z0-9]+/)) {
      const p = porId.get(identificacao(palavra))
      if (p) return p
    }
    const p = porNome.get(sem(parte.replace(/[0-9]/g, '')))
    if (p) return p
  }
  return null
}

/*
  Processos individuais em lote: uma pasta com uma subpasta por militar (o NIP, o n.º de agente ou o nome
  completo no nome da subpasta, ex.: «Processos/123456 - João Manuel/…»). Cada ficheiro vai para o processo
  dessa pessoa; o sistema reconhece cada documento e separa os PDFs que tenham vários (JuntarDocumentos).
*/
function ProcessosEmLote() {
  const { avisar } = useSessao()
  const [grupos, setGrupos] = useState(null)
  const [juntar, setJuntar] = useState(null)
  async function escolher(ficheiros) {
    try {
      const pessoas = await api('/pessoas', { consulta: { ativo: 'todos' } })
      const porId = new Map()
      for (const p of pessoas) for (const k of [p.nip, p.numeroAgente]) if (identificacao(k).length >= 3) porId.set(identificacao(k), p)
      const porNome = new Map(pessoas.map((p) => [sem(p.nome), p]))
      const g = new Map()
      const semPessoa = []
      for (const f of ficheiros) {
        const p = pessoaDoCaminho(caminhoDe(f), porId, porNome)
        if (!p) { semPessoa.push(caminhoDe(f)); continue }
        if (!g.has(p.id)) g.set(p.id, { pessoa: p, ficheiros: [] })
        g.get(p.id).ficheiros.push(f)
      }
      setGrupos({ lista: [...g.values()], semPessoa })
    } catch (e) { avisar(e.message, 'erro') }
  }
  const itens = (grupos?.lista ?? []).flatMap(({ pessoa, ficheiros }) => ficheiros.map((f) => ({ pessoaId: pessoa.id, pessoaNome: `${pessoa.nip ?? pessoa.numeroAgente ?? ''} ${pessoa.nome}`.trim(), ficheiro: f })))
  return (
    <Painel titulo="Processos individuais: pasta com uma subpasta por militar" icone="fa-folder-open">
      <p className="small">Arraste a pasta grande (ou escolha-a). Dentro dela, <strong>uma subpasta por militar ou civil</strong>, com o <strong>NIP</strong> (ou o n.º de agente, ou o nome completo) no nome da subpasta, por exemplo <code>Processos/123456 - João Manuel/BI.pdf</code>. O sistema lê cada documento, reconhece o tipo (BI, extractos, louvores…), separa os PDFs que tenham vários documentos e mostra tudo para conferir antes de juntar aos processos.</p>
      <Carregar aceitar="application/pdf,image/*,.docx,.xlsx" multiplo pasta maxMb={25} icone="fa-folder-open" titulo="Arraste a pasta dos processos para aqui" ajuda="PDF, imagens ou Word · uma subpasta por pessoa (NIP no nome)" aoEscolher={escolher} />
      {grupos && (
        <div className="mt-3">
          <p className="small mb-2"><span className="text-success fw-bold">{grupos.lista.length} pessoa(s)</span> · {itens.length} ficheiro(s){grupos.semPessoa.length > 0 && <> · <span className="text-danger">{grupos.semPessoa.length} sem pessoa (a pasta não tem um NIP, n.º de agente ou nome que exista)</span></>}</p>
          <ul className="small mb-2" style={{ maxHeight: 220, overflow: 'auto' }}>
            {grupos.lista.map(({ pessoa, ficheiros }) => <li key={pessoa.id}><strong>{pessoa.nip ?? pessoa.numeroAgente}</strong> {pessoa.nome}: {ficheiros.length} ficheiro(s)</li>)}
            {grupos.semPessoa.slice(0, 50).map((c) => <li key={c} className="text-danger">{c}</li>)}
          </ul>
          <button type="button" className="btn btn-sm btn-theme" disabled={!itens.length} onClick={() => setJuntar(itens)}><i className="fa fa-search me-1" />Ler e separar {itens.length} ficheiro(s)</button>
        </div>
      )}
      {juntar && <JuntarDocumentos itens={juntar} aoFechar={() => setJuntar(null)} aoTerminar={() => { setJuntar(null); setGrupos(null) }} />}
    </Painel>
  )
}

/*
  2.º passo da importação, como no Navicat: a folha do livro, a linha dos títulos e, para cada coluna da folha,
  o campo da ficha para onde vai (ou «não importar»). Mostra exemplos dos valores de cada coluna.
*/
function LigarColunas({ fonte, aoMudarFolha, aoMudarTitulos, aoLigar, aoVerificar, aTrabalhar }) {
  const cab = fonte.tabela[fonte.titulos] ?? []
  const dados = fonte.tabela.slice(fonte.titulos + 1)
  const largura = Math.max(cab.length, ...dados.slice(0, 50).map((l) => l.length))
  const colunas = Array.from({ length: largura }, (_, i) => i).filter((i) => String(cab[i] ?? '').trim() || dados.some((l) => String(l[i] ?? '').trim()))
  const exemplos = (i) => [...new Set(dados.map((l) => String(l[i] ?? '').trim()).filter(Boolean))].slice(0, 3)
  const ligadas = fonte.ligacoes.filter(Boolean).length
  const temIdent = fonte.ligacoes.includes('nip') || fonte.ligacoes.includes('numeroAgente')
  const opcoes = [...COLUNAS].sort((a, b) => a[1].localeCompare(b[1], 'pt'))
  return (
    <Painel titulo="2. Ligar as colunas da folha aos campos da ficha" icone="fa-random"
      acoes={<button type="button" className="btn btn-xs btn-theme" disabled={aTrabalhar || !ligadas} onClick={aoVerificar}><i className="fa fa-clipboard-check me-1" />Verificar ({dados.length} linha(s))</button>}>
      <div className="row g-2 align-items-end mb-2">
        {fonte.folhas.length > 1 && (
          <div className="col-md-4">
            <label className="form-label small fw-semibold">Folha do livro</label>
            <Escolha valor={String(fonte.folha)} aoMudar={(v) => aoMudarFolha(Number(v))} opcoes={fonte.folhas.map((n, i) => [String(i), n])} vazio={null} aria-label="Folha do livro" />
          </div>
        )}
        <div className="col-md-5">
          <label className="form-label small fw-semibold">Os títulos estão na linha</label>
          <Escolha valor={String(fonte.titulos)} aoMudar={(v) => aoMudarTitulos(Number(v))} opcoes={fonte.tabela.slice(0, 10).map((l, i) => [String(i), `${i + 1}: ${l.filter(Boolean).slice(0, 4).join(' · ').slice(0, 70)}`])} vazio={null} aria-label="Linha dos títulos" />
        </div>
        <div className="col-md-3 small text-muted"><strong>{ligadas}</strong> de {colunas.length} coluna(s) ligada(s){!temIdent && <div className="text-danger"><i className="fa fa-exclamation-circle me-1" />Falta ligar o NIP (ou o N.º de agente)</div>}</div>
      </div>
      <div className="table-responsive">
        <table className="table table-sm align-middle mb-0">
          <thead><tr><th style={{ width: 60 }}>Coluna</th><th>Título na folha</th><th>Exemplos</th><th style={{ width: 300 }}>Vai para</th></tr></thead>
          <tbody>
            {colunas.map((i) => (
              <tr key={i} className={fonte.ligacoes[i] ? '' : 'text-muted'}>
                <td><code>{letra(i)}</code></td>
                <td className="fw-semibold">{cab[i] || <i className="text-muted">(sem título)</i>}</td>
                <td className="small text-truncate" style={{ maxWidth: 260 }}>{exemplos(i).join(' · ') || '—'}</td>
                <td>
                  <select className={`form-select form-select-sm ${fonte.ligacoes[i] ? 'border-success' : ''}`} value={fonte.ligacoes[i] ?? ''} onChange={(e) => aoLigar(i, e.target.value)} aria-label={`Coluna ${letra(i)} vai para`}>
                    <option value="">— não importar —</option>
                    {opcoes.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="small text-muted mt-2 mb-0">As ligações que escolher ficam lembradas neste computador para as folhas com os mesmos títulos.</p>
    </Painel>
  )
}
