import { useCallback, useEffect, useMemo, useState } from 'react'
import { textoDespacho } from '../despacho'
import { api } from '../api'
import { credenciaisPdf } from '../documentos'
import { useDados } from '../useDados'
import { useSessao } from '../sessao'
import Tabela from '../componentes/Tabela'
import { Cabecalho, Campo, Carregando, Escolha, Modal, Painel } from '../componentes/Ui'
import { dataHoraPt } from '../formatar'

export default function Utilizadores() {
  const { ref, avisar, utilizador, pode } = useSessao()
  // o Chefe e o Comandante veem a lista; só o administrador cria e altera contas
  const gere = pode('administrar')
  const [linhas, setLinhas] = useState(null)
  const [modal, setModal] = useState(null)
  const [permissoes, setPermissoes] = useState(null)
  const carregar = useCallback(() => api('/utilizadores').then(setLinhas).catch((e) => avisar(e.message, 'erro')), [avisar])
  useEffect(() => { carregar() }, [carregar])
  const colunas = useMemo(() => [
    { chave: 'nome', titulo: 'Nome', valor: (u) => u.nome, mostrar: (u) => <strong>{u.nome}</strong> },
    { chave: 'email', titulo: 'E-mail', valor: (u) => u.email },
    { chave: 'papel', titulo: 'Papel', valor: (u) => u.papelNome, mostrar: (u) => <>{u.papelNome}{u.papelPedido && <div className="small text-warning-emphasis"><i className="fa fa-stamp me-1" />Pedido: {u.papelPedidoNome} (a despacho)</div>}</> },
    { chave: 'unidade', titulo: 'Unidade', valor: (u) => u.unidadeNome },
    { chave: 'estado', titulo: 'Estado', valor: (u) => (u.aguardaDespacho ? 'A aguardar despacho' : u.ativo ? 'Ativo' : 'Desativado'), mostrar: (u) => (u.aguardaDespacho ? <span className="badge bg-warning text-dark" title="Não entra até o Comandante deferir"><i className="fa fa-stamp me-1" />A aguardar despacho</span> : <span className={`badge ${u.ativo ? 'bg-success' : 'bg-secondary'}`}>{u.ativo ? 'Ativo' : 'Desativado'}</span>) },
    { chave: 'acesso', titulo: 'Último acesso', valor: (u) => u.ultimoAcesso ?? '', mostrar: (u) => dataHoraPt(u.ultimoAcesso) },
    { chave: 'permissoes', titulo: 'O que pode fazer', valor: (u) => (u.permissoesProprias ? 'Próprias' : 'As do papel'), mostrar: (u) => (
      <span className="d-flex flex-column align-items-start gap-1">
        <span className={`badge ${u.permissoesProprias ? 'bg-info' : 'bg-light text-dark border'}`}>{u.permissoesProprias ? 'Próprias' : 'As do papel'}</span>
        {u.permissoesPedido && <span className="small text-warning-emphasis" title={u.permissoesPedido}><i className="fa fa-stamp me-1" />Mudança a despacho</span>}
        {gere && <button type="button" className="btn btn-xs btn-outline-theme" onClick={(e) => { e.stopPropagation(); setPermissoes(u) }}><i className="fa fa-user-shield me-1" />Permissões</button>}
      </span>
    ) },
  ], [gere])
  // uma conta de utente para cada militar e civil que ainda não tem (expediente e mensagens)
  async function criarContas() {
    if (!window.confirm('Criar uma conta (expediente, mensagens e a própria ficha) para cada militar e civil da Escola que ainda não tem? As palavras-passe iniciais saem num PDF para entregar em mão.')) return
    try {
      const contas = await api('/utilizadores/contas-pessoas', { metodo: 'POST', corpo: {} })
      if (!contas.length) return avisar('Todos já têm conta.')
      await credenciaisPdf(contas)
      avisar(`${contas.length} conta(s) criada(s). Guarde o PDF: as palavras-passe não voltam a aparecer.`)
      carregar()
    } catch (e) {
      avisar(e.message, 'erro')
    }
  }
  if (!linhas) return <Carregando />
  return (
    <>
      <Cabecalho titulo="Utilizadores" subtitulo="quem usa o sistema de pessoal" migalhas={[['Administração'], ['Utilizadores']]}>
        {gere && <button type="button" className="btn btn-outline-theme" onClick={criarContas}><i className="fa fa-users me-1" />Criar contas para todos</button>}
        {gere && <button type="button" className="btn btn-theme" onClick={() => setModal({})}><i className="fa fa-user-plus me-1" />Novo utilizador</button>}
      </Cabecalho>
      <Painel>
        <div className="row small mb-3">
          {Object.entries(ref.papeis).map(([k, p]) => <div key={k} className="col-md mb-2"><strong>{p.nome}</strong><div className="text-muted">{{ administrador: 'Tudo, incluindo utilizadores, orgânica e ligação ao portal.', chefe: 'Vê tudo do Pessoal (também utilizadores e auditoria), edita, envia propostas e regista as respostas.', comandante: 'Vê tudo, sem alterar.', operador: 'Consulta, edita fichas e prepara propostas.', consulta: 'Só consulta.', utente: 'Militares e civis da Escola: expediente da sua área, mensagens e a sua ficha.' }[k]}</div></div>)}
        </div>
        <Tabela titulo="Utilizadores do sistema de pessoal" colunas={colunas} linhas={linhas} aoClicar={gere ? setModal : undefined} />
      </Painel>
      {permissoes && <FormPermissoes u={permissoes} eu={utilizador} refs={ref} aoFechar={() => setPermissoes(null)} aoGuardar={(m) => { setPermissoes(null); avisar(m); carregar() }} />}
      {modal && <FormUtilizador u={modal} eu={utilizador} papeis={ref.papeis} aoFechar={() => setModal(null)} aoGuardar={(m) => { setModal(null); avisar(m); carregar() }} />}
    </>
  )
}

