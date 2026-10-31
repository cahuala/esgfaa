import { useNavigate } from 'react-router-dom'
import { useDados } from '../useDados'
import { Cabecalho, Carregando, Erro, Painel } from '../componentes/Ui'
import { dataHoraPt } from '../formatar'

const COR = { urgente: 'bg-danger', confidencial: 'bg-dark', normal: 'bg-light text-dark border' }

/*
  Secretária digital do Comandante: os documentos do Expediente que as unidades lhe submetem a despacho
  (os urgentes primeiro, depois do mais antigo). Abre-se o documento (com os anexos) e despacha-se lá:
  Visto, Concordo, Autorizo, Indefiro… com o texto. Também as propostas (promoções, nomeações…) antes de seguirem para o
  escalão superior: abre-se a proposta e despacha-se «Autorizo o envio» ou «Devolvo para correção». Em baixo, os últimos despachados.
*/
function Secretaria() {
  const navegar = useNavigate()
  const { dados, erro } = useDados('/secretaria', undefined, { tempoReal: true })
  if (erro) return <Erro texto={erro} />
  if (!dados) return <Carregando />
  const linha = (x) => (
    <button key={x.id} type="button" className="list-group-item list-group-item-action d-flex flex-wrap gap-2 align-items-center" onClick={() => navegar(`/expediente/${x.id}`)}>
      <span className="font-monospace small text-muted">{x.protocolo}</span>
      <span className={`badge ${COR[x.classificacao] ?? COR.normal}`}>{x.classificacao}</span>
      <span className="fw-bold flex-grow-1">{x.assunto}</span>
      <span className="small text-muted">{x.tipoNome} · {x.anexos} anexo(s)</span>
      <div className="w-100 small text-muted">
        {x.despacho.estado === 'pendente'
          ? <>Submetido por {x.despacho.pedidoPor}{x.despacho.pedidoUnidade ? ` (${x.despacho.pedidoUnidade})` : ''} · {dataHoraPt(x.despacho.pedidoEm)}{x.despacho.nota ? ` — «${x.despacho.nota}»` : ''}</>
          : <><b className="text-success">{x.despacho.decisaoNome}</b> · {dataHoraPt(x.despacho.despachadoEm)}{x.despacho.texto ? ` — ${x.despacho.texto}` : ''}</>}
      </div>
    </button>
  )
  return (
    <>
      <Cabecalho titulo="Secretária digital" subtitulo="documentos a despacho do Comandante" migalhas={[['Secretária digital']]} />
      <Painel titulo={`Por despachar (${dados.pendentes.length})`} icone="fa-stamp" corpo={false}>
        <div className="list-group list-group-flush">
          {dados.pendentes.map(linha)}
          {!dados.pendentes.length && <div className="list-group-item text-muted">Não há documentos à espera de despacho.</div>}
        </div>
      </Painel>
      <Painel titulo={`Propostas por despachar (${dados.propostas.pendentes.length})`} icone="fa-file-signature" corpo={false}>
        <div className="list-group list-group-flush">
          {dados.propostas.pendentes.map((x) => (
            <button key={x.id} type="button" className="list-group-item list-group-item-action d-flex flex-wrap gap-2 align-items-center" onClick={() => navegar(`/propostas/${x.id}`)}>
              <span className="font-monospace small text-muted">N.º {x.id}</span>
              <span className="badge bg-light text-dark border">{x.tipoNome}</span>
              <span className="fw-bold flex-grow-1">{x.titulo}</span>
              <span className="small text-muted">{x.total} pessoa(s)</span>
              <div className="w-100 small text-muted">Submetida por {x.despacho.pedidoPor} · {dataHoraPt(x.despacho.pedidoEm)}</div>
            </button>
          ))}
          {!dados.propostas.pendentes.length && <div className="list-group-item text-muted">Não há propostas à espera de despacho.</div>}
        </div>
      </Painel>
      <Painel titulo="Despachados recentemente" icone="fa-check-double" corpo={false}>
        <div className="list-group list-group-flush">
          {dados.despachados.map(linha)}
          {dados.propostas.despachadas.map((x) => (
            <button key={`p${x.id}`} type="button" className="list-group-item list-group-item-action d-flex flex-wrap gap-2 align-items-center" onClick={() => navegar(`/propostas/${x.id}`)}>
              <span className="font-monospace small text-muted">Proposta n.º {x.id}</span>
              <span className="fw-bold flex-grow-1">{x.titulo}</span>
              <div className="w-100 small text-muted"><b className="text-success">{x.despacho.decisaoNome}</b> · {dataHoraPt(x.despacho.despachadoEm)}{x.despacho.texto ? ` — ${x.despacho.texto}` : ''}</div>
            </button>
          ))}
          {!dados.despachados.length && !dados.propostas.despachadas.length && <div className="list-group-item text-muted">Ainda nada despachado.</div>}
        </div>
      </Painel>
    </>
  )
}

export default Secretaria
