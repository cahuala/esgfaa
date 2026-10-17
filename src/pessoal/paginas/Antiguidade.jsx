import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDados } from '../useDados'
import { useSessao } from '../sessao'
import Tabela from '../componentes/Tabela'
import { Cabecalho, Carregando, Escolha, Painel } from '../componentes/Ui'
import { anos, dataPt } from '../formatar'

// lista de antiguidade (arts. 26.º e 29.º): por posto, o mais antigo primeiro
export default function Antiguidade() {
  const { ref } = useSessao()
  const navegar = useNavigate()
  const [f, setF] = useState({ posto: '', ramo: '' })
  const { dados: linhas, erro } = useDados('/carreira/antiguidade', f)
  const colunas = useMemo(() => [
    { chave: 'ordem', titulo: 'N.º', valor: (p) => p.ordem, alinhar: 'end' },
    { chave: 'posto', titulo: 'Posto', valor: (p) => p.postoNome, ordenarPor: (p) => 100 - p.grau },
    { chave: 'nip', titulo: 'NIP', valor: (p) => p.nip },
    { chave: 'nome', titulo: 'Nome', valor: (p) => p.nome, mostrar: (p) => <strong>{p.nome}</strong> },
    { chave: 'ramo', titulo: 'Ramo', valor: (p) => p.ramo },
    { chave: 'quadro', titulo: 'Quadro', valor: (p) => p.quadroEspecial },
    { chave: 'antig', titulo: 'Antiguidade no posto', valor: (p) => p.dataAntiguidadePosto, mostrar: (p) => dataPt(p.dataAntiguidadePosto) },
    { chave: 'tempo', titulo: 'No posto', valor: (p) => p.tempoNoPosto, mostrar: (p) => anos(p.tempoNoPosto), alinhar: 'end' },
    { chave: 'ingresso', titulo: 'Ingresso', valor: (p) => p.dataIngresso, mostrar: (p) => dataPt(p.dataIngresso) },
  ], [])
  const ramo = f.ramo || 'EXE'
  const titulo = `Lista de antiguidade${f.posto ? ` — ${ref.postos[ramo].find((p) => p.id === f.posto)?.nome}` : ''}${f.ramo ? ` (${ref.ramos[f.ramo].nome})` : ''}`
  return (
    <>
      <Cabecalho titulo="Listas de antiguidade" subtitulo="arts. 26.º e 29.º" migalhas={[['Carreiras'], ['Antiguidade']]} />
      <Painel>
        <div className="row mb-2">
          <div className="col-md-3"><Escolha valor={f.ramo} aoMudar={(v) => setF({ ...f, ramo: v })} opcoes={Object.fromEntries(Object.entries(ref.ramos).map(([k, v]) => [k, v.nome]))} vazio="Os três ramos" aria-label="Ramo" /></div>
          <div className="col-md-3"><Escolha valor={f.posto} aoMudar={(v) => setF({ ...f, posto: v })} opcoes={ref.postos[ramo].map((p) => [p.id, p.nome])} vazio="Todos os postos" aria-label="Posto" /></div>
        </div>
        <p className="small text-muted"><i className="fa fa-info-circle me-1" />Ordem: posto mais alto; no mesmo posto, a data do documento de promoção; em empate, as graduações anteriores, o tempo de serviço e a idade.</p>
        {erro ? <div className="alert alert-danger">{erro}</div> : !linhas ? <Carregando /> : <Tabela titulo={titulo} colunas={colunas} linhas={linhas} porPagina={50} aoClicar={(p) => navegar(`/pessoas/${p.id}`)} />}
      </Painel>
    </>
  )
}
