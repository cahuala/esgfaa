import { useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useDados } from '../useDados'
import { useSessao } from '../sessao'
import Tabela from '../componentes/Tabela'
import { Cabecalho, Carregando, Erro, Escolha, Painel } from '../componentes/Ui'
import { anos, dataPt } from '../formatar'

// nomes dos filtros (para os mostrar e para o título do PDF)
const NOMES_FILTRO = { tipo: 'Tipo', vinculo: 'Vínculo', ramo: 'Ramo', grupo: 'Categoria', categoria: 'Escalão', posto: 'Posto', fps: 'Forma de serviço', situacao: 'Situação', efectividade: 'Efectividade', genero: 'Género', provincia: 'Província', habilitacao: 'Habilitação', unidadeId: 'Unidade', cargoId: 'Cargo', carreiraCivil: 'Carreira civil', quadroEspecial: 'Quadro especial', idade: 'Idade', elegivel: 'Em condições de promoção', graduado: 'Graduados', reservaAte: 'Reserva até', semCargo: 'Sem cargo', ativo: 'Na Escola', estadoCivil: 'Estado civil' }

export default function Pessoas() {
  const { ref, pode } = useSessao()
  const navegar = useNavigate()
  const [params, setParams] = useSearchParams()
  const filtros = useMemo(() => Object.fromEntries(params), [params])
  const { dados: linhas, erro } = useDados('/pessoas', filtros)
  const unidades = useDados('/unidades').dados ?? []

  const mudar = (k, v) => {
    const n = new URLSearchParams(params)
    if (v) n.set(k, v)
    else n.delete(k)
    setParams(n)
  }
  const ramo = filtros.ramo || 'EXE'
  const valorFiltro = (k, v) => ({
    tipo: ref.tipos[v], vinculo: ref.vinculos[v], ramo: ref.ramos[v]?.nome, grupo: ref.grupos[v], categoria: ref.categorias[v]?.nome,
    posto: ref.postos[ramo].find((p) => p.id === v)?.nome, fps: ref.formasServico[v]?.nome, situacao: ref.situacoes[v], efectividade: ref.efectividades[v]?.nome,
    genero: ref.generos[v], habilitacao: ref.habilitacoes[v], unidadeId: v === 'nenhum' ? 'Sem unidade' : unidades.find((u) => String(u.id) === v)?.nome, carreiraCivil: ref.carreirasCivis[v]?.nome,
    quadroEspecial: ref.quadros[ramo].find((q) => q.sigla === v)?.nome, idade: v.replace('-200', ' ou mais').replace('-', ' a '), elegivel: 'sim', graduado: 'sim', semCargo: 'sim', ativo: v === 'nao' ? 'Já saíram' : 'Todos',
  }[k] ?? v)
  const descricao = Object.entries(filtros).map(([k, v]) => `${NOMES_FILTRO[k] ?? k}: ${valorFiltro(k, v)}`).join(' · ')

  const colunas = useMemo(() => [
    { chave: 'ident', titulo: 'NIP / N.º', valor: (p) => p.nip || p.numeroAgente || '' },
    { chave: 'nome', titulo: 'Nome', valor: (p) => p.nome, mostrar: (p) => <><strong>{p.nome}</strong>{p.nomeGuerra && <div className="small text-muted">«{p.nomeGuerra}»</div>}</> },
    { chave: 'posto', titulo: 'Posto / Categoria', valor: (p) => (p.tipo === 'militar' ? p.postoNome : p.categoriaCivil || 'Civil'), ordenarPor: (p) => 100 - (p.grau ?? 0), mostrar: (p) => (p.tipo === 'militar' ? <span title={p.categoriaNome}>{p.postoNome}{p.graduacoes?.length > 0 && <span className="badge bg-warning text-dark ms-1" title="Graduado">grad.</span>}</span> : <span className="text-muted">{p.categoriaCivil || 'Civil'}</span>) },
    { chave: 'ramo', titulo: 'Ramo', valor: (p) => p.ramo || (p.tipo === 'civil' ? 'Civil' : ''), mostrar: (p) => (p.ramo ? <span className={`badge pes-ramo-${p.ramo}`}>{p.ramo}</span> : <span className="badge bg-secondary">Civil</span>) },
    { chave: 'fps', titulo: 'Serviço', valor: (p) => p.fps || p.vinculoCivilNome || '' },
    { chave: 'unidade', titulo: 'Unidade', valor: (p) => p.unidadeNome },
    { chave: 'cargo', titulo: 'Cargo', valor: (p) => p.cargoNome },
    { chave: 'vinculo', titulo: 'Vínculo', valor: (p) => p.vinculoNome },
    { chave: 'idade', titulo: 'Idade', valor: (p) => p.idade, alinhar: 'end' },
    { chave: 'tempoPosto', titulo: 'No posto', valor: (p) => p.tempoNoPosto ?? p.tempoNaCategoria, mostrar: (p) => anos(p.tempoNoPosto ?? p.tempoNaCategoria), alinhar: 'end' },
    { chave: 'reserva', titulo: 'Reserva', valor: (p) => p.dataReserva || '', mostrar: (p) => (p.dataReserva ? dataPt(p.dataReserva) : '—') },
    { chave: 'elegivel', titulo: 'Promoção', valor: (p) => (p.elegivelPromocao ? 'Em condições' : ''), mostrar: (p) => (p.elegivelPromocao ? <span className="badge bg-success"><i className="fa fa-medal me-1" />{p.proximoPostoNome || p.proximaCategoria}</span> : '') },
  ], [])

  const f = (k, opcoes, vazio = 'Todos') => (
    <div className="col-6 col-md-3 col-xl-2 mb-2">
      <label className="form-label small mb-0 text-muted">{NOMES_FILTRO[k]}</label>
      <Escolha valor={filtros[k]} aoMudar={(v) => mudar(k, v)} opcoes={opcoes} vazio={vazio} aria-label={NOMES_FILTRO[k]} />
    </div>
  )

  return (
    <>
      <Cabecalho titulo="Pessoal" subtitulo="fichas de militares e civis" migalhas={[['Pessoal']]}>
        {pode('editar') && <Link to="/pessoas/nova" className="btn btn-theme"><i className="fa fa-user-plus me-2" />Nova ficha</Link>}
      </Cabecalho>
      <Painel titulo="Filtros" icone="fa-filter" acoes={Object.keys(filtros).length > 0 && <button type="button" className="btn btn-xs btn-light" onClick={() => setParams({})}>Limpar filtros</button>}>
        <div className="row">
          {f('tipo', ref.tipos)}
          {f('vinculo', ref.vinculos)}
          {f('ramo', Object.fromEntries(Object.entries(ref.ramos).map(([k, v]) => [k, v.nome])))}
          {f('grupo', ref.grupos)}
          {f('posto', ref.postos[ramo].map((p) => [p.id, p.nome]))}
          {f('fps', ref.formasServico)}
          {f('situacao', ref.situacoes)}
          {f('unidadeId', [['nenhum', 'Sem unidade'], ...unidades.map((u) => [String(u.id), u.nome])], 'Todas')}
          {f('genero', ref.generos)}
          {f('habilitacao', ref.habilitacoes, 'Todas')}
          {f('carreiraCivil', Object.fromEntries(Object.entries(ref.carreirasCivis).map(([k, v]) => [k, v.nome])), 'Todas')}
          {f('ativo', [['', 'Na Escola'], ['nao', 'Já saíram'], ['todos', 'Todos']], null)}
        </div>
        {descricao && <div className="small mt-1"><i className="fa fa-filter text-muted me-1" />{Object.entries(filtros).map(([k, v]) => (
          <span key={k} className="badge bg-light text-dark border me-1 mb-1">{NOMES_FILTRO[k] ?? k}: {valorFiltro(k, v)} <button type="button" className="btn-close btn-close-sm ms-1" style={{ fontSize: 8 }} onClick={() => mudar(k, '')} aria-label={`Retirar ${NOMES_FILTRO[k]}`} /></span>
        ))}</div>}
      </Painel>
      {erro && <Erro texto={erro} />}
      <Painel corpo={false}>
        <div className="panel-body">
          {!linhas ? <Carregando /> : (
            <Tabela titulo={filtros.tipo === 'civil' ? 'Pessoal civil' : filtros.tipo === 'militar' ? 'Pessoal militar' : 'Pessoal da Escola'} subtitulo={descricao} colunas={colunas} linhas={linhas} aoClicar={(p) => navegar(`/pessoas/${p.id}`)} ordemInicial={{ chave: 'posto', dir: 1 }} />
          )}
        </div>
      </Painel>
    </>
  )
}
