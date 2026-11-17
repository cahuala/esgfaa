import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDados } from '../useDados'
import Tabela from '../componentes/Tabela'
import { Cabecalho, Carregando, Erro, Escolha, Painel } from '../componentes/Ui'

const TIPOS = [['', 'Todos'], ['militar', 'Militares'], ['civil', 'Civis'], ['domiciliar', 'Domiciliares']]

/*
  Fichas com dados por completar (militares, civis e domiciliares): o que falta a cada uma. Filtra-se pelo tipo e
  pelo dado em falta; clicar abre a ficha para editar.
*/
export default function Incompletas() {
  const navegar = useNavigate()
  const { dados, erro } = useDados('/pessoas-incompletas', undefined, { tempoReal: true })
  const [tipo, setTipo] = useState('')
  const [campo, setCampo] = useState('')
  const campos = useMemo(() => [...new Set((dados ?? []).flatMap((x) => x.falta))].sort((a, b) => a.localeCompare(b, 'pt')), [dados])
  const linhas = (dados ?? []).filter((x) => (!tipo || x.tipo === tipo) && (!campo || x.falta.includes(campo)))
  const colunas = useMemo(() => [
    { chave: 'nome', titulo: 'Nome', valor: (x) => x.nome, mostrar: (x) => <><strong>{x.nome}</strong><div className="small text-muted">{x.nip ? `NIP ${x.nip}` : x.numeroAgente ? `Agente ${x.numeroAgente}` : ''}</div></> },
    { chave: 'tipo', titulo: 'Tipo', valor: (x) => ({ militar: 'Militar', civil: 'Civil', domiciliar: 'Domiciliar' }[x.tipo]) },
    { chave: 'posto', titulo: 'Posto / categoria', valor: (x) => x.postoNome },
    { chave: 'unidade', titulo: 'Unidade', valor: (x) => x.unidadeNome },
    { chave: 'n', titulo: 'Em falta', valor: (x) => x.falta.length, alinhar: 'center' },
    { chave: 'falta', titulo: 'O que falta', valor: (x) => x.falta.join(', '), mostrar: (x) => x.falta.map((f) => <span key={f} className="badge bg-warning text-dark me-1 mb-1">{f}</span>) },
  ], [])
  if (erro) return <Erro texto={erro} />
  if (!dados) return <Carregando />
  return (
    <>
      <Cabecalho titulo="Dados por completar" subtitulo={`${dados.length} ficha(s) com dados em falta`} migalhas={[['Pessoal', '/pessoas'], ['Dados por completar']]} />
      <Painel>
        <div className="d-flex flex-wrap gap-2 align-items-center mb-3">
          {TIPOS.map(([k, t]) => {
            const n = k ? dados.filter((x) => x.tipo === k).length : dados.length
            return <button key={k} type="button" className={`btn btn-sm ${tipo === k ? 'btn-theme' : 'btn-white'}`} onClick={() => setTipo(k)}>{t} ({n})</button>
          })}
          <div style={{ minWidth: 260 }}><Escolha valor={campo} aoMudar={setCampo} opcoes={campos} vazio="Qualquer dado em falta" aria-label="Dado em falta" /></div>
        </div>
        <p className="small text-muted mb-2"><i className="fa fa-info-circle me-1" />Clique numa pessoa para abrir a ficha e completar.</p>
        <Tabela titulo="Dados por completar" colunas={colunas} linhas={linhas} aoClicar={(x) => navegar(`/pessoas/${x.id}/editar`)} />
      </Painel>
    </>
  )
}
