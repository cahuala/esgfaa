/*
  O que o tradutor automático não pode adivinhar: os termos da Escola (os nomes dos cursos, «cadeira»,
  «Estado-Maior»…), os nomes das pessoas (João não passa a John) e os ordinais (12.º → 12th, 12e, 12.º).
  Antes de traduzir, cada termo, ordinal e nome dá lugar a uma palavra inventada, que o tradutor trata
  como um nome próprio e deixa como está, mantendo a frase inteira (com uma etiqueta ou um marcador no
  lugar, o tradutor deita fora verbos, artigos e pontuação); depois põe-se a tradução certa de cada um.
  Serve ao site e aos dados dos painéis.
*/

// [português, en, fr, es]; os mais compridos primeiro (o nome do curso antes de «Estado-Maior»).
// O artigo ou a contração que vier antes («o», «do», «ao», «na», «pela»…) vai com o termo e volta certo em
// cada língua (du, de l', au, à la; del, al; of the, to the). null: nessa língua fica com o tradutor.
export const GLOSSARIO = [
  ['Curso de Organização do Asseguramento Moral e Psicológico', 'Moral and Psychological Support Organisation Course', "Cours d'organisation du soutien moral et psychologique", 'Curso de Organización del Aseguramiento Moral y Psicológico'],
  ['Curso Superior de Comando e Direcção', 'Superior Command and Direction Course', 'Cours supérieur de commandement et de direction', 'Curso Superior de Comando y Dirección'],
  ['Curso de Estratégia e Arte Operativa', 'Strategy and Operative Art Course', "Cours de stratégie et d'art opératif", 'Curso de Estrategia y Arte Operativa'],
  ['Curso de Estado-Maior Conjunto', 'Joint Staff Course', "Cours d'état-major interarmées", 'Curso de Estado Mayor Conjunto'],
  ['Escola Superior de Guerra', 'Higher War College', 'École Supérieure de Guerre', 'Escuela Superior de Guerra'],
  ['Forças Armadas Angolanas', 'Angolan Armed Forces', 'Forces armées angolaises', 'Fuerzas Armadas Angoleñas'],
  ['Estado-Maior General', 'General Staff', 'état-major général', 'Estado Mayor General'],
  ['Estado-Maior Conjunto', 'Joint Staff', 'état-major interarmées', 'Estado Mayor Conjunto'],
  ['avaliação entre pares', 'peer assessment', 'évaluation par les pairs', 'evaluación entre pares'],
  ['Portal Académico', 'Academic Portal', 'Portail académique', 'Portal Académico'],
  // os postos no plural, que o tradutor deixa em português
  ['Capitães-de-Mar-e-Guerra', 'Navy Captains', 'capitaines de vaisseau', 'capitanes de navío'],
  ['Coronéis', 'Colonels', 'Colonels', 'Coroneles'],
  // na Escola, «posto» é a patente (o tradutor faz «poteau»)
  ['postos', 'ranks', 'grades', 'rangos'],
  ['posto', 'rank', 'grade', 'rango'],
  // «aula de quarta» é a de quarta-feira (o tradutor lê «quarta» como «quarta parte»)
  ['aula de segunda', 'Monday class', 'cours du lundi', 'clase del lunes'],
  ['aula de terça', 'Tuesday class', 'cours du mardi', 'clase del martes'],
  ['aula de quarta', 'Wednesday class', 'cours du mercredi', 'clase del miércoles'],
  ['aula de quinta', 'Thursday class', 'cours du jeudi', 'clase del jueves'],
  ['aula de sexta', 'Friday class', 'cours du vendredi', 'clase del viernes'],
  ['procura de falhas', 'probing for weaknesses', 'recherche de failles', 'búsqueda de fallos'],
  ['cadeiras', 'course units', "unités d'enseignement", 'asignaturas'],
  ['cadeira', 'course unit', "unité d'enseignement", 'asignatura'],
  ['Inquérito', 'Survey', 'Enquête', 'Encuesta'],
  ['Dissertação', 'Dissertation', 'Mémoire', 'Disertación'],
  ['ensaios', 'essays', 'essais', 'ensayos'],
  ['ensaio', 'essay', 'essai', 'ensayo'],
  ['portal', 'portal', 'portail', 'portal'],
]
// só quando são o texto todo (numa frase, o tradutor acerta: «Comando da Escola»)
export const GLOSSARIO_INTEIRO = [
  ['Comando', 'Command', 'Commandement', 'Mando'],
  ['Institucional', 'Institutional', 'Institutionnel', 'Institucional'],
  ['Cerimónias', 'Ceremonies', 'Cérémonies', 'Ceremonias'],
  ['Cerimónia', 'Ceremony', 'Cérémonie', 'Ceremonia'],
  ['Formatura', 'Graduation', 'Remise des diplômes', 'Graduación'],
]
const COLUNA = { en: 1, fr: 2, es: 3 }

