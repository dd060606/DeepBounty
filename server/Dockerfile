FROM node:22-bookworm-slim AS builder
WORKDIR /app

# Copy workspace manifests first
COPY package.json package-lock.json ./
COPY server/package.json ./server/package.json
COPY sdk/package.json ./sdk/package.json
COPY worker/package.json ./worker/package.json
COPY webapp/package.json ./webapp/package.json

# Install dependencies needed to build (includes dev deps)
RUN npm ci

# Copy sources
COPY sdk ./sdk
COPY server ./server

# Build SDK first (server depends on it)
RUN npm run -w sdk build

# Build server
RUN npm run -w server build


FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# Install production dependencies for the server + sdk only
COPY package.json package-lock.json ./
COPY server/package.json ./server/package.json
COPY sdk/package.json ./sdk/package.json
COPY worker/package.json ./worker/package.json
COPY webapp/package.json ./webapp/package.json
RUN npm ci --omit=dev --workspace server --workspace sdk

# Copy built artifacts and runtime assets
COPY --from=builder /app/sdk/dist ./sdk/dist
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/drizzle ./server/drizzle
COPY --from=builder /app/server/swagger.yml ./server/swagger.yml
COPY --from=builder /app/server/modules ./server/modules
COPY --from=builder /app/server/config ./server/config

WORKDIR /app/server
EXPOSE 3000

CMD ["node", "dist/src/server.js"]
