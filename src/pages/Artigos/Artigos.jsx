import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FaSearch } from 'react-icons/fa'
import CabecalhoEditorial from '../../components/CabecalhoEditorial/CabecalhoEditorial'
import EntradaArtigo from './EntradaArtigo'
import { useConteudo } from '../../conteudo/contexto'
import { formatarDataLonga } from '../../utils/datas'
import { iniciais, normalizar } from '../../utils/texto'
import { Etiqueta } from '../../components/Corporativo/Corporativo'
import ed from '../../styles/editorial.module.css'
import styles from './Artigos.module.css'
import { t } from '../../i18n/linguas'

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
function Filtro({ titulo, opcoes, valor, definir }) {
  return (
    <div className={styles.bloco}>
      <h2 className={styles.blocoTitulo}>{titulo}</h2>
      <ul className={styles.opcoes}>
        {opcoes.map(([nome, total]) => (
          <li key={nome}>
            <button
              className={valor === nome ? styles.opcaoAtiva : ''}
              onClick={() => definir(valor === nome ? null : nome)}
              aria-pressed={valor === nome}
            >
              <span>{nome}</span>
              <span className={styles.total}>{total}</span>
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
        migalhas={[{ label: t('Artigos') }]}
        sobretitulo={t('Investigação')}
        titulo={t('Artigos científicos')}
        entrada={t('Artigos, ensaios e notas de investigação do corpo docente e dos oficiais alunos.')}
      >
        <dl className={styles.numeros}>
          <div><dt>{t('Publicações')}</dt><dd>{artigos.length}</dd></div>
          <div><dt>{t('Autores')}</dt><dd>{autores.length}</dd></div>
          <div><dt>{t('Áreas')}</dt><dd>{areas.length}</dd></div>
        </dl>
      </CabecalhoEditorial>

      {destaque && (
        <section className={`contentor ${styles.destaque}`} aria-label={t('Publicação em destaque')}>
          <div className={styles.destaqueInterior}>
            <div className={styles.destaqueTexto}>
              <div className={styles.destaqueRotulo}><span>{t('Publicação mais recente')}</span><Etiqueta>{destaque.tipo}</Etiqueta></div>
              <h2><Link to={`/Artigos/${destaque.slug}`}>{destaque.titulo}</Link></h2>
              {autorDestaque && (
                <div className={ed.pessoa}>
                  <span className={ed.avatar}>{autorDestaque.foto ? <img loading="lazy" decoding="async" src={autorDestaque.foto} alt="" /> : iniciais(autorDestaque.nome)}</span>
                  <div>
                    <strong>{autorDestaque.nome}</strong>
                    <span>{formatarDataLonga(destaque.data)}</span>
                  </div>
                </div>
              )}
              <p className={styles.destaqueResumo}>{destaque.resumo}</p>
              <Link to={`/Artigos/${destaque.slug}`} className={ed.ligacao}>{t('Ler o artigo')}</Link>
            </div>
            {destaque.capa && (
              <Link to={`/Artigos/${destaque.slug}`} className={styles.destaqueFoto} tabIndex={-1} aria-hidden="true">
                <img src={destaque.capa} alt="" />
              </Link>
            )}
          </div>
        </section>
      )}

      <div className={`contentor ${styles.grelha}`}>
        {/* Esquerda: pesquisa e filtros */}
        <aside className={styles.filtros} aria-label={t('Pesquisa e filtros')}>
          <div className={styles.bloco}>
            <label className={styles.campoPesquisa}>
              <FaSearch aria-hidden="true" />
              <input
                type="search"
                placeholder={t('Título, autor ou tema')}
                value={pesquisa}
                onChange={(e) => setPesquisa(e.target.value)}
                aria-label={t('Pesquisar artigos')}
              />
            </label>
          </div>
          <Filtro titulo={t('Tipo de publicação')} opcoes={tipos} valor={tipo} definir={setTipo} />
          <Filtro titulo={t('Área de investigação')} opcoes={areas} valor={area} definir={setArea} />
          <Filtro titulo={t('Ano')} opcoes={anos} valor={ano} definir={setAno} />
          {aFiltrar && <button className={styles.limpar} onClick={limpar}>{t('Limpar todos os filtros')}</button>}
        </aside>

        {/* Centro: índice */}
        <section className={styles.centro} aria-label={t('Índice de publicações')}>
          <div className={styles.centroTopo}>
            <h2>{t('Índice de publicações')}</h2>
            <span>{filtrados.length === 1 ? t('1 resultado') : t('{n} resultados', { n: filtrados.length })}</span>
          </div>
          {lista.length === 0 && !destaque ? (
            <div className={styles.vazio}>
              <strong>{t('Nenhuma publicação corresponde à pesquisa.')}</strong>
              <button onClick={limpar}>{t('Limpar filtros')}</button>
            </div>
          ) : (
            lista.map((a) => <EntradaArtigo key={a.slug} artigo={a} />)
          )}
        </section>

        {/* Direita: autores e submissão */}
        <aside className={styles.direita}>
          <h2 className={styles.direitaTitulo}>{t('Investigadores')}</h2>
          <ul className={styles.autores}>
            {autores.map((p) => (
              <li key={p.id}>
                <button
                  className={autor === p.id ? styles.autorAtivo : ''}
                  onClick={() => setAutor(autor === p.id ? null : p.id)}
                  aria-pressed={autor === p.id}
                >
                  <span className={styles.autorAvatar}>{p.foto ? <img loading="lazy" decoding="async" src={p.foto} alt="" /> : iniciais(p.nome)}</span>
                  <span>
                    <strong>{p.nome}</strong>
                    <small>{p.total === 1 ? t('1 publicação') : t('{n} publicações', { n: p.total })}</small>
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <div className={styles.submeter}>
            <h3>{t('Submeter um artigo')}</h3>
            <span className={styles.submeterSub}>{t('Normas de publicação')}</span>
            <ol className={ed.listaNumerada}>
              {normas.map((n) => <li key={n}>{t(n)}</li>)}
            </ol>
            <Link to="/Contactos#formulario" className={ed.botao}>{t('Propor um artigo')}</Link>
          </div>
        </aside>
      </div>
    </main>
  )
}

export default Artigos
