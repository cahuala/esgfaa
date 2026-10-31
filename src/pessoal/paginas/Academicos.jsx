import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useDados } from '../useDados'
import { useSessao } from '../sessao'
import Foto from '../componentes/Foto'
import Tabela from '../componentes/Tabela'
import { Cabecalho, Campo, Carregando, Erro, Escolha, Modal, Painel } from '../componentes/Ui'
import { imprimirFichas } from '../../admin/paginas/pessoal/fichasAcesso'

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
  if (e.conta.ativo === false) return <span className="badge bg-secondary">Conta desativada</span>
  if (!e.conta.ultimoAcesso) return <span className="badge bg-warning text-dark" title="Entregue a ficha de acesso">Nunca entrou</span>
  if (e.conta.deveMudarSenha) return <span className="badge bg-info">Palavra-passe inicial</span>
  return <span className="badge bg-success">Ativa</span>
}

// o mesmo estado, em texto (para o filtro, a pesquisa e a exportação)
const ESTADOS_PORTAL = [['sem', 'Sem conta'], ['erro', 'Erro no envio'], ['nunca', 'Nunca entrou'], ['inicial', 'Palavra-passe inicial'], ['ativa', 'Ativa'], ['desativada', 'Conta desativada']]
function estadoPortal(e) {
  if (!e) return 'sem'
  if (e.envio === 'erro') return 'erro'
  if (!e.conta) return 'sem'
  if (e.conta.ativo === false) return 'desativada'
  if (!e.conta.ultimoAcesso) return 'nunca'
  return e.conta.deveMudarSenha ? 'inicial' : 'ativa'
}
const nomeEstado = Object.fromEntries(ESTADOS_PORTAL)

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
  const { dados, erro, recarregar } = useDados('/academicos', { tipo, ativo }, { tempoReal: true })
  const [escolhidos, setEscolhidos] = useState(() => new Set())
  const [novo, setNovo] = useState(false)
  const [aImprimir, setAImprimir] = useState(false)
  const [filtro, setFiltro] = useState({ ramo: '', origem: '', portal: '' })
  const ligado = Boolean(dados?.portalLigado)
  const todos = useMemo(() => dados?.pessoas ?? [], [dados])
  const lista = useMemo(() => todos.filter((p) => (!filtro.ramo || (filtro.ramo === 'civil' ? p.tipo === 'civil' : p.ramo === filtro.ramo))
    && (!filtro.origem || (filtro.origem === 'fora' ? Boolean(p.unidadeOrigem) && !p.unidadeNome : !p.unidadeOrigem || Boolean(p.unidadeNome)))
    && (!filtro.portal || estadoPortal(p.portal) === filtro.portal)), [todos, filtro])
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
    { chave: 'posto', titulo: 'Posto', valor: (p) => (p.tipo === 'militar' ? p.postoNome : 'Civil') },
    { chave: 'ramo', titulo: 'Ramo', valor: (p) => p.ramo || 'Civil', mostrar: (p) => (p.ramo ? <span className={`badge pes-ramo-${p.ramo}`}>{p.ramo}</span> : <span className="badge bg-secondary">Civil</span>) },
    { chave: 'ident', titulo: 'NIP / N.º', valor: (p) => p.nip || p.numeroAgente || '' },
    { chave: 'unidade', titulo: 'Unidade', valor: (p) => p.unidadeNome || p.unidadeOrigem || '', mostrar: (p) => (p.unidadeNome || (p.unidadeOrigem ? <span>{p.unidadeOrigem} <span className="badge bg-light text-dark border">de fora</span></span> : <span className="text-muted">—</span>)) },
    ...(tipo === 'docente' ? [{ chave: 'tipoDocente', titulo: 'Tipo', valor: (p) => (p.tipoDocente === 'colaborador' ? 'Colaborador' : p.tipoDocente === 'efectivo' ? 'Efectivo' : '') }] : []),
    { chave: 'conta', titulo: 'N.º no portal', valor: (p) => p.portal?.conta?.numero || '' },
    { chave: 'telefone', titulo: 'Telefone', valor: (p) => p.telefone || '', oculta: true },
    { chave: 'bi', titulo: 'BI', valor: (p) => p.bi || '', oculta: true },
    { chave: 'genero', titulo: 'Género', valor: (p) => (p.genero === 'F' ? 'Feminino' : p.genero === 'M' ? 'Masculino' : ''), oculta: true },
    { chave: 'idade', titulo: 'Idade', valor: (p) => p.idade ?? '', alinhar: 'end', oculta: true },
    { chave: 'habilitacao', titulo: 'Habilitações', valor: (p) => ref.habilitacoes?.[p.habilitacao] ?? p.habilitacao ?? '', oculta: true },
    { chave: 'portal', titulo: 'Portal', valor: (p) => nomeEstado[estadoPortal(p.portal)], mostrar: (p) => <EstadoPortal e={p.portal} ligado={ligado} /> },
  ]
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
      <Painel titulo={`${t.titulo}${dados ? ` (${comFiltro ? `${lista.length} de ${todos.length}` : todos.length})` : ''}`} icone={t.icone} corpo={false}>
        <div className="pes-filtros">
          <Escolha valor={ativo} aoMudar={setAtivo} opcoes={[['sim', 'Na Escola'], ['nao', 'Já saíram'], ['todos', 'Todos']]} vazio={null} aria-label="Quem mostrar" />
          <Escolha valor={filtro.ramo} aoMudar={mudarFiltro('ramo')} opcoes={[...Object.entries(ref.ramos).map(([k, v]) => [k, v.nome]), ['civil', 'Civis']]} vazio="Todos os ramos" aria-label="Ramo" />
          <Escolha valor={filtro.origem} aoMudar={mudarFiltro('origem')} opcoes={[['esg', 'Da ESG'], ['fora', 'De outras unidades']]} vazio="Qualquer unidade" aria-label="Unidade" />
          {ligado && <Escolha valor={filtro.portal} aoMudar={mudarFiltro('portal')} opcoes={ESTADOS_PORTAL} vazio="Qualquer estado no portal" aria-label="Estado no portal" />}
          {comFiltro && <button type="button" className="btn btn-sm btn-link text-decoration-none" onClick={() => setFiltro({ ramo: '', origem: '', portal: '' })}><i className="fa fa-times me-1" />Limpar filtros</button>}
          {editar && ligado && (
            <button type="button" className="btn btn-sm btn-theme ms-auto" disabled={!escolhidos.size || aImprimir} onClick={fichas}>
              <i className="fa fa-print me-1" />{aImprimir ? 'A pedir ao portal…' : `Fichas de acesso${escolhidos.size ? ` (${escolhidos.size})` : ''}`}
            </button>
          )}
        </div>
        <div className="pes-filtros-tabela">
          {erro ? <Erro texto={erro} aoRepetir={recarregar} /> : !dados ? <Carregando /> : (
            <Tabela titulo={t.titulo} colunas={colunas} linhas={lista} pesquisarEm={pesquisarEm} dica="Pesquisar: nome, NIP, BI, telefone, posto, unidade…" aoClicar={(p) => navegar(`/pessoas/${p.id}`)} vazio={comFiltro ? 'Ninguém corresponde aos filtros.' : `Ainda não há ${t.titulo.toLowerCase()} registados.`} />
          )}
        </div>
      </Painel>
      {novo && <RegistoRapido tipo={tipo} aoFechar={() => setNovo(false)} aoGuardar={(p) => { setNovo(false); avisar(`${p.nome} registado(a). ${ligado ? 'A conta do portal cria-se dentro de momentos; depois imprima a ficha de acesso.' : ''}`); recarregar() }} />}
    </>
  )
}

