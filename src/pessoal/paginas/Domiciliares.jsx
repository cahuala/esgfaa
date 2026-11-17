import { useMemo, useState } from 'react'
import { api } from '../api'
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
      <Todas />
    </>
  )
}

/*
  Todas as empregadas(os) domiciliares, com o oficial de cada uma: as que estão sem oficial (p. ex. importadas de uma
  relação em que o oficial ainda não estava no sistema) ligam-se aqui, escrevendo o NIP do oficial.
*/
function Todas() {
  const { pode, avisar } = useSessao()
  const { dados, erro, recarregar } = useDados('/domiciliares/todas')
  const [nips, setNips] = useState({})
  const [so, setSo] = useState(true)
  if (erro) return <Erro texto={erro} />
  if (!dados) return <Carregando />
  const semOficial = dados.filter((x) => !x.oficial)
  const lista = so && semOficial.length ? semOficial : dados
  const ligar = (x) => api(`/domiciliares/${x.id}/oficial`, { metodo: 'PUT', corpo: { nip: nips[x.id] ?? '' } })
    .then((r) => { avisar(`${x.nome} ligada(o) a ${r.oficial.nome}.`); setNips({ ...nips, [x.id]: '' }); recarregar() })
    .catch((e) => avisar(e.message, 'erro'))
  return (
    <Painel titulo={`Todas as empregadas(os) domiciliares (${dados.length})${semOficial.length ? ` — ${semOficial.length} sem oficial` : ''}`} icone="fa-link">
      {semOficial.length > 0 && (
        <div className="d-flex gap-2 mb-2">
          <button type="button" className={`btn btn-sm ${so ? 'btn-theme' : 'btn-white'}`} onClick={() => setSo(true)}>Sem oficial ({semOficial.length})</button>
          <button type="button" className={`btn btn-sm ${!so ? 'btn-theme' : 'btn-white'}`} onClick={() => setSo(false)}>Todas ({dados.length})</button>
        </div>
      )}
      <div className="table-responsive">
        <table className="table table-sm align-middle mb-0">
          <thead><tr><th>Nome</th><th>Oficial</th>{pode('editar') && <th style={{ minWidth: 260 }}>Ligar ao oficial (NIP)</th>}</tr></thead>
          <tbody>
            {lista.map((x) => (
              <tr key={x.id}>
                <td><Link to={`/pessoas/${x.id}`}>{x.nome}</Link></td>
                <td>{x.oficial ? <>{x.oficial.postoNome} {x.oficial.nome} <span className="small text-muted">NIP {x.oficial.nip}</span></> : <span className="badge bg-warning text-dark">Sem oficial</span>}</td>
                {pode('editar') && (
                  <td>
                    <div className="d-flex gap-1">
                      <input className="form-control form-control-sm" style={{ maxWidth: 150 }} placeholder="NIP do oficial" value={nips[x.id] ?? ''} onChange={(e) => setNips({ ...nips, [x.id]: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter' && nips[x.id]) ligar(x) }} aria-label={`NIP do oficial de ${x.nome}`} />
                      <button type="button" className="btn btn-sm btn-theme" disabled={!nips[x.id]} onClick={() => ligar(x)}><i className="fa fa-link me-1" />Ligar</button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {!lista.length && <tr><td colSpan={3} className="text-muted">Não há empregadas(os) domiciliares.</td></tr>}
          </tbody>
        </table>
      </div>
    </Painel>
  )
}
