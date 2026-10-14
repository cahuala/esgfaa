import { useCallback, useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { useSessao } from '../sessaoContexto'
import { Aviso, Carregando, Erro } from '../componentes'
import { PERIODOS } from '../regraAvaliacao'
import Programa from './Programa'
import Materiais from './Materiais'
import AvisosCadeira from './AvisosCadeira'
import Trabalhos from './Trabalhos'
import Avaliacoes from './Avaliacoes'
import Presencas from './Presencas'
import Forum from './Forum'
import Questionarios from './Questionarios'
import Progresso, { BarraProgresso } from './Progresso'
import Datas from './Datas'

const SEPARADORES = [
  { id: 'materiais', texto: 'Materiais' },
  { id: 'programa', texto: 'Programa' },
  { id: 'avisos', texto: 'Avisos' },
  { id: 'forum', texto: 'Fórum' },
  { id: 'trabalhos', texto: 'Trabalhos' },
  { id: 'questionarios', texto: 'Questionários' },
  { id: 'avaliacoes', texto: 'Notas' },
  { id: 'presencas', texto: 'Presenças' },
  { id: 'progresso', texto: 'Progresso', docente: true },
  { id: 'horario', texto: 'Datas e horário' },
]

// uma cadeira: separadores com tudo o que lhe diz respeito (vista do estudante ou do docente)
function Cadeira() {
  const { id } = useParams()
  const { eDocente } = useSessao()
  const [params, setParams] = useSearchParams()
  const separador = SEPARADORES.some((s) => s.id === params.get('separador')) ? params.get('separador') : 'materiais'
  const [c, setC] = useState(null)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState(null)
  const [progresso, setProgresso] = useState(null)

  const carregar = useCallback(() => {
    api(`/cadeiras/${id}`).then((r) => { setErro(''); setC(r) }).catch((e) => setErro(e.message))
    if (!eDocente) api(`/cadeiras/${id}/progresso`).then(setProgresso).catch(() => {})
  }, [id, eDocente])
  useEffect(() => { carregar() }, [carregar])

  if (erro) return <Erro texto={erro} />
  if (!c) return <Carregando />

  const props = { c, eDocente, recarregar: carregar, avisar: setAviso, progresso, setProgresso }
  const separadores = SEPARADORES.filter((s) => !s.docente || eDocente)
  const contagem = { materiais: c.materiais.length, avisos: c.avisos.length, trabalhos: c.trabalhos.length }

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
                  className={`nav-link border-0 bg-transparent ${separador === s.id ? 'active' : ''}`}
                  onClick={() => setParams({ separador: s.id }, { replace: true })}
                >
                  {s.texto}{contagem[s.id] ? <span className="badge bg-gray-500 ms-1">{contagem[s.id]}</span> : null}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
      {c.descricao && <p className="text-muted">{c.descricao}</p>}
      {!eDocente && progresso?.total > 0 && (
        <div className="panel mb-3">
          <div className="panel-body py-2 d-flex align-items-center gap-3">
            <span className="small fw-bold text-nowrap"><i className="fa fa-tasks me-1" />O meu progresso</span>
            <div className="flex-grow-1"><BarraProgresso p={progresso} /></div>
            <span className="small text-muted text-nowrap">{progresso.feitas} de {progresso.total} atividades</span>
          </div>
        </div>
      )}

      <div role="tabpanel">
        {separador === 'materiais' && <Materiais {...props} />}
        {separador === 'programa' && <Programa {...props} />}
        {separador === 'avisos' && <AvisosCadeira {...props} />}
        {separador === 'trabalhos' && <Trabalhos {...props} />}
        {separador === 'avaliacoes' && <Avaliacoes {...props} />}
        {separador === 'presencas' && <Presencas {...props} />}
        {separador === 'forum' && <Forum {...props} />}
        {separador === 'questionarios' && <Questionarios {...props} />}
        {separador === 'progresso' && eDocente && <Progresso {...props} />}
        {separador === 'horario' && <Datas {...props} />}
      </div>
      <Aviso aviso={aviso} onFechar={() => setAviso(null)} />
    </>
  )
}

export default Cadeira
