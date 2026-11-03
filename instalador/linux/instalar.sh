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
    portas) echo "- Outro programa está a usar uma porta de que o sistema precisa (443 para o HTTPS, 8085 para os aparelhos de ponto, $PORTA_BD, $PORTA_API)."
            echo "- Veja qual com: ss -ltnp | grep -E ':(443|8085|$PORTA_BD|$PORTA_API) '  e pare-o (ou desinstale), depois repita." ;;
    copiar) echo "- Não foi possível descompactar os componentes (Node.js, PostgreSQL, Caddy). Pendrive estragado ou disco cheio." ;;
    bd) echo "- O PostgreSQL não arrancou. Veja o fim deste registo e: journalctl -u esg-pessoal-bd -n 50"
        echo "- Causas comuns: biblioteca do sistema em falta (glibc antiga: use Ubuntu 22.04 ou mais recente), porta $PORTA_BD ocupada, disco cheio." ;;
    migrar) echo "- A base de dados não aceitou a estrutura do sistema. Veja a mensagem acima. Numa actualização: reponha a última cópia de segurança." ;;
    organica) echo "- O Quadro Orgânico (sistema/organica.json) tem uma linha que o sistema não aceita. O sistema fica instalado; carregue a orgânica depois em Orgânica › Importar." ;;
    servicos) echo "- Um serviço não arrancou. Veja: journalctl -u esg-pessoal -n 80  e  journalctl -u esg-pessoal-web -n 50" ;;
    verificar) echo "- O sistema não respondeu em https://localhost. Veja: journalctl -u esg-pessoal -n 80"
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
for p in 443 8085 $PORTA_API $PORTA_BD; do
  if escuta "$p"; then
    # numa actualização, o próprio PostgreSQL do sistema pode estar a usar a sua porta
    if (( ATUALIZAR )) && [[ $p == "$PORTA_BD" ]]; then continue; fi
    echo "A porta $p já está ocupada:"; ss -ltnp 2>/dev/null | grep -E "[:.]$p " || true; false
  fi
done
ok "443, 8085, $PORTA_API e $PORTA_BD livres"

# configuração (só na primeira instalação)
if (( ! ATUALIZAR )); then
  IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
  ENDERECO="${ESG_ENDERECO:-}"
  if [[ -z "$ENDERECO" && -t 0 ]]; then
    read -r -p "Endereço do sistema na rede da Escola (nome ou IP) [${IP:-localhost}]: " ENDERECO || true
  fi
  ENDERECO="${ENDERECO:-${IP:-localhost}}"
  ADMIN_EMAIL="${ESG_ADMIN_EMAIL:-}"
  if [[ -z "$ADMIN_EMAIL" && -t 0 ]]; then
    read -r -p "E-mail do administrador do sistema [pessoal@esgfaa.gov.ao]: " ADMIN_EMAIL || true
  fi
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
CORS_ORIGINS=https://$ENDERECO
DATABASE_URL=postgresql://pessoal:$BD_SENHA@127.0.0.1:$PORTA_BD/esgfaa_pessoal
BD_SENHA=$BD_SENHA
JWT_SECRET=$(aleatorio 64)
DADOS_CHAVE=$(aleatorio 64)
COPIAS_CHAVE=$(aleatorio 64)
ADMIN_EMAIL=$ADMIN_EMAIL
ADMIN_PASSWORD=$(senha)
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
SITES="$ENDERECO, localhost"; [[ "$ENDERECO" == "localhost" ]] && SITES="localhost"
cat > "$CONF/Caddyfile" <<EOF
# HTTPS com a autoridade interna do Caddy (o certificado da raiz instala-se nos computadores da Repartição)
{
	storage file_system $DADOS/caddy
	skip_install_trust
}
$SITES {
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

# aparelhos de ponto (impressão digital): só /iclock
:8085 {
	@ponto path /iclock/*
	reverse_proxy @ponto 127.0.0.1:$PORTA_API
	respond 404
}
EOF
chown -R "$UTILIZADOR:$UTILIZADOR" "$DADOS"
if (( SYSTEMD )); then
  servico esg-pessoal "ESG Pessoal — sistema" "$NODE src/servidor.js" "" esg-pessoal-bd.service
  servico esg-pessoal-web "ESG Pessoal — HTTPS (Caddy)" "$DESTINO/caddy/caddy run --config $CONF/Caddyfile --adapter caddyfile" "AmbientCapabilities=CAP_NET_BIND_SERVICE
Environment=HOME=$DADOS XDG_DATA_HOME=$DADOS XDG_CONFIG_HOME=$DADOS" esg-pessoal.service
  servico esg-pessoal-copias "ESG Pessoal — cópias de segurança diárias" "$NODE scripts/copias.mjs agendar --sistema pessoal" "Environment=PATH=$PGBIN:/usr/bin:/bin TZ=Africa/Luanda LD_LIBRARY_PATH=$DESTINO/postgresql/lib-extra" esg-pessoal-bd.service
  systemctl daemon-reload
  systemctl enable esg-pessoal esg-pessoal-web esg-pessoal-copias
  systemctl restart esg-pessoal esg-pessoal-web esg-pessoal-copias
else
  ( cd "$DESTINO/sistema" && como env PATH="$PGBIN:$PATH" $(grep -E '^[A-Z_]+=' "$CONF/pessoal.env" | tr '\n' ' ') "$NODE" src/servidor.js >> "$DADOS/sistema.log" 2>&1 & )
  ( como env HOME="$DADOS" XDG_DATA_HOME="$DADOS" "$DESTINO/caddy/caddy" run --config "$CONF/Caddyfile" --adapter caddyfile >> "$DADOS/caddy.log" 2>&1 & )
fi
# a firewall (se houver): HTTPS e os aparelhos de ponto
if command -v ufw >/dev/null && ufw status | grep -q active; then ufw allow 443/tcp >/dev/null; ufw allow 8085/tcp >/dev/null; ok "firewall (ufw): 443 e 8085 abertas"; fi
if command -v firewall-cmd >/dev/null && firewall-cmd --state >/dev/null 2>&1; then firewall-cmd --permanent --add-port=443/tcp --add-port=8085/tcp >/dev/null && firewall-cmd --reload >/dev/null; ok "firewall: 443 e 8085 abertas"; fi
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
# ver o HTTPS de fora do processo
curl -fsk "https://localhost/api/saude" >/dev/null 2>&1 && ok "HTTPS a responder" || echo "    (aviso: o HTTPS ainda não respondeu; pode demorar uns segundos a criar o certificado)"

# a palavra-passe inicial já criou o administrador: não fica no ficheiro de configuração
sed -i 's/^ADMIN_PASSWORD=.*/ADMIN_PASSWORD=/' "$CONF/pessoal.env"

RESUMO="$DESTINO/INSTALACAO.txt"
{
  echo "SISTEMA DE GESTÃO DE PESSOAL E QUADROS — instalado em $(date '+%Y-%m-%d %H:%M')"
  echo
  echo "Endereço:            https://$ENDERECO"
  echo "Administrador:       $ADMIN_EMAIL"
  if (( ! ATUALIZAR )); then echo "Palavra-passe inicial: $ADMIN_PASSWORD   (na primeira entrada pede a verificação em dois passos)"; fi
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
SAIDA=/dev/tty; [[ -w /dev/tty ]] || SAIDA=/dev/stderr
{
  echo
  echo "=============================================================="
  cat "$RESUMO"
  echo "=============================================================="
  echo "O resumo (com a palavra-passe) fica em $RESUMO — só o root o lê."
} > "$SAIDA"
