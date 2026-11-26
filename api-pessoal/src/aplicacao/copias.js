import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { conflito, invalido, naoEncontrado } from '../erros.js'
import { exigir } from './sessao.js'

/*
  Cópias de segurança (Configurações › Cópias de segurança): além da cópia automática de todos os dias (o serviço
  ESG-Pessoal-Copias), o administrador faz uma cópia quando quiser — por exemplo antes de uma grande alteração ou
  para a levar num disco externo. É o mesmo programa das cópias diárias (scripts/copias.mjs): a base de dados e os
  ficheiros (fotografias, documentos digitalizados), cifrados com a COPIAS_CHAVE — sem ela a cópia não abre.
  Descarregar uma cópia leva o ficheiro cifrado (.esgc), para guardar fora do servidor.
*/
const NOME = /^[\w.-]+\.esgc$/

export class ServicoCopias {
  constructor({ raiz, auditoria, env = process.env, script }) {
    // instalado (Windows): sistema\scripts\copias.mjs; no repositório: scripts/copias.mjs na raiz
    this.script = script ?? [path.join(raiz, 'scripts', 'copias.mjs'), path.join(raiz, '..', 'scripts', 'copias.mjs')].find((f) => fs.existsSync(f))
    this.pasta = path.resolve(env.COPIAS_DIR || path.join(raiz, 'copias'))
    // o PostgreSQL da instalação (pg_dump): C:\ESG-Pessoal\postgresql\bin, ao lado de sistema\
    this.pgBin = [path.join(raiz, '..', 'postgresql', 'bin')].find((p) => fs.existsSync(p)) ?? ''
    Object.assign(this, { auditoria, env, aCopiar: null })
  }

  async listar(u) {
    exigir(u, 'administrar')
    const ficheiros = fs.existsSync(this.pasta)
      ? fs.readdirSync(this.pasta).filter((f) => NOME.test(f)).map((f) => { const s = fs.statSync(path.join(this.pasta, f)); return { nome: f, tamanho: s.size, quando: s.mtime.toISOString() } }).sort((a, b) => b.quando.localeCompare(a.quando))
      : []
    let estado = null
    try { estado = JSON.parse(fs.readFileSync(path.join(this.pasta, 'estado.json'), 'utf8')) } catch { /* ainda sem cópia automática */ }
    return { pasta: this.pasta, disponivel: Boolean(this.script && this.env.COPIAS_CHAVE), aCopiar: Boolean(this.aCopiar), ultimaAutomatica: estado, copias: ficheiros }
  }

  // faz a cópia agora (uma de cada vez) e devolve a lista actualizada
  async fazer(u) {
    exigir(u, 'administrar')
    if (!this.script) throw conflito('O programa das cópias (scripts/copias.mjs) não está instalado neste servidor.')
    if (!this.env.COPIAS_CHAVE) throw conflito('Falta a COPIAS_CHAVE na configuração do servidor: sem ela não se fazem cópias.')
    if (this.aCopiar) throw conflito('Já está a fazer uma cópia: espere que termine.')
    this.aCopiar = this.#correr()
    try {
      const saida = await this.aCopiar
      await this.auditoria.registar(u, 'copia_seguranca', 'cópia manual', { saida: saida.slice(-300) })
    } finally {
      this.aCopiar = null
    }
    return this.listar(u)
  }

  #correr() {
    return new Promise((resolve, reject) => {
      const env = { ...this.env, ...(this.pgBin ? { PATH: `${this.pgBin}${path.delimiter}${this.env.PATH ?? ''}` } : {}) }
      const p = spawn(process.execPath, [this.script, 'copiar', '--sistema', 'pessoal'], { env, cwd: path.dirname(path.dirname(this.script)), windowsHide: true })
      let saida = ''
      p.stdout.on('data', (d) => { saida += d })
      p.stderr.on('data', (d) => { saida += d })
      const limite = setTimeout(() => p.kill(), 30 * 60_000)
      p.on('error', (e) => { clearTimeout(limite); reject(conflito(`Não foi possível fazer a cópia: ${e.message}`)) })
      p.on('close', (codigo) => {
        clearTimeout(limite)
        if (codigo === 0) resolve(saida)
        else reject(conflito(`A cópia falhou: ${(saida.trim().split('\n').pop() || `código ${codigo}`).replace(/^Erro:\s*/, '')}`))
      })
    })
  }

  // o ficheiro cifrado, para descarregar (e guardar num disco externo)
  async ficheiro(u, nome) {
    exigir(u, 'administrar')
    if (!NOME.test(String(nome))) throw invalido('Nome de cópia inválido.')
    const f = path.join(this.pasta, nome)
    if (!fs.existsSync(f)) throw naoEncontrado('Essa cópia já não existe.')
    await this.auditoria.registar(u, 'descarregar_copia', nome)
    return f
  }
}
