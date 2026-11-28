import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAnoTrabalho } from '../anoTrabalho'
import FotoConta from './FotoConta'
import { t as tx } from '../../i18n/linguas'

/*
  A pesquisa em todo o sistema, no cabeçalho: escreve-se o nome, o NIP ou o número de um estudante ou docente,
  uma turma (ou a sigla do curso) ou uma cadeira, e um clique leva à ficha, à turma ou ao lançamento das notas.
  Perdoa os acentos e um erro de escrita. As turmas e as cadeiras são as do ano lectivo do menu. Atalho: «/».
*/
export default function PesquisaGlobal() {
  const { ano } = useAnoTrabalho()
  const navegar = useNavigate()
  const { pathname } = useLocation()
  const [q, setQ] = useState('')
  const [r, setR] = useState(null)
  // aberta no endereço em que se abriu: ao mudar de página fica fechada
  const [abertaEm, setAbertaEm] = useState(null)
  const aberta = abertaEm === pathname
  const setAberta = (v) => setAbertaEm(v ? pathname : null)
  const caixa = useRef(null)

  useEffect(() => {
    const termo = q.trim()
    if (termo.length < 2) return undefined
    let vivo = true
    const t = setTimeout(() => {
      api(`/academico/procurar?q=${encodeURIComponent(termo)}${ano ? `&anoLetivo=${encodeURIComponent(ano)}` : ''}`).then((x) => { if (vivo) setR(x) }).catch(() => { if (vivo) setR({ pessoas: [], turmas: [], cadeiras: [] }) })
    }, 250)
    return () => { vivo = false; clearTimeout(t) }
  }, [q, ano])
  // «/» em qualquer ecrã põe o cursor na pesquisa
  useEffect(() => {
    const tecla = (e) => {
      if (e.key !== '/' || /input|textarea|select/i.test(e.target?.tagName) || e.target?.isContentEditable) return
      e.preventDefault()
      caixa.current?.focus()
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [])

  const ir = (para) => { setAberta(false); setQ(''); setR(null); navegar(para) }
  const vazio = r && !r.pessoas.length && !r.turmas.length && !r.cadeiras.length
  const mostrar = aberta && q.trim().length >= 2 && r
  const primeiro = r?.pessoas[0] ? `/pessoal/registo/${r.pessoas[0].id}/ficha` : r?.turmas[0] ? `/academico/turmas/${r.turmas[0].id}` : r?.cadeiras[0] ? `/academico/cadeiras/${r.cadeiras[0].id}?separador=pauta` : null

  return (
    <div className="navbar-item esg-pesquisa" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setAberta(false) }}>
      <form role="search" onSubmit={(e) => { e.preventDefault(); if (primeiro) ir(primeiro) }}>
        <i className="fa fa-search esg-pesquisa-icone" aria-hidden="true" />
        <input ref={caixa} type="search" className="form-control form-control-sm" placeholder={tx('Procurar estudante, docente, NIP, turma, cadeira…')} aria-label={tx('Procurar em todo o sistema')}
          value={q} onChange={(e) => { setQ(e.target.value); setAberta(true); if (e.target.value.trim().length < 2) setR(null) }} onFocus={() => setAberta(true)} onKeyDown={(e) => { if (e.key === 'Escape') setAberta(false) }} />
      </form>
      {mostrar && (
        <div className="esg-pesquisa-lista shadow" role="listbox">
          {vazio && <div className="p-3 small text-muted">{tx('Nada encontrado com «{0}».', { 0: q.trim() })}</div>}
          {r.pessoas.length > 0 && <div className="esg-pesquisa-grupo">{tx('Pessoas')}</div>}
          {r.pessoas.map((p) => (
            <button key={`p${p.id}`} type="button" className="esg-pesquisa-item" onClick={() => ir(`/pessoal/registo/${p.id}/ficha`)}>
              <FotoConta id={p.id} nome={p.nome} temFoto={p.temFoto} tamanho={28} />
              <span><b>{[p.posto, p.nome].filter(Boolean).join(' ')}</b><small>{[p.tipo === 'docente' ? tx('Docente') : tx('Estudante'), p.nip && `NIP ${p.nip}`, p.numero, !p.ativo && tx('inactivo')].filter(Boolean).join(' · ')}</small></span>
            </button>
          ))}
          {r.turmas.length > 0 && <div className="esg-pesquisa-grupo">{tx('Turmas ({0})', { 0: ano })}</div>}
          {r.turmas.map((t) => (
            <button key={`t${t.id}`} type="button" className="esg-pesquisa-item" onClick={() => ir(`/academico/turmas/${t.id}`)}>
              <i className="fa fa-users fa-fw text-muted" /><span><b>{t.nome}</b><small>{t.anoLetivo}</small></span>
            </button>
          ))}
          {r.cadeiras.length > 0 && <div className="esg-pesquisa-grupo">{tx('Cadeiras — lançar notas ({0})', { 0: ano })}</div>}
          {r.cadeiras.map((c) => (
            <button key={`c${c.id}`} type="button" className="esg-pesquisa-item" onClick={() => ir(`/academico/cadeiras/${c.id}?separador=pauta`)}>
              <i className="fa fa-pen fa-fw text-muted" /><span><b>{c.codigo} — {c.nome}</b><small>{c.turma}</small></span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
