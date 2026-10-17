import { t as tx } from '../../i18n/linguas'

// aspeto de cada tipo de atividade (como os ícones coloridos do Moodle)
export const TIPOS = {
  ficheiro: { icone: 'fa-file-alt', cor: 'bg-primary', nome: tx('Ficheiro') },
  ligacao: { icone: 'fa-link', cor: 'bg-info', nome: tx('Ligação') },
  video: { icone: 'fa-play', cor: 'bg-danger', nome: tx('Vídeo') },
  trabalho: { icone: 'fa-file-signature', cor: 'bg-orange', nome: tx('Trabalho') },
  questionario: { icone: 'fa-question', cor: 'bg-purple', nome: tx('Questionário') },
  pagina: { icone: 'fa-align-left', cor: 'bg-teal', nome: tx('Página') },
  pasta: { icone: 'fa-folder-open', cor: 'bg-warning', nome: tx('Pasta') },
  videoconferencia: { icone: 'fa-video', cor: 'bg-success', nome: tx('Videoconferência') },
  livro: { icone: 'fa-book', cor: 'bg-indigo', nome: tx('Livro') },
  licao: { icone: 'fa-route', cor: 'bg-pink', nome: tx('Lição') },
  sondagem: { icone: 'fa-poll', cor: 'bg-cyan', nome: tx('Sondagem') },
  avaliacao: { icone: 'fa-user-check', cor: 'bg-indigo', nome: tx('Avaliação do docente') },
  workshop: { icone: 'fa-people-arrows', cor: 'bg-green', nome: tx('Avaliação por pares') },
  scorm: { icone: 'fa-cube', cor: 'bg-blue', nome: tx('Pacote SCORM') },
  h5p: { icone: 'fa-puzzle-piece', cor: 'bg-lime', nome: tx('Conteúdo H5P') },
  lti: { icone: 'fa-plug', cor: 'bg-gray-600', nome: tx('Ferramenta externa') },
}

// ícone de um ficheiro pelo tipo (PDF, vídeo, imagem…), para os materiais de um só ficheiro
export function tipoVisual(a) {
  if (a.especie !== 'material' || a.tipo !== 'ficheiro') return TIPOS[a.visual] || TIPOS.ficheiro
  const t = a.ficheiro?.tipo || ''
  if (t === 'application/pdf') return { icone: 'fa-file-pdf', cor: 'bg-danger', nome: tx('PDF') }
  if (t.startsWith('video/')) return { icone: 'fa-play', cor: 'bg-danger', nome: tx('Vídeo') }
  if (t.startsWith('audio/')) return { icone: 'fa-headphones', cor: 'bg-indigo', nome: tx('Áudio') }
  if (t.startsWith('image/')) return { icone: 'fa-image', cor: 'bg-cyan', nome: tx('Imagem') }
  return TIPOS.ficheiro
}

// todas as atividades da cadeira, por ordem de publicação, com uma chave única ("material-5")
export function listarAtividades(c) {
  return [
    ...c.materiais.map((m) => ({ ...m, chave: `material-${m.id}`, especie: 'material', visual: m.tipo, quando: m.publicadoEm })),
    ...c.trabalhos.map((t) => ({ ...t, chave: `trabalho-${t.id}`, especie: 'trabalho', visual: 'trabalho', quando: t.criadoEm })),
    ...c.questionarios.map((q) => ({ ...q, chave: `questionario-${q.id}`, especie: 'questionario', visual: 'questionario', quando: q.criadoEm })),
    ...(c.inqueritos || []).map((i) => ({ ...i, chave: `inquerito-${i.id}`, especie: 'inquerito', visual: i.tipo, quando: i.criadoEm })),
    ...(c.workshops || []).map((w) => ({ ...w, chave: `workshop-${w.id}`, especie: 'workshop', visual: 'workshop', quando: w.criadoEm })),
  ].sort((a, b) => String(a.quando).localeCompare(String(b.quando)))
}

// a atividade está concluída para o estudante? (o progresso do servidor manda; os outros sinais completam)
export function concluida(a, progresso) {
  const item = progresso?.itens.find((i) => i.tipo === a.especie && i.id === a.id)
  if (item) return item.feita
  if (a.especie === 'trabalho') return Boolean(a.entrega)
  if (a.especie === 'inquerito') return Boolean(a.respondido)
  if (a.especie === 'workshop') return Boolean(a.entregue)
  return false
}
