import { ErroValidacao } from '../../../dominio/comum/erros.js'

const semHtml = (h) => String(h || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()

// excerto à volta da primeira ocorrência do termo
export function excerto(texto, q, raio = 70) {
  const t = semHtml(texto)
  const i = t.toLowerCase().indexOf(q.toLowerCase())
  if (i < 0) return t.slice(0, raio * 2) + (t.length > raio * 2 ? '…' : '')
  const ini = Math.max(0, i - raio)
  return `${ini > 0 ? '…' : ''}${t.slice(ini, i + q.length + raio)}${i + q.length + raio < t.length ? '…' : ''}`
}

/*
  Pesquisa global do portal: cadeiras, materiais, trabalhos, questionários, fórum, glossário, wiki e avisos
  das cadeiras de quem pesquisa. O estudante só encontra o que pode ver.
*/
export class ServicoPesquisa {
  constructor({ pesquisa, acesso, disponibilidade }) {
    Object.assign(this, { pesquisa, acesso, disponibilidade })
  }

  async pesquisar(ctx, { q }) {
    const termo = String(q || '').trim().slice(0, 100)
    if (termo.length < 2) throw new ErroValidacao('Escreva pelo menos 2 letras.', { campo: 'q' })
    const cadeiras = await this.acesso.minhasCadeiras(ctx.conta)
    const porId = Object.fromEntries(cadeiras.map((c) => [c.id, { id: c.id, codigo: c.codigo, nome: c.nome }]))
    const r = await this.pesquisa.pesquisar(cadeiras.map((c) => c.id), termo)
    let ve = () => true
    if (ctx.conta.tipo === 'estudante') {
      const ids = [...new Set([...r.materiais, ...r.trabalhos, ...r.questionarios].map((a) => a.cadeiraId))]
      const acessos = Object.assign({}, ...(await Promise.all(ids.map((id) => this.disponibilidade.acessos(id, ctx.conta.id)))).map((a) => a.acessos))
      ve = (tipo, a) => acessos[`${tipo}-${a.id}`] && !acessos[`${tipo}-${a.id}`].escondida
    }
    const item = (tipo, a, titulo, texto, ligacao) => ({ tipo, id: a.id, titulo, excerto: excerto(texto, termo), cadeira: porId[a.cadeiraId ?? a.id], ligacao })
    const ate = (l) => l.slice(0, 8)
    const resultados = [
      ...r.cadeiras.map((c) => item('cadeira', c, `${c.codigo} · ${c.nome}`, c.descricao, `/cadeiras/${c.id}`)),
      ...ate(r.materiais.filter((m) => ve('material', m))).map((m) => item('material', m, m.titulo, m.descricao || m.conteudo, `/cadeiras/${m.cadeiraId}?atividade=material-${m.id}`)), // todos os materiais abrem na sala de aula
      ...ate(r.trabalhos.filter((t) => ve('trabalho', t))).map((t) => item('trabalho', t, t.titulo, t.enunciado, `/cadeiras/${t.cadeiraId}?atividade=trabalho-${t.id}`)),
      ...ate(r.questionarios.filter((x) => ve('questionario', x))).map((x) => item('questionario', x, x.titulo, x.descricao, `/cadeiras/${x.cadeiraId}?atividade=questionario-${x.id}`)),
      ...r.topicos.map((x) => item('forum', x, x.titulo, x.texto, `/cadeiras/${x.cadeiraId}?separador=forum&topico=${x.id}`)),
      ...r.termos.map((x) => item('glossario', x, x.termo, x.definicao, `/cadeiras/${x.cadeiraId}?separador=glossario`)),
      ...r.paginas.map((x) => item('wiki', x, x.titulo, '', `/cadeiras/${x.cadeiraId}?separador=wiki`)),
      ...r.avisos.map((x) => item('aviso', x, x.titulo, x.texto, `/cadeiras/${x.cadeiraId}?separador=avisos`)),
    ]
    return { q: termo, total: resultados.length, resultados }
  }
}
