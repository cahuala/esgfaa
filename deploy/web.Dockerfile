# Páginas da Escola (site, portal e painel) servidas pelo Caddy, com HTTPS automático.
# Construir a partir da raiz do repositório:  docker compose -f deploy/docker-compose.portal.yml build
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# a API fica no mesmo endereço das páginas (o Caddy encaminha /api): mesmo domínio, o modo mais seguro
ARG DOMINIO
ARG ADMIN_PATH
RUN VITE_API_URL="https://${DOMINIO}" npm run build \
  # o sistema de pessoal é só da rede interna: nunca vai para o servidor público
  && rm -rf dist/pessoal \
  # o painel fica num endereço reservado (ADMIN_PATH); sem ele, não é publicado
  && if echo "$ADMIN_PATH" | grep -Eq '^[a-z0-9-]{8,64}$'; then mv dist/admin "dist/$ADMIN_PATH"; else rm -rf dist/admin; fi

FROM caddy:2.8.4-alpine
COPY --from=build /app/dist /srv
COPY deploy/Caddyfile.portal /etc/caddy/Caddyfile
