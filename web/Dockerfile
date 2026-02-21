FROM node:22-alpine AS build
WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build argument for API URL (baked into the build at compile time)
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

# Build the application
RUN npm run build

# Production stage with nginx
FROM nginx:alpine AS runtime

# Create non-root user and set up writable directories for nginx
RUN addgroup -S appgroup && adduser -S appuser -G appgroup \
    && mkdir -p /var/cache/nginx /var/log/nginx /tmp/nginx \
    && chown -R appuser:appgroup /usr/share/nginx/html /var/cache/nginx /var/log/nginx /tmp/nginx \
    && chmod -R 755 /var/cache/nginx /var/log/nginx /tmp/nginx

WORKDIR /usr/share/nginx/html

# Remove default nginx static assets
RUN rm -rf ./*

# Copy built assets from builder
COPY --from=build --chown=appuser:appgroup /app/dist .

# Copy nginx configuration (static - no envsubst needed)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Switch to non-root user
USER appuser

EXPOSE 8080

CMD ["nginx", "-g", "daemon off; pid /tmp/nginx/nginx.pid;"]
