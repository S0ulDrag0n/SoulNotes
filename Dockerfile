# syntax=docker/dockerfile:1

FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create data directory for config mounts
RUN mkdir -p /app/data

COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY config.example.yml ./config.example.yml

RUN addgroup -S nextjs && adduser -S nextjs -G nextjs
# Give nextjs user access to data directory
RUN chown -R nextjs:nextjs /app/data
USER nextjs

EXPOSE 3000

# Config file can be mounted to:
# - /app/config.yml (root of app)
# - /app/data/config.yml (data directory)
# Example: docker run -v ./config.yml:/app/config.yml soulnotes
CMD ["npm", "run", "start"]