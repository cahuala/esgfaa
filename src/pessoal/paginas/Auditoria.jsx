import { useMemo, useState } from 'react'
import { useDados } from '../useDados'
import Tabela from '../componentes/Tabela'
import { Cabecalho, Carregando, Painel } from '../componentes/Ui'
import { dataHoraPt } from '../formatar'

const ACOES = { entrar: 'Entrou', entrada_falhada: 'Entrada falhada', acesso_recusado: 'Acesso recusado (fora da rede)', ver_ficha: 'Consultou ficha', criar_ficha: 'Criou ficha', editar_ficha: 'Editou ficha', exportar: 'Exportou dados', criar_proposta: 'Criou proposta', submeter_proposta: 'Submeteu proposta', aprovar_proposta: 'Aprovou proposta', rejeitar_proposta: 'Rejeitou proposta', devolver_proposta: 'Devolveu proposta', cancelar_proposta: 'Cancelou proposta', registar_licenca: 'Registou licença', mudar_senha: 'Mudou a palavra-passe', criar_utilizador: 'Criou utilizador', editar_utilizador: 'Editou utilizador' }

// quem fez o quê: entradas, consultas de fichas, alterações, decisões e exportações
export default function Auditoria() {
  const [f, setF] = useState({ de: '', ate: '' })
  const { dados: linhas, erro } = useDados('/auditoria', f)
  const colunas = useMemo(() => [
    { chave: 'quando', titulo: 'Quando', valor: (a) => a.quando, mostrar: (a) => dataHoraPt(a.quando) },
    { chave: 'utilizador', titulo: 'Utilizador', valor: (a) => a.utilizador },
    { chave: 'acao', titulo: 'Ação', valor: (a) => ACOES[a.acao] ?? a.acao, mostrar: (a) => <span className={`badge ${/falhada|recusado/.test(a.acao) ? 'bg-danger' : a.acao === 'exportar' ? 'bg-warning text-dark' : 'bg-light text-dark border'}`}>{ACOES[a.acao] ?? a.acao}</span> },
    { chave: 'alvo', titulo: 'Sobre', valor: (a) => a.alvo },
    { chave: 'detalhes', titulo: 'Detalhes', valor: (a) => (Object.keys(a.detalhes ?? {}).length ? JSON.stringify(a.detalhes) : '') , mostrar: (a) => <span className="small text-muted">{Object.entries(a.detalhes ?? {}).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join(' · ')}</span> },
    { chave: 'ip', titulo: 'Endereço', valor: (a) => a.ip },
  ], [])
  return (
    <>
      <Cabecalho titulo="Auditoria" subtitulo="registo de todas as ações" migalhas={[['Administração'], ['Auditoria']]} />
      <Painel>
        <div className="row mb-2">
          <div className="col-md-3"><label className="small text-muted">De</label><input type="date" className="form-control form-control-sm" value={f.de} onChange={(e) => setF({ ...f, de: e.target.value })} /></div>
          <div className="col-md-3"><label className="small text-muted">Até</label><input type="date" className="form-control form-control-sm" value={f.ate} onChange={(e) => setF({ ...f, ate: e.target.value })} /></div>
        </div>
        {erro ? <div className="alert alert-danger">{erro}</div> : !linhas ? <Carregando /> : <Tabela titulo="Auditoria do sistema de pessoal" colunas={colunas} linhas={linhas} porPagina={50} />}
      </Painel>
    </>
  )
}
