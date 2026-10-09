import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FaSearch } from 'react-icons/fa'
import CabecalhoEditorial from '../../components/CabecalhoEditorial/CabecalhoEditorial'
import EntradaArtigo from './EntradaArtigo'
import { useConteudo } from '../../conteudo/contexto'
import { formatarDataLonga } from '../../utils/datas'
import { iniciais, normalizar } from '../../utils/texto'
import ed from '../../styles/editorial.module.css'
import styles from './Artigos.module.css'

// [[valor, total], ...]
const contar = (lista, chave) =>
  [...lista.reduce((m, a) => m.set(chave(a), (m.get(chave(a)) || 0) + 1), new Map())]

const normas = [
  'Texto original, não publicado noutra revista.',
  'Entre 4 000 e 8 000 palavras, com resumo e palavras-chave.',
  'Referências segundo a norma indicada pelo Departamento.',
  'Envio em formato editável para o Departamento de Investigação.',
]

// Lista de opções com contagem, para a coluna de filtros
function Filtro({ titulo, numero, opcoes, valor, definir }) {
  return (
    <div className={styles.bloco}>
      <h2 className={styles.blocoTitulo}><span>{numero}</span> {titulo}</h2>
      <ul className={styles.opcoes}>
        {opcoes.map(([nome, total]) => (
          <li key={nome}>
            <button
              className={valor === nome ? styles.opcaoAtiva : ''}
              onClick={() => definir(valor === nome ? null : nome)}
              aria-pressed={valor === nome}
            >
              <span>{nome}</span>
              <span className={styles.total}>{String(total).padStart(2, '0')}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Artigos() {
  const { artigos, pessoaPorId } = useConteudo()
  const tipos = contar(artigos, (a) => a.tipo)
  const areas = contar(artigos, (a) => a.area)
  const anos = contar(artigos, (a) => a.data.slice(0, 4))
  const autores = contar(artigos, (a) => a.autor)
    .map(([id, total]) => ({ ...pessoaPorId(id), id, total }))
    .filter((p) => p.nome)
  const [pesquisa, setPesquisa] = useState('')
  const [tipo, setTipo] = useState(null)
  const [area, setArea] = useState(null)
  const [ano, setAno] = useState(null)
  const [autor, setAutor] = useState(null)

  const termo = normalizar(pesquisa.trim())
  const aFiltrar = Boolean(termo || tipo || area || ano || autor)
  const filtrados = artigos.filter((a) => {
    const nomeAutor = pessoaPorId(a.autor)?.nome || ''
    const texto = normalizar(`${a.titulo} ${a.resumo} ${nomeAutor} ${a.palavrasChave.join(' ')}`)
    return (!tipo || a.tipo === tipo) && (!area || a.area === area) && (!ano || a.data.startsWith(ano))
      && (!autor || a.autor === autor) && (!termo || texto.includes(termo))
  })

  const destaque = aFiltrar ? null : artigos[0]
  const lista = filtrados.filter((a) => a !== destaque)
  const autorDestaque = destaque && pessoaPorId(destaque.autor)

  function limpar() {
    setPesquisa('')
    setTipo(null)
    setArea(null)
    setAno(null)
    setAutor(null)
  }

  return (
    <main className={ed.pagina}>
      <CabecalhoEditorial
        sobretitulo="Investigação"
        titulo="Artigos"
      >
        <dl className={styles.numeros}>
          <div><dt>Publicações</dt><dd>{String(artigos.length).padStart(2, '0')}</dd></div>
          <div><dt>Autores</dt><dd>{String(autores.length).padStart(2, '0')}</dd></div>
          <div><dt>Áreas</dt><dd>{String(areas.length).padStart(2, '0')}</dd></div>
        </dl>
      </CabecalhoEditorial>

      {destaque && (
        <section className={styles.destaque} aria-label="Publicação em destaque">
          <div className={styles.destaqueInterior}>
            <div className={styles.destaqueTexto}>
              <span className={ed.rotulo}>Publicação mais recente · {destaque.tipo}</span>
              <h2><Link to={`/Artigos/${destaque.slug}`}>{destaque.titulo}</Link></h2>
              {autorDestaque && (
                <div className={ed.pessoa}>
                  <span className={ed.avatar}>{autorDestaque.foto ? <img src={autorDestaque.foto} alt="" /> : iniciais(autorDestaque.nome)}</span>
                  <div>
                    <strong>{autorDestaque.nome}</strong>
                    <span>{formatarDataLonga(destaque.data)}</span>
                  </div>
                </div>
              )}
              <div className={styles.destaqueResumo}>
                <span className={ed.rotulo}>Resumo</span>
                <p>{destaque.resumo}</p>
              </div>
              <Link to={`/Artigos/${destaque.slug}`} className={ed.ligacao}>Ler o artigo</Link>
            </div>
            {destaque.capa && (
              <Link to={`/Artigos/${destaque.slug}`} className={styles.destaqueFoto} tabIndex={-1} aria-hidden="true">
                <img src={destaque.capa} alt="" />
              </Link>
            )}
          </div>
        </section>
      )}

      <div className={styles.grelha}>
        {/* Esquerda: pesquisa e filtros */}
        <aside className={styles.filtros} aria-label="Pesquisa e filtros">
          <span className={ed.rotulo}>Pesquisa</span>
          <div className={styles.bloco}>
            <h2 className={styles.blocoTitulo}><span>01</span> Palavra-chave</h2>
            <label className={styles.campoPesquisa}>
              <FaSearch aria-hidden="true" />
              <input
                type="search"
                placeholder="Título, autor ou tema"
                value={pesquisa}
                onChange={(e) => setPesquisa(e.target.value)}
                aria-label="Pesquisar artigos"
              />
            </label>
          </div>
          <Filtro titulo="Tipo de publicação" numero="02" opcoes={tipos} valor={tipo} definir={setTipo} />
          <Filtro titulo="Área de investigação" numero="03" opcoes={areas} valor={area} definir={setArea} />
          <Filtro titulo="Ano" numero="04" opcoes={anos} valor={ano} definir={setAno} />
          {aFiltrar && <button className={styles.limpar} onClick={limpar}>Limpar todos os filtros</button>}
        </aside>

        {/* Centro: índice */}
        <section className={styles.centro} aria-label="Índice de publicações">
          <div className={styles.centroTopo}>
            <h2>Índice de publicações</h2>
            <span>{filtrados.length} {filtrados.length === 1 ? 'resultado' : 'resultados'}</span>
          </div>
          {lista.length === 0 && !destaque ? (
            <div className={styles.vazio}>
              <strong>Nenhuma publicação corresponde à pesquisa.</strong>
              <button onClick={limpar}>Limpar filtros</button>
            </div>
          ) : (
            lista.map((a, i) => <EntradaArtigo key={a.slug} artigo={a} numero={String(i + (destaque ? 2 : 1)).padStart(2, '0')} />)
          )}
        </section>

        {/* Direita: autores e submissão */}
        <aside className={styles.direita}>
          <span className={ed.rotulo}>Autores</span>
          <h2 className={styles.direitaTitulo}>Investigadores</h2>
          <ul className={styles.autores}>
            {autores.map((p) => (
              <li key={p.id}>
                <button
                  className={autor === p.id ? styles.autorAtivo : ''}
                  onClick={() => setAutor(autor === p.id ? null : p.id)}
                  aria-pressed={autor === p.id}
                >
                  <span className={styles.autorAvatar}>{p.foto ? <img src={p.foto} alt="" /> : iniciais(p.nome)}</span>
                  <span>
                    <strong>{p.nome}</strong>
                    <small>{p.total} {p.total === 1 ? 'publicação' : 'publicações'}</small>
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <div className={styles.submeter}>
            <span className={ed.rotulo}>Submeter um artigo</span>
            <h3>Normas de publicação</h3>
            <ol className={ed.listaNumerada}>
              {normas.map((n) => <li key={n}>{n}</li>)}
            </ol>
            <Link to="/Contactos#formulario" className={ed.botao}>Propor um artigo</Link>
          </div>
        </aside>
      </div>
    </main>
  )
}

export default Artigos
