# Construir a partir da raiz do repositório (a carga inicial lê src/data e src/assets do site):
#   docker build -f api/Dockerfile -t esgfaa-api .
#   docker run -p 3001:3001 -v esgfaa-dados:/app/api/dados --env-file api/.env esgfaa-api
FROM node:24-alpine
WORKDIR /app
COPY package.json ./
COPY src/data ./src/data
COPY src/assets ./src/assets
COPY api/package.json api/package-lock.json ./api/
RUN cd api && npm ci --omit=dev
COPY api ./api
WORKDIR /app/api
ENV NODE_ENV=production
EXPOSE 3001
VOLUME /app/api/dados
CMD ["node", "src/server.js"]
