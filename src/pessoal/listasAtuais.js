// as listas do sistema em uso (Administração › Listas do sistema), para os documentos que se fazem no navegador
// (fichas, declarações…), que não recebem a sessão. Preenche-se ao carregar as referências.
export const listasAtuais = {}
export function definirListas(ref) {
  for (const k of Object.keys(listasAtuais)) delete listasAtuais[k]
  if (ref) Object.assign(listasAtuais, ref)
}
