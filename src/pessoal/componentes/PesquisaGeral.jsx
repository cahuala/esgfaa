import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import Foto from './Foto'

const normalizar = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const CAMPOS = ['nome', 'nomeGuerra', 'nip', 'numeroAgente', 'bi', 'postoNome', 'postoAbreviatura', 'cargoNome', 'unidadeNome', 'telefone', 'email', 'categoriaCivil', 'carreiraNome', 'especialidade', 'quadroEspecial', 'ramoNome', 'situacaoNome', 'estadoNome', 'provincia', 'naturalidade', 'inss']

/*
  Pesquisa geral (no topo de todas as páginas): escreve-se qualquer coisa da pessoa — nome, NIP, n.º de agente,
  BI, nome de guerra, posto, cargo, unidade, telefone, e-mail… — e abre-se a ficha (Enter abre a primeira).
  Cada palavra tem de aparecer nalgum campo: «coronel kiala» encontra os coronéis com Kiala no nome.
*/
// grande: a versão da ficha (por cima do cabeçalho), maior e com outro texto de ajuda
export default function PesquisaGeral({ grande = false }) {
  const navegar = useNavigate()
  const [pessoas, setPessoas] = useState(null)
  const [q, setQ] = useState('')
  const [aberta, setAberta] = useState(false)
  const [activo, setActivo] = useState(0)
  const caixa = useRef(null)
  const carregar = () => { if (!pessoas) api('/pessoas', { consulta: { ativo: 'todos' } }).then((l) => setPessoas(l.map((p) => ({ ...p, _t: normalizar(CAMPOS.map((k) => p[k]).join(' ')) })))).catch(() => setPessoas([])) }
  const res = useMemo(() => {
    const termos = normalizar(q).split(/\s+/).filter(Boolean)
    if (!termos.length || !pessoas) return []
    return pessoas.filter((p) => termos.every((t) => p._t.includes(t))).slice(0, 12)
  }, [q, pessoas])
  const abrir = (p) => { setQ(''); setAberta(false); caixa.current?.blur(); navegar(`/pessoas/${p.id}`) }
  return (
    <div className={`pes-geral ${grande ? 'pes-geral-grande' : ''}`} role="search">
      <i className="fa fa-search pes-geral-icone" aria-hidden="true" />
      <input ref={caixa} type="search" className="form-control pes-geral-caixa" placeholder={grande ? 'Pesquisar outro militar ou civil: nome, NIP, n.º de agente, BI, posto, cargo, unidade, telefone…' : 'Pesquisar: nome, NIP, BI, posto, cargo…'} aria-label="Pesquisar pessoal"
        value={q} onFocus={() => { carregar(); setAberta(true) }} onBlur={() => setTimeout(() => setAberta(false), 150)}
        onChange={(e) => { setQ(e.target.value); setActivo(0); setAberta(true) }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setActivo((a) => Math.min(a + 1, res.length - 1)) }
          if (e.key === 'ArrowUp') { e.preventDefault(); setActivo((a) => Math.max(a - 1, 0)) }
          if (e.key === 'Enter' && res[activo]) abrir(res[activo])
          if (e.key === 'Escape') setAberta(false)
        }} />
      {aberta && q.trim() && (
        <div className="pes-geral-lista shadow" role="listbox">
          {!pessoas && <div className="p-2 small text-muted"><i className="fa fa-spinner fa-spin me-1" />A carregar…</div>}
          {pessoas && !res.length && <div className="p-2 small text-muted">Ninguém com «{q}».</div>}
          {res.map((p, i) => (
            <button key={p.id} type="button" role="option" aria-selected={i === activo} className={`pes-geral-item ${i === activo ? 'activo' : ''}`} onMouseDown={(e) => e.preventDefault()} onClick={() => abrir(p)} onMouseEnter={() => setActivo(i)}>
              <Foto pessoaId={p.id} fotoId={p.fotoId} nome={p.nome} tamanho={34} />
              <span className="text-start lh-sm">
                <strong>{p.tipo === 'militar' ? `${p.postoAbreviatura} ` : ''}{p.nome}</strong>{!p.ativo && <span className="badge bg-secondary ms-1">saiu</span>}
                <small className="d-block text-muted">{[p.nip ? `NIP ${p.nip}` : p.numeroAgente && `Agente ${p.numeroAgente}`, p.cargoNome || p.categoriaCivil, p.unidadeNome].filter(Boolean).join(' · ')}</small>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
