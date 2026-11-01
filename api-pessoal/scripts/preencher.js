/*
  Dados de teste sobre o quadro orgânico que está na base: ocupa todos os lugares vagos dos cargos com fichas
  fictícias (o posto mínimo do cargo ou um acima, na mesma categoria; civis nos cargos civis), cada uma com
  a carreira (ingresso, promoções, nomeações anteriores, cursos), louvores, licenças, faltas e plano de
  férias, processo individual arrumado na estante e a ficha toda preenchida. Junta ainda o pessoal antigo
  (que já saiu da Escola, com o cargo que teve e o motivo da saída) e contas de chefe para o expediente.
  Não lê nem guarda nenhum dado real: os nomes, NIP, BI e contactos são inventados.
  Uso: npm run preencher            (só preenche o que falta; pode correr outra vez)
*/
import { criarConfig } from '../src/config.js'
import { criarPrisma } from '../src/infraestrutura/bd.js'
import { CifraDados, comCifra } from '../src/infraestrutura/cifraDados.js'
import { POSTOS, existeNoRamo, quadrosDoRamo } from '../src/dominio/pessoal/hierarquia.js'
import { CARREIRAS_CIVIS } from '../src/dominio/pessoal/civis.js'
import { PROVINCIAS } from '../src/dominio/pessoal/ficha.js'
import { CifraSenhas } from '../src/infraestrutura/cifra.js'

const config = criarConfig()
const bd = comCifra(criarPrisma(config.urlBaseDados), new CifraDados(config.chaveDados))

let semente = 20261023
const aleatorio = () => ((semente = (semente * 1103515245 + 12345) % 2147483648) / 2147483648)
const um = (l) => l[Math.floor(aleatorio() * l.length)]
const entre = (a, b) => a + Math.floor(aleatorio() * (b - a + 1))
// nunca depois de hoje: uma data do ano corrente que ainda não chegou passa para o ano anterior
const data = (ano, mes = entre(1, 12), dia = entre(1, 28)) => { const d = Date.UTC(ano, mes - 1, dia); return new Date(d > Date.now() ? Date.UTC(ano - 1, mes - 1, dia) : d) }
const POR = 'preencher'

const NOMES_M = ['António', 'Manuel', 'João', 'José', 'Pedro', 'Francisco', 'Domingos', 'Afonso', 'Bernardo', 'Carlos', 'Mateus', 'Paulo', 'Miguel', 'Alberto', 'Joaquim', 'Adriano', 'Agostinho', 'Simão', 'Eduardo', 'Fernando', 'Lucas', 'Gaspar', 'Isaías', 'Valentim', 'Narciso', 'Hélder', 'Osvaldo', 'Celestino', 'Abel', 'Daniel', 'Tomás', 'Rui', 'Jacinto', 'Florindo', 'Hermenegildo', 'Inácio', 'Leonel', 'Moisés', 'Nelson', 'Quintino']
const NOMES_F = ['Maria', 'Ana', 'Luísa', 'Teresa', 'Isabel', 'Rosa', 'Helena', 'Joana', 'Esperança', 'Conceição', 'Domingas', 'Filomena', 'Madalena', 'Celeste', 'Graça', 'Josefa', 'Antónia', 'Lurdes', 'Marta', 'Fátima', 'Engrácia', 'Victória']
const APELIDOS = ['Kiala', 'Tchipa', 'Lopes', 'Neto', 'Santos', 'Cassoma', 'Mbala', 'Sebastião', 'Muteka', 'Kalunga', 'Ndala', 'Chilombo', 'Fernandes', 'Domingos', 'Kangamba', 'Mavinga', 'Sapalo', 'Tomás', 'Cambuta', 'Hossi', 'Quissanga', 'Bumba', 'Nzinga', 'Capitango', 'Ventura', 'Lukamba', 'Dala', 'Katumbela', 'Mussungo', 'Chipenda', 'Kapingala', 'Ngola', 'Tchissola', 'Massanga', 'Kassoma', 'Jamba', 'Wanga', 'Paulino', 'Bento', 'Mateta']
const nome = (g) => `${g === 'F' ? um(NOMES_F) : um(NOMES_M)} ${um(APELIDOS)} ${um(APELIDOS)}`
const ESTADOS = ['solteiro', 'casado', 'casado', 'casado', 'uniao_facto', 'divorciado', 'viuvo']
const MUNICIPIOS = ['Belas', 'Talatona', 'Kilamba Kiaxi', 'Viana', 'Cazenga', 'Maianga', 'Rangel', 'Cacuaco', 'Sambizanga']
const BAIRROS = ['Bairro Militar', 'Morro Bento', 'Nova Vida', 'Zango', 'Golf II', 'Benfica', 'Patriota', 'Camama', 'Mulenvos']
const SANGUE = ['O+', 'O+', 'A+', 'B+', 'AB+', 'O-', 'A-']
const telefone = () => `+244 9${entre(10, 99)} ${entre(100, 999)} ${entre(100, 999)}`
// o BI tem de ser único: em sequência a partir de um número alto (os outros dados de demonstração usam números ao acaso)
let biSeq = 9100000
const bi = () => `00${biSeq++}LA0${entre(10, 99)}`

