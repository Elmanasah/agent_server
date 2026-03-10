# syntax=docker/dockerfile:1

# ================================
# Stage 1: Dependencies
# ================================
ARG NODE_VERSION=20.18.0
FROM node:${NODE_VERSION}-alpine AS dependencies


LABEL org.opencontainers.image.title="agent-api"
LABEL org.opencontainers.image.description="agent API"

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install production dependencies only
RUN npm install --omit=dev && npm cache clean --force



# ================================
# Stage 2: Production Image
# ================================
FROM node:${NODE_VERSION}-alpine AS production

# Set production environment
ENV NODE_ENV=production

WORKDIR /app


# Create non-root user for security (Alpine Linux commands)
RUN addgroup -S nodejs && adduser -S -G nodejs nodejs

# Copy dependencies from previous stage
COPY --from=dependencies --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copy application code
COPY --chown=nodejs:nodejs . .

# Switch to non-root user
USER nodejs

# Expose application port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1));"

# Start the application
CMD ["node", "index.js"]
