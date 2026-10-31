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

/*
  Estudantes ou docentes (tipo), numa tabela só deles: fotografia, posto, NIP, unidade (da ESG ou a de origem)
  e o estado no portal. Registo rápido (só o necessário) e fichas de acesso de vários de uma vez.
*/
export default function Academicos({ tipo }) {
  const t = TEXTOS[tipo]
  const navegar = useNavigate()
  const { pode, avisar } = useSessao()
  const editar = pode('editar')
  const [ativo, setAtivo] = useState('sim')
  const { dados, erro, recarregar } = useDados('/academicos', { tipo, ativo }, { tempoReal: true })
  const [escolhidos, setEscolhidos] = useState(() => new Set())
  const [novo, setNovo] = useState(false)
  const [aImprimir, setAImprimir] = useState(false)
  const lista = useMemo(() => dados?.pessoas ?? [], [dados])
  const ligado = Boolean(dados?.portalLigado)
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
    { chave: 'portal', titulo: 'Portal', valor: (p) => (p.portal?.conta?.ultimoAcesso ? 'Ativa' : p.portal?.conta ? 'Nunca entrou' : 'Sem conta'), mostrar: (p) => <EstadoPortal e={p.portal} ligado={ligado} /> },
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
      <Painel titulo={`${t.titulo}${dados ? ` (${lista.length})` : ''}`} icone={t.icone} corpo={false}>
        <div className="d-flex flex-wrap gap-2 p-3 pb-0">
          <Escolha valor={ativo} aoMudar={setAtivo} opcoes={[['sim', 'Na Escola'], ['nao', 'Já saíram'], ['todos', 'Todos']]} vazio={null} aria-label="Quem mostrar" style={{ width: 'auto' }} />
          {editar && ligado && (
            <button type="button" className="btn btn-sm btn-theme ms-auto" disabled={!escolhidos.size || aImprimir} onClick={fichas}>
              <i className="fa fa-print me-1" />{aImprimir ? 'A pedir ao portal…' : `Fichas de acesso${escolhidos.size ? ` (${escolhidos.size})` : ''}`}
            </button>
          )}
        </div>
        {erro ? <Erro texto={erro} aoRepetir={recarregar} /> : !dados ? <Carregando /> : (
          <Tabela titulo={t.titulo} colunas={colunas} linhas={lista} aoClicar={(p) => navegar(`/pessoas/${p.id}`)} vazio={`Ainda não há ${t.titulo.toLowerCase()} registados.`} />
        )}
      </Painel>
      {novo && <RegistoRapido tipo={tipo} aoFechar={() => setNovo(false)} aoGuardar={(p) => { setNovo(false); avisar(`${p.nome} registado(a). ${ligado ? 'A conta do portal cria-se dentro de momentos; depois imprima a ficha de acesso.' : ''}`); recarregar() }} />}
    </>
  )
}

// registo rápido: só o necessário (a ficha completa preenche-se depois, se for preciso)
function RegistoRapido({ tipo, aoFechar, aoGuardar }) {
  const { ref } = useSessao()
  const [d, setD] = useState({ tipo: 'militar', nome: '', email: '', ramo: 'EXE', posto: '', fps: 'QP', nip: '', unidadeOrigem: '', tipoDocente: tipo === 'docente' ? 'colaborador' : '', funcaoActual: '', telefone: '' })
  const [erro, setErro] = useState('')
  const [aGravar, setAGravar] = useState(false)
  const militar = d.tipo === 'militar'
  const postos = ref.postos[d.ramo] ?? []
  const campo = (k) => ({ value: d[k], onChange: (e) => setD({ ...d, [k]: e.target.value }), className: 'form-control form-control-sm' })
  async function guardar(e) {
    e.preventDefault()
    setErro('')
    setAGravar(true)
    const corpo = { tipo: d.tipo, vinculo: tipo, nome: d.nome, email: d.email || null, telefone: d.telefone, unidadeOrigem: d.unidadeOrigem, ...(militar ? { ramo: d.ramo, posto: d.posto, fps: d.fps, nip: d.nip } : {}), ...(tipo === 'docente' ? { tipoDocente: d.tipoDocente, funcaoActual: d.funcaoActual } : {}) }
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
      rodape={<><button type="submit" form="registo-rapido" className="btn btn-theme" disabled={aGravar}><i className="fa fa-save me-1" />{aGravar ? 'A registar…' : 'Registar'}</button><button type="button" className="btn btn-white" onClick={aoFechar}>Cancelar</button></>}>
      <form id="registo-rapido" onSubmit={guardar}>
        {erro && <div className="alert alert-danger py-2">{erro}</div>}
        <div className="btn-group w-100 mb-3" role="group" aria-label="Militar ou civil">
          {[['militar', 'Militar', 'fa-shield-alt'], ['civil', 'Civil', 'fa-user-tie']].map(([k, r, i]) => (
            <button key={k} type="button" className={`btn btn-sm ${d.tipo === k ? 'btn-theme' : 'btn-white'}`} aria-pressed={d.tipo === k} onClick={() => setD({ ...d, tipo: k })}><i className={`fa ${i} me-1`} />{r}</button>
          ))}
        </div>
        <div className="row">
          <Campo rotulo="Nome completo" obrigatorio col="col-md-8"><input {...campo('nome')} required minLength={5} /></Campo>
          <Campo rotulo="Telefone" col="col-md-4"><input {...campo('telefone')} /></Campo>
          <Campo rotulo="E-mail da Escola" col="col-md-12" ajuda="Com e-mail, o portal cria a conta sozinho (depois imprime-se a ficha de acesso)."><input type="email" {...campo('email')} placeholder="nome.apelido@esgfaa.gov.ao" /></Campo>
          {militar && <>
            <Campo rotulo="Ramo" obrigatorio col="col-md-3"><Escolha valor={d.ramo} aoMudar={(v) => setD({ ...d, ramo: v, posto: '' })} opcoes={Object.fromEntries(Object.entries(ref.ramos).map(([k, v]) => [k, v.nome]))} vazio={null} /></Campo>
            <Campo rotulo="Posto" obrigatorio col="col-md-3"><Escolha valor={d.posto} aoMudar={(v) => setD({ ...d, posto: v })} opcoes={postos.map((p) => [p.id, p.nome])} required /></Campo>
            <Campo rotulo="Forma de prestação de serviço" obrigatorio col="col-md-3"><Escolha valor={d.fps} aoMudar={(v) => setD({ ...d, fps: v })} opcoes={ref.formasServico} vazio={null} /></Campo>
            <Campo rotulo="NIP" obrigatorio col="col-md-3"><input {...campo('nip')} required /></Campo>
            <Campo rotulo="Unidade de origem (fora da ESG)" col="col-md-12" ajuda="Se vem de outra unidade das FAA (ex.: Regimento de Infantaria n.º 10). Se é da ESG, ponha a unidade depois, na ficha."><input {...campo('unidadeOrigem')} /></Campo>
          </>}
          {tipo === 'docente' && <>
            <Campo rotulo="Tipo de docente" col="col-md-4"><Escolha valor={d.tipoDocente} aoMudar={(v) => setD({ ...d, tipoDocente: v })} opcoes={ref.tiposDocente} /></Campo>
            {d.tipoDocente === 'colaborador' && <Campo rotulo="Função ou cargo actual (fora da Escola)" col="col-md-8"><input {...campo('funcaoActual')} /></Campo>}
          </>}
        </div>
        <div className="small text-muted">O resto da ficha (BI, morada, família…) preenche-se depois em <Link to="/pessoas">Pessoal</Link>, se for preciso.</div>
      </form>
    </Modal>
  )
}
