#!/usr/bin/env bash
# Instalação do Sistema de Gestão de Pessoal e Quadros (ESG) em Linux x64, a partir do pendrive, sem internet.
# Corre como root (o INSTALAR-LINUX.sh pede a palavra-passe). Se já estiver instalado, actualiza (os dados ficam).
# Em caso de falha escreve no pendrive registos/ERRO-INSTALACAO-<data>.txt com a causa e o que fazer.
set -Eeuo pipefail

PEN="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DESTINO=/opt/esg-pessoal
DADOS=/var/lib/esg-pessoal
CONF=/etc/esg-pessoal
UTILIZADOR=esgpessoal
PORTA_BD=5433
PORTA_API=3002
CARIMBO="$(date +%Y%m%d-%H%M%S)"
REG="$PEN/registos"
mkdir -p "$REG" 2>/dev/null && touch "$REG/.escrita" 2>/dev/null && rm -f "$REG/.escrita" || REG="/root/esg-pessoal-registos"
mkdir -p "$REG"
LOG="$REG/instalacao-$CARIMBO.log"
PASSO="início"
CODIGO="inicio"

exec > >(tee -a "$LOG") 2>&1

passo() { PASSO="$2"; CODIGO="$1"; echo; echo "=== [$(date +%H:%M:%S)] $2"; }
ok() { echo "    ✓ $*"; }

# causas prováveis e o que fazer, por passo
causas() {
  case "$CODIGO" in
    root) echo "- O instalador não correu como administrador (root). Use INSTALAR-LINUX.sh, que pede a palavra-passe (sudo)." ;;
    sistema) echo "- O computador não é Linux de 64 bits (x86_64), ou não tem systemd (Ubuntu 22.04+, Debian 12+, Rocky/Alma 9+ têm)."
             echo "- Verifique com: uname -m  (deve dizer x86_64)  e  systemctl --version" ;;
    pendrive) echo "- A cópia no pendrive está incompleta ou estragada (um ficheiro não confere com o MANIFESTO.txt)."
              echo "- Volte a copiar a pasta ESG-PESSOAL para o pendrive (no computador onde foi preparada) e repita." ;;
    espaco) echo "- Falta espaço em disco. São precisos pelo menos 3 GB livres em /opt e /var/lib." ;;
    portas) echo "- Outro programa está a usar uma porta de que o sistema precisa (8085 para os aparelhos de ponto, $PORTA_BD, $PORTA_API; para o HTTPS usa-se a 443 ou, se estiver ocupada, a 8443, 9443 ou 10443)."
            echo "- O instalador não pára nenhum serviço. Veja quem usa as portas com: ss -ltnp" ;;
    copiar) echo "- Não foi possível descompactar os componentes (Node.js, PostgreSQL, Caddy). Pendrive estragado ou disco cheio." ;;
    bd) echo "- O PostgreSQL não arrancou. Veja o fim deste registo e: journalctl -u esg-pessoal-bd -n 50"
        echo "- Causas comuns: biblioteca do sistema em falta (glibc antiga: use Ubuntu 22.04 ou mais recente), porta $PORTA_BD ocupada, disco cheio." ;;
    migrar) echo "- A base de dados não aceitou a estrutura do sistema. Veja a mensagem acima. Numa actualização: reponha a última cópia de segurança." ;;
    organica) echo "- O Quadro Orgânico (sistema/organica.json) tem uma linha que o sistema não aceita. O sistema fica instalado; carregue a orgânica depois em Orgânica › Importar." ;;
    servicos) echo "- Um serviço não arrancou. Veja: journalctl -u esg-pessoal -n 80  e  journalctl -u esg-pessoal-web -n 50" ;;
    verificar) echo "- O sistema não respondeu em https://esg.emfaa.gov.ao (neste computador). Veja: journalctl -u esg-pessoal -n 80"
               echo "- Se o erro falar de DADOS_CHAVE ou JWT_SECRET: o ficheiro $CONF/pessoal.env foi mexido." ;;
    *) echo "- Veja a mensagem de erro acima e o registo completo: $LOG" ;;
  esac
}