// registo: o essencial, com o BI a vir da base de dados do Estado (o resto da ficha preenche-se depois, se for preciso)
const VAZIO = { tipo: 'militar', bi: '', nome: '', dataNascimento: '', genero: '', estadoCivil: '', nacionalidade: 'Angolana', naturalidade: '', provincia: '', pai: '', mae: '', email: '', telefone: '', morada: '', ramo: 'EXE', posto: '', fps: 'QP', nip: '', nomeGuerra: '', especialidade: '', unidadeOrigem: '', habilitacao: '', areaFormacao: '', funcaoActual: '' }
const BI_VALIDO = /^[0-9]{9}[A-Z]{2}[0-9]{3}$/
const Seccao = ({ icone, children }) => <h6 className="pes-registo-seccao"><i className={`fa ${icone} me-2`} />{children}</h6>

function RegistoRapido({ tipo, aoFechar, aoGuardar }) {
  const { ref } = useSessao()
  const [d, setD] = useState({ ...VAZIO, tipoDocente: tipo === 'docente' ? 'colaborador' : '' })
  const [erro, setErro] = useState('')
  const [aGravar, setAGravar] = useState(false)
  const [bi, setBi] = useState({ estado: '', texto: '', visto: '' }) // estado: '' | 'a consultar' | 'ok' | 'erro'
  const militar = d.tipo === 'militar'
  const postos = ref.postos[d.ramo] ?? []
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
    const comuns = ['bi', 'nome', 'dataNascimento', 'genero', 'estadoCivil', 'nacionalidade', 'naturalidade', 'provincia', 'pai', 'mae', 'telefone', 'morada', 'unidadeOrigem', 'habilitacao', 'areaFormacao']
    const corpo = {
      tipo: d.tipo, vinculo: tipo, email: d.email || null,
      ...Object.fromEntries(comuns.map((k) => [k, d[k] ?? ''])),
      ...(militar ? { ramo: d.ramo, posto: d.posto, fps: d.fps, nip: d.nip, nomeGuerra: d.nomeGuerra, especialidade: d.especialidade } : {}),
      ...(tipo === 'docente' ? { tipoDocente: d.tipoDocente, funcaoActual: d.funcaoActual } : {}),
    }
    try {
      aoGuardar(await api('/pessoas', { metodo: 'POST', corpo }))
    } catch (falha) {
      setErro(falha.message)
    } finally {
      setAGravar(false)
    }
  }

  return (
    <Modal titulo={`Registar ${tipo === 'docente' ? 'docente' : 'estudante'}`} aoFechar={aoFechar} largo
      rodape={<><button type="button" className="btn btn-white" onClick={aoFechar}>Cancelar</button><button type="submit" form="registo-rapido" className="btn btn-theme" disabled={aGravar}><i className="fa fa-save me-1" />{aGravar ? 'A registar…' : 'Registar'}</button></>}>
      <form id="registo-rapido" onSubmit={guardar} className="pes-registo">
        {erro && <div className="alert alert-danger py-2">{erro}</div>}
        <div className="btn-group w-100 mb-3" role="group" aria-label="Militar ou civil">
          {[['militar', 'Militar', 'fa-shield-alt'], ['civil', 'Civil', 'fa-user-tie']].map(([k, r, i]) => (
            <button key={k} type="button" className={`btn ${d.tipo === k ? 'btn-theme' : 'btn-white'}`} aria-pressed={d.tipo === k} onClick={() => setD({ ...d, tipo: k })}><i className={`fa ${i} me-1`} />{r}</button>
          ))}
        </div>

        <Seccao icone="fa-id-card">Identificação</Seccao>
        <div className="row gx-3">
          <Campo rotulo="Bilhete de identidade" col="col-md-5" ajuda="Com o BI, os dados vêm da base de dados do Estado.">
            <div className="input-group input-group-sm">
              <input {...campo('bi', { onChange: (e) => { const v = e.target.value.toUpperCase(); set('bi')(v); consultarBi(v, true) }, placeholder: '001234567LA041', maxLength: 20 })} aria-label="Bilhete de identidade" />
              <button type="button" className="btn btn-outline-theme" disabled={bi.estado === 'a consultar' || !d.bi} onClick={() => consultarBi()}><i className={`fa ${bi.estado === 'a consultar' ? 'fa-spinner fa-spin' : 'fa-search'} me-1`} />Consultar</button>
            </div>
            {bi.texto && <div className={`small mt-1 ${bi.estado === 'ok' ? 'text-success' : 'text-danger'}`}><i className={`fa ${bi.estado === 'ok' ? 'fa-check-circle' : 'fa-exclamation-circle'} me-1`} />{bi.texto}</div>}
          </Campo>
          <Campo rotulo="Nome completo" obrigatorio col="col-md-7"><input {...campo('nome')} required minLength={5} /></Campo>
          <Campo rotulo="Data de nascimento" col="col-md-3"><input {...campo('dataNascimento', { type: 'date' })} /></Campo>
          <Campo rotulo="Género" col="col-md-3"><Escolha valor={d.genero} aoMudar={set('genero')} opcoes={ref.generos} /></Campo>
          <Campo rotulo="Estado civil" col="col-md-3"><Escolha valor={d.estadoCivil} aoMudar={set('estadoCivil')} opcoes={ref.estadosCivis} /></Campo>
          <Campo rotulo="Nacionalidade" col="col-md-3"><input {...campo('nacionalidade')} /></Campo>
          <Campo rotulo="Naturalidade (município)" col="col-md-4"><input {...campo('naturalidade')} /></Campo>
          <Campo rotulo="Província" col="col-md-4"><Escolha valor={d.provincia} aoMudar={set('provincia')} opcoes={ref.provincias} /></Campo>
          <Campo rotulo="Habilitações literárias" col="col-md-4"><Escolha valor={d.habilitacao} aoMudar={set('habilitacao')} opcoes={ref.habilitacoes} /></Campo>
          <Campo rotulo="Nome do pai" col="col-md-6"><input {...campo('pai')} /></Campo>
          <Campo rotulo="Nome da mãe" col="col-md-6"><input {...campo('mae')} /></Campo>
          <Campo rotulo="Área de formação" col="col-md-12"><input {...campo('areaFormacao', { placeholder: 'ex.: Ciências Militares, Engenharia Informática…' })} /></Campo>
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
            <Campo rotulo="Unidade de origem (fora da ESG)" col="col-md-12" ajuda="Se vem de outra unidade das FAA (ex.: Regimento de Infantaria n.º 10). Se é da ESG, ponha a unidade depois, na ficha."><input {...campo('unidadeOrigem')} /></Campo>
          </div>
        </>}

        {tipo === 'docente' && <>
          <Seccao icone="fa-chalkboard-teacher">Docência</Seccao>
          <div className="row gx-3">
            <Campo rotulo="Tipo de docente" col="col-md-4"><Escolha valor={d.tipoDocente} aoMudar={set('tipoDocente')} opcoes={ref.tiposDocente} /></Campo>
            {d.tipoDocente === 'colaborador' && <Campo rotulo="Função ou cargo actual (fora da Escola)" col="col-md-8"><input {...campo('funcaoActual')} /></Campo>}
          </div>
        </>}

        <Seccao icone="fa-address-book">Contactos</Seccao>
        <div className="row gx-3">
          <Campo rotulo="E-mail da Escola" col="col-md-6" ajuda="Com e-mail, o portal cria a conta sozinho (depois imprime-se a ficha de acesso)."><input {...campo('email', { type: 'email', placeholder: 'nome.apelido@esgfaa.gov.ao' })} /></Campo>
          <Campo rotulo="Telefone" col="col-md-6"><input {...campo('telefone', { type: 'tel', placeholder: '9XX XXX XXX' })} /></Campo>
          <Campo rotulo="Morada" col="col-md-12"><input {...campo('morada')} /></Campo>
        </div>
        <div className="small text-muted mt-2">O resto da ficha (documentos, família, carreira…) preenche-se depois no perfil, em <Link to="/pessoas">Pessoal</Link>.</div>
      </form>
    </Modal>
  )
}
