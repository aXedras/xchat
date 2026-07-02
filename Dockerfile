# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency files
COPY package.json package-lock.json ./

# Install dependencies with npm ci for reproducibility
# Disable prepare script to skip husky installation in Docker
RUN npm ci --ignore-scripts

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Remove unused files to reduce layer size
RUN rm -rf \
    .git \
    .github \
    .gitignore \
    README.md \
    docs \
    e2e \
    scripts \
    .husky \
    .semgrep \
    .env.* \
    kubernetes-manifest.yml \
    playwright.config.ts \
    tsconfig*.json \
    vite.config.ts \
    postcss.config.js \
    tailwind.config.ts

# Production stage
FROM nginxinc/nginx-unprivileged:stable-alpine

# Set labels for container metadata
LABEL maintainer="your-org"
LABEL description="Production React SPA served via nginx"

# Copy built assets from builder stage
COPY --from=builder --chown=101:0 /app/dist /usr/share/nginx/html

# Copy nginx configuration for optimal caching and security headers
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy entrypoint script for runtime configuration injection
COPY --chmod=755 --chown=101:0 docker/entrypoint.sh /entrypoint.sh

# Set health check to ensure nginx is responding
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:8080/index.html || exit 1

# Expose port 8080
EXPOSE 8080

# Run as non-root user (nginx unprivileged image uses UID 101)
USER 101

# Start nginx
ENTRYPOINT ["/entrypoint.sh"]
