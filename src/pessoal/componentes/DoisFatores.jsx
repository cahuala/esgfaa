import { useEffect, useState } from 'react'
import { api } from '../api'
import { Painel } from './Ui'


/*
  Verificação em dois passos (Perfil): ligar com a aplicação de autenticação do telemóvel (QR code), ver os
  códigos de recuperação uma vez, gerar outros e desligar (com a palavra-passe e um código).
*/
export default function DoisFatores({ aoMudar, obrigatoria = false }) {
  const [estado, setEstado] = useState(null)
  const [novo, setNovo] = useState(null) // { segredo, url, qr }
  const [codigo, setCodigo] = useState('')
  const [senha, setSenha] = useState('')
  const [codigos, setCodigos] = useState(null)
  const [desligar, setDesligar] = useState(false)
  const [erro, setErro] = useState('')

  const ler = () => api('/eu/2fa').then(setEstado).catch((e) => setErro(e.message))
  useEffect(() => { ler() }, [])

  const tentar = (f) => async (e) => {
    e?.preventDefault()
    setErro('')
    try { await f() } catch (falha) { setErro(falha.message) }
  }
  const iniciar = tentar(async () => {
    const r = await api('/eu/2fa/iniciar', { metodo: 'POST' })
    const { default: QRCode } = await import('qrcode')
    setNovo({ ...r, qr: await QRCode.toDataURL(r.url, { margin: 1, width: 220 }) })
  })
  const confirmar = tentar(async () => {
    const r = await api('/eu/2fa/confirmar', { metodo: 'POST', corpo: { codigo } })
    setCodigos(r.codigos); setNovo(null); setCodigo('')
    await ler()
    if (!obrigatoria) aoMudar?.()
  })
  const outros = tentar(async () => {
    const r = await api('/eu/2fa/codigos', { metodo: 'POST', corpo: { codigo } })
    setCodigos(r.codigos); setCodigo(''); await ler()
  })
  const apagar = tentar(async () => {
    await api('/eu/2fa/desligar', { metodo: 'POST', corpo: { senha, codigo } })
    setDesligar(false); setSenha(''); setCodigo(''); await ler(); aoMudar?.()
  })

  if (!estado) return null
  return (
    <Painel titulo={'Verificação em dois passos'} icone="fa-mobile-alt">
      {erro && <div className="alert alert-danger py-2" role="alert">{erro}</div>}
      {codigos && (
        <div className="alert alert-warning">
          <strong>{'Guarde estes códigos de recuperação'}</strong> — {'cada um serve uma vez, se perder o telemóvel. Não voltam a ser mostrados.'}
          <div className="d-flex flex-wrap gap-2 my-2 font-monospace">{codigos.map((c) => <code key={c} className="bg-white border rounded px-2 py-1">{c}</code>)}</div>
          <button type="button" className="btn btn-sm btn-outline-dark me-2" onClick={() => navigator.clipboard?.writeText(codigos.join('\n'))}><i className="fa fa-copy me-1" />{'Copiar'}</button>
          <button type="button" className="btn btn-sm btn-outline-dark" onClick={() => { setCodigos(null); if (obrigatoria) aoMudar?.() }}>{'Já os guardei'}</button>
        </div>
      )}
      {estado.ativo ? (
        <>
          <p className="mb-2"><span className="badge bg-success me-2"><i className="fa fa-check me-1" />{'Verificação ligada'}</span>{'Ao entrar, além da palavra-passe, é pedido o código da aplicação de autenticação.'}</p>
          <p className="small text-muted">{'Códigos de recuperação por usar:'} <strong>{estado.codigosRestantes}</strong></p>
          <form className="d-flex flex-wrap gap-2 align-items-end" onSubmit={desligar ? apagar : outros}>
            {desligar && <div><label className="form-label small fw-bold" htmlFor="df-senha">{'Palavra-passe'}</label><input id="df-senha" type="password" className="form-control form-control-sm" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="current-password" required /></div>}
            <div><label className="form-label small fw-bold" htmlFor="df-codigo">{'Código actual da aplicação'}</label><input id="df-codigo" inputMode="numeric" autoComplete="one-time-code" className="form-control form-control-sm" value={codigo} onChange={(e) => setCodigo(e.target.value)} required style={{ width: 150 }} /></div>
            <button type="submit" className={`btn btn-sm ${desligar ? 'btn-danger' : 'btn-outline-theme'}`}>{desligar ? 'Desligar' : 'Gerar novos códigos de recuperação'}</button>
            {!estado.obrigatorio && <button type="button" className="btn btn-sm btn-link" onClick={() => setDesligar(!desligar)}>{desligar ? 'Cancelar' : 'Desligar a verificação em dois passos'}</button>}
          </form>
          {estado.obrigatorio && <p className="small text-muted mt-2 mb-0"><i className="fa fa-lock me-1" />{'O seu papel exige a verificação em dois passos: não pode ser desligada.'}</p>}
        </>
      ) : novo ? (
        <form onSubmit={confirmar}>
          <ol className="small ps-3">
            <li>{'Instale no telemóvel uma aplicação de autenticação (Google Authenticator, Microsoft Authenticator, FreeOTP…).'}</li>
            <li>{'Na aplicação, adicione uma conta e leia este código QR (ou escreva a chave).'}</li>
            <li>{'Escreva o código de 6 algarismos que a aplicação mostra.'}</li>
          </ol>
          <div className="d-flex flex-wrap gap-3 align-items-center mb-3">
            <img src={novo.qr} alt={'Código QR da verificação em dois passos'} width="180" height="180" className="border rounded" />
            <div className="small"><div className="text-muted">{'Chave (se não conseguir ler o QR):'}</div><code className="user-select-all fs-6">{novo.segredo.match(/.{1,4}/g).join(' ')}</code></div>
          </div>
          <div className="d-flex gap-2 align-items-end">
            <div><label className="form-label small fw-bold" htmlFor="df-conf">{'Código de 6 algarismos'}</label><input id="df-conf" inputMode="numeric" autoComplete="one-time-code" maxLength={6} className="form-control" value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))} required style={{ width: 160 }} /></div>
            <button type="submit" className="btn btn-theme"><i className="fa fa-check me-1" />{'Confirmar e ligar'}</button>
          </div>
        </form>
      ) : (
        <>
          <p>{estado.obrigatorio ? <strong className="text-danger">{'O seu papel exige a verificação em dois passos (Lei n.º 22/11: as fichas têm dados pessoais). Ligue-a para continuar.'}</strong> : 'Proteja a conta: mesmo que alguém descubra a palavra-passe, sem o seu telemóvel não entra.'}</p>
          <button type="button" className="btn btn-theme" onClick={iniciar}><i className="fa fa-mobile-alt me-1" />{'Ligar a verificação em dois passos'}</button>
        </>
      )}
    </Painel>
  )
}
