import { useEffect, useState } from 'react'
import { api } from '../api'
import { useSessao } from '../sessaoContexto'
import { Aviso, Cartao } from '../componentes'
import { dataHora, iniciais } from '../formatar'
import MudarSenha from './MudarSenha'
import AvisosAparelho from '../AvisosAparelho'
import { t as tx } from '../../i18n/linguas'

const ESTADOS = { ativa: tx('Ativa'), suspensa: tx('Suspensa'), concluida: tx('Concluída'), anulada: tx('Anulada') }

// perfil no estilo do Color Admin (profile header com a fotografia da sede)
function Perfil() {
  const { conta, eDocente } = useSessao()
  const [aviso, setAviso] = useState(null)
  const [pref, setPref] = useState(null)
  useEffect(() => { api('/eu/preferencias').then(setPref).catch(() => {}) }, [])
  const mudarEmail = (v) => api('/eu/preferencias', { metodo: 'PUT', corpo: { notificarEmail: v } })
    .then((r) => { setPref(r); setAviso({ texto: v ? tx('Vai receber as notificações também por e-mail.') : tx('As notificações ficam só no portal.') }) })
    .catch((e) => setAviso({ tipo: 'erro', texto: e.message }))
  const d = conta.dados || {}
  return (
    <>
      <div className="profile p-perfil mb-3">
        <div className="profile-header">
          <div className="profile-header-cover" />
          <div className="profile-header-content">
            <div className="profile-header-img"><div className="p-perfil-avatar">{iniciais(conta.nome)}</div></div>
            <div className="profile-header-info">
              <h1 className="h4 mt-0 mb-1">{conta.nome}</h1>
              <p className="mb-2">{eDocente ? tx('Docente') : tx('Estudante')} {tx('· n.º')} {conta.numero}{d.posto ? ` · ${d.posto}` : ''}{d.ramo ? ` · ${d.ramo}` : ''}</p>
              <span className="badge bg-yellow text-dark">{conta.email}</span>
            </div>
          </div>
          <ul className="profile-header-tab nav nav-tabs"><li className="nav-item"><span className="nav-link active">{tx('O meu perfil')}</span></li></ul>
        </div>
      </div>
      <div className="row">
        <div className="col-xl-7">
          <Cartao titulo={<><i className="fa fa-id-card me-2" />{tx('Dados')}</>}>
            <dl className="p-ficha">
              <div><dt>{tx('Nome')}</dt><dd>{conta.nome}</dd></div>
              <div><dt>{tx('Número')}</dt><dd>{conta.numero}</dd></div>
              <div><dt>{tx('E-mail')}</dt><dd>{conta.email}</dd></div>
              {d.posto && <div><dt>{tx('Posto')}</dt><dd>{d.posto}</dd></div>}
              {d.ramo && <div><dt>{tx('Ramo')}</dt><dd>{d.ramo}</dd></div>}
              {d.nip && <div><dt>{tx('NIP')}</dt><dd>{d.nip}</dd></div>}
              {d.departamento && <div><dt>{tx('Departamento')}</dt><dd>{d.departamento}</dd></div>}
              {conta.matriculas?.map((m) => <div key={m.id}><dt>{tx('Matrícula')}</dt><dd>{m.turma.nome} <span className="badge bg-gray-500 ms-1">{ESTADOS[m.estado] || m.estado}</span></dd></div>)}
              <div><dt>{tx('Último acesso')}</dt><dd>{dataHora(conta.ultimoAcesso)}</dd></div>
            </dl>
            <p className="p-texto-fraco mt-2 mb-0">{tx('Para corrigir os seus dados, contacte a Administração Escolar.')}</p>
          </Cartao>
        </div>
        <div className="col-xl-5">
          {pref && (
            <Cartao titulo={<><i className="fa fa-bell me-2" />{tx('Notificações')}</>}>
              <div className="form-check form-switch">
                <input id="pref-email" className="form-check-input" type="checkbox" checked={pref.notificarEmail} onChange={(e) => mudarEmail(e.target.checked)} />
                <label className="form-check-label" htmlFor="pref-email">{tx('Receber as notificações também por e-mail (')}{conta.email})</label>
              </div>
              <p className="small text-muted mt-2 mb-0">
                {tx('Materiais novos, avisos, trabalhos, correções, notas publicadas, respostas no fórum, mensagens e lembretes de prazo.')}
                {!pref.emailAtivo && tx(' (O envio de e-mails ainda não está configurado no servidor: por agora as notificações aparecem só no portal.)')}
              </p>
              <AvisosAparelho />
            </Cartao>
          )}
          <OsMeusDados avisar={setAviso} />
          <Cartao titulo={<><i className="fa fa-key me-2" />{tx('Mudar a palavra-passe')}</>}>
            <MudarSenha aoTerminar={() => setAviso({ texto: tx('Palavra-passe alterada. As outras sessões foram terminadas.') })} />
          </Cartao>
        </div>
      </div>
      <Aviso aviso={aviso} onFechar={() => setAviso(null)} />
    </>
  )
}