// o artigo português (com a preposição) -> [preposição, masculino, plural]
const ARTIGOS = {
  o: ['', 'm', false], a: ['', 'f', false], os: ['', 'm', true], as: ['', 'f', true],
  do: ['de', 'm', false], da: ['de', 'f', false], dos: ['de', 'm', true], das: ['de', 'f', true],
  ao: ['a', 'm', false], 'à': ['a', 'f', false], aos: ['a', 'm', true], 'às': ['a', 'f', true],
  no: ['em', 'm', false], na: ['em', 'f', false], nos: ['em', 'm', true], nas: ['em', 'f', true],
  pelo: ['por', 'm', false], pela: ['por', 'f', false], pelos: ['por', 'm', true], pelas: ['por', 'f', true],
}
const VOGAL = /^[aeiouyhàâäéèêëîïôöûùü]/i
function comArtigo(artigo, v, lingua) {
  const [prep, gen, pl] = ARTIGOS[artigo.toLowerCase()]
  if (lingua === 'en') return `${{ '': '', de: 'of ', a: 'to ', em: 'in ', por: 'by ' }[prep]}the ${v}`
  if (lingua === 'es') {
    const art = pl ? (gen === 'm' ? 'los' : 'las') : gen === 'm' ? 'el' : 'la'
    if (prep === 'de' && art === 'el') return `del ${v}`
    if (prep === 'a' && art === 'el') return `al ${v}`
    return `${{ '': '', de: 'de ', a: 'a ', em: 'en ', por: 'por ' }[prep]}${art} ${v}`
  }
  const art = pl ? 'les' : VOGAL.test(v) ? "l'" : gen === 'm' ? 'le' : 'la'
  const junto = art === "l'" ? `l'${v}` : `${art} ${v}`
  if (prep === 'de') return art === 'le' ? `du ${v}` : art === 'les' ? `des ${v}` : `de ${junto}`
  if (prep === 'a') return art === 'le' ? `au ${v}` : art === 'les' ? `aux ${v}` : `à ${junto}`
  if (prep === 'em') return `dans ${junto}`
  if (prep === 'por') return `par ${junto}`
  return junto
}

// nomes próprios que o tradutor muda (João → John, Domingos → Dimanches): seguidos de um apelido, são uma pessoa
const NOMES = 'João|José|António|Antônio|Manuel|Maria|Francisco|Paulo|Pedro|Miguel|Luís|Luísa|Joaquim|André|Domingos|Tomás|Isabel|Teresa|Ana|Rosa|Fernando|Jorge|Carlos|Mateus|Lucas|Marcos|Estêvão|Simão|Bartolomeu|Gregório|Inácio|Afonso|Henrique|Filipe|Cristóvão|Helena|Catarina|Joana|Madalena|Lourenço|Vicente|Bento|Agostinho|Ambrósio|Alberto|Nicolau|Mário|Rui|Isaías|Valentim|Quintino|Hélder|Abel|Filomena|Conceição|Sebastião|Graça|Fátima|Esperança|Felizardo|Domingas|Pascoal|Adão|Eva|Moisés|Daniel|Samuel|Josefa|Rafael|Gabriel|Augusto|Victor|Vítor|Celestino|Bernardo|Benedito|Feliciano'
const PESSOA = new RegExp(`(?<![\\p{L}])(?:${NOMES})(?:\\s+(?:(?:de|da|do|dos|das|e)\\s+)?\\p{Lu}[\\p{L}'-]+)+`, 'gu')
// nomes com o posto à frente ("Cap.-Ten. Pedro Neto", "Cor. Ana Baptista", "1.º Sarg. Rui Lopes"); só os postos
// (e Dr., Eng., Prof.): «no Anfiteatro A. Tragam o programa» não tem nome nenhum
const POSTO = '(?:Gen|Ten|Brig|Cor|Maj|Cap|Alm|C|V|Asp|Subten|Sarg|Subsarg|Sold|Mar|Grum|Cv|Fr|Nav|Aj|Ch|Dr|Dra|Eng|Prof)\\.'
export const NOME_COM_POSTO = new RegExp(`(?<![\\p{L}])(?:\\d\\.º\\s+)?(?:${POSTO}(?:-${POSTO})*(?:\\s+(?:Av|Ex|Arm)\\.)?|\\d\\.º\\s+Cabo|CMG|Sarg\\.-Mor)\\s+\\p{Lu}[\\p{L}'-]+(?:\\s+(?:(?:de|da|do|dos|das|e)\\s+)?\\p{Lu}[\\p{L}'-]+)*`, 'gu')
const SUBSTITUTOS = ['Zaqarel', 'Vorumin', 'Kelbaz', 'Torvane', 'Mirsal', 'Quendor', 'Wilmaz', 'Brennik']
// para os termos e os ordinais (outras, para não se confundirem com os nomes)
const TERMOS = ['Qelvar', 'Drumak', 'Plinzet', 'Gorvex', 'Yuntak', 'Brazzol', 'Hexmor', 'Jolvat', 'Kremzi', 'Lumbrax', 'Novrel', 'Ostrik']
const INVENTADAS = new RegExp([...SUBSTITUTOS, ...TERMOS].join('|'), 'g')

