import { useMemo } from 'react'

const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const numerico = (a, b) => String(a).localeCompare(String(b), 'pt', { numeric: true })

/*
  Estante do arquivo dos processos individuais: cada estante com as prateleiras e as
  posições; a pasta com processo é preta, com o n.º, o posto e o nome; as posições livres ficam claras.
  processos: [{ id, numero, estante, prateleira, posicao, nome, abreviatura, nip }]
*/
export default function Estante({ processos, pesquisa = '', aoAbrir, minimoPosicoes = 10 }) {
  const estantes = useMemo(() => {
    const m = new Map()
    for (const p of processos) {
      if (!p.numero || !p.estante || !p.prateleira || !p.posicao) continue
      if (!m.has(p.estante)) m.set(p.estante, new Map())
      const pr = m.get(p.estante)
      if (!pr.has(p.prateleira)) pr.set(p.prateleira, new Map())
      pr.get(p.prateleira).set(String(p.posicao), p)
    }
    return [...m].sort(([a], [b]) => numerico(a, b)).map(([e, pr]) => {
      const prateleiras = [...pr].sort(([a], [b]) => numerico(a, b))
      const max = Math.max(minimoPosicoes, ...prateleiras.flatMap(([, ps]) => [...ps.keys()].map(Number).filter(Number.isFinite)))
      return { estante: e, prateleiras, posicoes: Array.from({ length: max }, (_, i) => String(i + 1)), total: prateleiras.reduce((s, [, ps]) => s + ps.size, 0) }
    })
  }, [processos, minimoPosicoes])
  const termos = norm(pesquisa).split(/\s+/).filter(Boolean)
  const destaca = (p) => termos.length && termos.every((t) => norm(`${p.numero} ${p.nome} ${p.nip ?? ''} ${p.numeroAgente ?? ''}`).includes(t))

  if (!estantes.length) return <p className="text-muted">Ainda não há processos arrumados nas estantes. Indique a estante, a prateleira e a posição no processo de cada um.</p>
  return (
    <div className="pes-estantes">
      {estantes.map((e) => (
        <div key={e.estante} className="pes-estante">
          <div className="pes-estante-titulo"><i className="fa fa-archive me-2" />Estante {e.estante}<span className="ms-auto small fw-normal">{e.total} processo(s) · {e.prateleiras.length * e.posicoes.length - e.total} posição(ões) livre(s)</span></div>
          {e.prateleiras.map(([n, ps]) => (
            <div key={n} className="pes-prateleira">
              <div className="pes-prateleira-n" title={`Prateleira ${n}`}>P{n}</div>
              <div className="pes-pastas">
                {e.posicoes.map((pos) => {
                  const p = ps.get(pos)
                  if (!p) return <div key={pos} className="pes-pasta livre" title={`Estante ${e.estante} › Prateleira ${n} › Posição ${pos}: livre`}><span className="pes-pasta-pos">{pos}</span></div>
                  return (
                    <button key={pos} type="button" className={`pes-pasta ocupada ${destaca(p) ? 'destaque' : ''}`} onClick={() => aoAbrir(p)} title={`${p.numero} — ${p.abreviatura} ${p.nome}${p.nip ? ` (NIP ${p.nip})` : ''}\nEstante ${e.estante} › Prateleira ${n} › Posição ${pos}`}>
                      <span className="pes-pasta-num">{p.numero.replace('PI-', '')}</span>
                      <span className="pes-pasta-nome">{p.abreviatura} {p.nome.split(' ')[0]} {p.nome.split(' ').at(-1)}</span>
                      <span className="pes-pasta-argola" />
                      <span className="pes-pasta-pos">{pos}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
