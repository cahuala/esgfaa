import { ErroValidacao, NaoEncontrado } from '../dominio/comum/erros.js'

// anos entre dois anos letivos ("2025/2026" → "2026/2027" = 1)
export function anosEntre(origem, destino) {
  const a = Number(String(origem || '').slice(0, 4))
  const b = Number(String(destino || '').slice(0, 4))
  return Number.isInteger(a) && Number.isInteger(b) ? b - a : 0
}

const somarAnos = (d, anos) => {
  const x = new Date(d)
  x.setUTCFullYear(x.getUTCFullYear() + anos)
  return x
}

/*
  Cópia de cadeiras para o novo ano letivo. As datas (prazos, questionários, provas) avançam os
  mesmos anos que separam os anos letivos; os ficheiros são duplicados (cada cadeira tem os seus,
  para o acesso continuar a depender da matrícula de cada ano).
*/
export class ServicoCopias {
  constructor({ copias, academico, privados, auditoria }) {
    Object.assign(this, { copias, academico, privados, auditoria })
  }

  async copiar(ctx, origem, destino, { docentes = false } = {}, utilizador) {
    if (origem.id === destino.id) throw new ErroValidacao('Escolha uma cadeira diferente desta.', { campo: 'origemId' })
    const c = await this.copias.conteudoDe(origem.id)
    if (!c.cadeira) throw new NaoEncontrado('Cadeira de origem não encontrada.')
    const anos = anosEntre(origem.turma?.anoLetivo, destino.turma?.anoLetivo)
    // ficheiros: uma cópia nova de cada um
    const ficheiros = {}
    for (const f of c.ficheiros) {
      if (!this.privados) break
      try {
        const novo = this.privados.copiar(f.caminho, f.tipo)
        await this.academico.criarFicheiro({ id: novo.id, caminho: novo.caminho, nome: f.nome, tipo: f.tipo, tamanho: f.tamanho, donoId: f.donoId })
        ficheiros[f.id] = novo.id
      } catch {
        // ficheiro em falta no disco: o material fica sem ficheiro, o resto copia-se
      }
    }
    const resumo = await this.copias.aplicar(destino.id, c, {
      ficheiros,
      docentes,
      data: (d) => somarAnos(d, anos),
      dia: (s) => somarAnos(`${s}T12:00:00Z`, anos).toISOString().slice(0, 10),
    })
    await this.auditoria.registar(ctx, {
      acao: 'copiar_cadeira', colecao: 'cadeiras', alvoId: destino.id,
      alvoTitulo: `${origem.codigo} (${origem.turma?.nome}) → ${destino.codigo} (${destino.turma?.nome})`, detalhes: resumo, utilizador,
    })
    return { ...resumo, anos }
  }
}
