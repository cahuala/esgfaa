import { useEffect, useState } from 'react'
import { API_URL } from '../../conteudo/api'
import { comSessao } from '../../portal/api'
import FormularioInquerito from '../../portal/inquerito/FormularioInquerito'
import { data as formatarData } from '../../portal/formatar'
import { t } from '../../i18n/linguas'
import styles from './InqueritoPendente.module.css'

// o inquérito numa janela do site, com o formulário do portal (inquérito da Escola ou avaliação do docente)
function JanelaInquerito({ inquerito, aoFechar, aoResponder }) {
  const base = `${API_URL}/api/portal/${inquerito.tipo === 'escola' ? 'inqueritos-escola' : 'inqueritos'}/${inquerito.id}`
  const [i, setI] = useState(null)
  const [erro, setErro] = useState('')
  const [respostas, setRespostas] = useState({})
  const [aEnviar, setAEnviar] = useState(false)
  const [feito, setFeito] = useState(false)

  useEffect(() => {
    fetch(base, comSessao()).then(async (r) => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.erro || t('Não foi possível abrir o inquérito.')); setI(d) }).catch((e) => setErro(e.message))
  }, [base])
  useEffect(() => {
    const esc = (e) => { if (e.key === 'Escape') aoFechar() }
    document.addEventListener('keydown', esc)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', esc); document.body.style.overflow = '' }
  }, [aoFechar])

  async function enviar() {
    setAEnviar(true)
    setErro('')
    try {
      const o = comSessao({ 'Content-Type': 'application/json' })
      const r = await fetch(`${base}/respostas`, { ...o, method: 'POST', body: JSON.stringify({ respostas }) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.erro || t('Não foi possível enviar.'))
      setFeito(true)
      aoResponder()
    } catch (e) {
      setErro(e.message)
    } finally {
      setAEnviar(false)
    }
  }

  return (
    <div className={styles.fundo} role="dialog" aria-modal="true" aria-label={inquerito.titulo} onClick={(e) => { if (e.target === e.currentTarget) aoFechar() }}>
      <div className={styles.janela}>
        <button type="button" className={styles.fecharJanela} onClick={aoFechar} aria-label={t('Fechar')}>×</button>
        {erro && <p className={styles.erro} role="alert">{erro}</p>}
        {!i && !erro && <p className={styles.espera}>{t('A abrir o inquérito…')}</p>}
        {i && (
          <FormularioInquerito
            titulo={i.titulo}
            descricao={i.descricao}
            anonimo={inquerito.tipo === 'escola' || i.anonimo !== false}
            rodape={i.fecha ? <div className="gf-notas pt-0 border-0 mt-2"><span>{t('responder até {0}', { 0: formatarData(i.fecha) })}</span></div> : null}
            perguntas={i.perguntas}
            respostas={respostas}
            definir={(k, v) => setRespostas((r) => ({ ...r, [k]: v }))}
            limpar={() => setRespostas({})}
            aoEnviar={enviar}
            aEnviar={aEnviar}
            estado={feito || i.respondido ? (
              <div className="gf-feito">
                <b>{t('A sua resposta foi registada. Obrigado.')}</b>
                <button type="button" className={styles.responder} onClick={aoFechar}>{t('Fechar')}</button>
              </div>
            ) : i.podeResponder === false ? <div className="gf-feito"><b>{t('Este inquérito já fechou.')}</b></div> : null}
          />
        )}
      </div>
    </div>
  )
}

export default JanelaInquerito
