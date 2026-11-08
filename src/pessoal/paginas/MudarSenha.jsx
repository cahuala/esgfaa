import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import { useSessao } from '../sessao'
import { Cabecalho, Painel } from '../componentes/Ui'
import DoisFatores from '../componentes/DoisFatores'
import { dataHoraPt } from '../formatar'

// as sessões abertas desta conta: se aparecer uma que não reconhece, termina-se e muda-se a palavra-passe
function Sessoes() {
  const { avisar } = useSessao()
  const [lista, setLista] = useState(null)
  const carregar = useCallback(() => api('/eu/sessoes').then(setLista).catch((e) => avisar(e.message, 'erro')), [avisar])
  useEffect(() => { carregar() }, [carregar])
  const terminar = (id) => api(`/eu/sessoes/${id}`, { metodo: 'DELETE' }).then(() => { avisar('Sessão terminada.'); carregar() }).catch((e) => avisar(e.message, 'erro'))
  const outras = () => api('/eu/sessoes/terminar-outras', { metodo: 'POST' }).then((r) => { avisar(`${r.terminadas} sessão(ões) terminada(s).`); carregar() }).catch((e) => avisar(e.message, 'erro'))
  const haOutras = lista?.some((x) => !x.atual)
  return (
    <Painel titulo="Sessões abertas" icone="fa-desktop" acoes={haOutras && <button type="button" className="btn btn-sm btn-outline-danger" onClick={outras}>Terminar as outras</button>}>
      <p className="text-muted small">Onde esta conta está aberta. Se não reconhecer uma, termine-a e mude a palavra-passe. Cada sessão termina sozinha ao fim de algum tempo sem uso, e não serve noutro navegador.</p>
      {!lista ? <div className="text-muted">A carregar…</div> : (
        <div className="table-responsive">
          <table className="table table-sm align-middle mb-0">
            <thead><tr><th>Navegador</th><th>Endereço</th><th>Entrou</th><th>Último uso</th><th /></tr></thead>
            <tbody>
              {lista.map((x) => (
                <tr key={x.id}>
                  <td>{x.navegador}{x.atual && <span className="badge bg-success ms-2">esta</span>}</td>
                  <td>{x.ip || '—'}</td>
                  <td>{dataHoraPt(x.criadaEm)}</td>
                  <td>{dataHoraPt(x.usadaEm)}</td>
                  <td className="text-end">{!x.atual && <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => terminar(x.id)}>Terminar</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Painel>
  )
}

export default function MudarSenha({ obrigatoria = false }) {
  const { mudouSenha, avisar, sair } = useSessao()
  const [d, setD] = useState({ atual: '', nova: '', repetir: '' })
  const [erro, setErro] = useState('')
  const [aGuardar, setAGuardar] = useState(false)
  async function guardar(e) {
    e.preventDefault()
    setErro('')
    if (d.nova !== d.repetir) return setErro('As duas palavras-passe novas não são iguais.')
    setAGuardar(true)
    try {
      await api('/mudar-senha', { metodo: 'POST', corpo: { atual: d.atual, nova: d.nova } })
      await mudouSenha()
      avisar('Palavra-passe alterada.')
      setD({ atual: '', nova: '', repetir: '' })
    } catch (f) {
      setErro(f.message)
    } finally {
      setAGuardar(false)
    }
  }
  const campo = (k, rotulo, auto) => (
    <div className="mb-3">
      <label className="form-label" htmlFor={k}>{rotulo}</label>
      <input id={k} type="password" className="form-control" autoComplete={auto} value={d[k]} onChange={(e) => setD({ ...d, [k]: e.target.value })} required />
    </div>
  )
  const form = (
    <form onSubmit={guardar} style={{ maxWidth: 420 }}>
      {obrigatoria && <div className="alert alert-info">Antes de continuar, escolha uma palavra-passe só sua (pelo menos 10 caracteres, com letras e números).</div>}
      {erro && <div className="alert alert-danger">{erro}</div>}
      {campo('atual', 'Palavra-passe atual', 'current-password')}
      {campo('nova', 'Nova palavra-passe', 'new-password')}
      {campo('repetir', 'Repetir a nova palavra-passe', 'new-password')}
      <button type="submit" className="btn btn-theme" disabled={aGuardar}><i className="fa fa-key me-2" />Mudar palavra-passe</button>
      {obrigatoria && <button type="button" className="btn btn-link" onClick={sair}>Sair</button>}
    </form>
  )
  if (obrigatoria) return <div className="container py-5"><Painel titulo="Mudar a palavra-passe" icone="fa-key">{form}</Painel></div>
  return <><Cabecalho titulo="Segurança da conta" subtitulo="palavra-passe, verificação em dois passos e sessões abertas" migalhas={[['Segurança da conta']]} /><div className="row"><div className="col-xl-5"><Painel titulo="Mudar a palavra-passe" icone="fa-key">{form}</Painel></div><div className="col-xl-7"><DoisFatores /></div></div><Sessoes /></>
}
