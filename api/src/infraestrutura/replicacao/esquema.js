import fs from 'node:fs'
import path from 'node:path'
import { RAIZ_API } from '../config.js'

/*
  A estrutura das tabelas, lida do prisma/schema.prisma (o cliente do Prisma 7 já não a traz em tempo de execução):
  para cada modelo, o nome no cliente (delegate), as colunas escalares com o tipo, a chave primária, a coluna de
  actualização (@updatedAt) e as chaves estrangeiras (para não mandar referências a tabelas que ficam só num sistema).
*/
const ESCALARES = new Set(['String', 'Int', 'BigInt', 'Float', 'Decimal', 'Boolean', 'DateTime', 'Json', 'Bytes'])

export function lerEsquema(ficheiro = path.join(RAIZ_API, 'prisma', 'schema.prisma')) {
  const texto = fs.readFileSync(ficheiro, 'utf8')
  const enums = new Set([...texto.matchAll(/^enum\s+(\w+)\s*\{/gm)].map((m) => m[1]))
  const modelos = {}
  for (const m of texto.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)) {
    const [, nome, corpo] = m
    const campos = {}
    const pk = []
    let atualizado = null
    let autoincremento = false
    const estrangeiras = [] // { campos: [...], alvo }
    for (const bruto of corpo.split('\n')) {
      const l = bruto.replace(/\/\/.*$/, '').trim()
      if (!l) continue
      const comp = /^@@id\(\[([^\]]+)\]/.exec(l)
      if (comp) { pk.push(...comp[1].split(',').map((x) => x.trim())); continue }
      if (l.startsWith('@@')) continue
      const c = /^(\w+)\s+(\w+)(\[\])?(\?)?\s*(.*)$/.exec(l)
      if (!c) continue
      const [, campo, tipo, lista, opcional, resto] = c
      const rel = /@relation\([^)]*fields:\s*\[([^\]]+)\]/.exec(resto)
      if (rel) estrangeiras.push({ campos: rel[1].split(',').map((x) => x.trim()), alvo: tipo, opcional: Boolean(opcional) })
      if (!ESCALARES.has(tipo) && !enums.has(tipo)) continue // relação (o objecto ligado): não é coluna
      campos[campo] = { tipo: enums.has(tipo) ? 'String' : tipo, lista: Boolean(lista), opcional: Boolean(opcional), coluna: /@map\("([^"]+)"\)/.exec(resto)?.[1] ?? campo }
      if (/(^|\s)@id\b/.test(resto)) pk.push(campo)
      if (/@updatedAt\b/.test(resto)) atualizado = campo
      if (/@default\(autoincrement\(\)\)/.test(resto)) autoincremento = true
    }
    const tabela = /@@map\("([^"]+)"\)/.exec(corpo)?.[1] ?? nome
    modelos[nome] = { nome, delegate: nome[0].toLowerCase() + nome.slice(1), tabela, campos, pk, atualizado, autoincremento, estrangeiras }
  }
  return modelos
}

// a condição «where» pela chave primária (simples ou composta: { a_b: { a, b } })
export function ondeChave(modelo, chave) {
  if (modelo.pk.length === 1) return { [modelo.pk[0]]: chave[modelo.pk[0]] }
  return { [modelo.pk.join('_')]: Object.fromEntries(modelo.pk.map((k) => [k, chave[k]])) }
}

export const chaveDe = (modelo, linha) => Object.fromEntries(modelo.pk.map((k) => [k, linha[k]]))
