/*
  De onde vêm os estudantes e os docentes que não são da Escola: os órgãos das FAA, a Polícia Nacional e as forças
  de outros países, cada uma com os seus postos (como se escrevem lá). «equivale» é o posto das FAA da mesma
  categoria (para ordenar e comparar), não uma conversão oficial.
*/

// Polícia Nacional de Angola — Decreto n.º 117/08 (Regulamento de Carreiras) e Lei n.º 10/22, de 3 de Maio
// (Lei dos Postos e Distintivos), do mais alto ao mais baixo
export const POLICIA_NACIONAL = 'Polícia Nacional'
export const POSTOS_POLICIA = [
  { nome: 'Comissário Geral', classe: 'Oficiais Comissários', equivale: 'general' },
  { nome: 'Comissário-Chefe', classe: 'Oficiais Comissários', equivale: 'tenente_general' },
  { nome: 'Comissário', classe: 'Oficiais Comissários', equivale: 'brigadeiro' },
  { nome: 'Subcomissário', classe: 'Oficiais Comissários', equivale: 'brigadeiro' },
  { nome: 'Superintendente-Chefe', classe: 'Oficiais Superiores', equivale: 'coronel' },
  { nome: 'Superintendente', classe: 'Oficiais Superiores', equivale: 'tenente_coronel' },
  { nome: 'Intendente', classe: 'Oficiais Superiores', equivale: 'major' },
  { nome: 'Inspector-Chefe', classe: 'Oficiais Subalternos', equivale: 'capitao' },
  { nome: 'Inspector', classe: 'Oficiais Subalternos', equivale: 'tenente' },
  { nome: 'Subinspector', classe: 'Oficiais Subalternos', equivale: 'subtenente' },
  { nome: '1.º Subchefe', classe: 'Subchefes', equivale: 'sargento_chefe' },
  { nome: '2.º Subchefe', classe: 'Subchefes', equivale: 'primeiro_sargento' },
  { nome: '3.º Subchefe', classe: 'Subchefes', equivale: 'segundo_sargento' },
  { nome: 'Agente de 1.ª Classe', classe: 'Agentes', equivale: 'primeiro_cabo' },
  { nome: 'Agente de 2.ª Classe', classe: 'Agentes', equivale: 'segundo_cabo' },
  { nome: 'Agente de 3.ª Classe', classe: 'Agentes', equivale: 'soldado' },
]

/*
  Os órgãos de onde vêm os militares das FAA (fora da ESG): o Estado-Maior General, os três ramos, o Ministério da
  Defesa e as unidades da Presidência. «nomes»: como aparecem nas listas (siglas e grafias antigas).
*/
export const ORGAOS_FAA = [
  { nome: 'Estado-Maior General das FAA', sigla: 'EMG', nomes: ['estado maior general', 'estado-maior general', 'emg', 'emgfaa'] },
  { nome: 'Exército', sigla: 'EXE', ramo: 'EXE', nomes: ['exercito', 'exército'] },
  { nome: 'Força Aérea Nacional', sigla: 'FAN', ramo: 'FAN', nomes: ['forca aerea nacional', 'forcas aerea nacional', 'fan'] },
  { nome: 'Marinha de Guerra Angolana', sigla: 'MGA', ramo: 'MGA', nomes: ['marinha de guerra angolana', 'marinha', 'mga'] },
  { nome: 'Ministério da Defesa Nacional e dos Veteranos da Pátria', sigla: 'MINDENVP', nomes: ['ministerio da defesa nacional', 'mindenvp', 'mindenacvp', 'minden'] },
  { nome: 'Casa Militar do Presidente da República', sigla: 'CMPR', nomes: ['casa militar/pr', 'casa militar', 'casa militar do presidente da republica'] },
  { nome: 'Casa de Segurança do Presidente da República', sigla: 'CSPR', nomes: ['casa de seguranca presidencial', 'casa de seguranca do presidente da republica', 'casa de seguranca'] },
  { nome: 'Unidade de Segurança Presidencial', sigla: 'USP', nomes: ['usp', 'unidade de seguranca presidencial'] },
  { nome: 'Unidade da Guarda Presidencial', sigla: 'UGP', nomes: ['ugp', 'unidade da guarda presidencial', 'unidade de guarda presidencial'] },
  { nome: 'Unidade de Defesa Presidencial', sigla: 'UDP', nomes: ['udp', 'unidade de defesa presidencial'] },
  { nome: 'Serviço de Inteligência e Segurança Militar', sigla: 'SISM', nomes: ['sism', 'servico de inteligencia seguranca militar', 'servico de inteligencia e seguranca militar'] },
]

