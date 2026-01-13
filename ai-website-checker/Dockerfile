# Multi-stage build for frontend and backend

# Stage 1: Build frontend
FROM node:18 AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Backend with frontend build
FROM node:18-slim
WORKDIR /app

# Copy backend files
COPY backend/package*.json ./
RUN npm install --only=production

COPY backend/ ./

# Copy frontend build from previous stage
COPY --from=frontend-build /app/frontend/build ./public

# Create reports directory
RUN mkdir -p reports

# Expose port (Railway/Render will set PORT env variable)
EXPOSE 5000

# Start command
CMD ["node", "server.js"]
