#!/usr/bin/env node
/*
  Instalação: carrega o Quadro Orgânico (unidades e cargos) a partir do organica.json que vem no pendrive.
  Só carrega se a base ainda não tiver unidades (numa actualização não mexe na orgânica que lá está).
    node --env-file=.env scripts/instalar-organica.js <organica.json>
*/
import fs from 'node:fs'
import { criarConfig } from '../src/config.js'
import { criarContentor } from '../src/contentor.js'

const ficheiro = process.argv[2]
if (!ficheiro || !fs.existsSync(ficheiro)) {
  console.log('Sem Quadro Orgânico para carregar (carrega-se depois em Orgânica › Importar).')
  process.exit(0)
}
const contentor = criarContentor(criarConfig())
try {
  if (await contentor.bd.unidade.count()) {
    console.log('A orgânica já existe: fica como está.')
  } else {
    const linhas = JSON.parse(fs.readFileSync(ficheiro, 'utf8'))
    // a instalação age como o administrador do sistema (fica na auditoria como «instalação»)
    const u = { email: 'instalação', nome: 'Instalação', papel: 'administrador', permissoes: ['ver', 'editar', 'propor', 'administrar', 'supervisionar', 'despachar'] }
    const r = await contentor.servicos.organica.importarQuadro(u, { linhas, simular: false })
    console.log(`Quadro Orgânico carregado: ${r.resumo.unidades} unidade(s) e ${r.resumo.cargos} cargo(s).`)
  }
} finally {
  await contentor.fechar()
}