const P = (nome, equivale) => ({ nome, equivale })
/*
  Outros países (os que já mandaram estudantes à ESG): as forças armadas e a polícia de cada um, com os postos dos
  oficiais como se escrevem lá. Fontes: as tabelas de postos de cada país (Wikipédia: «Military ranks of …»;
  Zambia Police Service); nas FADM, o Brigadeiro e o Comodoro vêm das promoções publicadas pelo Governo de Moçambique. Uma força sem postos (null) escreve-se à mão, como vem na lista.
*/
export const PAISES = {
  'Moçambique': {
    nacionalidade: 'Moçambicana',
    forcas: [
      { nome: 'Forças Armadas de Defesa de Moçambique — Exército', postos: [P('Coronel-General', 'general'), P('Tenente-General', 'tenente_general'), P('Major-General', 'tenente_general'), P('Brigadeiro', 'brigadeiro'), P('Coronel', 'coronel'), P('Tenente-Coronel', 'tenente_coronel'), P('Major', 'major'), P('Capitão', 'capitao'), P('Tenente', 'tenente'), P('Alferes', 'subtenente')] },
      { nome: 'Forças Armadas de Defesa de Moçambique — Força Aérea', postos: [P('Coronel-General', 'general'), P('Tenente-General', 'tenente_general'), P('Major-General', 'tenente_general'), P('Brigadeiro', 'brigadeiro'), P('Coronel', 'coronel'), P('Tenente-Coronel', 'tenente_coronel'), P('Major', 'major'), P('Capitão', 'capitao'), P('Tenente', 'tenente'), P('Alferes', 'subtenente')] },
      { nome: 'Forças Armadas de Defesa de Moçambique — Marinha', naval: true, postos: [P('Almirante', 'general'), P('Vice-Almirante', 'tenente_general'), P('Contra-Almirante', 'tenente_general'), P('Comodoro', 'brigadeiro'), P('Capitão de Mar e Guerra', 'coronel'), P('Capitão de Fragata', 'tenente_coronel'), P('Capitão-Tenente', 'major'), P('Primeiro-Tenente', 'capitao'), P('Segundo-Tenente', 'tenente'), P('Guarda-Marinha', 'subtenente')] },
      { nome: 'Polícia da República de Moçambique', policia: true, postos: null },
    ],
  },
  'Zâmbia': {
    nacionalidade: 'Zambiana',
    forcas: [
      { nome: 'Zambian Army', postos: [P('General', 'general'), P('Lieutenant General', 'tenente_general'), P('Major General', 'tenente_general'), P('Brigadier', 'brigadeiro'), P('Colonel', 'coronel'), P('Lieutenant Colonel', 'tenente_coronel'), P('Major', 'major'), P('Captain', 'capitao'), P('Lieutenant', 'tenente'), P('Second Lieutenant', 'subtenente')] },
      { nome: 'Zambian Air Force', postos: [P('General', 'general'), P('Lieutenant General', 'tenente_general'), P('Major General', 'tenente_general'), P('Brigadier', 'brigadeiro'), P('Colonel', 'coronel'), P('Lieutenant Colonel', 'tenente_coronel'), P('Major', 'major'), P('Captain', 'capitao'), P('Lieutenant', 'tenente'), P('Second Lieutenant', 'subtenente')] },
      { nome: 'Zambia Police Service', policia: true, postos: [P('Inspector General', 'general'), P('Deputy Inspector General', 'tenente_general'), P('Commissioner', 'brigadeiro'), P('Deputy Commissioner', 'brigadeiro'), P('Senior Assistant Commissioner', 'coronel'), P('Assistant Commissioner', 'coronel'), P('Senior Superintendent', 'tenente_coronel'), P('Superintendent', 'major'), P('Assistant Superintendent', 'capitao'), P('Chief Inspector', 'tenente'), P('Inspector', 'subtenente'), P('Sergeant', 'primeiro_sargento'), P('Constable', 'soldado')] },
    ],
  },
  'República do Congo': {
    nacionalidade: 'Congolesa',
    forcas: [
      { nome: 'Forces armées congolaises — Armée de terre', postos: [P("Général d'armée", 'general'), P('Général de corps d’armée', 'tenente_general'), P('Général de division', 'tenente_general'), P('Général de brigade', 'brigadeiro'), P('Colonel', 'coronel'), P('Lieutenant-colonel', 'tenente_coronel'), P('Commandant', 'major'), P('Capitaine', 'capitao'), P('Lieutenant', 'tenente'), P('Sous-lieutenant', 'subtenente')] },
      { nome: "Forces armées congolaises — Armée de l'air", postos: [P("Général d'armée", 'general'), P('Général de corps d’armée', 'tenente_general'), P('Général de division', 'tenente_general'), P('Général de brigade', 'brigadeiro'), P('Colonel', 'coronel'), P('Lieutenant-colonel', 'tenente_coronel'), P('Commandant', 'major'), P('Capitaine', 'capitao'), P('Lieutenant', 'tenente'), P('Sous-lieutenant', 'subtenente')] },
      { nome: 'Forces armées congolaises — Marine nationale', naval: true, postos: [P('Amiral', 'general'), P("Vice-amiral d'escadre", 'tenente_general'), P('Vice-amiral', 'tenente_general'), P('Contre-amiral', 'brigadeiro'), P('Capitaine de vaisseau', 'coronel'), P('Capitaine de frégate', 'tenente_coronel'), P('Capitaine de corvette', 'major'), P('Lieutenant de vaisseau', 'capitao'), P('Enseigne de vaisseau de 1re classe', 'tenente'), P('Enseigne de vaisseau de 2e classe', 'subtenente')] },
      { nome: 'Gendarmerie nationale', postos: [P("Général d'armée", 'general'), P('Général de division', 'tenente_general'), P('Général de brigade', 'brigadeiro'), P('Colonel', 'coronel'), P('Lieutenant-colonel', 'tenente_coronel'), P('Commandant', 'major'), P('Capitaine', 'capitao'), P('Lieutenant', 'tenente'), P('Sous-lieutenant', 'subtenente')] },
      { nome: 'Police nationale congolaise', policia: true, postos: null },
    ],
  },
  'Cabo Verde': {
    nacionalidade: 'Cabo-verdiana',
    forcas: [
      { nome: 'Forças Armadas de Cabo Verde — Guarda Nacional', postos: [P('Major-General', 'tenente_general'), P('Brigadeiro-General', 'brigadeiro'), P('Coronel', 'coronel'), P('Tenente-Coronel', 'tenente_coronel'), P('Major', 'major'), P('Capitão', 'capitao'), P('Primeiro-Tenente', 'tenente'), P('Tenente', 'tenente'), P('Subtenente', 'subtenente')] },
      { nome: 'Forças Armadas de Cabo Verde — Guarda Costeira', naval: true, postos: [P('Contra-Almirante', 'brigadeiro'), P('Comodoro', 'brigadeiro'), P('Capitão-de-Mar', 'coronel'), P('Capitão-de-Navio', 'tenente_coronel'), P('Capitão-de-Patrulha', 'major'), P('Capitão-Tenente', 'capitao'), P('Primeiro-Tenente', 'tenente'), P('Tenente', 'tenente'), P('Guarda-Marinha', 'subtenente')] },
      { nome: 'Polícia Nacional de Cabo Verde', policia: true, postos: null },
    ],
  },
  'São Tomé e Príncipe': {
    nacionalidade: 'São-tomense',
    forcas: [
      { nome: 'Forças Armadas de São Tomé e Príncipe — Exército', postos: [P('Brigadeiro', 'brigadeiro'), P('Coronel', 'coronel'), P('Tenente-Coronel', 'tenente_coronel'), P('Major', 'major'), P('Capitão', 'capitao'), P('Tenente', 'tenente'), P('Alferes', 'subtenente')] },
      { nome: 'Forças Armadas de São Tomé e Príncipe — Guarda Costeira', naval: true, postos: null },
      { nome: 'Polícia Nacional de São Tomé e Príncipe', policia: true, postos: null },
    ],
  },
}

