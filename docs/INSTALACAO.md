# Instalação em produção — Sistema ESGFAA

Guia para a equipa de informática que instala e mantém o sistema. Os ficheiros estão em [`deploy/`](../deploy) e foram testados com Docker (construção, arranque, HTTPS, entrada, verificação em dois passos e documentos).

## 1. Como fica

| Servidor | O que corre | Quem lhe acede |
|---|---|---|
| **Público** (`docker-compose.portal.yml`) | site, Portal Académico, painel de gestão (endereço reservado), API e PostgreSQL; o Caddy serve as páginas e obtém o certificado HTTPS sozinho | a internet (portas 80 e 443) |
| **Interno** (`docker-compose.pessoal.yml`) | sistema de gestão de pessoal (página + API) e o seu PostgreSQL | **só a rede da Escola** (porta 443); nunca exposto à internet |

O servidor interno envia ao público as contas dos docentes e estudantes (pedido assinado com `INTEGRACAO_CHAVE`) e consulta o BI na API do Estado. Não recebe nada de fora.

Pela Lei n.º 22/11, os dados pessoais devem ficar em Angola: prefira um centro de dados nacional ou um servidor da Escola para os dois. Fora de Angola, só com autorização da Agência de Protecção de Dados.

## 2. Requisitos

- Linux (Ubuntu Server 24.04 LTS ou equivalente), com **Docker** e o plugin **docker compose**.
- Servidor público: 2 vCPU, 4–8 GB de RAM e 100 GB de disco (os ficheiros carregados crescem). Servidor interno: 2 vCPU, 4 GB e 50 GB.
- **Domínio** para o servidor público (ex.: `esgfaa.gov.ao`) a apontar (registo A) para o IP do servidor.
- Hora certa nos servidores (NTP ligado): a verificação em dois passos depende dela.
- Disco cifrado (LUKS) ou cifra do fornecedor, e um segundo local para as cópias de segurança.

## 3. Chaves e segredos

Gere cada um com `openssl rand -hex 32` e **guarde uma cópia num cofre fora dos servidores** (papel em envelope lacrado, cofre de palavras-passe da Escola):

| Variável | Onde | Para quê | Se se perder |
|---|---|---|---|
| `JWT_SECRET` | cada servidor (diferentes) | assinar as sessões | todos têm de voltar a entrar |
| `DADOS_CHAVE` | cada servidor (diferentes) | cifrar os dados pessoais na base de dados | **os dados cifrados não se recuperam** |
| `COPIAS_CHAVE` | onde correm as cópias | cifrar as cópias de segurança | **as cópias não abrem** |
| `INTEGRACAO_CHAVE` | os dois (a mesma) | o pessoal enviar as contas ao portal | gera-se outra |
| `BD_SENHA` | cada servidor | PostgreSQL | redefine-se no PostgreSQL |

Os ficheiros `deploy/*.env` têm segredos: ficam só no servidor, com permissões `600`, e **nunca vão para o repositório** (o `.gitignore` já os exclui).

## 4. Servidor público

```bash
git clone https://github.com/cahuala/esgfaa.git /srv/esgfaa && cd /srv/esgfaa
cp deploy/portal.env.example deploy/portal.env && chmod 600 deploy/portal.env
nano deploy/portal.env      # DOMINIO, ADMIN_PATH, BD_SENHA, JWT_SECRET, DADOS_CHAVE, ADMIN_EMAIL, ADMIN_PASSWORD, INTEGRACAO_CHAVE, SMTP…
docker compose -f deploy/docker-compose.portal.yml --env-file deploy/portal.env up -d --build
docker compose -f deploy/docker-compose.portal.yml --env-file deploy/portal.env logs -f api   # «API ESGFAA a correr»
```

- O site fica em `https://DOMINIO/`, o portal em `https://DOMINIO/portal/` e o painel em `https://DOMINIO/ADMIN_PATH/` (o endereço reservado, que só a Administração conhece). O sistema de pessoal **não** é publicado aqui.
- Na primeira vez, a API carrega os conteúdos actuais do site e cria o administrador (`ADMIN_EMAIL`).
- **Primeira entrada no painel:** o administrador tem de ligar a verificação em dois passos (Perfil) antes de usar o painel. Guarde os códigos de recuperação no cofre.
- A API está no mesmo domínio das páginas (`/api`), por isso a sessão usa o cookie mais seguro (`SameSite=Strict`). Para a pôr noutro domínio, veja «Onde fica a API» no README.
- **Firewall:** entradas só 80 e 443; o PostgreSQL não fica exposto (só a API lhe acede, dentro do Docker).

## 5. Servidor interno (pessoal)

```bash
git clone https://github.com/cahuala/esgfaa.git /srv/esgfaa && cd /srv/esgfaa
cp deploy/pessoal.env.example deploy/pessoal.env && chmod 600 deploy/pessoal.env
nano deploy/pessoal.env     # ENDERECO, BD_SENHA, JWT_SECRET, DADOS_CHAVE, ADMIN_*, REDES_INTERNAS, PORTAL_API_URL, INTEGRACAO_CHAVE, BI_API_KEY
docker compose -f deploy/docker-compose.pessoal.yml --env-file deploy/pessoal.env up -d --build
```

