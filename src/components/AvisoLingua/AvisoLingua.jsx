import { linguaAtual, t } from '../../i18n/linguas'

// aviso quando um conteúdo ainda não foi traduzido para a língua escolhida
function AvisoLingua({ item }) {
  if (linguaAtual() === 'pt' || !item || (item._lingua !== 'pt' && !item._automatica)) return null
  return (
    <p lang={linguaAtual()} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '10px 14px', margin: '0 0 18px', borderRadius: 8, background: 'var(--fundo-suave, rgba(0,0,0,.05))', fontSize: 14 }}>
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" /></svg>
      {item._lingua === 'pt' ? t('Este conteúdo ainda só está disponível em português.') : t('Tradução automática do original em português.')}
    </p>
  )
}

export default AvisoLingua
