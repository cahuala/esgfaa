// npm run seed            -> acrescenta o que faltar
// npm run seed -- --forcar -> apaga os conteúdos e volta a carregar os originais (não mexe em utilizadores nem atividades)
import { semear } from './semear.js'

await semear({ forcar: process.argv.includes('--forcar') })
