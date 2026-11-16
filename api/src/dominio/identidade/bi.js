import crypto from 'node:crypto'

// o BI angolano: 9 algarismos, 2 letras (a província) e 3 algarismos — ex.: 001234567LA041
export const BI_ANGOLANO = /^[0-9]{9}[A-Z]{2}[0-9]{3}$/

/*
  A impressão do BI (HMAC-SHA256 com a chave partilhada com o Sistema de Gestão de Pessoal): é com ela que o painel
  reconhece quem entra com o BI, sem o BI estar guardado. O Pessoal calcula-a da mesma forma.
*/
export const impressaoBi = (chave, bi) => crypto.createHmac('sha256', String(chave)).update(`bi:${String(bi).trim().toUpperCase()}`).digest('hex')
