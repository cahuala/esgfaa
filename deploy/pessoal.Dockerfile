# Sistema de Gestão de Pessoal (rede interna): a API serve também a página (dist/pessoal) no mesmo endereço.
# Construir a partir da raiz do repositório:  docker compose -f deploy/docker-compose.pessoal.yml build
FROM node:24-alpine AS pagina
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# a página fala com a API no mesmo endereço (VITE_PESSOAL_API vazio)
RUN VITE_PESSOAL_API= npm run build && node scripts/preparar-pessoal.mjs /app/dist-pessoal

FROM node:24-alpine
WORKDIR /app/api-pessoal
COPY api-pessoal/package.json api-pessoal/package-lock.json api-pessoal/prisma.config.js ./
COPY api-pessoal/prisma ./prisma
RUN npm ci --omit=dev
COPY api-pessoal/src ./src
COPY api-pessoal/scripts ./scripts
COPY --from=pagina /app/dist-pessoal ./app
ENV NODE_ENV=production HOST=0.0.0.0 APP_DIR=app
EXPOSE 3002
VOLUME /app/api-pessoal/dados
CMD ["npm", "start"]
