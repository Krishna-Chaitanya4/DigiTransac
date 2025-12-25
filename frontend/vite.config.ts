import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': '/src',
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
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks for better caching
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-mui': [
            '@mui/material',
            '@mui/icons-material',
            '@emotion/react',
            '@emotion/styled',
          ],
          'vendor-charts': ['recharts', '@mui/x-charts'],
          'vendor-forms': ['formik', 'yup'],
          'vendor-utils': ['axios', 'dayjs'],
        },
      },
    },
    chunkSizeWarningLimit: 1000, // Increase limit for vendor chunks
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.log in production
        drop_debugger: true,
      },
    },
  },
});
