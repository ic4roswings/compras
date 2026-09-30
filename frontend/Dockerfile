# ── Etapa 1: compilar Angular ────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx ng build

# ── Etapa 2: servir con nginx ────────────────────────────
FROM nginx:stable-alpine
COPY --from=build /app/dist/compras/browser/ /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/default.conf
