// Gera um ficheiro .ics para o evento ser adicionado ao Google Calendar, Outlook ou iPhone.
function escapar(texto = '') {
  return texto.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

export function descarregarCalendario(evento) {
  const dia = evento.data.replace(/-/g, '')
  const hora = (h) => `${h.replace(':', '')}00`
  const agora = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ESGFAA//Eventos//PT',
    'BEGIN:VEVENT',
    `UID:${evento.id}@esgfaa`,
    `DTSTAMP:${agora}`,
    `DTSTART:${dia}T${hora(evento.horaInicio)}`,
    `DTEND:${dia}T${hora(evento.horaFim || evento.horaInicio)}`,
    `SUMMARY:${escapar(evento.titulo)}`,
    `LOCATION:${escapar(evento.local)}`,
    `DESCRIPTION:${escapar(evento.resumo)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')

  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `${evento.id}.ics`
  a.click()
  URL.revokeObjectURL(url)
}
