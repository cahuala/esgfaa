import './biblioteca.css'
import { t as tx } from '../../i18n/linguas'

// paletas sóbrias (fundo, texto, destaque), escolhidas pela obra: a mesma obra tem sempre a mesma capa
const PALETAS = [
  ['#14213d', '#f4ead5', '#c9a227'], ['#5c1a1b', '#f3e9dc', '#d4a373'], ['#1f3d2b', '#eef0e5', '#c8a951'],
  ['#2b2d42', '#edf2f4', '#ef6351'], ['#0b3954', '#f2f4f3', '#ff9f1c'], ['#3d2c4e', '#f5efe6', '#e0b354'],
  ['#6b3410', '#fdf6ec', '#e9c46a'], ['#e9e3d5', '#1b1b1b', '#9b2226'], ['#264653', '#f1faee', '#e9c46a'],
]
const DESENHOS = ['classico', 'moderno', 'faixa', 'geometrico']
const ACADEMICOS = { tese: tx('Tese / dissertação'), tfc: tx('Trabalho de fim de curso'), monografia: tx('Monografia') }

function hash(s) {
  let h = 2166136261
  for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return Math.abs(h)
}

// título mais longo, letra mais pequena (as medidas são relativas à largura da capa)
const tamanho = (t) => (t.length < 16 ? 13 : t.length < 30 ? 11 : t.length < 55 ? 9 : 7.5)
const apelido = (a) => a.replace(/^(\S+\.\s*)+/, '')

function Ornamento() {
  return (
    <svg className="b-ornamento" viewBox="0 0 120 12" aria-hidden="true">
      <line x1="0" y1="6" x2="48" y2="6" /><path d="M60 0 L66 6 L60 12 L54 6 Z" /><line x1="72" y1="6" x2="120" y2="6" />
    </svg>
  )
}

/*
  Capa de uma obra: a imagem carregada pela biblioteca ou, sem ela, uma capa desenhada
  (clássica, moderna, com faixa ou geométrica; académica para teses e TFC; revista).
*/
function Capa({ o, className = '' }) {
  const h = hash(`${o.id}|${o.titulo}`)
  const [fundo, texto, acento] = PALETAS[h % PALETAS.length]
  const autores = (o.autores || []).slice(0, 2)
  const estilo = { '--c-fundo': fundo, '--c-texto': texto, '--c-acento': acento, '--c-titulo': `${tamanho(o.titulo)}cqw` }
  const rotulo = `${o.titulo}${autores.length ? tx(', de {0}', { 0: autores.join(' e ') }) : ''}`

  if (o.capa) {
    return (
      <div className={`b-capa b-capa--imagem ${className}`} role="img" aria-label={rotulo}>
        <img src={o.capa} alt="" loading="lazy" />
      </div>
    )
  }

  if (ACADEMICOS[o.tipo]) {
    return (
      <div className={`b-capa b-capa--academico ${className}`} style={estilo} role="img" aria-label={rotulo}>
        <div className="b-interior">
        <div className="b-acad-topo"><img src="/Logo.png" alt="" /><span>{tx('Escola Superior de Guerra')}</span></div>
        <div className="b-acad-corpo">
          <div className="b-titulo">{o.titulo}</div>
          {o.subtitulo && <div className="b-subtitulo">{o.subtitulo}</div>}
          <Ornamento />
          <div className="b-autor">{autores.join(' · ')}</div>
        </div>
        <div className="b-acad-pe">{ACADEMICOS[o.tipo]}{o.ano ? ` · ${o.ano}` : ''}</div>
        </div>
      </div>
    )
  }

  if (o.tipo === 'revista' || o.tipo === 'artigo') {
    return (
      <div className={`b-capa b-capa--revista ${className}`} style={estilo} role="img" aria-label={rotulo}>
        <div className="b-interior">
        <div className="b-rev-cabeca">{o.tipo === 'revista' ? tx('Revista') : tx('Artigo')}{o.ano ? <span>{o.ano}</span> : null}</div>
        <div className="b-rev-arte" aria-hidden="true"><i /><i /><i /></div>
        <div className="b-titulo">{o.titulo}</div>
        <div className="b-autor">{autores.join(' · ')}</div>
        </div>
      </div>
    )
  }

  const desenho = DESENHOS[(h >> 4) % DESENHOS.length]
  return (
    <div className={`b-capa b-capa--${desenho} ${className}`} style={estilo} role="img" aria-label={rotulo}>
      <div className="b-interior">
      {desenho === 'classico' && (
        <div className="b-moldura">
          <div className="b-autor">{autores.map(apelido).join(' · ')}</div>
          <div><div className="b-titulo">{o.titulo}</div><Ornamento />{o.subtitulo && <div className="b-subtitulo">{o.subtitulo}</div>}</div>
          <div className="b-editora">{o.editora}</div>
        </div>
      )}
      {desenho === 'moderno' && (
        <>
          <div className="b-mod-bloco"><div className="b-titulo">{o.titulo}</div>{o.subtitulo && <div className="b-subtitulo">{o.subtitulo}</div>}</div>
          <div className="b-mod-pe"><span className="b-autor">{autores.join(' · ')}</span><i /></div>
        </>
      )}
      {desenho === 'faixa' && (
        <>
          <div className="b-autor">{autores.join(' · ')}</div>
          <div className="b-faixa"><div className="b-titulo">{o.titulo}</div></div>
          <div className="b-editora">{o.editora}{o.ano ? ` · ${o.ano}` : ''}</div>
        </>
      )}
      {desenho === 'geometrico' && (
        <>
          <svg className="b-geo-arte" viewBox="0 0 100 100" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
            {[46, 36, 26, 16].map((r) => <circle key={r} cx={h % 2 ? 78 : 22} cy="26" r={r} />)}
            <path d={`M0 ${58 + (h % 9)} L100 ${44 + (h % 13)}`} />
          </svg>
          <div className="b-geo-texto"><div className="b-titulo">{o.titulo}</div><div className="b-autor">{autores.join(' · ')}</div></div>
        </>
      )}
      </div>
    </div>
  )
}

export default Capa
