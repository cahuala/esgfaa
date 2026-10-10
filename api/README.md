# API da Escola Superior de Guerra

Express 5 + SQLite (incluído no Node 24), organizada por camadas segundo o **Domain-Driven Design**. Serve o site público (conteúdos, gostos, comentários, visitas) e o painel de administração.

## Arquitetura

```
src/
├── dominio/            regras do negócio, sem Express nem SQL
│   ├── comum/          erros com código, texto, endereços seguros
│   ├── identidade/     Utilizador (bloqueio, sessões), Papel, permissões, política de palavras-passe, Actor
│   ├── conteudos/      coleções e validação dos dados, regras de publicação (rascunho/publicado), páginas
│   ├── interacao/      comentários e visitantes
│   ├── publicidade/    banners em vigor
│   └── estatisticas/   classificação de visitas (dispositivo, navegador, robôs)
├── aplicacao/          casos de uso: verificam permissões e registam a auditoria
│   └── sessao, utilizadores, papeis, conteudos, paginas, interacoes, estatisticas, ficheiros, auditoria, arranque
├── infraestrutura/     tudo o que toca no exterior
│   ├── bd/             ligação SQLite, transações (aninháveis) e migrações versionadas
│   ├── repositorios/   o único sítio com SQL (sempre com parâmetros)
│   ├── seguranca/      cifra scrypt, tokens JWT, cache limitada
│   ├── ficheiros/      armazenamento em disco e verificação do tipo real
│   ├── html/           filtro do HTML escrito no editor
│   └── config.js       variáveis de ambiente validadas (falha no arranque se algo estiver errado)
├── interfaces/http/    Express: rotas, esquemas de validação (zod), middlewares
├── contentor.js        liga as peças (injeção de dependências)
└── server.js           arranque e paragem controlada
```

O fluxo de um pedido é sempre: **rota** (valida a forma do pedido) → **caso de uso** (verifica quem pode, aplica as regras do domínio, regista a atividade) → **repositório** (SQL). Os erros do domínio têm um código que a camada HTTP converte no estado certo:

| Código | Estado |
|---|---|
| `validacao` | 400 |
| `nao_autenticado` | 401 |
| `sem_permissao` | 403 |
| `nao_encontrado` | 404 |
| `conflito` | 409 |
| `conta_bloqueada` | 423 |
| limite de pedidos | 429 |

As respostas de erro são sempre `{ "erro": "mensagem", "codigo": "…" }`. Os erros inesperados respondem 500 sem detalhes internos, com o identificador do pedido (`X-Request-Id`) para o encontrar nos registos.

## Segurança

**Contas e sessões**
- Palavras-passe com scrypt e sal aleatório. A política exige pelo menos 10 caracteres, com letras e números. Recusa palavras-passe comuns e as que contêm o nome ou o e-mail.
- 5 tentativas falhadas seguidas bloqueiam a conta durante 15 minutos (resposta 423). Há também um limite de pedidos por IP e e-mail (429).
- O tempo de resposta é o mesmo quer o e-mail exista quer não, e a mensagem de erro é igual nos dois casos.
- Sessões JWT HS256 com algoritmo fixo, emissor, audiência, identificador único e versão da conta.
- Sair revoga o token.
- Mudar a palavra-passe, mudar o papel ou desativar a conta termina todas as sessões dessa conta.
- Contas com palavra-passe definida por outra pessoa, ou que já não cumpre a política, são avisadas para a mudar (`deveMudarSenha`).

**Permissões e auditoria**
- As permissões (RBAC) são verificadas em cada caso de uso e lidas da base em cada pedido. Mudar um papel tem efeito imediato.
- Fica registado quem fez o quê, quando e de onde, incluindo tentativas falhadas e bloqueios.

**Dados e ficheiros**
- Params, corpo e query são validados com zod.
- O HTML do editor é filtrado no servidor com uma lista de etiquetas e estilos permitidos. Iframes só do YouTube. Endereços `javascript:` e `data:` são recusados em todos os campos de endereço.
- Ficheiros:
  - tipos permitidos: JPG, PNG, WebP, GIF, MP4, WebM e PDF;
  - o tipo real é confirmado pelos primeiros bytes; se um ficheiro do envio falhar, todo o envio é apagado;
  - são guardados com nome aleatório e servidos com `nosniff`.

**Cabeçalhos e pedidos**
- Cabeçalhos de segurança (helmet), CORS só para as origens autorizadas e `Cache-Control: no-store` no painel.
- Corpo JSON limitado a 2 MB. Cada pedido gera uma linha de registo em JSON, sem corpo nem tokens.

## Configuração

Ver [.env.example](.env.example). Em produção a API recusa arrancar sem `JWT_SECRET` (mínimo 32 caracteres) ou com uma `ADMIN_PASSWORD` fraca.

## Comandos

```bash
npm run dev              # desenvolvimento (reinicia ao gravar)
npm start                # produção
npm run seed             # acrescenta os conteúdos originais em falta (-- --forcar para repor)
npm test                 # testes de unidade e integração (base de dados em memória)
npm run test:cobertura   # com relatório de cobertura
```

## Testes

- `tests/unidade/`:
  - regras do domínio: palavras-passe, bloqueio, papéis, publicação, validação, endereços, comentários, banners, visitas;
  - infraestrutura: filtro de HTML, assinaturas de ficheiros, cifra, tokens, migrações, configuração.
- `tests/integracao/`: a API completa por HTTP (supertest), cada teste com a sua base de dados em memória:
  - sessão, bloqueio e revogação;
  - RBAC e utilizadores;
  - conteúdos e páginas;
  - site público;
  - envio de ficheiros;
  - proteções HTTP (cabeçalhos, CORS, erros, injeção de SQL).
- `tests/apoio/ambiente.js`: cria um ambiente isolado, com relógio controlável e limites configuráveis.
