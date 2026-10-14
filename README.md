# Site da Escola Superior de Guerra (ESGFAA)

Três partes no mesmo repositório:

| Parte | Pasta | Endereço |
|---|---|---|
| Site público (React + Vite) | `src/` | `https://cahuala.github.io/esgfaa/` |
| Painel de administração (tema Color Admin) | `src/admin/`, `admin/index.html` | endereço secreto (ver abaixo); no computador: `localhost:5173/admin/` |
| Portal académico (estudantes e docentes) | `src/portal/`, `portal/index.html` | `…/portal/` (botão "Portal Académico" do site) |
| API (Express + PostgreSQL com Prisma, arquitetura DDD) | `api/` | onde a alojar (ver abaixo); detalhes em [api/README.md](api/README.md) |

O site funciona sem a API: usa os conteúdos de `src/data/`. Com a API ligada, passa a mostrar o que se edita no painel, e ativa gostos, comentários e contagem de visualizações.

## Correr no computador

Precisa do Node.js 24 ou mais recente e do Docker (para o PostgreSQL).

```bash
# 0. PostgreSQL (uma vez; fica a correr em segundo plano, porta 5434)
docker compose up -d

# 1. API (terminal 1)
cd api
npm install
cp .env.example .env      # opcional em desenvolvimento
npm run migrar            # cria/atualiza as tabelas (migrações do Prisma)
npm run dev               # http://localhost:3001

# 2. Site e painel (terminal 2, na raiz)
npm install
echo "VITE_API_URL=http://localhost:3001" > .env.local
npm run dev               # site: http://localhost:5173  ·  painel: http://localhost:5173/admin/
```

No primeiro arranque a API:
- copia para a base de dados os conteúdos atuais de `src/data/` e as imagens de `src/assets/`;
- cria o administrador `admin@esgfaa.gov.ao` (ou `ADMIN_EMAIL`) com a palavra-passe de `ADMIN_PASSWORD`; sem ela, gera uma palavra-passe aleatória e mostra-a **uma única vez** no terminal. O painel pede que a mude ao entrar.

Para voltar aos conteúdos originais (mantém utilizadores e registo): `cd api && npm run seed -- --forcar`.

Quem ainda tem a base antiga em SQLite (`api/dados/esgfaa.sqlite`) copia tudo para o PostgreSQL com `cd api && npm run importar-sqlite` (só corre numa base vazia).

## Testes automatizados

```bash
npm run test:api        # API: testes de unidade e integração (domínio, segurança, RBAC, conteúdos, ficheiros…)
npm test                # site e painel: componentes e funções (Vitest + Testing Library)
npm run test:e2e        # ponta-a-ponta com o Chrome: entrar no painel, publicar uma notícia, vê-la no site, gostar e comentar
npm run test:tudo       # lint + todos os anteriores
```

Os testes da API usam o PostgreSQL do `docker compose` (cada teste num esquema próprio, apagado no fim); os ponta-a-ponta arrancam uma API e um site próprios (portas 3101 e 5174) com uma base de dados descartável. No GitHub, os testes correm em cada pull request e **antes de cada publicação**: se algum falhar, o site não é publicado. Cobertura: `npm run test:cobertura` (na raiz e em `api/`).

## Portal académico

Em `/portal/` (botão "Portal Académico" do site). Entra-se com o **e-mail da Escola**; a palavra-passe inicial é o próprio e-mail e o portal obriga a mudá-la na primeira entrada.

- **Estudante:** início (aulas de hoje, prazos, avisos), cadeiras com materiais, avisos, trabalhos (entrega de ficheiros), notas e presenças; boletim de notas em matriz (disciplinas × 1.ª prova, 2.ª prova, MAC, exame, recurso, nota final e situação), para imprimir; horário semanal; avisos da Secretaria; pedidos de documentos (declarações, certificados) e perfil.
- **Avaliação (modelo do ensino superior angolano):** MAC = média das duas provas parcelares; MAC ≥ 14 sem prova negativa dispensa do exame (nota final = MAC); os outros vão a exame, com nota final = 40 % MAC + 60 % exame; quem reprova vai a recurso (a mesma fórmula, com o recurso no lugar do exame). Nota final arredondada às unidades; classificação Reprovado (< 10), Suficiente (10–13), Bom (14–16), Muito bom (17–20). Segue o regulamento do ISP Tundavala (art. 19.º–26.º); os números estão juntos em `api/src/dominio/academico/regras.js` (`AVALIACAO`) para os ajustar ao regulamento da Escola. O portal importa a mesma regra, por isso a pauta calcula exatamente como o servidor.
- **Docente:** nas suas cadeiras publica materiais (ficheiros, ligações, vídeos) e avisos, cria trabalhos e corrige as entregas, lança a pauta em matriz (estudantes × 1.ª prova, 2.ª prova, exame, recurso, com MAC e nota final calculadas ao escrever) e publica cada coluna quando quiser, regista aulas (sumário) e presenças.
- **Secretaria Académica (no painel):** turmas, matrículas (cria a conta do estudante), contas de docentes, cadeiras e horários, pedidos de documentos (com anexo do documento pronto) e avisos do portal. Papel "Secretaria Académica".

