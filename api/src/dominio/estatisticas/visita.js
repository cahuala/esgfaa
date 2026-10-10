const ROBOS = /bot|crawl|spider|slurp|headless|lighthouse|preview|curl|wget|python|httpclient/i

// classifica o navegador do visitante (sem guardar o agente completo nem o IP)
export function classificarAgente(agente = '') {
  const a = String(agente)
  const dispositivo = /ipad|tablet/i.test(a) ? 'Tablet' : /mobi|android|iphone/i.test(a) ? 'Telemóvel' : 'Computador'
  const navegador = /edg\//i.test(a) ? 'Edge'
    : /opr\/|opera/i.test(a) ? 'Opera'
      : /firefox|fxios/i.test(a) ? 'Firefox'
        : /chrome|crios/i.test(a) ? 'Chrome'
          : /safari/i.test(a) ? 'Safari' : 'Outro'
  return { dispositivo, navegador, robo: !a || ROBOS.test(a) }
}

// domínio de onde veio o visitante (null se for navegação interna ou acesso direto)
export function origemExterna(referrer, origemDoPedido) {
  try {
    if (!referrer) return null
    const ref = new URL(referrer)
    if (!/^https?:$/.test(ref.protocol)) return null
    if (origemDoPedido && new URL(origemDoPedido).hostname === ref.hostname) return null
    return ref.hostname.replace(/^www\./, '').slice(0, 120)
  } catch {
    return null
  }
}