const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
// com o artigo ou a contração antes, se houver («do Curso de Estado-Maior Conjunto»)
const termo = (pt) => new RegExp(`(?<![\\p{L}-])(?:(${Object.keys(ARTIGOS).join('|')})\\s+)?${escapar(pt).replace(/-/g, '[- ]')}(?![\\p{L}-])`, 'giu')
const REGRAS = GLOSSARIO.map((g) => [termo(g[0]), g])
const INICIO_FRASE = /(?:^|[.!?¡¿]\s*)$/u

function ordinal(n, feminino, lingua) {
  if (lingua === 'en') return `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' })[n % 10] || 'th'}`
  if (lingua === 'fr') return n === 1 ? (feminino ? '1re' : '1er') : `${n}e`
  return `${n}.${feminino ? 'ª' : 'º'}`
}

// texto -> { texto com os marcadores, sem: o que sobra para traduzir, marcas }
export function protegerTexto(original, lingua = 'en') {
  const marcas = []
  const inteiro = GLOSSARIO_INTEIRO.find((g) => g[0].toLowerCase() === original.trim().toLowerCase())
  if (inteiro) return { texto: TERMOS[0], marcas: [{ tipo: 'termo', g: inteiro }], vazio: true }
  let t = original
  const marcar = (m, x) => { if (marcas.length >= TERMOS.length) return m; marcas.push(x); return TERMOS[marcas.length - 1] }
  for (const [re, g] of REGRAS) {
    if (g[COLUNA[lingua]] == null) continue
    // no início do texto o artigo fica com o tradutor (com ele, o tradutor põe o termo no fim da frase)
    // e, em inglês, antes de um nome próprio, a preposição também (com ela, o tradutor faz um nome composto:
    // «Of the Higher War College facilities»)
    t = t.replace(re, (m, artigo, pos) => (artigo && (pos === 0 || (lingua === 'en' && ARTIGOS[artigo.toLowerCase()][0] && /^\p{Lu}/u.test(g[0])))
      ? `${m.slice(0, artigo.length)} ${marcar(m.slice(artigo.length + 1), { tipo: 'termo', g })}`
      : marcar(m, { tipo: 'termo', g, artigo, minuscula: !artigo && /^\p{Ll}/u.test(m) })))
  }
  const nomes = []
  for (const re of [NOME_COM_POSTO, PESSOA]) {
    t = t.replace(re, (m) => {
      if (nomes.length >= SUBSTITUTOS.length || SUBSTITUTOS.some((s) => m.includes(s))) return m
      nomes.push(m)
      return SUBSTITUTOS[nomes.length - 1]
    })
  }
  // depois dos nomes («1.º Sarg. Rui Lopes» é um nome)
  // o ordinal no início ou antes de um termo («32.º Curso…»); a meio da frase, o tradutor sabe a ordem das palavras
  t = t.replace(/(\d+)\.([ºª])/g, (m, n, s, pos, todo) => (pos === 0 || TERMOS.some((w) => todo.startsWith(` ${w}`, pos + m.length))
    ? marcar(m, { tipo: 'ordinal', n: Number(n), feminino: s === 'ª' }) : m))
  // sem nada para traduzir (só termos, nomes e números)
  const resto = t.replace(INVENTADAS, '')
  return { texto: t, marcas, nomes, vazio: !/\p{L}{2}/u.test(resto) }
}

