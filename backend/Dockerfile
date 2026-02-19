FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies required for native modules (e.g., @sentry/profiling-node)
RUN apk add --no-cache python3 make g++

# Configure npm to avoid cache conflicts with Railway
RUN npm config set cache /tmp/.npm-cache --global

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

# Install build dependencies for native modules that may be needed at runtime
RUN apk add --no-cache python3 make g++

# Configure npm to avoid cache conflicts with Railway
RUN npm config set cache /tmp/.npm-cache --global

COPY package*.json ./
COPY backend/package*.json ./backend/

RUN npm ci --omit=dev && npm ci --omit=dev -w backend

COPY --from=builder /app/backend/dist ./dist
COPY common ./common

EXPOSE 4000

HEALTHCHECK --interval=10s --timeout=5s --retries=5 \
  CMD node -e "require('http').get('http://localhost:4000/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

CMD ["node", "dist/backend/src/server.js"]
