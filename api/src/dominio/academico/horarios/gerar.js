/*
  Horário semanal gerado automaticamente para uma turma. Cada cadeira precisa de tantos tempos por semana quantas
  as suas horas pedem (horas ÷ semanas do período ÷ duração do tempo; pelo menos 1). Ninguém fica em dois sítios ao
  mesmo tempo: a turma (nas cadeiras do mesmo semestre), o docente (também nas outras turmas do ano) e a sala. A
  mesma cadeira espalha-se por dias diferentes sempre que der.
  cadeiras: [{ id, codigo, nome, periodo: '1'|'2'|'anual', horas, docenteIds: [] }]
  ocupados: os horários que já existem (das outras turmas do ano e os desta que ficam): [{ diaSemana, inicio, fim,
    sala, docenteIds, periodo, daTurma }]
  tempos: ['08:30-09:20', …]; dias: [1..6]; salas: ['Sala 1', …] (vazio = sem sala); semanas: { '1': 16, … }
*/
const minutos = (h) => { const [a, b] = h.split(':').map(Number); return a * 60 + b }
const sobrepoe = (x, y) => minutos(x.inicio) < minutos(y.fim) && minutos(y.inicio) < minutos(x.fim)
const mesmoPeriodo = (a, b) => a === 'anual' || b === 'anual' || String(a) === String(b)

export function tempoDe(texto) {
  const m = /^(\d{2}:\d{2})-(\d{2}:\d{2})$/.exec(String(texto ?? '').trim())
  return m && minutos(m[1]) < minutos(m[2]) ? { inicio: m[1], fim: m[2] } : null
}

export function temposSemanais(horas, semanas, duracaoMin) {
  const h = Number(horas) || 0
  if (h <= 0) return 0
  return Math.max(1, Math.min(10, Math.round(h / ((Number(semanas) || 16) * (duracaoMin / 60)))))
}

export function gerarHorario({ cadeiras, ocupados = [], tempos, dias = [1, 2, 3, 4, 5], salas = [], semanas = {} }) {
  const blocos = tempos.map(tempoDe).filter(Boolean)
  if (!blocos.length) return { horario: [], semLugar: cadeiras.map((c) => ({ cadeiraId: c.id, codigo: c.codigo, nome: c.nome, faltam: 0 })) }
  const duracao = Math.round(blocos.reduce((s, b) => s + minutos(b.fim) - minutos(b.inicio), 0) / blocos.length)
  const marcados = []
  const todos = () => [...ocupados, ...marcados]
  const pedidos = cadeiras
    .map((c) => ({ c, n: temposSemanais(c.horas, semanas[c.periodo] ?? semanas['1'] ?? 16, duracao) }))
    .filter((x) => x.n > 0)
    // as que precisam de mais tempos e as dos docentes com mais cadeiras primeiro
    .sort((a, b) => b.n - a.n || (b.c.docenteIds?.length ?? 0) - (a.c.docenteIds?.length ?? 0) || String(a.c.codigo).localeCompare(String(b.c.codigo)))
  const semLugar = []
  pedidos.forEach(({ c, n }, i) => {
    let postos = 0
    const docentes = new Set(c.docenteIds ?? [])
    const livre = (dia, b) => {
      const aqui = todos().filter((m) => m.diaSemana === dia && sobrepoe(m, b))
      if (aqui.some((m) => m.daTurma && mesmoPeriodo(m.periodo, c.periodo))) return null
      if (aqui.some((m) => mesmoPeriodo(m.periodo, c.periodo) && (m.docenteIds ?? []).some((d) => docentes.has(d)))) return null
      if (!salas.length) return ''
      return salas.find((s) => !aqui.some((m) => mesmoPeriodo(m.periodo, c.periodo) && m.sala === s)) ?? null
    }
    // 1.ª volta: um tempo por dia; 2.ª volta: os que faltarem, nos dias que ainda tiverem lugar
    for (const umPorDia of [true, false]) {
      for (let k = 0; k < dias.length && postos < n; k++) {
        const dia = dias[(i + k) % dias.length]
        for (const b of blocos) {
          if (postos >= n) break
          if (umPorDia && marcados.some((m) => m.cadeiraId === c.id && m.diaSemana === dia)) break
          const sala = livre(dia, b)
          if (sala === null) continue
          marcados.push({ cadeiraId: c.id, codigo: c.codigo, nome: c.nome, periodo: c.periodo, diaSemana: dia, inicio: b.inicio, fim: b.fim, sala, docenteIds: [...docentes], daTurma: true })
          postos++
          if (umPorDia) break
        }
      }
    }
    if (postos < n) semLugar.push({ cadeiraId: c.id, codigo: c.codigo, nome: c.nome, faltam: n - postos })
  })
  const horario = marcados.map((m) => ({ cadeiraId: m.cadeiraId, codigo: m.codigo, nome: m.nome, periodo: m.periodo, diaSemana: m.diaSemana, inicio: m.inicio, fim: m.fim, sala: m.sala, docenteIds: m.docenteIds })).sort((a, b) => a.diaSemana - b.diaSemana || a.inicio.localeCompare(b.inicio))
  return { horario, semLugar, temposPorSemana: Object.fromEntries(pedidos.map((x) => [x.c.id, x.n])) }
}
