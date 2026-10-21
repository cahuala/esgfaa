import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useSessao } from '../sessao'
import { useDados } from '../useDados'
import Foto from '../componentes/Foto'
import Tabela from '../componentes/Tabela'
import { Cabecalho, Carregando, Erro, Painel } from '../componentes/Ui'

// empregadas(os) domiciliares dos oficiais superiores e generais (não contam como trabalhadores civis)
export default function Domiciliares() {
  const { pode } = useSessao()
  const navegar = useNavigate()
  const { dados, erro } = useDados('/domiciliares')
  const colunas = useMemo(() => [
    { chave: 'oficial', titulo: 'Oficial', valor: (o) => o.nome, ordenarPor: (o) => o.hierarquia ?? 100 - o.grau, mostrar: (o) => <span className="pes-pessoa"><Foto pessoaId={o.id} fotoId={o.fotoId} nome={o.nome} /><span><strong>{o.postoNome}</strong> {o.nome}<div className="small text-muted">NIP {o.nip} · {o.ramo}</div></span></span> },
    { chave: 'limite', titulo: 'Limite do posto', valor: (o) => o.limite, alinhar: 'center' },
    { chave: 'alocados', titulo: 'Afectas(os)', valor: (o) => o.alocados, alinhar: 'center' },
    { chave: 'livres', titulo: 'Livres', valor: (o) => o.livres, alinhar: 'center', mostrar: (o) => <span className={o.livres ? 'text-success fw-bold' : 'text-muted'}>{o.livres}</span> },
    { chave: 'dom', titulo: 'Empregadas(os) domiciliares', valor: (o) => o.domiciliares.map((d) => d.nome).join('; '), mostrar: (o) => o.domiciliares.map((d) => <Link key={d.id} to={`/pessoas/${d.id}`} onClick={(e) => e.stopPropagation()} className="pes-pessoa text-decoration-none mb-1"><Foto pessoaId={d.id} fotoId={d.fotoId} nome={d.nome} tamanho={28} /><span className="small">{d.nome}{d.telefone && <span className="text-muted"> · {d.telefone}</span>}</span></Link>) },
    ...(pode('editar') ? [{ chave: 'add', titulo: '', exportar: false, valor: () => '', mostrar: (o) => o.livres > 0 && <button type="button" className="btn btn-xs btn-outline-theme" onClick={(e) => { e.stopPropagation(); navegar(`/pessoas/nova?domiciliar=${o.id}`) }}><i className="fa fa-plus me-1" />Registar</button> }] : []),
  ], [pode, navegar])
  if (erro) return <Erro texto={erro} />
  if (!dados) return <Carregando />
  const total = dados.reduce((s, o) => s + o.alocados, 0)
  return (
    <>
      <Cabecalho titulo="Empregados domiciliares" subtitulo={`${total} afectas(os) a ${dados.filter((o) => o.alocados).length} oficiais`} migalhas={[['Organização'], ['Domiciliares']]} />
      <Painel>
        <p className="small text-muted"><i className="fa fa-info-circle me-1" />Empregadas(os) domésticas(os) afectas(os) aos oficiais superiores e generais, dentro do limite do posto: Major e Tenente-Coronel 1 · Coronel 2 · Brigadeiro e Tenente-General 3 · General 4. Não contam como trabalhadores civis da Escola.</p>
        <Tabela titulo="Empregados domiciliares por oficial" colunas={colunas} linhas={dados} aoClicar={(o) => navegar(`/pessoas/${o.id}`)} />
      </Painel>
    </>
  )
}
