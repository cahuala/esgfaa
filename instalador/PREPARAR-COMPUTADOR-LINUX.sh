#!/usr/bin/env bash
# Prepara um computador Linux da Repartição para abrir o sistema: o nome do servidor (enquanto o DNS da Escola
# não o tiver) e o certificado HTTPS. Corra:  sudo bash PREPARAR-COMPUTADOR-LINUX.sh
set -euo pipefail
PEN="$(cd "$(dirname "$0")" && pwd)"
[[ $EUID -eq 0 ]] || exec sudo bash "$0" "$@"
CRT="$PEN/registos/esg-pessoal-raiz.crt"
[[ -f "$CRT" ]] || { echo "Falta registos/esg-pessoal-raiz.crt: instale primeiro o sistema no servidor com este pendrive."; exit 1; }
read -r IP NOME < "$PEN/registos/servidor.txt" 2>/dev/null || true
NOME="${NOME:-esg.emfaa.gov.ao}"
read -r -p "IP do servidor do sistema [${IP:-}]: " R || true
IP="${R:-${IP:-}}"
[[ "$IP" =~ ^[0-9]{1,3}(\.[0-9]{1,3}){3}$ ]] || { echo "IP inválido: $IP"; exit 1; }
H="$(grep -v '# esg-pessoal$' /etc/hosts || true)"; printf '%s\n%s %s # esg-pessoal\n' "$H" "$IP" "$NOME" > /etc/hosts
echo "[ok] $NOME -> $IP (/etc/hosts)"
if [[ -d /usr/local/share/ca-certificates ]]; then cp "$CRT" /usr/local/share/ca-certificates/esg-pessoal-raiz.crt && update-ca-certificates >/dev/null
elif [[ -d /etc/pki/ca-trust/source/anchors ]]; then cp "$CRT" /etc/pki/ca-trust/source/anchors/esg-pessoal-raiz.crt && update-ca-trust; fi
echo "[ok] certificado instalado no sistema (no Firefox e no Chrome: Definições › Certificados › Importar $CRT)"
echo "Pronto. Abra https://$NOME"
