FROM node:22-alpine AS build
WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage with nginx
FROM nginx:alpine AS runtime
WORKDIR /usr/share/nginx/html

# Remove default nginx static assets
RUN rm -rf ./*

# Copy built assets from builder
COPY --from=build /app/dist .

# Copy nginx configuration template
COPY nginx.conf /etc/nginx/nginx.conf.template

# Environment variable for API URL (defaults to localhost for development)
ENV API_URL=http://localhost:5000

# Install gettext for envsubst
RUN apk add --no-cache gettext

EXPOSE 80

# Use envsubst to replace only API_URL (not nginx variables like $host, $uri, etc.)
# Then start nginx
CMD ["/bin/sh", "-c", "envsubst '${API_URL}' < /etc/nginx/nginx.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
