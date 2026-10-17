import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { useDados } from '../useDados'
import { useSessao } from '../sessao'
import Tabela from '../componentes/Tabela'
import NovaLicenca from '../componentes/NovaLicenca'
import { Cabecalho, Carregando, Escolha, Estado, Painel } from '../componentes/Ui'
import { dataPt } from '../formatar'

const ESTADOS = { em_curso: 'Em curso', futura: 'Futura', terminada: 'Terminada' }

export default function Licencas() {
  const { ref, pode, avisar } = useSessao()
  const navegar = useNavigate()
  const [params, setParams] = useSearchParams()
  const filtros = useMemo(() => Object.fromEntries(params), [params])
  const { dados: linhas, erro, recarregar: carregar } = useDados('/licencas', filtros)
  const [nova, setNova] = useState(false)
  const mudar = (k, v) => { const n = new URLSearchParams(params); if (v) n.set(k, v); else n.delete(k); setParams(n) }
  const colunas = useMemo(() => [
    { chave: 'nome', titulo: 'Nome', valor: (l) => l.nome, mostrar: (l) => <strong>{l.nome}</strong> },
    { chave: 'ident', titulo: 'NIP / N.º', valor: (l) => l.identificacao },
    { chave: 'posto', titulo: 'Posto', valor: (l) => l.postoNome },
    { chave: 'tipo', titulo: 'Licença', valor: (l) => l.tipoNome },
    { chave: 'inicio', titulo: 'Início', valor: (l) => l.inicio, mostrar: (l) => dataPt(l.inicio) },
    { chave: 'fim', titulo: 'Fim', valor: (l) => l.fim, mostrar: (l) => dataPt(l.fim) },
    { chave: 'dias', titulo: 'Dias', valor: (l) => l.dias, alinhar: 'end' },
    { chave: 'estado', titulo: 'Estado', valor: (l) => ESTADOS[l.estado], mostrar: (l) => <Estado estado={l.estado} texto={ESTADOS[l.estado]} /> },
    { chave: 'despacho', titulo: 'Despacho', valor: (l) => l.despacho },
    ...(pode('editar') ? [{ chave: 'apagar', titulo: '', exportar: false, valor: () => '', mostrar: (l) => <button type="button" className="btn btn-xs btn-outline-danger" title="Apagar" onClick={(e) => { e.stopPropagation(); if (window.confirm('Apagar esta licença?')) api(`/licencas/${l.id}`, { metodo: 'DELETE' }).then(() => { avisar('Licença apagada.'); carregar() }).catch((x) => avisar(x.message, 'erro')) }}><i className="fa fa-trash" /></button> }] : []),
  ], [pode, avisar, carregar])
  const anoAtual = new Date().getFullYear()
  return (
    <>
      <Cabecalho titulo="Licenças" subtitulo="arts. 31.º a 41.º" migalhas={[['Carreiras'], ['Licenças']]}>
        {pode('editar') && <button type="button" className="btn btn-theme" onClick={() => setNova(true)}><i className="fa fa-plus me-1" />Registar licença</button>}
      </Cabecalho>
      <Painel>
        <div className="row mb-2">
          <div className="col-md-3"><Escolha valor={filtros.estado} aoMudar={(v) => mudar('estado', v)} opcoes={ESTADOS} vazio="Todas" aria-label="Estado" /></div>
          <div className="col-md-3"><Escolha valor={filtros.tipo} aoMudar={(v) => mudar('tipo', v)} opcoes={ref.tiposLicenca} vazio="Todos os tipos" aria-label="Tipo" /></div>
          <div className="col-md-3"><Escolha valor={filtros.ano} aoMudar={(v) => mudar('ano', v)} opcoes={Array.from({ length: 6 }, (_, i) => String(anoAtual + 1 - i))} vazio="Todos os anos" aria-label="Ano" /></div>
        </div>
        {erro ? <div className="alert alert-danger">{erro}</div> : !linhas ? <Carregando /> : <Tabela titulo="Licenças" subtitulo={[filtros.estado && ESTADOS[filtros.estado], filtros.tipo && ref.tiposLicenca[filtros.tipo], filtros.ano].filter(Boolean).join(' · ')} colunas={colunas} linhas={linhas} aoClicar={(l) => navegar(`/pessoas/${l.pessoaId}`)} />}
      </Painel>
      {nova && <NovaLicenca aoFechar={() => setNova(false)} aoGuardar={() => { setNova(false); avisar('Licença registada.'); carregar() }} />}
    </>
  )
}
