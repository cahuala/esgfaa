import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api, textoDoPdf } from '../api'
import { useSessao } from '../sessao'
import { useDados } from '../useDados'
import Tabela from '../componentes/Tabela'
import { Cabecalho, Campo, Carregando, Erro, Escolha, Estado, Modal, Painel } from '../componentes/Ui'
import { dataPt } from '../formatar'

// extractos de ordem recebidos (promoção, nomeação, reforma…); daqui actualizam-se as fichas e os processos
export default function Extractos() {
  const { pode } = useSessao()
  const navegar = useNavigate()
  const [params] = useSearchParams()
  const { dados, erro } = useDados('/extractos')
  const [novo, setNovo] = useState(params.get('proposta') ? { propostaId: params.get('proposta'), tipo: params.get('tipo') } : null)
  const colunas = useMemo(() => [
    { chave: 'data', titulo: 'Data', valor: (e) => e.data, mostrar: (e) => dataPt(e.data) },
    { chave: 'numero', titulo: 'Extracto n.º', valor: (e) => e.numero, mostrar: (e) => <strong>{e.numero}</strong> },
    { chave: 'tipo', titulo: 'Tipo', valor: (e) => e.tipoNome },
    { chave: 'entidade', titulo: 'Entidade', valor: (e) => e.entidade },
    { chave: 'pessoas', titulo: 'Abrange', valor: (e) => e.pessoas, alinhar: 'end' },
    { chave: 'estado', titulo: 'Estado', valor: (e) => (e.estado === 'aplicado' ? 'Aplicado às fichas' : 'Por aplicar'), mostrar: (e) => <Estado estado={e.estado === 'aplicado' ? 'aprovada' : 'enviada'} texto={e.estado === 'aplicado' ? 'Aplicado às fichas' : 'Por aplicar'} /> },
  ], [])
  if (erro) return <Erro texto={erro} />
  return (
    <>
      <Cabecalho titulo="Extractos" subtitulo="promoções, nomeações e reformas que chegam do escalão superior" migalhas={[['Carreiras'], ['Extractos']]}>
        {pode('editar') && <button type="button" className="btn btn-theme" onClick={() => setNovo({})}><i className="fa fa-file-upload me-1" />Registar extracto</button>}
      </Cabecalho>
      <Painel>
        <p className="small text-muted"><i className="fa fa-info-circle me-1" />Carregue o extracto digitalizado (PDF). O sistema procura no texto os militares (pelo NIP e pelo nome) e junta os da proposta enviada; confirme a lista e aplique: as fichas mudam, fica no histórico e o extracto é anexado ao processo individual de cada um.</p>
        {!dados ? <Carregando /> : <Tabela titulo="Extractos recebidos" colunas={colunas} linhas={dados} aoClicar={(e) => navegar(`/extractos/${e.id}`)} />}
      </Painel>
      {novo && <NovoExtracto inicial={novo} aoFechar={() => setNovo(null)} aoCriar={(e) => navegar(`/extractos/${e.id}`)} />}
    </>
  )
}

function NovoExtracto({ inicial, aoFechar, aoCriar }) {
  const { ref } = useSessao()
  const { dados: propostas } = useDados('/propostas', { estado: 'enviada' })
  const [d, setD] = useState({ tipo: inicial.tipo || 'promocao', numero: '', data: new Date().toISOString().slice(0, 10), entidade: '', propostaId: inicial.propostaId ?? '' })
  const [ficheiro, setFicheiro] = useState(null)
  const [texto, setTexto] = useState('')
  const [estado, setEstado] = useState('')
  const [erro, setErro] = useState('')
  async function escolher(f) {
    setFicheiro(f)
    setTexto('')
    if (f?.type === 'application/pdf') {
      setEstado('A ler o texto do PDF…')
      try {
        const t = await textoDoPdf(f)
        setTexto(t)
        setEstado(t.trim() ? `Texto lido (${t.length} caracteres): o sistema vai procurar os militares.` : 'O PDF é uma digitalização sem texto: junte as pessoas à mão (ou escolha a proposta).')
      } catch {
        setEstado('Não foi possível ler o texto do PDF.')
      }
    } else setEstado(f ? 'Imagem: junte as pessoas à mão (ou escolha a proposta).' : '')
  }
  async function criar() {
    setErro('')
    const fd = new FormData()
    for (const [k, v] of Object.entries(d)) fd.append(k, v ?? '')
    fd.append('texto', texto)
    if (ficheiro) fd.append('ficheiro', ficheiro)
    try { aoCriar(await api('/extractos', { metodo: 'POST', formulario: fd })) } catch (e) { setErro(e.message) }
  }
  return (
    <Modal titulo="Registar extracto" aoFechar={aoFechar} rodape={<><button type="button" className="btn btn-light" onClick={aoFechar}>Cancelar</button><button type="button" className="btn btn-theme" onClick={criar} disabled={!d.numero || !d.data}><i className="fa fa-check me-1" />Registar e procurar os militares</button></>}>
      {erro && <div className="alert alert-danger">{erro}</div>}
      <div className="row">
        <Campo rotulo="Tipo" obrigatorio col="col-md-4"><Escolha valor={d.tipo} aoMudar={(v) => setD({ ...d, tipo: v })} opcoes={ref.tiposExtracto} vazio={null} /></Campo>
        <Campo rotulo="N.º do extracto / ordem" obrigatorio col="col-md-4"><input className="form-control form-control-sm" placeholder="Ex.: 45/CEMG/2026" value={d.numero} onChange={(e) => setD({ ...d, numero: e.target.value })} /></Campo>
        <Campo rotulo="Data" obrigatorio col="col-md-4" ajuda="Conta como data de antiguidade no posto."><input type="date" className="form-control form-control-sm" value={d.data} onChange={(e) => setD({ ...d, data: e.target.value })} /></Campo>
        <Campo rotulo="Entidade" col="col-md-6"><input className="form-control form-control-sm" placeholder="Ex.: Chefe do Estado-Maior General das FAA" value={d.entidade} onChange={(e) => setD({ ...d, entidade: e.target.value })} /></Campo>
        <Campo rotulo="Resposta à proposta (opcional)" col="col-md-6"><Escolha valor={String(d.propostaId ?? '')} aoMudar={(v) => setD({ ...d, propostaId: v })} opcoes={(propostas ?? []).map((p) => [String(p.id), `N.º ${p.id} — ${p.titulo}`])} vazio="Nenhuma" /></Campo>
        <Campo rotulo="Extracto digitalizado (PDF ou imagem)" col="col-12" ajuda={estado}><input type="file" className="form-control form-control-sm" accept="application/pdf,image/*" onChange={(e) => escolher(e.target.files[0])} /></Campo>
      </div>
    </Modal>
  )
}
