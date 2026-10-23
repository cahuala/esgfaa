import { useState } from 'react'
import { api } from '../api'
import { useSessao } from '../sessao'
import { useDados } from '../useDados'
import { Cabecalho, Campo, Carregando, Escolha, Painel } from '../componentes/Ui'

const ORIGEM = { titular: ['bg-success', 'Ocupa o cargo'], substituto: ['bg-warning text-dark', 'Em exercício (o titular está ausente)'], manual: ['bg-secondary', 'Escrito à mão (cargo vago)'] }

/*
  Quem assina os documentos: cada assinatura liga-se a um cargo do quadro orgânico e assina quem o ocupa
  hoje (com o posto actual). Com o titular de licença ou ausente, assina o substituto; com o cargo vago, o
  nome escrito à mão. O Director de Ensino e o Comandante seguem também para os diplomas do portal.
*/
export default function Assinaturas() {
  const { avisar } = useSessao()
  const { dados, recarregar } = useDados('/definicoes/assinaturas')
  const { dados: cargos } = useDados('/cargos')
  const [d, setD] = useState(null)
  if (!dados || !cargos) return <Carregando />
  const chaves = Object.keys(dados.catalogo)
  const v = d ?? { local: dados.local, ...Object.fromEntries(chaves.map((k) => [k, { cargoId: dados[k].cargoId ?? '', substitutoId: dados[k].substitutoId ?? '', ...dados[k].manual }])) }
  const mudar = (q, k, x) => setD({ ...v, [q]: { ...v[q], [k]: x } })
  const opcoes = cargos.map((c) => [String(c.id), `${c.nome}${c.ocupantes?.length ? ` — ${c.ocupantes[0].nome}` : ' — vago'}`])
  async function guardar(e) {
    e.preventDefault()
    try {
      const corpo = { local: v.local, ...Object.fromEntries(chaves.map((k) => [k, { ...v[k], cargoId: v[k].cargoId ? Number(v[k].cargoId) : null, substitutoId: v[k].substitutoId ? Number(v[k].substitutoId) : null }])) }
      await api('/definicoes/assinaturas', { metodo: 'PUT', corpo })
      setD(null)
      recarregar()
      avisar('Assinaturas guardadas.')
    } catch (x) {
      avisar(x.message, 'erro')
    }
  }
  const bloco = (q) => {
    const agora = dados[q]
    const [cor, texto] = ORIGEM[agora.origem]
    return (
      <Painel key={q} titulo={dados.catalogo[q].titulo} icone="fa-signature">
        <p className="small text-muted">{dados.catalogo[q].usos}</p>
        <div className="border rounded p-2 mb-3 bg-light">
          <div className="small text-muted">Assina hoje</div>
          <div className="fw-bold">{agora.cargo}</div>
          <div className="fs-5">{agora.nome || <span className="text-danger">— sem nome —</span>}</div>
          <div>{agora.posto}</div>
          <span className={`badge ${cor} mt-1`}>{texto}</span>
          {agora.aviso && <div className="small text-warning mt-1"><i className="fa fa-exclamation-triangle me-1" />{agora.aviso}</div>}
        </div>
        <div className="row">
          <Campo rotulo="Cargo do quadro orgânico (quem o ocupa assina)" col="col-12"><Escolha valor={String(v[q].cargoId || '')} aoMudar={(x) => mudar(q, 'cargoId', x)} opcoes={opcoes} vazio={agora.cargoNome ? `Automático: ${agora.cargoNome}` : 'Escolha o cargo'} /></Campo>
          <Campo rotulo="Substituto (quando o titular está de licença ou ausente)" col="col-12"><Escolha valor={String(v[q].substitutoId || '')} aoMudar={(x) => mudar(q, 'substitutoId', x)} opcoes={opcoes} vazio={agora.substitutoNome ? `Automático: ${agora.substitutoNome}` : 'Nenhum'} /></Campo>
          <Campo rotulo="Como aparece no documento" col="col-12"><input className="form-control" value={v[q].cargo} onChange={(e) => mudar(q, 'cargo', e.target.value)} placeholder={agora.cargo} /></Campo>
          <Campo rotulo="Nome (só se o cargo estiver vago)" col="col-md-8"><input className="form-control" value={v[q].nome} onChange={(e) => mudar(q, 'nome', e.target.value)} /></Campo>
          <Campo rotulo="Posto (só se vago)" col="col-md-4"><input className="form-control" value={v[q].posto} onChange={(e) => mudar(q, 'posto', e.target.value)} /></Campo>
        </div>
      </Painel>
    )
  }
  return (
    <form onSubmit={guardar}>
      <Cabecalho titulo="Assinaturas dos documentos" subtitulo="assina quem ocupa o cargo" migalhas={[['Administração'], ['Assinaturas']]}>
        <button type="submit" className="btn btn-theme"><i className="fa fa-save me-1" />Guardar</button>
      </Cabecalho>
      <div className="row">{chaves.map((q) => <div key={q} className="col-xl-4">{bloco(q)}</div>)}</div>
      <Painel titulo="Local" icone="fa-map-marker-alt"><div className="row"><Campo rotulo="Cidade (na data do documento)" col="col-md-4"><input className="form-control" value={v.local} onChange={(e) => setD({ ...v, local: e.target.value })} /></Campo></div></Painel>
    </form>
  )
}
