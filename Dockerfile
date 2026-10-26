# Build Stage
# ===========
FROM node:24-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package.json .
COPY package-lock.json .
RUN npm ci

# Copy source code
COPY src ./src
COPY tsconfig.json .
COPY tsconfig.build.json .
RUN npm run build

# Start Execution
# ===============
FROM node:24-alpine

WORKDIR /app

# Install dependencies (Production only)
COPY package.json .
COPY package-lock.json .
RUN npm ci --omit=dev

# Copy the certificates
COPY certs ./certs

# Copy build artifacts from the builder stage
COPY --from=builder /app/dist ./dist

# Expose Port
EXPOSE 8000

# Set the environmental variables
ENV PORT=8000

# Run the app
CMD ["node", "dist/main.js"]
