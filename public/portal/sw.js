/*
  Service worker do portal: abre depressa (guarda a aplicação no telemóvel), funciona com
  a rede fraca e mostra os avisos do portal mesmo com o portal fechado.
  Os pedidos à API nunca se guardam: são sempre feitos à rede.
*/
const CACHE = 'portal-esg-v1'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()))
})

self.addEventListener('fetch', (e) => {
  const pedido = e.request
  if (pedido.method !== 'GET') return
  const url = new URL(pedido.url)
  if (url.origin !== self.location.origin) return // a API e as letras vêm de outros endereços
  // a página do portal: primeiro a rede; sem rede, a última que se guardou
  if (pedido.mode === 'navigate') {
    e.respondWith(fetch(pedido).then((r) => { const c = r.clone(); caches.open(CACHE).then((x) => x.put(new URL('./', self.registration.scope).href, c)); return r })
      .catch(() => caches.match(new URL('./', self.registration.scope).href)))
    return
  }
  // ficheiros da aplicação (têm o número da versão no nome): da memória, e guardam-se na primeira vez
  if (url.pathname.includes('/assets/') || url.pathname.includes('/portal/icones/')) {
    e.respondWith(caches.match(pedido).then((guardado) => guardado || fetch(pedido).then((r) => { if (r.ok) { const c = r.clone(); caches.open(CACHE).then((x) => x.put(pedido, c)) } return r })))
  }
})

// um aviso do portal (nota publicada, novo aviso, prazo, mensagem…)
self.addEventListener('push', (e) => {
  let d
  try { d = e.data ? e.data.json() : {} } catch { d = { titulo: e.data?.text() } }
  e.waitUntil(self.registration.showNotification(d.titulo || 'Portal Académico', {
    body: d.texto || '',
    icon: 'icones/icone-192.png',
    badge: 'icones/emblema-96.png',
    tag: d.ligacao || undefined, // o mesmo assunto substitui o aviso anterior
    data: { ligacao: d.ligacao || '/' },
  }))
})

// tocar no aviso abre o portal no sítio certo (ou traz para a frente o que já estava aberto)
self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const destino = new URL(`./#${e.notification.data?.ligacao || '/'}`, self.registration.scope).href
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((janelas) => {
    const aberta = janelas.find((j) => j.url.startsWith(self.registration.scope))
    if (aberta) return aberta.navigate(destino).then((j) => (j || aberta).focus())
    return self.clients.openWindow(destino)
  }))
})
