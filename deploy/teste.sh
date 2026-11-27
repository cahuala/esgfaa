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
  --exclude 'docs/DOCENTES*' --exclude 'docs/ARQUIVO*' --exclude 'docs/formacao' --exclude 'docs/*.docx' --exclude '~$*' \
  --exclude 'instalador/pendrive' --exclude 'instalador/.cache' --exclude '__pycache__' \
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

# o portal recebe o Pessoal da Escola (dados reais): os dados não podem ficar com a chave de desenvolvimento, que
# está no código. Se o teste.env ainda a tiver, passa-se tudo para uma chave nova, gerada e guardada só no servidor
# (antes: cópia da base em copias/ e do teste.env em deploy/teste-antes-da-chave.env)
CHAVE_DEV=$(node -e "console.log(require('crypto').createHash('sha256').update('portal-desenvolvimento-dados').digest('hex'))")
if remoto "grep -qx 'DADOS_CHAVE=$CHAVE_DEV' deploy/teste.env"; then
  echo "→ chave nova para os dados pessoais do portal"
  remoto "set -e; mkdir -p copias; $C build api; $C stop api; \
    $C exec -T bd pg_dump -U esgfaa -d esgfaa -Fc > copias/portal-antes-da-chave-nova.dump; \
    cp deploy/teste.env deploy/teste-antes-da-chave.env; NOVA=\$(openssl rand -hex 32); \
    $C run --rm --no-deps -e DADOS_CHAVE_ANTIGA=$CHAVE_DEV -e DADOS_CHAVE=\$NOVA api node scripts/trocar-chave.js; \
    sed -i \"s/^DADOS_CHAVE=.*/DADOS_CHAVE=\$NOVA/\" deploy/teste.env"
fi

if [ "${1:-}" = primeira ]; then
  echo "→ arrancar"
  remoto "$C up -d --build && $C ps"
  exit 0
fi

# ---------- actualizar sem perder nada e quase sem sair do ar ----------
# 1) as imagens novas constroem-se com o sistema antigo a funcionar;
# 2) cópia das bases de dados antes de trocar (ficam as 5 últimas em copias/);
# 3) troca-se (só os segundos de arrancar) e confirma-se que responde pela internet;
# 4) se não responder em 3 minutos, volta sozinho às imagens anteriores (as bases ficam; a cópia está em copias/).
echo "→ construir as imagens novas (o sistema continua a funcionar)"
remoto "$C build api pessoal web"
echo "→ cópia de segurança das bases de dados"
CARIMBO=$(date +%Y%m%d-%H%M%S)
remoto "set -e; mkdir -p copias; umask 077; BD=\$(grep '^BD_NOME=' deploy/teste.env | cut -d= -f2); BD=\${BD:-esgfaa}; \
  $C exec -T bd pg_dump -U esgfaa -d \$BD -Fc > copias/antes-da-actualizacao-$CARIMBO-portal.dump; \
  $C exec -T bd-pessoal pg_dump -U pessoal -d esgfaa_pessoal -Fc > copias/antes-da-actualizacao-$CARIMBO-pessoal.dump; \
  test -s copias/antes-da-actualizacao-$CARIMBO-portal.dump && test -s copias/antes-da-actualizacao-$CARIMBO-pessoal.dump; \
  ls -t copias/antes-da-actualizacao-*-portal.dump | tail -n +6 | xargs -r rm --; ls -t copias/antes-da-actualizacao-*-pessoal.dump | tail -n +6 | xargs -r rm --"
echo "→ trocar"
# as imagens que estão a correr (para voltar atrás, se for preciso)
ANTES=$(remoto "for s in api pessoal web; do id=\$($C ps -q \$s); [ -n \"\$id\" ] && echo \"\$s=\$(docker inspect --format '{{.Image}}' \$id)\"; done" || true)
remoto "$C up -d --no-build && $C ps"
echo "→ confirmar que responde (https://$DOMINIO e https://$DOMINIO_PESSOAL)"
ok=0
for i in $(seq 1 36); do
  if remoto "curl -fsS -m 5 https://$DOMINIO/api/saude >/dev/null && curl -fsS -m 5 https://$DOMINIO_PESSOAL/api/saude >/dev/null"; then ok=1; break; fi
  sleep 5
done
if [ "$ok" = 1 ]; then
  echo "✓ actualizado e a responder (cópia das bases: copias/antes-da-actualizacao-$CARIMBO-*.dump no servidor)"
  exit 0
fi
echo "✗ o sistema novo não respondeu em 3 minutos: a voltar às imagens anteriores" >&2
for linha in $ANTES; do
  s=${linha%%=*}; img=${linha#*=}
  remoto "docker tag $img esgteste-$s:latest"
done
remoto "$C up -d --no-build && $C ps"
echo "Voltou à versão anterior. As bases não se mexeram; se for preciso, a cópia de antes está em copias/antes-da-actualizacao-$CARIMBO-*.dump." >&2
exit 1