// a tradução com os termos, os ordinais e os nomes de volta; '' se o tradutor perdeu um nome ou um marcador
export function reporTexto(traduzido, { marcas, nomes = [] }, lingua) {
  let t = String(traduzido ?? '')
  if (nomes.some((n, i) => !t.includes(SUBSTITUTOS[i]))) return ''
  if (marcas.some((m, i) => !t.includes(TERMOS[i]))) return ''
  // em inglês, o tradutor lê «Qelvar de Drumak» como um nome («Pedro de Sousa») e deixa a preposição em português
  if (lingua === 'en' && marcas.length) {
    const EN = { de: 'of', da: 'of the', do: 'of the', das: 'of the', dos: 'of the', em: 'in', na: 'in the', no: 'in the', nas: 'in the', nos: 'in the', ao: 'to the', aos: 'to the', 'à': 'to the', 'às': 'to the', pela: 'by the', pelo: 'by the', pelas: 'by the', pelos: 'by the' }
    t = t.replace(new RegExp(`(?<![\\p{L}])(${Object.keys(EN).join('|')})\\s+(?=(?:${TERMOS.slice(0, marcas.length).join('|')})\\b)`, 'gu'), (m, p) => `${EN[p]} `)
  }
  // o tradutor às vezes põe a palavra inventada no plural («Qelvars»): o plural já vem no termo
  t = t.replace(new RegExp(`(${TERMOS.slice(0, marcas.length).join('|') || '$^'})(?:e?s)?\\b`, 'g'), (m, w, pos) => {
    const x = marcas[TERMOS.indexOf(w)]
    if (x.tipo === 'ordinal') return ordinal(x.n, x.feminino, lingua)
    const g = x.g[COLUNA[lingua]]
    // com a mesma maiúscula do original («coronéis» a meio da frase)
    const v = x.artigo ? comArtigo(x.artigo, g, lingua) : x.minuscula ? g.charAt(0).toLowerCase() + g.slice(1) : g
    // a tradução como está no glossário; no início de uma frase, com maiúscula
    return `${INICIO_FRASE.test(t.slice(0, pos)) ? '\uE000' : ''}${x.artigo ? '\uE001' : ''}${v}`
  })
  // (marcas internas: \uE000 = início de frase, \uE001 = termo com o artigo)
  // o tradutor às vezes junta a sua preposição à do termo («le semestre de du Cours», «élevés de dans les»)
  t = t.replace(/\b(?:de|d'|à|a|of|to|in|en|dans|par|by|por|del|al)\s+\uE000?\uE001(?=(?:du|de|des|d'|au|aux|à|dans|par|of|to|in|by|del|al|a|en|por)\b)/giu, (m) => m.replace(/^\S+\s+/, ''))
    .replace(/\uE000\uE001?(\S)/gu, (m, c) => c.toUpperCase()).replace(/\uE001/g, '')
  t = nomes.reduce((s, n, i) => s.replaceAll(SUBSTITUTOS[i], n), t)
  return arrumarTraducao(t, lingua)
}

// o tradutor às vezes deixa espaços à volta do apóstrofo («L ' École», «d ' officiers»)
// e, em espanhol, os ordinais com «o» em vez de «º» («1.o año»)
export function arrumarTraducao(t, lingua) {
  if (typeof t !== 'string') return t
  const r = t.replace(/(\p{L}) ' (\p{L})/gu, "$1'$2").replace(/(\p{L}) '(\p{L})/gu, "$1'$2")
  // e «Cerimonio» (cerimónia) em vez de «Ceremonia»
  if (lingua === 'es') return r.replace(/\b(\d+)\.?o\b/g, '$1.º').replace(/\b(\d+)\.a\b/g, '$1.ª').replace(/\b([Cc])erim[oó]ni[oa](s?)(?![\p{L}])/gu, (m, c, pl) => `${c === 'C' ? 'C' : 'c'}eremonia${pl}`)
  // em francês, «au amphithéâtre» é «à l'amphithéâtre» e «de état-major», «d'état-major»
  if (lingua === 'fr') return r.replace(/\b([Aa])u (?=[aeiouéèêâîô])/g, (m, a) => `${a === 'A' ? 'À' : 'à'} l'`).replace(/\b([Dd])e (?=[aeiouéèêâîô])/g, "$1'")
  return r
}

// o tradutor da Escola com o glossário: { nome, traduzirMapa(mapa, lingua) }
export function comGlossario(tradutor) {
  if (!tradutor) return tradutor
  return {
    ...tradutor,
    nome: tradutor.nome,
    disponivel: tradutor.disponivel?.bind(tradutor),
    async traduzirMapa(mapa, lingua) {
      const prep = Object.fromEntries(Object.entries(mapa).map(([k, v]) => [k, typeof v === 'string' ? protegerTexto(v, lingua) : null]))
      const pedir = Object.fromEntries(Object.entries(prep).filter(([, p]) => p && !p.vazio).map(([k, p]) => [k, p.texto]))
      const out = Object.keys(pedir).length ? await tradutor.traduzirMapa(pedir, lingua) : {}
      const r = {}
      for (const [k, p] of Object.entries(prep)) {
        if (!p) continue
        const v = reporTexto(p.vazio ? p.texto : out[k], p, lingua)
        if (v) r[k] = v
      }
      return r
    },
  }
}
