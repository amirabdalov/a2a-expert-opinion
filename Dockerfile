FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .
RUN npm run build

EXPOSE 5000

CMD ["sh", "-c", "node restore-db.mjs && node dist/index.cjs"]
