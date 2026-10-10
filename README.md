# Site da Escola Superior de Guerra (ESGFAA)

Três partes no mesmo repositório:

| Parte | Pasta | Endereço |
|---|---|---|
| Site público (React + Vite) | `src/` | `https://cahuala.github.io/esgfaa/` |
| Painel de administração (tema Color Admin) | `src/admin/`, `admin/index.html` | endereço secreto (ver abaixo); no computador: `localhost:5173/admin/` |
| API (Node.js + SQLite) | `api/` | onde a alojar (ver abaixo) |

O site funciona sem a API: usa os conteúdos de `src/data/`. Com a API ligada, passa a mostrar o que se edita no painel, e ativa gostos, comentários e contagem de visualizações.

## Correr no computador

Precisa do Node.js 22.13 ou mais recente (a API usa o SQLite incluído no Node).

```bash
# 1. API (terminal 1)
cd api
npm install
cp .env.example .env      # opcional em desenvolvimento
npm run dev               # http://localhost:3001

# 2. Site e painel (terminal 2, na raiz)
npm install
echo "VITE_API_URL=http://localhost:3001" > .env.local
npm run dev               # site: http://localhost:5173  ·  painel: http://localhost:5173/admin/
```

No primeiro arranque a API:
- cria a base de dados em `api/dados/esgfaa.sqlite`;
- copia para a base de dados os conteúdos atuais de `src/data/` e as imagens de `src/assets/`;
- cria o administrador `admin@esgfaa.gov.ao` com a palavra-passe `Mudar1234` (ou os valores de `ADMIN_EMAIL` / `ADMIN_PASSWORD`). **Altere-a logo no painel, em "O meu perfil".**

Para voltar aos conteúdos originais (mantém utilizadores e registo): `cd api && npm run seed -- --forcar`.

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

A API precisa de um servidor com **disco persistente** (a base de dados e as imagens carregadas ficam em `api/dados/`). Opções: um VPS com Node.js, ou um serviço como Render/Railway com disco persistente.

Variáveis de ambiente obrigatórias em produção (ver `api/.env.example`):

| Variável | Para quê |
|---|---|
| `NODE_ENV=production` | modo de produção |
| `JWT_SECRET` | segredo longo e aleatório para as sessões (`openssl rand -hex 32`) |
| `ADMIN_PASSWORD` | palavra-passe do primeiro administrador |
| `PUBLIC_URL` | endereço público da API, ex.: `https://api.esgfaa.gov.ao` |
| `CORS_ORIGINS` | sites autorizados, ex.: `https://cahuala.github.io` |
| `DATA_DIR` | pasta persistente para a base de dados e os ficheiros |
| `TRUST_PROXY=1` | se estiver atrás de um proxy (Render, Nginx…) |

Com Docker (construir a partir da raiz, porque a carga inicial lê `src/data`):

```bash
docker build -f api/Dockerfile -t esgfaa-api .
docker run -p 3001:3001 -v esgfaa-dados:/app/api/dados --env-file api/.env esgfaa-api
```

Depois, no GitHub: **Settings → Secrets and variables → Actions → Variables → New variable**, nome `API_URL`, valor o endereço da API. Na publicação seguinte, o site e o painel passam a usá-la.

### Endereço secreto do painel

O painel **não** é publicado em `/admin`. Em **Settings → Secrets and variables → Actions → Secrets → New repository secret**, crie `ADMIN_PATH` com um nome difícil de adivinhar (só letras minúsculas, números e hífenes, 8 a 64 caracteres, ex.: `gestao-x7k4q9`). O painel fica em `https://cahuala.github.io/esgfaa/<ADMIN_PATH>/`. Sem esse secret, o painel não é publicado. Para mudar o endereço, altere o secret e volte a publicar.

O endereço secreto é só uma camada extra: a proteção real é a palavra-passe, o limite de tentativas e o registo de entradas.

Faça cópias de segurança regulares da pasta `api/dados/`.

## Notas

- O tema do painel é o **Color Admin** (licença comercial da SeanTheme). A pasta original `color_admin_v5.5.2/` não é publicada no Git; só o CSS compilado está em `src/admin/tema/`. Confirme que a licença adquirida cobre este uso.
- Os formulários de candidatura (página inicial) e de contacto ainda não enviam dados para lado nenhum.