// a carreira de cada categoria (pela ordem): de onde se começa e por onde se sobe
const CARREIRA = {
  oficial: ['subtenente', 'tenente', 'capitao', 'major', 'tenente_coronel', 'coronel', 'brigadeiro', 'tenente_general', 'general'],
  sargento: ['segundo_sargento', 'primeiro_sargento', 'sargento_ajudante', 'sargento_chefe', 'sargento_maior'],
  praca: ['soldado', 'segundo_cabo', 'primeiro_cabo'],
}
const carreiraDe = (posto) => (POSTOS[posto].categoria === 'sargento' ? CARREIRA.sargento : POSTOS[posto].categoria === 'praca' ? CARREIRA.praca : CARREIRA.oficial)
// idade típica e anos em cada posto
const IDADE = { general: 60, tenente_general: 57, brigadeiro: 53, coronel: 49, tenente_coronel: 45, major: 41, capitao: 35, tenente: 30, subtenente: 26, sargento_maior: 48, sargento_chefe: 44, sargento_ajudante: 40, primeiro_sargento: 35, segundo_sargento: 29, primeiro_cabo: 27, segundo_cabo: 24, soldado: 21 }
const ANOS_POSTO = { subtenente: 3, tenente: 4, capitao: 5, major: 4, tenente_coronel: 4, coronel: 5, brigadeiro: 3, tenente_general: 3, segundo_sargento: 4, primeiro_sargento: 4, sargento_ajudante: 4, sargento_chefe: 4, soldado: 2, segundo_cabo: 3 }
const SALARIO = { general: 2400000, tenente_general: 2100000, brigadeiro: 1700000, coronel: 1300000, tenente_coronel: 1050000, major: 850000, capitao: 650000, tenente: 410000, subtenente: 360000, sargento_maior: 330000, sargento_chefe: 300000, sargento_ajudante: 270000, primeiro_sargento: 240000, segundo_sargento: 210000, primeiro_cabo: 170000, segundo_cabo: 150000, soldado: 120000 }
const CURSOS = [['capitao', 'promocao_capitao', 'Curso de Promoção a Capitão'], ['major', 'promocao_oficial_superior', 'Curso de Promoção a Oficial Superior'], ['coronel', 'superior_guerra', 'Curso Superior de Guerra'], ['sargento_ajudante', 'promocao_sargento_ajudante', 'Curso de Promoção a Sargento-Ajudante'], ['sargento_chefe', 'promocao_sargento_chefe', 'Curso de Promoção a Sargento-Chefe']]
const OUTROS_CURSOS = ['Curso de Estado-Maior Conjunto', 'Curso de Estratégia e Arte Operativa', 'Curso de Organização do Asseguramento Moral e Psicológico', 'Curso de Operações de Paz', 'Curso de Língua Inglesa', 'Curso de Informática na Óptica do Utilizador', 'Curso de Instrutores', 'Curso de Comandantes de Companhia']
const DESTINOS = ['Estado-Maior General das FAA', 'Comando do Exército', 'Força Aérea Nacional — Base Aérea de Luanda', 'Marinha de Guerra Angolana — Base Naval de Luanda', 'Academia Militar do Exército', 'Instituto Superior Técnico Militar', 'Região Militar Centro', 'Região Militar Sul', 'Ministério da Defesa Nacional', 'Casa de Segurança do Presidente da República']

