FROM node:18-alpine as builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies including dev dependencies needed for build
RUN npm ci

# Generate Prisma client
RUN npx prisma generate

# Copy source code
COPY . .

# Build TypeScript code
RUN npm run build

# Production image - using alpine for smaller size but with necessary tools
FROM node:18-alpine

WORKDIR /app

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080
ENV PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1

# Add health check utility before dropping privileges
RUN apk --no-cache add curl

# Create non-root user for improved security
RUN addgroup -S nonroot && adduser -S nonroot -G nonroot

# Copy only what's needed from the builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src/generated ./dist/generated

# Set proper ownership of files
RUN chown -R nonroot:nonroot /app

# Switch to non-root user
USER nonroot

# Expose the application port (Cloud Run will automatically map this)
EXPOSE 8080

# Run the application
CMD ["node", "dist/index.js"] 