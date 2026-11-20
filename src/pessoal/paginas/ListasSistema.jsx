import { useState } from 'react'
import { api } from '../api'
import { useSessao } from '../sessao'
import { useDados } from '../useDados'
import { Cabecalho, Carregando, Erro, Painel } from '../componentes/Ui'

// o código de uma entrada nova a partir do nome: «Escola Prática» -> escola_pratica
const codigoDe = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 30)

/*
  Administração › Listas do sistema: TODAS as listas de escolha do sistema, sem programador.
  - as da Escola (províncias, especialidades, habilitações, bancos, tipos de documento…): acrescentam-se, tiram-se,
    mudam de nome e de ordem;
  - as da lei e as que o sistema usa com regras (postos, ramos, situações, licenças, carreiras…): só mudam de
    NOME; o nome novo vale em todo o sistema, também nos documentos.
*/
export default function ListasSistema() {
  const { pode, avisar, recarregar: recarregarSessao } = useSessao()
  const { dados, erro, recarregar } = useDados('/listas')
  const [escolhida, setEscolhida] = useState(null)
  const [edicao, setEdicao] = useState(null)
  const [novo, setNovo] = useState({ codigo: '', nome: '' })
  const [aGravar, setAGravar] = useState(false)
  const [procura, setProcura] = useState('')
  const admin = pode('administrar')
  if (erro) return <Erro texto={erro} aoRepetir={recarregar} />
  if (!dados) return <Carregando />

  const lista = dados.find((l) => l.id === (escolhida ?? dados[0].id))
  // o que está a ser editado: lista de [código, nome] (nas de texto, o código é o próprio nome)
  const linhas = edicao ?? (lista.chaves ? Object.entries(lista.valor) : lista.valor.map((v) => [v, v]))
  const mudou = edicao !== null
  const sem = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const visiveis = dados.filter((l) => !procura || sem(`${l.grupo} ${l.nome} ${Object.values(l.valor).join(' ')}`).includes(sem(procura)))
  const grupos = [...new Set(visiveis.map((l) => l.grupo))]
  const escolher = (id) => { if (mudou && !window.confirm('Há alterações por guardar nesta lista. Deixar sem guardar?')) return; setEscolhida(id); setEdicao(null); setNovo({ codigo: '', nome: '' }) }
  const mudar = (i, nome) => setEdicao(linhas.map((l, j) => (j === i ? [lista.chaves ? l[0] : nome, nome] : l)))
  const tirar = (i) => setEdicao(linhas.filter((_, j) => j !== i))
  const mover = (i, d) => { const l = [...linhas]; [l[i], l[i + d]] = [l[i + d], l[i]]; setEdicao(l) }
  function acrescentar(e) {
    e.preventDefault()
    const nome = novo.nome.trim()
    if (!nome) return
    const codigo = lista.chaves ? (novo.codigo.trim() || codigoDe(nome)) : nome
    if (linhas.some(([k, v]) => k.toLowerCase() === codigo.toLowerCase() || v.toLowerCase() === nome.toLowerCase())) return avisar(`«${nome}» já está na lista.`, 'erro')
    setEdicao([...linhas, [codigo, nome]])
    setNovo({ codigo: '', nome: '' })
  }
  async function guardar() {
    setAGravar(true)
    try {
      const valor = lista.chaves ? Object.fromEntries(linhas) : linhas.map(([, v]) => v)
      await api(`/listas/${lista.id}`, { metodo: 'PUT', corpo: { valor } })
      setEdicao(null)
      recarregar()
      recarregarSessao() // os formulários passam a usar a lista nova
      avisar(`${lista.nome}: guardada.`)
    } catch (x) {
      avisar(x.message, 'erro')
    } finally {
      setAGravar(false)
    }
  }
  async function repor() {
    if (!window.confirm(`Voltar «${lista.nome}» à lista de origem? As entradas acrescentadas saem da lista (as fichas que já as têm ficam como estão).`)) return
    try {
      await api(`/listas/${lista.id}/repor`, { metodo: 'POST' })
      setEdicao(null)
      recarregar()
      recarregarSessao()
      avisar(`${lista.nome}: reposta a de origem.`)
    } catch (x) {
      avisar(x.message, 'erro')
    }
  }

  return (
    <>
      <Cabecalho titulo="Listas do sistema" subtitulo="todas as listas de escolha do sistema" migalhas={[['Administração'], ['Listas do sistema']]} />
      <div className="row g-3">
        <div className="col-lg-4">
          <Painel titulo="Listas" icone="fa-folder-open">
            <input type="search" className="form-control form-control-sm mb-2" placeholder="Procurar lista ou entrada…" value={procura} onChange={(e) => setProcura(e.target.value)} aria-label="Procurar lista" />
            {!grupos.length && <p className="small text-muted">Nenhuma lista com «{procura}».</p>}
            {grupos.map((g) => (
              <div key={g} className="mb-2">
                <div className="small text-muted text-uppercase fw-bold mb-1">{g}</div>
                <div className="list-group">
                  {visiveis.filter((l) => l.grupo === g).map((l) => (
                    <button key={l.id} type="button" className={`list-group-item list-group-item-action d-flex align-items-center ${l.id === lista.id ? 'active' : ''}`} onClick={() => escolher(l.id)}>
                      <span className="flex-grow-1">{l.soNomes && <i className="fa fa-balance-scale me-1 opacity-75" title="Da lei: só muda o nome" />}{l.nome}</span>
                      {l.mudada && <span className={`badge ${l.id === lista.id ? 'bg-light text-dark' : 'bg-warning text-dark'} me-1`} title="Diferente da de origem">mudada</span>}
                      <span className={`badge ${l.id === lista.id ? 'bg-light text-dark' : 'bg-secondary'}`}>{Object.keys(l.valor).length}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <p className="small text-muted mb-0 mt-3"><i className="fa fa-info-circle me-1" />As listas marcadas <i className="fa fa-balance-scale" /> vêm da lei ou o sistema usa-as com regras: só lhes muda o nome.</p>
          </Painel>
        </div>
        <div className="col-lg-8">
          <Painel titulo={lista.nome} icone="fa-list">
            {lista.fonte && <p className="small text-muted"><i className="fa fa-balance-scale me-1" />{lista.fonte}</p>}
            {lista.soNomes && <div className="alert alert-info small py-2"><i className="fa fa-balance-scale me-1" />Esta lista vem da lei (ou o sistema usa-a com regras): <strong>só se muda o nome</strong> de cada entrada; não se acrescentam nem se tiram. O nome novo passa a valer em todo o sistema, também nos documentos.</div>}
            {lista.chaves && !lista.soNomes && <p className="small text-muted">Cada entrada tem um código, que é o que fica gravado. As que vêm de origem <i className="fa fa-lock" /> podem mudar de nome, mas não se tiram (o sistema usa-as).</p>}
            {!lista.chaves && <p className="small text-muted">O nome escolhido fica escrito na ficha: tirar uma entrada não muda as fichas que já a têm.</p>}
            <div className="table-responsive">
              <table className="table table-sm align-middle mb-2">
                <thead><tr><th style={{ width: 40 }}>#</th>{lista.chaves && <th style={{ width: 150 }}>{lista.rotuloChave}</th>}<th>Nome</th>{admin && !lista.soNomes && <th style={{ width: 120 }} />}</tr></thead>
                <tbody>
                  {linhas.map(([k, v], i) => {
                    const fixa = lista.fixas.includes(k)
                    return (
                      <tr key={`${k}-${i}`}>
                        <td className="text-muted">{i + 1}</td>
                        {lista.chaves && <td><code>{k}</code>{fixa && !lista.soNomes && <i className="fa fa-lock text-muted ms-1" title="Vem de origem: não se tira" />}</td>}
                        <td>{admin ? <input className="form-control form-control-sm" value={v} onChange={(e) => mudar(i, e.target.value)} aria-label={`Nome ${i + 1}`} maxLength={120} /> : v}</td>
                        {admin && !lista.soNomes && (
                          <td className="text-end text-nowrap">
                            <button type="button" className="btn btn-sm btn-white" disabled={i === 0} onClick={() => mover(i, -1)} title="Subir" aria-label="Subir"><i className="fa fa-arrow-up" /></button>{' '}
                            <button type="button" className="btn btn-sm btn-white" disabled={i === linhas.length - 1} onClick={() => mover(i, 1)} title="Descer" aria-label="Descer"><i className="fa fa-arrow-down" /></button>{' '}
                            <button type="button" className="btn btn-sm btn-white text-danger" disabled={fixa} onClick={() => tirar(i)} title={fixa ? 'Vem de origem: não se tira' : 'Tirar'} aria-label="Tirar"><i className="fa fa-times" /></button>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {admin ? (
              <>
                {!lista.soNomes && <form className="d-flex gap-2 mb-3" onSubmit={acrescentar}>
                  {lista.chaves && <input className="form-control form-control-sm" style={{ maxWidth: 150 }} placeholder={`${lista.rotuloChave} (opcional)`} value={novo.codigo} onChange={(e) => setNovo({ ...novo, codigo: e.target.value })} maxLength={30} aria-label={lista.rotuloChave} />}
                  <input className="form-control form-control-sm" placeholder="Nova entrada…" value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} maxLength={120} aria-label="Nova entrada" />
                  <button type="submit" className="btn btn-sm btn-outline-theme text-nowrap"><i className="fa fa-plus me-1" />Acrescentar</button>
                </form>}
                <div className="d-flex gap-2 flex-wrap">
                  <button type="button" className="btn btn-theme" disabled={!mudou || aGravar} onClick={guardar}><i className="fa fa-save me-1" />{aGravar ? 'A guardar…' : 'Guardar'}</button>
                  {mudou && <button type="button" className="btn btn-white" onClick={() => setEdicao(null)}>Desfazer</button>}
                  {lista.mudada && !mudou && <button type="button" className="btn btn-white ms-auto" onClick={repor}><i className="fa fa-undo me-1" />Repor a de origem</button>}
                </div>
              </>
            ) : <p className="small text-muted mb-0">Só o administrador muda as listas.</p>}
          </Painel>
        </div>
      </div>
    </>
  )
}
