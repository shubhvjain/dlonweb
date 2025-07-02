# Stage 1: Build the package
FROM node:20-bullseye-slim AS package-builder

WORKDIR /app/package

# Copy package source code
COPY package/package.json package/package-lock.json* ./
COPY package/ .

# Install deps and build package (Vite)
RUN npm install
RUN npm run build  # assuming this generates dist/

# Stage 2: Build backend image
FROM node:20-bullseye-slim

WORKDIR /app/backend

# Install system dependencies including ffmpeg and build tools
RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    g++ \
    make \
    libc6-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy backend source files
COPY backend/package.json backend/package-lock.json* ./
COPY backend/ .

# Copy the entire package folder from the builder stage (with dist)
COPY --from=package-builder /app/package /app/package

# Install backend dependencies, which includes "dlonwebjs": "file:../package"
RUN npm install
RUN npm rebuild @tensorflow/tfjs-node --build-from-source


CMD ["npm", "start"]