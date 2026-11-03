import { useMemo, useState } from 'react'
import { useSessao } from '../sessao'
import { useDados } from '../useDados'
import Tabela from '../componentes/Tabela'
import { Cabecalho, Carregando, Erro, Painel } from '../componentes/Ui'
import { FormPermissoes } from './Utilizadores'

/*
  Ecrã do Comandante: escolhe ele próprio o que cada conta do sistema pode fazer, ecrã a ecrã (vale logo).
  Os pedidos do administrador para dar ou tirar tarefas chegam-lhe também na Secretária digital.
*/
export default function PermissoesContas() {
  const { utilizador, ref, avisar } = useSessao()
  const { dados, erro, recarregar } = useDados('/utilizadores', undefined, { tempoReal: true })
  const [conta, setConta] = useState(null)
  const colunas = useMemo(() => [
    { chave: 'nome', titulo: 'Nome', valor: (u) => u.nome, mostrar: (u) => <><strong>{u.nome}</strong><div className="small text-muted">{u.email}</div></> },
    { chave: 'papel', titulo: 'Papel', valor: (u) => u.papelNome },
    { chave: 'unidade', titulo: 'Unidade', valor: (u) => u.unidadeNome },
    { chave: 'pode', titulo: 'O que pode fazer', valor: (u) => Object.keys(u.areas ?? {}).length, mostrar: (u) => {
      const a = Object.entries(u.areas ?? {})
      const altera = a.filter(([, n]) => n === 'alterar').length
      return <span className="small">{a.length ? `${a.length} ecrã(s) · altera em ${altera}` : 'só expediente e mensagens'}{u.permissoesProprias && <span className="badge bg-info ms-1">próprias</span>}{u.permissoesPedido && <div className="text-warning-emphasis"><i className="fa fa-stamp me-1" />Pedido do administrador: {u.permissoesPedido}</div>}</span>
    } },
    { chave: 'estado', titulo: 'Estado', valor: (u) => (u.aguardaDespacho ? 'A aguardar despacho' : u.ativo ? 'Ativa' : 'Desativada') },
  ], [])
  if (erro) return <Erro texto={erro} aoRepetir={recarregar} />
  if (!dados) return <Carregando />
  return (
    <>
      <Cabecalho titulo="O que cada conta pode fazer" subtitulo="o Comandante escolhe, ecrã a ecrã" migalhas={[['Secretária digital', '/secretaria'], ['Contas']]} />
      <Painel>
        <p className="small text-muted">Clique numa conta para escolher, em cada ecrã do sistema, se <b>não vê</b>, <b>só vê</b> ou <b>vê e altera</b>. A sua escolha vale logo e fica na auditoria.</p>
        <Tabela titulo="Contas do sistema de pessoal" colunas={colunas} linhas={dados.filter((u) => u.papel !== 'utente' || u.permissoesProprias)} aoClicar={setConta}
          vazio="Ainda não há contas." />
        <p className="small text-muted mb-0 mt-2">As contas de utente (só expediente e mensagens) não aparecem enquanto não lhes der nenhum ecrã: encontre-as em Utilizadores.</p>
      </Painel>
      {conta && <FormPermissoes comandante u={conta} eu={utilizador} refs={ref} aoFechar={() => setConta(null)} aoGuardar={(m) => { setConta(null); avisar(m); recarregar() }} />}
    </>
  )
}
