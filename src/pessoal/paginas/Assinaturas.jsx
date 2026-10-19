import { useState } from 'react'
import { api } from '../api'
import { useSessao } from '../sessao'
import { useDados } from '../useDados'
import { Cabecalho, Campo, Carregando, Painel } from '../componentes/Ui'

// quem assina os documentos pessoais (declarações, guias, fichas): muda quando muda o Comandante ou o Chefe
export default function Assinaturas() {
  const { avisar } = useSessao()
  const { dados } = useDados('/definicoes/assinaturas')
  const [d, setD] = useState(null)
  if (!dados) return <Carregando />
  const v = d ?? dados
  const mudar = (q, k) => (e) => setD({ ...v, [q]: { ...v[q], [k]: e.target.value } })
  async function guardar(e) {
    e.preventDefault()
    try {
      setD(await api('/definicoes/assinaturas', { metodo: 'PUT', corpo: { comandante: v.comandante, chefeRpq: v.chefeRpq, local: v.local } }))
      avisar('Assinaturas guardadas.')
    } catch (x) {
      avisar(x.message, 'erro')
    }
  }
  const bloco = (q, titulo, ajuda) => (
    <Painel titulo={titulo} icone="fa-signature">
      <p className="small text-muted">{ajuda}</p>
      <div className="row">
        <Campo rotulo="Cargo (como aparece no documento)" col="col-md-12"><input className="form-control" value={v[q].cargo} onChange={mudar(q, 'cargo')} /></Campo>
        <Campo rotulo="Nome" col="col-md-8"><input className="form-control" value={v[q].nome} onChange={mudar(q, 'nome')} placeholder="Ex.: CARLOS MANUEL DE OLIVEIRA" /></Campo>
        <Campo rotulo="Posto" col="col-md-4"><input className="form-control" value={v[q].posto} onChange={mudar(q, 'posto')} placeholder="Ex.: TENENTE GENERAL" /></Campo>
      </div>
    </Painel>
  )
  return (
    <form onSubmit={guardar}>
      <Cabecalho titulo="Assinaturas dos documentos" migalhas={[['Administração'], ['Assinaturas']]}>
        <button type="submit" className="btn btn-theme"><i className="fa fa-save me-1" />Guardar</button>
      </Cabecalho>
      <div className="row">
        <div className="col-xl-6">{bloco('comandante', 'Comandante da Escola', 'Assina as declarações (efectividade, salário, serviço), as guias de marcha e a proposta de nomeação.')}</div>
        <div className="col-xl-6">{bloco('chefeRpq', 'Chefe da Repartição de Pessoal e Quadros', 'Assina as listas e mapas do menu Documentos.')}</div>
      </div>
      <Painel titulo="Local" icone="fa-map-marker-alt"><div className="row"><Campo rotulo="Cidade (na data do documento)" col="col-md-4"><input className="form-control" value={v.local} onChange={(e) => setD({ ...v, local: e.target.value })} /></Campo></div></Painel>
    </form>
  )
}
