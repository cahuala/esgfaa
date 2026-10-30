#!/bin/bash
# Servidor de testes, a partir do computador de desenvolvimento (só dados de demonstração):
#   ./deploy/teste.sh primeira   envia o código, cria as chaves, copia as bases e os ficheiros de
#                                demonstração, dá palavras-passe novas às contas e arranca
#   ./deploy/teste.sh            envia o código e actualiza (as bases do servidor ficam como estão)
# Variáveis: TESTE_HOST (deploy@31.187.74.51), TESTE_KEY (~/.ssh/contabo_noove), TESTE_DIR (esgfaa-teste),
# DOMINIO (esg.imnoove.com), DOMINIO_PESSOAL (pessoal-esg.imnoove.com), ADMIN_PATH (painel-esg),
# LOCAL_PG (contentor do PostgreSQL de desenvolvimento: esgfaa-postgres).
set -euo pipefail
HOST=${TESTE_HOST:-deploy@31.187.74.51}; KEY=${TESTE_KEY:-$HOME/.ssh/contabo_noove}; DIR=${TESTE_DIR:-esgfaa-teste}
DOMINIO=${DOMINIO:-esg.imnoove.com}; DOMINIO_PESSOAL=${DOMINIO_PESSOAL:-pessoal-esg.imnoove.com}; ADMIN_PATH=${ADMIN_PATH:-painel-esg}
LOCAL_PG=${LOCAL_PG:-esgfaa-postgres}
SSH=(ssh -i "$KEY" -o IdentitiesOnly=yes)
RAIZ=$(cd "$(dirname "$0")/.." && pwd)
C="docker compose -f deploy/docker-compose.teste.yml --env-file deploy/teste.env"
remoto() { "${SSH[@]}" "$HOST" "cd $DIR && $*"; }

echo "→ código para $HOST:$DIR"
"${SSH[@]}" "$HOST" "mkdir -p $DIR"
# nunca vão: segredos, contas, dados locais, documentos internos (planos e quadro orgânico), o kit pago
rsync -az --delete -e "${SSH[*]}" \
  --exclude node_modules --exclude .git --exclude '/dist' --exclude '/dist-pessoal' --exclude coverage \
  --exclude test-results --exclude playwright-report --exclude 'api/dados' --exclude 'api-pessoal/dados' \
  --exclude '.env' --exclude '*.env' --exclude 'CONTAS-*.md' --exclude 'docs/PLANOS*' --exclude 'docs/QUADRO*' \
  --exclude 'color_admin_v5.5.2' --exclude '/copias' --exclude '*.esgc' --exclude '*.esgc.json' --exclude '.DS_Store' \
  "$RAIZ/" "$HOST:$DIR/"

if [ "${1:-}" = primeira ]; then
  echo "→ chaves (deploy/teste.env no servidor, só lá)"
  # os dados de demonstração vêm cifrados com as chaves de desenvolvimento: o teste usa as mesmas
  DADOS=$(node -e "console.log(require('crypto').createHash('sha256').update('portal-desenvolvimento-dados').digest('hex'))")
  DADOS_P=$(node -e "console.log(require('crypto').createHash('sha256').update('pessoal-desenvolvimento-dados').digest('hex'))")
  remoto "test -f deploy/teste.env || { umask 077; cat > deploy/teste.env <<EOF
DOMINIO=$DOMINIO
DOMINIO_PESSOAL=$DOMINIO_PESSOAL
ADMIN_PATH=$ADMIN_PATH
BD_SENHA=\$(openssl rand -hex 24)
BD_PESSOAL_SENHA=\$(openssl rand -hex 24)
JWT_SECRET=\$(openssl rand -hex 32)
JWT_SECRET_PESSOAL=\$(openssl rand -hex 32)
INTEGRACAO_CHAVE=\$(openssl rand -hex 32)
DADOS_CHAVE=$DADOS
DADOS_CHAVE_PESSOAL=$DADOS_P
EOF
}"
  echo "→ bases de dados"
  remoto "$C up -d --wait bd bd-pessoal"
  # bases novas e vazias: as tabelas, as migrações já aplicadas e os dados de demonstração
  docker exec "$LOCAL_PG" pg_dump -U esgfaa -d esgfaa -Fc --no-owner --no-privileges | remoto "$C exec -T bd pg_restore -U esgfaa -d esgfaa --no-owner --no-privileges --exit-on-error"
  docker exec "$LOCAL_PG" pg_dump -U esgfaa -d esgfaa_pessoal -Fc --no-owner --no-privileges | remoto "$C exec -T bd-pessoal pg_restore -U pessoal -d esgfaa_pessoal --no-owner --no-privileges --exit-on-error"
  echo "→ ficheiros de demonstração (fotografias, documentos, capas…)"
  # os volumes dos ficheiros nascem com os contentores (sem os arrancar ainda)
  remoto "$C build && $C create"
  ( cd "$RAIZ/api/dados" && tar -c --exclude 'esgfaa.sqlite*' . ) | remoto "docker run --rm -i -v esgteste_dados:/d alpine tar -x -C /d"
  ( cd "$RAIZ/api-pessoal/dados" && tar -c . ) | remoto "docker run --rm -i -v esgteste_dados-pessoal:/d alpine tar -x -C /d"
  echo "→ palavras-passe novas (ficam em CONTAS-SERVIDOR-TESTE.md, neste computador)"
  node "$RAIZ/deploy/teste-contas.mjs" portal | remoto "$C exec -T bd psql -q -v ON_ERROR_STOP=1 -U esgfaa -d esgfaa"
  node "$RAIZ/deploy/teste-contas.mjs" pessoal | remoto "$C exec -T bd-pessoal psql -q -v ON_ERROR_STOP=1 -U pessoal -d esgfaa_pessoal"
fi

# a chave das cópias de segurança diárias (gerada uma vez, só no servidor)
remoto "grep -q '^COPIAS_CHAVE=' deploy/teste.env || echo \"COPIAS_CHAVE=\$(openssl rand -hex 32)\" >> deploy/teste.env"

echo "→ arrancar"
remoto "$C up -d --build && $C ps"
