// Gera ficheiros .ics para adicionar eventos ao Google Calendar, Outlook ou iPhone.
function escapar(texto = '') {
  return texto.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

function vevento(evento, agora) {
  const dia = evento.data.replace(/-/g, '')
  const hora = (h) => `${h.replace(':', '')}00`
  return [
    'BEGIN:VEVENT',
    `UID:${evento.id}@esgfaa`,
    `DTSTAMP:${agora}`,
    `DTSTART:${dia}T${hora(evento.horaInicio)}`,
    `DTEND:${dia}T${hora(evento.horaFim || evento.horaInicio)}`,
    `SUMMARY:${escapar(evento.titulo)}`,
    `LOCATION:${escapar(evento.local)}`,
    `DESCRIPTION:${escapar(evento.resumo)}`,
    'END:VEVENT',
  ]
}

function descarregar(nome, linhas) {
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ESGFAA//Eventos//PT', ...linhas, 'END:VCALENDAR'].join('\r\n')
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `${nome}.ics`
  a.click()
  URL.revokeObjectURL(url)
}

const agoraUTC = () => new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'

// um evento
export function descarregarCalendario(evento) {
  descarregar(evento.id, vevento(evento, agoraUTC()))
}

// vários eventos num só ficheiro (subscrever a agenda)
export function descarregarAgenda(eventos, nome = 'agenda-esgfaa') {
  const agora = agoraUTC()
  descarregar(nome, eventos.flatMap((e) => vevento(e, agora)))
}
