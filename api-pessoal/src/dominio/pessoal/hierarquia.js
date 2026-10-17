/*
  Hierarquia militar das Forças Armadas Angolanas (Lei n.º 13/18, de 29 de outubro — Lei das Carreiras
  dos Militares das FAA). Na Escola Superior de Guerra servem militares dos três ramos; os postos com o
  mesmo "grau" equivalem-se entre ramos (ex.: Coronel ↔ Capitão-de-Mar-e-Guerra).
*/
export const RAMOS = {
  EXE: { nome: 'Exército', sigla: 'EXE' },
  FAN: { nome: 'Força Aérea Nacional', sigla: 'FAN' },
  MGA: { nome: 'Marinha de Guerra Angolana', sigla: 'MGA' },
}

// art. 3.º: categorias (Oficiais, Sargentos, Praças) e, nos oficiais, os escalões do art. 71.º
export const CATEGORIAS = {
  oficial_general: { nome: 'Oficial General', grupo: 'oficiais' },
  oficial_superior: { nome: 'Oficial Superior', grupo: 'oficiais' },
  oficial_capitao: { nome: 'Oficial Capitão', grupo: 'oficiais' },
  oficial_subalterno: { nome: 'Oficial Subalterno', grupo: 'oficiais' },
  sargento: { nome: 'Sargento', grupo: 'sargentos' },
  praca: { nome: 'Praça', grupo: 'pracas' },
}
export const GRUPOS = { oficiais: 'Oficiais', sargentos: 'Sargentos', pracas: 'Praças' }

// formas de prestação de serviço (art. 2.º) e a carreira que lhes corresponde (art. 43.º)
export const FORMAS_SERVICO = {
  QP: { nome: 'Quadro Permanente', carreira: 'Carreira Longa' },
  SMC: { nome: 'Serviço Militar por Contrato', carreira: 'Carreira Média' },
  SMO: { nome: 'Serviço Militar Obrigatório', carreira: 'Carreira Curta' },
  SMR: { nome: 'Serviço Militar da Reserva', carreira: '—' },
}

// situações de serviço (art. 6.º) e, no ativo, a efetividade (art. 11.º)
export const SITUACOES = { activo: 'Activo', reserva: 'Reserva', reforma: 'Reforma' }
export const EFECTIVIDADES = {
  comissao_normal: { nome: 'Comissão normal', efectividade: true },
  inactividade_temporaria: { nome: 'Inactividade temporária', efectividade: true },
  comissao_especial: { nome: 'Comissão especial', efectividade: false },
  licenca_registada: { nome: 'Licença registada', efectividade: false },
  licenca_ilimitada: { nome: 'Licença ilimitada', efectividade: false },
}
// funções militares (art. 21.º)
export const FUNCOES = { comando: 'Comando', direccao_chefia: 'Direcção e Chefia', estado_maior: 'Estado Maior', execucao: 'Execução' }

const P = (id, grau, categoria, nomes) => ({ id, grau, categoria, nomes })
/*
  Postos por grau (1 = mais baixo). nomes: { EXE, FAN, MGA } — o mesmo grau tem nomes diferentes na Marinha.
  Aspirante e Subsargento são postos do Serviço Militar Obrigatório (art. 127.º).
*/
const GRAUS = [
  P('soldado', 1, 'praca', { EXE: 'Soldado', FAN: 'Soldado', MGA: 'Grumete' }),
  P('segundo_cabo', 2, 'praca', { EXE: '2.º Cabo', FAN: '2.º Cabo', MGA: 'Marinheiro' }),
  P('subsargento', 3, 'sargento', { EXE: 'Subsargento', FAN: 'Subsargento', MGA: 'Subsargento' }),
  P('segundo_sargento', 4, 'sargento', { EXE: '2.º Sargento', FAN: '2.º Sargento', MGA: '2.º Sargento' }),
  P('primeiro_sargento', 5, 'sargento', { EXE: '1.º Sargento', FAN: '1.º Sargento', MGA: '1.º Sargento' }),
  P('sargento_ajudante', 6, 'sargento', { EXE: 'Sargento-Ajudante', FAN: 'Sargento-Ajudante', MGA: 'Sargento-Ajudante' }),
  P('sargento_chefe', 7, 'sargento', { EXE: 'Sargento-Chefe', FAN: 'Sargento-Chefe', MGA: 'Sargento-Chefe' }),
  P('sargento_maior', 8, 'sargento', { EXE: 'Sargento-Maior', FAN: 'Sargento-Maior', MGA: 'Sargento-Maior' }),
  P('aspirante', 9, 'oficial_subalterno', { EXE: 'Aspirante', FAN: 'Aspirante', MGA: 'Aspirante' }),
  P('subtenente', 10, 'oficial_subalterno', { EXE: 'Subtenente', FAN: 'Subtenente', MGA: 'Tenente-de-Corveta' }),
  P('tenente', 11, 'oficial_subalterno', { EXE: 'Tenente', FAN: 'Tenente', MGA: 'Tenente-de-Fragata' }),
  P('capitao', 12, 'oficial_capitao', { EXE: 'Capitão', FAN: 'Capitão', MGA: 'Tenente-de-Navio' }),
  P('major', 13, 'oficial_superior', { EXE: 'Major', FAN: 'Major', MGA: 'Capitão-de-Corveta' }),
  P('tenente_coronel', 14, 'oficial_superior', { EXE: 'Tenente-Coronel', FAN: 'Tenente-Coronel', MGA: 'Capitão-de-Fragata' }),
  P('coronel', 15, 'oficial_superior', { EXE: 'Coronel', FAN: 'Coronel', MGA: 'Capitão-de-Mar-e-Guerra' }),
  P('brigadeiro', 16, 'oficial_general', { EXE: 'Brigadeiro', FAN: 'Brigadeiro', MGA: 'Contra-Almirante' }),
  P('tenente_general', 17, 'oficial_general', { EXE: 'Tenente-General', FAN: 'Tenente-General', MGA: 'Vice-Almirante' }),
  P('general', 18, 'oficial_general', { EXE: 'General', FAN: 'General', MGA: 'Almirante' }),
  P('general_exercito', 19, 'oficial_general', { EXE: 'General de Exército', FAN: 'General de Aviação', MGA: 'Almirante da Armada' }),
]
export const POSTOS = Object.fromEntries(GRAUS.map((p) => [p.id, p]))
export const POSTOS_POR_GRAU = Object.fromEntries(GRAUS.map((p) => [p.grau, p]))

