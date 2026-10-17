import { useEffect, useMemo, useState } from 'react'
import { api } from '../api'

const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// escolher uma pessoa pelo nome, NIP ou n.º de agente (filtro: { tipo: 'militar' } …)
export default function EscolherPessoa({ aoEscolher, filtro, excluir = [], placeholder = 'Nome, NIP ou n.º de agente…' }) {
  const [todas, setTodas] = useState([])
  const [q, setQ] = useState('')
  const chave = JSON.stringify(filtro ?? {})
  useEffect(() => { api('/pessoas', { consulta: JSON.parse(chave) }).then(setTodas).catch(() => {}) }, [chave])
  const resultados = useMemo(() => {
    const t = norm(q).split(/\s+/).filter(Boolean)
    if (!t.length) return []
    return todas.filter((p) => !excluir.includes(p.id) && t.every((x) => norm(`${p.nome} ${p.nip ?? ''} ${p.numeroAgente ?? ''} ${p.nomeGuerra}`).includes(x))).slice(0, 8)
  }, [q, todas, excluir])
  return (
    <div className="position-relative">
      <input type="search" className="form-control" placeholder={placeholder} value={q} onChange={(e) => setQ(e.target.value)} aria-label="Procurar pessoa" />
      {resultados.length > 0 && (
        <div className="list-group position-absolute w-100 shadow pes-sugestoes">
          {resultados.map((p) => (
            <button key={p.id} type="button" className="list-group-item list-group-item-action" onClick={() => { aoEscolher(p); setQ('') }}>
              <strong>{p.tipo === 'militar' ? `${p.postoAbreviatura} ` : ''}{p.nome}</strong>
              <span className="small text-muted ms-2">{p.nip || p.numeroAgente || ''} · {p.ramo || 'Civil'} {p.unidadeNome && `· ${p.unidadeNome}`}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
