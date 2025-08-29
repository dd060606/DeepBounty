FROM node:22-alpine

WORKDIR /app

# Install deps including dev (node-pg-migrate, ts, etc.)
COPY package*.json ./
RUN npm ci --no-audit --no-fund

# Copy only what we need to run migrations
COPY tsconfig.json ./tsconfig.json
COPY migrations ./migrations

# Default entrypoint to run migrations with TS support
ENTRYPOINT ["npx", "node-pg-migrate", "-j", "ts"]
CMD ["up"]
