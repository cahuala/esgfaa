import { XMLParser } from 'fast-xml-parser'
import { ErroValidacao } from '../../dominio/comum/erros.js'

/*
  Cópia de um curso do Moodle (.mbz) -> conteúdo neutro para importar numa cadeira:
  { titulo, secoes: [{ chave, titulo, resumo, visivel }], atividades: [...], ignorados: { modulo: n } }.
  Importa-se o que tem equivalente direto: tópicos (capítulos), página, rótulo (fica página),
  URL (ligação), ficheiro, pasta e trabalho (assign). O resto (questionários, fóruns, H5P, SCORM…)
  é contado em "ignorados", para o docente saber o que tem de refazer.
*/
// onde há listas (mesmo com um só elemento); "activity" e "section" também são a raiz de outros ficheiros
const LISTAS = new Set(['moodle_backup.information.contents.activities.activity', 'moodle_backup.information.contents.sections.section', 'files.file', 'inforef.fileref.file'])
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', parseTagValue: false, trimValues: true, isArray: (nome, caminho) => LISTAS.has(caminho) })

const lerXml = (entradas, caminho) => {
  const b = entradas[caminho]
  if (!b) return null
  try {
    return parser.parse(new TextDecoder().decode(b))
  } catch {
    throw new ErroValidacao(`A cópia do Moodle tem um ficheiro danificado (${caminho}).`, { campo: 'ficheiro' })
  }
}
const txt = (v) => (v === undefined || v === null ? '' : String(typeof v === 'object' ? v['#text'] ?? '' : v)).trim()
const semEtiquetas = (h) => txt(h).replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
// imagens e ligações para ficheiros internos do Moodle (@@PLUGINFILE@@) não existem cá: tiram-se
const semFicheirosMoodle = (h) => txt(h).replace(/<img[^>]*@@PLUGINFILE@@[^>]*>/gi, '').replace(/href="@@PLUGINFILE@@[^"]*"/gi, 'href="#"')

export function lerCursoMoodle(entradas) {
  const raiz = lerXml(entradas, 'moodle_backup.xml')?.moodle_backup
  if (!raiz?.information) throw new ErroValidacao('A cópia do Moodle não tem a descrição do curso (moodle_backup.xml).', { campo: 'ficheiro' })
  const info = raiz.information
  const conteudos = info.contents || {}
  const titulo = txt(info.original_course_fullname)

  // ficheiros do curso: id -> { nome, tipo, dados }
  const ficheiros = {}
  for (const f of lerXml(entradas, 'files.xml')?.files?.file || []) {
    const nome = txt(f.filename)
    const hash = txt(f.contenthash)
    if (!nome || nome === '.' || !/^[0-9a-f]{40}$/.test(hash)) continue
    const dados = entradas[`files/${hash.slice(0, 2)}/${hash}`]
    if (dados) ficheiros[txt(f['@_id'])] = { nome, tipo: txt(f.mimetype), dados, area: `${txt(f.component)}/${txt(f.filearea)}` }
  }
  const ficheirosDe = (pasta, area) => {
    const ids = [].concat(lerXml(entradas, `${pasta}/inforef.xml`)?.inforef?.fileref?.file || []).map((x) => txt(x.id))
    return ids.map((id) => ficheiros[id]).filter((f) => f && f.area === area)
  }

  const secoes = []
  for (const s of conteudos.sections?.section || []) {
    const pasta = txt(s.directory)
    const x = lerXml(entradas, `${pasta}/section.xml`)?.section || {}
    const numero = Number(txt(x.number) || 0)
    secoes.push({
      chave: txt(s.sectionid), numero, geral: numero === 0,
      titulo: txt(x.name) || txt(s.title) || (numero === 0 ? 'Geral' : `Tópico ${numero}`),
      resumo: semEtiquetas(x.summary).slice(0, 2000), visivel: txt(x.visible) !== '0',
    })
  }

  const atividades = []
  const ignorados = {}
  for (const a of conteudos.activities?.activity || []) {
    const modulo = txt(a.modulename)
    const pasta = txt(a.directory)
    const secao = txt(a.sectionid)
    const x = lerXml(entradas, `${pasta}/${modulo}.xml`)?.activity?.[modulo]
    if (!x) { ignorados[modulo] = (ignorados[modulo] || 0) + 1; continue }
    const nome = txt(x.name) || txt(a.title) || modulo
    const descricao = semEtiquetas(x.intro).slice(0, 3000)
    if (modulo === 'page') atividades.push({ tipo: 'pagina', secao, titulo: nome, descricao, conteudo: semFicheirosMoodle(x.content) || '<p></p>' })
    else if (modulo === 'label') atividades.push({ tipo: 'pagina', secao, titulo: (semEtiquetas(x.intro) || nome).slice(0, 120), descricao: '', conteudo: semFicheirosMoodle(x.intro) || '<p></p>' })
    else if (modulo === 'url') atividades.push({ tipo: 'ligacao', secao, titulo: nome, descricao, url: txt(x.externalurl) })
    else if (modulo === 'resource') atividades.push({ tipo: 'ficheiro', secao, titulo: nome, descricao, ficheiros: ficheirosDe(pasta, 'mod_resource/content').slice(0, 1) })
    else if (modulo === 'folder') atividades.push({ tipo: 'pasta', secao, titulo: nome, descricao, ficheiros: ficheirosDe(pasta, 'mod_folder/content') })
    else if (modulo === 'assign') {
      const prazo = Number(txt(x.duedate) || 0)
      atividades.push({ tipo: 'trabalho', secao, titulo: nome, enunciado: descricao, prazo: prazo > 0 ? new Date(prazo * 1000) : null })
    } else ignorados[modulo] = (ignorados[modulo] || 0) + 1
  }
  return { titulo, secoes, atividades, ignorados }
}
