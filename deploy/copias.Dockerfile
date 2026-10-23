# Cópias de segurança automáticas (scripts/copias.mjs agendar): uma por dia, cifradas, no volume «copias».
# Construir a partir da raiz do repositório (o docker compose faz isto sozinho).
FROM node:24-alpine
RUN apk add --no-cache postgresql17-client tar tzdata
WORKDIR /app
COPY scripts/copias.mjs scripts/copias.mjs
ENV TZ=Africa/Luanda COPIAS_DIR=/copias
CMD ["node", "scripts/copias.mjs", "agendar"]
