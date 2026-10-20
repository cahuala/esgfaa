import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDados } from '../useDados'
import { Cabecalho, Carregando, Erro } from '../componentes/Ui'
import Tabela from '../componentes/Tabela'
import Foto from '../componentes/Foto'
import { documentoPdf } from '../exportar'
import { dataPt } from '../formatar'

const iso = (v) => (v ? String(v).slice(0, 10) : '')
// entrada na Escola: a data escrita; sem ela, a do cargo, a da admissão ou a do registo no sistema
const entrada = (p) => iso(p.dataEntradaEscola || p.dataCargo || p.dataAdmissao || p.criadoEm)

/*
  Histórico dos efectivos da Escola: todos os que serviram e servem na ESG (militares e civis), quando
  entraram e, os que já saíram, quando, porquê e para onde. As fichas de quem saiu ficam guardadas.
*/
export default function HistoricoEfectivos() {
  const navegar = useNavigate()
  const [estado, setEstado] = useState('todos')
  const [tipo, setTipo] = useState('')
  const [ano, setAno] = useState('')
  const { dados, erro, recarregar } = useDados('/pessoas', { ativo: 'todos', ...(tipo ? { tipo } : {}) })
  if (erro) return <Erro texto={erro} aoRepetir={recarregar} />
  if (!dados) return <Carregando />

  const saiu = (p) => !p.ativo
  const linhas = dados
    .filter((p) => (estado === 'todos' ? true : estado === 'saiu' ? saiu(p) : !saiu(p)))
    .filter((p) => !ano || (saiu(p) ? iso(p.dataSaidaEscola).startsWith(ano) : false) || entrada(p).startsWith(ano))
    .sort((a, b) => (iso(b.dataSaidaEscola) || '9999').localeCompare(iso(a.dataSaidaEscola) || '9999') || a.nome.localeCompare(b.nome))
  const anos = [...new Set(dados.flatMap((p) => [entrada(p).slice(0, 4), iso(p.dataSaidaEscola).slice(0, 4)]).filter(Boolean))].sort().reverse()
  const nSairam = dados.filter(saiu).length

  const colunas = [
    { chave: 'nome', titulo: 'Militar / funcionário', valor: (p) => p.nome, mostrar: (p) => <span className="pes-pessoa"><Foto pessoaId={p.id} fotoId={p.fotoId} nome={p.nome} tamanho={28} /><span><span className="fw-semibold">{p.nome}</span><br /><small className="text-muted">{[p.tipo === 'militar' ? p.postoNome : p.categoriaCivil || 'Civil', p.nip || p.numeroAgente].filter(Boolean).join(' · ')}</small></span></span> },
    { chave: 'funcoes', titulo: 'Funções na Escola', valor: (p) => p.vinculoNome },
    { chave: 'cargo', titulo: 'Cargo', valor: (p) => p.cargoNome || '' },
    { chave: 'entrada', titulo: 'Entrada', valor: entrada, mostrar: (p) => dataPt(entrada(p)) },
    { chave: 'saida', titulo: 'Saída', valor: (p) => iso(p.dataSaidaEscola), mostrar: (p) => (saiu(p) ? dataPt(p.dataSaidaEscola) : <span className="badge bg-success">Na Escola</span>) },
    { chave: 'motivo', titulo: 'Motivo da saída', valor: (p) => p.motivoSaida || '' },
    { chave: 'destino', titulo: 'Destino', valor: (p) => p.destinoSaida || '' },
  ]
  const pdf = () => documentoPdf({
    titulo: 'Histórico dos efectivos da Escola Superior de Guerra', orientacao: 'landscape',
    subtitulo: [{ todos: 'Todos', saiu: 'Já saíram da Escola', escola: 'Na Escola' }[estado], tipo && { militar: 'Militares', civil: 'Civis' }[tipo], ano && `Ano ${ano}`].filter(Boolean).join(' · '),
    seccoes: [{ colunas: [{ titulo: 'N/O', valor: (_, i) => String(i + 1).padStart(2, '0'), alinhar: 'center', largura: 11 }, { titulo: 'Posto / categoria', valor: (p) => (p.tipo === 'militar' ? p.postoNome : p.categoriaCivil || 'Civil') }, { titulo: 'Nome', valor: (p) => p.nome }, { titulo: 'NIP / N.º agente', valor: (p) => p.nip || p.numeroAgente || '' }, { titulo: 'Funções', valor: (p) => p.vinculoNome }, { titulo: 'Entrada', valor: (p) => dataPt(entrada(p)), alinhar: 'center' }, { titulo: 'Saída', valor: (p) => (saiu(p) ? dataPt(p.dataSaidaEscola) : 'Na Escola'), alinhar: 'center' }, { titulo: 'Motivo / destino', valor: (p) => [p.motivoSaida, p.destinoSaida].filter(Boolean).join(' — ') }], linhas }],
  })

  return (
    <>
      <Cabecalho titulo={<><i className="fa fa-archive me-2 pes-ouro" />Histórico dos efectivos</>} subtitulo={`${dados.length} que serviram na Escola · ${nSairam} já saíram`} migalhas={[['Pessoal', '/pessoas'], ['Histórico dos efectivos']]}>
        <button type="button" className="btn btn-white" onClick={pdf}><i className="fa fa-file-pdf me-1 text-danger" />PDF</button>
      </Cabecalho>
      <div className="card mb-3"><div className="card-body py-2 d-flex flex-wrap gap-2 align-items-center">
        <div className="btn-group btn-group-sm" role="group" aria-label="Estado">
          {[['todos', 'Todos'], ['escola', 'Na Escola'], ['saiu', 'Já saíram']].map(([k, t]) => <button key={k} type="button" className={`btn ${estado === k ? 'btn-theme' : 'btn-white'}`} onClick={() => setEstado(k)}>{t}</button>)}
        </div>
        <select className="form-select form-select-sm w-auto" value={tipo} onChange={(e) => setTipo(e.target.value)} aria-label="Pessoal"><option value="">Militares e civis</option><option value="militar">Militares</option><option value="civil">Civis</option></select>
        <select className="form-select form-select-sm w-auto" value={ano} onChange={(e) => setAno(e.target.value)} aria-label="Ano"><option value="">Todos os anos</option>{anos.map((a) => <option key={a}>{a}</option>)}</select>
      </div></div>
      <div className="card"><div className="card-body">
        <Tabela titulo="Histórico dos efectivos" linhas={linhas} colunas={colunas} aoClicar={(p) => navegar(`/pessoas/${p.id}`)} vazio="Ninguém com estes critérios." />
      </div></div>
      <p className="small text-muted mt-2">Quando alguém deixa a Escola (na ficha: «Já não serve na Escola»), a ficha fica guardada com a data, o motivo e o destino da saída, e entra no histórico da carreira. Se voltar, basta reactivá-la.</p>
    </>
  )
}
