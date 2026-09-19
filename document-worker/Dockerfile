# xChat document worker — renders Typst templates and writes document versions.
# Typst version is pinned (see TYPST_VERSION) to keep rendering reproducible.

ARG TYPST_VERSION=0.14.2

FROM node:22-alpine AS typst
ARG TYPST_VERSION
# typst publishes static musl binaries; pinned by version for reproducibility.
RUN apk add --no-cache curl \
  && curl -fsSL "https://github.com/typst/typst/releases/download/v${TYPST_VERSION}/typst-x86_64-unknown-linux-musl.tar.xz" \
     | tar -xJ --strip-components=1 -C /usr/local/bin \
  && /usr/local/bin/typst --version

FROM node:22-alpine
WORKDIR /app

COPY --from=typst /usr/local/bin/typst /usr/local/bin/typst

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY templates/ ./templates/
COPY src/ ./src/

ENV TYPST_BIN=/usr/local/bin/typst
ENV TYPST_TEMPLATES_DIR=/app/templates

# Run as a non-root user.
RUN addgroup -S app && adduser -S app -G app
USER app

CMD ["npx", "tsx", "src/worker.ts"]
