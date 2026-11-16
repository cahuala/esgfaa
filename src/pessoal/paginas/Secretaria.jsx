import { useNavigate } from 'react-router-dom'
import { useDados } from '../useDados'
import { Cabecalho, Carregando, Erro, Painel } from '../componentes/Ui'
import { dataHoraPt } from '../formatar'
import PedidosDespacho from '../componentes/PedidosDespacho'
import MeusDocumentos from '../componentes/MeusDocumentos'
import { useSessao } from '../sessao'

const COR = { urgente: 'bg-danger', confidencial: 'bg-dark', normal: 'bg-light text-dark border' }

// o que só avança com o Comandante: aqui (Sistema de Pessoal) e no painel de gestão (Sistema Académico e site)
const NO_PORTAL = [
  ['distribuicoes', 'Distribuição de serviço docente (docentes nas cadeiras de cada turma)'],
  ['notas', 'Publicação das notas (provas, exames, TAI/TAG)'],
  ['alteracoesNotas', 'Alteração de notas já publicadas'],
  ['homologacoes', 'Classificação final do curso (homologação)'],
  ['inqueritos', 'Inquéritos institucionais (avaliação dos docentes)'],
  ['avisos', 'Avisos gerais do portal aos estudantes'],
  ['docentesPorVerificar', 'Docentes por verificar'],
  ['site', 'Site: notícias, artigos, eventos, páginas…'],
  ['comentarios', 'Comentários dos visitantes do site'],
  ['contasPainel', 'Contas e papéis do painel de gestão'],
]

function OQueAprova({ dados }) {
  const { utilizador } = useSessao()
  const { dados: pedidos } = useDados('/pedidos-despacho', { estado: 'pendente' }, { tempoReal: true })
  const { dados: portal } = useDados('/secretaria/portal')
  const de = (re) => (pedidos ? pedidos.filter((x) => re.test(x.tipo)).length : null)
  const numero = (n) => (n === null || n === undefined ? <span className="text-muted">—</span> : n > 0 ? <span className="badge bg-danger">{n}</span> : <span className="badge bg-success">0</span>)
  const aqui = [
    ['Documentos do expediente submetidos a despacho', dados.pendentes.length],
    ['Propostas: promoção, graduação, nomeação, exoneração, progressão (civis), nomeação para curso', dados.propostas.pendentes.length],
    ['Docentes: novo docente, mudança de categoria, deixa de ser docente', de(/^docente_/)],
    ['Contas do sistema de Pessoal (militares e civis), papéis e permissões', de(/^utilizador_/)],
  ]
  return (
    <Painel titulo="O que o Comandante aprova" icone="fa-list-check" corpo={false}>
      <div className="table-responsive">
        <table className="table table-sm align-middle mb-0">
          <thead><tr><th>Sistema</th><th>O que aprova</th><th className="text-center">À espera</th><th>Onde decide</th></tr></thead>
          <tbody>
            {aqui.map(([o, n], i) => (
              <tr key={o}>{i === 0 && <td rowSpan={aqui.length} className="fw-bold">Pessoal e Quadros</td>}<td>{o}</td><td className="text-center">{numero(n)}</td><td className="small">Nesta página</td></tr>
            ))}
            {NO_PORTAL.map(([k, o], i) => (
              <tr key={k}>
                {i === 0 && <td rowSpan={NO_PORTAL.length} className="fw-bold">Académico e site<div className="small fw-normal text-muted">painel de gestão</div></td>}
                <td>{o}</td>
                <td className="text-center">{numero(portal?.ligado && !portal.erro ? portal[k] : null)}</td>
                <td className="small">{k === 'alteracoesNotas' ? 'Alterações de notas' : k === 'homologacoes' ? 'Conselho de Curso' : k === 'docentesPorVerificar' ? 'Docentes (verificação)' : 'Por aprovar'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="p-3 small border-top">
        {utilizador?.papel === 'comandante' && portal?.ligado && /@pessoal\.interno$/.test(utilizador.email ?? '') && (
          <div className="alert alert-warning py-2 mb-2">A sua conta não tem e-mail (só o NIP): não entra no painel de gestão. Peça ao administrador que lhe ponha o e-mail da Escola; a mesma conta e a mesma palavra-passe passam a valer nos dois sistemas.</div>
        )}
        {!portal && 'A perguntar ao portal…'}
        {portal && !portal.ligado && <span className="text-muted">O Sistema de Pessoal não está ligado ao portal: os números do painel não aparecem aqui.</span>}
        {portal?.erro && <span className="text-danger">{portal.erro}</span>}
        {portal?.ligado && !portal.erro && (portal.painel
          ? <>As decisões do Sistema Académico e do site tomam-se no painel de gestão, com a conta do Comandante: <a href={portal.painel} target="_blank" rel="noreferrer">abrir o painel <i className="fa fa-external-link-alt ms-1" /></a></>
          : 'As decisões do Sistema Académico e do site tomam-se no painel de gestão, com a conta do Comandante.')}
      </div>
    </Painel>
  )
}

/*
  Secretária digital do Comandante: os documentos do Expediente que as unidades lhe submetem a despacho
  (os urgentes primeiro, depois do mais antigo). Abre-se o documento (com os anexos) e despacha-se lá:
  Visto, Concordo, Autorizo, Indefiro… com o texto. Também as propostas (promoções, nomeações…) antes de seguirem para o
  escalão superior: abre-se a proposta e despacha-se «Autorizo o envio» ou «Devolvo para correção». E os pedidos que só valem
  com o seu despacho: docentes novos, categorias, saídas de docentes, contas e papéis do sistema. Em baixo, os últimos despachados.
*/
function Despacho() {
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
      <OQueAprova dados={dados} />
      <Painel titulo={`Por despachar (${dados.pendentes.length})`} icone="fa-stamp" corpo={false}>
        <div className="list-group list-group-flush">
          {dados.pendentes.map(linha)}
          {!dados.pendentes.length && <div className="list-group-item text-muted">Não há documentos à espera de despacho.</div>}
        </div>
      </Painel>
      <PedidosDespacho />
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

// a Secretária digital é de todas as contas (os documentos de cada um); quem despacha vê também o que está a despacho
function Secretaria() {
  const { ve } = useSessao()
  const despacha = ve('secretaria')
  return (
    <>
      <Cabecalho titulo="Secretária digital" subtitulo={despacha ? 'documentos a despacho do Comandante e os seus documentos' : 'os seus documentos, arrumados por pastas'} migalhas={[['Secretária digital']]} />
      {despacha && <Despacho />}
      <MeusDocumentos />
    </>
  )
}

export default Secretaria
