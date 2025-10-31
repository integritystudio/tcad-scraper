FROM node:18-alpine3.19

# Install Playwright dependencies and OpenSSL for Prisma
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    openssl \
    openssl-dev

ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies for tsx)
RUN npm ci

# Copy application code first
COPY . .

# Generate Prisma client after all files are copied
RUN npx prisma generate

EXPOSE 3000

# Run with tsx in development mode instead of building
CMD ["npx", "tsx", "src/index.ts"]
