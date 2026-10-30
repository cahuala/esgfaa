import { useNavigate } from 'react-router-dom'
import { useDados } from '../useDados'
import { Cabecalho, Carregando, Erro, Painel } from '../componentes/Ui'
import { dataHoraPt } from '../formatar'

const COR = { urgente: 'bg-danger', confidencial: 'bg-dark', normal: 'bg-light text-dark border' }

/*
  Secretária digital do Comandante: os documentos do Expediente que as unidades lhe submetem a despacho
  (os urgentes primeiro, depois do mais antigo). Abre-se o documento (com os anexos) e despacha-se lá:
  Visto, Concordo, Autorizo, Indefiro… com o texto. Em baixo, os últimos despachados.
*/
function Secretaria() {
  const navegar = useNavigate()
  const { dados, erro } = useDados('/secretaria')
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
      <Painel titulo="Despachados recentemente" icone="fa-check-double" corpo={false}>
        <div className="list-group list-group-flush">
          {dados.despachados.map(linha)}
          {!dados.despachados.length && <div className="list-group-item text-muted">Ainda nada despachado.</div>}
        </div>
      </Painel>
    </>
  )
}

export default Secretaria