function FormUtilizador({ u, eu, papeis, aoFechar, aoGuardar }) {
  const [d, setD] = useState({ nome: u.nome ?? '', email: u.email ?? '', papel: u.papel ?? 'operador', ativo: u.ativo ?? true, senha: '', unidadeId: u.unidadeId ?? '' })
  const { dados: unidades } = useDados('/unidades')
  const [erro, setErro] = useState('')
  const guardar = () => {
    const unidadeId = d.unidadeId ? Number(d.unidadeId) : null
    const corpo = u.id ? { nome: d.nome, papel: d.papel, ativo: d.ativo, unidadeId, ...(d.senha ? { senha: d.senha } : {}) } : { ...d, unidadeId }
    api(u.id ? `/utilizadores/${u.id}` : '/utilizadores', { metodo: u.id ? 'PUT' : 'POST', corpo }).then((r) => aoGuardar(`Utilizador guardado. ${textoDespacho(r)}`.trim())).catch((e) => setErro(e.message))
  }
  // perdeu o telemóvel e os códigos de recuperação: volta a ligar a verificação ao entrar
  const repor2fa = () => {
    if (!window.confirm(`${u.nome} passa a entrar só com a palavra-passe e terá de ligar de novo a verificação em dois passos. Confirmou a identidade da pessoa?`)) return
    api(`/utilizadores/${u.id}/2fa/repor`, { metodo: 'POST' }).then(() => aoGuardar('Verificação em dois passos reposta.')).catch((e) => setErro(e.message))
  }
  return (
    <Modal titulo={u.id ? `Editar ${u.nome}` : 'Novo utilizador'} aoFechar={aoFechar} rodape={<>{u.id && u.id !== eu.id && <button type="button" className="btn btn-outline-danger me-auto" onClick={repor2fa}><i className="fa fa-mobile-alt me-1" />Repor verificação em dois passos</button>}<button type="button" className="btn btn-outline-secondary" onClick={aoFechar}>Cancelar</button><button type="button" className="btn btn-theme" onClick={guardar}>Guardar</button></>}>
      {erro && <div className="alert alert-danger">{erro}</div>}
      <div className="row">
        <Campo rotulo="Nome" obrigatorio><input className="form-control form-control-sm" value={d.nome} onChange={(e) => setD({ ...d, nome: e.target.value })} /></Campo>
        <Campo rotulo="E-mail" obrigatorio><input type="email" className="form-control form-control-sm" value={d.email} disabled={Boolean(u.id)} onChange={(e) => setD({ ...d, email: e.target.value })} /></Campo>
        <Campo rotulo="Unidade (expediente e conversa da unidade)"><Escolha valor={String(d.unidadeId ?? '')} aoMudar={(v) => setD({ ...d, unidadeId: v })} opcoes={(unidades ?? []).map((x) => [String(x.id), x.nome])} vazio="Nenhuma" /></Campo>
        <Campo rotulo="Papel"><Escolha valor={d.papel} aoMudar={(v) => setD({ ...d, papel: v })} opcoes={papeis} vazio={null} disabled={u.id === eu.id} /></Campo>
        <Campo rotulo={u.id ? 'Nova palavra-passe (para repor)' : 'Palavra-passe inicial'} obrigatorio={!u.id} ajuda="Pelo menos 10 caracteres, com letras e números. A pessoa muda-a na primeira entrada."><input type="password" autoComplete="new-password" className="form-control form-control-sm" value={d.senha} onChange={(e) => setD({ ...d, senha: e.target.value })} /></Campo>
        {u.id && u.id !== eu.id && <div className="col-12"><label className="form-check"><input type="checkbox" className="form-check-input" checked={d.ativo} onChange={(e) => setD({ ...d, ativo: e.target.checked })} /> <span className="form-check-label">Conta ativa</span></label></div>}
      </div>
    </Modal>
  )
}

