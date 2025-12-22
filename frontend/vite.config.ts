import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0', // Listen on all network interfaces
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            // Preserve original host for network requests
            const originalHost = req.headers.host;
            if (originalHost && !originalHost.includes('localhost')) {
              proxyReq.setHeader('X-Forwarded-Host', originalHost);
              // Replace localhost with actual IP
              proxyReq.setHeader('Host', originalHost.replace(':3000', ':5000'));
            }
          });
        },
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
