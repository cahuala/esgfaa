import { nomeDoPosto } from '../dominio/pessoal/hierarquia.js'

/*
  Quem assina os documentos: a pessoa que está a exercer o cargo a que o documento se refere, tirada do
  quadro orgânico (quem o ocupa hoje, com o posto actual). Se o titular estiver hoje de licença ou ausente,
  assina quem ocupa o cargo substituto («em exercício»). Se o cargo estiver vago, usa-se o nome escrito à mão
  nas Assinaturas (com um aviso). Cada assinante pode ficar ligado a outro cargo (cargoId, substitutoId).
*/
export const ASSINANTES = {
  comandante: {
    titulo: 'Comandante da Escola', rotulo: 'O COMANDANTE DA ESG', cargo: /^Comandante da Escola Superior de Guerra$/i,
    substituto: /^2\.º Comandante da Escola Superior de Guerra$/i, rotuloSubstituto: 'O 2.º COMANDANTE DA ESG (EM EXERCÍCIO)',
    usos: 'Assina as declarações (efectividade, salário, serviço), as guias, a proposta de nomeação, o «Aprovado» dos mapas e os diplomas e certificados.',
  },
  chefeRpq: {
    titulo: 'Chefe da Repartição de Pessoal e Quadros', rotulo: 'O CHEFE DA REPARTIÇÃO DE PESSOAL E QUADROS', cargo: /^Chefe da Repartição de Pessoal e Quadros\b/i,
    substituto: /^Oficial de Pessoal e Quadros da Repartição de Pessoal e Quadros\b/i, rotuloSubstituto: 'PELO CHEFE DA REPARTIÇÃO DE PESSOAL E QUADROS',
    usos: 'Assina as listas e os mapas do menu Documentos.',
  },
  directorEnsino: {
    titulo: 'Director de Ensino', rotulo: 'O DIRECTOR DE ENSINO', cargo: /^Director da Direcção de Ensino\b/i,
    substituto: null, rotuloSubstituto: 'PELO DIRECTOR DE ENSINO',
    usos: 'Assina os diplomas e certificados dos cursos (enviado ao Portal Académico).',
  },
}

const dia = (d) => new Date(d).toISOString().slice(0, 10)

// guardado = { comandante: { cargoId, substitutoId, cargo, nome, posto }, …, local }
export async function calcularAssinantes(bd, guardado = {}, hoje = new Date()) {
  const h = new Date(dia(hoje))
  const cargos = await bd.cargo.findMany({ select: { id: true, nome: true } })
  const ocupante = async (cargoId) => {
    if (!cargoId) return null
    const p = await bd.pessoa.findFirst({ where: { cargoId, ativo: true }, orderBy: [{ dataCargo: 'desc' }, { id: 'asc' }], select: { id: true, nome: true, posto: true, ramo: true, tipo: true, categoriaCivil: true } })
    if (!p) return null
    const [lic, aus] = await Promise.all([
      bd.licenca.count({ where: { pessoaId: p.id, inicio: { lte: h }, fim: { gte: h } } }),
      bd.ausencia.count({ where: { pessoaId: p.id, inicio: { lte: h }, OR: [{ fim: null }, { fim: { gte: h } }] } }),
    ])
    return { ...p, ausente: lic + aus > 0, postoNome: p.posto ? nomeDoPosto(p.posto, p.ramo) : p.categoriaCivil || '' }
  }
  const achar = (id, re) => (id ? cargos.find((c) => c.id === id) : re ? cargos.find((c) => re.test(c.nome)) : null) ?? null
  const r = { local: guardado.local || 'Luanda' }
  for (const [k, a] of Object.entries(ASSINANTES)) {
    const g = guardado[k] ?? {}
    const cargo = achar(g.cargoId, a.cargo)
    const sub = achar(g.substitutoId, a.substituto)
    const titular = await ocupante(cargo?.id)
    const base = { cargoId: cargo?.id ?? null, cargoNome: cargo?.nome ?? '', substitutoId: sub?.id ?? null, substitutoNome: sub?.nome ?? '' }
    let x
    if (titular && !titular.ausente) x = { cargo: g.cargo || a.rotulo, nome: titular.nome, posto: titular.postoNome, origem: 'titular', pessoaId: titular.id }
    else {
      const s = titular?.ausente ? await ocupante(sub?.id) : null
      if (s && !s.ausente) x = { cargo: a.rotuloSubstituto, nome: s.nome, posto: s.postoNome, origem: 'substituto', pessoaId: s.id, aviso: `${titular.nome} está hoje de licença ou ausente: assina quem ocupa «${sub.nome}».` }
      else if (titular) x = { cargo: g.cargo || a.rotulo, nome: titular.nome, posto: titular.postoNome, origem: 'titular', pessoaId: titular.id, aviso: `${titular.nome} está hoje de licença ou ausente e não há substituto em serviço.` }
      else x = { cargo: g.cargo || a.rotulo, nome: g.nome || '', posto: g.posto || '', origem: 'manual', pessoaId: null, aviso: cargo ? `O cargo «${cargo.nome}» está vago: usa-se o nome escrito à mão.` : 'Nenhum cargo ligado a esta assinatura: usa-se o nome escrito à mão.' }
    }
    r[k] = { ...base, ...x, manual: { cargo: g.cargo || '', nome: g.nome || '', posto: g.posto || '' } }
  }
  return r
}
