import { Link } from 'react-router-dom'
import { iniciais } from '../../utils/texto'
import { t } from '../../i18n/linguas'
import styles from './Organograma.module.css'

/*
  Organograma da Escola, montado a partir da lista de órgãos (editada no painel, em Páginas → Institucional):
  cada órgão diz de quem depende («Depende de») e se é de linha ou de apoio (assessoria, ao lado). O que
  não depende de ninguém fica no topo.
*/
export default function Organograma({ orgaos, pessoas = [] }) {
  const nomes = new Set(orgaos.map((o) => o.nome))
  const filhos = (nome) => orgaos.filter((o) => o.dependeDe === nome && o.nome !== nome)
  const raizes = orgaos.filter((o) => !o.dependeDe || !nomes.has(o.dependeDe))
  const pessoa = (id) => pessoas.find((p) => p.id === id)

  // cada órgão aparece uma só vez (uma dependência em círculo não prende a página)
  const vistos = new Set()
  function ramo(o, nivel) {
    if (vistos.has(o.nome)) return null
    vistos.add(o.nome)
    const f = filhos(o.nome)
    const apoio = f.filter((x) => x.tipo === 'apoio')
    const linha = f.filter((x) => x.tipo !== 'apoio')
    return (
      <li key={o.nome} className={nivel === 0 ? styles.raiz : nivel === 1 ? styles.n1 : styles.n2}>
        <Caixa o={o} p={pessoa(o.responsavel)} topo={nivel === 0} />
        {apoio.length > 0 && <ul className={styles.apoio} aria-label={t('Órgãos de apoio')}>{apoio.map((a) => ramo(a, 9))}</ul>}
        {linha.length > 0 && <ul className={nivel === 0 ? styles.linha : styles.lista}>{linha.map((x) => ramo(x, nivel + 1))}</ul>}
      </li>
    )
  }
  if (!orgaos.length) return null
  return (
    <div className={styles.organograma}>
      <ul className={styles.topo}>{raizes.map((o) => ramo(o, 0))}</ul>
      {orgaos.some((o) => o.tipo === 'apoio') && <p className={styles.legenda}><span className={styles.tracejado} aria-hidden="true" /> {t('Órgão de apoio (assessoria)')}</p>}
    </div>
  )
}

function Caixa({ o, p, topo }) {
  const conteudo = (
    <>
      {topo && p && <span className={styles.foto}>{p.foto ? <img loading="lazy" decoding="async" src={p.foto} alt="" /> : iniciais(p.nome)}</span>}
      <span className={styles.nome}>{o.sigla ? <><abbr title={o.nome}>{o.sigla}</abbr> · </> : null}{o.nome}</span>
      {p && <span className={styles.responsavel}>{p.nome}{p.cargo ? ` · ${p.cargo}` : ''}</span>}
      {o.texto && <span className={styles.texto}>{o.texto}</span>}
    </>
  )
  const cls = `${styles.caixa} ${topo ? styles.caixaTopo : ''} ${o.tipo === 'apoio' ? styles.caixaApoio : ''}`
  if (!o.ligacao) return <div className={cls}>{conteudo}</div>
  return /^https?:/.test(o.ligacao)
    ? <a className={`${cls} ${styles.comLigacao}`} href={o.ligacao} target="_blank" rel="noreferrer">{conteudo}</a>
    : <Link className={`${cls} ${styles.comLigacao}`} to={o.ligacao}>{conteudo}</Link>
}
