FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies required for native modules (e.g., @sentry/profiling-node)
RUN apk add --no-cache python3 make g++

# Configure npm to avoid cache conflicts with Railway
RUN npm config set cache /tmp/.npm-cache --global

COPY package*.json ./
COPY backend/package*.json ./backend/
COPY common ./common

# Install dependencies for the whole workspace
RUN npm ci

COPY backend ./backend
COPY tsconfig.json ./

# Build the backend
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
COPY common ./common

# Install production dependencies
RUN npm ci --omit=dev

# Copy the built files from the builder stage
COPY --from=builder /app/backend/dist ./backend/dist

EXPOSE 4000

ENV NODE_ENV=production

# Railway handles healthcheck via railway.toml - disable Docker healthcheck to avoid conflicts
# HEALTHCHECK --interval=10s --timeout=30s --retries=5 \
#   CMD node -e "require('http').get('http://localhost:4000/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Start the server - tsx handles the transformed path aliases from tsc-alias
CMD ["node", "--import", "tsx", "backend/dist/backend/src/server.js"]
