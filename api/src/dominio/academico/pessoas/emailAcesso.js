/* (a mesma regra do Sistema de Pessoal: api-pessoal/src/dominio/pessoal/emailAcesso.js — as duas têm de dar o mesmo e-mail)

  E-mail de acesso à plataforma (Portal Académico) dos docentes e estudantes: nome.apelido@dominio, só letras
  (sem acentos); se já houver, junta o 2.º nome (nome.segundo.apelido) e depois um número (nome.apelido2).
  usados: os e-mails que já existem (em minúsculas).
*/
const PARTICULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e'])

export function emailDeAcesso(nome, dominio, usados) {
  const p = String(nome ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z\s-]/g, ' ')
    .split(/[\s-]+/).filter((w) => w.length > 1 && !PARTICULAS.has(w))
  if (!p.length) return null
  const ultimo = p.length > 1 ? p[p.length - 1] : ''
  const opcoes = [[p[0], ultimo], [p[0], p[1], ultimo], [p[0], p[2], ultimo]].map((x) => [...new Set(x.filter(Boolean))].join('.'))
  for (const o of opcoes) if (o && !usados.has(`${o}@${dominio}`)) return `${o}@${dominio}`
  const base = opcoes[0]
  for (let n = 2; ; n++) if (!usados.has(`${base}${n}@${dominio}`)) return `${base}${n}@${dominio}`
}
