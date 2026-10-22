import { useEffect, useState } from 'react'
import { api } from '../api'
import { useSessao } from '../sessao'
import EscolherPessoa from './EscolherPessoa'
import { Campo, Condicoes, Escolha, Modal } from './Ui'
import Anexo from './Anexo'
import { juntarAoProcesso } from '../anexos'

const CIVIS = ['ferias', 'doenca', 'parto', 'nascimento_filho', 'casamento', 'luto', 'estudos', 'sem_vencimento']

// registo de uma licença: mostra as condições da lei antes de gravar (arts. 31.º a 41.º)
export default function NovaLicenca({ pessoa: inicial, aoFechar, aoGuardar }) {
  const { ref, avisar } = useSessao()
  const [ficheiro, setFicheiro] = useState(null)
  const [pessoa, setPessoa] = useState(inicial ?? null)
  const [d, setD] = useState({ tipo: 'ferias', inicio: '', fim: '', despacho: '', observacoes: '' })
  const [verificacao, setVerificacao] = useState(null)
  const [erro, setErro] = useState('')
  const pronto = pessoa && d.tipo && d.inicio && d.fim
  useEffect(() => {
    if (!pronto) return undefined
    const t = setTimeout(() => api('/licencas/verificar', { metodo: 'POST', corpo: { pessoaId: pessoa.id, ...d } }).then(setVerificacao).catch((e) => setVerificacao({ erro: e.message })), 300)
    return () => clearTimeout(t)
  }, [pronto, pessoa, d])
  const tipos = Object.entries(ref.tiposLicenca).filter(([k]) => (pessoa?.tipo === 'civil' ? CIVIS.includes(k) : k !== 'sem_vencimento'))

  async function guardar() {
    setErro('')
    try {
      await api('/licencas', { metodo: 'POST', corpo: { pessoaId: pessoa.id, ...d } })
    } catch (e) {
      setErro(e.message)
      return
    }
    await juntarAoProcesso(pessoa.id, ficheiro, { tipo: d.tipo === 'doenca' ? 'saude' : 'outro', titulo: `Licença (${ref.tiposLicenca[d.tipo] ?? d.tipo})${d.despacho ? ` — ${d.despacho}` : ''}`, data: d.inicio }).catch((e) => avisar(`Licença registada, mas o documento não foi enviado: ${e.message}`, 'erro'))
    aoGuardar()
  }
  return (
    <Modal titulo="Registar licença" aoFechar={aoFechar} rodape={<><button type="button" className="btn btn-outline-secondary" onClick={aoFechar}>Cancelar</button><button type="button" className="btn btn-theme" onClick={guardar} disabled={!pronto || !verificacao?.possivel}><i className="fa fa-check me-1" />Registar</button></>}>
      {erro && <div className="alert alert-danger">{erro}</div>}
      <div className="row">
        <Campo rotulo="Pessoa" obrigatorio col="col-12">
          {pessoa ? <div className="d-flex align-items-center gap-2"><strong>{pessoa.postoAbreviatura ? `${pessoa.postoAbreviatura} ` : ''}{pessoa.nome}</strong>{!inicial && <button type="button" className="btn btn-xs btn-secondary" onClick={() => setPessoa(null)}>mudar</button>}</div> : <EscolherPessoa aoEscolher={setPessoa} />}
        </Campo>
        <Campo rotulo="Tipo" obrigatorio col="col-md-4"><Escolha valor={d.tipo} aoMudar={(v) => setD({ ...d, tipo: v })} opcoes={tipos} vazio={null} /></Campo>
        <Campo rotulo="Início" obrigatorio col="col-md-4"><input type="date" className="form-control form-control-sm" value={d.inicio} onChange={(e) => setD({ ...d, inicio: e.target.value })} /></Campo>
        <Campo rotulo="Fim" obrigatorio col="col-md-4"><input type="date" className="form-control form-control-sm" value={d.fim} min={d.inicio} onChange={(e) => setD({ ...d, fim: e.target.value })} /></Campo>
        <Campo rotulo="Despacho / documento"><input className="form-control form-control-sm" value={d.despacho} onChange={(e) => setD({ ...d, despacho: e.target.value })} /></Campo>
        <Campo rotulo="Observações"><input className="form-control form-control-sm" value={d.observacoes} onChange={(e) => setD({ ...d, observacoes: e.target.value })} /></Campo>
        <Campo rotulo="Despacho / documento digitalizado" col="col-12"><Anexo ficheiro={ficheiro} aoMudar={setFicheiro} /></Campo>
      </div>
      {pronto && verificacao && (verificacao.erro ? <div className="alert alert-warning mb-0">{verificacao.erro}</div> : (
        <div className={`alert ${verificacao.possivel ? 'alert-success' : 'alert-danger'} mb-0`}>
          <strong>{verificacao.possivel ? `Pode ser concedida (${verificacao.dias} dias).` : 'Não pode ser concedida:'}</strong>
          <Condicoes condicoes={verificacao.condicoes} />
        </div>
      ))}
    </Modal>
  )
}
