import { Escolha } from './Ui'
import { Link } from 'react-router-dom'

/*
  Situação do militar em árvore (Lei n.º 13/18, como no SIGP):
  Activo → Em efectividade (comissão normal, inactividade temporária) | Fora de efectividade (comissão especial,
  licença registada, licença ilimitada); Reserva; Reforma. Na ficha guarda-se situação + efectividade.
*/

// escolha numa só lista, agrupada pelos ramos da árvore
export function EscolhaSituacao({ arvore, situacao, efectividade, aoMudar, ...resto }) {
  const valor = situacao === 'activo' ? `activo|${efectividade || 'comissao_normal'}` : `${situacao || 'activo'}|`
  const mudar = (v) => {
    const [s, e] = v.split('|')
    aoMudar({ situacao: s, efectividade: s === 'activo' ? e : null })
  }
  // lista com pesquisa: cada efectividade com o caminho (Activo › grupo › efectividade)
  const opcoes = arvore.flatMap((s) => (s.filhos.length ? s.filhos.flatMap((g) => g.filhos.map((f) => [`${s.id}|${f.id}`, `${s.nome} › ${g.nome} › ${f.nome} (${f.artigo})`])) : [[`${s.id}|`, `${s.nome} (${s.artigo})`]]))
  return <Escolha valor={valor} aoMudar={mudar} opcoes={opcoes} vazio={null} id={resto.id} disabled={resto.disabled} aria-label={resto['aria-label']} />
}

function No({ nome, artigo, n, para, nivel, children }) {
  return (
    <li className={`pes-arvore-sit n${nivel}`}>
      <div className="d-flex align-items-center gap-2">
        <Link to={para} className="flex-grow-1 text-decoration-none text-body">
          <span className={nivel === 0 ? 'fw-bold' : nivel === 1 ? 'fw-semibold' : ''}>{nome}</span> <small className="text-muted">{artigo}</small>
        </Link>
        <span className={`badge ${n ? 'bg-theme' : 'bg-light text-muted border'}`}>{n}</span>
      </div>
      {children && <ul>{children}</ul>}
    </li>
  )
}

// a árvore com o número de militares em cada ramo (cada um leva à lista filtrada)
export function ArvoreSituacoes({ arvore, militares }) {
  const conta = (s, e) => militares.filter((p) => p.situacao === s && (!e || (Array.isArray(e) ? e.includes(p.efectividade) : p.efectividade === e))).length
  return (
    <ul className="pes-arvore-sits">
      {arvore.map((s) => (
        <No key={s.id} nome={s.nome} artigo={s.artigo} n={conta(s.id)} para={`/pessoas?tipo=militar&situacao=${s.id}`} nivel={0}>
          {s.filhos.length > 0 && s.filhos.map((g) => (
            <No key={g.id} nome={g.nome} artigo={g.artigo} n={conta(s.id, g.filhos.map((f) => f.id))} para={`/pessoas?tipo=militar&situacao=${s.id}`} nivel={1}>
              {g.filhos.map((f) => <No key={f.id} nome={f.nome} artigo={f.artigo} n={conta(s.id, f.id)} para={`/pessoas?tipo=militar&situacao=${s.id}&efectividade=${f.id}`} nivel={2} />)}
            </No>
          ))}
        </No>
      ))}
    </ul>
  )
}
