// npm run seed            -> acrescenta o que faltar
// npm run seed -- --forcar -> apaga os conteúdos e volta a carregar os originais (não mexe em utilizadores nem atividades)
import { criarConfig } from '../src/infraestrutura/config.js'
import { criarContentor } from '../src/contentor.js'
import { semear } from './semear.js'

const contentor = criarContentor(criarConfig())
await semear(contentor, { forcar: process.argv.includes('--forcar') })
contentor.fechar()
