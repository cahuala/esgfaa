import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/*
  O sistema de pessoal e a API do portal instalam-se em servidores diferentes, cada um com a sua imagem,
  por isso algumas peças de segurança existem nas duas. Têm de ser iguais: uma correcção feita numa e
  esquecida na outra deixava um dos sistemas vulnerável.
*/
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const COPIAS = [
  ['api-pessoal/src/dominio/seguranca/robo.js', 'api/src/dominio/seguranca/robo.js'],
  ['api-pessoal/src/dominio/totp.js', 'api/src/dominio/identidade/totp.js'],
  ['api-pessoal/src/infraestrutura/cifra.js', 'api/src/infraestrutura/seguranca/cifra.js'],
]

describe('peças de segurança copiadas da API do portal', () => {
  for (const [aqui, la] of COPIAS) {
    it(`${path.basename(aqui)} é igual nos dois sistemas`, { skip: !fs.existsSync(path.join(raiz, la)) && 'sem a API do portal ao lado' }, () => {
      assert.equal(fs.readFileSync(path.join(raiz, aqui), 'utf8'), fs.readFileSync(path.join(raiz, la), 'utf8'), `${aqui} e ${la} são diferentes: copie a correcção para os dois`)
    })
  }
})
