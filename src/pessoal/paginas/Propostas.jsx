import { useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useDados } from '../useDados'
import { useSessao } from '../sessao'
import Tabela from '../componentes/Tabela'
import { Cabecalho, Carregando, Erro, Escolha, Estado, Painel } from '../componentes/Ui'
import { dataHoraPt, dataPt } from '../formatar'

export default function Propostas() {
  const { ref, pode } = useSessao()
  const navegar = useNavigate()
  const [params, setParams] = useSearchParams()
  const filtros = useMemo(() => Object.fromEntries(params), [params])
  const { dados: linhas, erro } = useDados('/propostas', filtros)
  const mudar = (k, v) => { const n = new URLSearchParams(params); if (v) n.set(k, v); else n.delete(k); setParams(n) }

  const colunas = useMemo(() => [
    { chave: 'id', titulo: 'N.º', valor: (p) => p.id, alinhar: 'end' },
    { chave: 'titulo', titulo: 'Proposta', valor: (p) => p.titulo, mostrar: (p) => <strong>{p.titulo}</strong> },
    { chave: 'tipo', titulo: 'Tipo', valor: (p) => p.tipoNome },
    { chave: 'pessoas', titulo: 'Pessoas', valor: (p) => p.total, alinhar: 'end' },
    { chave: 'estado', titulo: 'Estado', valor: (p) => p.estadoNome, mostrar: (p) => <Estado estado={p.estado} texto={p.estadoNome} /> },
    { chave: 'criado', titulo: 'Criada', valor: (p) => p.criadoEm, mostrar: (p) => <>{dataHoraPt(p.criadoEm)}<div className="small text-muted">{p.criadoPor}</div></> },
    { chave: 'documento', titulo: 'Despacho', valor: (p) => [p.documento, p.dataDocumento && dataPt(p.dataDocumento)].filter(Boolean).join(' · ') },
  ], [])

  return (
    <>
      <Cabecalho titulo="Propostas" subtitulo="promoções, graduações, nomeações, exonerações e progressões" migalhas={[['Propostas']]}>
        {pode('propor') && <button type="button" className="btn btn-theme" onClick={() => navegar('/propostas/nova')}><i className="fa fa-plus me-1" />Nova proposta</button>}
      </Cabecalho>
      <Painel>
        <div className="row mb-2">
          <div className="col-md-3"><Escolha valor={filtros.tipo} aoMudar={(v) => mudar('tipo', v)} opcoes={Object.fromEntries(Object.entries(ref.tiposProposta).map(([k, v]) => [k, v.nome]))} vazio="Todos os tipos" aria-label="Tipo" /></div>
          <div className="col-md-3"><Escolha valor={filtros.estado} aoMudar={(v) => mudar('estado', v)} opcoes={ref.estadosProposta} vazio="Todos os estados" aria-label="Estado" /></div>
        </div>
        {erro && <Erro texto={erro} />}
        {!linhas ? <Carregando /> : <Tabela titulo="Propostas" subtitulo={[filtros.tipo && ref.tiposProposta[filtros.tipo]?.nome, filtros.estado && ref.estadosProposta[filtros.estado]].filter(Boolean).join(' · ')} colunas={colunas} linhas={linhas} aoClicar={(p) => navegar(`/propostas/${p.id}`)} />}
      </Painel>
    </>
  )
}
