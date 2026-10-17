import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useDados } from '../useDados'
import { useSessao } from '../sessao'
import Tabela from '../componentes/Tabela'
import { Cabecalho, Carregando, Erro, Painel } from '../componentes/Ui'
import { anos } from '../formatar'

// quem está em condições de promoção (militares) ou de progressão (civis), segundo a lei; daqui faz-se a proposta
export default function Elegiveis() {
  const { pode, avisar } = useSessao()
  const navegar = useNavigate()
  const [tipo, setTipo] = useState('militar')
  const [so, setSo] = useState(true)
  const consulta = useMemo(() => ({ tipo }), [tipo])
  const { dados: linhas, erro } = useDados('/carreira/elegiveis', consulta)
  const [marcados, setMarcados] = useState([])
  const mudarTipo = (t) => { setTipo(t); setMarcados([]) }
  const visiveis = useMemo(() => (linhas ?? []).filter((l) => !so || l.elegivel), [linhas, so])
  const marcar = (id) => setMarcados((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]))

  async function propor() {
    try {
      const r = await api('/propostas', { metodo: 'POST', corpo: { tipo: tipo === 'militar' ? 'promocao' : 'progressao', titulo: `${tipo === 'militar' ? 'Promoções' : 'Progressões'} — ${new Date().toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })}`, itens: marcados.map((pessoaId) => ({ pessoaId })) } })
      navegar(`/propostas/${r.id}`)
    } catch (e) {
      avisar(e.message, 'erro')
    }
  }

  const colunas = useMemo(() => [
    { chave: 'sel', titulo: '', exportar: false, valor: () => '', mostrar: (l) => (l.elegivel && !l.emProposta && pode('propor') ? <input type="checkbox" className="form-check-input" checked={marcados.includes(l.id)} onClick={(e) => e.stopPropagation()} onChange={() => marcar(l.id)} aria-label={`Escolher ${l.nome}`} /> : null) },
    { chave: 'ident', titulo: 'NIP / N.º', valor: (l) => l.nip || l.numeroAgente || '' },
    { chave: 'nome', titulo: 'Nome', valor: (l) => l.nome, mostrar: (l) => <strong>{l.nome}</strong> },
    { chave: 'atual', titulo: tipo === 'militar' ? 'Posto' : 'Categoria', valor: (l) => l.postoNome || l.categoriaCivil },
    ...(tipo === 'militar' ? [{ chave: 'ramo', titulo: 'Ramo', valor: (l) => l.ramo }] : []),
    { chave: 'proposto', titulo: 'Para', valor: (l) => l.proposto, mostrar: (l) => <strong className="text-success">{l.proposto}</strong> },
    ...(tipo === 'militar' ? [{ chave: 'mod', titulo: 'Modalidade', valor: (l) => ({ diuturnidade: 'Diuturnidade', antiguidade: 'Antiguidade', escolha: 'Escolha' }[l.modalidade] ?? '') }] : []),
    { chave: 'tempo', titulo: 'No posto', valor: (l) => l.tempoNoPosto, mostrar: (l) => anos(l.tempoNoPosto), alinhar: 'end' },
    { chave: 'unidade', titulo: 'Unidade', valor: (l) => l.unidadeNome },
    { chave: 'estado', titulo: 'Situação', valor: (l) => (l.elegivel ? (l.emProposta ? 'Já em proposta' : 'Em condições') : `Falta: ${l.faltas.join('; ')}`), mostrar: (l) => (l.elegivel ? (l.emProposta ? <span className="badge bg-info">Já em proposta</span> : <span className="badge bg-success">Em condições</span>) : <span className="small text-danger">{l.faltas.join('; ')}</span>) },
    { chave: 'confirmar', titulo: 'A confirmar', valor: (l) => l.confirmar.join('; '), mostrar: (l) => <span className="small text-muted">{l.confirmar.join('; ')}</span> },
  ], [tipo, marcados, pode])

  return (
    <>
      <Cabecalho titulo="Em condições de promoção" subtitulo="verificação automática da Lei n.º 13/18" migalhas={[['Carreiras'], ['Em condições de promoção']]}>
        {marcados.length > 0 && <button type="button" className="btn btn-theme" onClick={propor}><i className="fa fa-file-signature me-1" />Propor os {marcados.length} escolhidos</button>}
      </Cabecalho>
      <Painel>
        <div className="d-flex flex-wrap gap-3 align-items-center mb-2">
          <div className="btn-group">
            <button type="button" className={`btn btn-sm ${tipo === 'militar' ? 'btn-theme' : 'btn-outline-secondary'}`} onClick={() => mudarTipo('militar')}>Militares (promoção)</button>
            <button type="button" className={`btn btn-sm ${tipo === 'civil' ? 'btn-theme' : 'btn-outline-secondary'}`} onClick={() => mudarTipo('civil')}>Civis (progressão)</button>
          </div>
          <label className="form-check mb-0"><input type="checkbox" className="form-check-input" checked={so} onChange={(e) => setSo(e.target.checked)} /> <span className="form-check-label">Só quem cumpre</span></label>
          <span className="small text-muted"><i className="fa fa-info-circle me-1" />A existência de vaga no quadro especial confirma-se no despacho.</span>
        </div>
        {erro && <Erro texto={erro} />}
        {!linhas ? <Carregando /> : <Tabela titulo={tipo === 'militar' ? 'Militares em condições de promoção' : 'Civis em condições de progressão'} colunas={colunas} linhas={visiveis} aoClicar={(l) => navegar(`/pessoas/${l.id}`)} />}
      </Painel>
    </>
  )
}
