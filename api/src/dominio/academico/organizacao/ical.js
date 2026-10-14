/*
  Calendário no formato iCalendar (RFC 5545), para assinar no telemóvel, Outlook ou Google.
  As horas das provas e aulas são de Luanda (UTC+1, sem hora de verão): passam a UTC.
*/
const LUANDA = 60 // minutos à frente de UTC

const escapar = (t) => String(t ?? '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/([;,])/g, '\\$1')
const utc = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

// linhas com mais de 75 octetos dobram-se (continuação começa por um espaço)
function dobrar(linha) {
  const bytes = new TextEncoder().encode(linha)
  if (bytes.length <= 75) return linha
  const partes = []
  let atual = ''
  let tamanho = 0
  for (const c of linha) {
    const n = new TextEncoder().encode(c).length
    if (tamanho + n > (partes.length ? 74 : 75)) { partes.push(atual); atual = ''; tamanho = 0 }
    atual += c
    tamanho += n
  }
  partes.push(atual)
  return partes.join('\r\n ')
}

// data "AAAA-MM-DD" e hora "HH:MM" de Luanda -> Date (UTC)
export function deLuanda(data, hora) {
  const [h, m] = hora.split(':').map(Number)
  return new Date(Date.parse(`${data}T00:00:00Z`) + ((h * 60 + m) - LUANDA) * 60_000)
}

/*
  itens: os do calendário do portal ({ id, tipo, data, inicio, fim, momento, titulo, local, cadeira, descricao }).
  Com "momento" (ISO) usa-se essa hora exata; com "inicio" é hora de Luanda; sem hora, é um dia inteiro.
*/
export function gerarIcal(itens, { nome = 'Escola Superior de Guerra', dominio = 'esgfaa.gov.ao', agora = new Date() } = {}) {
  const l = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ESGFAA//Portal Academico//PT', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapar(nome)}`, 'X-WR-TIMEZONE:Africa/Luanda', 'REFRESH-INTERVAL;VALUE=DURATION:PT6H', 'X-PUBLISHED-TTL:PT6H',
  ]
  for (const i of itens) {
    l.push('BEGIN:VEVENT', `UID:${escapar(`${i.id}@${dominio}`)}`, `DTSTAMP:${utc(agora)}`)
    if (i.momento) {
      const d = new Date(i.momento)
      l.push(`DTSTART:${utc(d)}`, `DTEND:${utc(new Date(d.getTime() + (i.duracao || 0) * 60_000))}`)
    } else if (i.inicio) {
      const ini = deLuanda(i.data, i.inicio)
      const fim = i.fim ? deLuanda(i.data, i.fim) : new Date(ini.getTime() + 60 * 60_000)
      l.push(`DTSTART:${utc(ini)}`, `DTEND:${utc(fim > ini ? fim : new Date(ini.getTime() + 60 * 60_000))}`)
    } else {
      const d = i.data.replace(/-/g, '')
      const seguinte = new Date(Date.parse(`${i.data}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10).replace(/-/g, '')
      l.push(`DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${seguinte}`)
    }
    const titulo = i.tipo === 'aula' ? `Aula: ${i.titulo}` : i.cadeira && !String(i.titulo).includes(i.cadeira) ? `${i.titulo} — ${i.cadeira}` : i.titulo
    l.push(`SUMMARY:${escapar(titulo)}`)
    if (i.local) l.push(`LOCATION:${escapar(i.local)}`)
    if (i.descricao) l.push(`DESCRIPTION:${escapar(i.descricao)}`)
    if (i.url) l.push(`URL:${escapar(i.url)}`)
    l.push(`CATEGORIES:${escapar(i.tipo)}`, 'END:VEVENT')
  }
  l.push('END:VCALENDAR')
  return `${l.map(dobrar).join('\r\n')}\r\n`
}
