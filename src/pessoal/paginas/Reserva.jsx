import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useDados } from '../useDados'
import Tabela from '../componentes/Tabela'
import Foto from '../componentes/Foto'
import { Cabecalho, Carregando, Escolha, Painel } from '../componentes/Ui'
import { dataPt } from '../formatar'

// projeção da passagem à reserva (art. 111.º) e à reforma (art. 114.º)
export default function Reserva() {
  const navegar = useNavigate()
  const [params, setParams] = useSearchParams()
  const ano = params.get('ano') ?? ''
  const [anos, setAnos] = useState(5)
  const consulta = useMemo(() => ({ anos }), [anos])
  const { dados: linhas, erro } = useDados('/carreira/reserva', consulta)
  const visiveis = useMemo(() => (linhas ?? []).filter((l) => !ano || l.data.startsWith(ano)), [linhas, ano])
  const colunas = useMemo(() => [
    { chave: 'data', titulo: 'Data', valor: (l) => l.data, mostrar: (l) => <><strong className={l.atrasado ? 'text-danger' : ''}>{dataPt(l.data)}</strong>{l.atrasado && <div className="small text-danger">em atraso — atualize a ficha</div>}</> },
    { chave: 'passagem', titulo: 'Passa à', valor: (l) => (l.passagem === 'reserva' ? 'Reserva' : 'Reforma'), mostrar: (l) => <span className={`badge ${l.passagem === 'reserva' ? 'bg-warning text-dark' : 'bg-danger'}`}>{l.passagem === 'reserva' ? 'Reserva' : 'Reforma'}</span> },
    { chave: 'posto', titulo: 'Posto', valor: (l) => l.postoNome },
    { chave: 'nip', titulo: 'NIP', valor: (l) => l.nip },
    { chave: 'nome', titulo: 'Nome', valor: (l) => l.nome, mostrar: (l) => <span className="pes-pessoa"><Foto pessoaId={l.id} fotoId={l.fotoId} nome={l.nome} /><strong>{l.nome}</strong></span> },
    { chave: 'ramo', titulo: 'Ramo', valor: (l) => l.ramo },
    { chave: 'idade', titulo: 'Idade', valor: (l) => l.idade, alinhar: 'end' },
    { chave: 'cargo', titulo: 'Cargo', valor: (l) => l.cargoNome },
    { chave: 'unidade', titulo: 'Unidade', valor: (l) => l.unidadeNome },
    { chave: 'artigo', titulo: 'Fundamento', valor: (l) => l.artigo },
  ], [])
  const atual = new Date().getFullYear()
  return (
    <>
      <Cabecalho titulo="Reserva e reforma" subtitulo="quem sai do activo nos próximos anos" migalhas={[['Carreiras'], ['Reserva e reforma']]} />
      <Painel>
        <div className="row mb-2">
          <div className="col-md-3"><Escolha valor={String(anos)} aoMudar={(v) => setAnos(Number(v))} opcoes={[['1', 'Próximo ano'], ['3', 'Próximos 3 anos'], ['5', 'Próximos 5 anos'], ['10', 'Próximos 10 anos']]} vazio={null} aria-label="Período" /></div>
          <div className="col-md-3"><Escolha valor={ano} aoMudar={(v) => setParams(v ? { ano: v } : {})} opcoes={Array.from({ length: anos + 1 }, (_, i) => String(atual + i))} vazio="Todos os anos" aria-label="Ano" /></div>
        </div>
        <p className="small text-muted"><i className="fa fa-info-circle me-1" />Datas pelos limites de idade do Quadro Permanente (art. 111.º) e da reforma (65 anos para oficiais generais; 60 anos ou 35 de serviço para os outros — art. 114.º). Prepare a substituição de quem ocupa cargos.</p>
        {erro ? <div className="alert alert-danger">{erro}</div> : !linhas ? <Carregando /> : <Tabela titulo={`Passagem à reserva e reforma${ano ? ` em ${ano}` : ''}`} colunas={colunas} linhas={visiveis} chave={(l) => `${l.id}-${l.passagem}`} aoClicar={(l) => navegar(`/pessoas/${l.id}`)} />}
      </Painel>
    </>
  )
}
