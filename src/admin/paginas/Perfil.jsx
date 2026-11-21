import { useRef, useState } from 'react'
import { api, confirmarSessao } from '../api'
import { useSessao } from '../sessaoContexto'
import { Aviso, CabecalhoPagina, Painel } from '../componentes/Ui'
import DoisFatores from '../componentes/DoisFatores'
import AvatarConta from '../componentes/AvatarConta'
import { dataHora } from '../formatar'
import { t as tx } from '../../i18n/linguas'

/*
  O meu perfil (como a página «Profile» do Color Admin): a capa com a fotografia, o nome e o papel; os dados que a
  pessoa muda (nome, telefone, cargo ou função) e a segurança (palavra-passe e verificação em dois passos).
  As contas que vêm do Sistema de Gestão de Pessoal mudam o nome (e o Comandante, a palavra-passe) lá.
*/
function Perfil() {
  const { utilizador, recarregar } = useSessao()
  const [dados, setDados] = useState(() => ({ nome: utilizador.nome ?? '', telefone: utilizador.telefone ?? '', cargo: utilizador.cargo ?? '' }))
  const [senha, setSenha] = useState({ atual: '', nova: '', repetir: '' })
  const [aviso, setAviso] = useState(null)
  const [aGravar, setAGravar] = useState('')
  const ficheiro = useRef(null)
  const mudou = dados.nome !== (utilizador.nome ?? '') || dados.telefone !== (utilizador.telefone ?? '') || dados.cargo !== (utilizador.cargo ?? '')

  async function correr(qual, fn, ok) {
    setAGravar(qual)
    try {
      await fn()
      await recarregar()
      setAviso({ texto: ok })
    } catch (falha) {
      setAviso({ tipo: 'erro', texto: falha.message })
    } finally {
      setAGravar('')
    }
  }
  const guardarDados = (e) => {
    e.preventDefault()
    const corpo = { telefone: dados.telefone, cargo: dados.cargo, ...(utilizador.doPessoal ? {} : { nome: dados.nome }) }
    return correr('dados', () => api('/eu/perfil', { metodo: 'PUT', corpo }), tx('Perfil guardado.'))
  }
  function escolherFoto(e) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (f.size > 2 * 1024 * 1024) return setAviso({ tipo: 'erro', texto: tx('A fotografia tem de ter até 2 MB.') })
    const formulario = new FormData()
    formulario.append('foto', f)
    correr('foto', () => api('/eu/foto', { metodo: 'POST', formulario }), tx('Fotografia actualizada.'))
  }
  const tirarFoto = () => correr('foto', () => api('/eu/foto', { metodo: 'DELETE' }), tx('Fotografia retirada.'))
  async function alterarSenha(e) {
    e.preventDefault()
    if (senha.nova !== senha.repetir) return setAviso({ tipo: 'erro', texto: tx('As duas palavras-passe novas não coincidem.') })
    // as outras sessões terminam; esta continua (o servidor renova o cookie)
    await correr('senha', async () => {
      await confirmarSessao(await api('/eu/senha', { metodo: 'PUT', corpo: { atual: senha.atual, nova: senha.nova } }))
      setSenha({ atual: '', nova: '', repetir: '' })
    }, tx('Palavra-passe alterada. As sessões abertas noutros computadores foram terminadas.'))
  }

  return (
    <>
      <CabecalhoPagina titulo={tx('O meu perfil')} migalhas={[{ rotulo: tx('Perfil') }]} />

      {/* capa */}
      <div className="perfil-capa mb-4">
        <div className="perfil-capa-fundo" aria-hidden="true" />
        <div className="perfil-capa-conteudo">
          <div className="perfil-foto">
            <AvatarConta utilizador={utilizador} className="perfil-avatar" />
            <button type="button" className="perfil-foto-botao" onClick={() => ficheiro.current?.click()} disabled={aGravar === 'foto'} title={tx('Mudar a fotografia')} aria-label={tx('Mudar a fotografia')}>
              <i className={`fa ${aGravar === 'foto' ? 'fa-spinner fa-spin' : 'fa-camera'}`} />
            </button>
            <input ref={ficheiro} type="file" accept="image/jpeg,image/png,image/webp" className="d-none" onChange={escolherFoto} />
          </div>
          <div className="perfil-identidade">
            <h2>{utilizador.nome}</h2>
            <div className="perfil-papel">{tx(utilizador.nomePapel)}{utilizador.cargo ? ` · ${utilizador.cargo}` : ''}</div>
            <div className="perfil-contactos">
              <span><i className="fa fa-envelope me-1" />{utilizador.email}</span>
              {utilizador.telefone && <span><i className="fa fa-phone me-1" />{utilizador.telefone}</span>}
              {utilizador.ultimoAcesso && <span><i className="fa fa-clock me-1" />{tx('Último acesso')}: {dataHora(utilizador.ultimoAcesso)}</span>}
            </div>
          </div>
          <div className="perfil-acoes">
            <button type="button" className="btn btn-sm perfil-botao-claro" onClick={() => ficheiro.current?.click()} disabled={aGravar === 'foto'}><i className="fa fa-camera me-1" />{utilizador.foto ? tx('Mudar fotografia') : tx('Pôr fotografia')}</button>
            {utilizador.foto && <button type="button" className="btn btn-sm perfil-botao-contorno" onClick={tirarFoto} disabled={aGravar === 'foto'}><i className="fa fa-trash me-1" />{tx('Tirar')}</button>}
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-lg-6">
          <Painel titulo={tx('Os meus dados')}>
            <form onSubmit={guardarDados}>
              <div className="mb-3">
                <label className="form-label fw-bold" htmlFor="perfil-nome">{tx('Nome')}</label>
                <input id="perfil-nome" className="form-control" value={dados.nome} maxLength={100} disabled={utilizador.doPessoal} onChange={(e) => setDados({ ...dados, nome: e.target.value })} required />
                {utilizador.doPessoal && <div className="form-text"><i className="fa fa-id-card me-1" />{tx('O nome vem do Sistema de Gestão de Pessoal: muda-se na ficha, lá.')}</div>}
              </div>
              <div className="row">
                <div className="col-md-6 mb-3">
                  <label className="form-label fw-bold" htmlFor="perfil-tel">{tx('Telefone')}</label>
                  <input id="perfil-tel" type="tel" className="form-control" value={dados.telefone} maxLength={30} placeholder="+244 9XX XXX XXX" onChange={(e) => setDados({ ...dados, telefone: e.target.value })} />
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label fw-bold" htmlFor="perfil-cargo">{tx('Cargo ou função')}</label>
                  <input id="perfil-cargo" className="form-control" value={dados.cargo} maxLength={120} placeholder={tx('ex.: Chefe da Repartição de Administração Escolar')} onChange={(e) => setDados({ ...dados, cargo: e.target.value })} />
                </div>
              </div>
              <dl className="row small text-muted mb-3">
                <dt className="col-4 fw-normal">{tx('E-mail')}</dt><dd className="col-8">{utilizador.email}</dd>
                <dt className="col-4 fw-normal">{tx('Papel')}</dt><dd className="col-8">{tx(utilizador.nomePapel)}</dd>
                <dt className="col-4 fw-normal">{tx('Conta criada em')}</dt><dd className="col-8 mb-0">{dataHora(utilizador.criadoEm)}</dd>
              </dl>
              <button type="submit" className="btn btn-theme" disabled={!mudou || aGravar === 'dados'}><i className={`fa ${aGravar === 'dados' ? 'fa-spinner fa-spin' : 'fa-save'} me-1`} />{tx('Guardar')}</button>
            </form>
          </Painel>
        </div>
        <div className="col-lg-6">
          <Painel titulo={tx('Alterar palavra-passe')}>
            {utilizador.geridaPeloPessoal ? (
              <div className="alert alert-info mb-0"><i className="fa fa-id-card me-2" />{tx('A sua conta é a mesma do Sistema de Gestão de Pessoal: a mesma palavra-passe nos dois sistemas. Muda-se lá.')}</div>
            ) : (
              <form onSubmit={alterarSenha}>
                {[
                  ['atual', tx('Palavra-passe atual'), 'current-password'],
                  ['nova', tx('Nova palavra-passe'), 'new-password'],
                  ['repetir', tx('Repetir a nova palavra-passe'), 'new-password'],
                ].map(([campo, rotulo, auto]) => (
                  <div key={campo} className="mb-3">
                    <label className="form-label fw-bold" htmlFor={`p-${campo}`}>{rotulo}</label>
                    <input id={`p-${campo}`} type="password" className="form-control" autoComplete={auto} value={senha[campo]} onChange={(e) => setSenha({ ...senha, [campo]: e.target.value })} required />
                  </div>
                ))}
                <div className="form-text mb-3">{tx('Mínimo 10 caracteres, com letras e números. Não use o seu nome nem o e-mail.')}</div>
                <button type="submit" className="btn btn-theme" disabled={aGravar === 'senha'}><i className="fa fa-key me-1" /> {tx('Alterar palavra-passe')}</button>
              </form>
            )}
          </Painel>
          <DoisFatores aoMudar={recarregar} />
        </div>
      </div>
      <Aviso aviso={aviso} onFechar={() => setAviso(null)} />
    </>
  )
}

export default Perfil