/*
  O que a conta pode fazer, ecrã a ecrã: nada, ver, ou ver e alterar. Parte das do papel; o que se mudar
  só vale depois do despacho do Comandante (Secretária digital).
*/
function FormPermissoes({ u, eu, refs, aoFechar, aoGuardar }) {
  const modelo = refs.modelosAreas?.[u.papel] ?? {}
  const [d, setD] = useState(() => ({ ...(u.areas ?? modelo) }))
  const [erro, setErro] = useState('')
  const grupos = [...new Set(Object.values(refs.areas).map((a) => a.grupo))]
  const igualModelo = JSON.stringify(Object.entries(d).sort()) === JSON.stringify(Object.entries(modelo).sort())
  const mudar = (k, nivel) => setD((x) => { const n = { ...x }; if (nivel) n[k] = nivel; else delete n[k]; return n })
  const guardar = (repor = false) => api(`/utilizadores/${u.id}`, { metodo: 'PUT', corpo: { permissoes: repor || igualModelo ? null : d } })
    .then((r) => aoGuardar(`${u.nome}: ${textoDespacho(r) || 'permissões guardadas.'}`)).catch((e) => setErro(e.message))
  return (
    <Modal titulo={`O que ${u.nome} pode fazer`} aoFechar={aoFechar} largo
      rodape={<>
        {u.permissoesProprias && <button type="button" className="btn btn-outline-secondary me-auto" onClick={() => guardar(true)}><i className="fa fa-undo me-1" />Voltar às do papel</button>}
        <button type="button" className="btn btn-white" onClick={aoFechar}>Cancelar</button>
        <button type="button" className="btn btn-theme" onClick={() => guardar(false)}><i className="fa fa-stamp me-1" />Pedir ao Comandante</button>
      </>}>
      {erro && <div className="alert alert-danger py-2">{erro}</div>}
      <p className="small text-muted">Papel: <strong>{u.papelNome}</strong>{u.permissoesProprias ? ' · com permissões próprias' : ' · com as permissões do papel'}. Escolha, ecrã a ecrã, se a conta <b>não vê</b>, <b>só vê</b> ou <b>vê e altera</b>. O expediente, as mensagens e a própria conta ficam sempre. A mudança vai a despacho do Comandante e só vale depois de deferida.</p>
      {u.permissoesPedido && <div className="alert alert-warning py-2 small"><i className="fa fa-stamp me-1" />Já há uma mudança à espera do despacho: {u.permissoesPedido}. Pedir de novo substitui-a.</div>}
      {u.id === eu.id && <div className="alert alert-info py-2 small">É a sua conta: não pode tirar a si próprio a gestão dos utilizadores.</div>}
      {grupos.map((g) => (
        <div key={g} className="mb-3">
          <div className="small text-muted text-uppercase fw-bold mb-1">{g}</div>
          <div className="table-responsive">
            <table className="table table-sm align-middle mb-0">
              <tbody>
                {Object.entries(refs.areas).filter(([, a]) => a.grupo === g).map(([k, a]) => {
                  const niveis = [['', 'Não vê'], ...(a.soAlterar ? [] : [['ver', a.soVer ? 'Vê' : 'Só vê']]), ...(a.soVer ? [] : [['alterar', a.soAlterar ? 'Pode' : 'Vê e altera']])]
                  return (
                    <tr key={k} className={d[k] !== modelo[k] ? 'table-warning' : ''}>
                      <td>{a.nome}{d[k] !== modelo[k] && <div className="small text-muted">no papel: {modelo[k] === 'alterar' ? 'vê e altera' : modelo[k] === 'ver' ? 'só vê' : 'não vê'}</div>}</td>
                      <td className="text-end text-nowrap" style={{ width: 260 }}>
                        <div className="btn-group btn-group-sm" role="group" aria-label={a.nome}>
                          {niveis.map(([n, t]) => <button key={n || 'nada'} type="button" className={`btn ${(d[k] ?? '') === n ? (n === 'alterar' ? 'btn-success' : n === 'ver' ? 'btn-info' : 'btn-secondary') : 'btn-white'}`} aria-pressed={(d[k] ?? '') === n} onClick={() => mudar(k, n)}>{t}</button>)}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </Modal>
  )
}
