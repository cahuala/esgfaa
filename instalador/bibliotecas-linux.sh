#!/usr/bin/env bash
# Recolhe as bibliotecas de que o PostgreSQL portátil precisa e que um Linux mínimo pode não ter
# (libxml2, readline, gssapi/kerberos e as suas dependências), a partir de um Ubuntu 22.04 (a base mais antiga
# suportada: servem também nas mais novas). Precisa do Docker e de internet; corre só ao preparar o pendrive.
#   bash instalador/bibliotecas-linux.sh <postgresql-linux.tar.gz> <saída.tar.gz>
set -euo pipefail
PG="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
SAIDA="$(cd "$(dirname "$2")" && pwd)/$(basename "$2")"
docker run --rm --platform linux/amd64 -v "$PG:/pg.tar.gz:ro" -v "$(dirname "$SAIDA"):/saida" ubuntu:22.04 bash -euc '
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq >/dev/null
  apt-get install -y -qq --no-install-recommends libxml2 libreadline8 libgssapi-krb5-2 >/dev/null
  mkdir -p /pg /libs && tar -xzf /pg.tar.gz -C /pg --strip-components=1
  # as que faltam ao PostgreSQL e as delas, tirando as do próprio sistema (glibc), que já existem em qualquer Linux
  for b in /pg/bin/* /pg/lib/*.so*; do ldd "$b" 2>/dev/null || true; done | awk "/=> \// {print \$3}" | sort -u \
    | grep -vE "/(libc|libm|libpthread|libdl|librt|ld-linux-x86-64|libresolv|libutil)\.so" \
    | grep -E "lib(xml2|icu[a-z]*|readline|gssapi_krb5|krb5|k5crypto|krb5support|com_err|keyutils|lzma)\.so" \
    | while read -r f; do cp -L "$f" /libs/; done
  ls /libs
  tar -czf "/saida/$(basename '"$SAIDA"')" -C /libs .
'
echo "Bibliotecas em $SAIDA"
