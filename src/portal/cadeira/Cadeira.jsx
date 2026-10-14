import { useCallback, useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { FaArrowLeft } from 'react-icons/fa'
import { api } from '../api'
import { useSessao } from '../sessaoContexto'
import { Aviso, Carregando, Erro } from '../componentes'
import { DIAS } from '../formatar'
import Materiais from './Materiais'
import AvisosCadeira from './AvisosCadeira'
import Trabalhos from './Trabalhos'
import Avaliacoes from './Avaliacoes'
import Presencas from './Presencas'

const SEPARADORES = [
  { id: 'materiais', texto: 'Materiais' },
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
      <header className="p-titulo p-cadeira-cabeca">
        <div>
          <Link to="/cadeiras" className="p-voltar"><FaArrowLeft aria-hidden="true" /> Cadeiras</Link>
          <span className="p-rotulo">{c.codigo} · {c.semestre}.º semestre{c.horas ? ` · ${c.horas} horas` : ''} · {c.turma?.nome}</span>
          <h1>{c.nome}</h1>
          <p className="p-titulo-sub">{c.docente ? `Docente: ${c.docente.nome}` : 'Docente por atribuir'}{c.descricao ? ` — ${c.descricao}` : ''}</p>
        </div>
      </header>

      <nav className="p-separadores" role="tablist" aria-label="Secções da cadeira">
        {SEPARADORES.map((s) => (
          <button
            key={s.id}
            role="tab"
            aria-selected={separador === s.id}
            className={separador === s.id ? 'p-sep-ativo' : ''}
            onClick={() => setParams({ separador: s.id }, { replace: true })}
          >
            {s.texto}{contagem[s.id] ? <span>{contagem[s.id]}</span> : null}
          </button>
        ))}
      </nav>

      <div role="tabpanel">
        {separador === 'materiais' && <Materiais {...props} />}
        {separador === 'avisos' && <AvisosCadeira {...props} />}
        {separador === 'trabalhos' && <Trabalhos {...props} />}
        {separador === 'avaliacoes' && <Avaliacoes {...props} />}
        {separador === 'presencas' && <Presencas {...props} />}
        {separador === 'horario' && (
          c.horario.length === 0 ? <p className="p-vazio">Sem horário publicado.</p> : (
            <ul className="p-lista p-cartao p-cartao-corpo">
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
