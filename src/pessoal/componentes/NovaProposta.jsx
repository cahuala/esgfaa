import { useEffect, useState } from 'react'
import { api } from '../api'
import { useSessao } from '../sessao'
import { Campo, Escolha, Modal } from './Ui'

/*
  Nova proposta (promoção, graduação, nomeação, exoneração ou progressão). Com pessoa, já entra com ela;
  sem pessoa, as pessoas juntam-se depois na página da proposta.
*/
export default function NovaProposta({ pessoa, aoFechar, aoCriar, tipoInicial }) {
  const { ref } = useSessao()
  const tipos = Object.entries(ref.tiposProposta).filter(([, v]) => !pessoa || v.pessoal === 'ambos' || v.pessoal === pessoa.tipo)
  const [tipo, setTipo] = useState(tipoInicial ?? tipos[0][0])
  const [titulo, setTitulo] = useState('')
  const [fundamentacao, setFundamentacao] = useState('')
  const [item, setItem] = useState({})
  const [cargos, setCargos] = useState([])
  const [erro, setErro] = useState('')
  const [aGuardar, setAGuardar] = useState(false)
  useEffect(() => { if (tipo === 'nomeacao') api('/cargos').then(setCargos).catch(() => {}) }, [tipo])

  const postos = pessoa?.ramo ? ref.postos[pessoa.ramo].filter((p) => p.grau > pessoa.grau && p.grau <= pessoa.grau + 2) : []
  const sugestao = pessoa ? `${ref.tiposProposta[tipo].nome} — ${pessoa.tipo === 'militar' ? `${pessoa.postoAbreviatura} ` : ''}${pessoa.nome}` : ''

  async function criar() {
    setErro('')
    setAGuardar(true)
    try {
      const r = await api('/propostas', { metodo: 'POST', corpo: { tipo, titulo: titulo || sugestao || `${ref.tiposProposta[tipo].nome} — ${new Date().toLocaleDateString('pt-PT')}`, fundamentacao, itens: pessoa ? [{ pessoaId: pessoa.id, ...item }] : [] } })
      aoCriar(r)
    } catch (e) {
      setErro(e.message)
      setAGuardar(false)
    }
  }
  const mudar = (k) => (v) => setItem({ ...item, [k]: v?.target ? v.target.value : v })

  return (
    <Modal titulo={pessoa ? `Nova proposta para ${pessoa.nome}` : 'Nova proposta'} aoFechar={aoFechar} rodape={<><button type="button" className="btn btn-light" onClick={aoFechar}>Cancelar</button><button type="button" className="btn btn-theme" onClick={criar} disabled={aGuardar}><i className="fa fa-check me-1" />Criar proposta</button></>}>
      {erro && <div className="alert alert-danger">{erro}</div>}
      <div className="row">
        <Campo rotulo="Tipo de proposta" obrigatorio><Escolha valor={tipo} aoMudar={(v) => { setTipo(v); setItem({}) }} opcoes={tipos} vazio={null} /></Campo>
        <Campo rotulo="Título"><input className="form-control form-control-sm" placeholder={sugestao || 'Ex.: Promoções de Novembro de 2026'} value={titulo} onChange={(e) => setTitulo(e.target.value)} /></Campo>
        {pessoa && tipo === 'promocao' && (
          <Campo rotulo="Modalidade" ajuda="Vazio: a da lei para o posto (art. 98.º). Distinção e título excepcional dispensam as condições (arts. 57.º e 58.º).">
            <Escolha valor={item.modalidade} aoMudar={mudar('modalidade')} opcoes={{ distincao: 'Distinção', excepcional: 'Título excepcional' }} vazio="A da lei" />
          </Campo>
        )}
        {pessoa && tipo === 'graduacao' && (
          <>
            <Campo rotulo="Graduado no posto de" obrigatorio ajuda="Até 2 graus acima (art. 65.º)."><Escolha valor={item.postoProposto} aoMudar={mudar('postoProposto')} opcoes={postos.map((p) => [p.id, p.nome])} /></Campo>
            <Campo rotulo="Início" col="col-md-3"><input type="date" className="form-control form-control-sm" value={item.inicio ?? ''} onChange={mudar('inicio')} /></Campo>
            <Campo rotulo="Fim" col="col-md-3"><input type="date" className="form-control form-control-sm" value={item.fim ?? ''} onChange={mudar('fim')} /></Campo>
          </>
        )}
        {pessoa && tipo === 'nomeacao' && (
          <>
            <Campo rotulo="Cargo" obrigatorio col="col-12"><Escolha valor={item.cargoId} aoMudar={(v) => setItem({ ...item, cargoId: v ? Number(v) : undefined })} opcoes={cargos.map((c) => [c.id, `${c.nome}${c.unidadeNome ? ` — ${c.unidadeNome}` : ''}${c.postoRequeridoNome ? ` (${c.postoRequeridoNome})` : ''} · ${c.livres} livre(s)`])} /></Campo>
            <Campo rotulo="Início" col="col-md-3"><input type="date" className="form-control form-control-sm" value={item.inicio ?? ''} onChange={mudar('inicio')} /></Campo>
            <Campo rotulo="Fim (se temporária)" col="col-md-3" ajuda="Cargo de posto superior: até 6 meses (art. 20.º)."><input type="date" className="form-control form-control-sm" value={item.fim ?? ''} onChange={mudar('fim')} /></Campo>
          </>
        )}
        {pessoa && <Campo rotulo="Justificação" col="col-12"><textarea className="form-control form-control-sm" rows={2} value={item.justificacao ?? ''} onChange={mudar('justificacao')} /></Campo>}
        <Campo rotulo="Fundamentação da proposta" col="col-12"><textarea className="form-control form-control-sm" rows={3} value={fundamentacao} onChange={(e) => setFundamentacao(e.target.value)} placeholder="Texto que acompanha a proposta (aparece nas fichas de proposta)." /></Campo>
      </div>
      <p className="small text-muted mb-0"><i className="fa fa-balance-scale me-1" />O sistema verifica as condições da Lei n.º 13/18 para cada pessoa; quem não as cumpre não segue para o escalão superior.</p>
    </Modal>
  )
}
