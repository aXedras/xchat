
# Base image
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy project files
COPY . .

# Build the app
RUN npm run build

# Production stage
FROM nginxinc/nginx-unprivileged:stable-alpine

# Copy built assets from builder stage
COPY --from=builder --chown=101:0 /app/dist /usr/share/nginx/html

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --chmod=755 --chown=101:0 docker/entrypoint.sh /entrypoint.sh

# Expose port
EXPOSE 8080

# Run nginx as a non-root user.
USER 101

# Start nginx
ENTRYPOINT ["/entrypoint.sh"]
