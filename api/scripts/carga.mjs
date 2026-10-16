/*
  Teste de carga (acessos simultâneos): monta uma Escola de teste numa base temporária (uma turma com
  N estudantes, uma cadeira com materiais, trabalhos e avisos) e mede quantos pedidos por segundo a API
  aguenta, com que tempos de resposta e se há erros. Depois confirma que, com os limites ligados,
  uma inundação de pedidos de um só endereço é travada (429).
    npm run carga                 (100 estudantes, 20 s por cenário)
    ESTUDANTES=300 SEGUNDOS=30 npm run carga
  Precisa do PostgreSQL de testes (docker compose up -d). Não toca na base de dados real.
*/
import autocannon from 'autocannon'
import { criarAmbiente } from '../tests/apoio/ambiente.js'

const N = Number(process.env.ESTUDANTES || 100)
const SEGUNDOS = Number(process.env.SEGUNDOS || 20)
const SENHA = 'Portal2026segura'
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n')
const sem = { janelaMs: 60_000, maximo: 1e9 }

async function montarEscola(amb) {
  const admin = await amb.entrar()
  await amb.com(admin).post('/api/admin/colecoes/cursos').send({ nome: 'Curso de Estado-Maior' })
  const s = await amb.criarUtilizador('administrador')
  const sec = () => amb.com(s.token)
  const turma = (await sec().post('/api/admin/academico/turmas').send({ curso: 'curso-de-estado-maior', anoLetivo: '2026/2027', nome: 'CEM Carga' })).body
  const prof = (await sec().post('/api/admin/academico/contas').send({ tipo: 'docente', nome: 'Docente Carga', email: 'prof.carga@esgfaa.gov.ao' })).body
  const cadeira = (await sec().post(`/api/admin/academico/turmas/${turma.id}/cadeiras`).send({ codigo: 'EST101', nome: 'Estratégia' })).body
  await sec().put(`/api/admin/academico/cadeiras/${cadeira.id}/docentes`).send({ docentes: [{ docenteId: prof.id, papel: 'regente' }] })
  const entrarPortal = async (email) => {
    const r = await amb.http().post('/api/portal/entrar').send({ email, senha: email })
    return (await amb.com(r.body.token).put('/api/portal/eu/senha').send({ atual: email, nova: SENHA })).body.token
  }
  const tProf = await entrarPortal('prof.carga@esgfaa.gov.ao')
  const P = amb.com(tProf)
  for (let i = 1; i <= 6; i++) await P.post(`/api/portal/cadeiras/${cadeira.id}/materiais`).send({ tipo: 'pagina', titulo: `Página ${i}`, conteudo: `<p>${'Texto da aula. '.repeat(40)}</p>` })
  const trabalho = (await P.post(`/api/portal/cadeiras/${cadeira.id}/trabalhos`).send({ titulo: 'Ensaio', prazo: '2030-11-20T23:59:00Z' })).body
  for (let i = 1; i <= 5; i++) await P.post(`/api/portal/cadeiras/${cadeira.id}/avisos`).send({ titulo: `Aviso ${i}`, texto: 'Texto do aviso para a turma.' })
  const tokens = []
  const emails = []
  for (let i = 1; i <= N; i++) {
    const email = `estudante${i}.carga@esgfaa.gov.ao`
    await amb.registarEMatricular(sec(), turma.id, { nome: `Estudante ${i} Carga`, email })
    tokens.push(await entrarPortal(email))
    emails.push(email)
    if (i % 25 === 0) process.stdout.write(`  ${i}/${N} estudantes\n`)
  }
  // metade da turma já entregou
  for (const t of tokens.slice(0, Math.floor(N / 2))) await amb.com(t).post(`/api/portal/trabalhos/${trabalho.id}/entrega`).attach('ficheiro', PDF, { filename: 'e.pdf', contentType: 'application/pdf' })
  return { cadeira, trabalho, tokens, emails, tProf }
}

