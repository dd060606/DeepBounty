FROM node:22-bookworm-slim AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY webapp/package.json ./webapp/package.json
COPY sdk/package.json ./sdk/package.json
COPY server/package.json ./server/package.json
COPY worker/package.json ./worker/package.json

RUN npm ci

COPY sdk ./sdk
COPY webapp ./webapp

# Build SDK (webapp depends on it)
RUN npm run -w sdk build

# Build webapp with a configurable API base URL
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run -w webapp build


FROM nginx:1.27-alpine AS runner

# Nginx config serves SPA + proxies API to server
COPY webapp/nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=builder /app/webapp/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
