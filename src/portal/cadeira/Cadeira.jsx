import { useCallback, useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { useSessao } from '../sessaoContexto'
import { Aviso, Carregando, Erro } from '../componentes'
import { PERIODOS } from '../regraAvaliacao'
import { registarRecente } from '../recentes'
import Programa from './Programa'
import Curso from './Curso'
import Participantes from './Participantes'
import AvisosCadeira from './AvisosCadeira'
import Trabalhos from './Trabalhos'
import Avaliacoes from './Avaliacoes'
import Presencas from './Presencas'
import Forum from './Forum'
import Questionarios from './Questionarios'
import Progresso from './Progresso'
import Datas from './Datas'
import VerMaterial from './VerMaterial'
import Inquerito from './Inquerito'
import Grupos from './Grupos'

const SEPARADORES = [
  { id: 'curso', texto: 'Cadeira', icone: 'fa-book-open' },
  { id: 'avisos', texto: 'Avisos', icone: 'fa-bullhorn' },
  { id: 'forum', texto: 'Fórum', icone: 'fa-comments' },
  { id: 'avaliacoes', texto: 'Notas', icone: 'fa-clipboard-list' },
  { id: 'participantes', texto: 'Participantes', icone: 'fa-users' },
  { id: 'grupos', texto: 'Grupos', icone: 'fa-user-friends' },
  { id: 'presencas', texto: 'Presenças', icone: 'fa-user-check' },
  { id: 'programa', texto: 'Programa', icone: 'fa-file-alt' },
  { id: 'horario', texto: 'Datas e horário', icone: 'fa-calendar-alt' },
  { id: 'progresso', texto: 'Progresso', icone: 'fa-tasks', docente: true },
]
// endereços antigos (?separador=materiais|trabalhos|questionarios) abrem a página da cadeira
const ANTIGOS = { materiais: 'curso', trabalhos: 'curso', questionarios: 'curso' }

// uma cadeira: separadores com tudo o que lhe diz respeito (vista do estudante ou do docente)
function Cadeira() {
  const { id } = useParams()
  const { conta, eDocente } = useSessao()
  const [params, setParams] = useSearchParams()
  const pedido = ANTIGOS[params.get('separador')] || params.get('separador')
  const separador = SEPARADORES.some((s) => s.id === pedido) ? pedido : 'curso'
  // atividade aberta a partir da página da cadeira: "trabalho-12", "questionario-3", "material-5", "inquerito-2"
  const [especie, atividadeId] = (params.get('atividade') || '').split('-')
  const irPara = useCallback((destino) => { setParams(destino, { replace: false }); window.scrollTo(0, 0) }, [setParams])
  const [c, setC] = useState(null)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState(null)
  const [progresso, setProgresso] = useState(null)

  const carregar = useCallback(() => {
    api(`/cadeiras/${id}`).then((r) => { setErro(''); setC(r) }).catch((e) => setErro(e.message))
    if (!eDocente) api(`/cadeiras/${id}/progresso`).then(setProgresso).catch(() => {})
  }, [id, eDocente])
  useEffect(() => { carregar() }, [carregar])
  useEffect(() => { if (c?.id) registarRecente(conta.id, c.id) }, [c?.id, conta.id])

  if (erro) return <Erro texto={erro} />
  if (!c) return <Carregando />

  const props = { c, eDocente, recarregar: carregar, avisar: setAviso, progresso, setProgresso, irPara }
  const separadores = SEPARADORES.filter((s) => !s.docente || eDocente)
  const contagem = { avisos: c.avisos.length, forum: c.forum.topicos }

  return (
    <>
      <ol className="breadcrumb mb-2">
        <li className="breadcrumb-item"><Link to="/">Portal</Link></li>
        <li className="breadcrumb-item"><Link to="/cadeiras">Cadeiras</Link></li>
        <li className="breadcrumb-item active">{c.codigo}</li>
      </ol>
      <div className="profile p-perfil mb-3">
        <div className="profile-header">
          <div className="profile-header-cover" />
          <div className="profile-header-content">
            <div className="profile-header-img"><div className="p-perfil-avatar"><i className="fa fa-book-open" /></div></div>
            <div className="profile-header-info">
              <h1 className="h4 mt-0 mb-1">{c.nome}</h1>
              <p className="mb-1">{c.codigo} · {PERIODOS[c.periodo]}{c.horas ? ` · ${c.horas} horas` : ''} · {c.turma?.nome}</p>
              <p className="mb-0 small opacity-75">
                {c.docentes.length ? c.docentes.map((d) => `${d.papel === 'regente' ? 'Regente' : 'Assistente'}: ${d.nome}`).join(' · ') : 'Docentes por alocar'}
              </p>
            </div>
          </div>
          <ul className="profile-header-tab nav nav-tabs" role="tablist" aria-label="Secções da cadeira">
            {separadores.map((s) => (
              <li key={s.id} className="nav-item">
                <button
                  type="button"
                  role="tab"
                  aria-selected={separador === s.id}
                  className={`nav-link border-0 bg-transparent ${separador === s.id && !especie ? 'active' : ''}`}
                  onClick={() => setParams({ separador: s.id }, { replace: true })}
                >
                  <i className={`fa ${s.icone} me-1 d-none d-md-inline`} />{s.texto}{contagem[s.id] ? <span className="badge bg-gray-500 ms-1">{contagem[s.id]}</span> : null}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
      {c.descricao && <p className="text-muted">{c.descricao}</p>}


      <div role="tabpanel">
        {especie === 'trabalho' && <><Voltar irPara={irPara} /><Trabalhos {...props} so={Number(atividadeId)} /></>}
        {especie === 'material' && <><Voltar irPara={irPara} /><VerMaterial {...props} so={Number(atividadeId)} /></>}
        {especie === 'inquerito' && <><Voltar irPara={irPara} /><Inquerito {...props} so={Number(atividadeId)} /></>}
        {especie === 'questionario' && <Questionarios {...props} so={Number(atividadeId)} voltar={() => irPara({ separador: 'curso' })} />}
        {!especie && separador === 'curso' && <Curso {...props} />}
        {!especie && separador === 'participantes' && <Participantes {...props} />}
        {!especie && separador === 'grupos' && <Grupos {...props} />}
        {!especie && separador === 'programa' && <Programa {...props} />}
        {!especie && separador === 'avisos' && <AvisosCadeira {...props} />}
        {!especie && separador === 'avaliacoes' && <Avaliacoes {...props} />}
        {!especie && separador === 'presencas' && <Presencas {...props} />}
        {!especie && separador === 'forum' && <Forum {...props} />}
        {!especie && separador === 'progresso' && eDocente && <Progresso {...props} />}
        {!especie && separador === 'horario' && <Datas {...props} />}
      </div>
      <Aviso aviso={aviso} onFechar={() => setAviso(null)} />
    </>
  )
}

function Voltar({ irPara }) {
  return <button type="button" className="btn btn-white mb-3" onClick={() => irPara({ separador: 'curso' })}><i className="fa fa-arrow-left me-1" /> Voltar à cadeira</button>
}

export default Cadeira