function correr(titulo, url, opcoes) {
  return new Promise((resolve) => {
    autocannon({ url, duration: SEGUNDOS, ...opcoes }, (erro, r) => {
      if (erro) throw erro
      const n2xx = r['2xx']
      const total = r.requests.total
      resolve({
        cenario: titulo, ligacoes: opcoes.connections, 'pedidos/s': Math.round(r.requests.average), total,
        'média (ms)': Math.round(r.latency.average), 'p99 (ms)': r.latency.p99, 'máx (ms)': r.latency.max,
        'sem êxito': total - n2xx + r.errors + r.timeouts,
      })
    })
  })
}

// cada ligação usa a sessão de um estudante diferente
const rodar = (tokens, caminho, metodo = 'GET', corpo) => {
  let i = 0
  return [{ method: metodo, path: caminho, ...(corpo ? { body: JSON.stringify(corpo), headers: { 'content-type': 'application/json' } } : {}), setupRequest: (req) => ({ ...req, headers: { ...req.headers, authorization: `Bearer ${tokens[i++ % tokens.length]}` } }) }]
}

console.log(`\nA montar a Escola de teste (${N} estudantes)…`)
const amb = await criarAmbiente({ limites: Object.fromEntries(['publico', 'portal', 'admin', 'entrarPortal', 'entrarPortalIp', 'entrar', 'entrarIp', 'visita', 'gosto', 'comentario', 'contacto', 'impressao', 'clique', 'mensagens'].map((k) => [k, sem])), env: { DB_POOL: process.env.DB_POOL || '20' } })
const e = await montarEscola(amb)
const servidor = amb.app.listen(0)
const base = `http://127.0.0.1:${servidor.address().port}`
console.log(`Pronto. ${SEGUNDOS} s por cenário.\n`)

const resultados = []
// 120 ligações: o macOS só deixa 128 ligações em espera (kern.ipc.somaxconn); num servidor Linux são 4096
resultados.push(await correr('Site: página inicial (conteúdos)', `${base}/api/publico/conteudo`, { connections: 120 }))
resultados.push(await correr('Portal: estudantes a abrir a cadeira', base, { connections: Math.min(N, 200), requests: rodar(e.tokens, `/api/portal/cadeiras/${e.cadeira.id}`) }))
resultados.push(await correr('Portal: página de entrada (a minha turma)', base, { connections: Math.min(N, 200), requests: rodar(e.tokens, '/api/portal/inicio') }))
resultados.push(await correr('Portal: notificações', base, { connections: Math.min(N, 200), requests: rodar(e.tokens, '/api/portal/notificacoes') }))
resultados.push(await correr('Docente: lista de entregas', base, { connections: 20, requests: rodar([e.tProf], `/api/portal/trabalhos/${e.trabalho.id}/entregas`) }))
let k = 0
resultados.push(await correr('Entrar no portal (palavra-passe)', base, {
  connections: 50, requests: [{ method: 'POST', path: '/api/portal/entrar', headers: { 'content-type': 'application/json' }, setupRequest: (req) => ({ ...req, body: JSON.stringify({ email: e.emails[k++ % e.emails.length], senha: SENHA }) }) }],
}))
console.table(resultados)
// espera que os últimos pedidos (e o que eles deixaram a correr em segundo plano) terminem antes de apagar a base de teste
const parar = async (srv) => { srv.closeAllConnections(); await new Promise((r) => srv.close(r)); await new Promise((r) => setTimeout(r, 3000)) }
await parar(servidor)
const erros = amb.erros.length
await amb.fechar()

// limites ligados (como em produção): um só endereço a inundar o site é travado
const prod = await criarAmbiente({ limites: { publico: { janelaMs: 60_000, maximo: 300 } } })
const s2 = prod.app.listen(0)
const inundacao = await new Promise((resolve) => autocannon({ url: `http://127.0.0.1:${s2.address().port}/api/publico/conteudo`, connections: 50, amount: 2000 }, (x, r) => resolve(r)))
console.log(`\nInundação de 2000 pedidos de um só endereço (limite 300 por minuto): ${inundacao['2xx']} servidos, ${inundacao.non2xx} travados com 429.`)
console.log(`Erros internos do servidor durante a carga: ${erros}\n`)
await parar(s2)
await prod.fechar()
