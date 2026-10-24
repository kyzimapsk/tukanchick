# Сервер мультиплеера. Клиент раздаётся отдельно (GitHub Pages), поэтому статика выключена.
# Сборка из корня репозитория: docker compose -f server/docker-compose.yml up -d --build

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY tsconfig.json ./
COPY src ./src
COPY server ./server
RUN npm run server:build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production \
    PORT=5000 \
    STATIC_DIR=""
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund && npm cache clean --force
COPY --from=build /app/server/dist ./server/dist
COPY assets/*.info.json ./assets/
USER node
EXPOSE 5000
CMD ["node", "server/dist/server/src/index.js"]
