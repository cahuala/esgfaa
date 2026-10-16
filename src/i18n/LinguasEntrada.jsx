import { LINGUAS, linguaAtual, mudarLingua, t } from './linguas'

// escolha da língua nas páginas de entrada do painel e do portal (antes de iniciar sessão)
function LinguasEntrada() {
  const atual = linguaAtual()
  return (
    <nav className="entrada-linguas" aria-label={t('Línguas')}>
      {LINGUAS.map((l) => (
        <button key={l.codigo} type="button" lang={l.codigo} title={l.nome} aria-pressed={l.codigo === atual} className={l.codigo === atual ? 'ativa' : ''} onClick={() => { if (l.codigo !== atual) mudarLingua(l.codigo) }}>
          {l.curto}
        </button>
      ))}
    </nav>
  )
}

export default LinguasEntrada
