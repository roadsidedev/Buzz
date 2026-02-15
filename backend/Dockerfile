FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY backend/package*.json ./backend/

RUN npm ci && npm ci -w backend

COPY backend ./backend
COPY common ./common
COPY tsconfig.json ./

RUN npm run build -w backend

# Production image
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY backend/package*.json ./backend/

RUN npm ci --only=production && npm ci --only=production -w backend

COPY --from=builder /app/backend/dist ./backend/dist
COPY common ./common

EXPOSE 4000

HEALTHCHECK --interval=10s --timeout=5s --retries=5 \
  CMD node -e "require('http').get('http://localhost:4000/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

CMD ["node", "backend/dist/server.js"]
