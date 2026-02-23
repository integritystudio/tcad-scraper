# ============================================
# BullMQ Metrics Exporter Dockerfile
# Multi-stage build for TypeScript compilation
# ============================================

# --- Stage 1: Build ---
FROM node:20-alpine AS build

WORKDIR /app

# Copy package files and install all deps (including devDependencies for tsc)
COPY bullmq-exporter/package*.json ./
RUN npm install

# Copy TypeScript source
COPY shared/ /app/shared/
COPY bullmq-exporter/index.ts ./
COPY bullmq-exporter/tsconfig.json ./

# Compile TypeScript
RUN npx tsc

# --- Stage 2: Production ---
FROM node:20-alpine

WORKDIR /app

# Copy package files and install production deps only
COPY bullmq-exporter/package*.json ./
RUN npm install --only=production --omit=optional && \
    npm cache clean --force

# Copy compiled output from build stage
COPY --from=build /app/dist/ ./dist/

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Change ownership
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose metrics port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "import('node:http').then(h => h.default.get('http://localhost:3000/metrics', r => { process.exit(r.statusCode === 200 ? 0 : 1) }))"

# Start the exporter
CMD ["npm", "start"]
