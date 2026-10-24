/*
  Faixa «Ambiente de teste» no servidor de testes (build com VITE_AMBIENTE=teste): quem experimenta o
  sistema sabe que os dados são fictícios e não escreve dados reais. Na instalação da Escola não aparece.
*/
export function marcarAmbienteTeste() {
  if (import.meta.env.VITE_AMBIENTE !== 'teste' || typeof document === 'undefined') return
  const faixa = document.createElement('div')
  faixa.setAttribute('role', 'note')
  faixa.setAttribute('translate', 'no')
  faixa.textContent = 'AMBIENTE DE TESTE · dados fictícios · não use dados reais'
  Object.assign(faixa.style, {
    position: 'fixed', left: '0', right: '0', bottom: '0', zIndex: '2147483000', pointerEvents: 'none',
    background: 'rgba(184, 137, 15, .94)', color: '#111', font: '700 12px/1 system-ui, sans-serif',
    letterSpacing: '.08em', textAlign: 'center', padding: '6px 8px',
  })
  document.body.appendChild(faixa)
}
