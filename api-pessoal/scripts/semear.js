/*
  Dados de demonstração do Sistema de Gestão de Pessoal: unidades e cargos da Escola, militares dos três
  ramos e pessoal civil, com cursos, histórico e licenças. Só corre numa base vazia (sem fichas), a não ser
  com --forcar (apaga as fichas, propostas e o quadro orgânico; os utilizadores ficam).
  Uso: npm run semear [-- --forcar]
*/
import { criarConfig } from '../src/config.js'
import { criarPrisma } from '../src/infraestrutura/bd.js'
import { POSTOS, quadrosDoRamo } from '../src/dominio/pessoal/hierarquia.js'
import { CARREIRAS_CIVIS } from '../src/dominio/pessoal/civis.js'
import { PROVINCIAS } from '../src/dominio/pessoal/ficha.js'
import { limiteDomiciliares } from '../src/dominio/pessoal/domiciliares.js'
import { CifraSenhas } from '../src/infraestrutura/cifra.js'

const config = criarConfig()
const bd = criarPrisma(config.urlBaseDados)
const forcar = process.argv.includes('--forcar')

// gerador pseudo-aleatório com semente: os mesmos dados de cada vez
let semente = 20261017
const aleatorio = () => ((semente = (semente * 1103515245 + 12345) % 2147483648) / 2147483648)
const um = (l) => l[Math.floor(aleatorio() * l.length)]
const entre = (a, b) => a + Math.floor(aleatorio() * (b - a + 1))
const data = (ano, mes = entre(1, 12), dia = entre(1, 28)) => new Date(Date.UTC(ano, mes - 1, dia))

const NOMES_M = ['António', 'Manuel', 'João', 'José', 'Pedro', 'Francisco', 'Domingos', 'Afonso', 'Bernardo', 'Carlos', 'Mateus', 'Paulo', 'Miguel', 'Alberto', 'Joaquim', 'Adriano', 'Agostinho', 'Simão', 'Eduardo', 'Fernando', 'Lucas', 'Gaspar', 'Isaías', 'Valentim', 'Narciso']
const NOMES_F = ['Maria', 'Ana', 'Luísa', 'Teresa', 'Isabel', 'Rosa', 'Helena', 'Joana', 'Esperança', 'Conceição', 'Domingas', 'Filomena', 'Madalena', 'Celeste', 'Graça']
const APELIDOS = ['Kiala', 'Tchipa', 'Lopes', 'Neto', 'Santos', 'Cassoma', 'Mbala', 'Sebastião', 'Muteka', 'Kalunga', 'Ndala', 'Chilombo', 'Fernandes', 'Domingos', 'Kangamba', 'Mavinga', 'Sapalo', 'Tomás', 'Cambuta', 'Hossi', 'Quissanga', 'Bumba', 'Nzinga', 'Capitango', 'Ventura']
const nome = (g) => `${g === 'F' ? um(NOMES_F) : um(NOMES_M)} ${um(APELIDOS)} ${um(APELIDOS)}`
const ESTADOS = ['solteiro', 'casado', 'casado', 'casado', 'uniao_facto', 'divorciado', 'viuvo']
const HAB_OF = ['licenciatura', 'licenciatura', 'mestrado', 'mestrado', 'doutoramento']

