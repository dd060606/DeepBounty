FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY worker/package.json ./worker/package.json
COPY sdk/package.json ./sdk/package.json
COPY server/package.json ./server/package.json
COPY webapp/package.json ./webapp/package.json

RUN npm ci

COPY sdk ./sdk
COPY worker ./worker

RUN npm run -w sdk build
RUN npm run -w worker build


FROM node:22-alpine AS runner

# Install common tools used by task executions
RUN apk add --no-cache \
    bash \
    curl \
    jq \
    wget \
    unzip \
    zip \
    git \
    gcompat \
    ca-certificates \
    python3 \
    py3-pip \
    openjdk21

RUN ln -sf python3 /usr/bin/python
ENV PIP_BREAK_SYSTEM_PACKAGES=1

# Tools directory (downloaded binaries live here)
RUN mkdir -p /tools

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY worker/package.json ./worker/package.json
COPY sdk/package.json ./sdk/package.json
COPY server/package.json ./server/package.json
COPY webapp/package.json ./webapp/package.json

# Worker runtime deps only
RUN npm ci --omit=dev --workspace worker --workspace sdk

COPY --from=builder /app/worker/dist ./worker/dist

WORKDIR /app/worker

# Required env vars:
# - SERVER_WS_URL (e.g. ws://server:3000)
# - SERVER_SECRET_KEY (must match server config workerKey)
CMD ["node", "dist/src/worker.js"]
