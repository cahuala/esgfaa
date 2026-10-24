// clicar numa captura mostra-a grande; Esc ou clicar fora fecha
const d = document.getElementById('ampliar')
const grande = d.querySelector('img')
document.querySelectorAll('figure .foto').forEach((b) => b.addEventListener('click', () => {
  const i = b.querySelector('img')
  grande.src = i.src
  grande.alt = i.alt
  d.showModal()
}))
d.addEventListener('click', (e) => { if (e.target === d || e.target.tagName === 'BUTTON') d.close() })
// o índice abre a secção do perfil em que se está
document.querySelectorAll('.indice a').forEach((a) => a.addEventListener('click', () => a.closest('details')?.setAttribute('open', '')))
