import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useDados } from '../useDados'
import { useSessao } from '../sessao'
import Foto from '../componentes/Foto'
import Carregar from '../componentes/Carregar'
import { reduzirFoto } from '../fotos'
import Tabela from '../componentes/Tabela'
import { Cabecalho, Campo, Carregando, Erro, Escolha, EscolhaCategoriaDocente, InputData, Modal, Painel } from '../componentes/Ui'
import { imprimirFichas } from '../../admin/paginas/pessoal/fichasAcesso'
import { textoDespacho } from '../despacho'
import { documentoExcel, documentoPdf } from '../exportar'
import { dataPt } from '../formatar'

const TEXTOS = {
  estudante: { titulo: 'Estudantes', um: 'estudante', icone: 'fa-user-graduate', sub: 'quem frequenta os cursos da Escola — também os que vêm de outras unidades' },
  docente: { titulo: 'Docentes', um: 'docente', icone: 'fa-chalkboard-teacher', sub: 'os docentes da Escola e os colaboradores (militares de outras unidades e civis)' },
}

// o estado no portal: o envio e a conta (nunca entrou, palavra-passe inicial, ativa)
function EstadoPortal({ e, ligado }) {
  if (!ligado) return <span className="text-muted small">—</span>
  if (!e) return <span className="badge bg-light text-dark border" title="Ainda não foi enviado (falta o e-mail?)">Sem conta</span>
  if (e.envio === 'erro') return <span className="badge bg-danger" title={e.erro}>Erro no envio</span>
  if (!e.conta) return <span className="badge bg-warning text-dark">A enviar…</span>
  if (e.conta.ativo === false) return <span className="badge bg-secondary">Conta desactivada</span>
  if (!e.conta.ultimoAcesso) return <span className="badge bg-warning text-dark" title="Entregue a ficha de acesso">Nunca entrou</span>
  if (e.conta.deveMudarSenha) return <span className="badge bg-info">Palavra-passe inicial</span>
  return <span className="badge bg-success">Activa</span>
}

// o mesmo estado, em texto (para o filtro, a pesquisa e a exportação)
const ESTADOS_PORTAL = [['sem', 'Sem conta'], ['erro', 'Erro no envio'], ['nunca', 'Nunca entrou'], ['inicial', 'Palavra-passe inicial'], ['ativa', 'Activa'], ['desativada', 'Conta desactivada']]
function estadoPortal(e) {
  if (!e) return 'sem'
  if (e.envio === 'erro') return 'erro'
  if (!e.conta) return 'sem'
  if (e.conta.ativo === false) return 'desativada'
  if (!e.conta.ultimoAcesso) return 'nunca'
  return e.conta.deveMudarSenha ? 'inicial' : 'ativa'
}
const nomeEstado = Object.fromEntries(ESTADOS_PORTAL)

// de onde vem: FAA (pelo ramo), Polícia Nacional, estrangeiro (com o país) ou civil
const ORIGENS = [['faa', 'FAA'], ['policia', 'Polícia Nacional'], ['estrangeiro', 'Estrangeiros'], ['civil', 'Civis']]
const RAMO_NOME = { EXE: 'Exército', FAN: 'Força Aérea Nacional', MGA: 'Marinha de Guerra Angolana' }
const textoOrigem = (p) => (p.origem === 'faa' ? `FAA — ${p.ramoPorConfirmar ? 'ramo por confirmar' : RAMO_NOME[p.ramo] ?? ''}` : p.origem === 'policia' ? 'Polícia Nacional' : p.origem === 'estrangeiro' ? `Estrangeiro — ${p.paisNascimento || p.nacionalidade}` : 'Civil')
function Origem({ p }) {
  if (p.origem === 'faa') return <>{p.ramoPorConfirmar ? <span className="badge bg-warning text-dark" title="A lista não dizia o ramo (ficou Exército): confirme-o na ficha">FAA · ramo por confirmar</span> : <span className={`badge pes-ramo-${p.ramo}`} title={`FAA — ${RAMO_NOME[p.ramo] ?? ''}`}>FAA · {p.ramo}</span>}</>
  if (p.origem === 'policia') return <span className="badge pes-origem-policia"><i className="fa fa-shield-alt me-1" />Polícia Nacional</span>
  if (p.origem === 'estrangeiro') return <span className="badge pes-origem-estrangeiro" title={p.unidadeOrigem}><i className="fa fa-globe-africa me-1" />Estrangeiro · {p.paisNascimento || p.nacionalidade}</span>
  return <span className="badge pes-origem-civil">Civil</span>
}
// o órgão de onde vem (fora da ESG) ou o país, para os estrangeiros
const orgaoDe = (p) => (p.origem === 'estrangeiro' ? p.unidadeOrigem || p.paisNascimento : p.unidadeNome || p.unidadeOrigem || '')
const postoDe = (p) => (p.tipo === 'militar' ? p.postoNome : p.postoExterno || 'Civil')

/*
  Cada ano lectivo em separado: quantos houve e de onde vieram (FAA por ramo, Polícia Nacional, estrangeiros e
  civis). Clicar numa linha mostra a lista desse ano.
*/
function ResumoAnos({ tipo, resumo, ano, aoEscolher }) {
  const est = tipo === 'estudante'
  const g = (a) => (est ? a.estudantes : a.docentes)
  const linhas = resumo.filter((a) => g(a).total)
  if (!linhas.length) return null
  return (
    <Painel titulo={`${est ? 'Estudantes' : 'Docentes'} por ano lectivo`} icone="fa-calendar-alt" corpo={false}>
      <div className="table-responsive">
        <table className="table table-sm table-hover align-middle mb-0 pes-resumo-anos">
          <thead><tr>
            <th>Ano lectivo</th><th className="text-end">Total</th><th className="text-end">Militares FAA</th><th className="text-end">Exército</th><th className="text-end">Força Aérea</th><th className="text-end">Marinha</th>
            <th className="text-end">Polícia Nacional</th><th className="text-end">Estrangeiros</th><th className="text-end">Civis</th>
            {est ? <th className="text-end">Terminaram</th> : <><th className="text-end">Efectivos</th><th className="text-end">Colaboradores</th><th className="text-end">Novos no ano</th></>}
          </tr></thead>
          <tbody>
            {linhas.map((a) => { const x = g(a); return (
              <tr key={a.anoLetivo} className={a.anoLetivo === ano ? 'escolhido' : ''} onClick={() => aoEscolher(a.anoLetivo)} title={`Ver a lista de ${a.anoLetivo}`}>
                <td>{a.anoLetivo}</td><td className="text-end fw-bold">{x.total}</td><td className="text-end">{x.militares}</td><td className="text-end">{x.EXE}</td><td className="text-end">{x.FAN}</td><td className="text-end">{x.MGA}</td>
                <td className="text-end">{x.policia}</td><td className="text-end">{x.estrangeiros}</td><td className="text-end">{x.civis}</td>
                {est ? <td className="text-end">{x.concluiram}</td> : <><td className="text-end">{x.efectivos}</td><td className="text-end">{x.colaboradores}</td><td className="text-end">{x.novos}</td></>}
              </tr>
            ) })}
          </tbody>
        </table>
      </div>
    </Painel>
  )
}