// o posto de quem ocupa o cargo: o mínimo e, às vezes, um acima (na mesma carreira e no ramo)
function postoParaCargo(minimo, ramo) {
  const l = carreiraDe(minimo)
  const i = l.indexOf(minimo)
  const cima = i >= 0 && i < l.length - 1 && !['general', 'tenente_general', 'brigadeiro'].includes(minimo) && aleatorio() < 0.35 ? l[i + 1] : minimo
  return existeNoRamo(cima, ramo) ? cima : minimo
}
const ramoDoCargo = (nomeCargo) => (/Força Naval|Naval|Marinha|Anfíbias/.test(nomeCargo) ? 'MGA' : /Força Aérea|Aviação|Aérea/.test(nomeCargo) ? 'FAN' : um(['EXE', 'EXE', 'EXE', 'EXE', 'FAN', 'MGA']))
const carreiraCivilDe = (nomeCargo) => (/Professor/.test(nomeCargo) ? 'docente' : /Médico|Superior|Odontolog/.test(nomeCargo) ? 'tecnico_superior' : /Técnico/.test(nomeCargo) ? 'tecnico_medio' : 'administrativo')

async function main() {
  const hoje = new Date()
  const ano = hoje.getUTCFullYear()
  const cargos = await bd.cargo.findMany({ include: { unidade: true, _count: { select: { pessoas: { where: { ativo: true } } } } }, orderBy: { id: 'asc' } })
  if (!cargos.length) return console.log('Não há cargos: carregue primeiro o quadro orgânico (Orgânica › Carregar o quadro orgânico).')
  const maxNum = async (campo, desde) => Math.max(desde, ...(await bd.pessoa.findMany({ select: { [campo]: true } })).map((p) => Number(p[campo])).filter((n) => Number.isFinite(n) && n < 900000))
  let nip = (await maxNum('nip', 300000)) + 1
  let agente = (await maxNum('numeroAgente', 7000)) + 1
  let processo = (await bd.processo.count()) + 1
  let lugar = 0
  const ultimo = await bd.processo.findFirst({ orderBy: { numero: 'desc' } })
  if (ultimo) processo = Number(ultimo.numero.replace(/\D/g, '')) + 1
  const arrumar = async (pessoaId, estado = um(['encapado', 'encapado', 'activo'])) => {
    // depois das estantes da semente (30 por prateleira, 5 prateleiras por estante)
    const k = 900 + lugar++
    await bd.processo.create({ data: { pessoaId, numero: `PI-${String(processo++).padStart(5, '0')}`, estante: String.fromCharCode(65 + Math.floor(k / 150) % 26), prateleira: String(1 + Math.floor((k % 150) / 30)), posicao: String(1 + (k % 30)), estado } })
  }
  // a ficha completa (residência, BI, agregado, vencimento, banco): tudo inventado
  const ficha = (tipo, genero, posto, nasc) => ({
    genero, estadoCivil: um(ESTADOS), provincia: um(PROVINCIAS), naturalidade: um(['Luanda', 'Huambo', 'Benguela', 'Lubango', 'Malanje', 'Uíge', 'Saurimo', 'Menongue', 'Cabinda', 'Namibe']),
    pai: `${um(NOMES_M)} ${um(APELIDOS)}`, mae: `${um(NOMES_F)} ${um(APELIDOS)}`, telefone: telefone(), morada: `${um(BAIRROS)}, Luanda`,
    municipio: um(MUNICIPIOS), bairro: um(BAIRROS), rua: `Rua ${entre(1, 40)}`, casa: String(entre(1, 300)), grupoSanguineo: um(SANGUE), bi: bi(), biEmitidoEm: data(ano - entre(1, 5)), biLocalEmissao: 'Luanda',
    agregado: aleatorio() < 0.75 ? JSON.stringify(Array.from({ length: entre(1, 4) }, () => ({ nome: `${aleatorio() < 0.5 ? um(NOMES_M) : um(NOMES_F)} ${um(APELIDOS)} ${um(APELIDOS)}`, parentesco: aleatorio() < 0.5 ? 'Filho' : 'Filha', dataNascimento: `${Math.min(ano - 1, nasc + entre(24, 38))}-0${entre(1, 9)}-1${entre(0, 9)}`, nacionalidade: 'Angolana', profissao: 'Estudante' }))) : '',
    vencimento: String((tipo === 'militar' ? SALARIO[posto] ?? 200000 : entre(110000, 420000)) + entre(0, 90000)), banco: um(['BPC', 'BAI', 'BFA', 'BIC', 'BCI']), iban: `AO06 0040 0000 ${entre(1000, 9999)} ${entre(1000, 9999)} 1012 ${entre(1, 9)}`, numeroConta: String(entre(100000000, 999999999)),
  })

  // um militar com toda a carreira: ingresso, cada promoção até ao posto actual, cursos e louvores
  // anoRef: o ano a que a ficha se refere (o de hoje, ou o da saída no pessoal antigo): a carreira acaba aí
  async function militar({ posto, ramo, unidadeId = null, cargo = null, vinculo = 'funcionario', ativo = true, entradaEscola, saida = null, anoRef = ano, velho = false }) {
    const genero = aleatorio() < 0.15 ? 'F' : 'M'
    // velho: quem passa à reserva ou à reforma tem mais anos de serviço (e de idade)
    const idade = (IDADE[posto] ?? 40) + entre(-2, 4) + (velho ? entre(10, 14) : 0)
    const nasc = data(anoRef - idade)
    const l = carreiraDe(posto)
    const passos = l.slice(0, l.indexOf(posto) + 1)
    // as promoções contam-se para trás a partir da antiguidade no posto actual
    const datas = []
    // no posto actual: de 0 ao tempo mínimo e um pouco mais (cerca de um terço fica em condições de promoção)
    let d = data(anoRef - entre(0, (ANOS_POSTO[posto] ?? 4) + 1))
    for (let i = passos.length - 1; i >= 0; i--) { datas.unshift(d); d = data(d.getUTCFullYear() - (ANOS_POSTO[passos[i - 1]] ?? 4) - entre(0, 1)) }
    const ingresso = data(Math.min(datas[0].getUTCFullYear() - entre(0, 2), nasc.getUTCFullYear() + 19 + entre(0, 4)))
    const oficial = POSTOS[posto].categoria.startsWith('oficial')
    const quadros = quadrosDoRamo(ramo).filter((q) => (oficial ? q.limiteOficiais : q.limiteSargentos))
    // chega à Escola depois de entrar nas FAA
    const entrada = new Date(Math.min(Math.max((entradaEscola ?? data(anoRef - entre(0, 8))).getTime(), ingresso.getTime() + 365 * 86_400_000), Date.now()))
    const p = await bd.pessoa.create({ data: {
      tipo: 'militar', vinculo, nome: nome(genero), nomeGuerra: aleatorio() < 0.3 ? um(APELIDOS) : '', nip: String(nip++), dataNascimento: nasc, ...ficha('militar', genero, posto, nasc.getUTCFullYear()),
      email: aleatorio() < 0.6 ? `m${nip}@esgfaa.gov.ao` : null, habilitacao: oficial ? um(['licenciatura', 'licenciatura', 'mestrado', 'mestrado', 'doutoramento']) : um(['medio', 'medio', 'bacharelato', 'licenciatura', 'base']),
      areaFormacao: oficial ? um(['Ciências Militares', 'Relações Internacionais', 'Engenharia', 'Gestão', 'Direito', 'Medicina', 'Psicologia', 'Economia', 'Informática']) : '',
      ramo, posto, fps: posto === 'soldado' || posto === 'segundo_cabo' ? um(['QP', 'SMO']) : 'QP', quadroEspecial: um(quadros)?.sigla ?? null, situacao: 'activo', efectividade: 'comissao_normal',
      dataIngresso: ingresso, dataIngressoQP: ingresso, dataAntiguidadePosto: datas.at(-1), localIncorporacao: um(['Luanda', 'Huambo', 'Benguela', 'Lubango', 'Malanje']), voluntario: aleatorio() < 0.8,
      avaliacaoFavoravel: aleatorio() > 0.05, aptidaoFisica: aleatorio() > 0.04,
      unidadeId, cargoId: cargo?.id ?? null, dataCargo: cargo ? entrada : null, dataEntradaEscola: entrada, ativo,
      ...(saida ? { dataSaidaEscola: saida.data, motivoSaida: saida.motivo, destinoSaida: saida.destino } : {}),
    } })
    await bd.evento.create({ data: { pessoaId: p.id, tipo: 'ingresso', data: ingresso, descricao: 'Incorporação nas FAA', criadoPor: POR } })
    for (const [i, pt] of passos.entries()) {
      if (i === 0) continue
      await bd.evento.create({ data: { pessoaId: p.id, tipo: 'promocao', data: datas[i], postoAnterior: passos[i - 1], postoNovo: pt, documento: `Ordem n.º ${entre(10, 99)}/CEMG/${datas[i].getUTCFullYear()}`, criadoPor: POR } })
    }
    for (const [pc, chave, n] of CURSOS) {
      const ic = l.indexOf(pc)
      if (ic > 0 && ic <= passos.length - 1) await bd.curso.create({ data: { pessoaId: p.id, chave, nome: n, tipo: 'promocao', local: 'Escola Superior de Guerra', fim: data(datas[ic].getUTCFullYear() - 1), aproveitamento: true, classificacao: entre(120, 185) / 10 } })
    }
    if (oficial && aleatorio() < 0.5) await bd.curso.create({ data: { pessoaId: p.id, nome: um(OUTROS_CURSOS), tipo: um(['formacao', 'qualificacao', 'actualizacao']), local: um(['Escola Superior de Guerra', 'Academia Militar do Exército', 'Instituto de Defesa Nacional']), fim: data(anoRef - entre(1, 10)), aproveitamento: true, classificacao: entre(120, 180) / 10 } })
    await bd.evento.create({ data: { pessoaId: p.id, tipo: 'colocacao', data: entrada, descricao: 'Colocação na Escola Superior de Guerra', documento: `Ordem n.º ${entre(10, 99)}/EMG/${entrada.getUTCFullYear()}`, criadoPor: POR } })
    if (aleatorio() < 0.22) await bd.evento.create({ data: { pessoaId: p.id, tipo: 'louvor', data: data(anoRef - entre(0, 6)), descricao: um(['Louvado pela dedicação e competência no serviço.', 'Louvado pelo empenho na organização do ano académico.', 'Louvado pelo zelo e espírito de missão.']), entidade: 'Comandante da Escola Superior de Guerra', documento: `Ordem de Serviço n.º ${entre(1, 60)}/ESG`, criadoPor: POR } })
    if (oficial && aleatorio() < 0.08) await bd.evento.create({ data: { pessoaId: p.id, tipo: 'condecoracao', data: data(anoRef - entre(1, 10)), descricao: um(['Medalha de Mérito Militar', 'Medalha de Serviço Distinto', 'Medalha Comemorativa da Paz']), entidade: 'Presidente da República', criadoPor: POR } })
    if (!oficial && aleatorio() < 0.06) await bd.evento.create({ data: { pessoaId: p.id, tipo: 'punicao', data: data(anoRef - entre(1, 4)), descricao: um(['Atraso na apresentação ao serviço', 'Falta injustificada ao serviço']), pena: um(['Repreensão', 'Repreensão registada']), entidade: 'Comandante da Companhia', criadoPor: POR } })
    return p
  }

  async function civil({ nomeCargo = '', unidadeId = null, cargo = null, ativo = true, entradaEscola, saida = null, anoRef = ano }) {
    const carreira = carreiraCivilDe(nomeCargo)
    const cats = CARREIRAS_CIVIS[carreira].categorias
    const genero = aleatorio() < 0.5 ? 'F' : 'M'
    const nasc = data(anoRef - entre(28, 58))
    const admissao = entradaEscola ?? data(anoRef - entre(2, 20))
    const p = await bd.pessoa.create({ data: {
      tipo: 'civil', vinculo: carreira === 'docente' ? 'docente' : 'funcionario', nome: `${carreira === 'docente' ? (genero === 'F' ? 'Prof.ª ' : 'Prof. ') : ''}${nome(genero)}`, numeroAgente: String(agente++), dataNascimento: nasc, ...ficha('civil', genero, null, nasc.getUTCFullYear()),
      email: `c${agente}@esgfaa.gov.ao`, inss: String(entre(10000000, 99999999)), habilitacao: carreira === 'docente' || carreira === 'tecnico_superior' ? um(['licenciatura', 'mestrado', 'doutoramento']) : um(['medio', 'medio', 'licenciatura']),
      carreiraCivil: carreira, categoriaCivil: cats[Math.min(cats.length - 1, entre(0, 3))], vinculoCivil: um(['nomeacao_definitiva', 'nomeacao_definitiva', 'contrato']), dataAdmissao: admissao, dataCategoria: data(anoRef - entre(1, 6)),
      unidadeId, cargoId: cargo?.id ?? null, dataCargo: cargo ? admissao : null, dataEntradaEscola: admissao, ativo,
      ...(saida ? { dataSaidaEscola: saida.data, motivoSaida: saida.motivo, destinoSaida: saida.destino } : {}),
    } })
    await bd.evento.create({ data: { pessoaId: p.id, tipo: 'admissao', data: admissao, descricao: 'Admissão na Escola Superior de Guerra', documento: `Despacho n.º ${entre(1, 80)}/MINDEN/${admissao.getUTCFullYear()}`, criadoPor: POR } })
    return p
  }

  // 1. todos os lugares vagos de todos os cargos
  let novos = 0
  for (const c of cargos) {
    for (let i = c._count.pessoas; i < c.vagas; i++) {
      const entrada = data(ano - entre(0, 7))
      const p = c.postoRequerido
        ? await (async () => { const ramo = ramoDoCargo(c.nome); return militar({ posto: postoParaCargo(c.postoRequerido, ramo), ramo, unidadeId: c.unidadeId, cargo: c, vinculo: /Professor/.test(c.nome) ? 'docente' : 'funcionario', entradaEscola: entrada }) })()
        : await civil({ nomeCargo: c.nome, unidadeId: c.unidadeId, cargo: c, entradaEscola: entrada })
      const entrou = p.dataEntradaEscola
      await bd.evento.create({ data: { pessoaId: p.id, tipo: 'nomeacao', data: entrou, cargoNome: c.nome, documento: `Despacho n.º ${entre(1, 90)}/ESG/${entrou.getUTCFullYear()}`, entidade: 'Comandante da Escola Superior de Guerra', criadoPor: POR } })
      // alguns tiveram antes outro cargo na Escola (nomeados e exonerados)
      if (aleatorio() < 0.25) {
        const antes = um(cargos)
        // o cargo anterior: antes deste, na Escola (a entrada na Escola recua para essa nomeação)
        const ini = data(entrou.getUTCFullYear() - entre(2, 5))
        if (!p.dataIngresso || ini > p.dataIngresso) {
          await bd.pessoa.update({ where: { id: p.id }, data: { dataEntradaEscola: ini } })
          await bd.evento.create({ data: { pessoaId: p.id, tipo: 'nomeacao', data: ini, cargoNome: antes.nome, documento: `Despacho n.º ${entre(1, 90)}/ESG/${ini.getUTCFullYear()}`, criadoPor: POR } })
          await bd.evento.create({ data: { pessoaId: p.id, tipo: 'exoneracao', data: new Date(entrou.getTime() - 86_400_000), cargoNome: antes.nome, documento: `Despacho n.º ${entre(1, 90)}/ESG/${entrou.getUTCFullYear()}`, criadoPor: POR } })
        }
      }
      await arrumar(p.id)
      novos++
    }
  }

  // 2. licenças, faltas e o plano de férias de quem está na Escola
  const activos = await bd.pessoa.findMany({ where: { ativo: true, vinculo: { not: 'domiciliar' } }, select: { id: true, tipo: true, vinculo: true } })
  let licencas = 0
  let ausencias = 0
  if (!(await bd.planoFerias.count({ where: { ano: ano + 1 } }))) {
    for (const p of activos.filter((x) => x.vinculo !== 'estudante')) {
      for (const a of [ano, ano + 1]) await bd.planoFerias.upsert({ where: { ano_pessoaId: { ano: a, pessoaId: p.id } }, update: {}, create: { ano: a, pessoaId: p.id, mes: entre(1, 12), criadoPor: POR } })
      if (await bd.licenca.count({ where: { pessoaId: p.id } })) continue
      if (aleatorio() < 0.55) {
        const ini = data(ano, entre(1, 9), entre(1, 10))
        const fim = new Date(ini.getTime() + entre(14, 29) * 86_400_000)
        await bd.licenca.create({ data: { pessoaId: p.id, tipo: 'ferias', inicio: ini, fim, dias: Math.round((fim - ini) / 86_400_000) + 1, despacho: `Despacho n.º ${entre(1, 90)}/ESG/${ano}`, criadoPor: POR } })
        licencas++
      }
      if (aleatorio() < 0.06) {
        const ini = new Date(hoje.getTime() - entre(0, 6) * 86_400_000)
        const fim = new Date(ini.getTime() + entre(3, 15) * 86_400_000)
        await bd.licenca.create({ data: { pessoaId: p.id, tipo: p.tipo === 'civil' ? um(['doenca', 'luto', 'casamento']) : um(['doenca', 'luto', 'casamento', 'merito']), inicio: ini, fim, dias: Math.round((fim - ini) / 86_400_000) + 1, despacho: `Guia n.º ${entre(1, 99)}/RPQ/${ano}`, criadoPor: POR } })
        licencas++
      }
      const r = aleatorio()
      if (r < 0.05) {
        const tipo = r < 0.025 ? 'falta' : r < 0.035 ? 'sem_justificacao' : r < 0.045 ? 'hospital' : 'detido'
        const ini = new Date(hoje.getTime() - entre(1, 12) * 86_400_000)
        await bd.ausencia.create({ data: { pessoaId: p.id, tipo, inicio: ini, fim: ['hospital', 'detido'].includes(tipo) && aleatorio() < 0.6 ? null : ini, motivo: { falta: 'Doença sem baixa', sem_justificacao: 'Não se apresentou ao serviço', hospital: 'Internamento no Hospital Militar Principal', detido: 'Detenção disciplinar' }[tipo], documento: `Participação n.º ${entre(1, 60)}/${ano}`, criadoPor: POR } })
        ausencias++
      }
    }
  }

  // 3. o pessoal antigo: quem já serviu na Escola e saiu (com o cargo que teve, quando e porquê)
  let antigos = 0
  if (!(await bd.evento.count({ where: { tipo: 'saida', criadoPor: POR } }))) {
    const MOTIVOS = [['Transferência', () => um(DESTINOS)], ['Passagem à reserva', () => ''], ['Passagem à reforma', () => ''], ['Nomeação para outro cargo', () => um(DESTINOS)], ['Fim da comissão', () => um(DESTINOS)], ['Falecimento', () => ''], ['Exoneração a pedido', () => ''], ['Abate ao efectivo', () => '']]
    for (let i = 0; i < 120; i++) {
      const c = um(cargos)
      const anoSaida = entre(2006, ano)
      const entrada = data(anoSaida - entre(2, 9))
      const praca = !c.postoRequerido || POSTOS[c.postoRequerido].categoria === 'praca'
      const [motivo, destino] = um(praca ? MOTIVOS.filter(([m]) => !m.startsWith('Passagem à re')) : MOTIVOS)
      const saida = { data: data(anoSaida), motivo, destino: destino() }
      const p = c.postoRequerido
        ? await militar({ posto: postoParaCargo(c.postoRequerido, 'EXE'), ramo: 'EXE', unidadeId: c.unidadeId, ativo: false, entradaEscola: entrada, saida, anoRef: anoSaida, velho: motivo.startsWith('Passagem à re') })
        : await civil({ nomeCargo: c.nome, unidadeId: c.unidadeId, ativo: false, entradaEscola: entrada, saida, anoRef: anoSaida })
      if (motivo.startsWith('Passagem à re')) await bd.pessoa.update({ where: { id: p.id }, data: { situacao: motivo.endsWith('reserva') ? 'reserva' : 'reforma', dataSituacao: saida.data } })
      const entrou = p.dataEntradaEscola
      if (entrou >= saida.data) {
        saida.data = new Date(Math.min(entrou.getTime() + entre(1, 4) * 365 * 86_400_000, hoje.getTime() - 86_400_000))
        await bd.pessoa.update({ where: { id: p.id }, data: { dataSaidaEscola: saida.data, ...(motivo.startsWith('Passagem à re') ? { dataSituacao: saida.data } : {}) } })
      }
      await bd.evento.create({ data: { pessoaId: p.id, tipo: 'nomeacao', data: entrou, cargoNome: c.nome, documento: `Despacho n.º ${entre(1, 90)}/ESG/${entrou.getUTCFullYear()}`, criadoPor: POR } })
      await bd.evento.create({ data: { pessoaId: p.id, tipo: 'exoneracao', data: saida.data, cargoNome: c.nome, documento: `Despacho n.º ${entre(1, 90)}/ESG/${anoSaida}`, criadoPor: POR } })
      await bd.evento.create({ data: { pessoaId: p.id, tipo: 'saida', data: saida.data, descricao: [motivo, saida.destino && `Destino: ${saida.destino}`].filter(Boolean).join(' · '), criadoPor: POR } })
      await arrumar(p.id, 'arquivado')
      antigos++
    }
  }

  // 4. contas de chefe (expediente e mensagens) para as chefias das unidades que ainda não têm: Escola2026demo
  const senha = await new CifraSenhas().cifrar('Escola2026demo')
  const comConta = new Set((await bd.utilizador.findMany({ where: { unidadeId: { not: null } }, select: { unidadeId: true } })).map((x) => x.unidadeId))
  let contas = 0
  for (const p of await bd.pessoa.findMany({ where: { ativo: true, cargo: { funcao: { in: ['comando', 'direccao_chefia'] } } }, include: { cargo: true }, orderBy: { id: 'asc' } })) {
    if (comConta.has(p.unidadeId) || !p.nip || await bd.utilizador.count({ where: { email: `${p.nip}@pessoal.interno` } })) continue
    await bd.utilizador.create({ data: { nome: p.nome, email: `${p.nip}@pessoal.interno`, papel: 'utente', pessoaId: p.id, unidadeId: p.unidadeId, senha, deveMudar: false } })
    comConta.add(p.unidadeId)
    contas++
  }

  const lugares = cargos.reduce((n, c) => n + c.vagas, 0)
  const ocupados = await bd.pessoa.count({ where: { ativo: true, cargoId: { not: null } } })
  console.log(`Fichas novas nos cargos: ${novos} · lugares ocupados: ${ocupados}/${lugares} · pessoal antigo: ${antigos} · licenças: ${licencas} · faltas e ausências: ${ausencias} · contas de chefe novas: ${contas} (palavra-passe Escola2026demo).`)
}

try {
  await main()
} finally {
  await bd.$disconnect()
}
