import { useEffect, useState } from 'react'
import { api } from '../api'
import { useSessao } from '../sessaoContexto'
import { Aviso, Cartao } from '../componentes'
import { dataHora, iniciais } from '../formatar'
import MudarSenha from './MudarSenha'

const ESTADOS = { ativa: 'Ativa', suspensa: 'Suspensa', concluida: 'Concluída', anulada: 'Anulada' }

// perfil no estilo do Color Admin (profile header com a fotografia da sede)
function Perfil() {
  const { conta, eDocente } = useSessao()
  const [aviso, setAviso] = useState(null)
  const [pref, setPref] = useState(null)
  useEffect(() => { api('/eu/preferencias').then(setPref).catch(() => {}) }, [])
  const mudarEmail = (v) => api('/eu/preferencias', { metodo: 'PUT', corpo: { notificarEmail: v } })
    .then((r) => { setPref(r); setAviso({ texto: v ? 'Vai receber as notificações também por e-mail.' : 'As notificações ficam só no portal.' }) })
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
              <p className="mb-2">{eDocente ? 'Docente' : 'Estudante'} · n.º {conta.numero}{d.posto ? ` · ${d.posto}` : ''}{d.ramo ? ` · ${d.ramo}` : ''}</p>
              <span className="badge bg-yellow text-dark">{conta.email}</span>
            </div>
          </div>
          <ul className="profile-header-tab nav nav-tabs"><li className="nav-item"><span className="nav-link active">O meu perfil</span></li></ul>
        </div>
      </div>
      <div className="row">
        <div className="col-xl-7">
          <Cartao titulo={<><i className="fa fa-id-card me-2" />Dados</>}>
            <dl className="p-ficha">
              <div><dt>Nome</dt><dd>{conta.nome}</dd></div>
              <div><dt>Número</dt><dd>{conta.numero}</dd></div>
              <div><dt>E-mail</dt><dd>{conta.email}</dd></div>
              {d.posto && <div><dt>Posto</dt><dd>{d.posto}</dd></div>}
              {d.ramo && <div><dt>Ramo</dt><dd>{d.ramo}</dd></div>}
              {d.nip && <div><dt>NIP</dt><dd>{d.nip}</dd></div>}
              {d.departamento && <div><dt>Departamento</dt><dd>{d.departamento}</dd></div>}
              {conta.matriculas?.map((m) => <div key={m.id}><dt>Matrícula</dt><dd>{m.turma.nome} <span className="badge bg-gray-500 ms-1">{ESTADOS[m.estado] || m.estado}</span></dd></div>)}
              <div><dt>Último acesso</dt><dd>{dataHora(conta.ultimoAcesso)}</dd></div>
            </dl>
            <p className="p-texto-fraco mt-2 mb-0">Para corrigir os seus dados, contacte a Administração Escolar.</p>
          </Cartao>
        </div>
        <div className="col-xl-5">
          {pref && (
            <Cartao titulo={<><i className="fa fa-bell me-2" />Notificações</>}>
              <div className="form-check form-switch">
                <input id="pref-email" className="form-check-input" type="checkbox" checked={pref.notificarEmail} onChange={(e) => mudarEmail(e.target.checked)} />
                <label className="form-check-label" htmlFor="pref-email">Receber as notificações também por e-mail ({conta.email})</label>
              </div>
              <p className="small text-muted mt-2 mb-0">
                Materiais novos, avisos, trabalhos, correções, notas publicadas, respostas no fórum, mensagens e lembretes de prazo.
                {!pref.emailAtivo && ' (O envio de e-mails ainda não está configurado no servidor: por agora as notificações aparecem só no portal.)'}
              </p>
            </Cartao>
          )}
          <Cartao titulo={<><i className="fa fa-key me-2" />Mudar a palavra-passe</>}>
            <MudarSenha aoTerminar={() => setAviso({ texto: 'Palavra-passe alterada. As outras sessões foram terminadas.' })} />
          </Cartao>
        </div>
      </div>
      <Aviso aviso={aviso} onFechar={() => setAviso(null)} />
    </>
  )
}

export default Perfil