const ABREVIATURAS = {
  Soldado: 'Sold.', Grumete: 'Grum.', '2.º Cabo': '2.º Cabo', Marinheiro: 'Mar.', Subsargento: 'Subsarg.', '2.º Sargento': '2.º Sarg.', '1.º Sargento': '1.º Sarg.',
  'Sargento-Ajudante': 'Sarg.-Aj.', 'Sargento-Chefe': 'Sarg.-Ch.', 'Sargento-Maior': 'Sarg.-Mor', Aspirante: 'Asp.', Subtenente: 'Subten.', 'Tenente-de-Corveta': 'Ten.-Cv.',
  Tenente: 'Ten.', 'Tenente-de-Fragata': 'Ten.-Fr.', Capitão: 'Cap.', 'Tenente-de-Navio': 'Ten.-Nav.', Major: 'Maj.', 'Capitão-de-Corveta': 'Cap.-Cv.',
  'Tenente-Coronel': 'Ten.-Cor.', 'Capitão-de-Fragata': 'Cap.-Fr.', Coronel: 'Cor.', 'Capitão-de-Mar-e-Guerra': 'CMG', Brigadeiro: 'Brig.', 'Contra-Almirante': 'C.-Alm.',
  'Tenente-General': 'Ten.-Gen.', 'Vice-Almirante': 'V.-Alm.', General: 'Gen.', Almirante: 'Alm.', 'General de Exército': 'Gen. Ex.', 'General de Aviação': 'Gen. Av.', 'Almirante da Armada': 'Alm. Arm.',
}

export const grupoDoPosto = (postoId) => CATEGORIAS[POSTOS[postoId]?.categoria]?.grupo || null
export const nomeDoPosto = (postoId, ramo = 'EXE') => POSTOS[postoId]?.nomes[ramo] || POSTOS[postoId]?.nomes.EXE || ''
export const abreviaturaDoPosto = (postoId, ramo = 'EXE') => ABREVIATURAS[nomeDoPosto(postoId, ramo)] || nomeDoPosto(postoId, ramo)
export const postoAcima = (postoId, graus = 1) => POSTOS_POR_GRAU[(POSTOS[postoId]?.grau || 0) + graus]?.id || null

// lista para os formulários: [{ id, grau, nome, categoria }] para um ramo, do mais alto ao mais baixo
export const postosDoRamo = (ramo) => [...GRAUS].reverse().map((p) => ({ id: p.id, grau: p.grau, nome: p.nomes[ramo] || p.nomes.EXE, abreviatura: abreviaturaDoPosto(p.id, ramo), categoria: p.categoria, grupo: CATEGORIAS[p.categoria].grupo }))