const simples = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

// o órgão das FAA pelo nome que vem na lista (sigla ou grafia antiga); null se não é um dos conhecidos
export const orgaoFaa = (texto) => ORGAOS_FAA.find((o) => o.nomes.includes(simples(texto)) || simples(o.nome) === simples(texto)) ?? null
export const forcaDe = (pais, nome) => PAISES[pais]?.forcas.find((f) => simples(f.nome) === simples(nome)) ?? null
export const forcaPorNome = (nome) => Object.entries(PAISES).flatMap(([pais, x]) => x.forcas.map((f) => ({ pais, ...f }))).find((f) => simples(f.nome) === simples(nome)) ?? null

/*
  O posto de fora das FAA tem de ser um dos dessa força (a Polícia Nacional, ou a força estrangeira com a tabela de
  postos); nas forças sem tabela escreve-se à mão. Devolve a mensagem do problema ou null.
*/
export function problemaPostoExterno({ unidadeOrigem, postoExterno }) {
  if (!postoExterno) return null
  const lista = simples(unidadeOrigem) === simples(POLICIA_NACIONAL) ? POSTOS_POLICIA : forcaPorNome(unidadeOrigem)?.postos
  if (!lista) return null
  return lista.some((p) => simples(p.nome) === simples(postoExterno)) ? null : `O posto «${postoExterno}» não existe em ${unidadeOrigem}.`
}