falhou() {
  local cod=$? linha=${1:-?}
  # dentro de um $( … ) não se escreve o relatório (iria parar ao resultado): o processo principal trata
  [[ $BASHPID != "$$" ]] && exit "$cod"
  set +e
  local f="$REG/ERRO-INSTALACAO-$CARIMBO.txt"
  {
    echo "ERRO NA INSTALAÇÃO DO SISTEMA DE PESSOAL E QUADROS (Linux)"
    echo "Data: $(date '+%Y-%m-%d %H:%M:%S')   Computador: $(hostname)   Sistema: $(. /etc/os-release 2>/dev/null; echo "${PRETTY_NAME:-?}") $(uname -m)"
    echo
    echo "Passo que falhou: $PASSO"
    echo "Código de saída: $cod (linha $linha do instalador)"
    echo
    echo "CAUSAS PROVÁVEIS E O QUE FAZER:"
    causas
    echo
    echo "Depois de corrigir, volte a correr o instalador: continua de onde estava e não apaga dados."
    echo
    echo "ÚLTIMAS LINHAS DO REGISTO ($LOG):"
    tail -n 60 "$LOG" 2>/dev/null
  } > "$f"
  echo
  echo "!!! A instalação falhou no passo: $PASSO"
  echo "!!! As causas e o que fazer estão em: $f"
  exit "$cod"
}
trap 'falhou $LINENO' ERR

