// código de verificação dos certificados: legível (sem letras que se confundem: 0/O, 1/I)
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export const novoCodigo = () => [...crypto.getRandomValues(new Uint8Array(12))].map((b) => ALFABETO[b % ALFABETO.length]).join('')

// o que a pessoa escreveu ("k7qm-2xpa 9rtc") -> "K7QM2XPA9RTC"
export const normalizarCodigo = (codigo) => String(codigo || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
