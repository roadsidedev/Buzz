FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY frontend/package*.json ./frontend/

RUN npm ci && npm ci -w frontend

COPY frontend ./frontend
COPY common ./common
COPY tsconfig.json ./

RUN npm run build -w frontend

# Production image
FROM node:20-alpine

WORKDIR /app

RUN npm install -g serve

COPY --from=builder /app/frontend/dist ./dist

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --retries=5 \
  CMD wget --quiet --tries=1 --spider http://localhost:3000 || exit 1

CMD ["serve", "-s", "dist", "-l", "3000"]
