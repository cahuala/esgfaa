import { api } from '../api'

// envia ficheiros para a API e devolve os URLs
export async function carregar(ficheiros) {
  const lista = await api('/ficheiros', { metodo: 'POST', ficheiros: [...ficheiros] })
  return lista.map((f) => f.url)
}
