import { ErroValidacao } from '../dominio/comum/erros.js'
import { COMPONENTES_NOTA, NOMES_COMPONENTES, resultadoDisciplina, texto, validarNota } from '../dominio/academico/regras.js'

/*
  Pauta de uma cadeira (1.ª e 2.ª prova, exame, recurso), partilhada pelo portal (docentes alocados)
  e pelo painel (Repartição de Administração Escolar). Quem chama já confirmou o acesso à cadeira;
  "utilizador" é quem fica no registo de atividades (undefined = o utilizador do painel).
*/
export class ServicoPautas {
  constructor({ academico, auditoria }) {
    Object.assign(this, { academico, auditoria })
  }

  // matriz: estudantes × componentes, com MAC, nota final, situação e classificação
  async pauta(cadeira) {
    const [estudantes, notas] = await Promise.all([
      this.academico.estudantesDaPauta(cadeira.turmaId),
      this.academico.pautaDaCadeira(cadeira.id),
    ])
    return {
      cadeira, publicadas: cadeira.notasPublicadas,
      linhas: estudantes.map((e) => {
        const n = Object.fromEntries(COMPONENTES_NOTA.map((k) => [k, notas[e.id]?.[k] ?? null]))
        return { estudante: e, ...n, observacao: notas[e.id]?.observacao || '', ...resultadoDisciplina(n) }
      }),
    }
  }

  async gravar(ctx, cadeira, linhas, utilizador) {
    const validos = new Set((await this.academico.estudantesDaPauta(cadeira.turmaId)).map((e) => e.id))
    const vistos = new Set()
    const notas = linhas.map((l) => {
      const estudanteId = Number(l.estudanteId)
      if (!validos.has(estudanteId)) throw new ErroValidacao('A pauta tem um estudante que não pertence à turma.')
      if (vistos.has(estudanteId)) throw new ErroValidacao('A pauta tem o mesmo estudante repetido.')
      vistos.add(estudanteId)
      const linha = { estudanteId, observacao: texto(l.observacao, 'observacao', 'Observação', { max: 300, obrigatorio: false }) }
      for (const k of COMPONENTES_NOTA) {
        try {
          linha[k] = validarNota(l[k])
        } catch {
          throw new ErroValidacao(`${NOMES_COMPONENTES[k]}: a nota deve estar entre 0 e 20.`, { campo: k })
        }
      }
      return linha
    })
    await this.academico.gravarPauta(cadeira.id, notas)
    await this.auditoria.registar(ctx, { acao: 'lancar_notas', colecao: 'pautas', alvoId: cadeira.id, alvoTitulo: cadeira.nome, detalhes: { estudantes: notas.length }, utilizador })
    return this.pauta(await this.academico.cadeira(cadeira.id))
  }

  // escolhe que componentes os estudantes já podem ver
  async publicar(ctx, cadeira, componentes, utilizador) {
    const lista = [...new Set(componentes)]
    if (lista.some((k) => !COMPONENTES_NOTA.includes(k))) throw new ErroValidacao('Componente de avaliação desconhecida.')
    const ordenada = COMPONENTES_NOTA.filter((k) => lista.includes(k))
    await this.academico.publicarNotas(cadeira.id, ordenada)
    const novas = ordenada.filter((k) => !cadeira.notasPublicadas.includes(k))
    if (novas.length) {
      await this.auditoria.registar(ctx, { acao: 'publicar_notas', colecao: 'pautas', alvoId: cadeira.id, alvoTitulo: `${novas.map((k) => NOMES_COMPONENTES[k]).join(', ')} — ${cadeira.nome}`, utilizador })
    }
    return this.pauta(await this.academico.cadeira(cadeira.id))
  }
}