// tudo o que a pesquisa procura, além das colunas: BI, telefone, nome de guerra, género, idade, naturalidade…
const pesquisarEm = (p) => [p.bi, p.telefone, p.nomeGuerra, p.postoAbreviatura, p.genero === 'F' ? 'feminino mulher' : p.genero === 'M' ? 'masculino homem' : '', p.idade && `${p.idade} anos`,
  p.naturalidade, p.provincia, p.habilitacao, p.areaFormacao, p.especialidade, p.categoriaDocente, p.funcaoActual, p.nacionalidade, p.dataNascimento].filter(Boolean).join(' ')

/*
  Estudantes ou docentes (tipo), numa tabela só deles: fotografia, posto, NIP, unidade (da ESG ou a de origem)
  e o estado no portal. Registo rápido (só o necessário) e fichas de acesso de vários de uma vez.
*/
export default function Academicos({ tipo }) {
  const t = TEXTOS[tipo]
  const navegar = useNavigate()
  const { pode, avisar, ref } = useSessao()
  const editar = pode('editar')
  const [ativo, setAtivo] = useState('sim')
  // o ano lectivo: a lista desse ano (também quem já saiu); vazio = quem está hoje (ou já saiu)
  const { dados: resumo, erro: erroResumo } = useDados('/academicos/resumo', {})
  const [anoEscolhido, setAno] = useState(null)
  const doTipo = (resumo ?? []).filter((a) => (tipo === 'estudante' ? a.estudantes : a.docentes).total)
  const ano = anoEscolhido ?? (resumo ? doTipo[0]?.anoLetivo ?? '' : erroResumo ? '' : null)
  const { dados, erro, recarregar } = useDados(ano === null ? null : '/academicos', { tipo, ativo, ...(ano ? { anoLetivo: ano } : {}) }, { tempoReal: true })
  const [escolhidos, setEscolhidos] = useState(() => new Set())
  const [novo, setNovo] = useState(false)
  const [aImprimir, setAImprimir] = useState(false)
  const SEM_FILTRO = { ramo: '', origem: '', unidade: '', orgao: '', curso: '', portal: '', tipoDocente: '', categoriaDocente: '', genero: '' }
  const [filtro, setFiltro] = useState(SEM_FILTRO)
  const ligado = Boolean(dados?.portalLigado)
  const todos = useMemo(() => dados?.pessoas ?? [], [dados])
  // o que se fez nesse ano: o curso (estudantes) ou as cadeiras (docentes)
  const doAno = (p) => (p.anos ?? []).filter((a) => !ano || ano === 'sem' || a.anoLetivo === ano)
  const lista = todos.filter((p) => (!filtro.ramo || (filtro.ramo === 'civil' ? p.tipo === 'civil' : filtro.ramo === 'porConfirmar' ? p.ramoPorConfirmar : p.ramo === filtro.ramo && !p.ramoPorConfirmar))
    && (!filtro.origem || p.origem === filtro.origem)
    && (!filtro.orgao || orgaoDe(p) === filtro.orgao)
    && (!filtro.curso || (p.anos ?? []).some((a) => a.curso === filtro.curso && (!ano || ano === 'sem' || a.anoLetivo === ano)))
    && (!filtro.unidade || (filtro.unidade === 'fora' ? Boolean(p.unidadeOrigem) && !p.unidadeNome : !p.unidadeOrigem || Boolean(p.unidadeNome)))
    && (!filtro.portal || estadoPortal(p.portal) === filtro.portal)
    && (!filtro.tipoDocente || (filtro.tipoDocente === 'sem' ? !p.tipoDocente : p.tipoDocente === filtro.tipoDocente))
    && (!filtro.categoriaDocente || p.categoriaDocente === filtro.categoriaDocente)
    && (!filtro.genero || p.genero === filtro.genero))
  const mudarFiltro = (k) => (v) => setFiltro((f) => ({ ...f, [k]: v }))
  const comFiltro = Object.values(filtro).some(Boolean)
  const comConta = (p) => p.portal?.conta?.id && p.ativo

  const alternar = (id) => setEscolhidos((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  async function fichas() {
    setAImprimir(true)
    try {
      const r = await api('/fichas-acesso', { metodo: 'POST', corpo: { ids: [...escolhidos] } })
      if (r.fichas.length) await imprimirFichas(r.fichas, r.fichas[0].portal ? { portal: `${r.fichas[0].portal}/` } : undefined)
      if (r.erros.length) avisar(`${r.fichas.length} ficha(s) impressa(s). Sem ficha: ${r.erros.map((x) => `${x.nome} (${x.erro})`).join('; ')}`, 'erro')
      else avisar(`${r.fichas.length} ficha(s) de acesso impressa(s). As palavras-passe anteriores deixaram de valer.`)
      setEscolhidos(new Set())
      recarregar()
    } catch (e) {
      avisar(e.message, 'erro')
    } finally {
      setAImprimir(false)
    }
  }

  const colunas = [
    ...(editar && ligado ? [{
      chave: 'escolher', titulo: '', exportar: false, valor: () => '',
      mostrar: (p) => (comConta(p) ? <input type="checkbox" className="form-check-input" checked={escolhidos.has(p.id)} onClick={(e) => e.stopPropagation()} onChange={() => alternar(p.id)} aria-label={`Escolher ${p.nome}`} /> : null),
    }] : []),
    { chave: 'nome', titulo: 'Nome', valor: (p) => p.nome, mostrar: (p) => <span className="pes-pessoa"><Foto pessoaId={p.id} fotoId={p.fotoId} nome={p.nome} /><span><strong>{p.nome}</strong><div className="small text-muted">{p.email || 'sem e-mail'}</div></span></span> },
    { chave: 'posto', titulo: 'Posto', valor: postoDe },
    { chave: 'origem', titulo: 'Origem', valor: textoOrigem, mostrar: (p) => <Origem p={p} /> },
    { chave: 'ident', titulo: 'NIP / N.º', valor: (p) => p.nip || p.numeroAgente || '' },
    { chave: 'unidade', titulo: 'Órgão / unidade de origem', valor: orgaoDe, mostrar: (p) => (p.unidadeNome || (orgaoDe(p) ? <span>{orgaoDe(p)} <span className="badge bg-light text-dark border">de fora</span></span> : <span className="text-muted">—</span>)) },
    { chave: 'ano', titulo: tipo === 'estudante' ? 'Curso' : 'Cadeiras', valor: (p) => [...new Set(doAno(p).map((a) => a.curso).filter(Boolean))].join('; '), mostrar: (p) => { const l = doAno(p); return l.length ? <span className="small">{[...new Set(l.map((a) => a.curso).filter(Boolean))].join('; ')}{tipo === 'estudante' && l.some((a) => a.concluido) && <span className="badge bg-success ms-1">Terminou</span>}</span> : <span className="text-muted">—</span> } },
    { chave: 'dataNascimento', titulo: 'Data de nascimento', valor: (p) => (p.dataNascimento ? dataPt(p.dataNascimento) : ''), oculta: true },
    { chave: 'funcaoActual', titulo: 'Função que exerce', valor: (p) => p.funcaoActual || '', oculta: true },
    { chave: 'areaFormacao', titulo: 'Formação académica', valor: (p) => [ref.habilitacoes?.[p.habilitacao] ?? '', p.areaFormacao].filter(Boolean).join(' — '), oculta: true },
    { chave: 'anos', titulo: 'Anos lectivos', valor: (p) => [...new Set((p.anos ?? []).map((a) => a.anoLetivo))].join(', '), oculta: true },
    ...(tipo === 'docente' ? [{ chave: 'tipoDocente', titulo: 'Tipo', valor: (p) => (p.tipoDocente === 'colaborador' ? 'Colaborador' : p.tipoDocente === 'efectivo' ? 'Efectivo' : '') }, { chave: 'categoriaDocente', titulo: 'Categoria do docente', valor: (p) => p.categoriaDocente || '', oculta: true }] : []),
    { chave: 'conta', titulo: 'N.º no portal', valor: (p) => p.portal?.conta?.numero || '' },
    { chave: 'telefone', titulo: 'Telefone', valor: (p) => p.telefone || '', oculta: true },
    { chave: 'bi', titulo: 'BI', valor: (p) => p.bi || '', oculta: true },
    { chave: 'genero', titulo: 'Género', valor: (p) => (p.genero === 'F' ? 'Feminino' : p.genero === 'M' ? 'Masculino' : ''), oculta: true },
    { chave: 'idade', titulo: 'Idade', valor: (p) => p.idade ?? '', alinhar: 'end', oculta: true },
    { chave: 'habilitacao', titulo: 'Habilitações', valor: (p) => ref.habilitacoes?.[p.habilitacao] ?? p.habilitacao ?? '', oculta: true },
    { chave: 'portal', titulo: 'Portal', valor: (p) => (p.docentePendente ? 'A aguardar despacho' : nomeEstado[estadoPortal(p.portal)]), mostrar: (p) => (p.docentePendente ? <span className="badge bg-warning text-dark" title="Só conta como docente (e só tem conta no portal) depois do despacho do Comandante"><i className="fa fa-stamp me-1" />A aguardar despacho</span> : <EstadoPortal e={p.portal} ligado={ligado} />) },
  ]
  /*
    Quadro estatístico da lista que está à vista (por exemplo, os orientadores e arguentes do ano, ou os discentes
    de um curso): quantos há de cada posto e de cada origem (FAA por ramo, Polícia Nacional, estrangeiros, civis).
  */
  async function quadroPorPosto(formato) {
    const postos = [...new Set(lista.map(postoDe))]
    const origens = [...new Set(lista.map((p) => (p.origem === 'faa' ? p.ramo || 'FAA' : p.origem === 'policia' ? 'PNA' : p.origem === 'estrangeiro' ? 'Estrangeiros' : 'Civis')))]
    const chaveOrigem = (p) => (p.origem === 'faa' ? p.ramo || 'FAA' : p.origem === 'policia' ? 'PNA' : p.origem === 'estrangeiro' ? 'Estrangeiros' : 'Civis')
    const linhas = postos.map((x) => ({ posto: x, ...Object.fromEntries(origens.map((o) => [o, lista.filter((p) => postoDe(p) === x && chaveOrigem(p) === o).length])), total: lista.filter((p) => postoDe(p) === x).length }))
    const titulo = `QUADRO ESTATÍSTICO — ${t.titulo.toUpperCase()}${ano && ano !== 'sem' ? ` DO ANO LECTIVO ${ano}` : ''}`
    const d = {
      titulo, subtitulo: [filtro.curso, comFiltro && 'com os filtros escolhidos'].filter(Boolean).join(' · '), orientacao: 'portrait',
      seccoes: [{ colunas: [{ titulo: 'Designação', valor: (l) => l.posto }, ...origens.map((o) => ({ titulo: o, valor: (l) => l[o] || '', alinhar: 'center', largura: 22 })), { titulo: 'Subtotal', valor: (l) => l.total, alinhar: 'center', largura: 22 }], linhas, totais: ['TOTAL', ...origens.map((o) => lista.filter((p) => chaveOrigem(p) === o).length), lista.length] }],
    }
    try { await (formato === 'excel' ? documentoExcel(d) : documentoPdf(d)) } catch (e) { avisar(e.message, 'erro') }
  }
  const porEntregar = lista.filter((p) => comConta(p) && !p.portal.conta.ultimoAcesso)

  return (
    <>
      <Cabecalho titulo={t.titulo} subtitulo={t.sub} migalhas={[[t.titulo]]}>
        {editar && <button type="button" className="btn btn-theme" onClick={() => setNovo(true)}><i className="fa fa-user-plus me-1" />Registar {t.um}</button>}
      </Cabecalho>
      {!ligado && dados && <div className="alert alert-warning py-2"><i className="fa fa-plug me-2" />O Pessoal não está ligado ao Portal Académico: as contas e as fichas de acesso não estão disponíveis.</div>}
      {ligado && porEntregar.length > 0 && editar && (
        <div className="alert alert-info py-2 d-flex flex-wrap align-items-center gap-2">
          <i className="fa fa-key" />
          <span className="flex-grow-1">{porEntregar.length} {porEntregar.length === 1 ? `${t.um} ainda não entrou` : `ainda não entraram`} no portal (falta entregar a ficha de acesso?).</span>
          <button type="button" className="btn btn-sm btn-white" onClick={() => setEscolhidos(new Set(porEntregar.map((p) => p.id)))}>Escolher esses</button>
        </div>
      )}
      {resumo && <ResumoAnos tipo={tipo} resumo={resumo} ano={ano} aoEscolher={setAno} />}
      <Painel titulo={`${t.titulo}${ano && ano !== 'sem' ? ` do ano lectivo ${ano}` : ''}${dados ? ` (${comFiltro ? `${lista.length} de ${todos.length}` : todos.length})` : ''}`} icone={t.icone} corpo={false}>
        <div className="pes-filtros">
          <Escolha valor={ano ?? ''} aoMudar={(v) => setAno(v)} opcoes={[...doTipo.map((a) => [a.anoLetivo, `Ano lectivo ${a.anoLetivo}`]), ['sem', 'Sem ano lectivo registado']]} vazio="Todos os anos" aria-label="Ano lectivo" />
          {!ano && <Escolha valor={ativo} aoMudar={setAtivo} opcoes={[['sim', 'Na Escola'], ['nao', 'Já saíram'], ['todos', 'Todos']]} vazio={null} aria-label="Quem mostrar" />}
          <Escolha valor={filtro.origem} aoMudar={mudarFiltro('origem')} opcoes={ORIGENS} vazio="Todas as origens" aria-label="Origem" />
          <Escolha valor={filtro.ramo} aoMudar={mudarFiltro('ramo')} opcoes={[...Object.entries(ref.ramos).map(([k, v]) => [k, v.nome]), ['porConfirmar', 'Ramo por confirmar'], ['civil', 'Civis']]} vazio="Todos os ramos" aria-label="Ramo" />
          <Escolha valor={filtro.orgao} aoMudar={mudarFiltro('orgao')} opcoes={[...new Set(todos.map(orgaoDe).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt'))} vazio="Qualquer órgão de origem" aria-label="Órgão de origem" />
          <Escolha valor={filtro.curso} aoMudar={mudarFiltro('curso')} opcoes={[...new Set(todos.flatMap((p) => doAno(p).map((a) => a.curso)).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt'))} vazio={tipo === 'estudante' ? 'Todos os cursos' : 'Todas as cadeiras'} aria-label={tipo === 'estudante' ? 'Curso' : 'Cadeira'} />
          <Escolha valor={filtro.unidade} aoMudar={mudarFiltro('unidade')} opcoes={[['esg', 'Da ESG'], ['fora', 'De outras unidades']]} vazio="Da ESG ou de fora" aria-label="Unidade" />
          {tipo === 'docente' && <Escolha valor={filtro.tipoDocente} aoMudar={mudarFiltro('tipoDocente')} opcoes={[['efectivo', 'Efectivos'], ['colaborador', 'Colaboradores'], ['sem', 'Tipo por indicar']]} vazio="Efectivos e colaboradores" aria-label="Tipo de docente" />}
          {tipo === 'docente' && <Escolha valor={filtro.categoriaDocente} aoMudar={mudarFiltro('categoriaDocente')} opcoes={[...new Set(todos.map((p) => p.categoriaDocente).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt'))} vazio="Qualquer categoria" aria-label="Categoria do docente" />}
          <Escolha valor={filtro.genero} aoMudar={mudarFiltro('genero')} opcoes={[['M', 'Masculino'], ['F', 'Feminino']]} vazio="Ambos os géneros" aria-label="Género" />
          {ligado && <Escolha valor={filtro.portal} aoMudar={mudarFiltro('portal')} opcoes={ESTADOS_PORTAL} vazio="Qualquer estado no portal" aria-label="Estado no portal" />}
          {comFiltro && <button type="button" className="btn btn-sm btn-link text-decoration-none" onClick={() => setFiltro(SEM_FILTRO)}><i className="fa fa-times me-1" />Limpar filtros</button>}
          <button type="button" className="btn btn-sm btn-outline-secondary ms-auto" disabled={!lista.length} onClick={() => quadroPorPosto('pdf')}><i className="fa fa-table me-1" />Quadro por posto</button>
          <button type="button" className="btn btn-sm btn-outline-secondary" disabled={!lista.length} onClick={() => quadroPorPosto('excel')} aria-label="Quadro por posto em Excel"><i className="fa fa-file-excel" /></button>
          {editar && ligado && (
            <button type="button" className="btn btn-sm btn-theme" disabled={!escolhidos.size || aImprimir} onClick={fichas}>
              <i className="fa fa-print me-1" />{aImprimir ? 'A pedir ao portal…' : `Fichas de acesso${escolhidos.size ? ` (${escolhidos.size})` : ''}`}
            </button>
          )}
        </div>
        <div className="pes-filtros-tabela">
          {erro ? <Erro texto={erro} aoRepetir={recarregar} /> : !dados ? <Carregando /> : (
            <Tabela titulo={t.titulo} ficheiro={ano && ano !== 'sem' ? `${t.titulo} ${ano.replace('/', '-')}` : t.titulo} classeLinha={(p) => (p.origem === 'estrangeiro' ? 'pes-linha-estrangeiro' : '')} colunas={colunas} linhas={lista} pesquisarEm={pesquisarEm} dica="Pesquisar: nome, NIP, BI, telefone, posto, unidade…" aoClicar={(p) => navegar(`/pessoas/${p.id}`)} vazio={comFiltro ? 'Ninguém corresponde aos filtros.' : `Ainda não há ${t.titulo.toLowerCase()} registados.`} />
          )}
        </div>
      </Painel>
      {novo && <RegistoRapido tipo={tipo} aoFechar={() => setNovo(false)} aoGuardar={(p) => { setNovo(false); avisar(textoDespacho(p) ? `${p.nome}: ${textoDespacho(p)}` : `${p.nome} está na lista dos ${t.titulo.toLowerCase()}. ${ligado ? 'A conta do portal cria-se dentro de momentos; depois imprima a ficha de acesso.' : ''}`); recarregar() }} />}
    </>
  )
}

// registo: o essencial, com o BI a vir da base de dados do Estado (o resto da ficha preenche-se depois, se for preciso)
const VAZIO = { tipo: 'militar', bi: '', nome: '', dataNascimento: '', genero: '', estadoCivil: '', nacionalidade: 'Angolana', naturalidade: '', provincia: '', paisNascimento: 'Angola', pai: '', mae: '', email: '', emailPessoal: '', telefone: '', telefoneAlternativo: '', morada: '', biEmitidoEm: '', biValidade: '', biLocalEmissao: '', grupoSanguineo: '', dataIngresso: '', categoriaDocente: '', ramo: 'EXE', posto: '', fps: 'QP', nip: '', nomeGuerra: '', especialidade: '', unidadeOrigem: '', postoExterno: '', numeroAgente: '', habilitacao: '', areaFormacao: '', funcaoActual: '' }
const BI_VALIDO = /^[0-9]{9}[A-Z]{2}[0-9]{3}$/
// o ano lectivo de agora (começa em Setembro) e o registo desse ano na ficha (o curso ou a cadeira)
const anoDeAgora = () => { const d = new Date(); const a = d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1; return `${a}/${a + 1}` }
const registarAno = (id, papel, { anoLetivo, curso }, tipoDocente) => (anoLetivo ? api(`/pessoas/${id}/anos-academicos`, { metodo: 'POST', corpo: { anoLetivo, papel, curso: curso || '', ...(tipoDocente ? { tipoDocente } : {}) } }) : Promise.resolve())
function CamposAno({ papel, valor, aoMudar }) {
  return (
    <div className="row gx-3">
      <Campo rotulo="Ano lectivo" col="col-md-4" ajuda="Fica na lista desse ano."><input className="form-control form-control-sm" value={valor.anoLetivo} onChange={(e) => aoMudar({ ...valor, anoLetivo: e.target.value })} placeholder="2026/2027" pattern="\d{4}/\d{4}" /></Campo>
      <Campo rotulo={papel === 'estudante' ? 'Curso' : 'Cadeira(s)'} col="col-md-8"><input className="form-control form-control-sm" value={valor.curso} onChange={(e) => aoMudar({ ...valor, curso: e.target.value })} placeholder={papel === 'estudante' ? 'ex.: 32.º Curso Superior de Comando e Direcção' : 'ex.: Táctica Geral'} /></Campo>
    </div>
  )
}
const Seccao = ({ icone, children }) => <h6 className="pes-registo-seccao"><i className={`fa ${icone} me-2`} />{children}</h6>

/*
  Docente efectivo: já serve na Escola e já tem ficha (militar ou civil). Não se regista outra vez:
  escolhe-se da lista do pessoal e passa a ser também docente (com a categoria e a função).
*/
function EscolherEfectivo({ aoGuardar }) {
  const { ref } = useSessao()
  const { dados } = useDados('/pessoas', {})
  const [q, setQ] = useState('')
  const [p, setP] = useState(null)
  const [d, setD] = useState({ categoriaDocente: '', funcaoActual: '', email: '' })
  const [anoD, setAnoD] = useState({ anoLetivo: anoDeAgora(), curso: '' })
  const [erro, setErro] = useState('')
  const set = (k) => (v) => setD((x) => ({ ...x, [k]: v?.target ? v.target.value : v }))
  const docente = (x) => x.vinculo === 'docente' || (x.outrosVinculos ?? []).includes('docente')
  const termo = q.trim().toLowerCase()
  const lista = (dados ?? []).filter((x) => !docente(x) && x.vinculo !== 'domiciliar')
    .filter((x) => !termo || [x.nome, x.nomeGuerra, x.nip, x.numeroAgente, x.postoNome, x.unidadeNome].filter(Boolean).join(' ').toLowerCase().includes(termo))
  const escolher = (x) => { setP(x); setD({ categoriaDocente: '', funcaoActual: x.cargoNome ?? '', email: x.email ?? '' }) }

  async function guardar(e) {
    e.preventDefault()
    if (!p) return setErro('Escolha a pessoa da lista.')
    setErro('')
    try {
      const r = await api(`/pessoas/${p.id}`, { metodo: 'PUT', corpo: { outrosVinculos: [...(p.outrosVinculos ?? []), 'docente'], tipoDocente: 'efectivo', categoriaDocente: d.categoriaDocente, funcaoActual: d.funcaoActual, ...(d.email && !p.email ? { email: d.email } : {}) } })
      await registarAno(p.id, 'docente', anoD, 'efectivo')
      aoGuardar(r)
    } catch (falha) {
      setErro(falha.message)
    }
  }

  return (
    <form id="registo-rapido" onSubmit={guardar} className="pes-registo">
      {erro && <div className="alert alert-danger py-2">{erro}</div>}
      {!p ? <>
        <input className="form-control mb-2" autoFocus placeholder="Procurar por nome, NIP, n.º de agente, posto ou unidade…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Procurar no pessoal da Escola" />
        {!dados ? <Carregando /> : (
          <div className="list-group pes-escolher-efectivo">
            {lista.slice(0, 30).map((x) => (
              <button key={x.id} type="button" className="list-group-item list-group-item-action d-flex align-items-center gap-2" onClick={() => escolher(x)}>
                <Foto pessoaId={x.id} fotoId={x.fotoId} nome={x.nome} />
                <span className="flex-grow-1 text-truncate"><strong>{x.postoAbreviatura ? `${x.postoAbreviatura} ` : ''}{x.nome}</strong><div className="small text-muted text-truncate">{[x.nip ? `NIP ${x.nip}` : x.numeroAgente && `Agente ${x.numeroAgente}`, x.cargoNome, x.unidadeNome].filter(Boolean).join(' · ')}</div></span>
                <i className="fa fa-chevron-right text-muted" />
              </button>
            ))}
            {!lista.length && <div className="text-muted small p-2">Ninguém encontrado. Se ainda não tem ficha na Escola, registe-o primeiro em Pessoal, ou é colaborador.</div>}
            {lista.length > 30 && <div className="text-muted small p-2">Mais {lista.length - 30}: escreva mais para encontrar.</div>}
          </div>
        )}
      </> : <>
        <div className="d-flex align-items-center gap-3 p-2 mb-3 border rounded">
          <Foto pessoaId={p.id} fotoId={p.fotoId} nome={p.nome} />
          <div className="flex-grow-1"><strong>{p.postoNome ? `${p.postoNome} ` : ''}{p.nome}</strong><div className="small text-muted">{[p.nip ? `NIP ${p.nip}` : p.numeroAgente && `Agente ${p.numeroAgente}`, p.unidadeNome].filter(Boolean).join(' · ')}</div></div>
          <button type="button" className="btn btn-sm btn-white" onClick={() => setP(null)}>Mudar</button>
        </div>
        <div className="row gx-3">
          <Campo rotulo="Categoria do docente" col="col-md-6" ajuda="Decreto Presidencial n.º 191/18."><EscolhaCategoriaDocente valor={d.categoriaDocente} aoMudar={set('categoriaDocente')} referencias={ref} /></Campo>
          <Campo rotulo="Função ou cargo actual" col="col-md-6"><input className="form-control form-control-sm" value={d.funcaoActual} onChange={set('funcaoActual')} /></Campo>
          {!p.email && <Campo rotulo="E-mail da Escola" col="col-md-12" ajuda="Ainda não tem: com e-mail, o portal cria a conta sozinho."><input type="email" className="form-control form-control-sm" placeholder="nome.apelido@esgfaa.gov.ao" value={d.email} onChange={set('email')} /></Campo>}
        </div>
        <CamposAno papel="docente" valor={anoD} aoMudar={setAnoD} />
        <div className="small text-muted">Os dados pessoais e militares já estão na ficha: não se escrevem outra vez.</div>
      </>}
    </form>
  )
}

function RegistoRapido({ tipo, aoFechar, aoGuardar }) {
  const { ref } = useSessao()
  // o docente efectivo já é da Escola (escolhe-se); o colaborador vem de fora (regista-se)
  const [efectivo, setEfectivo] = useState(tipo === 'docente')
  const [d, setD] = useState({ ...VAZIO, tipoDocente: tipo === 'docente' ? 'colaborador' : '' })
  const [anoD, setAnoD] = useState({ anoLetivo: anoDeAgora(), curso: '' })
  const [erro, setErro] = useState('')
  const [aGravar, setAGravar] = useState(false)
  const { avisar } = useSessao()
  // fotografia tipo passe: escolhida aqui e enviada logo a seguir ao registo
  const [foto, setFoto] = useState(null)
  const previa = useMemo(() => (foto ? URL.createObjectURL(foto) : null), [foto])
  useEffect(() => () => { if (previa) URL.revokeObjectURL(previa) }, [previa])
  const [bi, setBi] = useState({ estado: '', texto: '', visto: '' }) // estado: '' | 'a consultar' | 'ok' | 'erro'
  // de onde vem: FAA (militar, com o ramo e o órgão), Polícia Nacional, estrangeiro (país, força, posto) ou civil
  const [prov, setProv] = useState('faa')
  const militar = prov === 'faa'
  const postos = ref.postos[d.ramo] ?? []
  const paises = ref.paises ?? {}
  const forcas = paises[d.paisNascimento]?.forcas ?? []
  const forca = forcas.find((f) => f.nome === d.unidadeOrigem)
  const escolherProv = (k) => {
    setProv(k)
    setD((x) => ({
      ...x, tipo: k === 'faa' ? 'militar' : 'civil', postoExterno: '',
      unidadeOrigem: k === 'policia' ? (ref.policiaNacional ?? 'Polícia Nacional') : '',
      ...(k === 'estrangeiro' ? { paisNascimento: '', nacionalidade: '' } : { paisNascimento: 'Angola', nacionalidade: 'Angolana' }),
    }))
  }
  const escolherPais = (pais) => setD((x) => ({ ...x, paisNascimento: pais, nacionalidade: paises[pais]?.nacionalidade ?? x.nacionalidade, unidadeOrigem: '', postoExterno: '' }))
  const set = (k) => (v) => setD((x) => ({ ...x, [k]: v?.target ? v.target.value : v }))
  const campo = (k, extra = {}) => ({ value: d[k] ?? '', onChange: set(k), className: 'form-control form-control-sm', ...extra })

  // ao escrever um BI completo (ou ao clicar em «Consultar»), os dados vêm da base de dados do Estado
  async function consultarBi(numero = d.bi, automatico = false) {
    const n = String(numero ?? '').trim().toUpperCase().replace(/\s/g, '')
    if (automatico && (!BI_VALIDO.test(n) || n === bi.visto)) return
    setBi({ estado: 'a consultar', texto: '', visto: n })
    try {
      const r = await api(`/bi/${encodeURIComponent(n)}`)
      setD((x) => ({ ...x, bi: n, ...Object.fromEntries(Object.entries(r).filter(([k, v]) => v && k in VAZIO)) }))
      setBi({ estado: 'ok', texto: 'Dados do BI preenchidos a partir da base de dados do Estado. Confirme-os.', visto: n })
    } catch (falha) {
      setBi({ estado: 'erro', texto: falha.message, visto: n })
    }
  }

  async function guardar(e) {
    e.preventDefault()
    setErro('')
    setAGravar(true)
    const comuns = ['bi', 'nome', 'dataNascimento', 'genero', 'estadoCivil', 'nacionalidade', 'paisNascimento', 'naturalidade', 'provincia', 'pai', 'mae', 'telefone', 'telefoneAlternativo', 'emailPessoal', 'morada', 'unidadeOrigem', 'postoExterno', 'habilitacao', 'areaFormacao', 'biLocalEmissao', 'biEmitidoEm', 'biValidade', 'grupoSanguineo']
    const corpo = {
      tipo: d.tipo, vinculo: tipo, email: d.email || null,
      ...(!militar && d.numeroAgente ? { numeroAgente: d.numeroAgente } : {}),
      ...Object.fromEntries(comuns.map((k) => [k, d[k] ?? ''])),
      ...(militar ? { ramo: d.ramo, posto: d.posto, fps: d.fps, nip: d.nip, nomeGuerra: d.nomeGuerra, especialidade: d.especialidade, dataIngresso: d.dataIngresso } : {}),
      ...(tipo === 'docente' ? { tipoDocente: d.tipoDocente, categoriaDocente: d.categoriaDocente, funcaoActual: d.funcaoActual } : {}),
    }
    try {
      const r = await api('/pessoas', { metodo: 'POST', corpo })
      await registarAno(r.id, tipo, anoD, tipo === 'docente' ? d.tipoDocente : null).catch((x) => avisar(`Registado, mas sem o ano lectivo: ${x.message}`, 'erro'))
      if (foto) {
        const fd = new FormData()
        fd.append('foto', await reduzirFoto(foto))
        await api(`/pessoas/${r.id}/foto`, { metodo: 'PUT', formulario: fd }).catch((x) => avisar(`Registado, mas a fotografia não: ${x.message}`, 'erro'))
      }
      aoGuardar(r)
    } catch (falha) {
      setErro(falha.message)
    } finally {
      setAGravar(false)
    }
  }

  return (
    <Modal titulo={`Registar ${tipo === 'docente' ? 'docente' : 'estudante'}`} aoFechar={aoFechar} largo
      rodape={<><button type="button" className="btn btn-white" onClick={aoFechar}>Cancelar</button><button type="submit" form="registo-rapido" className="btn btn-theme" disabled={aGravar}><i className={`fa ${efectivo ? 'fa-check' : 'fa-save'} me-1`} />{aGravar ? 'A registar…' : efectivo ? 'Juntar aos docentes' : 'Registar'}</button></>}>
      {tipo === 'docente' && (
        <div className="btn-group w-100 mb-3" role="group" aria-label="Efectivo ou colaborador">
          {[[true, 'Efectivo — já é da Escola', 'fa-school'], [false, 'Colaborador — vem de fora', 'fa-user-plus']].map(([k, r, i]) => (
            <button key={r} type="button" className={`btn ${efectivo === k ? 'btn-dark' : 'btn-white'}`} aria-pressed={efectivo === k} onClick={() => setEfectivo(k)}><i className={`fa ${i} me-1`} />{r}</button>
          ))}
        </div>
      )}
      {efectivo ? <EscolherEfectivo aoGuardar={aoGuardar} /> : <form id="registo-rapido" onSubmit={guardar} className="pes-registo">
        {erro && <div className="alert alert-danger py-2">{erro}</div>}
        <div className="btn-group w-100 mb-3 flex-wrap" role="group" aria-label="De onde vem">
          {[['faa', 'Militar das FAA', 'fa-shield-alt'], ['policia', 'Polícia Nacional', 'fa-user-shield'], ['estrangeiro', 'Estrangeiro', 'fa-globe-africa'], ['civil', 'Civil', 'fa-user-tie']].map(([k, r, i]) => (
            <button key={k} type="button" className={`btn ${prov === k ? 'btn-theme' : 'btn-white'}`} aria-pressed={prov === k} onClick={() => escolherProv(k)}><i className={`fa ${i} me-1`} />{r}</button>
          ))}
        </div>

        <Seccao icone="fa-id-card">Identificação</Seccao>
        <div className="row gx-3">
          <div className="col-md-3 mb-3 text-center">
            <div className="pes-ficha-foto mb-2">{previa ? <img src={previa} alt="Fotografia" /> : <i className="fa fa-user fa-4x text-muted" />}</div>
            <Carregar aceitar="image/jpeg,image/png,image/webp" maxMb={30} compacto icone="fa-camera" titulo={previa ? 'Mudar fotografia' : 'Fotografia'} ajuda="JPG, PNG ou WEBP · tipo passe" ficheiros={foto ? [foto] : []} aoMudar={(l) => setFoto(l[0] ?? null)} />
          </div>
          <div className="col-md-9">
            <div className="row gx-3">
              <Campo rotulo="Bilhete de identidade" col="col-md-12" ajuda="Com o BI, os dados vêm da base de dados do Estado.">
                <div className="input-group input-group-sm">
                  <input {...campo('bi', { onChange: (e) => { const v = e.target.value.toUpperCase(); set('bi')(v); consultarBi(v, true) }, placeholder: '001234567LA041', maxLength: 20 })} aria-label="Bilhete de identidade" />
                  <button type="button" className="btn btn-outline-theme" disabled={bi.estado === 'a consultar' || !d.bi} onClick={() => consultarBi()}><i className={`fa ${bi.estado === 'a consultar' ? 'fa-spinner fa-spin' : 'fa-search'} me-1`} />Consultar</button>
                </div>
                {bi.texto && <div className={`small mt-1 ${bi.estado === 'ok' ? 'text-success' : 'text-danger'}`}><i className={`fa ${bi.estado === 'ok' ? 'fa-check-circle' : 'fa-exclamation-circle'} me-1`} />{bi.texto}</div>}
              </Campo>
              <Campo rotulo="Nome completo" obrigatorio col="col-md-12"><input {...campo('nome')} required minLength={5} /></Campo>
              <Campo rotulo="Data de nascimento" col="col-md-4"><InputData {...campo('dataNascimento')} /></Campo>
              <Campo rotulo="Género" col="col-md-4"><Escolha valor={d.genero} aoMudar={set('genero')} opcoes={ref.generos} /></Campo>
              <Campo rotulo="Estado civil" col="col-md-4"><Escolha valor={d.estadoCivil} aoMudar={set('estadoCivil')} opcoes={ref.estadosCivis} /></Campo>
            </div>
          </div>
        </div>
        <div className="row gx-3">
          <Campo rotulo="Data de emissão do BI" col="col-md-4"><InputData {...campo('biEmitidoEm')} /></Campo>
          <Campo rotulo="Validade do BI" col="col-md-4"><InputData {...campo('biValidade')} /></Campo>
          <Campo rotulo="Local de emissão do BI" col="col-md-4"><input {...campo('biLocalEmissao', { placeholder: 'ex.: Luanda' })} /></Campo>
          <Campo rotulo="País de nascimento" col="col-md-3"><input {...campo('paisNascimento')} /></Campo>
          <Campo rotulo="Província" col="col-md-3"><Escolha valor={d.provincia} aoMudar={set('provincia')} opcoes={ref.provincias} /></Campo>
          <Campo rotulo="Município" col="col-md-3"><input {...campo('naturalidade')} /></Campo>
          <Campo rotulo="Nacionalidade" col="col-md-3"><input {...campo('nacionalidade')} /></Campo>
          <Campo rotulo="Grupo sanguíneo" col="col-md-3"><Escolha valor={d.grupoSanguineo} aoMudar={set('grupoSanguineo')} opcoes={['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-']} /></Campo>
          <Campo rotulo="Habilitações literárias" col="col-md-3"><Escolha valor={d.habilitacao} aoMudar={set('habilitacao')} opcoes={ref.habilitacoes} /></Campo>
          <Campo rotulo="Área de formação" col="col-md-6"><input {...campo('areaFormacao', { placeholder: 'ex.: Ciências Militares, Engenharia Informática…' })} /></Campo>
          <Campo rotulo="Nome do pai" col="col-md-6"><input {...campo('pai')} /></Campo>
          <Campo rotulo="Nome da mãe" col="col-md-6"><input {...campo('mae')} /></Campo>
        </div>

        {militar && <>
          <Seccao icone="fa-shield-alt">Dados militares</Seccao>
          <div className="row gx-3">
            <Campo rotulo="Ramo" obrigatorio col="col-md-4"><Escolha valor={d.ramo} aoMudar={(v) => setD({ ...d, ramo: v, posto: '' })} opcoes={Object.fromEntries(Object.entries(ref.ramos).map(([k, v]) => [k, v.nome]))} vazio={null} aria-label="Ramo" /></Campo>
            <Campo rotulo="Posto" obrigatorio col="col-md-4"><Escolha valor={d.posto} aoMudar={set('posto')} opcoes={postos.map((p) => [p.id, `${p.nome} — ${ref.categorias[p.categoria].nome}`])} required aria-label="Posto" /></Campo>
            <Campo rotulo="Forma de prestação de serviço" obrigatorio col="col-md-4"><Escolha valor={d.fps} aoMudar={set('fps')} opcoes={ref.formasServico} vazio={null} /></Campo>
            <Campo rotulo="NIP" obrigatorio col="col-md-4"><input {...campo('nip')} required /></Campo>
            <Campo rotulo="Nome de guerra" col="col-md-4"><input {...campo('nomeGuerra')} /></Campo>
            <Campo rotulo="Especialidade" col="col-md-4"><input {...campo('especialidade')} /></Campo>
            <Campo rotulo="Data de incorporação" col="col-md-4"><InputData {...campo('dataIngresso')} /></Campo>
            <Campo rotulo="Órgão de origem (fora da ESG)" col="col-md-8" ajuda="Escolha o órgão das FAA (Estado-Maior General, ramo, Casa Militar, USP…) ou escreva a unidade (ex.: Regimento de Infantaria n.º 10). Se é da ESG, ponha a unidade depois, na ficha.">
              <input {...campo('unidadeOrigem', { list: 'orgaos-faa', placeholder: 'ex.: Estado-Maior General das FAA' })} />
              <datalist id="orgaos-faa">{(ref.orgaosFaa ?? []).map((o) => <option key={o.nome} value={o.nome}>{o.sigla}</option>)}</datalist>
            </Campo>
          </div>
        </>}

        {prov === 'policia' && <>
          <Seccao icone="fa-user-shield">Polícia Nacional</Seccao>
          <div className="row gx-3">
            <Campo rotulo="Posto" obrigatorio col="col-md-6" ajuda="Decreto n.º 117/08 e Lei n.º 10/22 (postos da Polícia Nacional).">
              <select className="form-select form-select-sm" value={d.postoExterno} onChange={set('postoExterno')} required aria-label="Posto na Polícia Nacional">
                <option value="">—</option>
                {[...new Set((ref.postosPolicia ?? []).map((x) => x.classe))].map((c) => <optgroup key={c} label={c}>{ref.postosPolicia.filter((x) => x.classe === c).map((x) => <option key={x.nome} value={x.nome}>{x.nome}</option>)}</optgroup>)}
              </select>
            </Campo>
            <Campo rotulo="N.º na Polícia" col="col-md-6"><input {...campo('numeroAgente', { placeholder: 'ex.: I045669' })} /></Campo>
          </div>
        </>}

        {prov === 'estrangeiro' && <>
          <Seccao icone="fa-globe-africa">Estrangeiro: país, força e posto</Seccao>
          <div className="row gx-3">
            <Campo rotulo="País" obrigatorio col="col-md-4">
              <input {...campo('paisNascimento', { list: 'paises-esg', required: true, onChange: (e) => escolherPais(e.target.value) })} />
              <datalist id="paises-esg">{Object.keys(paises).map((x) => <option key={x} value={x} />)}</datalist>
            </Campo>
            <Campo rotulo="Nacionalidade" col="col-md-4"><input {...campo('nacionalidade')} /></Campo>
            <Campo rotulo="N.º na força (se tiver)" col="col-md-4"><input {...campo('numeroAgente')} /></Campo>
            <Campo rotulo="Forças armadas ou polícia" obrigatorio col="col-md-6">
              {forcas.length ? (
                <select className="form-select form-select-sm" value={d.unidadeOrigem} onChange={(e) => setD((x) => ({ ...x, unidadeOrigem: e.target.value, postoExterno: '' }))} required aria-label="Força">
                  <option value="">—</option>
                  {forcas.map((f) => <option key={f.nome} value={f.nome}>{f.nome}</option>)}
                </select>
              ) : <input {...campo('unidadeOrigem', { required: true, placeholder: 'ex.: Forças Armadas da Namíbia' })} />}
            </Campo>
            <Campo rotulo="Posto (como se escreve no país)" obrigatorio col="col-md-6">
              {forca?.postos ? (
                <select className="form-select form-select-sm" value={d.postoExterno} onChange={set('postoExterno')} required aria-label="Posto">
                  <option value="">—</option>
                  {forca.postos.map((x) => <option key={x.nome} value={x.nome}>{x.nome}</option>)}
                </select>
              ) : <input {...campo('postoExterno', { required: true })} />}
            </Campo>
          </div>
        </>}

        {prov === 'civil' && <>
          <Seccao icone="fa-building">Órgão de origem</Seccao>
          <div className="row gx-3">
            <Campo rotulo="Onde trabalha (fora da ESG)" col="col-md-12" ajuda="ex.: Ministério da Defesa Nacional e dos Veteranos da Pátria, uma universidade…"><input {...campo('unidadeOrigem', { list: 'orgaos-faa' })} /><datalist id="orgaos-faa">{(ref.orgaosFaa ?? []).map((o) => <option key={o.nome} value={o.nome} />)}</datalist></Campo>
          </div>
        </>}

        {tipo === 'docente' && <>
          <Seccao icone="fa-chalkboard-teacher">Docência</Seccao>
          <div className="row gx-3">
            <Campo rotulo="Categoria do docente" col="col-md-6" ajuda="Decreto Presidencial n.º 191/18."><EscolhaCategoriaDocente valor={d.categoriaDocente} aoMudar={set('categoriaDocente')} referencias={ref} /></Campo>
            <Campo rotulo="Função ou cargo actual" col="col-md-6" ajuda="O colaborador serve fora da Escola: onde e em que função."><input {...campo('funcaoActual')} /></Campo>
          </div>
        </>}

        <Seccao icone="fa-calendar-alt">Ano lectivo</Seccao>
        <CamposAno papel={tipo} valor={anoD} aoMudar={setAnoD} />

        <Seccao icone="fa-address-book">Contactos</Seccao>
        <div className="row gx-3">
          <Campo rotulo="E-mail da Escola" col="col-md-6" ajuda="Com e-mail, o portal cria a conta sozinho (depois imprime-se a ficha de acesso)."><input {...campo('email', { type: 'email', placeholder: 'nome.apelido@esgfaa.gov.ao' })} /></Campo>
          <Campo rotulo="E-mail pessoal" col="col-md-6"><input {...campo('emailPessoal', { type: 'email' })} /></Campo>
          <Campo rotulo="Telefone principal" col="col-md-6"><input {...campo('telefone', { type: 'tel', placeholder: '9XX XXX XXX' })} /></Campo>
          <Campo rotulo="Telefone alternativo" col="col-md-6"><input {...campo('telefoneAlternativo', { type: 'tel', placeholder: '9XX XXX XXX' })} /></Campo>
          <Campo rotulo="Residência (morada)" col="col-md-12"><input {...campo('morada')} /></Campo>
        </div>
        <div className="small text-muted mt-2">O resto da ficha (documentos, família, carreira…) preenche-se depois no perfil, em <Link to="/pessoas">Pessoal</Link>.</div>
      </form>}
    </Modal>
  )
}
