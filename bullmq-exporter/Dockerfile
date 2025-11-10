# ============================================
# BullMQ Metrics Exporter Dockerfile
# ============================================
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm install --only=production --omit=optional && \
    npm cache clean --force

# Copy application code
COPY index.js ./

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
    CMD node -e "require('http').get('http://localhost:3000/metrics', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the exporter
CMD ["npm", "start"]
