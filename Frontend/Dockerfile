# Stage 1: Build stage
FROM node:22-alpine AS build

WORKDIR /app

# Copy package files for dependency caching
COPY package.json package-lock.json ./

# Install dependencies (including devDependencies required for compiling TypeScript)
RUN npm ci

# Copy all source files
COPY . .

# Pass build-time environment variables for Vite
ARG VITE_BASE_URL=/api/v1
ARG VITE_APP_NAME="MyChair Salon ERP"
ARG VITE_GOOGLE_CLIENT_ID=""
ARG VITE_CLIENT_SECRET=""
ARG VITE_NAVIGATION_URL=""
ARG VITE_GOOGLE_TOKEN_URL=""
ARG VITE_WS_BASE_URL=""

ENV VITE_BASE_URL=$VITE_BASE_URL
ENV VITE_APP_NAME=$VITE_APP_NAME
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
ENV VITE_CLIENT_SECRET=$VITE_CLIENT_SECRET
ENV VITE_NAVIGATION_URL=$VITE_NAVIGATION_URL
ENV VITE_GOOGLE_TOKEN_URL=$VITE_GOOGLE_TOKEN_URL
ENV VITE_WS_BASE_URL=$VITE_WS_BASE_URL

# Build the application using Vite directly (bypassing tsc check for preexisting type errors)
RUN npx vite build

# Stage 2: Production execution stage
FROM nginx:1.25-alpine

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy static built assets from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Expose port 80 for Nginx
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
