# Stage 1: Build package (shared library)
FROM node:20-bullseye-slim AS package-builder

WORKDIR /app/core
COPY core/package.json core/package-lock.json* ./
COPY core/ .
RUN npm install
RUN npm run build

# Stage 2: Build frontend (Svelte app)
FROM node:20-bullseye-slim AS frontend-builder

WORKDIR /app/frontend

# Copy frontend source
COPY frontend/package.json frontend/package-lock.json* ./
COPY frontend/ .

# Copy built package to frontend (if frontend depends on it)
COPY --from=package-builder /app/core /app/core

RUN npm install
RUN npm run build  # assuming this builds the frontend into 'build' or 'dist'
RUN ls -la build    # confirm files here

# Stage 3: Serve frontend with Nginx and security headers for SharedArrayBuffer
FROM nginx:stable-alpine

# Remove default nginx website
RUN rm -rf /usr/share/nginx/html/*

# Copy built frontend from previous stage
COPY --from=frontend-builder /app/frontend/build /usr/share/nginx/html

# Copy custom nginx config (create this next)
COPY frontend.nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
