import { api } from './api'

/*
  O portal como aplicação no telemóvel: instalar (ícone no ecrã principal) e avisos
  (notificações do portal mesmo com ele fechado). Tudo opcional e reversível.
*/
const BASE = `${import.meta.env.BASE_URL}portal/`
let pedidoInstalar = null
const ouvintes = new Set()

// o Chrome/Edge (Android e computador) oferece a instalação: guarda-se para o botão "Instalar"
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); pedidoInstalar = e; ouvintes.forEach((f) => f()) })
  window.addEventListener('appinstalled', () => { pedidoInstalar = null; ouvintes.forEach((f) => f()) })
}
export const aoMudarInstalacao = (f) => { ouvintes.add(f); return () => ouvintes.delete(f) }

export const eIphone = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
export const instalado = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true
export const podeInstalar = () => Boolean(pedidoInstalar)
// no iPhone os avisos só funcionam com o portal instalado no ecrã principal
export const avisosPossiveis = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && (!eIphone() || instalado())

export async function instalar() {
  if (!pedidoInstalar) return false
  pedidoInstalar.prompt()
  const { outcome } = await pedidoInstalar.userChoice
  pedidoInstalar = null
  ouvintes.forEach((f) => f())
  return outcome === 'accepted'
}

export function registarServico() {
  if (!('serviceWorker' in navigator)) return Promise.resolve(null)
  return navigator.serviceWorker.register(`${BASE}sw.js`, { scope: BASE }).catch(() => null)
}

const chaveBinaria = (b64) => {
  const s = atob((b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(s, (c) => c.charCodeAt(0))
}
const aparelho = () => {
  const ua = navigator.userAgent
  const so = /android/i.test(ua) ? 'Android' : eIphone() ? 'iPhone' : /windows/i.test(ua) ? 'Windows' : /mac/i.test(ua) ? 'Mac' : 'Linux'
  const nav = /edg\//i.test(ua) ? 'Edge' : /firefox/i.test(ua) ? 'Firefox' : /chrome|crios/i.test(ua) ? 'Chrome' : /safari/i.test(ua) ? 'Safari' : ''
  return [so, nav].filter(Boolean).join(' · ')
}

// 'indisponivel' | 'bloqueado' | 'ligado' | 'desligado'
export async function estadoAvisos() {
  if (!avisosPossiveis()) return 'indisponivel'
  if (Notification.permission === 'denied') return 'bloqueado'
  const reg = await navigator.serviceWorker.getRegistration(BASE)
  const sub = await reg?.pushManager.getSubscription()
  return sub && Notification.permission === 'granted' ? 'ligado' : 'desligado'
}

export async function ligarAvisos() {
  if (!avisosPossiveis()) throw new Error('Este aparelho não recebe avisos do portal.')
  const permissao = await Notification.requestPermission()
  if (permissao !== 'granted') return 'bloqueado'
  const reg = (await registarServico()) || (await navigator.serviceWorker.ready)
  await navigator.serviceWorker.ready
  const { chave } = await api('/push/chave')
  const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveBinaria(chave) }))
  await api('/push/subscricao', { metodo: 'POST', corpo: { ...sub.toJSON(), aparelho: aparelho() } })
  return 'ligado'
}

export async function desligarAvisos() {
  const reg = await navigator.serviceWorker.getRegistration(BASE)
  const sub = await reg?.pushManager.getSubscription()
  if (sub) {
    await api('/push/subscricao', { metodo: 'DELETE', corpo: { endpoint: sub.endpoint } }).catch(() => {})
    await sub.unsubscribe()
  }
  return 'desligado'
}