// orgânica da Escola (árvore: unidades, subunidades, secções): [nome, sigla, tipo, sigla da unidade-mãe]
const UNIDADES = [
  ['Direcção da Escola', 'DIR', 'direccao', null], ['Gabinete do Director', 'GD', 'gabinete', 'DIR'], ['Secretaria Geral', 'SG', 'servico', 'DIR'],
  ['Departamento de Ensino', 'DE', 'departamento', null], ['Secção de Estratégia', 'SEE', 'seccao', 'DE'], ['Secção de Táctica e Operações', 'STO', 'seccao', 'DE'], ['Secção de Logística Militar', 'SLM', 'seccao', 'DE'],
  ['Departamento de Investigação e Pós-Graduação', 'DIPG', 'departamento', null], ['Centro de Estudos Estratégicos', 'CEE', 'seccao', 'DIPG'],
  ['Departamento de Cursos', 'DC', 'departamento', null], ['Curso de Estado-Maior', 'CEM', 'curso', 'DC'], ['Curso Superior de Guerra', 'CSG', 'curso', 'DC'],
  ['Repartição de Pessoal e Quadros', 'RPQ', 'reparticao', null], ['Secção de Efectivos', 'SEF', 'seccao', 'RPQ'], ['Secção de Carreiras', 'SCA', 'seccao', 'RPQ'], ['Secção de Arquivo', 'SAR', 'seccao', 'RPQ'],
  ['Repartição de Logística', 'RL', 'reparticao', null], ['Secção de Material', 'SMT', 'seccao', 'RL'], ['Secção de Transportes', 'STR', 'seccao', 'RL'],
  ['Repartição de Finanças', 'RF', 'reparticao', null], ['Biblioteca e Documentação', 'BD', 'servico', null], ['Serviço de Saúde', 'SS', 'servico', null], ['Companhia de Serviços', 'CS', 'companhia', null],
]
// cargos: [unidade, nome, função, posto, lugares, tipo]
const CARGOS = [
  ['DIR', 'Director da Escola Superior de Guerra', 'comando', 'tenente_general', 1], ['DIR', 'Director Adjunto para o Ensino', 'direccao_chefia', 'brigadeiro', 1],
  ['GD', 'Chefe do Gabinete', 'direccao_chefia', 'coronel', 1], ['GD', 'Assessor do Director', 'estado_maior', 'tenente_coronel', 2],
  ['SG', 'Secretário Geral', 'direccao_chefia', 'tenente_coronel', 1], ['SG', 'Técnico de Secretaria', 'execucao', null, 3, 'civil'],
  ['DE', 'Chefe do Departamento de Ensino', 'direccao_chefia', 'coronel', 1],
  ['SEE', 'Chefe da Secção de Estratégia', 'direccao_chefia', 'coronel', 1], ['SEE', 'Professor de Estratégia', 'execucao', 'coronel', 3],
  ['STO', 'Chefe da Secção de Táctica e Operações', 'direccao_chefia', 'coronel', 1], ['STO', 'Professor de Táctica', 'execucao', 'tenente_coronel', 3],
  ['SLM', 'Chefe da Secção de Logística Militar', 'direccao_chefia', 'tenente_coronel', 1], ['SLM', 'Professor de Logística Militar', 'execucao', 'major', 3],
  ['DIPG', 'Chefe do Departamento de Investigação', 'direccao_chefia', 'coronel', 1], ['CEE', 'Investigador', 'execucao', 'major', 3],
  ['DC', 'Chefe do Departamento de Cursos', 'direccao_chefia', 'coronel', 1], ['CEM', 'Coordenador do Curso de Estado-Maior', 'execucao', 'tenente_coronel', 1], ['CSG', 'Coordenador do Curso Superior de Guerra', 'execucao', 'coronel', 1],
  ['RPQ', 'Chefe da Repartição de Pessoal e Quadros', 'direccao_chefia', 'tenente_coronel', 1], ['SEF', 'Chefe da Secção de Efectivos', 'direccao_chefia', 'capitao', 1], ['SEF', 'Sargento de Efectivos', 'execucao', 'primeiro_sargento', 2],
  ['SCA', 'Chefe da Secção de Carreiras', 'direccao_chefia', 'capitao', 1], ['SAR', 'Arquivista', 'execucao', null, 2, 'civil'],
  ['RL', 'Chefe da Repartição de Logística', 'direccao_chefia', 'major', 1], ['SMT', 'Sargento de Material', 'execucao', 'segundo_sargento', 2], ['STR', 'Condutor', 'execucao', null, 4, 'civil'],
  ['RF', 'Chefe da Repartição de Finanças', 'direccao_chefia', 'major', 1], ['RF', 'Técnico de Contabilidade', 'execucao', null, 3, 'civil'],
  ['BD', 'Bibliotecário', 'execucao', null, 2, 'civil'], ['SS', 'Médico', 'execucao', 'capitao', 2], ['SS', 'Enfermeiro', 'execucao', 'primeiro_sargento', 2],
  ['CS', 'Comandante da Companhia de Serviços', 'comando', 'capitao', 1], ['CS', 'Auxiliar de Serviços Gerais', 'execucao', null, 4, 'civil'], ['SG', 'Auxiliar de Escritório', 'execucao', null, 2, 'civil'],
]

