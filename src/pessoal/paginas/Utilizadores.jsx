import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import { credenciaisPdf } from '../documentos'
import { useDados } from '../useDados'
import { useSessao } from '../sessao'
import Tabela from '../componentes/Tabela'
import { Cabecalho, Campo, Carregando, Escolha, Modal, Painel } from '../componentes/Ui'
import { dataHoraPt } from '../formatar'

export default function Utilizadores() {
  const { ref, avisar, utilizador } = useSessao()
  const [linhas, setLinhas] = useState(null)
  const [modal, setModal] = useState(null)
  const carregar = useCallback(() => api('/utilizadores').then(setLinhas).catch((e) => avisar(e.message, 'erro')), [avisar])
  useEffect(() => { carregar() }, [carregar])
  const colunas = useMemo(() => [
    { chave: 'nome', titulo: 'Nome', valor: (u) => u.nome, mostrar: (u) => <strong>{u.nome}</strong> },
    { chave: 'email', titulo: 'E-mail', valor: (u) => u.email },
    { chave: 'papel', titulo: 'Papel', valor: (u) => u.papelNome },
    { chave: 'unidade', titulo: 'Unidade', valor: (u) => u.unidadeNome },
    { chave: 'estado', titulo: 'Estado', valor: (u) => (u.ativo ? 'Ativo' : 'Desativado'), mostrar: (u) => <span className={`badge ${u.ativo ? 'bg-success' : 'bg-secondary'}`}>{u.ativo ? 'Ativo' : 'Desativado'}</span> },
    { chave: 'acesso', titulo: 'Último acesso', valor: (u) => u.ultimoAcesso ?? '', mostrar: (u) => dataHoraPt(u.ultimoAcesso) },
  ], [])
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
        <button type="button" className="btn btn-outline-theme" onClick={criarContas}><i className="fa fa-users me-1" />Criar contas para todos</button>
        <button type="button" className="btn btn-theme" onClick={() => setModal({})}><i className="fa fa-user-plus me-1" />Novo utilizador</button>
      </Cabecalho>
      <Painel>
        <div className="row small mb-3">
          {Object.entries(ref.papeis).map(([k, p]) => <div key={k} className="col-md mb-2"><strong>{p.nome}</strong><div className="text-muted">{{ administrador: 'Tudo, incluindo utilizadores, orgânica e ligação ao portal.', chefe: 'Consulta, edita, envia propostas e regista as respostas.', operador: 'Consulta, edita fichas e prepara propostas.', consulta: 'Só consulta.', utente: 'Militares e civis da Escola: expediente da sua área, mensagens e a sua ficha.' }[k]}</div></div>)}
        </div>
        <Tabela titulo="Utilizadores do sistema de pessoal" colunas={colunas} linhas={linhas} aoClicar={setModal} />
      </Painel>
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
    api(u.id ? `/utilizadores/${u.id}` : '/utilizadores', { metodo: u.id ? 'PUT' : 'POST', corpo }).then(() => aoGuardar('Utilizador guardado.')).catch((e) => setErro(e.message))
  }
  return (
    <Modal titulo={u.id ? `Editar ${u.nome}` : 'Novo utilizador'} aoFechar={aoFechar} rodape={<><button type="button" className="btn btn-light" onClick={aoFechar}>Cancelar</button><button type="button" className="btn btn-theme" onClick={guardar}>Guardar</button></>}>
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
