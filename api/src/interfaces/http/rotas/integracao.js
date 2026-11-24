import crypto from 'node:crypto'
import express from 'express'
import { z } from 'zod'

const JANELA_S = 300
const pessoa = z.object({
  ref: z.string().max(40), contaId: z.number().int().positive().optional(), tipo: z.enum(['docente', 'estudante']), nome: z.string().max(150), email: z.string().max(200), ativo: z.boolean(),
  dados: z.record(z.string(), z.string().max(120)).default({}),
  // a fotografia (só quando muda): { id, dados em base64 } ou null para a apagar
  foto: z.union([z.object({ id: z.string().max(80), dados: z.string().max(4_000_000) }), z.null()]).optional(),
})
const corpo = z.object({ pessoas: z.array(pessoa).max(200) })
const assinante = z.object({ cargo: z.string().max(120), nome: z.string().max(150), posto: z.string().max(60), origem: z.string().max(20) })
const corpoAssinaturas = z.object({ assinaturas: z.object({ comandante: assinante, directorEnsino: assinante, chefeRpq: assinante.optional() }) })

/*
  Entrada do Sistema de Gestão de Pessoal (que corre na rede interna e só envia, nunca recebe).
  Cada pedido vem assinado com a chave partilhada: HMAC-SHA256 de "<data>.<corpo>", e a data
  (segundos) tem de estar a menos de 5 minutos da hora do servidor, para não se poder repetir mais tarde.
*/
// quem pergunta é o Sistema de Gestão de Pessoal (pedido assinado): conta como o Comandante, só para contar
const LEITOR = { nome: 'Sistema de Gestão de Pessoal', pode: () => true, exigir: () => {} }
async function pendentesDoComandante(servicos, config) {
  const c = { actor: LEITOR }
  const ensino = servicos.administracaoEscolar.aprovacoes
  const controlo = servicos.controlo.controlo
  const resumo = await controlo.resumoAcademico()
  return {
    painel: config.urlPainel || '',
    site: (await servicos.conteudos.contarParaAprovar(c)) + (await servicos.paginas.contarParaAprovar(c)),
    comentarios: await servicos.interacoes.contarParaAprovar(c),
    avisos: await servicos.administracaoEscolar.avisos.contarParaAprovar(c),
    inqueritos: await servicos.qualidade.inqueritos.contarParaAprovar(c),
    contasPainel: await servicos.utilizadores.contarPorAprovar(c),
    distribuicoes: ensino.aprovacaoComandante ? await ensino.controlo.contarDistribuicoesPendentes() : 0,
    notas: ensino.aprovacaoComandante ? await ensino.controlo.contarPublicacoesPendentes() : 0,
    alteracoesNotas: await controlo.contarPedidos('pendente'),
    homologacoes: resumo.porHomologar.length,
    docentesPorVerificar: await controlo.contarDocentesPorVerificar(),
  }
}

export function rotasIntegracao({ servicos, config }) {
  const r = express.Router()
  // a assinatura do pedido (chave partilhada) e a data a menos de 5 minutos; null = recusado
  const verificar = (req) => {
    const chave = config.chaveIntegracaoPessoal
    const data = String(req.get('x-pessoal-data') || '')
    const assinatura = String(req.get('x-pessoal-assinatura') || '')
    const bruto = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0)
    const esperada = crypto.createHmac('sha256', chave).update(`${data}.`).update(bruto).digest()
    const recebida = /^[0-9a-f]{64}$/.test(assinatura) ? Buffer.from(assinatura, 'hex') : Buffer.alloc(0)
    const atual = /^\d{10}$/.test(data) && Math.abs(Date.now() / 1000 - Number(data)) <= JANELA_S
    return atual && recebida.length === esperada.length && crypto.timingSafeEqual(recebida, esperada) ? bruto : null
  }
  const receber = (esquema, tratar, limite = '30mb') => [express.raw({ type: 'application/json', limit: limite }), async (req, res) => {
    if (!config.chaveIntegracaoPessoal) return res.status(404).json({ erro: 'Endereço não encontrado.', codigo: 'nao_encontrado' })
    const bruto = verificar(req)
    if (!bruto) return res.status(401).json({ erro: 'Assinatura inválida ou fora de prazo.', codigo: 'nao_autenticado' })
    let dados
    try {
      dados = esquema.parse(JSON.parse(bruto.toString('utf8')))
    } catch {
      return res.status(400).json({ erro: 'Pedido mal formado.', codigo: 'validacao' })
    }
    res.json(await tratar({ actor: null, ip: req.ip, agente: 'Sistema de Gestão de Pessoal' }, dados))
  }]
  // ficha de acesso pedida no Pessoal: palavra-passe inicial nova (só vai na resposta, para imprimir)
  r.post('/pessoal/ficha-acesso', ...receber(z.object({ contaId: z.number().int().positive(), pedidoPor: z.string().max(150).default('') }), (ctx, d) => servicos.pessoal.registo.reporSenhaDoPessoal(ctx, d.contaId, d.pedidoPor), '2kb'))
  // estado das contas (número, ativa, último acesso, palavra-passe inicial) para as tabelas do Pessoal
  r.post('/pessoal/estado-contas', ...receber(z.object({ ids: z.array(z.number().int().positive()).max(5000) }), (ctx, d) => servicos.pessoal.registo.estadoContasDoPessoal(ctx, d.ids), '100kb'))
  r.post('/pessoal/contas', ...receber(corpo, (ctx, d) => servicos.pessoal.registo.sincronizarDoPessoal(ctx, d.pessoas)))
  // quem ocupa hoje os cargos que assinam os diplomas e certificados (Comandante, Director de Ensino…)
  // o que espera pelo Comandante no portal e no site (só os números), para a Secretária digital do Pessoal
  r.post('/pessoal/pendentes-comandante', ...receber(z.object({}), () => pendentesDoComandante(servicos, config), '1kb'))
  // a conta do Comandante (a do Pessoal: o mesmo e-mail e a mesma palavra-passe, já cifrada)
  const comandante = z.object({ email: z.string().max(200), nome: z.string().min(2).max(100), nip: z.string().regex(/^[0-9a-f]{64}$/).optional(), senha: z.string().max(300).optional() })
  // os civis da Direcção de Ensino: conta no painel com o BI (só a impressão) e a palavra-passe inicial (já cifrada)
  const contaEnsino = z.object({ ref: z.string().regex(/^pessoal-\d+$/), nome: z.string().min(2).max(100), email: z.string().max(200).optional(), bi: z.string().regex(/^[0-9a-f]{64}$/), papel: z.enum(['secretaria', 'director_ensino', 'gabinete_ensino', 'area_cientifica']).optional(), senha: z.string().regex(/^scrypt\$[0-9a-f]+\$[0-9a-f]+$/) })
  r.post('/pessoal/contas-ensino', ...receber(z.object({ contas: z.array(contaEnsino).max(300) }), (ctx, d) => servicos.utilizadores.receberContasDoEnsino(ctx, d.contas), '200kb'))
  r.post('/pessoal/comandante', ...receber(z.object({ contas: z.array(comandante).max(5) }), (ctx, d) => servicos.utilizadores.receberComandanteDoPessoal(ctx, d.contas), '10kb'))
  r.post('/pessoal/assinaturas', ...receber(corpoAssinaturas, (ctx, d) => servicos.administracaoEscolar.conclusao.receberAssinaturasDoPessoal(ctx, d.assinaturas), '20kb'))
  return r
}
