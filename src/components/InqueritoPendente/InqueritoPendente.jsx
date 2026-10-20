import { Suspense, lazy, useEffect, useState } from 'react'
import { API_URL } from '../../conteudo/api'
import { comSessao, temSessao } from '../../portal/api'
import { data as formatarData } from '../../portal/formatar'
import { t } from '../../i18n/linguas'
import styles from './InqueritoPendente.module.css'

const JanelaInquerito = lazy(() => import('./JanelaInquerito'))
const ESCONDIDO = 'esgfaa-inqueritos-agora-nao'

/*
  Quem tem sessão aberta no portal (estudante, docente…) e visita o site vê aqui os inquéritos que tem por
  responder: os da Escola e a avaliação dos docentes das suas cadeiras. Responde-se no próprio site (numa
  janela, com o mesmo formulário do portal) ou abre-se o portal. «Agora não» esconde até fechar o navegador.
*/
function InqueritoPendente() {
  const [lista, setLista] = useState([])
  const [aberto, setAberto] = useState(null)
  const [fechado, setFechado] = useState(() => { try { return sessionStorage.getItem(ESCONDIDO) === '1' } catch { return false } })
  const [expandido, setExpandido] = useState(false)

  useEffect(() => {
    if (!API_URL || !temSessao() || fechado) return undefined
    let ativo = true
    fetch(`${API_URL}/api/portal/inqueritos-pendentes`, comSessao())
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (ativo && d) setLista([...d.escola, ...d.avaliacoes]) })
      .catch(() => {})
    return () => { ativo = false }
  }, [fechado])

  if (fechado || !lista.length) return null
  const agoraNao = () => { try { sessionStorage.setItem(ESCONDIDO, '1') } catch { /* sem armazenamento */ } setFechado(true) }
  const portal = (i) => `${import.meta.env.BASE_URL}portal/#/${i.tipo === 'escola' ? `inqueritos/${i.id}` : `cadeiras/${i.cadeira.id}?atividade=inquerito-${i.id}`}`
  const um = lista.length === 1
  return (
    <>
      <aside className={styles.aviso} aria-label={t('Inquéritos por responder')}>
        <div className={styles.topo}>
          <span className={styles.icone} aria-hidden="true">?</span>
          <div className={styles.texto}>
            <strong>{um ? t('Tem um inquérito por responder') : t('Tem {0} inquéritos por responder', { 0: lista.length })}</strong>
            <span>{t('A sua opinião é anónima e ajuda a melhorar a Escola.')}</span>
          </div>
          <button type="button" className={styles.fechar} onClick={agoraNao} aria-label={t('Agora não')} title={t('Agora não')}>×</button>
        </div>
        <ul className={styles.lista}>
          {(expandido || um ? lista : lista.slice(0, 2)).map((i) => (
            <li key={`${i.tipo}-${i.id}`}>
              <div className={styles.item}>
                <b>{i.titulo}</b>
                <span>{i.tipo === 'avaliacao' ? `${i.cadeira.codigo} ${i.cadeira.nome}${i.docente ? ` · ${i.docente}` : ''}` : t('Inquérito da Escola')}{i.fecha ? ` · ${t('até {0}', { 0: formatarData(i.fecha) })}` : ''}</span>
              </div>
              <div className={styles.acoes}>
                <button type="button" className={styles.responder} onClick={() => setAberto(i)}>{t('Responder')}</button>
                <a href={portal(i)} className={styles.noPortal}>{t('No portal')}</a>
              </div>
            </li>
          ))}
        </ul>
        {!expandido && lista.length > 2 && <button type="button" className={styles.mais} onClick={() => setExpandido(true)}>{t('Ver os {0}', { 0: lista.length })}</button>}
      </aside>
      {aberto && (
        <Suspense fallback={null}>
          <JanelaInquerito inquerito={aberto} aoFechar={() => setAberto(null)} aoResponder={() => setLista((l) => l.filter((x) => !(x.tipo === aberto.tipo && x.id === aberto.id)))} />
        </Suspense>
      )}
    </>
  )
}

export default InqueritoPendente
