import crypto from 'node:crypto'

// o BI angolano: 9 algarismos, 2 letras (a província) e 3 algarismos — ex.: 001234567LA041
export const BI_ANGOLANO = /^[0-9]{9}[A-Z]{2}[0-9]{3}$/

/*
  A impressão do BI (HMAC-SHA256 com a chave partilhada com o Sistema de Gestão de Pessoal): é com ela que o painel
  reconhece quem entra com o BI, sem o BI estar guardado. O Pessoal calcula-a da mesma forma.
*/
export const impressaoBi = (chave, bi) => crypto.createHmac('sha256', String(chave)).update(`bi:${String(bi).trim().toUpperCase()}`).digest('hex')

// o NIP dos militares (só algarismos): os chefes militares da Direcção de Ensino entram no painel com ele. A impressão
// fica na mesma coluna que a do BI (o prefixo «nip:» não deixa confundir as duas)
export const NIP = /^[0-9]{5,12}$/
export const impressaoNip = (chave, nip) => crypto.createHmac('sha256', String(chave)).update(`nip:${String(nip).trim().toUpperCase()}`).digest('hex')