const TIPOS_PEDIDO = { rectificacao: 'Rectificação (corrigir dados)', acesso: 'Acesso aos meus dados', oposicao: 'Oposição a um tratamento', eliminacao: 'Eliminação de dados', outro: 'Outro assunto sobre dados pessoais' }
const ESTADOS_PEDIDO = { pendente: 'Por responder', respondido: 'Respondido', recusado: 'Recusado' }

// direitos do titular (Lei n.º 22/11): descarregar os seus dados e fazer pedidos à Escola
function OsMeusDados({ avisar }) {
  const [pedidos, setPedidos] = useState(null)
  const [f, setF] = useState({ tipo: 'rectificacao', texto: '' })
  const [aEnviar, setAEnviar] = useState(false)
  const carregar = () => api('/eu/pedidos-dados').then(setPedidos).catch(() => setPedidos([]))
  useEffect(() => { carregar() }, [])
  async function descarregar() {
    try {
      const d = await api('/eu/dados')
      const url = URL.createObjectURL(new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' }))
      const a = document.createElement('a')
      a.href = url
      a.download = 'os-meus-dados.json'
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 30_000)
    } catch (e) {
      avisar({ tipo: 'erro', texto: e.message })
    }
  }
  async function pedir(e) {
    e.preventDefault()
    setAEnviar(true)
    try {
      await api('/eu/pedidos-dados', { metodo: 'POST', corpo: f })
      setF({ ...f, texto: '' })
      avisar({ texto: tx('Pedido enviado. A Escola responde aqui e avisa-o nas notificações.') })
      carregar()
    } catch (x) {
      avisar({ tipo: 'erro', texto: x.message })
    } finally {
      setAEnviar(false)
    }
  }
  return (
    <Cartao titulo={<><i className="fa fa-user-shield me-2" />{tx('Os meus dados')}</>}>
      <p className="small">{tx('Os seus dados são tratados segundo a Lei n.º 22/11 (protecção de dados pessoais).')} <a href={`${import.meta.env.BASE_URL}Privacidade`} target="_blank" rel="noreferrer">{tx('Política de privacidade')}</a></p>
      <button type="button" className="btn btn-white btn-sm mb-3" onClick={descarregar}><i className="fa fa-download me-1" />{tx('Descarregar os meus dados')}</button>
      <form onSubmit={pedir}>
        <label className="form-label fw-bold" htmlFor="pd-tipo">{tx('Fazer um pedido')}</label>
        <select id="pd-tipo" className="form-select form-select-sm mb-2" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>
          {Object.entries(TIPOS_PEDIDO).map(([k, v]) => <option key={k} value={k}>{tx(v)}</option>)}
        </select>
        <textarea className="form-control form-control-sm mb-2" rows={3} value={f.texto} onChange={(e) => setF({ ...f, texto: e.target.value })} placeholder={tx('Diga o que pretende (ex.: o meu telefone está errado, o correcto é…)')} aria-label={tx('Descrição do pedido')} required minLength={5} />
        <button type="submit" className="btn btn-theme btn-sm" disabled={aEnviar || f.texto.trim().length < 5}><i className="fa fa-paper-plane me-1" />{tx('Enviar pedido')}</button>
      </form>
      {pedidos?.length > 0 && (
        <ul className="list-unstyled small mt-3 mb-0">
          {pedidos.map((p) => (
            <li key={p.id} className="border-top pt-2 mt-2">
              <span className={`badge ${p.estado === 'pendente' ? 'bg-warning text-dark' : p.estado === 'respondido' ? 'bg-success' : 'bg-gray-500'} me-1`}>{tx(ESTADOS_PEDIDO[p.estado] ?? p.estado)}</span>
              <strong>{tx(TIPOS_PEDIDO[p.tipo] ?? p.tipo)}</strong> · {dataHora(p.criadoEm)}
              <div className="text-muted">{p.texto}</div>
              {p.resposta && <div><i className="fa fa-reply me-1" />{p.resposta}</div>}
            </li>
          ))}
        </ul>
      )}
    </Cartao>
  )
}

export default Perfil
