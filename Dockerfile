# Stage 1: Build (needs devDependencies + native build tools)
FROM node:20-slim AS builder

RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: Production (lean image, still needs native bcrypt)
FROM node:20-slim

RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

# Copy built output (server bundle + client assets)
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/restore-db.mjs ./restore-db.mjs

EXPOSE 5000

CMD ["sh", "-c", "node restore-db.mjs && node dist/index.cjs"]
