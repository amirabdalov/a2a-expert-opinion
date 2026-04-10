# Stage 1: Build (needs devDependencies)
FROM node:20-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: Production (lean image)
FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

# Copy built output (server bundle + client assets)
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/restore-db.mjs ./restore-db.mjs

EXPOSE 5000

CMD ["sh", "-c", "node restore-db.mjs && node dist/index.cjs"]