Os materiais, entregas e documentos ficam numa pasta **privada** (`dados/privado`) e só são entregues pela API a quem tem acesso (inscrito na cadeira, dono da entrega, docente da cadeira). As sessões do portal e do painel são independentes. Variável `EMAIL_DOMINIO_ESCOLA` (por omissão `esgfaa.gov.ao`) define o domínio aceite nas contas.

Dados de demonstração (só em desenvolvimento): `cd api && npm run semear-portal` — cria uma turma, 4 cadeiras, 2 docentes (`miguel.santos@`, `ana.baptista@esgfaa.gov.ao`) e 4 estudantes (`joao.fernandes@`, `maria.costa@`, `pedro.neto@`, `sofia.lima@esgfaa.gov.ao`); a palavra-passe inicial de cada um é o próprio e-mail.

## Painel de administração

- **Conteúdos:** notícias, artigos, eventos, cursos e corpo docente, com imagens, galerias, vídeos (YouTube ou ficheiro) e PDF.
- **Páginas do site:** página inicial, Institucional, admissão aos cursos e Contactos.
- **Comentários:** são publicados de imediato; o painel permite apagá-los.
- **Utilizadores** (só administradores): criar contas, mudar o papel, desativar.
- **Registo de atividades** (só administradores): entradas, tentativas falhadas, criações, edições (com os campos alterados), remoções e envios de ficheiros, com data, utilizador e IP.

- **Publicidade:** banners com posição no site, datas, e contagem de impressões e cliques.
- **Estatísticas:** visitantes, páginas vistas, online agora, páginas mais vistas, origens, dispositivos e horas (sem cookies nem IP).
- **Papéis e permissões (RBAC):** cada papel tem uma grelha de permissões (ver, criar, editar, apagar, publicar) por área, editável no painel. A API verifica todas as permissões.

Papéis iniciais: **Administrador** (tudo, não editável), **Editor-chefe** (publica conteúdos, páginas, publicidade e comentários), **Redator** (escreve rascunhos de notícias, artigos e eventos), **Moderador** (comentários) e **Analista** (estatísticas). Quem não tem a permissão *publicar* só guarda rascunhos e não altera conteúdos já publicados.

## Pôr a API online

A API precisa de uma base **PostgreSQL** (gerida, como Neon, Supabase ou Render, ou num VPS) e de um **disco persistente** para as imagens carregadas (`api/dados/uploads`). No arranque, `npm start` aplica as migrações pendentes.

Variáveis de ambiente obrigatórias em produção (ver `api/.env.example`):

| Variável | Para quê |
|---|---|
| `NODE_ENV=production` | modo de produção |
| `JWT_SECRET` | segredo longo e aleatório para as sessões (`openssl rand -hex 32`) |
| `ADMIN_PASSWORD` | palavra-passe do primeiro administrador (mínimo 10 caracteres, com letras e números) |
| `PUBLIC_URL` | endereço público da API, ex.: `https://api.esgfaa.gov.ao` |
| `CORS_ORIGINS` | sites autorizados, ex.: `https://cahuala.github.io` |
| `DATABASE_URL` | ligação ao PostgreSQL, ex.: `postgresql://utilizador:senha@servidor:5432/esgfaa` |
| `DATA_DIR` | pasta persistente para os ficheiros carregados |
| `TRUST_PROXY=1` | se estiver atrás de um proxy (Render, Nginx…) |

Com Docker (construir a partir da raiz, porque a carga inicial lê `src/data`):

```bash
docker build -f api/Dockerfile -t esgfaa-api .
docker run -p 3001:3001 -v esgfaa-dados:/app/api/dados --env-file api/.env esgfaa-api
```

Depois, no GitHub: **Settings → Secrets and variables → Actions → Variables → New variable**, nome `API_URL`, valor o endereço da API. Na publicação seguinte, o site e o painel passam a usá-la.

### Endereço secreto do painel

O painel **não** é publicado em `/admin`. Em **Settings → Secrets and variables → Actions → Secrets → New repository secret**, crie `ADMIN_PATH` com um nome difícil de adivinhar (só letras minúsculas, números e hífenes, 8 a 64 caracteres, ex.: `gestao-x7k4q9`). O painel fica em `https://cahuala.github.io/esgfaa/<ADMIN_PATH>/`. Sem esse secret, o painel não é publicado. Para mudar o endereço, altere o secret e volte a publicar.

O endereço secreto é só uma camada extra: a proteção real está na API (palavras-passe fortes, bloqueio da conta após 5 tentativas falhadas, sessões que se podem terminar, permissões verificadas em cada pedido e registo de atividades). Ver [api/README.md](api/README.md#segurança).

Faça cópias de segurança regulares da base de dados (`pg_dump`) e da pasta `api/dados/uploads/`.

## Notas

- O tema do painel é o **Color Admin** (licença comercial da SeanTheme). A pasta original `color_admin_v5.5.2/` não é publicada no Git; só o CSS compilado está em `src/admin/tema/`. Confirme que a licença adquirida cobre este uso.
- Os formulários de candidatura (página inicial) e de contacto ainda não enviam dados para lado nenhum.