/*
  Quadros especiais (armas, serviços e classes) e o posto limite de cada um (arts. 84.º a 95.º).
  ramo: "EMG" para os comuns aos três ramos (Estado Maior General). limite = posto mais alto acessível.
*/
const Q = (sigla, nome, limiteOficiais, limiteSargentos) => ({ sigla, nome, limiteOficiais, limiteSargentos })
export const QUADROS_ESPECIAIS = {
  EMG: [
    Q('JM', 'Justiça Militar', 'general', 'sargento_maior'), Q('TEL', 'Telecomunicações', 'tenente_general', 'sargento_maior'),
    Q('ArmTec', 'Armamento e Técnica', 'tenente_general', 'sargento_maior'), Q('SM', 'Saúde Militar', 'tenente_general', 'sargento_maior'),
    Q('NBQ', 'Defesa Contra Armas Nucleares, Bacteriológicas e Químicas', 'brigadeiro', 'sargento_chefe'), Q('GE', 'Guerra Electrónica', 'brigadeiro', 'sargento_chefe'),
    Q('Crp', 'Criptografia', 'brigadeiro', 'sargento_ajudante'), Q('TIC', 'Informática', 'brigadeiro', 'sargento_ajudante'), Q('MUS', 'Músicos', 'coronel', 'primeiro_sargento'),
  ],
  EXE: [
    Q('INF', 'Infantaria', 'general', 'sargento_maior'), Q('TQ', 'Tanques', 'general', 'sargento_maior'), Q('ART', 'Artilharia e Foguetes', 'general', 'sargento_maior'),
    Q('DAA', 'Defesa Antiaérea', 'tenente_general', 'sargento_maior'), Q('LG', 'Logística', 'tenente_general', 'sargento_maior'), Q('ENG', 'Engenharia Militar', 'tenente_general', 'sargento_chefe'),
    Q('AM', 'Administração Militar', 'brigadeiro', null), Q('TPG', 'Topografia Militar', 'coronel', 'sargento_chefe'), Q('MET', 'Meteorologia', 'coronel', 'sargento_chefe'),
    Q('TS', 'Técnicos Superiores', 'coronel', null), Q('SECR', 'Secretariado e Serviços de Apoio', null, 'sargento_ajudante'), Q('ST', 'Serviços Técnicos', null, 'primeiro_sargento'),
  ],
  FAN: [
    Q('AV', 'Aviação', 'general', 'sargento_maior'), Q('DAA', 'Defesa Antiaérea', 'general', 'sargento_maior'), Q('TRT', 'Tropas Radiotécnicas', 'tenente_general', 'sargento_maior'),
    Q('ENGAE', 'Engenharia Aeronáutica', 'tenente_general', null), Q('LG', 'Logística', 'tenente_general', 'sargento_maior'), Q('PQ', 'Paraquedistas', 'brigadeiro', 'sargento_maior'),
    Q('ADMAER', 'Administração Aeronáutica', 'brigadeiro', null), Q('MET', 'Meteorologia', 'coronel', 'sargento_chefe'), Q('TS', 'Técnicos Superiores', 'coronel', null),
    Q('PA', 'Polícia Aérea', null, 'sargento_chefe'), Q('SECR', 'Secretariado e Serviço de Apoio', null, 'sargento_ajudante'), Q('ST', 'Serviços Técnicos', null, 'primeiro_sargento'),
  ],
  MGA: [
    Q('M', 'Marinha', 'general', null), Q('EN', 'Engenheiros Navais', 'tenente_general', null), Q('ACo', 'Artilharia e Foguetes de Costa', 'tenente_general', 'sargento_chefe'),
    Q('AN', 'Administração Naval', 'tenente_general', 'sargento_maior'), Q('FZ', 'Fuzileiros Navais', 'brigadeiro', 'sargento_maior'), Q('MRT', 'Tropas Radiotécnicas', 'brigadeiro', null),
    Q('TS', 'Técnicos Superiores', 'coronel', null), Q('MS', 'Manobra', null, 'sargento_maior'), Q('U', 'Mergulhador', null, 'sargento_maior'),
    Q('TM', 'Torpedo e Minas', null, 'sargento_chefe'), Q('E', 'Electricidade', null, 'sargento_chefe'), Q('R', 'Radar', null, 'sargento_chefe'),
    Q('MQ', 'Máquina Naval', null, 'sargento_chefe'), Q('MIS', 'Mísseis', null, 'sargento_chefe'), Q('MET', 'Meteorologia', null, 'sargento_chefe'), Q('ST', 'Serviços Técnicos', null, null),
    // (na lei, os Mísseis também têm a sigla «M», como a classe Marinha dos oficiais: aqui ficam «MIS»)
  ],
}

// o quadro especial de um militar: { ramo, sigla } → definição (procura no ramo e nos comuns)
export function quadroEspecial(ramo, sigla) {
  if (!sigla) return null
  return QUADROS_ESPECIAIS[ramo]?.find((q) => q.sigla === sigla) || QUADROS_ESPECIAIS.EMG.find((q) => q.sigla === sigla) || null
}
export const quadrosDoRamo = (ramo) => [...(QUADROS_ESPECIAIS[ramo] || []), ...QUADROS_ESPECIAIS.EMG.map((q) => ({ ...q, comum: true }))]
