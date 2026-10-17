import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'

export const RAIZ_API = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const SEGREDO_DESENVOLVIMENTO = 'desenvolvimento-apenas-nao-usar-em-producao'
// PostgreSQL do docker-compose.yml (só para desenvolvimento)
export const URL_DESENVOLVIMENTO = 'postgresql://esgfaa:esgfaa_dev@localhost:5434/esgfaa'

const lista = (padrao) => z.string().default(padrao).transform((s) => s.split(',').map((o) => o.trim().replace(/\/$/, '')).filter(Boolean))
const inteiro = (padrao, min, max) => z.coerce.number().int().min(min).max(max).default(padrao)

const ESQUEMA = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: inteiro(3001, 1, 65535),
  DATA_DIR: z.string().default('dados'),
  DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//, 'DATABASE_URL deve ser postgresql://…').optional(),
  // e-mails das contas do portal académico (vazio = qualquer domínio)
  EMAIL_DOMINIO_ESCOLA: z.string().regex(/^$|^[a-z0-9.-]+\.[a-z]{2,}$/i, 'EMAIL_DOMINIO_ESCOLA deve ser um domínio (ex.: esgfaa.gov.ao)').default('esgfaa.gov.ao'),
  FUSO_HORARIO: z.string().regex(/^[A-Za-z_]+\/[A-Za-z_]+$|^UTC$/).default('Africa/Luanda'),
  PUBLIC_URL: z.union([z.literal(''), z.url()]).default(''),
  CORS_ORIGINS: lista('http://localhost:5173,http://localhost:4173,https://cahuala.github.io'),
  JWT_SECRET: z.string().default(''),
  SESSION_TTL: z.string().regex(/^\d+[smhd]$/, 'SESSION_TTL deve ser como 8h, 30m ou 1d').default('8h'),
  MAX_UPLOAD_MB: inteiro(80, 1, 1024),
  // ligações simultâneas à base de dados (suba com o número de pessoas ao mesmo tempo e o que o PostgreSQL aguentar)
  DB_POOL: inteiro(10, 2, 200),
  TRUST_PROXY: z.string().default(''),
  ADMIN_NAME: z.string().default('Administrador'),
  ADMIN_EMAIL: z.string().default('admin@esgfaa.gov.ao'),
  ADMIN_PASSWORD: z.string().default(''),
  LOG: z.enum(['json', 'nenhum']).optional(),
  SMTP_URL: z.union([z.literal(''), z.string().regex(/^smtps?:\/\//, 'SMTP_URL deve ser smtp://… ou smtps://…')]).default(''),
  EMAIL_REMETENTE: z.string().default('Portal Académico ESG <portal@esgfaa.gov.ao>'),
  // para onde vai o aviso de cada mensagem do formulário de contacto do site (vazio: só no painel)
  CONTACTOS_EMAIL: z.union([z.literal(''), z.email()]).default(''),
  // quem recebe o alerta quando o Centro de segurança deteta um ataque (precisa do SMTP_URL)
  SEGURANCA_EMAIL: z.union([z.literal(''), z.email()]).default(''),
  // servidor Jitsi das salas de videoconferência do portal (o ideal é um servidor da Escola; meet.jit.si limita as salas incorporadas)
  JITSI_URL: z.url().default('https://meet.jit.si'),
  PORTAL_URL: z.union([z.literal(''), z.url()]).default(''),
  // chave partilhada com o Sistema de Gestão de Pessoal (rede interna), que envia os docentes e estudantes; vazio = desligado
  INTEGRACAO_CHAVE: z.union([z.literal(''), z.string().min(32, 'INTEGRACAO_CHAVE deve ter pelo menos 32 caracteres.')]).default(''),
  // anti-plágio: pesquisa na internet (Brave Search) e avaliação de IA / traduções (Claude)
  BRAVE_API_KEY: z.string().default(''),
  PESQUISAS_WEB_POR_DOCUMENTO: inteiro(8, 0, 40),
  ANTHROPIC_API_KEY: z.string().default(''),
  ANTHROPIC_MODELO: z.string().regex(/^[a-z0-9.-]+$/).default('claude-sonnet-5-5'),
  // tradutor automático gratuito (LibreTranslate no servidor da Escola), usado se não houver chave da IA
  LIBRETRANSLATE_URL: z.union([z.literal(''), z.url()]).default(''),
  LIBRETRANSLATE_CHAVE: z.string().default(''),
  VAPID_PUBLIC_KEY: z.string().default(''),
  VAPID_PRIVATE_KEY: z.string().default(''),
  VAPID_SUBJECT: z.string().default('mailto:geral@esgfaa.gov.ao'),
})

// "1" -> 1 (n.º de proxies), "loopback" -> 'loopback', "" -> false
const proxy = (v) => (!v ? false : /^\d+$/.test(v) ? Number(v) : v === 'true' ? true : v)

/*
  Lê e valida a configuração do ambiente (falha no arranque se algo estiver errado).
  Em testes passa-se um objeto com os valores pretendidos.
*/
export function criarConfig(env = process.env, extras = {}) {
  const r = ESQUEMA.safeParse(env)
  if (!r.success) {
    const p = r.error.issues[0]
    throw new Error(`Configuração inválida (${p.path.join('.')}): ${p.message}`)
  }
  const e = r.data
  const producao = e.NODE_ENV === 'production'

  let segredoJwt = e.JWT_SECRET
  if (!segredoJwt) {
    if (producao) throw new Error('Defina JWT_SECRET no ambiente antes de arrancar a API em produção.')
    segredoJwt = SEGREDO_DESENVOLVIMENTO
  } else if (producao && segredoJwt.length < 32) {
    throw new Error('JWT_SECRET demasiado curto: use pelo menos 32 caracteres aleatórios.')
  }

  if (!e.DATABASE_URL && producao) throw new Error('Defina DATABASE_URL (PostgreSQL) antes de arrancar a API em produção.')
  const pastaDados = path.resolve(RAIZ_API, e.DATA_DIR)

  return {
    ambiente: e.NODE_ENV,
    producao,
    porta: e.PORT,
    pastaDados,
    urlBaseDados: e.DATABASE_URL || URL_DESENVOLVIMENTO,
    fuso: e.FUSO_HORARIO,
    pastaUploads: path.join(pastaDados, 'uploads'),
    // materiais, entregas e documentos do portal: fora da pasta pública
    pastaPrivada: path.join(pastaDados, 'privado'),
    dominioEmail: e.EMAIL_DOMINIO_ESCOLA.toLowerCase(),
    urlPublico: e.PUBLIC_URL.replace(/\/$/, ''),
    origens: e.CORS_ORIGINS,
    segredoJwt,
    segredoDesenvolvimento: segredoJwt === SEGREDO_DESENVOLVIMENTO,
    duracaoSessao: e.SESSION_TTL,
    tamanhoMaximoUpload: e.MAX_UPLOAD_MB * 1024 * 1024,
    ligacoesBaseDados: e.DB_POOL,
    confiarProxy: proxy(e.TRUST_PROXY),
    administrador: { nome: e.ADMIN_NAME, email: e.ADMIN_EMAIL, senha: e.ADMIN_PASSWORD },
    registos: e.LOG ?? (e.NODE_ENV === 'test' ? 'nenhum' : 'json'),
    // e-mails das notificações; sem SMTP_URL ficam só no portal
    smtp: e.SMTP_URL,
    remetente: e.EMAIL_REMETENTE,
    emailContactos: e.CONTACTOS_EMAIL,
    emailSeguranca: e.SEGURANCA_EMAIL,
    jitsiUrl: e.JITSI_URL.replace(/\/$/, ''),
    // endereço do portal usado nas ligações dos e-mails (ex.: https://escola.ao/portal/)
    urlPortal: e.PORTAL_URL.replace(/\/$/, ''),
    chaveIntegracaoPessoal: e.INTEGRACAO_CHAVE,
    // serviços externos opcionais (sem chave ficam desligados)
    pesquisaWeb: { chave: e.BRAVE_API_KEY, porDocumento: e.PESQUISAS_WEB_POR_DOCUMENTO },
    ia: { chave: e.ANTHROPIC_API_KEY, modelo: e.ANTHROPIC_MODELO },
    tradutor: { url: e.LIBRETRANSLATE_URL, chave: e.LIBRETRANSLATE_CHAVE },
    // avisos no telemóvel (Web Push): sem chaves, o servidor cria-as e guarda-as na pasta de dados
    push: { publica: e.VAPID_PUBLIC_KEY, privada: e.VAPID_PRIVATE_KEY, assunto: e.VAPID_SUBJECT },
    // limites de pedidos por janela (os testes podem alterá-los)
    limites: {
      entrar: { janelaMs: 15 * 60_000, maximo: 10 },
      // tentativas por IP, qualquer que seja o e-mail (contra "password spraying")
      entrarIp: { janelaMs: 15 * 60_000, maximo: 40 },
      admin: { janelaMs: 60_000, maximo: 600 },
      publico: { janelaMs: 60_000, maximo: 300 },
      gosto: { janelaMs: 60_000, maximo: 30 },
      comentario: { janelaMs: 60_000, maximo: 4 },
      contacto: { janelaMs: 10 * 60_000, maximo: 3 },
      // pacotes SCORM/H5P: cada um carrega centenas de ficheiros, e uma turma pode estar atrás do mesmo endereço
      pacotes: { janelaMs: 60_000, maximo: 6000 },
      visita: { janelaMs: 60_000, maximo: 60 },
      impressao: { janelaMs: 60_000, maximo: 120 },
      clique: { janelaMs: 60_000, maximo: 30 },
      // mensagens privadas por IP e por conta (contra abusos)
      mensagens: { janelaMs: 60_000, maximo: 30 },
      entrarPortal: { janelaMs: 15 * 60_000, maximo: 10 },
      entrarPortalIp: { janelaMs: 15 * 60_000, maximo: 60 },
      portal: { janelaMs: 60_000, maximo: 600 },
    },
    ...extras,
  }
}
