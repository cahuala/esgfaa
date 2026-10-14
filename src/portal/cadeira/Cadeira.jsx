import { useCallback, useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { useSessao } from '../sessaoContexto'
import { Aviso, Carregando, Erro } from '../componentes'
import { DIAS } from '../formatar'
import { PERIODOS } from '../regraAvaliacao'
import Programa from './Programa'
import Materiais from './Materiais'
import AvisosCadeira from './AvisosCadeira'
import Trabalhos from './Trabalhos'
import Avaliacoes from './Avaliacoes'
import Presencas from './Presencas'

const SEPARADORES = [
  { id: 'materiais', texto: 'Materiais' },
  { id: 'programa', texto: 'Programa' },
  { id: 'avisos', texto: 'Avisos' },
  { id: 'trabalhos', texto: 'Trabalhos' },
  { id: 'avaliacoes', texto: 'Notas' },
  { id: 'presencas', texto: 'Presenças' },
  { id: 'horario', texto: 'Horário' },
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

  const carregar = useCallback(() => api(`/cadeiras/${id}`).then((r) => { setErro(''); setC(r) }).catch((e) => setErro(e.message)), [id])
  useEffect(() => { carregar() }, [carregar])

  if (erro) return <Erro texto={erro} />
  if (!c) return <Carregando />

  const props = { c, eDocente, recarregar: carregar, avisar: setAviso }
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
            {SEPARADORES.map((s) => (
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

      <div role="tabpanel">
        {separador === 'materiais' && <Materiais {...props} />}
        {separador === 'programa' && <Programa {...props} />}
        {separador === 'avisos' && <AvisosCadeira {...props} />}
        {separador === 'trabalhos' && <Trabalhos {...props} />}
        {separador === 'avaliacoes' && <Avaliacoes {...props} />}
        {separador === 'presencas' && <Presencas {...props} />}
        {separador === 'horario' && (
          c.horario.length === 0 ? <p className="p-vazio">Sem horário publicado.</p> : (
            <ul className="p-lista panel panel-body">
              {c.horario.map((h) => <li key={h.id}><strong>{DIAS[h.diaSemana]}</strong>, {h.inicio}–{h.fim}{h.sala && ` · ${h.sala}`}</li>)}
            </ul>
          )
        )}
      </div>
      <Aviso aviso={aviso} onFechar={() => setAviso(null)} />
    </>
  )
}

export default Cadeira
