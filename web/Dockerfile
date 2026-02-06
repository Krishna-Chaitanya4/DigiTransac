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

# Copy nginx configuration template (will be processed at runtime)
COPY nginx.conf /etc/nginx/templates/default.conf.template

# Environment variable for API URL (defaults to localhost for development)
ENV API_URL=http://localhost:5000

EXPOSE 80

# Use envsubst to replace environment variables in nginx config at startup
# The nginx:alpine image supports templates in /etc/nginx/templates/ automatically
CMD ["nginx", "-g", "daemon off;"]