aleatorio() { head -c 48 /dev/urandom | od -An -tx1 | tr -d ' \n' | cut -c1-"${1:-64}"; }
# palavra-passe legível: letras e algarismos (sem 0/O, 1/l), com pelo menos uma letra e um algarismo
senha() { local s; while :; do s="$(head -c 400 /dev/urandom | LC_ALL=C tr -dc 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789' | cut -c1-14)"; [[ ${#s} -eq 14 && "$s" =~ [0-9] && "$s" =~ [a-zA-Z] ]] && { echo "$s"; return; }; done; }

echo "Sistema de Gestão de Pessoal e Quadros — instalação ($(cat "$PEN/VERSAO.txt" 2>/dev/null || echo '?'))"
echo "Registo: $LOG"

passo root "A verificar as permissões"
[[ $EUID -eq 0 ]] || { echo "Tem de correr como root."; false; }
ok "administrador"

passo sistema "A verificar o computador"
[[ "$(uname -m)" == "x86_64" ]] || { echo "Este instalador é para Linux x86_64 (este é $(uname -m))."; false; }
SYSTEMD=1
if ! command -v systemctl >/dev/null || [[ ! -d /run/systemd/system ]]; then
  [[ "${ESG_SEM_SYSTEMD:-}" == "1" ]] || { echo "É preciso systemd para os serviços arrancarem com o computador."; false; }
  SYSTEMD=0
fi
ok "$(. /etc/os-release; echo "$PRETTY_NAME") · $(uname -m) · systemd=$SYSTEMD"

passo pendrive "A conferir os ficheiros do pendrive (MANIFESTO)"
[ -f "$PEN/MANIFESTO.txt" ] || { echo "!!! Esta pasta é o código do instalador (do git), não a pasta preparada do pendrive: falta o MANIFESTO.txt, os programas e o sistema. Instale a partir da pasta ESG-PESSOAL do pendrive; para a preparar: node instalador/preparar-pendrive.mjs."; false; }
( cd "$PEN" && sha256sum --quiet -c MANIFESTO.txt )
ok "todos os ficheiros conferem"

passo espaco "A verificar o espaço em disco"
LIVRE=$(df -Pm /var/lib | awk 'NR==2{print $4}')
(( LIVRE > 3000 )) || { echo "Só há ${LIVRE} MB livres em /var/lib."; false; }
ok "${LIVRE} MB livres"

ATUALIZAR=0
[[ -f "$CONF/pessoal.env" ]] && ATUALIZAR=1
if (( ATUALIZAR )); then
  echo; echo ">>> Já está instalado: vai ser ACTUALIZADO (os dados, as chaves e a configuração ficam)."
  (( SYSTEMD )) && systemctl stop esg-pessoal esg-pessoal-web esg-pessoal-copias 2>/dev/null || true
fi

passo portas "A verificar as portas"
# portas em escuta (ss, ou /proc/net/tcp se não houver ss)
escuta() {
  if command -v ss >/dev/null; then ss -ltn | awk '{print $4}' | grep -qE "[:.]$1\$"
  else
    local h
    for h in $(awk 'NR>1 && $4=="0A" {split($2,a,":"); print a[2]}' /proc/net/tcp /proc/net/tcp6 2>/dev/null); do (( 16#$h == $1 )) && return 0; done
    return 1
  fi
}
# o HTTPS fica na 443 se estiver livre; senão, na primeira livre destas. Nenhum serviço do servidor é parado.
ANTERIOR=""; (( ATUALIZAR )) && ANTERIOR="$(sed -n 's/^PORTA_WEB=\([0-9]*\)$/\1/p' "$CONF/pessoal.env" | head -1)"
PORTA_WEB=""
for c in $ANTERIOR 443 8443 9443 10443; do
  if ! escuta "$c"; then PORTA_WEB=$c; break; fi
  echo "    a porta $c está ocupada — fica como está:"; ss -ltnp 2>/dev/null | grep -E "[:.]$c " | sed 's/^/      /' || true
done
[[ -n "$PORTA_WEB" ]] || { echo "As portas 443, 8443, 9443 e 10443 estão todas ocupadas: não há porta para o HTTPS."; false; }
# a porta 80 (se estiver livre) só serve para levar quem escreve http://… ao endereço certo
PORTA_HTTP=80; if escuta 80; then PORTA_HTTP=""; echo "    a porta 80 está ocupada — fica como está (escreve-se o endereço completo)"; fi
for p in 8085 $PORTA_API $PORTA_BD; do
  if escuta "$p"; then
    # numa actualização, o próprio PostgreSQL do sistema pode estar a usar a sua porta
    if (( ATUALIZAR )) && [[ $p == "$PORTA_BD" ]]; then continue; fi
    echo "A porta $p já está ocupada:"; ss -ltnp 2>/dev/null | grep -E "[:.]$p " || true; false
  fi
done
ok "HTTPS na porta $PORTA_WEB${PORTA_HTTP:+ (e 80 para encaminhar)}; 8085, $PORTA_API e $PORTA_BD livres"

# o sistema abre-se só pelo nome (nunca pelo IP)
DOMINIO="${ESG_ENDERECO:-esg.emfaa.gov.ao}"
ENDERECO="$DOMINIO"
URL="https://$ENDERECO"; [[ "$PORTA_WEB" == 443 ]] || URL="https://$ENDERECO:$PORTA_WEB"
ORIGENS="https://$ENDERECO"; [[ "$URL" == "$ORIGENS" ]] || ORIGENS="$ORIGENS,$URL"
IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
# configuração (só na primeira instalação)
if (( ! ATUALIZAR )); then
  # a conta de administrador do sistema: o nome, o e-mail com que entra e a palavra-passe (escolhida ou gerada)
  ADMIN_NOME="${ESG_ADMIN_NOME:-}"; ADMIN_EMAIL="${ESG_ADMIN_EMAIL:-}"; ADMIN_SENHA=""; SENHA_ESCOLHIDA=0
  if [[ -t 0 ]]; then
    echo; echo "CONTA DE ADMINISTRADOR DO SISTEMA (entra com o e-mail e a palavra-passe)"
    [[ -n "$ADMIN_NOME" ]] || read -r -p "  Nome [Administrador do Pessoal]: " ADMIN_NOME || true
    if [[ -z "$ADMIN_EMAIL" ]]; then
      while :; do
        read -r -p "  E-mail [pessoal@esgfaa.gov.ao]: " ADMIN_EMAIL || true
        ADMIN_EMAIL="$(echo "${ADMIN_EMAIL:-pessoal@esgfaa.gov.ao}" | tr '[:upper:]' '[:lower:]' | tr -d ' ')"
        [[ "$ADMIN_EMAIL" =~ ^[^@]+@[^@]+\.[^@]+$ ]] && break
        echo "  E-mail inválido."
      done
      echo "  Palavra-passe: pelo menos 10 caracteres, com letras e números (sem espaços, aspas nem #)."
      echo "  Deixe em branco para o instalador gerar uma (mostrada no fim)."
      while :; do
        read -r -s -p "  Palavra-passe: " A || true; echo
        [[ -z "$A" ]] && break
        if (( ${#A} < 10 )); then echo "  Tem de ter pelo menos 10 caracteres."; continue; fi
        if ! [[ "$A" =~ [a-zA-Z] && "$A" =~ [0-9] ]]; then echo "  Tem de ter letras e números."; continue; fi
        if [[ "$A" =~ [[:space:]\"\'#\\\$\`] ]]; then echo "  Sem espaços, aspas, #, \$, \` nem \\."; continue; fi
        if [[ "${A,,}" == *"${ADMIN_EMAIL%%@*}"* ]]; then echo "  Não pode conter o nome do e-mail."; continue; fi
        read -r -s -p "  Repita a palavra-passe: " B || true; echo
        [[ "$A" == "$B" ]] || { echo "  Não são iguais. Escreva outra vez."; continue; }
        ADMIN_SENHA="$A"; SENHA_ESCOLHIDA=1; break
      done
      unset A B
    fi
  fi
  ADMIN_NOME="$(echo "${ADMIN_NOME:-Administrador do Pessoal}" | tr -d '"\\$`')"
  ADMIN_EMAIL="${ADMIN_EMAIL:-pessoal@esgfaa.gov.ao}"
  BI_API_KEY="${ESG_BI_API_KEY:-}"
fi

passo copiar "A instalar os componentes (Node.js, PostgreSQL, Caddy) em $DESTINO"
id "$UTILIZADOR" >/dev/null 2>&1 || useradd --system --home-dir "$DADOS" --shell /usr/sbin/nologin "$UTILIZADOR"
mkdir -p "$DESTINO" "$DADOS"/{bd,dados,copias} "$CONF"
rm -rf "$DESTINO/node" "$DESTINO/postgresql" "$DESTINO/caddy" "$DESTINO/sistema.novo"
mkdir -p "$DESTINO/node" "$DESTINO/postgresql" "$DESTINO/caddy"
tar -xzf "$PEN/componentes/node-linux.tar.gz" -C "$DESTINO/node" --strip-components=1
tar -xzf "$PEN/componentes/postgresql-linux.tar.gz" -C "$DESTINO/postgresql" --strip-components=1
# bibliotecas que um Linux mínimo pode não ter (libxml2, readline, kerberos): só para os programas do PostgreSQL
mkdir -p "$DESTINO/postgresql/lib-extra"
tar -xzf "$PEN/componentes/postgresql-linux-bibliotecas.tar.gz" -C "$DESTINO/postgresql/lib-extra"
tar -xzf "$PEN/componentes/caddy-linux.tar.gz" -C "$DESTINO/caddy" caddy
cp -a "$PEN/sistema" "$DESTINO/sistema.novo"
rm -rf "$DESTINO/sistema.anterior"; [[ -d "$DESTINO/sistema" ]] && mv "$DESTINO/sistema" "$DESTINO/sistema.anterior"
mv "$DESTINO/sistema.novo" "$DESTINO/sistema"
NODE="$DESTINO/node/bin/node"
PGBIN="$DESTINO/postgresql/bin"
export LD_LIBRARY_PATH="$DESTINO/postgresql/lib-extra"
"$NODE" -v
"$PGBIN/postgres" --version
"$DESTINO/caddy/caddy" version
chown -R "$UTILIZADOR:$UTILIZADOR" "$DADOS"
chmod 700 "$DADOS"
ok "componentes no lugar"

if (( ! ATUALIZAR )); then
  BD_SENHA="$(aleatorio 40)"
  umask 077
  cat > "$CONF/pessoal.env" <<EOF
# Sistema de Gestão de Pessoal e Quadros — criado pelo instalador em $(date '+%Y-%m-%d %H:%M')
# GUARDE UMA CÓPIA DESTE FICHEIRO NUM COFRE: sem DADOS_CHAVE os dados pessoais não se lêem; sem COPIAS_CHAVE as cópias não abrem.
NODE_ENV=production
HOST=127.0.0.1
PORT=$PORTA_API
TRUST_PROXY=1
ENDERECO=$ENDERECO
PORTA_WEB=$PORTA_WEB
CORS_ORIGINS=$ORIGENS
DATABASE_URL=postgresql://pessoal:$BD_SENHA@127.0.0.1:$PORTA_BD/esgfaa_pessoal
BD_SENHA=$BD_SENHA
JWT_SECRET=$(aleatorio 64)
DADOS_CHAVE=$(aleatorio 64)
COPIAS_CHAVE=$(aleatorio 64)
ADMIN_NOME="$ADMIN_NOME"
ADMIN_EMAIL=$ADMIN_EMAIL
ADMIN_PASSWORD=${ADMIN_SENHA:-$(senha)}
REDES_INTERNAS=127.0.0.1/32,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16
APP_DIR=$DESTINO/sistema/app
DATA_DIR=$DADOS/dados
PESSOAL_DATABASE_URL=postgresql://pessoal:$BD_SENHA@127.0.0.1:$PORTA_BD/esgfaa_pessoal
PESSOAL_DADOS=$DADOS/dados
COPIAS_DIR=$DADOS/copias
BI_API_KEY=$BI_API_KEY
PORTAL_API_URL=
INTEGRACAO_CHAVE=
EOF
  umask 022
  chown root:"$UTILIZADOR" "$CONF/pessoal.env"; chmod 640 "$CONF/pessoal.env"
fi
# numa actualização de uma instalação antiga (aberta pelo IP), passa a ser pelo nome
sed -i "s|^ENDERECO=.*|ENDERECO=$DOMINIO|; s|^CORS_ORIGINS=.*|CORS_ORIGINS=$ORIGENS|; s|^PORTA_WEB=.*|PORTA_WEB=$PORTA_WEB|" "$CONF/pessoal.env"
grep -q '^PORTA_WEB=' "$CONF/pessoal.env" || echo "PORTA_WEB=$PORTA_WEB" >> "$CONF/pessoal.env"
# a chave da consulta do BI (base de dados do Estado) não vai no pendrive: pede-se enquanto não houver
if ! grep -q '^BI_API_KEY=.' "$CONF/pessoal.env"; then
  CHAVE_BI="${ESG_BI_API_KEY:-}"
  # o pendrive preparado com --chave-bi traz a chave
  [[ -z "$CHAVE_BI" && -f "$PEN/chave-bi.txt" ]] && CHAVE_BI="$(head -n 1 "$PEN/chave-bi.txt")"
  if [[ -z "$CHAVE_BI" && -z "${ESG_ADMIN_EMAIL:-}" && -t 0 ]]; then
    echo; echo "CONSULTA DO BI (base de dados do Estado; o servidor precisa de acesso à internet)"
    read -r -s -p "  Chave (BI_API_KEY; Enter = sem consulta, pode indicar noutra actualização): " CHAVE_BI || true; echo
  fi
  CHAVE_BI="$(printf '%s' "$CHAVE_BI" | tr -d '[:space:]')"
  if [[ -n "$CHAVE_BI" ]]; then sed -i '/^BI_API_KEY=/d' "$CONF/pessoal.env"; echo "BI_API_KEY=$CHAVE_BI" >> "$CONF/pessoal.env"; ok "chave da consulta do BI guardada"; fi
  unset CHAVE_BI
fi
# shellcheck disable=SC1091
set -a; . "$CONF/pessoal.env"; set +a

passo bd "A preparar a base de dados (PostgreSQL na porta $PORTA_BD, só nesta máquina)"
como() { if command -v runuser >/dev/null; then runuser -u "$UTILIZADOR" -- "$@"; else su -s /bin/sh "$UTILIZADOR" -c "$(printf '%q ' "$@")"; fi; }
if [[ ! -f "$DADOS/bd/PG_VERSION" ]]; then
  printf '%s\n' "$BD_SENHA" > "$DADOS/.pw"; chown "$UTILIZADOR" "$DADOS/.pw"; chmod 600 "$DADOS/.pw"
  como "$PGBIN/initdb" -D "$DADOS/bd" -U pessoal --pwfile="$DADOS/.pw" -E UTF8 --locale=C.UTF-8 --auth=scram-sha-256 || como "$PGBIN/initdb" -D "$DADOS/bd" -U pessoal --pwfile="$DADOS/.pw" -E UTF8 --no-locale --auth=scram-sha-256
  rm -f "$DADOS/.pw"
  cat >> "$DADOS/bd/postgresql.conf" <<EOF
listen_addresses = '127.0.0.1'
port = $PORTA_BD
unix_socket_directories = '$DADOS'
EOF
fi
servico() { # nome, descrição, comando, extra
  cat > "/etc/systemd/system/$1.service" <<EOF
[Unit]
Description=$2
After=network.target ${5:-}
${5:+Requires=$5}

[Service]
User=$UTILIZADOR
EnvironmentFile=$CONF/pessoal.env
WorkingDirectory=$DESTINO/sistema
ExecStart=$3
Restart=always
RestartSec=5
$4

[Install]
WantedBy=multi-user.target
EOF
}
if (( SYSTEMD )); then
  servico esg-pessoal-bd "ESG Pessoal — base de dados (PostgreSQL)" "$PGBIN/postgres -D $DADOS/bd" "TimeoutStartSec=120
Environment=LD_LIBRARY_PATH=$DESTINO/postgresql/lib-extra"
  systemctl daemon-reload
  systemctl enable --now esg-pessoal-bd
else
  como env LD_LIBRARY_PATH="$LD_LIBRARY_PATH" "$PGBIN/pg_ctl" -D "$DADOS/bd" -l "$DADOS/bd.log" -w start || true
fi
for i in $(seq 1 60); do "$PGBIN/pg_isready" -h 127.0.0.1 -p $PORTA_BD -q && break; sleep 1; done
"$PGBIN/pg_isready" -h 127.0.0.1 -p $PORTA_BD
export PGPASSWORD="$BD_SENHA"
if ! "$PGBIN/psql" -h 127.0.0.1 -p $PORTA_BD -U pessoal -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='esgfaa_pessoal'" | grep -q 1; then
  "$PGBIN/createdb" -h 127.0.0.1 -p $PORTA_BD -U pessoal esgfaa_pessoal
fi
ok "base de dados pronta"

passo migrar "A criar/actualizar as tabelas"
cd "$DESTINO/sistema"
"$NODE" scripts/migrar.js

passo organica "A carregar o Quadro Orgânico (unidades e cargos)"
"$NODE" scripts/instalar-organica.js "$DESTINO/sistema/organica.json"

passo servicos "A ligar os serviços (sistema, HTTPS e cópias de segurança diárias)"
cat > "$CONF/Caddyfile" <<EOF
# HTTPS com a autoridade interna do Caddy (o certificado da raiz instala-se nos computadores da Repartição)
# só se abre por $URL: pelo IP (ou outro nome) a ligação é recusada
{
	storage file_system $DADOS/caddy
	skip_install_trust
	https_port $PORTA_WEB
	# o encaminhamento do http:// faz-se abaixo (para a porta certa do HTTPS)
	auto_https disable_redirects
}
$ENDERECO {
	tls internal
	encode zstd gzip
	header {
		Strict-Transport-Security "max-age=31536000"
		X-Content-Type-Options nosniff
		Referrer-Policy no-referrer
		X-Frame-Options DENY
		-Server
	}
	reverse_proxy 127.0.0.1:$PORTA_API
}

$( [[ -n "$PORTA_HTTP" ]] && printf 'http://%s {\n\tredir %s{uri} permanent\n}\n\nhttp:// {\n\tabort\n}\n' "$ENDERECO" "$URL" )

# aparelhos de ponto (impressão digital): só /iclock (os aparelhos ligam-se pelo IP)
:8085 {
	@ponto path /iclock/*
	reverse_proxy @ponto 127.0.0.1:$PORTA_API
	respond 404
}
EOF
chown -R "$UTILIZADOR:$UTILIZADOR" "$DADOS"
# este computador encontra o nome sem esperar pelo DNS da Escola
# (reescreve-se no lugar: o /etc/hosts pode ser uma ligação ou estar montado)
H="$(grep -v '# esg-pessoal$' /etc/hosts || true)"; printf '%s\n127.0.0.1 %s # esg-pessoal\n' "$H" "$ENDERECO" > /etc/hosts
if (( SYSTEMD )); then
  servico esg-pessoal "ESG Pessoal — sistema" "$NODE src/servidor.js" "" esg-pessoal-bd.service
  servico esg-pessoal-web "ESG Pessoal — HTTPS (Caddy)" "$DESTINO/caddy/caddy run --config $CONF/Caddyfile --adapter caddyfile" "AmbientCapabilities=CAP_NET_BIND_SERVICE
Environment=HOME=$DADOS XDG_DATA_HOME=$DADOS XDG_CONFIG_HOME=$DADOS" esg-pessoal.service
  servico esg-pessoal-copias "ESG Pessoal — cópias de segurança diárias" "$NODE scripts/copias.mjs agendar --sistema pessoal" "Environment=PATH=$PGBIN:/usr/bin:/bin TZ=Africa/Luanda LD_LIBRARY_PATH=$DESTINO/postgresql/lib-extra" esg-pessoal-bd.service
  systemctl daemon-reload
  systemctl enable esg-pessoal esg-pessoal-web esg-pessoal-copias
  systemctl restart esg-pessoal esg-pessoal-web esg-pessoal-copias
else
  ( cd "$DESTINO/sistema" && como env PATH="$PGBIN:$PATH" "$NODE" --env-file="$CONF/pessoal.env" src/servidor.js >> "$DADOS/sistema.log" 2>&1 & )
  ( como env HOME="$DADOS" XDG_DATA_HOME="$DADOS" "$DESTINO/caddy/caddy" run --config "$CONF/Caddyfile" --adapter caddyfile >> "$DADOS/caddy.log" 2>&1 & )
fi
# a firewall (se houver): HTTPS e os aparelhos de ponto
if command -v ufw >/dev/null && ufw status | grep -q active; then ufw allow "$PORTA_WEB/tcp" >/dev/null; ufw allow 8085/tcp >/dev/null; [[ -n "$PORTA_HTTP" ]] && ufw allow 80/tcp >/dev/null; ok "firewall (ufw): $PORTA_WEB e 8085 abertas"; fi
if command -v firewall-cmd >/dev/null && firewall-cmd --state >/dev/null 2>&1; then firewall-cmd --permanent --add-port="$PORTA_WEB/tcp" --add-port=8085/tcp ${PORTA_HTTP:+--add-port=80/tcp} >/dev/null && firewall-cmd --reload >/dev/null; ok "firewall: $PORTA_WEB e 8085 abertas"; fi
ok "serviços ligados"

passo verificar "A verificar se o sistema responde"
RESPOSTA=""
for i in $(seq 1 60); do
  RESPOSTA="$("$NODE" -e "fetch('http://127.0.0.1:$PORTA_API/api/saude').then(r=>r.text()).then(t=>console.log(t)).catch(()=>{})" 2>/dev/null || true)"
  [[ "$RESPOSTA" == *'"ok":true'* ]] && break
  sleep 2
done
[[ "$RESPOSTA" == *'"ok":true'* ]] || { echo "O sistema não respondeu em http://127.0.0.1:$PORTA_API/api/saude"; (( SYSTEMD )) && journalctl -u esg-pessoal -n 40 --no-pager; false; }
ok "o sistema responde"
for i in $(seq 1 30); do [[ -f "$DADOS/caddy/pki/authorities/local/root.crt" ]] && break; sleep 1; done
mkdir -p "$DESTINO/certificado"
cp "$DADOS/caddy/pki/authorities/local/root.crt" "$DESTINO/certificado/esg-pessoal-raiz.crt" 2>/dev/null && cp "$DESTINO/certificado/esg-pessoal-raiz.crt" "$PEN/registos/esg-pessoal-raiz.crt" 2>/dev/null || true
# para preparar os outros computadores (PREPARAR-COMPUTADOR-*): o nome e o IP deste servidor
printf '%s %s %s\n' "$IP" "$ENDERECO" "$URL" > "$PEN/registos/servidor.txt" 2>/dev/null || true
# ver o HTTPS de fora do processo
curl -fsk --resolve "$ENDERECO:$PORTA_WEB:127.0.0.1" "$URL/api/saude" >/dev/null 2>&1 && ok "HTTPS a responder em $URL" || echo "    (aviso: o HTTPS ainda não respondeu; pode demorar uns segundos a criar o certificado)"

# a palavra-passe inicial já criou o administrador: não fica no ficheiro de configuração
sed -i 's/^ADMIN_PASSWORD=.*/ADMIN_PASSWORD=/' "$CONF/pessoal.env"

RESUMO="$DESTINO/INSTALACAO.txt"
{
  echo "SISTEMA DE GESTÃO DE PESSOAL E QUADROS — instalado em $(date '+%Y-%m-%d %H:%M')"
  echo
  echo "Endereço:            $URL   (pelo IP não abre)"
  echo "No DNS da Escola:     $ENDERECO  →  ${IP:-<IP deste computador>}   (registo A; peça ao responsável pela rede)"
  echo "                      Enquanto não houver, em cada computador corra PREPARAR-COMPUTADOR-WINDOWS.bat (ou -LINUX.sh) do pendrive."
  echo "Administrador:       $ADMIN_EMAIL"
  if (( ${SENHA_ESCOLHIDA:-0} )); then echo "Palavra-passe:       a que escolheu na instalação   (na primeira entrada pede a verificação em dois passos)"
  elif [[ -n "${ADMIN_PASSWORD:-}" ]]; then echo "Palavra-passe inicial: $ADMIN_PASSWORD   (na primeira entrada pede a verificação em dois passos)"; fi
  echo
  echo "Certificado (instale nos computadores da Repartição para o navegador confiar):"
  echo "   $DESTINO/certificado/esg-pessoal-raiz.crt   (cópia no pendrive: registos/esg-pessoal-raiz.crt)"
  echo "Configuração e chaves: $CONF/pessoal.env  — GUARDE UMA CÓPIA NUM COFRE (fora deste computador)"
  echo "Cópias de segurança:   $DADOS/copias (todos os dias às 2h)"
  echo "Serviços:              systemctl status esg-pessoal esg-pessoal-bd esg-pessoal-web esg-pessoal-copias"
} > "$RESUMO"
chmod 600 "$RESUMO"
cp "$RESUMO" "$REG/INSTALACAO-CONCLUIDA-$CARIMBO.txt" 2>/dev/null && sed -i '/Palavra-passe inicial/d' "$REG/INSTALACAO-CONCLUIDA-$CARIMBO.txt" || true

echo "Instalação concluída."
# o resumo vai directo ao ecrã (não para o registo no pendrive): a palavra-passe não fica escrita no pendrive
SAIDA=/dev/tty; { : > /dev/tty; } 2>/dev/null || SAIDA=/dev/stderr
{
  echo
  echo "=============================================================="
  cat "$RESUMO"
  echo "=============================================================="
  echo "O resumo (com a palavra-passe) fica em $RESUMO — só o root o lê."
} > "$SAIDA"