- Abre em `https://ENDERECO/` (o nome no DNS interno ou o IP). O Caddy usa um certificado da sua **autoridade interna**: para os navegadores da Escola não avisarem, instale nos computadores da Repartição o certificado da raiz:
  `docker compose -f deploy/docker-compose.pessoal.yml --env-file deploy/pessoal.env cp web:/data/caddy/pki/authorities/local/root.crt ./raiz-esg.crt`
  (ou troque `tls internal` no `Caddyfile.pessoal` pelo certificado da Escola).
- `REDES_INTERNAS`: as redes da Escola; pedidos de fora são recusados pela própria API.
- **Firewall:** entrada 443 só da rede interna; saídas só para o servidor público (`PORTAL_API_URL`) e para `api.gov.ao` (BI).
- Primeira entrada: muda a palavra-passe inicial e liga a verificação em dois passos (obrigatória para quem vê fichas).
- **Quadro orgânico:** em *Orgânica → Carregar o quadro orgânico*, escolha o Excel do quadro no formato do modelo (o ficheiro «QUADRO ORGANICO - PARA CARREGAR NO SISTEMA.xlsx», entregue à parte: é interno e não está no repositório). O sistema simula primeiro e só grava se nenhuma linha tiver erro. Depois, as fichas do pessoal entram por *Importar* (Excel).

## 6. Cópias de segurança

São **automáticas**: cada docker-compose tem o serviço `copias`, que arranca com o resto e faz todos os dias às 2h (hora de Luanda) uma cópia **cifrada** da base de dados e dos ficheiros carregados desse servidor. Basta pôr a `COPIAS_CHAVE` no `deploy/*.env` (sem ela o sistema não arranca).

- Ficam as últimas 30, no volume `copias`. No dia 1 de cada mês, a cópia é também **reposta numa base temporária** para provar que serve.
- **Fora deste disco:** monte outro disco ou uma partilha de outro servidor no serviço `copias` (a linha `/mnt/disco-externo:/copias-extra` comentada no docker-compose) e ponha `COPIAS_EXTRA=/copias-extra` no `.env`. Cada cópia vai também para lá. Uma cópia só no mesmo disco não protege contra a avaria do disco.
- **Ver se estão a correr:** `docker compose -f deploy/docker-compose.<portal|pessoal>.yml --env-file deploy/<portal|pessoal>.env logs copias`. O resultado da última fica em `estado.json` (`exec copias cat /copias/estado.json`).
- **Listar e testar à mão:** `… exec copias node scripts/copias.mjs listar` e `… exec copias node scripts/copias.mjs testar /copias/<ficheiro>.esgc`.
- **Repor depois de uma avaria:** `… exec copias node scripts/copias.mjs repor /copias/<ficheiro>.esgc --para /tmp/repor`, depois `pg_restore --clean --if-exists --no-owner -d <base> /tmp/repor/<sistema>/base.dump` (o `pg_restore` também está no contentor `copias`, com `-h bd -U <utilizador>`). Os ficheiros voltam para o volume `dados`.
- **Guarde a `COPIAS_CHAVE` no cofre**, fora do servidor: sem ela as cópias não abrem.

## 7. Actualizar

```bash
cd /srv/esgfaa && git pull
docker compose -f deploy/docker-compose.portal.yml --env-file deploy/portal.env up -d --build    # ou o do pessoal
```

As migrações da base de dados aplicam-se sozinhas no arranque. Faça uma cópia de segurança antes de cada actualização.

## 8. Antes de abrir ao público (lista de verificação)

- [ ] Domínio e HTTPS a funcionar (`https://DOMINIO/api/saude` responde `{"ok":true}`).
- [ ] Todas as chaves geradas e guardadas no cofre; `deploy/*.env` com permissões `600`.
- [ ] Administrador entrou, mudou a palavra-passe e ligou a verificação em dois passos.
- [ ] Dados de demonstração **não** carregados (não corra `npm run semear` em produção).
- [ ] Serviço `copias` a correr nos dois servidores (`logs copias`), com `COPIAS_EXTRA` noutro disco, e um teste de reposição feito.
- [ ] E-mail (SMTP) configurado e testado (notificações, alertas de segurança).
- [ ] Servidor interno inacessível de fora da rede da Escola (confirmar a partir de uma rede externa).
- [ ] Registo ou autorização na Agência de Protecção de Dados (APD) e política de privacidade aprovada pelo jurista.
- [ ] `DADOS_FORA_DE_ANGOLA=nao` (salvo autorização expressa).

## 9. Problemas

| Sintoma | Causa provável |
|---|---|
| O Caddy não obtém o certificado | o domínio não aponta para o servidor, ou as portas 80/443 estão fechadas |
| A API não arranca: «Defina DADOS_CHAVE…» / «JWT_SECRET…» | falta a variável no `.env` (obrigatória em produção) |
| «Código errado» na verificação em dois passos | a hora do servidor ou do telemóvel está errada (ligue o NTP) |
| O pessoal responde «só está disponível na rede interna da Escola» | o IP do computador não está em `REDES_INTERNAS` |
| As contas não chegam ao portal | `PORTAL_API_URL` ou `INTEGRACAO_CHAVE` diferentes nos dois servidores, ou a firewall bloqueia a saída |
