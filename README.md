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

Em `/portal/` (botão "Portal Académico" do site). Entra-se com o **e-mail da Escola**; a palavra-passe inicial é o próprio e-mail e o portal obriga a mudá-la na primeira entrada. Usa o mesmo tema do painel (Color Admin, com a identidade da Escola): barra lateral com o perfil e as cadeiras, dashboard com widgets e gráficos, linha do tempo no percurso académico, modo claro e escuro.

- **Estudante:** painel (números, gráfico das notas do ano, progresso no curso, aulas de hoje, prazos, avisos), **percurso académico** (todos os anos frequentados em linha do tempo, com notas finais, horas concluídas e média das aprovadas), cadeiras com programa, materiais, avisos, trabalhos (entrega de ficheiros), notas e presenças; boletim de notas em matriz (disciplinas × 1.ª prova, 2.ª prova, MAC, exame, recurso, nota final e situação), para imprimir; horário semanal; avisos da Administração Escolar; pedidos de documentos (declarações, certificados) e perfil.
- **Página da cadeira como no Moodle:** secção geral (avisos, fórum, programa) e **capítulos** com os materiais, trabalhos e questionários, cada um com o seu estado (feito, entregue, nota); à direita o índice da cadeira, o progresso, as próximas datas, os docentes e o fórum. O docente liga o **modo de edição** para criar, ordenar, esconder e apagar capítulos e para "Adicionar atividade ou recurso" (ficheiros em lote com barra de envio, ligações, vídeos, trabalhos, questionários). Separador **Participantes**. O painel inicial tem linha temporal, mini-calendário, cadeiras acedidas recentemente e cartões das cadeiras com progresso.
- **Questionários completos:** 7 tipos de pergunta (escolha única e múltipla, verdadeiro/falso, resposta curta sem contar acentos nem maiúsculas, numérica com tolerância, correspondência com crédito parcial, dissertação corrigida à mão); **banco de perguntas** do docente por categorias, reutilizável entre questionários e cadeiras; perguntas e opções baralhadas e N perguntas sorteadas por tentativa; correção manual com comentário (a nota sai quando todas as dissertações estiverem corrigidas e o estudante é avisado); **estatísticas** por pergunta (facilidade e distribuição das escolhas), média e mediana.
- **Trabalhos completos:** entrega com até 10 ficheiros, com texto escrito no portal, ou ambos; grelha de avaliação (rubrica) com pontos por critério convertidos em nota de 0 a 20; ficheiro corrigido devolvido só ao autor; prorrogação do prazo para um estudante (é avisado, e não recebe o lembrete do prazo geral).
- **Livro de notas ligado às atividades:** cada componente da pauta (1.ª prova, 2.ª prova, exame, recurso) pode ser lançada à mão ou **calculada** a partir de trabalhos e questionários com pesos (média ponderada; sem entrega depois do prazo conta 0); fica em dia sozinha quando chega uma correção ou uma tentativa. Pauta **exportável para Excel** (portal e painel).
- **Novo ano letivo:** a Administração Escolar copia as cadeiras de uma turma para outra (cria as que faltam e copia capítulos, materiais com cópia dos ficheiros, trabalhos, questionários, datas, programa e composição das notas, com as datas avançadas um ano), ou uma cadeira de cada vez; o docente usa "Importar de outra cadeira" no modo de edição. Entregas, notas, fórum e presenças não se copiam.
- **Restrições e conclusão:** cada atividade pode ser **escondida**, ter uma **data de abertura** (também por capítulo) e **condições** — "só abre depois de concluir X", com nota mínima opcional no trabalho ou questionário. O estudante vê a atividade fechada com o motivo; a API recusa abri-la, entregar ou responder. Com todas as atividades concluídas, o estudante obtém o **certificado de conclusão** da cadeira (pronto a imprimir), com um código que qualquer pessoa verifica em `/portal/#/verificar`. As restrições copiam-se com as cadeiras (datas avançadas, condições sobre as atividades novas).
- **Mais recursos:** **Página** (texto rico escrito no portal, com títulos, tabelas e vídeos), **Pasta** (vários ficheiros num só recurso; o docente junta e retira), **Videoconferência** (ligação, dia, hora e duração; o botão "Entrar" abre 15 minutos antes e a sessão aparece nas próximas datas), **Sondagem** (uma pergunta de escolha única ou múltipla, anónima ou não, com resultados aos estudantes depois de responderem, depois do fecho ou nunca) e **avaliação dos docentes**: a Administração Escolar lança na turma um inquérito pedagógico anónimo por docente e cadeira (oito afirmações de 1 a 5 e dois comentários); a base de dados não liga respostas a estudantes, o docente só vê os resultados agregados depois do fecho e com pelo menos 3 respostas, e não pode esconder nem apagar a sua avaliação.
- **Grupos:** separador "Grupos" em cada cadeira; o docente cria grupos à mão ou ao acaso (N estudantes por grupo ou N grupos) e escolhe os membros — cada estudante está num só grupo por cadeira. **Trabalhos em grupo:** uma entrega por grupo, que qualquer membro faz ou substitui (os colegas são avisados); a correção, a nota (também na pauta calculada), o progresso e os ficheiros valem para todo o grupo e só para ele.
- **Relatórios e administração:** registo de acessos dos estudantes (página da cadeira, materiais, ficheiros, trabalhos, questionários, inquéritos e fórum; a mesma página em 5 minutos conta uma vez); separador **Relatórios** do docente com a participação de cada estudante (acessos, último acesso com alerta a partir de 7 dias, atividades abertas, entregas, questionários, fórum; exportável para Excel), o uso de cada atividade e o registo de acessos filtrável por estudante. A Administração Escolar **importa estudantes de Excel (.xlsx) ou CSV** na turma: a folha é lida no navegador, a pré-visualização diz o que acontece a cada linha (conta nova, só matrícula, já matriculado ou erro) e só depois se grava.
- **Fórum completo:** tópicos de discussão e de **perguntas e respostas** (abertos pelo docente; o estudante só vê as respostas dos colegas depois de responder), até 3 **anexos** por mensagem, **resposta certa** marcada por quem perguntou ou pelo docente, **seguir** o fórum inteiro ou um tópico (e deixar de seguir), **pesquisa** nos assuntos, mensagens e respostas, e edição das próprias mensagens nos primeiros 30 minutos (o docente modera sempre). Os avisos abrem diretamente o tópico.
- **Indicadores académicos** (painel da Administração Escolar, por ano letivo): estudantes ativos, **estudantes em risco** com os motivos (menos de 75% de presenças, negativas nas provas, recurso ou reprovação, 14 dias sem entrar no portal), **pautas em atraso** (notas por lançar 15 dias depois da data da prova, com os docentes), cadeiras sem docente, e por turma e cadeira a aprovação, a média final e a assiduidade.
- **Avaliação por pares** (como o "Workshop" do Moodle): o docente define a grelha, o prazo de entrega e o de avaliação; no fim da entrega cada estudante recebe ao acaso N trabalhos de colegas para avaliar (nunca o seu; anónimo se se quiser); no fim vê as avaliações recebidas e a nota (média dos pares, que o docente pode rever). Conta para o progresso, as restrições, a cópia de cadeiras e a pauta calculada (quem não entregou fica com 0).
- **Glossário e wiki da cadeira:** o glossário tem termos por ordem alfabética, com pesquisa e índice de letras; os estudantes propõem e o docente aprova. A wiki tem páginas escritas por todos no editor de texto, ligações entre páginas com [[Título]], histórico de versões, aviso quando duas pessoas gravam ao mesmo tempo e reposição de versões pelo docente.
- **Pesquisa e calendário externo:** caixa de pesquisa no cabeçalho do portal, que procura nas cadeiras de quem pesquisa (cadeiras, materiais e páginas, trabalhos, questionários, fórum, glossário, wiki e avisos), com excertos e o termo realçado; o estudante não encontra o que está escondido. O calendário pode ser **assinado** no Google Calendar, Outlook ou telemóvel (iCal, endereço pessoal secreto que se pode renovar), com aulas, provas, entregas, questionários, videoconferências e prazos da avaliação por pares, nas horas de Luanda.
- **Documentos da Administração Escolar** (imprimir ou guardar em PDF, com cabeçalho oficial e espaço para assinaturas; exportação para Excel): pauta de cada cadeira, **pauta da turma** (estudantes × cadeiras, média e situação no ano), **folha de presenças** (aulas registadas e colunas em branco), **lista de presenças para a prova** com espaço para assinar, **histórico académico** de cada estudante e **certificado de conclusão do curso** (com código verificável em `/portal/#/verificar`).
- **Pessoal e Quadros e Administração Escolar:** a Repartição de Pessoal e Quadros (papel próprio) **regista** estudantes e docentes — dados pessoais (posto, ramo, NIP) e conta do portal, um a um ou a partir de Excel/CSV — e repõe palavras-passe. A Administração Escolar **não regista ninguém**: consulta o registo e escolhe quem matricular nas turmas (pesquisa com escolha múltipla, ou folha com e-mail ou número de estudante), quem inscrever em cadeiras e que docentes alocar.
- **Inscrição em cadeiras e conclusão do curso:** a Administração Escolar inscreve estudantes em cadeiras de outra turma (atraso, repetição, equivalência); o inscrito vê a cadeira e entra na pauta, presenças, trabalhos e avisos. Nas turmas de finalistas lança o **trabalho de fim de curso** (tema, orientador, júri, defesa e nota). O curso conclui-se com todas as unidades curriculares aprovadas (vale o melhor resultado de cada código) e o TFC aprovado; a média final conta o TFC como mais uma unidade curricular (`CONCLUSAO_CURSO` em `api/src/dominio/academico/conclusao/percurso.js`).
- **Interação:** no modo de edição da cadeira, as atividades arrastam-se entre capítulos e os capítulos arrastam-se para mudar a ordem (as setas e o seletor continuam para o telemóvel); confirmações e perguntas usam janelas do tema (Esc cancela, Enter confirma) em vez das do navegador, no portal e no painel.
- **Notificações e mensagens:** sino no cabeçalho e página de notificações (material novo, avisos, trabalhos, correções, notas publicadas, respostas no fórum, questionários, datas marcadas, avisos gerais, pedidos tratados), também por e-mail se a conta quiser (preferência no perfil); **lembrete automático 24 h antes do prazo** a quem ainda não entregou; **mensagens privadas** entre docentes e estudantes que partilham uma cadeira.
- **Recursos ao estilo do Moodle:** **fórum** em cada cadeira (tópicos e respostas; o docente fixa, fecha e modera); **calendário académico** mensal com aulas (sem os feriados), provas, exame e recurso marcados pelo docente, entregas de trabalhos, fecho dos questionários e eventos da Administração Escolar; **progresso das atividades** (materiais vistos, trabalhos entregues, questionários feitos), com relatório estudantes × atividades para o docente; **questionários online** de escolha única, múltipla ou verdadeiro/falso, com abertura e fecho, tempo limite e tentativas, gravação automática das respostas e correção automática (nota de 0 a 20). O servidor é que controla o tempo: depois do fim só contam as respostas gravadas a tempo, e o estudante nunca recebe as respostas certas antes de entregar.
- **Avaliação (modelo do ensino superior angolano):** MAC = média das duas provas parcelares; MAC ≥ 14 sem prova negativa dispensa do exame (nota final = MAC); os outros vão a exame, com nota final = 40 % MAC + 60 % exame; quem reprova vai a recurso (a mesma fórmula, com o recurso no lugar do exame). Nota final arredondada às unidades; classificação Reprovado (< 10), Suficiente (10–13), Bom (14–16), Muito bom (17–20). Segue o regulamento do ISP Tundavala (art. 19.º–26.º); os números estão juntos em `api/src/dominio/academico/regras.js` (`AVALIACAO`) para os ajustar ao regulamento da Escola. O portal importa a mesma regra, por isso a pauta calcula exatamente como o servidor.
- **Docente:** nas cadeiras onde está alocado (regente ou assistente) publica materiais (ficheiros, ligações, vídeos) e avisos, cria trabalhos e corrige as entregas, lança a pauta em matriz (estudantes × 1.ª prova, 2.ª prova, exame, recurso, com MAC e nota final calculadas ao escrever) e publica cada coluna quando quiser, regista aulas (sumário) e presenças.
- **Administração Escolar (no painel):** turmas (ano letivo e ano curricular), matrículas (cria a conta do estudante), contas de docentes, cadeiras (1.º semestre, 2.º semestre ou anual) criadas sem docente e **alocação de docentes** depois (regente + assistentes, com horas; página geral da carga horária), **programa da cadeira** escrito no editor ou em documento, **pautas** (lança e publica notas como o docente), **calendário académico** (eventos da Escola ou de uma turma, épocas de exames, feriados), horários, pedidos de documentos (com anexo do documento pronto) e avisos do portal. Papel "Repartição de Administração Escolar" (permissões `academico.ver`, `academico.gerir` e `academico.notas`).

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
| `SMTP_URL` | servidor de e-mail para as notificações, ex.: `smtps://portal%40esgfaa.gov.ao:SENHA@smtp.servidor.ao:465` (sem ele, as notificações ficam só no portal) |
| `EMAIL_REMETENTE` | remetente dos e-mails, ex.: `Portal Académico ESG <portal@esgfaa.gov.ao>` |
| `PORTAL_URL` | endereço do portal, para as ligações nos e-mails, ex.: `https://cahuala.github.io/esgfaa/portal/` |
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