// postos dos militares que servem na Escola (sobretudo oficiais) e o tempo típico no posto
const PERFIS = [['coronel', 12], ['coronel', 10], ['tenente_coronel', 10], ['tenente_coronel', 10], ['major', 10], ['major', 8], ['capitao', 8], ['capitao', 6], ['tenente', 4], ['subtenente', 3], ['sargento_chefe', 3], ['sargento_ajudante', 3], ['primeiro_sargento', 4], ['segundo_sargento', 4], ['brigadeiro', 1], ['tenente_general', 1]]
const IDADE_POSTO = { tenente_general: 58, brigadeiro: 53, coronel: 50, tenente_coronel: 46, major: 41, capitao: 36, tenente: 30, subtenente: 27, sargento_chefe: 44, sargento_ajudante: 40, primeiro_sargento: 35, segundo_sargento: 30 }

async function main() {
  if (await bd.pessoa.count()) {
    if (!forcar) return console.log('Já há fichas: nada a fazer (use --forcar para apagar e voltar a criar).')
    await bd.proposta.deleteMany()
    await bd.extracto.deleteMany()
    await bd.expediente.deleteMany()
    await bd.conversa.deleteMany()
    await bd.utilizador.deleteMany({ where: { papel: 'utente' } })
    await bd.pessoa.deleteMany()
    await bd.cargo.deleteMany()
    await bd.unidade.deleteMany()
  }
  const hoje = new Date()
  const ano = hoje.getUTCFullYear()
  const unidades = {}
  for (const [i, [n, s, tipo, pai]] of UNIDADES.entries()) unidades[s] = await bd.unidade.create({ data: { nome: n, sigla: s, tipo, ordem: i, paiId: pai ? unidades[pai].id : null } })
  const cargos = []
  for (const [u, n, f, posto, vagas, tipo = 'militar'] of CARGOS) cargos.push(await bd.cargo.create({ data: { nome: n, unidadeId: unidades[u].id, funcao: f, postoRequerido: posto, vagas, tipo } }))
  const livres = (c) => c.vagas - (c.ocupados ?? 0)

  let nip = 100000
  const criarMilitar = async ({ vinculo = 'funcionario', posto, anosNoPosto, ramo = um(['EXE', 'EXE', 'EXE', 'FAN', 'MGA']) }) => {
    const genero = aleatorio() < 0.16 ? 'F' : 'M'
    const idade = (IDADE_POSTO[posto] ?? 40) + entre(-3, 4)
    const nasc = data(ano - idade)
    const ingresso = data(nasc.getUTCFullYear() + entre(18, 22))
    const antiguidade = data(ano - anosNoPosto, entre(1, 12))
    const quadros = quadrosDoRamo(ramo).filter((q) => (POSTOS[posto].categoria.startsWith('oficial') ? q.limiteOficiais : q.limiteSargentos))
    const cargo = vinculo !== 'estudante' ? cargos.find((c) => c.tipo === 'militar' && c.postoRequerido === posto && livres(c) > 0) : null
    if (cargo) cargo.ocupados = (cargo.ocupados ?? 0) + 1
    const oficial = POSTOS[posto].categoria.startsWith('oficial')
    const p = await bd.pessoa.create({
      data: {
        tipo: 'militar', vinculo, nome: nome(genero), nomeGuerra: aleatorio() < 0.4 ? um(APELIDOS) : '', nip: String(nip++), bi: `00${entre(1000000, 9999999)}LA0${entre(10, 99)}`,
        dataNascimento: nasc, genero, estadoCivil: um(ESTADOS), naturalidade: '', provincia: um(PROVINCIAS), pai: `${um(NOMES_M)} ${um(APELIDOS)}`, mae: `${um(NOMES_F)} ${um(APELIDOS)}`,
        email: vinculo !== 'funcionario' || aleatorio() < 0.5 ? `m${nip}@esgfaa.gov.ao` : null, telefone: `+244 9${entre(10, 99)} ${entre(100, 999)} ${entre(100, 999)}`, morada: `${um(['Bairro Militar', 'Talatona', 'Kilamba', 'Maianga', 'Rangel', 'Cazenga'])}, Luanda`,
        habilitacao: oficial ? um(HAB_OF) : um(['medio', 'medio', 'bacharelato', 'licenciatura']), areaFormacao: oficial ? um(['Ciências Militares', 'Relações Internacionais', 'Engenharia', 'Gestão', 'Direito', 'Medicina']) : '',
        unidadeId: cargo ? cargo.unidadeId : vinculo === 'estudante' ? um([unidades.CEM.id, unidades.CEM.id, unidades.CSG.id]) : um(Object.values(unidades)).id, cargoId: cargo?.id ?? null, dataCargo: cargo ? data(ano - entre(0, 3)) : null,
        ramo, posto, fps: 'QP', quadroEspecial: um(quadros)?.sigla ?? null, especialidade: '', situacao: 'activo', efectividade: aleatorio() < 0.05 ? 'inactividade_temporaria' : 'comissao_normal',
        dataIngresso: ingresso, dataIngressoQP: ingresso, dataAntiguidadePosto: antiguidade, avaliacaoFavoravel: aleatorio() > 0.06, aptidaoFisica: aleatorio() > 0.04, processoPendente: aleatorio() < 0.03,
      },
    })
    // cursos de promoção que já devia ter feito para chegar ao posto (e, às vezes, o do posto seguinte)
    const g = POSTOS[posto].grau
    const cursos = [[12, 'promocao_capitao', 'Curso de Promoção a Capitão'], [13, 'promocao_oficial_superior', 'Curso de Promoção a Oficial Superior'], [16, 'superior_guerra', 'Curso Superior de Guerra'], [6, 'promocao_sargento_ajudante', 'Curso de Promoção a Sargento-Ajudante'], [7, 'promocao_sargento_chefe', 'Curso de Promoção a Sargento-Chefe']]
    for (const [gc, chave, n] of cursos) {
      const mesmaCarreira = oficial ? gc >= 10 : gc < 9
      if (mesmaCarreira && (gc <= g || (gc === g + 1 && aleatorio() < 0.55))) await bd.curso.create({ data: { pessoaId: p.id, chave, nome: n, tipo: 'promocao', local: 'Escola Superior de Guerra', fim: data(Math.min(ano - 1, antiguidade.getUTCFullYear() + (gc <= g ? -1 : 1))), aproveitamento: true, classificacao: entre(120, 185) / 10 } })
    }
    await bd.evento.create({ data: { pessoaId: p.id, tipo: 'ingresso', data: ingresso, descricao: 'Incorporação nas FAA', criadoPor: 'semear' } })
    await bd.evento.create({ data: { pessoaId: p.id, tipo: 'promocao', data: antiguidade, postoNovo: posto, documento: `Ordem n.º ${entre(10, 99)}/CEMG/${antiguidade.getUTCFullYear()}`, criadoPor: 'semear' } })
    if (cargo) await bd.evento.create({ data: { pessoaId: p.id, tipo: 'nomeacao', data: p.dataCargo, cargoNome: cargo.nome, documento: `Despacho n.º ${entre(1, 60)}/ESG/${p.dataCargo.getUTCFullYear()}`, criadoPor: 'semear' } })
    if (aleatorio() < 0.2) await bd.evento.create({ data: { pessoaId: p.id, tipo: 'louvor', data: data(ano - entre(0, 4)), descricao: 'Louvado pela dedicação e competência no serviço.', criadoPor: 'semear' } })
    // licenças deste ano
    if (aleatorio() < 0.5) {
      const ini = data(ano, entre(1, 12), entre(1, 10))
      const fim = new Date(ini.getTime() + entre(9, 25) * 86_400_000)
      await bd.licenca.create({ data: { pessoaId: p.id, tipo: 'ferias', inicio: ini, fim, dias: Math.round((fim - ini) / 86_400_000) + 1, criadoPor: 'semear' } })
    }
    if (aleatorio() < 0.12) {
      const ini = new Date(hoje.getTime() - entre(0, 5) * 86_400_000)
      const fim = new Date(ini.getTime() + entre(3, 12) * 86_400_000)
      await bd.licenca.create({ data: { pessoaId: p.id, tipo: um(['doenca', 'luto', 'casamento']), inicio: ini, fim, dias: Math.round((fim - ini) / 86_400_000) + 1, criadoPor: 'semear' } })
    }
    return p
  }

  // chefias e corpo docente (os cargos), mais estudantes dos cursos (os três ramos)
  let n = 0
  for (const c of cargos.filter((x) => x.tipo === 'militar')) {
    for (let i = 0; i < c.vagas; i++) {
      // alguns lugares ficam vagos (os de comando estão sempre preenchidos)
      if (c.funcao !== 'comando' && aleatorio() < (c.vagas > 1 ? 0.3 : 0.2)) continue
      const docente = ['DE', 'SEE', 'STO', 'SLM', 'DIPG', 'CEE', 'DC', 'CEM', 'CSG'].some((x) => unidades[x].id === c.unidadeId)
      await criarMilitar({ posto: c.postoRequerido, anosNoPosto: entre(1, 9), vinculo: docente ? 'docente' : 'funcionario' })
      n++
    }
  }
  for (let i = 0; i < 14; i++) {
    const [posto, max] = um(PERFIS.slice(0, 10))
    await criarMilitar({ posto, anosNoPosto: entre(1, max), vinculo: aleatorio() < 0.3 ? 'docente' : 'funcionario' })
    n++
  }
  for (let i = 0; i < 30; i++) {
    await criarMilitar({ posto: um(['major', 'major', 'tenente_coronel', 'capitao', 'coronel']), anosNoPosto: entre(2, 8), vinculo: 'estudante', ramo: um(['EXE', 'EXE', 'FAN', 'MGA']) })
    n++
  }
  // alguns na reserva (continuam a servir na Escola, ex.: docência)
  for (let i = 0; i < 4; i++) {
    const p = await criarMilitar({ posto: 'coronel', anosNoPosto: 12, vinculo: 'docente' })
    await bd.pessoa.update({ where: { id: p.id }, data: { situacao: 'reserva', dataSituacao: data(ano - entre(1, 3)), dataNascimento: data(ano - entre(60, 63)), cargoId: null } })
  }

  // pessoal civil
  let agente = 5000
  for (const c of cargos.filter((x) => x.tipo === 'civil')) {
    for (let i = 0; i < c.vagas; i++) {
      const carreira = c.nome.startsWith('Técnico de C') ? 'tecnico_superior' : ['Condutor', 'Auxiliar de Serviços Gerais'].includes(c.nome) ? 'auxiliar_servicos_gerais' : c.nome === 'Auxiliar de Escritório' ? 'auxiliar_escritorio' : ['Bibliotecário', 'Arquivista'].includes(c.nome) ? 'tecnico_medio' : 'administrativo'
      const cats = CARREIRAS_CIVIS[carreira].categorias
      const genero = aleatorio() < 0.5 ? 'F' : 'M'
      const admissao = data(ano - entre(3, 25))
      const p = await bd.pessoa.create({
        data: {
          tipo: 'civil', vinculo: 'funcionario', nome: nome(genero), numeroAgente: String(agente++), bi: `00${entre(1000000, 9999999)}LA0${entre(10, 99)}`, dataNascimento: data(ano - entre(26, 58)), genero, estadoCivil: um(ESTADOS),
          provincia: um(PROVINCIAS), email: `c${agente}@esgfaa.gov.ao`, telefone: `+244 9${entre(10, 99)} ${entre(100, 999)} ${entre(100, 999)}`, habilitacao: um(['medio', 'medio', 'licenciatura']),
          unidadeId: c.unidadeId, cargoId: c.id, dataCargo: admissao, carreiraCivil: carreira, categoriaCivil: cats[Math.min(cats.length - 2, entre(0, 3))], vinculoCivil: um(['nomeacao_definitiva', 'nomeacao_definitiva', 'contrato']),
          dataAdmissao: admissao, dataCategoria: data(ano - entre(1, 6)),
        },
      })
      await bd.evento.create({ data: { pessoaId: p.id, tipo: 'admissao', data: admissao, descricao: 'Admissão na Escola Superior de Guerra', criadoPor: 'semear' } })
      n++
    }
  }
  for (let i = 0; i < 6; i++) {
    const genero = aleatorio() < 0.5 ? 'F' : 'M'
    const p = await bd.pessoa.create({ data: { tipo: 'civil', vinculo: 'docente', nome: `${genero === 'F' ? 'Prof.ª' : 'Prof.'} ${nome(genero)}`, numeroAgente: String(agente++), dataNascimento: data(ano - entre(35, 62)), genero, provincia: um(PROVINCIAS), email: `d${agente}@esgfaa.gov.ao`, habilitacao: um(['mestrado', 'doutoramento']), areaFormacao: um(['Relações Internacionais', 'Direito', 'Economia', 'História', 'Ciência Política']), unidadeId: unidades.DE.id, carreiraCivil: 'docente', categoriaCivil: um(['Assistente', 'Professor Auxiliar', 'Professor Associado']), vinculoCivil: 'contrato', dataAdmissao: data(ano - entre(2, 12)), dataCategoria: data(ano - entre(1, 5)) } })
    await bd.evento.create({ data: { pessoaId: p.id, tipo: 'admissao', data: p.dataAdmissao, criadoPor: 'semear' } })
    n++
  }
  // empregadas domiciliares de alguns oficiais superiores e generais (dentro do limite do posto)
  let dom = 0
  for (const o of await bd.pessoa.findMany({ where: { tipo: 'militar', vinculo: { not: 'estudante' }, posto: { in: ['major', 'tenente_coronel', 'coronel', 'brigadeiro', 'tenente_general'] } } })) {
    const k = Math.min(limiteDomiciliares(o.posto), aleatorio() < 0.45 ? entre(1, 2) : 0)
    for (let i = 0; i < k; i++) {
      await bd.pessoa.create({ data: { tipo: 'civil', vinculo: 'domiciliar', carreiraCivil: 'trabalhador_domiciliar', categoriaCivil: 'Trabalhador Domiciliar', militarAlocadoId: o.id, nome: `${um(NOMES_F)} ${um(APELIDOS)} ${um(APELIDOS)}`, numeroAgente: `ED${agente++}`, genero: 'F', dataNascimento: data(ano - entre(22, 50)), provincia: um(PROVINCIAS), telefone: `+244 9${entre(10, 99)} ${entre(100, 999)} ${entre(100, 999)}`, dataAdmissao: data(ano - entre(1, 8)) } })
      dom++
    }
  }
  // processos individuais numerados, com a localização no arquivo
  const todas = await bd.pessoa.findMany({ where: { vinculo: { not: 'domiciliar' } }, orderBy: { id: 'asc' } })
  // arrumados nas estantes (10 posições por prateleira, 4 prateleiras por estante), com alguns lugares livres
  let lugar = 0
  for (const [i, p] of todas.entries()) {
    if (aleatorio() < 0.12) lugar++
    await bd.processo.create({ data: { pessoaId: p.id, numero: `PI-${String(i + 1).padStart(5, '0')}`, estante: String.fromCharCode(65 + Math.floor(lugar / 40)), prateleira: String(1 + Math.floor((lugar % 40) / 10)), posicao: String(1 + (lugar % 10)), estado: aleatorio() < 0.85 ? 'encapado' : 'activo' } })
    lugar++
  }

  // contas de demonstração (utente) para o expediente e as mensagens: palavra-passe Escola2026demo
  const cifra = new CifraSenhas()
  const senha = await cifra.cifrar('Escola2026demo')
  const chefes = await bd.pessoa.findMany({ where: { cargo: { funcao: { in: ['comando', 'direccao_chefia'] } } }, include: { cargo: true } })
  const contas = []
  for (const p of chefes) contas.push(await bd.utilizador.create({ data: { nome: p.nome, email: `${p.nip}@pessoal.interno`, papel: 'utente', pessoaId: p.id, unidadeId: p.unidadeId, senha, deveMudar: false } }))
  const por = (sigla) => contas.find((c) => c.unidadeId === unidades[sigla].id)
  const docs = [
    ['DE', ['RL'], 'requerimento', 'Pedido de material didáctico para o Curso de Estado-Maior', true],
    ['RPQ', ['DE', 'DC'], 'circular', 'Actualização dos dados dos processos individuais até ao fim do mês', false],
    ['DIR', ['DE', 'DIPG', 'DC', 'SG'], 'ordem', 'Ordem de serviço: abertura do ano académico 2026/2027', true],
    ['SG', ['RF'], 'oficio', 'Pedido de cabimentação orçamental para a conferência de estratégia', false],
  ]
  let seq = 1
  for (const [de, para, tipo, assunto, fisico] of docs) {
    const autor = por(de)
    if (!autor) continue
    const e = await bd.expediente.create({ data: { protocolo: `EXP-${ano}-${String(seq++).padStart(4, '0')}`, tipo, assunto, classificacao: tipo === 'ordem' ? 'urgente' : 'normal', origemUnidadeId: unidades[de].id, temFisico: fisico, criadoPorId: autor.id } })
    for (const s2 of para) await bd.movimento.create({ data: { expedienteId: e.id, deUnidadeId: unidades[de].id, paraUnidadeId: unidades[s2].id, enviadoPorId: autor.id, fisico: fisico ? 'a_enviar' : 'nao_aplica', fisicoPortador: fisico ? 'Estafeta da Companhia de Serviços' : '' } })
  }
  // conversa geral com as primeiras mensagens do Director e dos chefes
  const geral = await bd.conversa.create({ data: { tipo: 'geral', nome: 'Escola Superior de Guerra (todos)' } })
  const frases = ['Bom dia a todos. Recordo a reunião de coordenação de segunda-feira às 08h00 na sala do Conselho.', 'Bom dia, meu General. A Repartição de Pessoal confirma a presença.', 'Departamento de Ensino presente. Levaremos o plano de aulas do CEM.', 'Peço às áreas que enviem pelo expediente os mapas de efectivos até sexta-feira.']
  for (const [i, f] of frases.entries()) {
    const autor = i === 0 ? por('DIR') : contas[i % contas.length]
    if (autor) await bd.mensagem.create({ data: { conversaId: geral.id, autorId: autor.id, texto: f, criadoEm: new Date(Date.now() - (frases.length - i) * 600_000) } })
  }
  console.log(`Criadas ${Object.keys(unidades).length} unidades, ${cargos.length} cargos, ${n} fichas, ${dom} domiciliares, ${contas.length} contas de demonstração (palavra-passe Escola2026demo).`)
}

try {
  await main()
} finally {
  await bd.$disconnect()
}
