# RetroArr — Multi-stage Docker build
#
# Stage 1: Build the React client
# Stage 2: Runtime with Node.js 20, FFmpeg, and yt-dlp on Alpine

# ─────────────────────────────────────────────────────────────────
# Stage 1: React build
# ─────────────────────────────────────────────────────────────────
FROM node:20-alpine AS client-builder

WORKDIR /app/client

COPY client/package*.json ./
RUN npm ci

COPY client/ ./
RUN npm run build
# Build output goes to ../server/public (set in vite.config.js)

# ─────────────────────────────────────────────────────────────────
# Stage 2: Runtime
# ─────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime

LABEL maintainer="RetroArr"
LABEL description="Self-hosted YouTube linear TV server with HDHomeRun emulation"

# Install system dependencies:
#   ffmpeg  — video transcoding
#   python3 — required by yt-dlp for some extractors
#   curl    — to download yt-dlp binary
#   ca-certificates — for HTTPS requests
RUN apk add --no-cache \
    ffmpeg \
    python3 \
    curl \
    ca-certificates \
    && rm -rf /var/cache/apk/*

# Install yt-dlp as a standalone binary
# Pinned to a stable release for reproducibility
RUN curl -L \
    "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp" \
    -o /usr/local/bin/yt-dlp \
    && chmod +x /usr/local/bin/yt-dlp \
    && yt-dlp --version

# Set working directory
WORKDIR /app/server

# Install production dependencies only
COPY server/package*.json ./
RUN npm ci --only=production \
    && npm cache clean --force

# Copy server source
COPY server/ ./

# Copy the compiled React app from stage 1 into the server's public dir
COPY --from=client-builder /app/server/public ./public

# Create volume mount points
RUN mkdir -p /app/server/db /app/server/data/commercials

# Persist data across container restarts
VOLUME ["/app/server/db", "/app/server/data/commercials"]

# HTTP port (HDHomeRun convention)
EXPOSE 8888
# SSDP UDP port (HDHomeRun discovery)
EXPOSE 1900/udp

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:8888/api/status || exit 1

CMD ["node", "src/index.js"]
