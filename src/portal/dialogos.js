import { t as tx } from '../i18n/linguas'
/*
  Diálogos no estilo do tema (em vez das janelas do navegador): confirmar e pedir um texto.
  Uso: if (await confirmar('Apagar?', { perigo: true })) …  /  const nome = await pedir('Nome do grupo', 'Grupo 1')
  Precisa do componente <JanelaDialogo /> montado uma vez na aplicação (portal e painel).
*/
let mostrar = null

export function registarDialogos(funcao) {
  mostrar = funcao
  return () => { if (mostrar === funcao) mostrar = null }
}

export function confirmar(texto, { titulo = tx('Confirmar'), botao = tx('Confirmar'), perigo = false } = {}) {
  if (!mostrar) return Promise.resolve(window.confirm(texto))
  return new Promise((resolver) => mostrar({ tipo: 'confirmar', texto, titulo, botao, perigo, resolver }))
}

export function pedir(rotulo, valor = '', { titulo = '', botao = tx('Guardar'), multilinha = false, obrigatorio = true } = {}) {
  if (!mostrar) return Promise.resolve(window.prompt(rotulo, valor))
  return new Promise((resolver) => mostrar({ tipo: 'pedir', texto: rotulo, valor, titulo: titulo || rotulo, botao, multilinha, obrigatorio, resolver }))
}
